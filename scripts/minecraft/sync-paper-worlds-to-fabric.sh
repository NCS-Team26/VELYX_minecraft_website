#!/usr/bin/env bash
set -euo pipefail

PAPER_SERVER_DIR="${PAPER_SERVER_DIR:-$HOME/minecraft}"
FABRIC_SERVER_DIR="${FABRIC_SERVER_DIR:-$HOME/minecraft-fabric}"
SERVICE_NAME="${SERVICE_NAME:-minecraft-fabric.service}"
DIMENSIONS="${DIMENSIONS:-overworld the_nether the_end lobby shop wild spawn spawn_lobby}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORLD_BRIDGE_SRC="${WORLD_BRIDGE_SRC:-$REPO_ROOT/infra/minecraft/datapacks/nfoifsb_worlds}"
BLUEMAP_MAPS_SRC="${BLUEMAP_MAPS_SRC:-$REPO_ROOT/infra/minecraft/bluemap/maps}"

PAPER_WORLD="$PAPER_SERVER_DIR/world"
FABRIC_WORLD="$FABRIC_SERVER_DIR/world"
BACKUP_ROOT="$FABRIC_SERVER_DIR/backups/world-datapack-sync-$(date +%Y%m%d-%H%M%S)"

if [ ! -d "$PAPER_WORLD/dimensions/minecraft" ]; then
  echo "Missing Paper dimensions: $PAPER_WORLD/dimensions/minecraft" >&2
  exit 1
fi

if [ ! -d "$FABRIC_SERVER_DIR" ]; then
  echo "Missing Fabric server directory: $FABRIC_SERVER_DIR" >&2
  exit 1
fi

mkdir -p "$BACKUP_ROOT"

if systemctl list-unit-files "$SERVICE_NAME" >/dev/null 2>&1; then
  sudo systemctl stop "$SERVICE_NAME" || true
fi

if [ -d "$FABRIC_WORLD" ]; then
  cp -a "$FABRIC_WORLD" "$BACKUP_ROOT/world"
fi

mkdir -p "$FABRIC_WORLD/dimensions/minecraft" "$FABRIC_WORLD/datapacks" "$FABRIC_WORLD/data/minecraft"

for dim in $DIMENSIONS; do
  if ! [[ "$dim" =~ ^[a-z0-9_/-]+$ ]]; then
    echo "Refusing unsafe dimension name: $dim" >&2
    exit 1
  fi

  src="$PAPER_WORLD/dimensions/minecraft/$dim"
  dst="$FABRIC_WORLD/dimensions/minecraft/$dim"
  if [ -d "$src" ]; then
    rm -rf -- "$dst"
    cp -a "$src" "$dst"
    echo "Synced minecraft:$dim"
  fi
done

if [ -d "$PAPER_WORLD/players" ]; then
  rm -rf -- "$FABRIC_WORLD/players"
  cp -a "$PAPER_WORLD/players" "$FABRIC_WORLD/players"
fi

if [ -d "$PAPER_WORLD/data/minecraft" ]; then
  cp -a "$PAPER_WORLD/data/minecraft/." "$FABRIC_WORLD/data/minecraft/"
fi

if [ -f "$BACKUP_ROOT/world/data/minecraft/world_gen_settings.dat" ]; then
  cp -a "$BACKUP_ROOT/world/data/minecraft/world_gen_settings.dat" "$FABRIC_WORLD/data/minecraft/world_gen_settings.dat"
fi

if [ -d "$PAPER_WORLD/datapacks/bukkit" ]; then
  rm -rf -- "$FABRIC_WORLD/datapacks/bukkit"
  cp -a "$PAPER_WORLD/datapacks/bukkit" "$FABRIC_WORLD/datapacks/bukkit"
fi

if [ -f "$PAPER_WORLD/datapacks/icn_1to1_datapack.zip" ]; then
  tmp="$(mktemp -d)"
  unzip -q "$PAPER_WORLD/datapacks/icn_1to1_datapack.zip" -d "$tmp/icn"
  cat > "$tmp/icn/pack.mcmeta" <<'JSON'
{
  "pack": {
    "description": "Incheon International Airport 1:1 construction base for nfoifsb Fabric",
    "min_format": [101, 1],
    "max_format": [101, 1]
  }
}
JSON
  if [ -d "$tmp/icn/data/icn/functions" ] && [ ! -d "$tmp/icn/data/icn/function" ]; then
    cp -a "$tmp/icn/data/icn/functions" "$tmp/icn/data/icn/function"
  fi
  rm -f "$FABRIC_WORLD/datapacks/icn_1to1_datapack_26.zip"
  (cd "$tmp/icn" && zip -qr "$FABRIC_WORLD/datapacks/icn_1to1_datapack_26.zip" .)
  rm -rf -- "$tmp"
fi

if [ -d "$WORLD_BRIDGE_SRC" ]; then
  rm -rf -- "$FABRIC_WORLD/datapacks/nfoifsb_worlds"
  cp -a "$WORLD_BRIDGE_SRC" "$FABRIC_WORLD/datapacks/nfoifsb_worlds"
fi

if [ -f "$FABRIC_SERVER_DIR/server.properties" ]; then
  python3 - "$FABRIC_SERVER_DIR/server.properties" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
lines = path.read_text().splitlines()
updates = {
    "initial-enabled-packs": "vanilla,fabric-convention-tags-v2,file/bukkit,file/nfoifsb_worlds,file/icn_1to1_datapack_26.zip",
    "initial-disabled-packs": "",
}
seen = set()
out = []
for line in lines:
    if "=" in line and not line.startswith("#"):
        key = line.split("=", 1)[0]
        if key in updates:
            out.append(f"{key}={updates[key]}")
            seen.add(key)
            continue
    out.append(line)
for key, value in updates.items():
    if key not in seen:
        out.append(f"{key}={value}")
path.write_text("\n".join(out) + "\n")
PY
fi

if [ -d "$BLUEMAP_MAPS_SRC" ] && [ -d "$FABRIC_SERVER_DIR/config/bluemap/maps" ]; then
  cp -a "$BLUEMAP_MAPS_SRC/." "$FABRIC_SERVER_DIR/config/bluemap/maps/"
fi

sudo chown -R "$(id -un):$(id -gn)" "$FABRIC_WORLD" "$FABRIC_SERVER_DIR/config/bluemap/maps" 2>/dev/null || true

if systemctl list-unit-files "$SERVICE_NAME" >/dev/null 2>&1; then
  sudo systemctl start "$SERVICE_NAME"
fi

echo "Synced Paper worlds and datapacks into Fabric."
echo "Backup: $BACKUP_ROOT"
