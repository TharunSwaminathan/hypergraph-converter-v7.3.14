@echo off
setlocal
title Hypergraph Converter Studio - Ollama Origins Example

if not defined FRONTEND_ORIGIN set /p "FRONTEND_ORIGIN=Enter the exact dashboard origin shown by the launcher (for example http://127.0.0.1:5173): "
if not defined FRONTEND_ORIGIN (
  echo An exact dashboard origin is required. Run run-with-ollama.bat first and copy its Dashboard URL.
  pause
  exit /b 1
)
set "ORIGINS=https://hypergraphproject.github.io,%FRONTEND_ORIGIN%"

echo Ollama origins example
echo.
echo Allowed origins:
echo %ORIGINS%
echo.
echo Windows PowerShell user environment command:
echo [Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '%ORIGINS%', 'User')
echo.
echo Windows Command Prompt user environment command:
echo setx OLLAMA_ORIGINS "%ORIGINS%"
echo.
echo POSIX current-shell command:
echo export OLLAMA_ORIGINS='%ORIGINS%'
echo.
echo Fully quit and restart Ollama after changing this value.
pause
endlocal
