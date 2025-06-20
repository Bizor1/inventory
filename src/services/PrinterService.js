const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const DirectPrintService = require("./DirectPrintService");
const ReceiptFormatterService = require("./ReceiptFormatterService");

// Try to load escpos modules, but don't fail if they're not available
let escpos, escposUSB;
try {
  escpos = require("escpos");
  escposUSB = require("escpos-usb");
  escpos.USB = escposUSB;
} catch (error) {
  console.log("ESC/POS modules not available, using system printing fallback");
}

class PrinterService {
  constructor() {
    this.printer = null;
    this.device = null;
    this.isConnected = false;
    // Skip DirectPrintService to avoid undefined errors - use Windows native printing instead
    // this.directPrintService = new DirectPrintService();
    this.receiptFormatter = new ReceiptFormatterService();
  }

  async connectPrinter() {
    try {
      // Find USB thermal printer
      const devices = escpos.USB.findPrinter();

      if (devices.length === 0) {
        console.log("No USB thermal printers found");
        return false;
      }

      // Use the first available printer - handle both direct and descriptor properties
      const device = devices[0];
      const vendorId = device.vendorId || device.deviceDescriptor?.idVendor;
      const productId = device.productId || device.deviceDescriptor?.idProduct;

      if (!vendorId || !productId) {
        console.log("Invalid device IDs detected");
        return false;
      }

      this.device = new escpos.USB(vendorId, productId);
      this.printer = new escpos.Printer(this.device);

      console.log("Thermal printer connected:", devices[0]);
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error("Failed to connect to printer:", error);
      this.isConnected = false;
      return false;
    }
  }

  async printReceipt(receiptData) {
    try {
      const { sale, business } = receiptData;

      console.log("🖨️  Printing receipt using Notepad method ONLY...");

      // Use ONLY the notepad printing method you provided
      const notepadResult = await this.printUsingNotepad(receiptData);
      if (notepadResult.success) {
        console.log("✅ Receipt printed via Notepad");
        return notepadResult;
      }

      // If notepad fails, log to console as fallback
      console.log("❌ Notepad printing failed");
      console.log("⚠️  Showing receipt in console:");
      const receiptText = this.createReceiptForNotepad(receiptData);
      console.log("RECEIPT CONTENT:");
      console.log(receiptText);

      return {
        success: false,
        fallback: true,
        message: "Notepad printing failed. Receipt logged to console.",
        error: notepadResult.error,
      };
    } catch (error) {
      console.error("Print receipt error:", error);
      return { success: false, error: error.message };
    }
  }

  async printToSystemPrinter(receiptData) {
    try {
      const { sale, business } = receiptData;

      // Use enhanced receipt formatter with proper ASCII formatting
      const detectedPrinterType =
        this.receiptFormatter.detectPrinterConfig("XP-90"); // XP-90 is 58mm printer
      const receiptText = this.receiptFormatter.formatReceipt(
        receiptData,
        detectedPrinterType,
        false
      ); // No ESC/POS for system printing

      // Use Windows native printing (like test page) for full width output
      return await this.printUsingWindowsNative(receiptText);
    } catch (error) {
      console.error("System printer error:", error);
      return { success: false, error: error.message };
    }
  }

