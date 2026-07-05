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

## Fabric modpack server

This is the full modded-server path. It creates a Fabric server instead of a Paper plugin server.

Included Fabric server mods:

- Fabric API
- WorldEdit
- BlueMap
- Chunky
- LuckPerms
- Essential Commands
- Multiworld
- Command Aliases
- adventure-platform-fabric
- Mods Command
- spark
- Lithium
- FerriteCore
- Krypton
- ServerCore
- Servux
- Syncmatica
- Carpet

Build/download the server mods locally:

```powershell
npm run modpack:fabric-server
```

Prepare a Fabric server folder on Linux:

```bash
FABRIC_SERVER_DIR=/home/ad1969/minecraft-fabric MINECRAFT_VERSION=26.1.2 ./scripts/minecraft/setup-fabric-server.sh
```

Live Raspberry Pi layout after the Fabric conversion:

- Fabric server directory: `/home/ad1969/minecraft-fabric`
- Fabric systemd service: `minecraft-fabric.service`
- Paper backup directory: `/home/ad1969/minecraft`
- Paper systemd service: `minecraft.service` is disabled
- Fabric listens on Minecraft port `25565`
- BlueMap listens on web port `8100`
- Fabric compatibility API service: `nfoifsb-minecraft-api-bridge.service`
- Website and Discord stock integrations read `/minecraft/stocks/market` through the API bridge on `127.0.0.1:8787`.

Fabric command compatibility:

- `/plugins` redirects to `/mods`.
- `/sethome`, `/delhome`, and `/homes` redirect to Essential Commands home subcommands.
- `/setwarp`, `/delwarp`, and `/warps` redirect to Essential Commands warp subcommands.
- `/world ...` and `/mv ...` redirect to Multiworld `/mw ...`.
- The live alias files are stored in `/home/ad1969/minecraft-fabric/config/commandaliases/nfoifsb`.
- Repo copies live under `infra/minecraft/commandaliases/nfoifsb`; copy them into the server config folder and run `/commandaliases reload` after rebuilding the server.

The old Paper world import was not used for the live Fabric boot because Fabric could not read the Paper world generation settings. The original Paper world is still preserved in `/home/ad1969/minecraft/world`; the failed import copy is backed up under `/home/ad1969/minecraft-fabric/backups/`.

Live Paper world data has now been bridged into the Fabric server without replacing Fabric's `world_gen_settings.dat`. The Fabric server loads these dimensions:

- `minecraft:overworld`
- `minecraft:the_nether`
- `minecraft:the_end`
- `minecraft:lobby`
- `minecraft:shop`
- `minecraft:wild`
- `minecraft:spawn`
- `minecraft:spawn_lobby`

The live Fabric world also loads these world datapacks:

- `file/bukkit`
- `file/icn_1to1_datapack_26.zip`
- `file/nfoifsb_worlds`

To repeat that bridge on the Raspberry Pi:

```bash
PAPER_SERVER_DIR=/home/ad1969/minecraft FABRIC_SERVER_DIR=/home/ad1969/minecraft-fabric ./scripts/minecraft/sync-paper-worlds-to-fabric.sh
```

The Fabric API bridge restores the public read-only web API that the site and Discord notifier use after the Paper AuroraLink plugin is no longer loaded:

```bash
./scripts/minecraft/install-api-bridge.sh
curl http://127.0.0.1:8787/minecraft/stocks/market
curl http://127.0.0.1:8787/minecraft/server/overview
```

It exposes stock market candles, stock volume history, and server overview data. Player verification, inventory, broadcasts, and buy/sell orders still require a Fabric gameplay bridge because those operations need trusted in-game economy and player-token access.

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
