@echo off
title Hypergraph Converter Studio - Clean Install
cd /d "%~dp0"
echo Cleaning dependencies...
echo.
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json
call npm cache clean --force
if errorlevel 1 goto :error
call npm install --registry=https://registry.npmjs.org/
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
pause
exit /b 0

:error
echo.
echo The clean install or production build failed.
pause
exit /b 1
