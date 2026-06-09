# 打包前校验 JAR 与 JRE 是否就绪
$ErrorActionPreference = 'Stop'

try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }

if ($env:HANSTUDY_BUILD_ROOT) {
  $Root = $env:HANSTUDY_BUILD_ROOT
} else {
  $Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
}
$Jar = Join-Path $Root 'java-backend\target\hanstudy-backend.jar'
$Java = Join-Path $Root 'resources\jre-win\bin\java.exe'

$missing = @()
if (-not (Test-Path $Jar)) {
  $missing += "Java 后端 JAR: $Jar （请先运行 npm run build:java）"
}
if (-not (Test-Path $Java)) {
  $missing += "捆绑 JRE: $Java （请先运行 npm run prepare:jre）"
}

if ($missing.Count -gt 0) {
  Write-Host '[校验资源] 缺少必需文件:' -ForegroundColor Red
  foreach ($item in $missing) {
    Write-Host "  - $item"
  }
  exit 1
}

Write-Host '[校验资源] 通过，JAR 与 JRE 已就绪'
