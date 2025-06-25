const fs = require("fs");
const path = require("path");

// Create a simple SVG icon for the POS system
const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="256" height="256" rx="32" fill="#2c3e50"/>
  
  <!-- Cash register body -->
  <rect x="48" y="80" width="160" height="120" rx="8" fill="#34495e"/>
  <rect x="56" y="88" width="144" height="104" rx="4" fill="#ecf0f1"/>
  
  <!-- Screen -->
  <rect x="72" y="104" width="112" height="32" rx="4" fill="#2c3e50"/>
  <text x="128" y="125" text-anchor="middle" fill="#27ae60" font-family="Arial, sans-serif" font-size="12" font-weight="bold">DOMINAK</text>
  
  <!-- Buttons -->
  <circle cx="88" cy="156" r="8" fill="#3498db"/>
  <circle cx="112" cy="156" r="8" fill="#e74c3c"/>
  <circle cx="136" cy="156" r="8" fill="#f39c12"/>
  <circle cx="160" cy="156" r="8" fill="#27ae60"/>
  
  <!-- Keypad -->
  <rect x="88" y="172" width="80" height="8" rx="2" fill="#95a5a6"/>
  
  <!-- Cash drawer -->
  <rect x="56" y="200" width="144" height="16" rx="2" fill="#7f8c8d"/>
  <rect x="60" y="204" width="136" height="8" rx="1" fill="#bdc3c7"/>
  
  <!-- Brand text -->
  <text x="128" y="240" text-anchor="middle" fill="#ecf0f1" font-family="Arial, sans-serif" font-size="14" font-weight="bold">POS 757</text>
</svg>`;

// Write the SVG file
fs.writeFileSync(path.join(__dirname, "icon.svg"), svgIcon);
console.log("✅ SVG icon created: assets/icon.svg");

// Create a simple ICO file content (basic format)
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Type (1 = ICO)
icoHeader.writeUInt16LE(1, 4); // Number of images

console.log("✅ Icon creation script completed!");
console.log(
  "📝 Note: For production, consider using a proper icon converter or design tool."
);
