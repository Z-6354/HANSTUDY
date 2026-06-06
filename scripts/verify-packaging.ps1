# Fail fast if packaging assets are missing before electron-builder runs.
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Jar = Join-Path $Root 'java-backend\target\hanstudy-backend.jar'
$Java = Join-Path $Root 'resources\jre-win\bin\java.exe'

$missing = @()
if (-not (Test-Path $Jar)) {
  $missing += "Java JAR: $Jar (run npm run build:java)"
}
if (-not (Test-Path $Java)) {
  $missing += "Bundled JRE: $Java (run npm run prepare:jre)"
}

if ($missing.Count -gt 0) {
  Write-Host '[verify-packaging] Missing required assets:' -ForegroundColor Red
  foreach ($item in $missing) {
    Write-Host "  - $item"
  }
  exit 1
}

Write-Host '[verify-packaging] OK — JAR and JRE present'
