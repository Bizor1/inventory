const fs = require("fs");
const path = require("path");

// Create a 256x256 bitmap data for ICO file
function createLargeIco() {
  // ICO file header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved (must be 0)
  header.writeUInt16LE(1, 2); // Image type (1 = ICO)
  header.writeUInt16LE(1, 4); // Number of images

  // Image directory entry
  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(0, 0); // Width (0 = 256 pixels)
  dirEntry.writeUInt8(0, 1); // Height (0 = 256 pixels)
  dirEntry.writeUInt8(0, 2); // Color palette (0 = no palette)
  dirEntry.writeUInt8(0, 3); // Reserved
  dirEntry.writeUInt16LE(1, 4); // Color planes
  dirEntry.writeUInt16LE(32, 6); // Bits per pixel
  dirEntry.writeUInt32LE(262184, 8); // Image data size (256*256*4 + 40 + 8192)
  dirEntry.writeUInt32LE(22, 12); // Offset to image data

  // Create a 256x256 bitmap header
  const bitmapHeader = Buffer.alloc(40);
  bitmapHeader.writeUInt32LE(40, 0); // Header size
  bitmapHeader.writeInt32LE(256, 4); // Width
  bitmapHeader.writeInt32LE(512, 8); // Height (double for ICO)
  bitmapHeader.writeUInt16LE(1, 12); // Planes
  bitmapHeader.writeUInt16LE(32, 14); // Bits per pixel
  bitmapHeader.writeUInt32LE(0, 16); // Compression
  bitmapHeader.writeUInt32LE(0, 20); // Image size
  bitmapHeader.writeUInt32LE(0, 24); // X pixels per meter
  bitmapHeader.writeUInt32LE(0, 28); // Y pixels per meter
  bitmapHeader.writeUInt32LE(0, 32); // Colors used
  bitmapHeader.writeUInt32LE(0, 36); // Important colors

  // Create 256x256 pixel data (BGRA format)
  const pixels = Buffer.alloc(256 * 256 * 4);

  // Fill with a gradient blue background
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const pixelIndex = ((255 - y) * 256 + x) * 4; // Flip Y coordinate

      // Create a gradient effect
      const centerX = 128;
      const centerY = 128;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const maxDistance = Math.sqrt(128 ** 2 + 128 ** 2);
      const gradient = 1 - distance / maxDistance;

      // Base colors (dark blue to lighter blue)
      const baseBlue = 0x50 + Math.floor(gradient * 0x30);
      const baseGreen = 0x3e + Math.floor(gradient * 0x20);
      const baseRed = 0x2c + Math.floor(gradient * 0x10);

      pixels[pixelIndex] = baseBlue; // Blue
      pixels[pixelIndex + 1] = baseGreen; // Green
      pixels[pixelIndex + 2] = baseRed; // Red
      pixels[pixelIndex + 3] = 0xff; // Alpha
    }
  }

  // Draw a large "P" in the center (white)
  const centerX = 128;
  const centerY = 128;
  const size = 80; // Size of the letter

  // Draw the "P" shape
  for (let y = centerY - size / 2; y < centerY + size / 2; y++) {
    for (let x = centerX - size / 2; x < centerX + size / 2; x++) {
      if (x >= 0 && x < 256 && y >= 0 && y < 256) {
        const pixelIndex = ((255 - y) * 256 + x) * 4;

        const relX = x - (centerX - size / 2);
        const relY = y - (centerY - size / 2);

        // Create "P" pattern
        const isVerticalLine = relX < 8; // Left vertical line
        const isTopHorizontal = relY < 8 && relX < size * 0.6; // Top horizontal
        const isMiddleHorizontal =
          relY >= size * 0.4 && relY < size * 0.5 && relX < size * 0.6; // Middle horizontal
        const isRightVertical =
          relX >= size * 0.6 - 8 && relX < size * 0.6 && relY < size * 0.5; // Right vertical (top half only)

        if (
          isVerticalLine ||
          isTopHorizontal ||
          isMiddleHorizontal ||
          isRightVertical
        ) {
          pixels[pixelIndex] = 0xff; // Blue (white)
          pixels[pixelIndex + 1] = 0xff; // Green
          pixels[pixelIndex + 2] = 0xff; // Red
          pixels[pixelIndex + 3] = 0xff; // Alpha
        }
      }
    }
  }

  // Add "DOMINAK 757" text below the P (simplified)
  const textY = centerY + size / 2 + 20;
  for (let y = textY; y < textY + 16; y++) {
    for (let x = centerX - 60; x < centerX + 60; x++) {
      if (x >= 0 && x < 256 && y >= 0 && y < 256) {
        const pixelIndex = ((255 - y) * 256 + x) * 4;

        // Simple text pattern (just a line for now)
        if (y - textY === 8) {
          pixels[pixelIndex] = 0xff; // Blue (white)
          pixels[pixelIndex + 1] = 0xff; // Green
          pixels[pixelIndex + 2] = 0xff; // Red
          pixels[pixelIndex + 3] = 0xff; // Alpha
        }
      }
    }
  }

  // AND mask (256x256 bits = 8192 bytes)
  const andMask = Buffer.alloc(8192);
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

// Generate the large ICO file
const icoData = createLargeIco();
fs.writeFileSync(path.join(__dirname, "icon.ico"), icoData);

console.log("✅ Large ICO icon created: assets/icon.ico");
console.log('🎨 Created a 256x256 blue gradient icon with white "P" pattern');
console.log("📏 Size:", icoData.length, "bytes");
