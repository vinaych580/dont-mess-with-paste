param(
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $projectRoot "manifest.json"

if (-not (Test-Path $manifestPath)) {
  throw "manifest.json not found at $manifestPath"
}

$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
$version = $manifest.version
if (-not $version) {
  throw "manifest.json is missing a version"
}

$targets = @(
  @{ Name = "chrome"; StripGecko = $true },
  @{ Name = "firefox"; StripGecko = $false }
)

$filesToCopy = @(
  "background.js",
  "content.js",
  "popup.html",
  "popup.js",
  "options.html",
  "options.js",
  "icons"
)

$distPath = Join-Path $projectRoot $OutputDir
New-Item -ItemType Directory -Force -Path $distPath | Out-Null

foreach ($target in $targets) {
  $staging = Join-Path $distPath "staging-$($target.Name)"
  if (Test-Path $staging) {
    Remove-Item -Recurse -Force $staging
  }
  New-Item -ItemType Directory -Force -Path $staging | Out-Null

  $targetManifest = $manifest | ConvertTo-Json -Depth 100 | ConvertFrom-Json
  if ($target.StripGecko) {
    $targetManifest.PSObject.Properties.Remove("browser_specific_settings")
  } else {
    # Firefox MV3 background script handling
    if ($targetManifest.background -and $targetManifest.background.service_worker) {
      $workerScript = $targetManifest.background.service_worker
      $targetManifest.background.PSObject.Properties.Remove("service_worker")
      $targetManifest.background.PSObject.Properties.Remove("type")
      $targetManifest.background | Add-Member -NotePropertyName "scripts" -NotePropertyValue @($workerScript)
    }
  }

  $targetManifestPath = Join-Path $staging "manifest.json"
  $targetManifest | ConvertTo-Json -Depth 100 | Set-Content -Path $targetManifestPath -NoNewline

  foreach ($entry in $filesToCopy) {
    $source = Join-Path $projectRoot $entry
    if (-not (Test-Path $source)) {
      throw "Required entry missing: $entry"
    }

    $destination = Join-Path $staging $entry
    Copy-Item -Recurse -Force $source $destination
  }

  # Ensure the destination directory exists
  $zipName = "dont-mess-with-paste-$($target.Name)-$version.zip"
  $zipPath = Join-Path $distPath $zipName
  if (Test-Path $zipPath) {
    Remove-Item -Force $zipPath
  }

  # Create ZIP with forward-slash paths for Firefox compatibility
  Add-Type -AssemblyName "System.IO.Compression"
  Add-Type -AssemblyName "System.IO.Compression.FileSystem"
  $zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
  $zipArchive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
  try {
    Get-ChildItem -Path $staging -Recurse -File | ForEach-Object {
      $relativePath = $_.FullName.Substring($staging.Length).TrimStart('\', '/')
      $entryPath = $relativePath -replace "\\", "/"
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $_.FullName, $entryPath) | Out-Null
    }
  } finally {
    $zipArchive.Dispose()
    $zipStream.Dispose()
  }

  Remove-Item -Recurse -Force $staging

  Write-Host "Built $zipPath"
}
