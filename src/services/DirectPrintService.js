const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

class DirectPrintService {
  constructor() {
    this.printerPort = "USB001"; // XP-76C port
    this.fallbackPort = "LPT1:"; // XP-80C port
  }

  // Generate ESC/POS commands for thermal printer
  generateESCPOSCommands(receiptData) {
    const { sale, business } = receiptData;

    // ESC/POS command codes
    const ESC = String.fromCharCode(27);
    const GS = String.fromCharCode(29);

    let commands = "";

    // Initialize printer
    commands += ESC + "@"; // Initialize

    // Center align and bold for header
    commands += ESC + "a" + String.fromCharCode(1); // Center align
    commands += ESC + "E" + String.fromCharCode(1); // Bold on
    commands +=
      (business.business_name || "DOMINAK 757 BUSINESS CENTRE") + "\n";
    commands += ESC + "E" + String.fromCharCode(0); // Bold off

    // Business info
    commands += (business.business_address || "Accra, Ghana") + "\n";
    commands += `Tel: ${business.business_phone || "0549831901"}\n`;

    // Separator line
    commands += "===========\n";

    // Left align for receipt details
    commands += ESC + "a" + String.fromCharCode(0); // Left align

    // Receipt info
    commands += `Date: ${new Date(sale.created_at).toLocaleDateString()}\n`;
    commands += `Time: ${new Date(sale.created_at).toLocaleTimeString()}\n`;
    commands += `Cashier: ${sale.cashier_name || "System"}\n\n`;

    // Items header
    commands += "------\n";
    commands += "ITEM    QTY    PRICE\n";
    commands += "------\n";

    // Items
    if (sale.items && sale.items.length > 0) {
      sale.items.forEach((item) => {
        const name = (item.product_name || item.name || "Item")
          .substring(0, 16)
          .padEnd(16);
        const qty = (item.quantity || 0).toString().padStart(3);
        const total = item.total_price || item.total || 0;
        const price = `GH₵ ${total.toFixed(2)}`.padStart(8);
        commands += `${name} ${qty}    ${price}\n`;
      });
    }

    commands += "------\n";

    // Total
    commands += ESC + "E" + String.fromCharCode(1); // Bold on
    const totalAmount = sale.total_amount || 0;
    const totalLine = `TOTAL: GH₵ ${totalAmount.toFixed(2)}`.padStart(32);
    commands += totalLine + "\n";
    commands += ESC + "E" + String.fromCharCode(0); // Bold off

    // Payment info
    commands += `\nPayment: ${sale.payment_method || "CASH"}\n`;
    if (sale.amount_paid && sale.change_amount) {
      commands += `Paid: GH₵ ${(sale.amount_paid || 0).toFixed(2)}\n`;
      commands += `Change: GH₵ ${(sale.change_amount || 0).toFixed(2)}\n`;
    }

    // Footer
    commands += "\n------\n";
    commands += ESC + "a" + String.fromCharCode(1); // Center align
    commands += "Thank you for your business!\n";
    commands += "==========\n\n\n";

    // Cut paper (if supported)
    commands += GS + "V" + String.fromCharCode(1); // Partial cut

    return commands;
  }

  // Send raw data directly to printer port
  async sendRawToPrinter(data, port = null) {
    const targetPort = port || this.printerPort;

    try {
      // Create temporary file with raw ESC/POS data
      const tempFile = path.join(os.tmpdir(), `raw_print_${Date.now()}.prn`);

      // Write binary data
      fs.writeFileSync(tempFile, data, "binary");

      return new Promise((resolve) => {
        // Send raw data directly to printer port
        const command = `copy /B "${tempFile}" ${targetPort}`;

        exec(command, (error, stdout, stderr) => {
          // Clean up
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {}

          if (error) {
            console.log(`❌ Raw print to ${targetPort} failed:`, error.message);
            resolve({ success: false, error: error.message, port: targetPort });
          } else {
            console.log(`✅ Raw data sent to ${targetPort} successfully`);
            resolve({ success: true, port: targetPort });
          }
        });
      });
    } catch (error) {
      console.error("Raw print setup failed:", error);
      return { success: false, error: error.message };
    }
  }

