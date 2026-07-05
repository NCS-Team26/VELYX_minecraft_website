param(
  [string]$Target = "$env:APPDATA\.minecraft\mods",
  [string]$MinecraftVersion = $(if ($env:MINECRAFT_VERSION) { $env:MINECRAFT_VERSION } else { "26.1.2" }),
  [switch]$IncludeOptional
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Resolve-Path (Join-Path $ScriptDir "..\..")
$Manifest = Join-Path $RootDir "infra\minecraft\building-pack.json"
$Installer = Join-Path $RootDir "scripts\minecraft\install-modrinth-pack.py"

$ArgsList = @(
  $Installer,
  "--manifest", $Manifest,
  "--side", "client",
  "--target", $Target,
  "--minecraft-version", $MinecraftVersion,
  "--prune-managed"
)

if ($IncludeOptional) {
  $ArgsList += "--include-optional"
}

python @ArgsList
