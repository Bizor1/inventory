@echo off
title DOMINAK 757 POS - Advanced Diagnostic & Fix Tool
echo =====================================
echo  DOMINAK 757 POS Advanced Diagnostic
echo =====================================
echo.

echo [1/10] Checking Windows version and compatibility...
ver
echo.

echo [2/10] Checking if Visual C++ Redistributables are installed...
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✓ Visual C++ 2015-2019 Redistributable found
) else (
    echo ⚠ Visual C++ Redistributable missing - This might be the issue!
    echo   Download from: https://aka.ms/vs/16/release/vc_redist.x64.exe
)
echo.

echo [3/10] Checking .NET Framework...
reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✓ .NET Framework found
) else (
    echo ⚠ .NET Framework might be missing
)
echo.

echo [4/10] Checking Windows Defender exclusions...
echo   If Windows Defender is blocking the app, you might not see any errors
echo   Consider adding an exclusion for: %USERPROFILE%\Desktop\DOMINAK*
echo.

echo [5/10] Checking file permissions...
icacls "%USERPROFILE%\Desktop\DOMINAK 757 POS System 1.0.0.exe" | findstr /i "full"
if %ERRORLEVEL% EQU 0 (
    echo ✓ File has proper permissions
) else (
    echo ⚠ File permissions might be restricted
)
echo.

echo [6/10] Checking if app is digitally signed...
signtool verify /pa "%USERPROFILE%\Desktop\DOMINAK 757 POS System 1.0.0.exe" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✓ App is digitally signed
) else (
    echo ⚠ App is not digitally signed - Windows might block it
)
echo.

echo [7/10] Checking for running processes...
tasklist | findstr /i "DOMINAK\|electron" >nul
if %ERRORLEVEL% EQU 0 (
    echo ⚠ Found running processes - killing them...
    taskkill /f /im "DOMINAK 757 POS System 1.0.0.exe" 2>nul
    taskkill /f /im "electron.exe" 2>nul
    timeout /t 2 /nobreak >nul
) else (
    echo ✓ No conflicting processes found
)
echo.

echo [8/10] Trying to run with compatibility mode...
echo   Running in Windows 8 compatibility mode...
cd /d "%USERPROFILE%\Desktop"
start "" /wait cmd /c "set __COMPAT_LAYER=WIN8RTM && \"DOMINAK 757 POS System 1.0.0.exe\""
timeout /t 3 /nobreak >nul
echo.

echo [9/10] Checking if app started...
tasklist | findstr /i "DOMINAK" >nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ SUCCESS: App is now running!
    echo   Check your taskbar for the DOMINAK 757 POS window
) else (
    echo ✗ App still not running - trying alternative methods...
    echo.
    echo [10/10] Final attempt - running from dedicated folder...
    if not exist "C:\DOMINAK-757-POS" mkdir "C:\DOMINAK-757-POS"
    copy "%USERPROFILE%\Desktop\DOMINAK 757 POS System 1.0.0.exe" "C:\DOMINAK-757-POS\" >nul 2>&1
    cd /d "C:\DOMINAK-757-POS"
    echo   Starting from C:\DOMINAK-757-POS\...
    start "" "DOMINAK 757 POS System 1.0.0.exe"
    timeout /t 3 /nobreak >nul
    
    tasklist | findstr /i "DOMINAK" >nul
    if %ERRORLEVEL% EQU 0 (
        echo ✓ SUCCESS: App started from dedicated folder!
    ) else (
        echo ✗ FAILED: App still won't start
        echo.
        echo TROUBLESHOOTING RECOMMENDATIONS:
        echo 1. Install Visual C++ Redistributable: https://aka.ms/vs/16/release/vc_redist.x64.exe
        echo 2. Add Windows Defender exclusion for DOMINAK folder
        echo 3. Run as Administrator: Right-click exe → "Run as administrator"
        echo 4. Try the installer version instead: "DOMINAK 757 POS System Setup 1.0.0.exe"
        echo 5. Check Windows Event Viewer for detailed error messages
        echo 6. Restart computer and try again
    )
)

echo.
echo =====================================
echo Press any key to exit...
pause >nul 