@echo off
setlocal
title Hypergraph Converter Studio - Ollama Origins Example

set "ORIGINS=https://hypergraphproject.github.io,https://YOUR_USERNAME.github.io,http://localhost:5173,http://127.0.0.1:5173"

echo Ollama origins example
echo.
echo Allowed origins:
echo %ORIGINS%
echo.
echo Windows user environment variable command:
echo powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '%ORIGINS%', 'User')"
echo.
echo After setting it, fully quit/restart Ollama.
echo.
echo Linux/WSL systemd notes:
echo sudo systemctl edit ollama
echo.
echo [Service]
echo Environment="OLLAMA_ORIGINS=%ORIGINS%"
echo.
echo sudo systemctl daemon-reload
echo sudo systemctl restart ollama
echo.
pause
endlocal
