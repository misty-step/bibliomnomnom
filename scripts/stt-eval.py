#!/usr/bin/env python3
"""
STT Provider Eval — benchmark speech-to-text providers for book-note sessions.

Adapted from vox/scripts/stt-eval.py for bibliomnomnom's batch-processing model.

Benchmarks:
  - ElevenLabs Scribe v2 (primary candidate)
  - Deepgram Nova-3 (batch)
  - AssemblyAI Universal-2 (batch, not Universal-Streaming which is real-time only)

Usage:
    python3 scripts/stt-eval.py path/to/audio.wav
    python3 scripts/stt-eval.py path/to/audio.wav --iterations 3
    python3 scripts/stt-eval.py --record 30          # Record 30s then eval
    python3 scripts/stt-eval.py --record 1800        # Record 30min session

Set API keys via environment or .env.local:
    ELEVENLABS_API_KEY, DEEPGRAM_API_KEY, ASSEMBLYAI_API_KEY

Output:
    docs/performance/stt-eval-YYYY-MM-DD.md     (markdown report)
    docs/performance/stt-eval-raw-YYYY-MM-DD.json (raw data)

Note on AssemblyAI: This script uses AssemblyAI's async batch API (Universal-2),
NOT the Universal-Streaming product. Universal-Streaming is a real-time WebSocket
API limited to 3-hour sessions and 6 languages — unsuitable for this app's 4-hour
max and multilingual requirements. See docs/performance/stt-decision-matrix.md.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "docs" / "performance"

# Cost per minute (USD) for each provider — batch / pre-recorded path.
# Updated 2026-02-20. Re-check provider pricing pages before relying on these.
COST_PER_MIN = {
    "ElevenLabs Scribe v2": 0.22 / 60,    # $0.22/hr
    "Deepgram Nova-3":      0.0043,         # $0.0043/min
    "AssemblyAI Universal-2": 0.65 / 60,   # ~$0.65/hr (estimate — verify on dashboard)
}


# ---------------------------------------------------------------------------
# API key loading
# ---------------------------------------------------------------------------

def load_env(names):
    """Load API keys from environment, falling back to .env.local."""
    keys = {}
    env_path = REPO_ROOT / ".env.local"
    env_lines = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env_lines[k.strip()] = v.strip().strip('"').strip("'")
    for name in names:
        keys[name] = os.environ.get(name) or env_lines.get(name, "")
    return keys


# ---------------------------------------------------------------------------
# Recording
# ---------------------------------------------------------------------------

def record_audio(duration, output_path, device_index=1):
    """Record audio using ffmpeg avfoundation (macOS)."""
    print(f"\n  Recording {duration}s from device {device_index}...")
    print("  Speak now! ", end="", flush=True)
    cmd = [
        "ffmpeg", "-y",
        "-f", "avfoundation",
        "-i", f":{device_index}",
        "-ar", "16000", "-ac", "1", "-sample_fmt", "s16",
        "-t", str(duration),
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=duration + 10)
    if result.returncode != 0:
        print("FAILED")
        print(f"  ffmpeg stderr: {result.stderr[-500:]}")
        sys.exit(1)
    size = os.path.getsize(output_path)
    print(f"Done ({size / 1024:.0f} KB)")
    return output_path


def ensure_wav(input_path):
    """Convert input to 16kHz mono WAV if needed."""
    path = Path(input_path)
    if path.suffix.lower() == ".wav":
        return str(path)
    wav_path = path.with_suffix(".wav")
    print(f"  Converting {path.name} → {wav_path.name}...")
    subprocess.run([
        "ffmpeg", "-y", "-i", str(path),
        "-ar", "16000", "-ac", "1", "-sample_fmt", "s16",
        str(wav_path),
    ], capture_output=True, check=True)
    return str(wav_path)


# ---------------------------------------------------------------------------
# Provider implementations
# ---------------------------------------------------------------------------

def call_elevenlabs(api_key, wav_path):
    """ElevenLabs Scribe v2 — batch speech-to-text."""
    start = time.monotonic()
    with open(wav_path, "rb") as f:
        resp = requests.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": api_key},
            files={"file": ("audio.wav", f, "audio/wav")},
            data={"model_id": "scribe_v2"},
            timeout=300,
        )
    latency = time.monotonic() - start
    if resp.status_code != 200:
        return None, latency, f"HTTP {resp.status_code}: {resp.text[:200]}"
    return resp.json().get("text", ""), latency, None


def call_deepgram(api_key, wav_path):
    """Deepgram Nova-3 — batch pre-recorded transcription."""
    start = time.monotonic()
    with open(wav_path, "rb") as f:
        audio_data = f.read()
    resp = requests.post(
        "https://api.deepgram.com/v1/listen",
        params={
            "model": "nova-3",
            "punctuate": "true",
            "smart_format": "true",
            "diarize": "false",
        },
        headers={
            "Authorization": f"Token {api_key}",
            "Content-Type": "audio/wav",
        },
        data=audio_data,
        timeout=300,
    )
    latency = time.monotonic() - start
    if resp.status_code != 200:
        return None, latency, f"HTTP {resp.status_code}: {resp.text[:200]}"
    data = resp.json()
    try:
        transcript = data["results"]["channels"][0]["alternatives"][0]["transcript"]
    except (KeyError, IndexError):
        return None, latency, f"Unexpected response shape: {json.dumps(data)[:200]}"
    return transcript, latency, None


def call_assemblyai(api_key, wav_path):
    """AssemblyAI Universal-2 — async batch transcription.

    Uses the three-step async flow: upload → submit → poll.
    Note: This benchmarks Universal-2 (batch), NOT Universal-Streaming (real-time).
    Universal-Streaming was rejected due to its 3-hour session cap.
    """
    start = time.monotonic()

    # Step 1: Upload audio
    with open(wav_path, "rb") as f:
        upload_resp = requests.post(
            "https://api.assemblyai.com/v2/upload",
            headers={"authorization": api_key},
            data=f,
            timeout=120,
        )
    if upload_resp.status_code != 200:
        latency = time.monotonic() - start
        return None, latency, f"Upload failed HTTP {upload_resp.status_code}: {upload_resp.text[:200]}"

    audio_url = upload_resp.json()["upload_url"]

    # Step 2: Submit transcription job
    submit_resp = requests.post(
        "https://api.assemblyai.com/v2/transcript",
        headers={
            "authorization": api_key,
            "content-type": "application/json",
        },
        json={"audio_url": audio_url, "punctuate": True, "format_text": True},
        timeout=30,
    )
    if submit_resp.status_code != 200:
        latency = time.monotonic() - start
        return None, latency, f"Submit failed HTTP {submit_resp.status_code}: {submit_resp.text[:200]}"

    transcript_id = submit_resp.json()["id"]

    # Step 3: Poll for completion (10-min timeout to prevent infinite hangs)
    polling_endpoint = f"https://api.assemblyai.com/v2/transcript/{transcript_id}"
    poll_deadline = start + 600  # 10 minutes
    while time.monotonic() < poll_deadline:
        poll_resp = requests.get(
            polling_endpoint,
            headers={"authorization": api_key},
            timeout=30,
        )
        if poll_resp.status_code != 200:
            latency = time.monotonic() - start
            return None, latency, f"Poll failed HTTP {poll_resp.status_code}: {poll_resp.text[:200]}"
        status = poll_resp.json()["status"]
        if status == "completed":
            latency = time.monotonic() - start
            return poll_resp.json().get("text", ""), latency, None
        if status == "error":
            latency = time.monotonic() - start
            return None, latency, f"Transcription error: {poll_resp.json().get('error', 'unknown')}"
        time.sleep(3)
    latency = time.monotonic() - start
    return None, latency, f"Polling timed out after 600s (last status: {status})"


# ---------------------------------------------------------------------------
# Provider registry
# ---------------------------------------------------------------------------

PROVIDERS = [
    {
        "name": "ElevenLabs Scribe v2",
        "key_name": "ELEVENLABS_API_KEY",
        "call": lambda key, path: call_elevenlabs(key, path),
    },
    {
        "name": "Deepgram Nova-3",
        "key_name": "DEEPGRAM_API_KEY",
        "call": lambda key, path: call_deepgram(key, path),
    },
    {
        "name": "AssemblyAI Universal-2",
        "key_name": "ASSEMBLYAI_API_KEY",
        "call": lambda key, path: call_assemblyai(key, path),
    },
]


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

def similarity(a, b):
    """Normalized string similarity (0-1)."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def run_eval(providers, keys, wav_path, iterations):
    """Run all providers and collect results."""
    active = [p for p in providers if keys.get(p["key_name"])]
    skipped = [p for p in providers if not keys.get(p["key_name"])]

    if skipped:
        print(f"\n  Skipping (no API key): {', '.join(p['name'] for p in skipped)}")
    if not active:
        print("ERROR: No API keys found. Set keys in .env.local or environment.")
        sys.exit(1)
    print(f"  Testing: {', '.join(p['name'] for p in active)}")
    print()

    all_results = {p["name"]: [] for p in active}

    for iteration in range(iterations):
        if iterations > 1:
            print(f"  --- Iteration {iteration + 1}/{iterations} ---")

        futures = {}
        with ThreadPoolExecutor(max_workers=len(active)) as executor:
            for p in active:
                key = keys[p["key_name"]]
                future = executor.submit(p["call"], key, wav_path)
                futures[future] = p["name"]

            for future in as_completed(futures):
                name = futures[future]
                try:
                    transcript, latency, error = future.result()
                except Exception as e:
                    transcript, latency, error = None, 0.0, str(e)

                if error:
                    print(f"  {name:40s}  ERROR: {error[:80]}")
                    all_results[name].append({
                        "iteration": iteration + 1,
                        "error": error,
                        "latency": latency,
                    })
                else:
                    chars = len(transcript) if transcript else 0
                    print(f"  {name:40s}  {latency:6.2f}s  {chars:4d} chars")
                    all_results[name].append({
                        "iteration": iteration + 1,
                        "transcript": transcript,
                        "latency": latency,
                        "chars": chars,
                    })

    return all_results


