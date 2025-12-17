#!/usr/bin/env bash
set -euo pipefail

load_env_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    return 0
  fi

  set -a
  # shellcheck disable=SC1090
  source "$file"
  set +a
}

load_env_file ".env.local"

if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  load_env_file "$HOME/.secrets"
fi

if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo "Missing OPENROUTER_API_KEY (set in .env.local or $HOME/.secrets)"
  exit 1
fi

vars=(
  OPENROUTER_API_KEY
  OPENROUTER_IMPORT_MODEL
  OPENROUTER_IMPORT_VERIFIER_MODEL
)

for var in "${vars[@]}"; do
  value="${!var:-}"
  if [[ -z "${value}" ]]; then
    continue
  fi
  ./scripts/pnpm.sh convex env set "${var}" "${value}"
done

echo "Synced OpenRouter env vars to Convex (dev deployment)"
