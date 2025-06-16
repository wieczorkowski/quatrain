@echo off
title Restarting Quatrain...
cd /d "%~dp0"
echo.
echo ===============================================
echo   Quatrain Charting Client - Restarting...
echo ===============================================
echo.
echo Restarting Quatrain using existing build...
echo This should start quickly.
echo.
echo This window will close once Quatrain starts.
echo.
npm run electron
echo.
echo Quatrain has been restarted.
pause 