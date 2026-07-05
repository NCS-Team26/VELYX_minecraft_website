#!/usr/bin/env python3
"""Download a Modrinth-based Minecraft plugin/mod pack from a local manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = ROOT_DIR / "infra" / "minecraft" / "building-pack.json"
USER_AGENT = "nfoifsb-modpack-installer/1.0 (https://github.com/Furu002/mincraft_server_website)"
LOCK_FILE = ".modrinth-pack-lock.json"


def log(message: str) -> None:
    print(message, flush=True)


def load_json_url(url: str) -> object:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def download_file(url: str, target: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)


def normalize_version(value: str) -> tuple[int, ...]:
    return tuple(int(part) for part in re.findall(r"\d+", value))


def version_matches(target: str, advertised: str) -> bool:
    advertised = advertised.strip()
    if advertised == target:
        return True
    if advertised.endswith(".x"):
        return target.startswith(advertised[:-1])
    if re.fullmatch(r"\d+\.\d+", advertised):
        return target == advertised or target.startswith(f"{advertised}.")
    if "-" in advertised or "–" in advertised:
        parts = re.split(r"\s*[-–]\s*", advertised, maxsplit=1)
        if len(parts) == 2:
            target_tuple = normalize_version(target)
            return normalize_version(parts[0]) <= target_tuple <= normalize_version(parts[1])
    return False


def loader_matches(version: dict, accepted_loaders: list[str]) -> bool:
    version_loaders = set(version.get("loaders", []))
    return bool(version_loaders.intersection(accepted_loaders))


def compatible_versions(versions: list[dict], minecraft_version: str, accepted_loaders: list[str], allow_prerelease: bool) -> list[dict]:
    compatible = [
        version
        for version in versions
        if loader_matches(version, accepted_loaders)
        and any(version_matches(minecraft_version, game_version) for game_version in version.get("game_versions", []))
    ]
    if allow_prerelease:
        return compatible
    releases = [version for version in compatible if version.get("version_type") == "release"]
    if releases:
        return releases
    return []


def choose_primary_file(version: dict) -> dict:
    files = version.get("files") or []
    primary = [file for file in files if file.get("primary") and file.get("filename", "").endswith(".jar")]
    if primary:
        return primary[0]
    jars = [file for file in files if file.get("filename", "").endswith(".jar")]
    if jars:
        return jars[0]
    raise ValueError(f"No jar file found for {version.get('name') or version.get('version_number')}")


def safe_filename(filename: str) -> str:
    return re.sub(r"[^A-Za-z0-9._+() -]", "_", filename).strip(" .")


def file_sha512(path: Path) -> str:
    digest = hashlib.sha512()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_lock(target_dir: Path) -> dict:
    lock_path = target_dir / LOCK_FILE
    if not lock_path.exists():
        return {"files": {}}
    try:
        return json.loads(lock_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"files": {}}


def write_lock(target_dir: Path, lock: dict) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    (target_dir / LOCK_FILE).write_text(json.dumps(lock, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def prune_managed_files(target_dir: Path, previous_lock: dict, current_lock: dict, dry_run: bool) -> None:
    previous_files = previous_lock.get("files", {})
    current_paths = {entry.get("path") for entry in current_lock.get("files", {}).values()}
    for slug, entry in previous_files.items():
        path = entry.get("path")
        if not path or path in current_paths:
            continue
        candidate = target_dir / path
        if not candidate.exists() or candidate.parent != target_dir:
            continue
        if dry_run:
            log(f"[dry-run] prune old managed jar: {candidate.name}")
        else:
            candidate.unlink()
            log(f"pruned old managed jar: {candidate.name} ({slug})")


def project_versions(slug: str) -> list[dict]:
    url = f"https://api.modrinth.com/v2/project/{urllib.parse.quote(slug)}/version"
    data = load_json_url(url)
    if not isinstance(data, list):
        raise ValueError(f"Unexpected Modrinth response for {slug}")
    return data


def install_project(project: dict, side_config: dict, minecraft_version: str, target_dir: Path, dry_run: bool) -> dict | None:
    slug = project["slug"]
    accepted_loaders = project.get("acceptedLoaders") or side_config.get("acceptedLoaders") or [side_config["loader"]]
    allow_prerelease = bool(project.get("allowPrerelease"))
    try:
        versions = project_versions(slug)
        matches = compatible_versions(versions, minecraft_version, accepted_loaders, allow_prerelease)
        if not matches:
            required = "required" if project.get("required", True) else "optional"
            log(f"skip {slug}: no compatible {minecraft_version} {accepted_loaders} release found ({required})")
            return None
        version = matches[0]
        file_info = choose_primary_file(version)
        filename = safe_filename(file_info["filename"])
        output_path = target_dir / filename
        expected_sha512 = (file_info.get("hashes") or {}).get("sha512")
        summary = f"{project.get('name', slug)} {version.get('version_number')} -> {filename}"
        if dry_run:
            log(f"[dry-run] {summary}")
        else:
            target_dir.mkdir(parents=True, exist_ok=True)
            if output_path.exists() and expected_sha512 and file_sha512(output_path).lower() == expected_sha512.lower():
                log(f"ok {summary}")
            else:
                log(f"download {summary}")
                download_file(file_info["url"], output_path)
            if expected_sha512:
                actual_sha512 = file_sha512(output_path)
                if actual_sha512.lower() != expected_sha512.lower():
                    output_path.unlink(missing_ok=True)
                    raise ValueError(f"SHA-512 mismatch for {filename}")
        return {
            "slug": slug,
            "name": project.get("name", slug),
            "version": version.get("version_number"),
            "versionId": version.get("id"),
            "projectId": version.get("project_id"),
            "loaders": version.get("loaders", []),
            "gameVersions": version.get("game_versions", []),
            "path": filename,
            "sha512": expected_sha512,
            "downloadUrl": file_info.get("url"),
            "fileSize": file_info.get("size"),
            "source": project.get("source"),
            "downloadedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError) as error:
        if project.get("required", True):
            raise RuntimeError(f"failed to resolve {slug}: {error}") from error
        log(f"skip optional {slug}: {error}")
        return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Install the nfoifsb Modrinth building pack.")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST), help="Path to building-pack.json.")
    parser.add_argument("--side", choices=["server", "client"], default="server", help="Install server plugins or client mods.")
    parser.add_argument("--target", required=True, help="Target plugins/ or mods/ directory.")
    parser.add_argument("--minecraft-version", default=None, help="Minecraft version, default from manifest or MINECRAFT_VERSION.")
    parser.add_argument("--include-optional", action="store_true", help="Also install projects marked required=false.")
    parser.add_argument("--dry-run", action="store_true", help="Resolve and print downloads without writing jars.")
    parser.add_argument("--prune-managed", action="store_true", help="Remove old jars previously installed by this script.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest_path = Path(args.manifest).resolve()
    target_dir = Path(args.target).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    minecraft_version = args.minecraft_version or os.environ.get("MINECRAFT_VERSION") or manifest.get("minecraftVersion")
    if not minecraft_version:
        raise SystemExit("minecraft version is required")
    side_config = manifest[args.side]
    projects = [
        project
        for project in side_config.get("projects", [])
        if project.get("required", True) or args.include_optional
    ]
    log(f"Installing {manifest.get('name', manifest_path.name)}")
    log(f"side={args.side} minecraft={minecraft_version} target={target_dir}")
    previous_lock = read_lock(target_dir)
    current_lock = {
        "pack": manifest.get("name"),
        "side": args.side,
        "minecraftVersion": minecraft_version,
        "loader": side_config.get("loader"),
        "files": {},
    }
    for project in projects:
        entry = install_project(project, side_config, minecraft_version, target_dir, args.dry_run)
        if entry:
            current_lock["files"][entry["slug"]] = entry
    if args.prune_managed:
        prune_managed_files(target_dir, previous_lock, current_lock, args.dry_run)
    if not args.dry_run:
        write_lock(target_dir, current_lock)
    log(f"resolved {len(current_lock['files'])}/{len(projects)} projects")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
