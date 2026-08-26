@echo off
title Hypergraph Converter Studio - Production Preview
cd /d "%~dp0"
echo Building and starting production preview...
echo.
call npm install
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
call npm run preview -- --host 0.0.0.0
if errorlevel 1 goto :error
pause
exit /b 0

:error
echo.
echo The production preview could not be started.
pause
exit /b 1
