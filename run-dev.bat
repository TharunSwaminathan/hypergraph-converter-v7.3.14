@echo off
title Hypergraph Converter Studio - Dev Server
cd /d "%~dp0"
echo Starting Hypergraph Converter Studio in development mode...
echo.
call npm install
if errorlevel 1 goto :error
call npm run dev -- --host 0.0.0.0
if errorlevel 1 goto :error
pause
exit /b 0

:error
echo.
echo The development server could not be started.
pause
exit /b 1
