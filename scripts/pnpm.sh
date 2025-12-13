#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

if command -v asdf >/dev/null 2>&1 && [ -f .tool-versions ] && grep -q "^nodejs " .tool-versions; then
  exec asdf exec pnpm "$@"
fi

exec pnpm "$@"

