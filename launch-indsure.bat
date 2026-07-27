@echo off
title IndSure Launcher
cd /d "%~dp0"

echo.
echo  Starting IndSure...
echo.

REM Start backend in its own window
start "IndSure Backend" cmd /k "cd /d "%~dp0" && npm run dev"

REM Start frontend in its own window
start "IndSure Frontend" cmd /k "cd /d "%~dp0" && npm run dev:client"

REM Wait for Vite to be ready then open browser
timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:5412/"

exit
