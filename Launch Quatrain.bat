@echo off
title Launching Quatrain...
cd /d "%~dp0"
echo.
echo ===============================================
echo    Quatrain Charting Client - Starting...
echo ===============================================
echo.
echo Building and launching Quatrain...
echo This may take a moment on first launch.
echo.
echo This window will minimize once Quatrain starts.
echo.
npm run electron-start
echo.
echo Quatrain has been launched.
pause 