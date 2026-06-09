@echo off
setlocal EnableExtensions
REM Save as UTF-8 with BOM for Chinese echo text
cd /d "%~dp0"
chcp 65001 >nul 2>&1

call :EnsureNode
if errorlevel 1 (
  echo.
  echo [失败] 未找到 Node.js，请先安装并加入 PATH。
  echo.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   寒的学习助手 - Windows 安装包构建
echo ========================================
echo.

set "RUNNER=%~dp0scripts\run-utf8.ps1"
set "BUILD=%~dp0scripts\dist-win.ps1"

where pwsh >nul 2>&1
if not errorlevel 1 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%RUNNER%" -ScriptPath "%BUILD%"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%RUNNER%" -ScriptPath "%BUILD%"
)
set "RC=%ERRORLEVEL%"

echo.
if not "%RC%"=="0" (
  echo [失败] 打包未完成，请查看上方日志。
) else (
  echo [成功] 安装包位于 release\ 目录。
)
echo.
pause
exit /b %RC%

:EnsureNode
where node >nul 2>&1 && exit /b 0
if exist "%ProgramFiles%\nodejs\node.exe" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  exit /b 0
)
if exist "%LocalAppData%\Programs\nodejs\node.exe" (
  set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
  exit /b 0
)
if exist "D:\nodejs\node.exe" (
  set "PATH=D:\nodejs;%PATH%"
  exit /b 0
)
exit /b 1
