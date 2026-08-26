@echo off
title Hypergraph Converter Studio - Build
cd /d "%~dp0"
echo Installing dependencies and building production app...
echo.
call npm install
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
pause
exit /b 0

:error
echo.
echo The production build failed.
pause
exit /b 1
