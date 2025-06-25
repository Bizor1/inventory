; Custom NSIS installer script for DOMINAK 757 POS System

; Add custom installer pages
!include "MUI2.nsh"

; Custom welcome message
!define MUI_WELCOMEPAGE_TITLE "Welcome to DOMINAK 757 POS System Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of DOMINAK 757 POS System.$\r$\n$\r$\nThis is a complete offline Point of Sale and Inventory Management system designed for small to medium businesses.$\r$\n$\r$\nClick Next to continue."

; Custom finish page
!define MUI_FINISHPAGE_TITLE "DOMINAK 757 POS System Installation Complete"
!define MUI_FINISHPAGE_TEXT "DOMINAK 757 POS System has been successfully installed on your computer.$\r$\n$\r$\nFeatures installed:$\r$\n• Complete POS System$\r$\n• Inventory Management$\r$\n• Sales Reporting$\r$\n• User Management$\r$\n• Offline Operation$\r$\n$\r$\nClick Finish to complete the installation."

; Add custom section for initial setup
Section "Initial Setup" SEC01
  ; Create data directory
  CreateDirectory "$INSTDIR\data"
  
  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\DOMINAK 757"
  CreateShortCut "$SMPROGRAMS\DOMINAK 757\DOMINAK 757 POS.lnk" "$INSTDIR\DOMINAK 757 POS System.exe"
  CreateShortCut "$SMPROGRAMS\DOMINAK 757\Uninstall.lnk" "$INSTDIR\Uninstall DOMINAK 757 POS System.exe"
  
  ; Create desktop shortcut
  CreateShortCut "$DESKTOP\DOMINAK 757 POS.lnk" "$INSTDIR\DOMINAK 757 POS System.exe"
  
  ; Write registry keys for uninstaller
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DOMINAK757POS" "DisplayName" "DOMINAK 757 POS System"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DOMINAK757POS" "UninstallString" "$INSTDIR\Uninstall DOMINAK 757 POS System.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DOMINAK757POS" "DisplayIcon" "$INSTDIR\DOMINAK 757 POS System.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DOMINAK757POS" "Publisher" "DOMINAK 757 BUSINESS CENTRE"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DOMINAK757POS" "DisplayVersion" "1.0.0"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DOMINAK757POS" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DOMINAK757POS" "NoRepair" 1
SectionEnd

; Uninstaller section
Section "Uninstall"
  ; Remove shortcuts
  Delete "$SMPROGRAMS\DOMINAK 757\DOMINAK 757 POS.lnk"
  Delete "$SMPROGRAMS\DOMINAK 757\Uninstall.lnk"
  RMDir "$SMPROGRAMS\DOMINAK 757"
  Delete "$DESKTOP\DOMINAK 757 POS.lnk"
  
  ; Remove registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\DOMINAK757POS"
  
  ; Note: We don't delete the data directory to preserve user data
  ; Users can manually delete it if they want to remove all data
SectionEnd 