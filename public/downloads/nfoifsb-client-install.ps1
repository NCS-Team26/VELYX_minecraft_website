param(
  [string]$PackUrl = "https://www.velyx.kr/downloads/nfoifsb-building-client-26.1.2.mrpack",
  [string]$MinecraftDir = "$env:APPDATA\.minecraft",
  [string]$MinecraftVersion = "26.1.2",
  [string]$FabricLoaderVersion = "0.19.3"
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
  Write-Host "[VELYX] $Message"
}

function Get-Sha512($Path) {
  return (Get-FileHash -Algorithm SHA512 -LiteralPath $Path).Hash.ToLowerInvariant()
}

$ServerAddress = "velyx.kr"
$VersionId = "fabric-loader-$FabricLoaderVersion-$MinecraftVersion"
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("nfoifsb-client-" + [System.Guid]::NewGuid().ToString("N"))
$PackFile = Join-Path $TempDir "nfoifsb-client.mrpack"
$ExtractDir = Join-Path $TempDir "pack"
$ModsDir = Join-Path $MinecraftDir "mods"
$VersionsDir = Join-Path $MinecraftDir "versions"
$VersionDir = Join-Path $VersionsDir $VersionId
$ProfilesPath = Join-Path $MinecraftDir "launcher_profiles.json"

New-Item -ItemType Directory -Force -Path $TempDir, $ExtractDir, $ModsDir, $VersionDir | Out-Null

try {
  Write-Step "Downloading client pack..."
  if (Test-Path -LiteralPath $PackUrl) {
    Copy-Item -LiteralPath $PackUrl -Destination $PackFile -Force
  } else {
    Invoke-WebRequest -Uri $PackUrl -OutFile $PackFile -UseBasicParsing
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($PackFile, $ExtractDir)
  $IndexPath = Join-Path $ExtractDir "modrinth.index.json"
  $Index = Get-Content -LiteralPath $IndexPath -Raw -Encoding UTF8 | ConvertFrom-Json

  Write-Step "Backing up older VELYX client mods..."
  $BackupDir = Join-Path $ModsDir ("nfoifsb-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  $KnownPatterns = @(
    "fabric-api-*.jar",
    "ForgeConfigAPIPort-*.jar",
    "open-parties-and-claims-*.jar",
    "Axiom-*.jar",
    "constructionwand-*.jar",
    "armor-stand-editor-*.jar",
    "WorldEditCUI-*.jar",
    "malilib-*.jar",
    "litematica-*.jar",
    "minihud-*.jar",
    "tweakeroo-*.jar",
    "freecam-fabric-*.jar",
    "syncmatica-fabric-*.jar",
    "sodium-fabric-*.jar",
    "iris-fabric-*.jar",
    "continuity-*.jar"
  )

  $Existing = @()
  foreach ($Pattern in $KnownPatterns) {
    $Existing += Get-ChildItem -LiteralPath $ModsDir -Filter $Pattern -File -ErrorAction SilentlyContinue
  }
  $Existing = $Existing | Sort-Object FullName -Unique
  if ($Existing.Count -gt 0) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
    foreach ($File in $Existing) {
      Move-Item -LiteralPath $File.FullName -Destination (Join-Path $BackupDir $File.Name) -Force
    }
    Write-Step "Old matching mods moved to $BackupDir"
  }

  Write-Step "Installing mods..."
  foreach ($File in $Index.files) {
    $RelativePath = [string]$File.path
    $TargetPath = Join-Path $MinecraftDir ($RelativePath -replace "/", "\")
    $TargetParent = Split-Path -Parent $TargetPath
    New-Item -ItemType Directory -Force -Path $TargetParent | Out-Null

    $DownloadUrl = [string]$File.downloads[0]
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TargetPath -UseBasicParsing

    $ExpectedHash = [string]$File.hashes.sha512
    if ($ExpectedHash -and ((Get-Sha512 $TargetPath) -ne $ExpectedHash.ToLowerInvariant())) {
      throw "SHA-512 mismatch for $RelativePath"
    }
  }

  Write-Step "Installing Fabric Loader profile..."
  $FabricProfileUrl = "https://meta.fabricmc.net/v2/versions/loader/$MinecraftVersion/$FabricLoaderVersion/profile/json"
  $VersionJsonPath = Join-Path $VersionDir "$VersionId.json"
  Invoke-WebRequest -Uri $FabricProfileUrl -OutFile $VersionJsonPath -UseBasicParsing

  if (Test-Path -LiteralPath $ProfilesPath) {
    Copy-Item -LiteralPath $ProfilesPath -Destination "$ProfilesPath.bak-nfoifsb-$(Get-Date -Format "yyyyMMdd-HHmmss")" -Force
    $LauncherProfiles = Get-Content -LiteralPath $ProfilesPath -Raw -Encoding UTF8 | ConvertFrom-Json
  } else {
    $LauncherProfiles = [pscustomobject]@{
      profiles = [pscustomobject]@{}
      selectedProfile = ""
    }
  }

  if (-not ($LauncherProfiles.PSObject.Properties.Name -contains "profiles")) {
    $LauncherProfiles | Add-Member -MemberType NoteProperty -Name "profiles" -Value ([pscustomobject]@{})
  }

  $ProfileId = "nfoifsb-fabric-26.1.2"
  $Now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  $Profile = [ordered]@{
    created = $Now
    icon = "Crafting_Table"
    javaArgs = "-Xmx4G"
    lastUsed = $Now
    lastVersionId = $VersionId
    name = "VELYX Fabric 26.1.2"
    type = "custom"
  }

  if ($LauncherProfiles.profiles.PSObject.Properties.Name -contains $ProfileId) {
    $LauncherProfiles.profiles.$ProfileId = $Profile
  } else {
    $LauncherProfiles.profiles | Add-Member -MemberType NoteProperty -Name $ProfileId -Value $Profile
  }

  if ($LauncherProfiles.PSObject.Properties.Name -contains "selectedProfile") {
    $LauncherProfiles.selectedProfile = $ProfileId
  } else {
    $LauncherProfiles | Add-Member -MemberType NoteProperty -Name "selectedProfile" -Value $ProfileId
  }

  $LauncherProfiles | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $ProfilesPath -Encoding UTF8

  Write-Step "Done."
  Write-Host ""
  Write-Host "1. Close Minecraft Launcher completely."
  Write-Host "2. Open it again."
  Write-Host "3. Select profile: VELYX Fabric 26.1.2"
  Write-Host "4. Multiplayer server address: $ServerAddress"
  Write-Host ""
  Write-Host "Installed mods: $($Index.files.Count)"
} finally {
  if (Test-Path -LiteralPath $TempDir) {
    Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
