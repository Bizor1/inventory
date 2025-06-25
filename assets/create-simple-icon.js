const fs = require("fs");
const path = require("path");

// Create a simple 32x32 bitmap data for ICO file
function createSimpleIco() {
  // ICO file header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved (must be 0)
  header.writeUInt16LE(1, 2); // Image type (1 = ICO)
  header.writeUInt16LE(1, 4); // Number of images

  // Image directory entry
  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(32, 0); // Width (32 pixels)
  dirEntry.writeUInt8(32, 1); // Height (32 pixels)
  dirEntry.writeUInt8(0, 2); // Color palette (0 = no palette)
  dirEntry.writeUInt8(0, 3); // Reserved
  dirEntry.writeUInt16LE(1, 4); // Color planes
  dirEntry.writeUInt16LE(32, 6); // Bits per pixel
  dirEntry.writeUInt32LE(2216, 8); // Image data size
  dirEntry.writeUInt32LE(22, 12); // Offset to image data

  // Create a simple 32x32 bitmap (blue background with white text area)
  const bitmapHeader = Buffer.alloc(40);
  bitmapHeader.writeUInt32LE(40, 0); // Header size
  bitmapHeader.writeInt32LE(32, 4); // Width
  bitmapHeader.writeInt32LE(64, 8); // Height (double for ICO)
  bitmapHeader.writeUInt16LE(1, 12); // Planes
  bitmapHeader.writeUInt16LE(32, 14); // Bits per pixel
  bitmapHeader.writeUInt32LE(0, 16); // Compression
  bitmapHeader.writeUInt32LE(0, 20); // Image size
  bitmapHeader.writeUInt32LE(0, 24); // X pixels per meter
  bitmapHeader.writeUInt32LE(0, 28); // Y pixels per meter
  bitmapHeader.writeUInt32LE(0, 32); // Colors used
  bitmapHeader.writeUInt32LE(0, 36); // Important colors

  // Simple pixel data (32x32 BGRA format)
  const pixels = Buffer.alloc(32 * 32 * 4);

  // Fill with a blue color (BGRA format: Blue, Green, Red, Alpha)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 0x50; // Blue
    pixels[i + 1] = 0x3e; // Green
    pixels[i + 2] = 0x2c; // Red
    pixels[i + 3] = 0xff; // Alpha
  }

  // Create a simple "P" pattern in the center (white pixels)
  const centerStart = 8;
  const centerEnd = 24;

  // Draw a simple "P" shape
  for (let y = centerStart; y < centerEnd; y++) {
    for (let x = centerStart; x < centerEnd; x++) {
      const pixelIndex = ((31 - y) * 32 + x) * 4; // Flip Y coordinate

      // Create a simple "P" pattern
      if (
        x === centerStart ||
        x === centerStart + 1 || // Left vertical line
        y === centerStart ||
        y === centerStart + 1 || // Top horizontal
        y === centerStart + 7 ||
        y === centerStart + 8 || // Middle horizontal
        ((x === centerStart + 8 || x === centerStart + 9) &&
          y < centerStart + 9)
      ) {
        // Right vertical (top half)
        pixels[pixelIndex] = 0xff; // Blue (white)
        pixels[pixelIndex + 1] = 0xff; // Green
        pixels[pixelIndex + 2] = 0xff; // Red
        pixels[pixelIndex + 3] = 0xff; // Alpha
      }
    }
  }

  // AND mask (32x32 bits = 128 bytes)
  const andMask = Buffer.alloc(128);
  andMask.fill(0); // All transparent

  // Combine all parts
  const icoFile = Buffer.concat([
    header,
    dirEntry,
    bitmapHeader,
    pixels,
    andMask,
  ]);

  return icoFile;
}

// Generate the ICO file
const icoData = createSimpleIco();
fs.writeFileSync(path.join(__dirname, "icon.ico"), icoData);

console.log("✅ Simple ICO icon created: assets/icon.ico");
console.log('🎨 Created a 32x32 blue icon with white "P" pattern');
