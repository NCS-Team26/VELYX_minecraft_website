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

- WorldEdit: stable editing, brushes, copy/paste, and large selections.
- WorldGuard: region protection and build rules.
- Axiom Paper Plugin: server-side support for Axiom builders.
- LitematicaFolia: server-side `.litematic` paste/import support.
- Syncmatica Paper: shared schematic sync for team builds.
- BuildersUtilities: builder convenience commands and tools.
- BuildersWand: faster repeated block placement.
- WorldEditDisplay: visual WorldEdit selection display.
- PacketEvents: packet library required by WorldEditDisplay.
- Take It Out: shulker picking and easy-place style logistics.
- BlueMap: high-quality 3D browser map.
- Chunky: chunk pregeneration for smoother build areas.
- ImageFrame: images and GIFs on maps/item frames.
- EasyArmorStands: armor stand and display entity editing.
- InventoryRollbackPlus: player inventory recovery.
- LuckPerms: builder/admin permission groups.

Optional server entries in the manifest:

- WorldEditSelectionVisualizer
- SchemImporter
- Safe Zone Claims
- Pl3xMap

## Client pack for builders

Download from the website:

```text
/downloads/nfoifsb-building-client-26.1.2.mrpack
```

Import the `.mrpack` into Modrinth App or Prism Launcher. It uses Minecraft `26.1.2` and Fabric Loader `0.19.3`.

Build the downloadable `.mrpack` locally:

```powershell
npm run modpack:client:mrpack
```

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
- WorldEdit is used instead of FastAsyncWorldEdit on Paper 26.1.2 because FAWE 2.15.2 logs mapping exceptions on the live Raspberry Pi server.
- CoreProtect is intentionally not installed because the latest Modrinth metadata checked for this pack did not advertise `26.1.2`.
- StellarProtect is intentionally not installed because version 1.9.3 disables itself on the live Paper `26.1.2.build.72` server. The server already has `prism` for block logging and rollback.
- Minecraft 26.1.x servers usually require the matching modern Java runtime. Check the Paper startup log before installing plugins on the Raspberry Pi.
