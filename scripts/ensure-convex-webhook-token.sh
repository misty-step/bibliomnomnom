#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.local}"
BUN_WRAPPER="./scripts/bun.sh"
TOKEN_KEY="CONVEX_WEBHOOK_TOKEN"

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  echo "$value"
}

strip_quotes() {
  local value="$1"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  echo "$value"
}

is_valid_token() {
  local token="$1"
  [[ "$token" =~ ^[a-f0-9]{64}$ ]]
}

read_local_token() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo ""
    return
  fi

  local line
  line=$(grep -E "^${TOKEN_KEY}=" "$ENV_FILE" | tail -n 1 || true)
  if [[ -z "$line" ]]; then
    echo ""
    return
  fi

  local value="${line#${TOKEN_KEY}=}"
  value="$(trim "$(strip_quotes "$value")")"
  echo "$value"
}

write_local_token() {
  local token="$1"
  touch "$ENV_FILE"

  if grep -q -E "^${TOKEN_KEY}=" "$ENV_FILE"; then
    sed "s|^${TOKEN_KEY}=.*|${TOKEN_KEY}=${token}|" "$ENV_FILE" > "${ENV_FILE}.tmp"
    mv "${ENV_FILE}.tmp" "$ENV_FILE"
  else
    printf "\n%s=%s\n" "$TOKEN_KEY" "$token" >> "$ENV_FILE"
  fi
}

read_convex_token() {
  local env_output=""
  if ! env_output=$("$BUN_WRAPPER" convex env list 2>/dev/null); then
    echo ""
    return 1
  fi

  local line
  line=$(echo "$env_output" | grep -E "^${TOKEN_KEY}=" | head -n 1 || true)
  if [[ -z "$line" ]]; then
    echo ""
    return 0
  fi

  local value="${line#${TOKEN_KEY}=}"
  value="$(trim "$(strip_quotes "$value")")"
  echo "$value"
  return 0
}

write_convex_token() {
  local token="$1"
  "$BUN_WRAPPER" convex env set "$TOKEN_KEY" "$token" >/dev/null
}

generate_token() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi

  node -e "const crypto=require('crypto');console.log(crypto.randomBytes(32).toString('hex'));"
}

main() {
  local local_token
  local convex_token
  local convex_env_ready=true

  local_token="$(read_local_token)"

  # Next.js won't override existing env vars from .env.local, even if empty.
  # If CONVEX_WEBHOOK_TOKEN is exported in the shell, force it to match .env.local or fail fast.
  if [[ "${CONVEX_WEBHOOK_TOKEN+x}" == "x" ]]; then
    local env_override
    env_override="$(trim "$(strip_quotes "${CONVEX_WEBHOOK_TOKEN}")")"
    if [[ -z "$env_override" ]]; then
      echo "[Billing] CONVEX_WEBHOOK_TOKEN is exported but empty. Run: unset CONVEX_WEBHOOK_TOKEN"
      exit 1
    fi

    if [[ -n "$local_token" && "$local_token" != "$env_override" ]]; then
      echo "[Billing] CONVEX_WEBHOOK_TOKEN is exported and differs from ${ENV_FILE}. Run: unset CONVEX_WEBHOOK_TOKEN (recommended) or sync values."
      exit 1
    fi

    if [[ -z "$local_token" ]]; then
      write_local_token "$env_override"
      local_token="$env_override"
      echo "[Billing] Synced CONVEX_WEBHOOK_TOKEN from shell env to ${ENV_FILE}."
    fi
  fi

  if ! convex_token="$(read_convex_token)"; then
    convex_env_ready=false
    convex_token=""
  fi

  if ! is_valid_token "$local_token"; then
    local_token=""
  fi

  if ! is_valid_token "$convex_token"; then
    convex_token=""
  fi

  if [[ "$convex_env_ready" != "true" ]]; then
    if [[ -z "$local_token" ]]; then
      local_token="$(generate_token)"
      write_local_token "$local_token"
      echo "[Billing] Generated CONVEX_WEBHOOK_TOKEN in .env.local (Convex dev not configured yet)."
      echo "[Billing] After Convex is set up, run: bun run env:sync:webhook-token"
      return
    fi

    echo "[Billing] Convex dev not configured yet; skipping Convex webhook token sync."
    return
  fi

  if [[ -z "$local_token" && -z "$convex_token" ]]; then
    local_token="$(generate_token)"
    write_local_token "$local_token"
    write_convex_token "$local_token"
    echo "[Billing] Generated and synced CONVEX_WEBHOOK_TOKEN for local + Convex dev."
    return
  fi

  if [[ -z "$local_token" && -n "$convex_token" ]]; then
    write_local_token "$convex_token"
    echo "[Billing] Synced CONVEX_WEBHOOK_TOKEN from Convex dev to .env.local."
    return
  fi

  if [[ -n "$local_token" && -z "$convex_token" ]]; then
    write_convex_token "$local_token"
    echo "[Billing] Synced CONVEX_WEBHOOK_TOKEN from .env.local to Convex dev."
    return
  fi

  if [[ "$local_token" != "$convex_token" ]]; then
    write_convex_token "$local_token"
    echo "[Billing] Reconciled webhook token mismatch by updating Convex dev."
    return
  fi

  echo "[Billing] CONVEX_WEBHOOK_TOKEN already in sync."
}

main "$@"
