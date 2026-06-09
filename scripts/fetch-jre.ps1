# 下载 Eclipse Temurin JRE 11 (Windows x64) 到 resources/jre-win
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
$Dest = Join-Path $Root 'resources\jre-win'
$JavaExe = Join-Path $Dest 'bin\java.exe'

if (Test-Path $JavaExe) {
  Write-Host "[准备 JRE] 已存在，跳过下载: $Dest"
  exit 0
}

$ApiUrl = 'https://api.adoptium.net/v3/binary/latest/11/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk'
$ZipPath = Join-Path $env:TEMP 'hanstudy-temurin-jre.zip'
$ExtractRoot = Join-Path $env:TEMP 'hanstudy-jre-extract'

Write-Host '[准备 JRE] 步骤 1/3: 正在下载 Temurin JRE 11（约 40 MB，可能需要数分钟）...'
Write-Host '[准备 JRE] 提示: 此处无进度条，可观察 TEMP 目录中 zip 文件大小变化。'

$ProgressPreference = 'SilentlyContinue'
try {
  Invoke-WebRequest -Uri $ApiUrl -OutFile $ZipPath -UseBasicParsing -TimeoutSec 600
} catch {
  throw "下载失败: $($_.Exception.Message)。请检查网络后重试。"
}

$sizeMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
Write-Host "[准备 JRE] 步骤 2/3: 已下载 $sizeMb MB，正在解压..."

if (Test-Path $ExtractRoot) {
  Remove-Item -Recurse -Force $ExtractRoot
}
New-Item -ItemType Directory -Path $ExtractRoot -Force | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $ExtractRoot -Force

$Inner = Get-ChildItem -Path $ExtractRoot -Directory | Select-Object -First 1
if (-not $Inner) {
  throw 'JRE 压缩包内未找到根目录'
}

Write-Host '[准备 JRE] 步骤 3/3: 安装到 resources/jre-win ...'

if (Test-Path $Dest) {
  Remove-Item -Recurse -Force $Dest
}
New-Item -ItemType Directory -Path (Split-Path $Dest) -Force | Out-Null
Move-Item -Path $Inner.FullName -Destination $Dest

Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue
Remove-Item $ExtractRoot -Recurse -Force -ErrorAction SilentlyContinue

if (-not (Test-Path $JavaExe)) {
  throw "解压后未找到 java.exe: $JavaExe"
}

Write-Host "[准备 JRE] 完成: $JavaExe"
