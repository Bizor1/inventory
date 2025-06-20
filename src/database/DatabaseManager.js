const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = path.join(process.cwd(), "data", "dominak757.db");
  }

  async initialize() {
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          console.error("Error opening database:", err);
          reject(err);
        } else {
          console.log("Connected to SQLite database");
          await this.createTables();
          await this.insertDefaultData();
          resolve();
        }
      });
    });
  }

  async createTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                pin_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'cashier')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                is_active BOOLEAN DEFAULT 1
            )`,

      // Categories table
      `CREATE TABLE IF NOT EXISTS categories (
                category_id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

      // Products table
      `CREATE TABLE IF NOT EXISTS products (
                product_id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_name TEXT NOT NULL,
                category_id INTEGER,
                barcode TEXT UNIQUE,
                purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
                selling_price DECIMAL(10,2) NOT NULL,
                stock_quantity INTEGER NOT NULL DEFAULT 0,
                minimum_stock INTEGER DEFAULT 5,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(category_id)
            )`,

      // Sales table
      `CREATE TABLE IF NOT EXISTS sales (
                sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                payment_method TEXT NOT NULL DEFAULT 'cash',
                sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                receipt_number TEXT UNIQUE NOT NULL,
                notes TEXT,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )`,

      // Sale Items table
      `CREATE TABLE IF NOT EXISTS sale_items (
                item_id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                unit_price DECIMAL(10,2) NOT NULL,
                total_price DECIMAL(10,2) NOT NULL,
                FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
                FOREIGN KEY (product_id) REFERENCES products(product_id)
            )`,

      // Inventory Transactions table
      `CREATE TABLE IF NOT EXISTS inventory_transactions (
                transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                transaction_type TEXT NOT NULL CHECK (transaction_type IN ('sale', 'adjustment', 'return', 'initial')),
                quantity_change INTEGER NOT NULL,
                reference_id INTEGER,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(product_id)
            )`,

      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
                setting_key TEXT PRIMARY KEY,
                setting_value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
    ];

    for (const table of tables) {
      await this.runQuery(table);
    }

    // Create indexes for better performance
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)",
      "CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)",
      "CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_transactions(product_id)",
      "CREATE INDEX IF NOT EXISTS idx_inventory_date ON inventory_transactions(created_at)",
    ];

    for (const index of indexes) {
      await this.runQuery(index);
    }
  }

  async insertDefaultData() {
    // Check if default admin user exists
    const adminExists = await this.getQuery(
      'SELECT COUNT(*) as count FROM users WHERE role = "admin"'
    );

    if (adminExists.count === 0) {
      // Create default admin user (PIN: 1234)
      const adminPinHash = await bcrypt.hash("1234", 10);
      await this.runQuery(
        "INSERT INTO users (username, pin_hash, role) VALUES (?, ?, ?)",
        ["admin", adminPinHash, "admin"]
      );

      // Create default cashier user (PIN: 0000)
      const cashierPinHash = await bcrypt.hash("0000", 10);
      await this.runQuery(
        "INSERT INTO users (username, pin_hash, role) VALUES (?, ?, ?)",
        ["cashier", cashierPinHash, "cashier"]
      );
    }

    // Insert default categories if they don't exist
    const categoriesExist = await this.getQuery(
      "SELECT COUNT(*) as count FROM categories"
    );

    if (categoriesExist.count === 0) {
      const defaultCategories = [
        ["General", "General merchandise"],
        ["Food & Beverages", "Food and drink items"],
        ["Electronics", "Electronic products"],
        ["Clothing", "Clothing and apparel"],
        ["Household", "Household items and supplies"],
      ];

      for (const [name, description] of defaultCategories) {
        await this.runQuery(
          "INSERT INTO categories (category_name, description) VALUES (?, ?)",
          [name, description]
        );
      }
    }

    // Insert sample products if none exist
    const productsExist = await this.getQuery(
      "SELECT COUNT(*) as count FROM products"
    );

    if (productsExist.count === 0) {
      const sampleProducts = [
        ["Coca Cola 350ml", 2, "1234567890123", 1.5, 2.5, 100, 20],
        ["Bread Loaf", 2, "2345678901234", 0.8, 1.5, 50, 10],
        ["Rice 5kg", 1, "3456789012345", 8.0, 12.0, 30, 5],
        ["Cooking Oil 1L", 1, "4567890123456", 3.5, 5.5, 25, 5],
        ["Milk 1L", 2, "5678901234567", 2.0, 3.0, 40, 10],
        ["Smartphone", 3, "6789012345678", 150.0, 250.0, 15, 3],
        ["T-Shirt", 4, "7890123456789", 8.0, 15.0, 25, 8],
        ["Detergent Powder", 5, "8901234567890", 6.0, 9.5, 20, 5],
        ["Instant Noodles", 2, "9012345678901", 0.6, 1.2, 100, 25],
        ["Mineral Water 1.5L", 2, "1122334455667", 0.8, 1.5, 75, 15],
      ];

      for (const [
        name,
        categoryId,
        barcode,
        purchasePrice,
        sellingPrice,
        stock,
        minStock,
      ] of sampleProducts) {
        await this.runQuery(
          "INSERT INTO products (product_name, category_id, barcode, purchase_price, selling_price, stock_quantity, minimum_stock) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            name,
            categoryId,
            barcode,
            purchasePrice,
            sellingPrice,
            stock,
            minStock,
          ]
        );
      }
    }

    // Insert default settings
    const settingsExist = await this.getQuery(
      "SELECT COUNT(*) as count FROM settings"
    );

    if (settingsExist.count === 0) {
      const defaultSettings = [
        ["business_name", "DOMINAK 757 BUSINESS CENTRE"],
        ["business_phone", "0549831901"],
        ["business_address", "Ghana"],
        ["currency", "GHS"],
        ["receipt_footer", "Thank you for your business!"],
        ["session_timeout", "30"],
        ["low_stock_threshold", "5"],
      ];

      for (const [key, value] of defaultSettings) {
        await this.runQuery(
          "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)",
          [key, value]
        );
      }
    }
  }

  // Generic query methods
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          console.error("Database error:", err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error("Database error:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error("Database error:", err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Transaction support
  async beginTransaction() {
    await this.runQuery("BEGIN TRANSACTION");
  }

  async commitTransaction() {
    await this.runQuery("COMMIT");
  }

  async rollbackTransaction() {
    await this.runQuery("ROLLBACK");
  }

  // Backup functionality
  async backup(backupPath) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(this.dbPath);
      const writeStream = fs.createWriteStream(backupPath);

      readStream.on("error", reject);
      writeStream.on("error", reject);
      writeStream.on("finish", () => {
        resolve({ success: true, message: "Backup completed successfully" });
      });

      readStream.pipe(writeStream);
    });
  }

  // Close database connection
  close() {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          console.error("Error closing database:", err);
        }
        resolve();
      });
    });
  }
}

module.exports = DatabaseManager;
