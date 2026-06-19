$ErrorActionPreference = 'Stop'

$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$releaseDir = Join-Path $workspace 'release'

if (-not (Test-Path -LiteralPath $releaseDir)) {
    throw "Release folder not found: $releaseDir"
}

$packageJson = Get-Content (Join-Path $workspace 'package.json') -Raw | ConvertFrom-Json
$zipName = "VAT-validator-$($packageJson.version)-win-x64.zip"
$zipPath = Join-Path $releaseDir $zipName

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

$items = Get-ChildItem -LiteralPath $releaseDir -Force | Where-Object { $_.Name -ne $zipName }
if (-not $items) {
    throw "Release folder is empty: $releaseDir"
}

Compress-Archive -Path ($items | ForEach-Object { $_.FullName }) -DestinationPath $zipPath -CompressionLevel Optimal
Write-Host "Created $zipPath"
