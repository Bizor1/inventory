@echo off
title DOMINAK 757 POS - Simple Fix Tool
echo =====================================
echo  DOMINAK 757 POS Simple Fix Tool
echo =====================================
echo.
echo This script will attempt to fix the most common issue
echo preventing Electron apps from starting on Windows.
echo.

echo [1/5] Checking current system...
echo OS: %OS%
echo Processor: %PROCESSOR_ARCHITECTURE%
echo.

echo [2/5] The most common cause is missing Visual C++ Redistributables
echo Checking for Visual C++ 2015-2022 Redistributable...
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✓ Found Visual C++ 2015-2019 Redistributable
) else (
    echo ⚠ Visual C++ 2015-2019 Redistributable NOT found
)

reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✓ Found Visual C++ 2015-2019 Redistributable (WOW64)
) else (
    echo ⚠ Visual C++ 2015-2019 Redistributable NOT found (WOW64)
)
echo.

echo [3/5] Downloading Visual C++ Redistributable...
echo This is the most common fix for Electron apps not starting.
echo.
echo Please download and install from:
echo https://aka.ms/vs/17/release/vc_redist.x64.exe
echo.
echo Opening download page in your browser...
start https://aka.ms/vs/17/release/vc_redist.x64.exe
echo.

echo [4/5] Alternative: Try running as Administrator
echo If the download doesn't work, try:
echo 1. Right-click on "DOMINAK 757 POS System 1.0.0.exe"
echo 2. Select "Run as administrator"
echo.

echo [5/5] Alternative: Use the installer version
echo Try running: "DOMINAK 757 POS System Setup 1.0.0.exe"
echo This version installs properly and usually works better.
echo.

echo =====================================
echo IMPORTANT: After installing Visual C++ Redistributable,
echo restart your computer and try running the app again.
echo =====================================
echo.
echo Press any key to exit...
pause >nul 