def compute_consensus(results):
    """Find the transcript most similar to all others (plurality vote)."""
    transcripts = []
    for runs in results.values():
        for run in runs:
            if run.get("transcript"):
                transcripts.append(run["transcript"])
    if not transcripts:
        return ""
    best_score, best = -1, transcripts[0]
    for t in transcripts:
        score = sum(similarity(t, other) for other in transcripts)
        if score > best_score:
            best_score, best = score, t
    return best



def generate_report(results, consensus, wav_path, duration_s, iterations, timestamp):
    """Generate markdown comparison report."""
    duration_min = duration_s / 60

    lines = [
        "# STT Provider Evaluation — bibliomnomnom",
        "",
        f"- **Generated**: {timestamp}",
        f"- **Audio**: `{Path(wav_path).name}`",
        f"- **Duration**: {duration_s:.0f}s ({duration_min:.1f} min)",
        f"- **Iterations per provider**: {iterations}",
        "",
        "## Latency & Quality",
        "",
        "| Provider | Avg Latency | Min Latency | Avg Chars | Similarity | Errors |",
        "| --- | --- | --- | --- | --- | --- |",
    ]

    summaries = []
    for name, runs in results.items():
        successes = [r for r in runs if "transcript" in r]
        errors = [r for r in runs if "error" in r]
        if not successes:
            summaries.append((name, 999, 999, 0, 0, len(errors), len(runs)))
            continue
        avg_lat = sum(r["latency"] for r in successes) / len(successes)
        min_lat = min(r["latency"] for r in successes)
        avg_chars = sum(r["chars"] for r in successes) / len(successes)
        avg_sim = (
            sum(similarity(r["transcript"], consensus) for r in successes) / len(successes)
            if consensus else 0
        )
        summaries.append((name, avg_lat, min_lat, avg_chars, avg_sim, len(errors), len(runs)))

    summaries.sort(key=lambda x: x[1])

    for name, avg_lat, min_lat, chars, sim, errs, total in summaries:
        if avg_lat == 999:
            lines.append(f"| {name} | — | — | — | — | {errs}/{total} |")
        else:
            lines.append(
                f"| **{name}** | {avg_lat:.2f}s | {min_lat:.2f}s | "
                f"{chars:.0f} | {sim:.1%} | {errs}/{total} |"
            )

    # Cost projection
    lines.extend([
        "",
        "## Cost Projection",
        "",
        "| Provider | Actual Duration | 10 min | 30 min | 60 min | Rate (per min) |",
        "| --- | --- | --- | --- | --- | --- |",
    ])

    for name in results:
        cpp = COST_PER_MIN.get(name)
        if cpp:
            lines.append(
                f"| **{name}** | ${cpp * duration_min:.4f}"
                f" | ${cpp * 10:.4f} | ${cpp * 30:.4f} | ${cpp * 60:.4f}"
                f" | ${cpp:.5f}/min |"
            )
        else:
            lines.append(f"| **{name}** | — | — | — | — | — |")

    # Transcripts
    lines.extend(["", "## Transcripts", ""])
    for name, runs in results.items():
        successes = [r for r in runs if "transcript" in r]
        if successes:
            lines.extend([
                f"### {name}",
                "",
                f"> {successes[0]['transcript']}",
                "",
            ])

    if consensus:
        lines.extend([
            "## Consensus Transcript",
            "",
            f"> {consensus}",
            "",
        ])

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="STT Provider Evaluation for bibliomnomnom",
        epilog="Set ELEVENLABS_API_KEY, DEEPGRAM_API_KEY, ASSEMBLYAI_API_KEY in .env.local",
    )
    parser.add_argument("audio_file", nargs="?", help="Path to audio file (WAV, CAF, MP3, etc.)")
    parser.add_argument("--record", type=int, metavar="SECONDS", help="Record N seconds via microphone")
    parser.add_argument("--device", type=int, default=1, help="Audio input device index (macOS, default: 1)")
    parser.add_argument("--iterations", type=int, default=1, help="Runs per provider (default: 1)")
    args = parser.parse_args()

    if not args.audio_file and not args.record:
        parser.error("Provide an audio file or use --record N")

    key_names = list({p["key_name"] for p in PROVIDERS})
    keys = load_env(key_names)

    if args.record:
        wav_path = tempfile.mktemp(suffix=".wav", prefix="stt-eval-")
        record_audio(args.record, wav_path, device_index=args.device)
    else:
        if not os.path.exists(args.audio_file):
            print(f"ERROR: File not found: {args.audio_file}")
            sys.exit(1)
        wav_path = ensure_wav(args.audio_file)

    file_size = os.path.getsize(wav_path)
    # Use ffprobe for accurate duration; fall back to file-size estimate
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "csv=p=0", wav_path],
            capture_output=True, text=True, timeout=10,
        )
        duration_s = float(probe.stdout.strip())
    except (subprocess.TimeoutExpired, ValueError, FileNotFoundError):
        duration_s = file_size / (16000 * 2)  # 16kHz 16-bit mono estimate
    print(f"\n  Audio: {wav_path}")
    print(f"  Size: {file_size / 1024:.0f} KB (~{duration_s:.0f}s / {duration_s/60:.1f} min)")
    print(f"\n  Running {args.iterations} iteration(s) per provider...\n")

    results = run_eval(PROVIDERS, keys, wav_path, args.iterations)
    consensus = compute_consensus(results)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    report = generate_report(results, consensus, wav_path, duration_s, args.iterations, timestamp)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    report_path = OUTPUT_DIR / f"stt-eval-{date_str}.md"
    raw_path = OUTPUT_DIR / f"stt-eval-raw-{date_str}.json"

    report_path.write_text(report)
    raw_data = {
        "timestamp": timestamp,
        "audio_file": wav_path,
        "duration_s": duration_s,
        "iterations": args.iterations,
        "cost_per_min": COST_PER_MIN,
        "results": results,
        "consensus": consensus,
    }
    raw_path.write_text(json.dumps(raw_data, indent=2, default=str))

    print(f"\n{'=' * 70}")
    print(report)
    print(f"{'=' * 70}")
    print(f"\n  Report saved: {report_path}")
    print(f"  Raw data:    {raw_path}")


if __name__ == "__main__":
    main()
