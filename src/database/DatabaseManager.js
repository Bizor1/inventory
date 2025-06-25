const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

class DatabaseManager {
  constructor(customDataPath = null) {
    this.db = null;
    // BACK TO YOUR WORKING VERSION
    this.dbPath = "C:\\Users\\bizor\\Desktop\\try\\data\\dominak757.db";
    console.log("📁 Database path (YOUR VERSION):", this.dbPath);
  }

  async initialize() {
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    try {
      const SQL = await initSqlJs();
      
      // Try to load existing database file
      let filebuffer;
      if (fs.existsSync(this.dbPath)) {
        filebuffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(filebuffer);
      } else {
        this.db = new SQL.Database();
      }
      
      console.log("Connected to SQLite database");
      await this.createTables();
      await this.insertDefaultData();
      
      // Save the database to file
      this.saveDatabase();
    } catch (err) {
      console.error("Error opening database:", err);
      throw err;
    }
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

    // Sample products section removed - no automatic dummy data insertion

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
  saveDatabase() {
    try {
      if (!this.db) {
        console.warn("⚠️ No database instance to save");
        return;
      }
      
      console.log("💾 Exporting database data...");
      const data = this.db.export();
      const buffer = Buffer.from(data);
      
      console.log(`💾 Writing ${buffer.length} bytes to ${this.dbPath}`);
      fs.writeFileSync(this.dbPath, buffer);
      console.log("✅ Database saved successfully");
    } catch (err) {
      console.error("❌ Error saving database:", err);
      throw err;
    }
  }

  runQuery(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      
      // Get last insert ID for INSERT operations
      let lastID = null;
      if (sql.trim().toLowerCase().startsWith('insert')) {
        const idStmt = this.db.prepare("SELECT last_insert_rowid() as id");
        idStmt.step();
        const result = idStmt.getAsObject();
        lastID = result ? result.id : null;
        idStmt.free();
        console.log("🆔 Insert operation - Last ID:", lastID);
      }
      
      stmt.free();
      
      // Save database after any write operation
      if (sql.trim().toLowerCase().startsWith('insert') || 
          sql.trim().toLowerCase().startsWith('update') || 
          sql.trim().toLowerCase().startsWith('delete')) {
        console.log("💾 Write operation detected, saving database...");
        console.log("📝 SQL:", sql.substring(0, 100) + (sql.length > 100 ? '...' : ''));
        this.saveDatabase();
      }
      
      return { id: lastID, changes: 1 };
    } catch (err) {
      console.error("Database error:", err);
      throw err;
    }
  }

  getQuery(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      const result = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      return result;
    } catch (err) {
      console.error("Database error:", err);
      throw err;
    }
  }

  allQuery(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error("Database error:", err);
      throw err;
    }
  }

  // Transaction support - simplified for SQL.js
  async beginTransaction() {
    // SQL.js doesn't need explicit transaction management for our use case
    // Just log that we're starting a transaction block
    console.log("📝 Starting transaction block");
  }

  async commitTransaction() {
    // For SQL.js, just save the database after operations
    console.log("✅ Committing transaction - saving database");
    this.saveDatabase();
  }

  async rollbackTransaction() {
    // For SQL.js, we can't really rollback, so just log the attempt
    console.warn("⚠️ Rollback attempted - SQL.js doesn't support rollback");
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
    if (this.db) {
      try {
        this.saveDatabase();
        this.db.close();
        console.log("Database connection closed");
      } catch (err) {
        console.error("Error closing database:", err);
      }
    }
  }
}

module.exports = DatabaseManager;
