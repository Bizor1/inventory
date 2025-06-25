# DOMINAK 757 POS - Troubleshooting Guide

## Problem: Desktop App Won't Start

If the DOMINAK 757 POS desktop application won't start (clicking the .exe file does nothing), here are the most common solutions:

## 🔧 Quick Fixes (Try These First)

### 1. Install Visual C++ Redistributable (MOST COMMON FIX)

- **This fixes 90% of Electron app startup issues**
- Download: https://aka.ms/vs/17/release/vc_redist.x64.exe
- Install and restart your computer
- Try running the app again

### 2. Use the Installer Version

- Instead of the portable `.exe`, use `DOMINAK 757 POS System Setup 1.0.0.exe`
- This version installs properly and handles dependencies better
- Look for it on your desktop or in the same folder as the portable version

### 3. Run as Administrator

- Right-click on `DOMINAK 757 POS System 1.0.0.exe`
- Select "Run as administrator"
- Windows might be blocking the app due to security settings

## 🔍 Advanced Troubleshooting

### 4. Check Windows Defender

- Open Windows Security
- Go to "Virus & threat protection"
- Click "Manage settings" under "Virus & threat protection settings"
- Add an exclusion for the DOMINAK folder
- Or temporarily disable real-time protection to test

### 5. Run from Dedicated Folder

- Create folder: `C:\DOMINAK-757-POS`
- Copy the .exe file there
- Run from that location (not from Desktop)
- Desktop sometimes has permission issues

### 6. Check Windows Event Viewer

- Press Windows + R, type `eventvwr.msc`
- Go to "Windows Logs" → "Application"
- Look for recent errors when you tried to run the app
- Look for errors containing "electron" or "DOMINAK"

### 7. Compatibility Mode

- Right-click the .exe file
- Select "Properties"
- Go to "Compatibility" tab
- Check "Run this program in compatibility mode for:"
- Select "Windows 8"
- Click OK and try running

### 8. Check System Requirements

- Windows 10 or 11 (64-bit)
- .NET Framework 4.5 or higher
- Visual C++ 2015-2022 Redistributable
- At least 4GB RAM
- 100MB free disk space

## 🛠️ Diagnostic Tools

### Run the Diagnostic Scripts

1. **Simple Fix**: Double-click `simple-fix.bat`
2. **Advanced Diagnostic**: Double-click `diagnose-advanced.bat`
3. **PowerShell Diagnostic**: Right-click `fix-electron-app.ps1` → "Run with PowerShell"

### Manual Checks

```cmd
# Check if Visual C++ is installed
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"

# Check for running processes
tasklist | findstr DOMINAK

# Check file permissions
icacls "DOMINAK 757 POS System 1.0.0.exe"
```

## 📋 Common Error Messages

### "This app can't run on your PC"

- Install Visual C++ Redistributable
- Try running as Administrator

### "Windows protected your PC"

- Click "More info" → "Run anyway"
- Or add Windows Defender exclusion

### Silent failure (no error message)

- Most likely missing Visual C++ Redistributable
- Try running from Command Prompt to see error messages

## 🔄 Step-by-Step Solution Process

1. **First, try the installer version** (`DOMINAK 757 POS System Setup 1.0.0.exe`)
2. **If that doesn't work, install Visual C++ Redistributable**
3. **Restart your computer**
4. **Try running as Administrator**
5. **Add Windows Defender exclusion**
6. **Check Windows Event Viewer for specific errors**
7. **Contact support with Event Viewer error details**

## 📞 Getting Help

If none of these solutions work:

1. Run `diagnose-advanced.bat` and save the output
2. Check Windows Event Viewer for specific error messages
3. Note your Windows version and any antivirus software
4. Contact support with this information

## 🎯 Success Indicators

The app is working when you see:

- A window titled "DOMINAK 757 BUSINESS CENTRE"
- Login screen with PIN entry
- Process "DOMINAK 757 POS System 1.0.0.exe" in Task Manager

## 📝 Technical Notes

- The app is built with Electron 27.3.11
- Requires Node.js runtime (included in the app)
- Uses SQLite database (creates `dominak757.db`)
- Default login: Admin PIN=1234, Cashier PIN=0000

---

**Remember**: 90% of Electron app issues are solved by installing the Visual C++ Redistributable and restarting your computer.
