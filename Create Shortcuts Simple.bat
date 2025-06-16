@echo off
echo Creating desktop shortcuts for Quatrain...
echo.

rem Get current directory
set "CURRENT_DIR=%~dp0"

rem Create Launch Quatrain shortcut
powershell "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%USERPROFILE%\Desktop\Launch Quatrain.lnk'); $SC.TargetPath = '%CURRENT_DIR%Launch Quatrain.bat'; $SC.WorkingDirectory = '%CURRENT_DIR%'; $SC.Description = 'Launch Quatrain Charting Client (Full Build)'; $SC.Save()"

rem Create Restart Quatrain shortcut
powershell "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%USERPROFILE%\Desktop\Restart Quatrain.lnk'); $SC.TargetPath = '%CURRENT_DIR%Restart Quatrain.bat'; $SC.WorkingDirectory = '%CURRENT_DIR%'; $SC.Description = 'Restart Quatrain Charting Client (Quick Launch)'; $SC.Save()"

echo.
echo Desktop shortcuts created successfully!
echo.
echo You should now see two shortcuts on your desktop:
echo - Launch Quatrain  (Full build and launch)
echo - Restart Quatrain (Quick restart using existing build)
echo.
pause 