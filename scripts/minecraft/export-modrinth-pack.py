#!/usr/bin/env python3
"""Export the client building pack as a Modrinth .mrpack file."""

from __future__ import annotations

import argparse
import json
import urllib.request
import zipfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_LOCK = ROOT_DIR / ".modpack" / "client-mods" / ".modrinth-pack-lock.json"
DEFAULT_OUTPUT = ROOT_DIR / "public" / "downloads" / "nfoifsb-building-client-26.1.2.mrpack"
USER_AGENT = "nfoifsb-modpack-exporter/1.0 (https://github.com/Furu002/mincraft_server_website)"


def load_json_url(url: str) -> object:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def latest_fabric_loader(minecraft_version: str) -> str:
    data = load_json_url(f"https://meta.fabricmc.net/v2/versions/loader/{minecraft_version}")
    for entry in data:
        loader = entry.get("loader", {})
        if loader.get("stable"):
            return loader["version"]
    return data[0]["loader"]["version"]


def build_index(lock: dict, loader_version: str) -> dict:
    minecraft_version = lock["minecraftVersion"]
    files = []
    for entry in sorted(lock["files"].values(), key=lambda item: item["path"].lower()):
        files.append(
            {
                "path": f"mods/{entry['path']}",
                "hashes": {
                    "sha512": entry["sha512"],
                },
                "env": {
                    "client": "required",
                    "server": "unsupported",
                },
                "downloads": [entry["downloadUrl"]],
                "fileSize": entry["fileSize"],
            }
        )
    return {
        "formatVersion": 1,
        "game": "minecraft",
        "versionId": f"{minecraft_version}-1",
        "name": "VELYX Building Client Pack",
        "summary": "Fabric client modpack for velyx.kr builders: Axiom, Litematica, WorldEdit CUI, MiniHUD, shaders, and performance mods.",
        "files": files,
        "dependencies": {
            "minecraft": minecraft_version,
            "fabric-loader": loader_version,
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export a Modrinth .mrpack from the client lock file.")
    parser.add_argument("--lock", default=str(DEFAULT_LOCK), help="Client .modrinth-pack-lock.json path.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output .mrpack path.")
    parser.add_argument("--fabric-loader", default=None, help="Fabric Loader version. Defaults to latest stable for the pack Minecraft version.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    lock_path = Path(args.lock).resolve()
    output_path = Path(args.output).resolve()
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    loader_version = args.fabric_loader or latest_fabric_loader(lock["minecraftVersion"])
    index = build_index(lock, loader_version)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as pack:
        pack.writestr("modrinth.index.json", json.dumps(index, indent=2, ensure_ascii=False) + "\n")
        icon_path = ROOT_DIR / "public" / "assets" / "server-icon.png"
        if icon_path.exists():
            pack.write(icon_path, "overrides/icon.png")
    print(f"wrote {output_path}")
    print(f"minecraft={lock['minecraftVersion']} fabric-loader={loader_version} files={len(index['files'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
