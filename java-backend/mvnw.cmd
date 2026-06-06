@REM Bootstrap portable Maven and run mvn commands
@echo off
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
set "TOOLS=%ROOT%.tools\apache-maven-3.9.6"
set "MVN=%TOOLS%\bin\mvn.cmd"
set "ZIP=%ROOT%.tools\apache-maven-3.9.6-bin.zip"
set "URL=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.6/apache-maven-3.9.6-bin.zip"

if not exist "%MVN%" (
  echo [mvn] Downloading Apache Maven 3.9.6...
  if not exist "%ROOT%.tools" mkdir "%ROOT%.tools"
  powershell -NoProfile -Command "Invoke-WebRequest -Uri '%URL%' -OutFile '%ZIP%'"
  if errorlevel 1 exit /b 1
  powershell -NoProfile -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%ROOT%.tools' -Force"
  if errorlevel 1 exit /b 1
)

cd /d "%ROOT%"
call "%MVN%" %*