  async printUsingWindowsNative(receiptText) {
    console.log("🖨️  Using Windows Native Printing (like test page)...");

    try {
      // Create temp file in Windows temp directory
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `receipt_${Date.now()}.txt`);

      // Write receipt with proper Windows line endings for full compatibility
      const windowsText = receiptText.replace(/\n/g, "\r\n");
      fs.writeFileSync(tempFile, windowsText, "utf8");

      console.log(`📄 Created temp file: ${tempFile}`);

      // Method 1: Use notepad.exe to print (this uses full Windows printing system)
      return new Promise((resolve) => {
        console.log("🔄 Using Notepad print system (same as test page)...");

        const notepadCommand = `notepad.exe /p "${tempFile}"`;

        exec(notepadCommand, (error, stdout, stderr) => {
          // Clean up temp file
          try {
            fs.unlinkSync(tempFile);
          } catch (cleanupError) {
            console.log("Failed to cleanup temp file:", cleanupError.message);
          }

          if (error) {
            console.log("❌ Notepad method failed, trying PowerShell...");
            this.printUsingPowerShellNative(receiptText).then(resolve);
          } else {
            console.log("✅ Windows native print successful!");
            resolve({
              success: true,
              message:
                "Receipt printed via Windows native printing (full width)",
            });
          }
        });
      });
    } catch (error) {
      console.error("❌ Windows native printing error:", error);
      return { success: false, error: error.message };
    }
  }

  async printUsingPowerShellNative(receiptData) {
    console.log("🔄 Using PowerShell Add-PrinterJob...");

    try {
      const { sale, business } = receiptData;
      const receiptText = this.receiptFormatter.formatReceipt(
        receiptData,
        this.receiptFormatter.detectPrinterConfig("XP-90"),
        false
      );

      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `receipt_ps_${Date.now()}.txt`);

      // Write with Windows line endings
      const windowsText = receiptText.replace(/\n/g, "\r\n");
      fs.writeFileSync(tempFile, windowsText, "utf8");

      // Use Add-PrinterJob cmdlet (Windows native printing API)
      const psCommand = `Add-PrinterJob -PrinterName "XP-90" -Path "${tempFile}"`;

      return new Promise((resolve) => {
        exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
          // Clean up
          try {
            fs.unlinkSync(tempFile);
          } catch (cleanupError) {
            console.log("Failed to cleanup PowerShell temp file");
          }

          if (error) {
            console.log("❌ PowerShell printing failed:", error.message);
            resolve({ success: false, error: error.message });
          } else {
            console.log("✅ PowerShell printing successful!");
            resolve({
              success: true,
              message: "Receipt printed via PowerShell API",
            });
          }
        });
      });
    } catch (error) {
      console.error("❌ PowerShell printing error:", error);
      return { success: false, error: error.message };
    }
  }

  async printToPhysicalPrinter(receiptData) {
    try {
      // Try to connect if not already connected
      if (!this.isConnected) {
        const connected = await this.connectPrinter();
        if (!connected) {
          return { success: false, error: "No thermal printer found" };
        }
      }

      const { sale, business } = receiptData;

      return new Promise((resolve, reject) => {
        this.device.open((error) => {
          if (error) {
            console.error("Failed to open printer:", error);
            resolve({
              success: false,
              error: "Failed to open printer connection",
            });
            return;
          }

          try {
            // Use enhanced receipt formatter with ESC/POS commands
            const receiptWithEscPos = this.receiptFormatter.formatReceipt(
              receiptData,
              "58mm",
              true
            );

            // Send the formatted receipt directly to the printer
            this.printer
              .raw(Buffer.from(receiptWithEscPos, "binary"))
              .close(() => {
                console.log("Receipt printed to thermal printer successfully");
                resolve({
                  success: true,
                  message:
                    "Receipt printed successfully with enhanced formatting",
                });
              });
          } catch (printError) {
            console.error("Printing error:", printError);
            this.device.close();
            resolve({ success: false, error: "Failed to print receipt" });
          }
        });
      });
    } catch (error) {
      console.error("Physical printer error:", error);
      return { success: false, error: error.message };
    }
  }

  formatReceiptText(sale, business) {
    const width = 32;
    const line = "=".repeat(width);
    const halfLine = "------";

    let receipt = "";

    // Header
    receipt +=
      this.centerText(
        business.business_name || "DOMINAK 757 BUSINESS CENTRE",
        width
      ) + "\n";
    receipt +=
      this.centerText(business.business_address || "Ghana", width) + "\n";
    receipt +=
      this.centerText(
        `Tel: ${business.business_phone || "0549831901"}`,
        width
      ) + "\n";
    receipt += line + "\n";

    // Sale info
    receipt += `Date: ${new Date(sale.sale_date).toLocaleString()}\n`;
    receipt += `Cashier: ${sale.cashier_name}\n`;
    receipt += halfLine + "\n";

    // Items
    receipt += "ITEMS:\n";
    sale.items.forEach((item) => {
      const itemLine = `${item.product_name} x${item.quantity}`;
      const price = `${business.currency || "GHS"} ${item.total_price.toFixed(
        2
      )}`;
      receipt += this.formatLine(itemLine, price, width) + "\n";
    });

    receipt += halfLine + "\n";

    // Total
    const totalLine = `TOTAL: ${
      business.currency || "GHS"
    } ${sale.total_amount.toFixed(2)}`;
    receipt += this.centerText(totalLine, width) + "\n";
    receipt += `Payment: ${sale.payment_method.toUpperCase()}\n`;

    receipt += line + "\n";
    receipt +=
      this.centerText(
        business.receipt_footer || "Thank you for your business!",
        width
      ) + "\n";
    receipt += line + "\n";

    return receipt;
  }

  centerText(text, width) {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(padding) + text;
  }

  formatLine(left, right, width) {
    const maxLeftWidth = width - right.length - 1;
    const leftText =
      left.length > maxLeftWidth ? left.substring(0, maxLeftWidth) : left;
    const padding = width - leftText.length - right.length;
    return leftText + " ".repeat(Math.max(1, padding)) + right;
  }

  async testPrinter() {
    try {
      console.log("Testing printer connection...");

      // First, try to detect available printers
      const printerStatus = await this.detectPrinters();
      console.log("Printer detection result:", printerStatus);

      const testReceipt = {
        sale: {
          receipt_number: "TEST001",
          sale_date: new Date(),
          cashier_name: "Test User",
          total_amount: 10.0,
          payment_method: "cash",
          items: [
            {
              product_name: "Test Product",
              quantity: 1,
              total_price: 10.0,
            },
          ],
        },
        business: {
          business_name: "DOMINAK 757 BUSINESS CENTRE",
          business_address: "Ghana",
          business_phone: "0549831901",
          currency: "GHS",
          receipt_footer: "Thank you for your business!",
        },
      };

      const result = await this.printReceipt(testReceipt);

      if (result.fallback) {
        return {
          success: true,
          message:
            "Test completed - No physical printer detected. Receipt printed to console.",
          details: printerStatus,
        };
      }

      return result;
    } catch (error) {
      console.error("Test printer error:", error);
      return { success: false, error: error.message };
    }
  }

  async detectPrinters() {
    try {
      // First check for system printers
      const systemPrinters = await this.getSystemPrinters();

      // Then check for USB ESC/POS printers if available
      let devices = [];
      if (escpos && escposUSB) {
        try {
          devices = escpos.USB.findPrinter();
        } catch (error) {
          console.log("ESC/POS USB detection failed:", error.message);
        }
      }

      if (devices.length === 0 && systemPrinters.length === 0) {
        return {
          found: false,
          message: "No printers detected",
          suggestion:
            "Please ensure your printer is connected and drivers are installed. For thermal printers, connect via USB.",
        };
      }

      if (systemPrinters.length > 0 && devices.length === 0) {
        return {
          found: true,
          count: systemPrinters.length,
          workingCount: systemPrinters.length,
          printers: systemPrinters.map((printer) => ({
            name: printer,
            type: "System Printer",
            status: "Available via Windows",
          })),
          message: `Found ${systemPrinters.length} system printer(s)`,
          suggestion: null,
        };
      }

      // Test actual connection to each detected device
      const workingPrinters = [];

      for (const device of devices) {
        const vendorId = device.vendorId || device.deviceDescriptor?.idVendor;
        const productId =
          device.productId || device.deviceDescriptor?.idProduct;

        const testResult = await this.testDeviceConnection(device);
        if (testResult.working) {
          workingPrinters.push({
            vendorId: vendorId,
            productId: productId,
            manufacturer: device.manufacturer || "Unknown",
            product: device.product || "Thermal Printer",
            status: "Connected and working",
          });
        } else {
          workingPrinters.push({
            vendorId: vendorId,
            productId: productId,
            manufacturer: device.manufacturer || "Unknown",
            product: device.product || "Thermal Printer",
            status: `Not working: ${testResult.error}`,
          });
        }
      }

      const workingCount = workingPrinters.filter((p) =>
        p.status.includes("working")
      ).length;

      return {
        found: workingCount > 0,
        count: devices.length,
        workingCount: workingCount,
        printers: workingPrinters,
        message:
          workingCount > 0
            ? `Found ${workingCount} working thermal printer(s) out of ${devices.length} detected`
            : `Found ${devices.length} USB device(s) but none are working thermal printers`,
        suggestion:
          workingCount === 0
            ? "Detected USB devices but cannot connect to them. Please check: 1) Printer is powered on, 2) USB cable is working, 3) Printer drivers are installed, 4) Printer is not in use by another application"
            : null,
      };
    } catch (error) {
      return {
        found: false,
        error: error.message,
        message: "Error detecting printers",
      };
    }
  }

  async getSystemPrinters() {
    return new Promise((resolve) => {
      // Use Windows wmic command to list available printers
      exec("wmic printer get name", (error, stdout, stderr) => {
        if (error) {
          console.log("Failed to get system printers:", error.message);
          resolve([]);
          return;
        }

        try {
          // Parse the output to get printer names
          const lines = stdout
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && line !== "Name");
          resolve(lines);
        } catch (parseError) {
          console.log("Failed to parse printer list:", parseError.message);
          resolve([]);
        }
      });
    });
  }

  async testDeviceConnection(device) {
    return new Promise((resolve) => {
      try {
        const vendorId = device.vendorId || device.deviceDescriptor?.idVendor;
        const productId =
          device.productId || device.deviceDescriptor?.idProduct;

        const testDevice = new escpos.USB(vendorId, productId);

        // Set a timeout for the connection test
        const timeout = setTimeout(() => {
          resolve({ working: false, error: "Connection timeout" });
        }, 3000); // 3 second timeout

        testDevice.open((error) => {
          clearTimeout(timeout);

          if (error) {
            resolve({
              working: false,
              error: error.message || "Cannot open device",
            });
            return;
          }

          // If we can open the device, try to close it immediately
          try {
            testDevice.close(() => {
              resolve({ working: true });
            });
          } catch (closeError) {
            resolve({ working: true }); // Device opened successfully, even if close failed
          }
        });
      } catch (error) {
        resolve({
          working: false,
          error: error.message || "Device connection failed",
        });
      }
    });
  }

  // Method 1: Direct USB Communication
  async printDirectToUSB(receiptData) {
    try {
      console.log("🔍 Checking for direct USB printer access...");

      const receiptText = this.receiptFormatter.formatReceipt(
        receiptData,
        this.receiptFormatter.detectPrinterConfig("XP-90"),
        true // Use ESC/POS commands
      );

      // Try direct communication with USB thermal printer
      const ports = ["USB001", "USB002", "USB003"];
      let successCount = 0;

      for (const port of ports) {
        try {
          console.log(`🔍 Trying USB port: ${port}...`);
          const result = await this.sendToPort(receiptText, port);
          if (result.success) {
            console.log(`✅ USB port ${port} responded successfully`);
            successCount++;
            // Wait a moment to see if printer actually prints
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return {
              success: true,
              message: `Printed via direct USB (${port})`,
            };
          } else {
            console.log(`❌ USB port ${port} failed: ${result.error}`);
          }
        } catch (error) {
          console.log(`❌ USB port ${port} exception:`, error.message);
        }
      }

      if (successCount === 0) {
        console.log("❌ No USB ports responded - direct USB method failed");
        return { success: false, error: "No USB ports responded" };
      } else {
        console.log("⚠️ USB ports responded but printing may have failed");
        return { success: false, error: "USB communication unclear" };
      }
    } catch (error) {
      console.error("❌ Direct USB method error:", error);
      return { success: false, error: error.message };
    }
  }

  // Method 4: Raw File Copy to Printer Port
  async printViaRawCopy(receiptData) {
    try {
      const receiptText = this.receiptFormatter.formatReceipt(
        receiptData,
        this.receiptFormatter.detectPrinterConfig("XP-90"),
        false
      );

      const tempFile = path.join(os.tmpdir(), `receipt_raw_${Date.now()}.txt`);
      fs.writeFileSync(tempFile, receiptText, "utf8");

      // Try copying directly to printer ports
      const ports = ["PRN", "LPT1:", "USB001"];

      for (const port of ports) {
        try {
          const result = await this.copyToPort(tempFile, port);
          if (result.success) {
            fs.unlinkSync(tempFile);
            return {
              success: true,
              message: `Printed via raw copy to ${port}`,
            };
          }
        } catch (error) {
          console.log(`Raw copy to ${port} failed:`, error.message);
        }
      }

      fs.unlinkSync(tempFile);
      return { success: false, error: "All raw copy methods failed" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Method 5: Windows Print Spooler
  async printViaWindowsSpooler(receiptData) {
    try {
      const receiptText = this.receiptFormatter.formatReceipt(
        receiptData,
        this.receiptFormatter.detectPrinterConfig("XP-90"),
        false
      );

      const tempFile = path.join(
        os.tmpdir(),
        `receipt_spooler_${Date.now()}.txt`
      );
      fs.writeFileSync(tempFile, receiptText, "utf8");

      // Use Windows print command
      const printCommand = `print "${tempFile}"`;

      return new Promise((resolve) => {
        exec(printCommand, (error, stdout, stderr) => {
          try {
            fs.unlinkSync(tempFile);
          } catch (cleanupError) {
            console.log("Failed to cleanup spooler temp file");
          }

          if (error) {
            resolve({ success: false, error: error.message });
          } else {
            resolve({
              success: true,
              message: "Receipt printed via Windows print spooler",
            });
          }
        });
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Helper method to send data to specific port
  async sendToPort(data, port) {
    return new Promise((resolve) => {
      const tempFile = path.join(os.tmpdir(), `port_${Date.now()}.prn`);

      try {
        fs.writeFileSync(tempFile, data, "utf8");
        console.log(`📄 Created temp file for ${port}: ${tempFile}`);
      } catch (writeError) {
        console.log(
          `❌ Failed to create temp file for ${port}:`,
          writeError.message
        );
        resolve({
          success: false,
          error: `File write failed: ${writeError.message}`,
        });
        return;
      }

      const command = `copy "${tempFile}" ${port}`;
      console.log(`🔄 Executing: ${command}`);

      exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
        // Always try to cleanup temp file
        try {
          fs.unlinkSync(tempFile);
          console.log(`🗑️ Cleaned up temp file: ${tempFile}`);
        } catch (cleanupError) {
          console.log(
            `⚠️ Failed to cleanup temp file: ${cleanupError.message}`
          );
        }

        if (error) {
          console.log(`❌ Copy command failed for ${port}:`, error.message);
          console.log(`❌ stderr:`, stderr);
          resolve({ success: false, error: error.message });
        } else {
          console.log(`✅ Copy command succeeded for ${port}`);
          console.log(`📤 stdout:`, stdout);
          // Check if the output indicates success
          if (stdout && stdout.includes("1 file(s) copied")) {
            resolve({ success: true, port: port });
          } else {
            console.log(`⚠️ Copy command completed but unclear if successful`);
            resolve({
              success: false,
              error: "Copy completed but unclear result",
            });
          }
        }
      });
    });
  }

  // Helper method to copy file to port
  async copyToPort(filePath, port) {
    return new Promise((resolve) => {
      const command = `copy "${filePath}" ${port}`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true, port: port });
        }
      });
    });
  }

  // NEW METHOD: Notepad Printing
  async printUsingNotepad(receiptData) {
    console.log("🔄 Using Notepad printing method...");

    try {
      const { sale, business } = receiptData;

      // Create receipt content using same format as the provided script
      const receiptContent = this.createReceiptForNotepad(receiptData);

      const tempDir = os.tmpdir();
      const filename = path.join(tempDir, `receipt_${Date.now()}.txt`);

      // Save receipt to temporary file
      fs.writeFileSync(filename, receiptContent, "utf8");

      console.log("📄 Receipt file created: " + filename);
      console.log("🖨️  Sending to printer...");

      return new Promise((resolve) => {
        // First try the Windows print command
        exec(`print "${filename}"`, (error, stdout, stderr) => {
          // Check for common print failures even when no error is thrown
          const output = (stdout + stderr).toLowerCase();
          const hasPrintError =
            error ||
            output.includes("unable to initialize") ||
            output.includes("printer not found") ||
            output.includes("no default printer") ||
            output.includes("access denied") ||
            output.includes("printer offline");

          if (hasPrintError) {
            console.log("❌ Windows print command failed or had issues");
            if (error) console.log("Error:", error.message);
            if (stdout) console.log("Output:", stdout);
            if (stderr) console.log("Stderr:", stderr);
            console.log("💡 Trying notepad /p method...");

            // Alternative method - open with notepad and print
            exec(`notepad /p "${filename}"`, (error2, stdout2, stderr2) => {
              // Clean up temp file
              try {
                fs.unlinkSync(filename);
              } catch (cleanupError) {
                console.log("Failed to cleanup notepad temp file");
              }

              if (error2) {
                console.log("❌ Notepad print error:", error2.message);
                resolve({
                  success: false,
                  error: `Both print methods failed: ${
                    error?.message || "Print command issues"
                  }, ${error2.message}`,
                });
              } else {
                console.log("📝 Notepad print dialog opened successfully");
                resolve({
                  success: true,
                  message: "Receipt sent to Notepad for printing",
                });
              }
            });
          } else {
            // Clean up temp file
            try {
              fs.unlinkSync(filename);
            } catch (cleanupError) {
              console.log("Failed to cleanup print temp file");
            }

            if (stderr) {
              console.log("⚠️  Print warning:", stderr);
            }
            console.log("✅ Sent to printer successfully!");
            console.log("📝 Output:", stdout);
            resolve({
              success: true,
              message: "Receipt printed via Windows print command",
            });
          }
        });
      });
    } catch (error) {
      console.error("❌ Notepad printing error:", error);
      return { success: false, error: error.message };
    }
  }

  // Create receipt content for notepad printing (same format as provided script)
  createReceiptForNotepad(receiptData) {
    const { sale, business } = receiptData;

    // Calculate totals
    let itemCount = 0;
    let totalAmount = 0;

    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach((item) => {
        itemCount += item.quantity || 0;
        totalAmount += item.total_price || 0;
      });
    } else {
      totalAmount = sale.total_amount || 0;
    }

    const receipt = [
      "===============",
      "      DOMINAK 757 BUSINESS CENTRE",
      "=================",
      "Date: " +
        new Date(sale.sale_date || sale.created_at).toLocaleDateString() +
        " " +
        new Date(sale.sale_date || sale.created_at).toLocaleTimeString(),
      "Cashier: " + (sale.cashier_name || sale.username || "Admin"),
      "------------------",
      "",
    ];

    // Add items
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach((item) => {
        const itemLine = `${item.product_name || item.name} x${
          item.quantity || 1
        } GHS ${(item.total_price || 0).toFixed(2)}`;
        receipt.push(itemLine);
      });
    } else {
      receipt.push("Sale items not available");
    }

    receipt.push(
      "",
      "---------------------",
      `TOTAL:                            GHS ${totalAmount.toFixed(2)}`,
      `Payment: ${sale.payment_method || "Cash"}`,
      "===================",
      "",
      "     Thank you for your business!",
      "          Please come again",
      "-------------------",
      "    Printed: " +
        new Date().toLocaleDateString() +
        " " +
        new Date().toLocaleTimeString(),
      "",
      "",
      "" // Extra blank lines for paper feed
    );

    return receipt.join("\n");
  }
}

module.exports = PrinterService;
