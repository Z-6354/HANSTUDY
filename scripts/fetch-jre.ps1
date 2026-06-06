# Downloads Eclipse Temurin JRE 11 (Windows x64) into resources/jre-win for electron-builder.
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Dest = Join-Path $Root 'resources\jre-win'
$JavaExe = Join-Path $Dest 'bin\java.exe'

if (Test-Path $JavaExe) {
  Write-Host "[fetch-jre] JRE already present at $Dest"
  exit 0
}

$ApiUrl = 'https://api.adoptium.net/v3/binary/latest/11/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk'
$ZipPath = Join-Path $env:TEMP 'hanstudy-temurin-jre.zip'
$ExtractRoot = Join-Path $env:TEMP 'hanstudy-jre-extract'

Write-Host '[fetch-jre] Step 1/3: Downloading Temurin JRE 11 (~40 MB, may take several minutes)...'
Write-Host '[fetch-jre] Tip: no progress bar here; file size in TEMP will grow until download finishes.'

$ProgressPreference = 'SilentlyContinue'
try {
  Invoke-WebRequest -Uri $ApiUrl -OutFile $ZipPath -UseBasicParsing -TimeoutSec 600
} catch {
  throw "Download failed: $($_.Exception.Message). Check network or retry later."
}

$sizeMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
Write-Host "[fetch-jre] Step 2/3: Downloaded $sizeMb MB, extracting..."

if (Test-Path $ExtractRoot) {
  Remove-Item -Recurse -Force $ExtractRoot
}
New-Item -ItemType Directory -Path $ExtractRoot -Force | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $ExtractRoot -Force

$Inner = Get-ChildItem -Path $ExtractRoot -Directory | Select-Object -First 1
if (-not $Inner) {
  throw 'JRE archive did not contain a root directory'
}

Write-Host '[fetch-jre] Step 3/3: Installing to resources/jre-win ...'

if (Test-Path $Dest) {
  Remove-Item -Recurse -Force $Dest
}
New-Item -ItemType Directory -Path (Split-Path $Dest) -Force | Out-Null
Move-Item -Path $Inner.FullName -Destination $Dest

Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue
Remove-Item $ExtractRoot -Recurse -Force -ErrorAction SilentlyContinue

if (-not (Test-Path $JavaExe)) {
  throw "Expected java.exe at $JavaExe after extraction"
}

Write-Host "[fetch-jre] Done: $JavaExe"
