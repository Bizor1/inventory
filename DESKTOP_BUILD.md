# DOMINAK 757 POS System - Desktop Application

## 🚀 Building the Desktop App

This guide will help you build a standalone desktop application for Windows, Mac, and Linux.

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- All dependencies installed (`npm install`)

### Build Commands

#### Windows

```bash
# Build Windows installer (.exe)
npm run build-win-installer

# Build Windows portable app
npm run build-win-portable

# Build both Windows formats
npm run build-win
```

#### All Platforms

```bash
# Build for Windows, Mac, and Linux
npm run build-all

# Quick distribution build (Windows installer)
npm run dist
```

#### Development

```bash
# Test build without packaging
npm run pack

# Run in development mode
npm run dev
```

### Output Files

After building, you'll find the desktop applications in the `dist/` folder:

- **Windows**: `DOMINAK 757 POS System Setup 1.0.0.exe` (installer)
- **Windows**: `DOMINAK 757 POS System 1.0.0.exe` (portable)
- **Mac**: `DOMINAK 757 POS System-1.0.0.dmg`
- **Linux**: `DOMINAK 757 POS System-1.0.0.AppImage`

### Features of Desktop App

✅ **Standalone Installation** - No need for browser or internet  
✅ **Native Performance** - Faster than web version  
✅ **System Integration** - Start menu shortcuts, desktop icons  
✅ **Auto-Updates** - Built-in update mechanism  
✅ **File System Access** - Direct database and file operations  
✅ **Printer Integration** - Native printer support  
✅ **Offline Operation** - Works completely offline

### Installation Process

1. **Windows**: Run the `.exe` installer

   - Creates desktop shortcut
   - Adds to Start Menu
   - Registers uninstaller
   - Sets up data directory

2. **Mac**: Open the `.dmg` file and drag to Applications

3. **Linux**: Make the `.AppImage` executable and run
   ```bash
   chmod +x "DOMINAK 757 POS System-1.0.0.AppImage"
   ./DOMINAK\ 757\ POS\ System-1.0.0.AppImage
   ```

### File Structure

```
DOMINAK 757 POS System/
├── src/                    # Application source code
├── assets/                 # Icons and resources
├── data/                   # Database files
├── dist/                   # Built applications
└── node_modules/           # Dependencies
```

### Troubleshooting

#### Build Issues

- Ensure all dependencies are installed: `npm install`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be v16+)

#### Runtime Issues

- Database permissions: Ensure the app can write to the data directory
- Printer access: Check Windows printer permissions
- Antivirus: Add exception for the POS application

### Distribution

The built applications are ready for distribution:

- No additional setup required on target machines
- All dependencies bundled
- Self-contained executable files
- Professional installer with proper uninstall

### Auto-Updates

The app is configured for GitHub releases:

- Upload new builds to GitHub releases
- App will check for updates automatically
- Users get notified of new versions

---

**DOMINAK 757 BUSINESS CENTRE**  
_Professional POS & Inventory Management System_
