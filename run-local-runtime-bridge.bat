@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Hypergraph Converter Studio - Local Runtime Bridge
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install a supported Node.js release, reopen this terminal, and run this script again.
  pause
  exit /b 1
)

if not defined HYPERGRAPH_BRIDGE_PORT set "HYPERGRAPH_BRIDGE_PORT=8787"
set "BRIDGE_HEALTH_URL=http://127.0.0.1:%HYPERGRAPH_BRIDGE_PORT%/health"
if not defined HYPERGRAPH_BRIDGE_ORIGINS (
  if defined HYPERGRAPH_FRONTEND_ORIGIN (
    set "HYPERGRAPH_BRIDGE_ORIGINS=%HYPERGRAPH_FRONTEND_ORIGIN%"
  ) else if defined FRONTEND_PORT (
    set "HYPERGRAPH_BRIDGE_ORIGINS=http://127.0.0.1:%FRONTEND_PORT%,http://localhost:%FRONTEND_PORT%"
  ) else (
    echo No exact frontend origin was supplied.
    echo Set HYPERGRAPH_BRIDGE_ORIGINS to a comma-separated list of exact origins, for example http://127.0.0.1:5173.
    pause
    exit /b 1
  )
)

set "BRIDGE_STATUS=invalid"
for /f "delims=" %%S in ('node scripts\launcher-preflight.mjs bridge-status "%BRIDGE_HEALTH_URL%"') do set "BRIDGE_STATUS=%%S"
if "!BRIDGE_STATUS!"=="ready" (
  echo The verified Hypergraph bridge is already running at %BRIDGE_HEALTH_URL%.
  exit /b 0
)
if "!BRIDGE_STATUS!"=="occupied" (
  echo Bridge port %HYPERGRAPH_BRIDGE_PORT% is occupied by a service that is not the Hypergraph Ollama bridge.
  echo Stop that service or set HYPERGRAPH_BRIDGE_PORT to a free loopback port.
  pause
  exit /b 1
)
if "!BRIDGE_STATUS!"=="invalid" (
  echo The bridge health URL is invalid: %BRIDGE_HEALTH_URL%
  pause
  exit /b 1
)

echo Starting Hypergraph local runtime bridge at http://127.0.0.1:%HYPERGRAPH_BRIDGE_PORT%
echo Allowed frontend origins: %HYPERGRAPH_BRIDGE_ORIGINS%
echo Ollama bridge URL: http://127.0.0.1:%HYPERGRAPH_BRIDGE_PORT%/ollama
echo.
node local-runtime-bridge.js
pause
endlocal
