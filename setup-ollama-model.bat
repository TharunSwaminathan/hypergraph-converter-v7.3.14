@echo off
setlocal
title Hypergraph Converter Studio - Setup Ollama Model
cd /d "%~dp0"

rem Set MODEL_NAME before running to use a different global local model.
if not defined MODEL_NAME set "MODEL_NAME=qwen3:8b"

echo Checking Ollama...
where ollama >nul 2>nul
if errorlevel 1 (
  echo Ollama was not found.
  echo Install Ollama first, then run this script again.
  echo See MODEL_SETUP.md for details.
  pause
  exit /b 1
)

echo Checking local model: %MODEL_NAME%
ollama show "%MODEL_NAME%" >nul 2>nul
if not errorlevel 1 (
  echo The model is already available locally.
  goto :done
)

echo Pulling local model: %MODEL_NAME%
ollama pull "%MODEL_NAME%"
if errorlevel 1 (
  echo.
  echo The model pull failed. Confirm that the Ollama server is running and review MODEL_SETUP.md.
  pause
  exit /b 1
)

:done
echo.
echo Done. In the dashboard use:
echo Runtime: Ollama
echo Model: %MODEL_NAME%
echo Connection: click Connect; the app tries direct Ollama and the local bridge automatically.
pause
endlocal
