@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Hypergraph Converter Studio - Ollama Quick Start
cd /d "%~dp0"

rem Set MODEL_NAME before running to use another global local/open-weight model.
if not defined MODEL_NAME set "MODEL_NAME=qwen3:8b"
set "BRIDGE_HEALTH_URL=http://127.0.0.1:8787/health"
set "BRIDGE_OLLAMA_URL=http://127.0.0.1:8787/ollama"

echo Checking Ollama...
where ollama >nul 2>nul
if errorlevel 1 (
  echo Ollama was not found.
  echo Install Ollama separately, then run setup-ollama-model.bat.
  echo See MODEL_SETUP.md for details.
  pause
  exit /b 1
)

echo Verifying the Ollama server...
ollama list >nul 2>nul
if errorlevel 1 (
  echo Ollama is not responding. Starting ollama serve in a minimized window...
  start "Ollama Server" /min ollama serve
  ping 127.0.0.1 -n 4 >nul
  ollama list >nul 2>nul
  if errorlevel 1 (
    echo Could not start or reach Ollama at http://localhost:11434.
    echo Start Ollama manually and try again.
    pause
    exit /b 1
  )
) else (
  echo Ollama is already responding.
)

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
    echo The model pull failed. Review MODEL_SETUP.md and try again.
    pause
    exit /b 1
  )
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Install Node.js and npm, then try again.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js, then try again.
  pause
  exit /b 1
)

echo Checking the local runtime bridge...
call :CheckBridge
if "!BRIDGE_READY!"=="1" (
  echo Local runtime bridge is already responding at %BRIDGE_HEALTH_URL%.
) else (
  echo Starting the local runtime bridge in a minimized window...
  start "Hypergraph Runtime Bridge" /min "%~dp0run-local-runtime-bridge.bat"
  for /L %%I in (1,1,10) do (
    ping 127.0.0.1 -n 2 >nul
    call :CheckBridge
    if "!BRIDGE_READY!"=="1" goto BridgeReady
  )
  echo Warning: the bridge did not become reachable at %BRIDGE_HEALTH_URL%.
  echo Direct Ollama is still available at http://localhost:11434. Start run-local-runtime-bridge.bat manually if GitHub Pages bridge mode is needed.
  goto BridgeDone
)
:BridgeReady
if "!BRIDGE_READY!"=="1" echo Local runtime bridge is responding at %BRIDGE_HEALTH_URL%.
:BridgeDone

if not exist node_modules (
  echo Installing dashboard dependencies...
  npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Dashboard URL: http://localhost:5173
echo Ollama URL: http://localhost:11434
echo Bridge URL: %BRIDGE_OLLAMA_URL%
echo Runtime: Ollama
echo Model: %MODEL_NAME%
echo.
npm run dev -- --host 0.0.0.0
pause
endlocal
exit /b 0

:CheckBridge
set "BRIDGE_READY=0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%BRIDGE_HEALTH_URL%' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } exit 1 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 set "BRIDGE_READY=1"
exit /b 0
