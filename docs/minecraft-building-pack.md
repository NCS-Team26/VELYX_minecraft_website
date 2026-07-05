# Minecraft 26.1.2 Building Pack

This repo includes an installable building pack for the Paper server and an optional Fabric client pack for builders.

## Server install on the Raspberry Pi

Run this from the repository root on the Raspberry Pi:

```bash
MINECRAFT_VERSION=26.1.2 ./scripts/minecraft/install-paper-building-pack.sh /path/to/server/plugins
```

Then restart the Paper server. The installer writes `.modrinth-pack-lock.json` into the target folder so later runs can update the same managed jars and prune old managed filenames.

Dry run:

```bash
python3 scripts/minecraft/install-modrinth-pack.py --side server --target /path/to/server/plugins --minecraft-version 26.1.2 --dry-run
```

Include optional plugins:

```bash
python3 scripts/minecraft/install-modrinth-pack.py --side server --target /path/to/server/plugins --minecraft-version 26.1.2 --include-optional --prune-managed
```

## Server plugins

- FastAsyncWorldEdit: high-speed WorldEdit-compatible editing, brushes, copy/paste, and large selections.
- WorldGuard: region protection and build rules.
- Axiom Paper Plugin: server-side support for Axiom builders.
- LitematicaFolia: server-side `.litematic` paste/import support.
- Syncmatica Paper: shared schematic sync for team builds.
- BuildersUtilities: builder convenience commands and tools.
- BuildersWand: faster repeated block placement.
- WorldEditDisplay: visual WorldEdit selection display.
- Take It Out: shulker picking and easy-place style logistics.
- BlueMap: high-quality 3D browser map.
- Chunky: chunk pregeneration for smoother build areas.
- ImageFrame: images and GIFs on maps/item frames.
- EasyArmorStands: armor stand and display entity editing.
- StellarProtect: CoreProtect-style logging and rollback for 26.1.2.
- InventoryRollbackPlus: player inventory recovery.
- LuckPerms: builder/admin permission groups.

Optional server entries in the manifest:

- WorldEditSelectionVisualizer
- SchemImporter
- Safe Zone Claims
- Pl3xMap

## Client pack for builders

Windows client install:

```powershell
.\scripts\minecraft\install-client-building-pack.ps1
```

Custom target:

```powershell
.\scripts\minecraft\install-client-building-pack.ps1 -Target "C:\Users\you\AppData\Roaming\.minecraft\mods"
```

Client mods included:

- Fabric API
- Axiom
- WorldEdit CUI
- MaLiLib
- Litematica
- MiniHUD
- Tweakeroo
- Freecam
- Sodium
- Iris Shaders
- Continuity

## Notes

- The server pack is for Paper/Purpur/Folia-style plugin folders, not a Forge or NeoForge server.
- FastAsyncWorldEdit is used instead of the regular WorldEdit jar to avoid duplicate WorldEdit implementations.
- CoreProtect is intentionally not installed because the latest Modrinth metadata checked for this pack did not advertise `26.1.2`; StellarProtect fills the rollback/logging role for now.
- Minecraft 26.1.x servers usually require the matching modern Java runtime. Check the Paper startup log before installing plugins on the Raspberry Pi.
