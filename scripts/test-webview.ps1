# WebView self-check (no GUI): typecheck, build, main-process fetch
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\ensure-utf8.ps1"

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "== 1/4 TypeScript ==" -ForegroundColor Cyan
npm run typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== 2/4 Build ==" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "(Java/Maven WARNING lines above are normal, not failures)" -ForegroundColor DarkGray

Write-Host "== 3/4 Main-process fetch probe ==" -ForegroundColor Cyan
node --input-type=module -e @"
const urls = ['https://example.com/', 'https://www.baidu.com/'];
for (const url of urls) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    console.log('OK', url, res.status, Date.now() - t0 + 'ms');
  } catch (e) {
    console.log('FAIL', url, e.message, Date.now() - t0 + 'ms');
    process.exitCode = 1;
  }
}
"@
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== 4/4 Manual in-app tests (open app after npm run dev) ==" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Open a web tab, expand 'Web diagnostics' at the bottom"
Write-Host "  2. Click 'test: inline' -> green success page (no network)"
Write-Host "  3. Click 'test: example' -> HTTPS external site"
Write-Host "  4. Click main-process probe -> compare Node fetch vs webview"
Write-Host "  5. Click WebView DevTools -> guest console"
Write-Host ""
Write-Host "  inline fails     -> webview size/mount (check 0x0 in diagnostics)"
Write-Host "  inline OK, web fails -> Electron webview config"
Write-Host "  main probe OK, webview fails -> same as above"
Write-Host ""
Write-Host "ALL AUTOMATED CHECKS PASSED (exit 0)" -ForegroundColor Green
