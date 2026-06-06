# Dot-source at top of .ps1 scripts: . "$PSScriptRoot\ensure-utf8.ps1"
# Fixes garbled Chinese (mojibake) in Windows PowerShell 5.x console output.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSVersionTable.PSVersion.Major -lt 7) {
  chcp 65001 | Out-Null
}
