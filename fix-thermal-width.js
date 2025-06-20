const { execSync } = require("child_process");
const fs = require("fs");
const ReceiptFormatterService = require("./src/services/ReceiptFormatterService");

// Create the enhanced formatter
const formatter = new ReceiptFormatterService();

console.log("=== FIXING THERMAL PRINTER WIDTH ISSUE ===");
console.log("Adding ESC/POS commands to force full width printing...");
console.log("");

// Enhanced test receipt data
const testReceiptData = {
  sale: {
    receipt_number: "WIDTH-FIX-001",
    sale_date: new Date(),
    cashier_name: "Full Width Test",
    total_amount: 40.78,
    tax_amount: 4.53,
    tax_rate: 12.5,
    payment_method: "cash",
    amount_paid: 45.0,
    items: [
      {
        product_name: "Test Product 1",
        quantity: 1,
        unit_price: 10.0,
        total_price: 10.0,
      },
      {
        product_name: "Long Product Name To Test Width",
        quantity: 2,
        unit_price: 5.5,
        total_price: 11.0,
      },
      {
        product_name:
          "Another Very Long Product Name That Should Use Full Width",
        quantity: 1,
        unit_price: 15.25,
        total_price: 15.25,
      },
    ],
  },
  business: {
    business_name: "DOMINAK 757 BUSINESS CENTRE",
    business_address: "FULL WIDTH TEST - SHOULD USE ENTIRE PRINTER WIDTH",
    business_phone: "0549831901",
    currency: "GHS",
    receipt_footer: "FULL WIDTH FORMATTING SUCCESS!",
  },
};

// Generate the enhanced receipt with ESC/POS commands
const enhancedReceipt = formatter.formatReceipt(testReceiptData, "80mm", true);

// Create a version with additional width-fixing ESC/POS commands
const fullWidthReceipt =
  "\x1b@" + // ESC @ - Initialize printer
  "\x1b!\x00" + // ESC ! 0 - Reset character size
  "\x1b\x61\x00" + // ESC a 0 - Left align
  "\x1d\x4c\x00\x00" + // GS L 0 0 - Set left margin to 0
  "\x1b\x44\x02\x10\x22\x00" + // Set tab positions for columns
  enhancedReceipt +
  "\x0a\x0a\x0a" + // Extra line feeds
  "\x1d\x56\x00"; // Cut paper

// Save both versions for testing
fs.writeFileSync("enhanced-with-escpos.txt", enhancedReceipt);
fs.writeFileSync("full-width-fix.txt", fullWidthReceipt, "binary");

// Also create a simple width test
const widthTest =
  "\x1b@" + // Reset printer
  "\x1b!\x00" + // Normal size
  "123456789012345678901234567890123456789012345678\n" + // 48 chars
  "         THIS SHOULD USE FULL WIDTH         \n" +
  "==========================================\n" + // 42 chars
  "================================================\n" + // 48 chars
  "If this line uses full printer width, fix worked!\n" +
  "If this line is narrow/compressed, driver issue.\n" +
  "\x0a\x0a\x0a\x1d\x56\x00";

fs.writeFileSync("width-test.txt", widthTest, "binary");

console.log("✅ Created test files:");
console.log("   - enhanced-with-escpos.txt (enhanced with ESC/POS)");
console.log("   - full-width-fix.txt (with width-fixing commands)");
console.log("   - width-test.txt (simple width test)");
console.log("");

console.log("🔧 TESTING WIDTH FIX:");
console.log("=====================================");

try {
  console.log("1. Printing simple width test...");

  const result1 = execSync(
    'Get-Content width-test.txt -Encoding Byte | ForEach-Object { [char]$_ } | Out-Printer -Name "XP-76C"',
    { encoding: "utf8", shell: "powershell" }
  );

  console.log("✅ Width test sent to printer!");
  console.log("");

  console.log("2. Printing enhanced receipt with width fix...");

  const result2 = execSync(
    'Get-Content full-width-fix.txt -Encoding Byte | ForEach-Object { [char]$_ } | Out-Printer -Name "XP-76C"',
    { encoding: "utf8", shell: "powershell" }
  );

  console.log("✅ Enhanced receipt with width fix sent to printer!");
  console.log("");

  console.log("🎯 CHECK YOUR PRINTER NOW!");
  console.log("");
  console.log("You should see TWO prints:");
  console.log("1. WIDTH TEST - numbered lines showing full width");
  console.log("2. ENHANCED RECEIPT - using full printer width");
  console.log("");
  console.log("If still narrow/compressed:");
  console.log("• Check printer DIP switches (should be set for 42-48 chars)");
  console.log("• Try different USB port");
  console.log("• May need to reinstall thermal printer driver");
} catch (error) {
  console.error("❌ Print failed:", error.message);
  console.log("");
  console.log("🔧 Manual commands to try:");
  console.log(
    'Get-Content width-test.txt -Encoding Byte | ForEach-Object { [char]$_ } | Out-Printer -Name "XP-76C"'
  );
}

console.log("");
console.log("📋 TROUBLESHOOTING NARROW PRINTING:");
console.log("1. Check printer DIP switches (set for max characters)");
console.log(
  "2. Look for 'Font' or 'Character Width' settings in printer properties"
);
console.log("3. Try printing from Notepad to see if it's a driver issue");
console.log("4. Check if printer is set to 'Draft' or 'Compressed' mode");
