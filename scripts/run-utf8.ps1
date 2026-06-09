param(
  [Parameter(Mandatory = $true)]
  [string]$ScriptPath
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'ensure-utf8.ps1')

$resolved = (Resolve-Path -LiteralPath $ScriptPath).Path
$buildRoot = Split-Path -Parent $PSScriptRoot
Set-Location $buildRoot
$env:HANSTUDY_BUILD_ROOT = $buildRoot

$source = Get-Content -LiteralPath $resolved -Raw -Encoding UTF8
$block = [ScriptBlock]::Create($source)
& $block

if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
