class ReceiptFormatterService {
  constructor() {
    // Printer width configurations (characters per line)
    this.printerConfigs = {
      "58mm": { width: 32, name: "58mm" },
      "76mm": { width: 42, name: "76mm" },
      "80mm": { width: 48, name: "80mm" },
    };
  }

  detectPrinterConfig(printerName) {
    // Detect printer type based on name
    if (printerName && printerName.includes("XP-90")) {
      return this.printerConfigs["58mm"];
    } else if (printerName && printerName.includes("XP-76")) {
      return this.printerConfigs["76mm"];
    } else if (printerName && printerName.includes("XP-80")) {
      return this.printerConfigs["80mm"];
    }

    // Default to 58mm for most thermal printers
    return this.printerConfigs["58mm"];
  }

  formatReceipt(receiptData, printerConfig, useEscPos = false) {
    const { sale, business } = receiptData;
    const width = printerConfig.width || 32;

    let receipt = "";

    // Header
    receipt += this.centerText("DOMINAK 757 BUSINESS CENTRE", width) + "\n";
    receipt += this.centerText("RECEIPT", width) + "\n";
    receipt += "=".repeat(width) + "\n";

    // Receipt details
    receipt +=
      this.formatLine(
        "Date:",
        new Date(sale.sale_date).toLocaleDateString(),
        width
      ) + "\n";
    receipt +=
      this.formatLine(
        "Time:",
        new Date(sale.sale_date).toLocaleTimeString(),
        width
      ) + "\n";
    receipt +=
      this.formatLine("Cashier:", sale.username || "Admin", width) + "\n";
    receipt += "------\n";

    // Items
    receipt += "ITEMS:\n";
    sale.items.forEach((item) => {
      const itemName = this.truncateText(item.product_name, width - 8);
      receipt += `${itemName}\n`;
      receipt +=
        this.formatLine(
          `${item.quantity} x GHS${item.unit_price.toFixed(2)}`,
          `GHS${item.total_price.toFixed(2)}`,
          width
        ) + "\n";
    });

    receipt += "------\n";

    // Totals
    receipt +=
      this.formatLine("TOTAL:", `GHS${sale.total_amount.toFixed(2)}`, width) +
      "\n";
    receipt +=
      this.formatLine("Payment:", sale.payment_method || "Cash", width) + "\n";

    receipt += "=".repeat(width) + "\n";
    receipt += this.centerText("Thank you for your business!", width) + "\n";
    receipt += this.centerText("Please come again!", width) + "\n";
    receipt += "\n\n\n"; // Extra spacing for cut

    return receipt;
  }

  centerText(text, width) {
    if (text.length >= width) return text.substring(0, width);
    const padding = Math.floor((width - text.length) / 2);
    return (
      " ".repeat(padding) + text + " ".repeat(width - text.length - padding)
    );
  }

  formatLine(left, right, width) {
    const rightStr = right.toString();
    const availableWidth = width - rightStr.length;
    const leftStr =
      left.length > availableWidth ? left.substring(0, availableWidth) : left;
    const padding = width - leftStr.length - rightStr.length;
    return leftStr + " ".repeat(Math.max(0, padding)) + rightStr;
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }
}

module.exports = ReceiptFormatterService;
