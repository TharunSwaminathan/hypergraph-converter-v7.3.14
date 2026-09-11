@echo off
title Hypergraph Converter Studio - CANDY Runtime Companion
cd /d "%~dp0"
echo Starting the authenticated CANDY Runtime Companion on 127.0.0.1...
echo.
npm run candy:runtime
pause
