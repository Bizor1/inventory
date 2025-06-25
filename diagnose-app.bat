@echo off
title DOMINAK 757 POS - Diagnostic Tool
echo =====================================
echo   DOMINAK 757 POS Diagnostic Tool
echo =====================================
echo.

echo Checking if files exist...
if exist "%USERPROFILE%\Desktop\DOMINAK 757 POS System 1.0.0.exe" (
    echo ✓ Portable executable found
) else (
    echo ✗ Portable executable NOT found
    goto :end
)

echo.
echo Checking file size...
for %%A in ("%USERPROFILE%\Desktop\DOMINAK 757 POS System 1.0.0.exe") do (
    echo File size: %%~zA bytes
    if %%~zA LSS 80000000 (
        echo ⚠ WARNING: File seems too small - might be corrupted
    ) else (
        echo ✓ File size looks correct
    )
)

echo.
echo Checking Windows version...
ver

echo.
echo Checking if process is already running...
tasklist | findstr /i "DOMINAK" >nul
if %ERRORLEVEL% EQU 0 (
    echo ⚠ DOMINAK process is already running
    echo Trying to kill existing processes...
    taskkill /f /im "DOMINAK 757 POS System 1.0.0.exe" 2>nul
) else (
    echo ✓ No existing DOMINAK processes found
)

echo.
echo Attempting to run with detailed error output...
echo Starting application...
cd /d "%USERPROFILE%\Desktop"
start "" "DOMINAK 757 POS System 1.0.0.exe"

echo.
echo Waiting 5 seconds to check if it started...
timeout /t 5 /nobreak >nul

tasklist | findstr /i "DOMINAK" >nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ SUCCESS: Application appears to be running!
) else (
    echo ✗ FAILED: Application did not start
    echo.
    echo Possible solutions:
    echo 1. Right-click the .exe file and select "Run as administrator"
    echo 2. Check Windows Defender / Antivirus settings
    echo 3. Try the installer version instead
    echo 4. Restart your computer and try again
)

:end
echo.
echo Press any key to exit...
pause >nul 