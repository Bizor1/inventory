const { execSync } = require("child_process");
const fs = require("fs");

// XP-76C Thermal Printer - Fix narrow formatting issue
// The key is to use proper character spacing and avoid word wrapping

function createFixedXP76CReceipt() {
  // XP-76C thermal printer should handle ~42-48 characters per line
  // The issue was using too few characters per line

  let receipt = "";

  // Use longer lines to force full width usage
  receipt += "==============================================\n";
  receipt += "        DOMINAK 757 BUSINESS CENTRE        \n";
  receipt += "            XP-76C FORMAT FIX TEST         \n";
  receipt += "==============================================\n\n";

  // Date and time on same line to use full width
  const date = new Date().toLocaleDateString();
  const time = new Date().toLocaleTimeString();
  receipt += `Date: ${date}        Time: ${time}\n\n`;

  // Items with proper spacing for full width
  receipt += "Item Name              Qty   Price    Total\n";
  receipt += "----------------------------------------------\n";
  receipt += "Test Product 1           1   10.00    10.00\n";
  receipt += "Test Product 2           2    5.50    11.00\n";
  receipt += "Test Product 3           1   15.25    15.25\n";
  receipt += "----------------------------------------------\n";

  // Totals with proper right alignment
  receipt += "                        SUBTOTAL:    36.25\n";
  receipt += "                     TAX (12.5%):     4.53\n";
  receipt += "                           TOTAL:    40.78\n";
  receipt += "==============================================\n\n";

  // Footer using full width
  receipt += "        THANK YOU FOR YOUR BUSINESS        \n";
  receipt += "           Visit us again soon!            \n";
  receipt += "      Receipt #: 001 - Cashier: Admin      \n\n\n";

  return receipt;
}

// Test different character widths to find the optimal one
function testDifferentWidths() {
  console.log("=== FIXING XP-76C NARROW FORMAT ===\n");

  // Test 1: 46 characters wide (should use more of the paper)
  const width46Receipt = createWidth46Receipt();
  fs.writeFileSync("xp76c-width46.txt", width46Receipt);
  console.log("1. Created 46-character width test");

  // Test 2: 42 characters wide
  const width42Receipt = createWidth42Receipt();
  fs.writeFileSync("xp76c-width42.txt", width42Receipt);
  console.log("2. Created 42-character width test");

  // Test 3: Fixed format (optimized)
  const fixedReceipt = createFixedXP76CReceipt();
  fs.writeFileSync("xp76c-fixed.txt", fixedReceipt);
  console.log("3. Created optimized fixed format");

  // Test 4: Single line test to check maximum width
  const singleLineTest =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ\n".repeat(
      3
    );
  fs.writeFileSync("xp76c-maxwidth.txt", singleLineTest);
  console.log("4. Created maximum width test");

  console.log("\nSending all tests to XP-76C...");

  // Send all tests
  printToXP76C("xp76c-width46.txt", "46-character width");
  printToXP76C("xp76c-width42.txt", "42-character width");
  printToXP76C("xp76c-fixed.txt", "Optimized format");
  printToXP76C("xp76c-maxwidth.txt", "Maximum width test");
}

function createWidth46Receipt() {
  let receipt = "";
  receipt += "==============================================\n"; // 46 chars
  receipt += "       DOMINAK 757 BUSINESS CENTRE        \n";
  receipt += "           46-CHARACTER WIDTH TEST         \n";
  receipt += "==============================================\n\n";
  receipt += "Item                    Qty  Price   Total\n";
  receipt += "----------------------------------------------\n";
  receipt += "Test Product 1            1  10.00   10.00\n";
  receipt += "Test Product 2            2   5.50   11.00\n";
  receipt += "Test Product 3            1  15.25   15.25\n";
  receipt += "----------------------------------------------\n";
  receipt += "                      SUBTOTAL:      36.25\n";
  receipt += "                   TAX (12.5%):       4.53\n";
  receipt += "                         TOTAL:      40.78\n";
  receipt += "==============================================\n\n\n";
  return receipt;
}

function createWidth42Receipt() {
  let receipt = "";
  receipt += "==========================================\n"; // 42 chars
  receipt += "     DOMINAK 757 BUSINESS CENTRE      \n";
  receipt += "         42-CHARACTER WIDTH TEST       \n";
  receipt += "==========================================\n\n";
  receipt += "Item                  Qty Price  Total\n";
  receipt += "------------------------------------------\n";
  receipt += "Test Product 1          1 10.00  10.00\n";
  receipt += "Test Product 2          2  5.50  11.00\n";
  receipt += "Test Product 3          1 15.25  15.25\n";
  receipt += "------------------------------------------\n";
  receipt += "                    SUBTOTAL:    36.25\n";
  receipt += "                 TAX (12.5%):     4.53\n";
  receipt += "                       TOTAL:    40.78\n";
  receipt += "==========================================\n\n\n";
  return receipt;
}

function printToXP76C(filename, testName) {
  try {
    console.log(`\nTesting ${testName}...`);
    execSync(`Get-Content "${filename}" | Out-Printer -Name "XP-76C"`, {
      encoding: "utf8",
      shell: "powershell",
    });
    console.log(`✓ ${testName} sent to XP-76C`);
  } catch (error) {
    console.error(`✗ ${testName} failed:`, error.message);
  }
}

// Run the tests
testDifferentWidths();

console.log("\n=== CHECK YOUR XP-76C PRINTER ===");
console.log("You should see 4 different receipt formats.");
console.log("Tell me which one uses the full paper width!");