  // Main print method
  async printReceipt(receiptData) {
    console.log("🖨️  Attempting direct thermal printer communication...");

    // Generate ESC/POS commands
    const escposData = this.generateESCPOSCommands(receiptData);

    // Try USB port first (XP-76C)
    let result = await this.sendRawToPrinter(escposData, "USB001");

    if (!result.success) {
      console.log("USB001 failed, trying LPT1...");
      // Try parallel port (XP-80C)
      result = await this.sendRawToPrinter(escposData, "LPT1:");
    }

    if (!result.success) {
      console.log("Both direct methods failed, trying alternative approach...");
      // Try alternative method with different command
      result = await this.alternativePrint(receiptData);
    }

    return result;
  }

  // Alternative printing method
  async alternativePrint(receiptData) {
    try {
      const textReceipt = this.generateTextReceipt(receiptData);
      const tempFile = path.join(os.tmpdir(), `alt_print_${Date.now()}.txt`);

      fs.writeFileSync(tempFile, textReceipt, "utf8");

      return new Promise((resolve) => {
        // Try direct echo to printer
        const command = `type "${tempFile}" > PRN`;

        exec(command, (error, stdout, stderr) => {
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {}

          if (error) {
            console.log("❌ Alternative print failed:", error.message);
            resolve({ success: false, error: "All print methods failed" });
          } else {
            console.log("✅ Alternative print method succeeded");
            resolve({ success: true, method: "alternative" });
          }
        });
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Generate plain text receipt
  generateTextReceipt(receiptData) {
    const { sale, business } = receiptData;

    let receipt = "\n";
    receipt += "==========\n";
    receipt += `${business.business_name || "DOMINAK 757 BUSINESS CENTRE"}\n`;
    receipt += `${business.business_address || "Accra, Ghana"}\n`;
    receipt += `Tel: ${business.business_phone || "0549831901"}\n`;
    receipt += "=======\n\n";

    const saleDate = sale.created_at || sale.sale_date || new Date();
    receipt += `Date: ${new Date(saleDate).toLocaleDateString()}\n`;
    receipt += `Time: ${new Date(saleDate).toLocaleTimeString()}\n`;
    receipt += `Cashier: ${sale.cashier_name || "System"}\n\n`;

    receipt += "------\n";
    receipt += "ITEM  QTY    PRICE\n";
    receipt += "------\n";

    if (sale.items && sale.items.length > 0) {
      sale.items.forEach((item) => {
        const name = (item.product_name || item.name || "Item")
          .substring(0, 16)
          .padEnd(16);
        const qty = (item.quantity || 0).toString().padStart(3);
        const total = item.total_price || item.total || 0;
        const price = `GH₵ ${total.toFixed(2)}`.padStart(8);
        receipt += `${name} ${qty}    ${price}\n`;
      });
    }

    receipt += "------\n";
    const totalAmount = sale.total_amount || 0;
    receipt += `TOTAL: GH₵ ${totalAmount.toFixed(2)}\n\n`;

    receipt += `Payment: ${sale.payment_method || "CASH"}\n`;
    if (sale.amount_paid && sale.change_amount) {
      receipt += `Paid: GH₵ ${(sale.amount_paid || 0).toFixed(2)}\n`;
      receipt += `Change: GH₵ ${(sale.change_amount || 0).toFixed(2)}\n`;
    }

    receipt += "\n------\n";
    receipt += "Thank you for your business!\n";
    receipt += "===========\n\n\n\n";

    return receipt;
  }

  // Test method
  async testPrint() {
    const testData = {
      sale: {
        id: "TEST-" + Date.now(),
        total_amount: 0.0,
        payment_method: "CASH",
        amount_paid: 0.0,
        change_amount: 0.0,
        created_at: new Date().toISOString(),
        cashier_name: "Test User",
        items: [
          {
            product_name: "Test Print",
            quantity: 1,
            total_price: 0.0,
          },
        ],
      },
      business: {
        business_name: "DOMINAK 757 BUSINESS CENTRE",
        business_address: "Accra, Ghana",
        business_phone: "0549831901",
      },
    };

    return await this.printReceipt(testData);
  }
}

module.exports = DirectPrintService;
