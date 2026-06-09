# 寒的学习助手 - Windows 安装包构建（控制台）
#Requires -Version 5.1
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
Set-Location $Root

function Ensure-NodePath {
  $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($nodeCmd) {
    $dir = Split-Path $nodeCmd.Source
    if ($env:PATH -notlike "*$dir*") { $env:PATH = "$dir;$env:PATH" }
    return
  }
  foreach ($dir in @(
      "$env:ProgramFiles\nodejs",
      "$env:LocalAppData\Programs\nodejs",
      'D:\nodejs'
    )) {
    if (Test-Path (Join-Path $dir 'node.exe')) {
      $env:PATH = "$dir;$env:PATH"
      return
    }
  }
  throw '未找到 Node.js，请先安装 Node.js 并加入 PATH。'
}

function Run-Step([string]$Label, [scriptblock]$Action) {
  Write-Host ''
  Write-Host ">> $Label" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) { throw "$Label 失败（退出码 $LASTEXITCODE）" }
  Write-Host "[完成] $Label" -ForegroundColor Green
}

Ensure-NodePath
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'

Write-Host '========================================' -ForegroundColor DarkGray
Write-Host '  寒的学习助手 - Windows 安装包构建' -ForegroundColor White
Write-Host '========================================' -ForegroundColor DarkGray
Write-Host "项目目录: $Root"
Write-Host "输出目录: $Root\release\"
$envFile = Join-Path $Root '.env'
if (Test-Path $envFile) {
  Write-Host "已发现 .env（MAIN_VITE_FEEDBACK_API_URL 等将在编译时打入安装包）" -ForegroundColor DarkGray
} else {
  Write-Host "提示: 复制 .env.example 为 .env 可指定反馈 API 地址并打入安装包" -ForegroundColor Yellow
}
Write-Host ''

Run-Step '准备 JRE' { npm.cmd run prepare:jre }
Run-Step '校验打包资源' { npm.cmd run verify:packaging }
Run-Step '编译应用' { npm.cmd run build }

Write-Host ''
Write-Host '>> 生成安装包（以下为 electron-builder 输出）' -ForegroundColor Cyan
npx.cmd electron-builder --win
if ($LASTEXITCODE -ne 0) { throw "生成安装包 失败（退出码 $LASTEXITCODE）" }
Write-Host '[完成] 生成安装包' -ForegroundColor Green

$release = Join-Path $Root 'release'
$installer = Get-ChildItem $release -Filter '*Setup*.exe' -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

Write-Host ''
Write-Host '========================================' -ForegroundColor DarkGray
if ($installer) {
  Write-Host "安装包: $($installer.FullName)" -ForegroundColor Green
  Write-Host "大小: $([math]::Round($installer.Length / 1MB, 1)) MB"
} else {
  Write-Host "构建结束，请检查目录: $release" -ForegroundColor Yellow
}
Write-Host '全部完成。' -ForegroundColor Green
