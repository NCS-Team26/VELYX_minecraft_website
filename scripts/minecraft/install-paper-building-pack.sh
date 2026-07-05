#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TARGET_DIR="${1:-${MINECRAFT_SERVER_PLUGINS:-./plugins}}"
MINECRAFT_VERSION="${MINECRAFT_VERSION:-26.1.2}"

python3 "$ROOT_DIR/scripts/minecraft/install-modrinth-pack.py" \
  --manifest "$ROOT_DIR/infra/minecraft/building-pack.json" \
  --side server \
  --target "$TARGET_DIR" \
  --minecraft-version "$MINECRAFT_VERSION" \
  --prune-managed
