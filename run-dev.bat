@echo off
title Hypergraph Converter Studio - Dev Server
cd /d "%~dp0"
node scripts\launcher-preflight.mjs find-frontend-port 5173 1 >nul
if errorlevel 1 goto :error
echo Frontend origin: http://127.0.0.1:5173. No saved data is relocated across origins.
echo Starting Hypergraph Converter Studio in development mode...
echo.
call npm install
if errorlevel 1 goto :error
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
if errorlevel 1 goto :error
pause
exit /b 0

:error
echo.
echo The development server could not be started.
pause
exit /b 1
