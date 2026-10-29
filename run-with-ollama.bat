@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Hypergraph Converter Studio - Ollama Quick Start
cd /d "%~dp0"

if not defined MODEL_NAME set "MODEL_NAME=qwen3:8b"
if not defined HYPERGRAPH_BRIDGE_PORT set "HYPERGRAPH_BRIDGE_PORT=8787"
set "VITE_HYPERGRAPH_BRIDGE_PORT=%HYPERGRAPH_BRIDGE_PORT%"
set "BRIDGE_HEALTH_URL=http://127.0.0.1:%HYPERGRAPH_BRIDGE_PORT%/health"
set "BRIDGE_OLLAMA_URL=http://127.0.0.1:%HYPERGRAPH_BRIDGE_PORT%/ollama"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install a supported Node.js release and reopen this terminal.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Repair or reinstall Node.js so npm is available, then reopen this terminal.
  pause
  exit /b 1
)
where ollama >nul 2>nul
if errorlevel 1 (
  echo Ollama was not found. Install Ollama, reopen this terminal, then run setup-ollama-model.bat.
  echo See MODEL_SETUP.md for details.
  pause
  exit /b 1
)

if defined FRONTEND_PORT (
  set "REQUESTED_FRONTEND_PORT=!FRONTEND_PORT!"
  set "FRONTEND_PORT="
  for /f "delims=" %%P in ('node scripts\launcher-preflight.mjs find-frontend-port !REQUESTED_FRONTEND_PORT! 1') do set "FRONTEND_PORT=%%P"
  if not defined FRONTEND_PORT (
    echo Frontend port !REQUESTED_FRONTEND_PORT! is unavailable. No other listener was terminated.
    pause
    exit /b 1
  )
) else (
  for /f "delims=" %%P in ('node scripts\launcher-preflight.mjs find-frontend-port 5173 1') do set "FRONTEND_PORT=%%P"
  if not defined FRONTEND_PORT (
    echo Canonical frontend port 5173 is occupied. No silent fallback to 5174. Close the conflict yourself or explicitly choose FRONTEND_PORT.
    pause
    exit /b 1
  )
)
set "FRONTEND_HOST=127.0.0.1"
set "DASHBOARD_URL=http://%FRONTEND_HOST%:%FRONTEND_PORT%"
echo Frontend origin: %DASHBOARD_URL%
if not "%FRONTEND_PORT%"=="5173" echo WARNING: Noncanonical origin. Browser persistence is separate; no saved data is relocated. Cross-origin export/import is deferred beyond Scope 7A.
set "HYPERGRAPH_FRONTEND_ORIGIN=%DASHBOARD_URL%"
set "HYPERGRAPH_BRIDGE_ORIGINS=http://127.0.0.1:%FRONTEND_PORT%,http://localhost:%FRONTEND_PORT%"

echo Verifying the Ollama server...
ollama list >nul 2>nul
if errorlevel 1 (
  echo Ollama is not responding. Starting ollama serve in a minimized window...
  start "Ollama Server" /min ollama serve
  for /L %%I in (1,1,10) do (
    ping 127.0.0.1 -n 2 >nul
    ollama list >nul 2>nul
    if not errorlevel 1 goto OllamaReady
  )
  echo Could not start or reach Ollama at http://127.0.0.1:11434.
  echo Start Ollama manually, confirm that "ollama list" succeeds, and try again.
  pause
  exit /b 1
)
:OllamaReady
echo Ollama is responding.

ollama show "%MODEL_NAME%" >nul 2>nul
if errorlevel 1 (
  echo The model %MODEL_NAME% is not installed.
  set "PULL_MODEL="
  set /p "PULL_MODEL=Pull it now? [Y/n]: "
  if /I "!PULL_MODEL!"=="N" (
    echo No model was pulled. Run setup-ollama-model.bat when ready.
    pause
    exit /b 1
  )
  ollama pull "%MODEL_NAME%"
  if errorlevel 1 (
    echo The model pull failed. Check disk space and network access, then review MODEL_SETUP.md.
    pause
    exit /b 1
  )
)

call :ReadBridgeStatus
if "!BRIDGE_STATUS!"=="occupied" (
  echo Bridge port %HYPERGRAPH_BRIDGE_PORT% is occupied by a service that is not the Hypergraph Ollama bridge.
  echo Stop that service or set HYPERGRAPH_BRIDGE_PORT to a free loopback port, then try again.
  pause
  exit /b 1
)
if "!BRIDGE_STATUS!"=="invalid" (
  echo The bridge health URL is invalid: %BRIDGE_HEALTH_URL%
  pause
  exit /b 1
)
if "!BRIDGE_STATUS!"=="ready" goto BridgeReady

echo Starting the verified local runtime bridge in a minimized window...
start "Hypergraph Runtime Bridge" /min cmd /c call "%~dp0run-local-runtime-bridge.bat"
for /L %%I in (1,1,10) do (
  ping 127.0.0.1 -n 2 >nul
  call :ReadBridgeStatus
  if "!BRIDGE_STATUS!"=="ready" goto BridgeReady
  if "!BRIDGE_STATUS!"=="occupied" goto BridgeConflict
)
echo The Hypergraph bridge did not become healthy at %BRIDGE_HEALTH_URL%.
echo Run run-local-runtime-bridge.bat in a visible terminal to inspect its precise error.
pause
exit /b 1

:BridgeConflict
echo A different service claimed bridge port %HYPERGRAPH_BRIDGE_PORT% while the bridge was starting.
echo Stop that service or choose another HYPERGRAPH_BRIDGE_PORT, then try again.
pause
exit /b 1

:BridgeReady
echo Hypergraph bridge identity verified at %BRIDGE_HEALTH_URL%.

if not exist node_modules (
  echo Installing dashboard dependencies...
  npm install
  if errorlevel 1 (
    echo npm install failed. Review the npm error above, restore registry access if needed, and retry.
    pause
    exit /b 1
  )
)

echo.
echo Dashboard URL: %DASHBOARD_URL%
echo Ollama URL: http://127.0.0.1:11434
echo Bridge URL: %BRIDGE_OLLAMA_URL%
echo Bridge origins: %HYPERGRAPH_BRIDGE_ORIGINS%
echo Runtime: Ollama
echo Model: %MODEL_NAME%
echo.
npm run dev -- --host %FRONTEND_HOST% --port %FRONTEND_PORT% --strictPort
pause
endlocal
exit /b 0

:ReadBridgeStatus
set "BRIDGE_STATUS=invalid"
for /f "delims=" %%S in ('node scripts\launcher-preflight.mjs bridge-status "%BRIDGE_HEALTH_URL%"') do set "BRIDGE_STATUS=%%S"
exit /b 0
