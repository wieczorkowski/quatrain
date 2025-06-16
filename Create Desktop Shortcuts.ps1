# PowerShell script to create desktop shortcuts for Quatrain batch files
# Run this script as Administrator if you encounter permission issues

Write-Host "Creating Desktop Shortcuts for Quatrain..." -ForegroundColor Green
Write-Host ""

# Get the current script directory (where the batch files are located)
$QuatrainDirectory = $PSScriptRoot

# Get the Desktop path for the current user
$DesktopPath = [Environment]::GetFolderPath("Desktop")

# Create COM object for creating shortcuts
$WScriptShell = New-Object -ComObject WScript.Shell

try {
    # Create shortcut for Launch Quatrain
    Write-Host "Creating 'Launch Quatrain' shortcut..." -ForegroundColor Yellow
    $LaunchShortcut = $WScriptShell.CreateShortcut("$DesktopPath\Launch Quatrain.lnk")
    $LaunchShortcut.TargetPath = "$QuatrainDirectory\Launch Quatrain.bat"
    $LaunchShortcut.WorkingDirectory = $QuatrainDirectory
    $LaunchShortcut.Description = "Launch Quatrain Charting Client (Full Build)"
    $LaunchShortcut.IconLocation = "$QuatrainDirectory\build\favicon.ico,0"
    $LaunchShortcut.Save()
    Write-Host "✓ Launch Quatrain shortcut created successfully" -ForegroundColor Green

    # Create shortcut for Restart Quatrain
    Write-Host "Creating 'Restart Quatrain' shortcut..." -ForegroundColor Yellow
    $RestartShortcut = $WScriptShell.CreateShortcut("$DesktopPath\Restart Quatrain.lnk")
    $RestartShortcut.TargetPath = "$QuatrainDirectory\Restart Quatrain.bat"
    $RestartShortcut.WorkingDirectory = $QuatrainDirectory
    $RestartShortcut.Description = "Restart Quatrain Charting Client (Quick Launch)"
    $RestartShortcut.IconLocation = "$QuatrainDirectory\build\favicon.ico,0"
    $RestartShortcut.Save()
    Write-Host "✓ Restart Quatrain shortcut created successfully" -ForegroundColor Green

    Write-Host ""
    Write-Host "Desktop shortcuts created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You should now see two shortcuts on your desktop:" -ForegroundColor Cyan
    Write-Host "• Launch Quatrain  - Full build and launch (use for first time or after code changes)" -ForegroundColor White
    Write-Host "• Restart Quatrain - Quick restart using existing build (use after crashes)" -ForegroundColor White
    Write-Host ""
    Write-Host "Your testers can now double-click these shortcuts to launch Quatrain!" -ForegroundColor Green

} catch {
    Write-Host "Error creating shortcuts: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running this script as Administrator if you encounter permission issues." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 