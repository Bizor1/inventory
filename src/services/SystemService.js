const { v4: uuidv4 } = require("uuid");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const XLSX = require("xlsx");
const { dialog } = require("electron");

class SystemService {
  constructor(db) {
    this.db = db;
    this.backupDir = path.join(os.homedir(), "Desktop", "DOMINAK-757-Backups");
  }

  async ensureBackupDir() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.error("Error creating backup directory:", error);
    }
  }

  async backup(mainWindow) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFileName = `DOMINAK-757-Backup-${timestamp}.db`;

      // Let user choose save location
      const saveResult = await dialog.showSaveDialog(mainWindow, {
        title: "Save Database Backup",
        defaultPath: path.join(os.homedir(), "Desktop", backupFileName),
        filters: [
          { name: "Database Backup", extensions: ["db"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (saveResult.canceled) {
        return { success: false, error: "Backup cancelled by user" };
      }

      const backupPath = saveResult.filePath;

      // Copy the database file
      const dbPath = path.join(process.cwd(), "data", "dominak757.db");
      await fs.copyFile(dbPath, backupPath);

      // Create a user-friendly info file alongside the backup
      const infoFileName = backupPath.replace(".db", "-INFO.txt");
      const infoContent = `
DOMINAK 757 BUSINESS CENTRE - Database Backup
============================================

Backup Date: ${new Date().toLocaleString()}
Original Database: dominak757.db
Backup File: ${path.basename(backupPath)}
File Size: ${this.formatFileSize((await fs.stat(backupPath)).size)}

IMPORTANT INFORMATION:
- This is a complete backup of your business data
- Keep this file in a safe location
- To restore, use the "Restore Backup" option in settings
- Never edit this file manually

Business: DOMINAK 757 BUSINESS CENTRE
System Version: 1.0.0
      `.trim();

      await fs.writeFile(infoFileName, infoContent);

      const stats = await fs.stat(backupPath);

      return {
        success: true,
        message: "Backup created successfully",
        data: {
          backup_path: backupPath,
          backup_filename: path.basename(backupPath),
          backup_size: this.formatFileSize(stats.size),
          info_file: infoFileName,
          created_at: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("Backup error:", error);
      return { success: false, error: error.message };
    }
  }

  async restore(backupPath) {
    try {
      // Verify backup file exists
      await fs.access(backupPath);

      const dbPath = path.join(process.cwd(), "data", "dominak757.db");
      const backupDbPath = `${dbPath}.backup.${Date.now()}`;

      // Create backup of current database
      await fs.copyFile(dbPath, backupDbPath);

      try {
        // Restore from backup
        await fs.copyFile(backupPath, dbPath);

        return {
          success: true,
          message: "Database restored successfully",
          data: {
            restored_from: backupPath,
            current_backup: backupDbPath,
          },
        };
      } catch (error) {
        // Restore original database if restore failed
        await fs.copyFile(backupDbPath, dbPath);
        throw error;
      }
    } catch (error) {
      console.error("Restore error:", error);
      return { success: false, error: error.message };
    }
  }

  async getSettings() {
    try {
      const settings = await this.db.allQuery("SELECT * FROM settings");

      const settingsObj = {};
      settings.forEach((setting) => {
        settingsObj[setting.setting_key] = setting.setting_value;
      });

      // Default settings if none exist
      const defaultSettings = {
        business_name: "DOMINAK 757 BUSINESS CENTRE",
        business_phone: "0549831901",
        business_address: "Ghana",
        currency: "GHS",
        date_format: "DD/MM/YYYY",
        receipt_footer: "Thank you for your business!",
        low_stock_threshold: "5",
        session_timeout: "30",
        auto_backup: "true",
        backup_frequency: "daily",
        printer_width: "80mm",
        tax_rate: "0",
        ...settingsObj,
      };

      return {
        success: true,
        data: defaultSettings,
      };
    } catch (error) {
      console.error("Get settings error:", error);
      return { success: false, error: error.message };
    }
  }

  async updateSettings(settings) {
    try {
      await this.db.beginTransaction();

      try {
        for (const [key, value] of Object.entries(settings)) {
          await this.db.runQuery(
            `INSERT OR REPLACE INTO settings (setting_key, setting_value, updated_at) 
             VALUES (?, ?, CURRENT_TIMESTAMP)`,
            [key, value.toString()]
          );
        }

        await this.db.commitTransaction();

        return {
          success: true,
          message: "Settings updated successfully",
        };
      } catch (error) {
        await this.db.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      console.error("Update settings error:", error);
      return { success: false, error: error.message };
    }
  }

  async exportData(type, mainWindow) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      let data;
      let filename;
      let sheetName;

      // Get data based on type
      switch (type) {
        case "products":
          data = await this.db.allQuery(`
            SELECT 
              p.product_name as "Product Name",
              c.category_name as "Category",
              p.barcode as "Barcode",
              p.stock_quantity as "Current Stock",
              p.minimum_stock as "Minimum Stock",
              p.purchase_price as "Purchase Price (GHS)",
              p.selling_price as "Selling Price (GHS)",
              CASE 
                WHEN p.stock_quantity <= p.minimum_stock THEN 'Low Stock'
                ELSE 'In Stock'
              END as "Stock Status",
              p.created_at as "Date Added"
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.category_id
            ORDER BY p.product_name
          `);
          filename = `DOMINAK-757-Products-${timestamp}.xlsx`;
          sheetName = "Products & Inventory";
          break;

        case "sales":
          data = await this.db.allQuery(`
            SELECT 
              s.receipt_number as "Receipt Number",
              DATE(s.sale_date) as "Date",
              TIME(s.sale_date) as "Time",
              u.username as "Cashier",
              s.total_amount as "Total Amount (GHS)",
              s.payment_method as "Payment Method",
              GROUP_CONCAT(
                p.product_name || ' (Qty: ' || si.quantity || ')'
              ) as "Items Sold"
            FROM sales s
            JOIN users u ON s.user_id = u.user_id
            LEFT JOIN sale_items si ON s.sale_id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.product_id
            GROUP BY s.sale_id
            ORDER BY s.sale_date DESC
          `);
          filename = `DOMINAK-757-Sales-${timestamp}.xlsx`;
          sheetName = "Sales Report";
          break;

        case "inventory":
          data = await this.db.allQuery(`
            SELECT 
              p.product_name as "Product Name",
              it.transaction_type as "Transaction Type",
              it.quantity_changed as "Quantity Changed",
              it.reason as "Reason",
              it.created_at as "Date & Time",
              u.username as "User"
            FROM inventory_transactions it
            JOIN products p ON it.product_id = p.product_id
            LEFT JOIN users u ON it.user_id = u.user_id
            ORDER BY it.created_at DESC
          `);
          filename = `DOMINAK-757-Inventory-Transactions-${timestamp}.xlsx`;
          sheetName = "Inventory History";
          break;

        case "users":
          data = await this.db.allQuery(`
            SELECT 
              username as "Username",
              role as "Role",
              CASE 
                WHEN is_active = 1 THEN 'Active'
                ELSE 'Inactive'
              END as "Status",
              created_at as "Date Created",
              last_login as "Last Login"
            FROM users
            ORDER BY username
          `);
          filename = `DOMINAK-757-Users-${timestamp}.xlsx`;
          sheetName = "Users";
          break;

        default:
          return { success: false, error: "Invalid export type" };
      }

      // Let user choose save location
      const saveResult = await dialog.showSaveDialog(mainWindow, {
        title: `Save ${type} Export`,
        defaultPath: path.join(os.homedir(), "Desktop", filename),
        filters: [
          { name: "Excel Files", extensions: ["xlsx"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (saveResult.canceled) {
        return { success: false, error: "Export cancelled by user" };
      }

      const exportPath = saveResult.filePath;

      // Create Excel workbook
      const workbook = XLSX.utils.book_new();

      // Convert data to worksheet
      const worksheet = XLSX.utils.json_to_sheet(data);

      // Add some styling (column widths)
      const columnWidths = [];
      if (data.length > 0) {
        Object.keys(data[0]).forEach((key) => {
          const maxLength = Math.max(
            key.length,
            ...data.map((row) => String(row[key] || "").length)
          );
          columnWidths.push({ wch: Math.min(maxLength + 2, 50) });
        });
      }
      worksheet["!cols"] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Write the file
      XLSX.writeFile(workbook, exportPath);

      return {
        success: true,
        message: `${type} data exported successfully`,
        data: {
          export_path: exportPath,
          filename: path.basename(exportPath),
          record_count: data.length,
          file_size: (await fs.stat(exportPath)).size,
        },
      };
    } catch (error) {
      console.error("Export data error:", error);
      return { success: false, error: error.message };
    }
  }

  async getSystemInfo() {
    try {
      // Database statistics
      const dbStats = await this.db.getQuery(`
        SELECT 
          (SELECT COUNT(*) FROM products) as total_products,
          (SELECT COUNT(*) FROM sales) as total_sales,
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM categories) as total_categories,
          (SELECT COUNT(*) FROM inventory_transactions) as total_transactions
      `);

      // Database size
      const dbPath = path.join(process.cwd(), "data", "dominak757.db");
      let dbSize = 0;
      try {
        const stats = await fs.stat(dbPath);
        dbSize = stats.size;
      } catch (error) {
        console.log("Could not get database size:", error.message);
      }

      // Recent activity
      const recentSales = await this.db.getQuery(`
        SELECT COUNT(*) as count 
        FROM sales 
        WHERE sale_date >= date('now', '-7 days')
      `);

      const recentInventoryChanges = await this.db.getQuery(`
        SELECT COUNT(*) as count 
        FROM inventory_transactions 
        WHERE created_at >= date('now', '-7 days')
      `);

      // Backup information
      let backupInfo = { count: 0, latest: null };
      try {
        await this.ensureBackupDir();
        const backupFiles = await fs.readdir(this.backupDir);
        const dbBackups = backupFiles.filter((file) => file.endsWith(".db"));

        if (dbBackups.length > 0) {
          backupInfo.count = dbBackups.length;
          const latestBackup = dbBackups.sort().reverse()[0];
          const backupPath = path.join(this.backupDir, latestBackup);
          const backupStats = await fs.stat(backupPath);
          backupInfo.latest = {
            filename: latestBackup,
            date: backupStats.mtime,
            size: backupStats.size,
          };
        }
      } catch (error) {
        console.log("Could not get backup info:", error.message);
      }

      return {
        success: true,
        data: {
          database: {
            ...dbStats,
            size_bytes: dbSize,
            size_mb: (dbSize / (1024 * 1024)).toFixed(2),
          },
          recent_activity: {
            sales_last_7_days: recentSales.count,
            inventory_changes_last_7_days: recentInventoryChanges.count,
          },
          backup_info: backupInfo,
          system: {
            node_version: process.version,
            platform: process.platform,
            uptime: process.uptime(),
          },
        },
      };
    } catch (error) {
      console.error("Get system info error:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SystemService;
