@echo off
setlocal
title Hypergraph Converter Studio - Local Runtime Bridge
cd /d "%~dp0"

echo Starting Hypergraph local runtime bridge...
echo.
echo Default bridge URL: http://127.0.0.1:8787
echo Ollama bridge URL: http://127.0.0.1:8787/ollama
echo.
echo Edit local-runtime-bridge.js or set HYPERGRAPH_BRIDGE_ORIGINS to allow another GitHub Pages origin.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js, then run this script again.
  pause
  exit /b 1
)

node local-runtime-bridge.js
pause
endlocal
