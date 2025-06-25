Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " DOMINAK 757 POS - Advanced Fix Tool" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠ Not running as Administrator - some fixes may not work" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "[1/12] Checking system information..." -ForegroundColor Green
$osInfo = Get-WmiObject -Class Win32_OperatingSystem
Write-Host "OS: $($osInfo.Caption) $($osInfo.Version)" -ForegroundColor White
Write-Host "Architecture: $($osInfo.OSArchitecture)" -ForegroundColor White
Write-Host ""

Write-Host "[2/12] Checking Visual C++ Redistributables..." -ForegroundColor Green
$vcRedist = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" -ErrorAction SilentlyContinue
if ($vcRedist) {
    Write-Host "✓ Visual C++ 2015-2019 Redistributable found" -ForegroundColor Green
}
else {
    Write-Host "⚠ Visual C++ Redistributable missing!" -ForegroundColor Red
    Write-Host "  This is likely the cause of the issue." -ForegroundColor Red
    Write-Host "  Download: https://aka.ms/vs/16/release/vc_redist.x64.exe" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[3/12] Checking .NET Framework..." -ForegroundColor Green
$dotNet = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" -ErrorAction SilentlyContinue
if ($dotNet) {
    Write-Host "✓ .NET Framework 4.x found (Release: $($dotNet.Release))" -ForegroundColor Green
}
else {
    Write-Host "⚠ .NET Framework might be missing" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[4/12] Checking Windows Defender status..." -ForegroundColor Green
try {
    $defenderStatus = Get-MpComputerStatus -ErrorAction SilentlyContinue
    if ($defenderStatus.RealTimeProtectionEnabled) {
        Write-Host "⚠ Windows Defender Real-time protection is enabled" -ForegroundColor Yellow
        Write-Host "  Consider adding exclusion for DOMINAK folder" -ForegroundColor Yellow
    }
    else {
        Write-Host "✓ Windows Defender real-time protection is disabled" -ForegroundColor Green
    }
}
catch {
    Write-Host "? Cannot check Windows Defender status" -ForegroundColor Gray
}
Write-Host ""

Write-Host "[5/12] Checking file existence and permissions..." -ForegroundColor Green
$appPath = "$env:USERPROFILE\Desktop\DOMINAK 757 POS System 1.0.0.exe"
$setupPath = "$env:USERPROFILE\Desktop\DOMINAK 757 POS System Setup 1.0.0.exe"

if (Test-Path $appPath) {
    Write-Host "✓ Portable app found: $appPath" -ForegroundColor Green
    $fileInfo = Get-ItemProperty $appPath
    Write-Host "  Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor White
    Write-Host "  Modified: $($fileInfo.LastWriteTime)" -ForegroundColor White
}
else {
    Write-Host "✗ Portable app not found at expected location" -ForegroundColor Red
}

if (Test-Path $setupPath) {
    Write-Host "✓ Installer found: $setupPath" -ForegroundColor Green
}
else {
    Write-Host "✗ Installer not found" -ForegroundColor Red
}
Write-Host ""

Write-Host "[6/12] Checking for running processes..." -ForegroundColor Green
$processes = Get-Process | Where-Object { $_.ProcessName -like "*DOMINAK*" -or $_.ProcessName -like "*electron*" }
if ($processes) {
    Write-Host "⚠ Found running processes, terminating..." -ForegroundColor Yellow
    $processes | ForEach-Object {
        Write-Host "  Killing: $($_.ProcessName)" -ForegroundColor Yellow
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}
else {
    Write-Host "✓ No conflicting processes found" -ForegroundColor Green
}
Write-Host ""

Write-Host "[7/12] Checking Event Logs for application errors..." -ForegroundColor Green
try {
    $recentErrors = Get-EventLog -LogName Application -EntryType Error -Newest 5 -After (Get-Date).AddHours(-1) -ErrorAction SilentlyContinue | 
    Where-Object { $_.Source -like "*electron*" -or $_.Message -like "*DOMINAK*" }
    if ($recentErrors) {
        Write-Host "⚠ Found recent application errors:" -ForegroundColor Yellow
        $recentErrors | ForEach-Object {
            Write-Host "  $($_.TimeGenerated): $($_.Message.Substring(0, [Math]::Min(100, $_.Message.Length)))" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "✓ No recent application errors found" -ForegroundColor Green
    }
}
catch {
    Write-Host "? Cannot check Event Logs" -ForegroundColor Gray
}
Write-Host ""

Write-Host "[8/12] Creating dedicated application folder..." -ForegroundColor Green
$dedicatedPath = "C:\DOMINAK-757-POS"
if (-not (Test-Path $dedicatedPath)) {
    New-Item -ItemType Directory -Path $dedicatedPath -Force | Out-Null
    Write-Host "✓ Created folder: $dedicatedPath" -ForegroundColor Green
}
else {
    Write-Host "✓ Folder already exists: $dedicatedPath" -ForegroundColor Green
}

if (Test-Path $appPath) {
    Copy-Item $appPath $dedicatedPath -Force
    Write-Host "✓ Copied app to dedicated folder" -ForegroundColor Green
}
Write-Host ""

Write-Host "[9/12] Attempting to run with compatibility mode..." -ForegroundColor Green
if (Test-Path "$dedicatedPath\DOMINAK 757 POS System 1.0.0.exe") {
    Write-Host "  Starting with Windows 8 compatibility..." -ForegroundColor White
    $env:__COMPAT_LAYER = "WIN8RTM"
    Start-Process -FilePath "$dedicatedPath\DOMINAK 757 POS System 1.0.0.exe" -WorkingDirectory $dedicatedPath -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    Remove-Item Env:__COMPAT_LAYER -ErrorAction SilentlyContinue
}
else {
    Write-Host "✗ App not found in dedicated folder" -ForegroundColor Red
}
Write-Host ""

Write-Host "[10/12] Checking if application started..." -ForegroundColor Green
$runningApp = Get-Process | Where-Object { $_.ProcessName -like "*DOMINAK*" }
if ($runningApp) {
    Write-Host "✓ SUCCESS: DOMINAK 757 POS is now running!" -ForegroundColor Green
    Write-Host "  Process ID: $($runningApp.Id)" -ForegroundColor White
    Write-Host "  Check your taskbar for the application window" -ForegroundColor White
}
else {
    Write-Host "✗ Application still not running" -ForegroundColor Red
    
    Write-Host ""
    Write-Host "[11/12] Trying installer version..." -ForegroundColor Green
    if (Test-Path $setupPath) {
        Write-Host "  Running installer..." -ForegroundColor White
        Start-Process -FilePath $setupPath -Wait -ErrorAction SilentlyContinue
        Write-Host "✓ Installer completed - try launching from Start Menu" -ForegroundColor Green
    }
    else {
        Write-Host "✗ Installer not found" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "[12/12] Final recommendations..." -ForegroundColor Green
if (-not $runningApp) {
    Write-Host "TROUBLESHOOTING STEPS:" -ForegroundColor Red
    Write-Host "1. Install Visual C++ Redistributable (most common fix):" -ForegroundColor Yellow
    Write-Host "   https://aka.ms/vs/16/release/vc_redist.x64.exe" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Add Windows Defender exclusion:" -ForegroundColor Yellow
    Write-Host "   Windows Security → Virus & threat protection → Exclusions" -ForegroundColor White
    Write-Host "   Add folder: C:\DOMINAK-757-POS" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Run as Administrator:" -ForegroundColor Yellow
    Write-Host "   Right-click the exe → 'Run as administrator'" -ForegroundColor White
    Write-Host ""
    Write-Host "4. Check Windows Event Viewer for detailed errors:" -ForegroundColor Yellow
    Write-Host "   Windows Logs → Application" -ForegroundColor White
    Write-Host ""
    Write-Host "5. Restart computer and try again" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Press any key to exit..." -ForegroundColor White
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 