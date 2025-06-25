const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const DatabaseManager = require("./database/DatabaseManager");
const AuthService = require("./services/AuthService");
const SalesService = require("./services/SalesService");
const InventoryService = require("./services/InventoryService");
const PrinterService = require("./services/PrinterService");
const UserService = require("./services/UserService");
const ReportsService = require("./services/ReportsService");
const SystemService = require("./services/SystemService");

class MainApp {
  constructor() {
    this.mainWindow = null;
    this.db = null;
    this.isDev = process.argv.includes("--dev");
    this.services = {};

    this.initializeApp();
  }

  async initializeApp() {
    await app.whenReady();

    console.log("🏠 Process working directory:", process.cwd());
    console.log("🏠 Executable path:", process.execPath);
    console.log("📦 App is packaged:", app.isPackaged);

    // Initialize database - back to working version
    this.db = new DatabaseManager();
    await this.db.initialize();

    // Initialize services
    this.services.auth = new AuthService(this.db);
    this.services.inventory = new InventoryService(this.db);
    this.services.sales = new SalesService(this.db);
    this.services.printer = new PrinterService();
    this.services.user = new UserService(this.db);
    this.services.reports = new ReportsService(this.db);
    this.services.system = new SystemService(this.db);

    // Inject inventory service into sales service
    this.services.sales.setInventoryService(this.services.inventory);

    this.createWindow();
    this.setupIpcHandlers();

    // Handle app events
    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        this.shutdown();
        app.quit();
      }
    });

    app.on("before-quit", () => {
      console.log("🔄 App is quitting, saving database...");
      this.shutdown();
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
      icon: path.join(__dirname, "../assets/icon.png"),
      show: false,
      titleBarStyle: "default",
      title: "DOMINAK 757 BUSINESS CENTRE - POS System",
    });

    // Load the main HTML file
    this.mainWindow.loadFile(path.join(__dirname, "renderer/index.html"));

    // Show window when ready
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow.show();

      if (this.isDev) {
        this.mainWindow.webContents.openDevTools();
      }
    });

    // Handle window closed
    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });
  }

  shutdown() {
    console.log("🔄 Shutting down application...");
    if (this.db) {
      try {
        console.log("💾 Saving database before shutdown...");
        this.db.saveDatabase();
        this.db.close();
        console.log("✅ Database saved and closed successfully");
      } catch (error) {
        console.error("❌ Error during database shutdown:", error);
      }
    }
  }

  setupIpcHandlers() {
    // Authentication handlers
    ipcMain.handle("auth:login", async (event, { pin, role }) => {
      try {
        return await this.services.auth.login(pin, role);
      } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("auth:logout", async (event) => {
      try {
        return await this.services.auth.logout();
      } catch (error) {
        console.error("Logout error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("auth:getCurrentUser", async (event) => {
      try {
        return await this.services.auth.getCurrentUser();
      } catch (error) {
        console.error("Get current user error:", error);
        return null;
      }
    });

    // Inventory handlers
    ipcMain.handle("inventory:getProducts", async (event, filters = {}) => {
      try {
        return await this.services.inventory.getProducts(filters);
      } catch (error) {
        console.error("Get products error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("inventory:getProductByBarcode", async (event, barcode) => {
      try {
        return await this.services.inventory.getProductByBarcode(barcode);
      } catch (error) {
        console.error("Get product by barcode error:", error);
        return null;
      }
    });

    ipcMain.handle("inventory:getCategories", async (event) => {
      try {
        return await this.services.inventory.getCategories();
      } catch (error) {
        console.error("Get categories error:", error);
        return [];
      }
    });

    ipcMain.handle("inventory:getLowStockProducts", async (event) => {
      try {
        return await this.services.inventory.getLowStockProducts();
      } catch (error) {
        console.error("Get low stock products error:", error);
        return [];
      }
    });

    ipcMain.handle("inventory:addProduct", async (event, productData) => {
      try {
        return await this.services.inventory.addProduct(productData);
      } catch (error) {
        console.error("Add product error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle(
      "inventory:updateProduct",
      async (event, productId, productData) => {
        try {
          return await this.services.inventory.updateProduct(
            productId,
            productData
          );
        } catch (error) {
          console.error("Update product error:", error);
          return { success: false, error: error.message };
        }
      }
    );

    ipcMain.handle("inventory:deleteProduct", async (event, productId) => {
      try {
        return await this.services.inventory.deleteProduct(productId);
      } catch (error) {
        console.error("Delete product error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("inventory:addCategory", async (event, categoryData) => {
      try {
        return await this.services.inventory.addCategory(categoryData);
      } catch (error) {
        console.error("Add category error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle(
      "inventory:updateCategory",
      async (event, categoryId, categoryData) => {
        try {
          return await this.services.inventory.updateCategory(
            categoryId,
            categoryData
          );
        } catch (error) {
          console.error("Update category error:", error);
          return { success: false, error: error.message };
        }
      }
    );

    ipcMain.handle("inventory:deleteCategory", async (event, categoryId) => {
      try {
        return await this.services.inventory.deleteCategory(categoryId);
      } catch (error) {
        console.error("Delete category error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle(
      "inventory:adjustStock",
      async (event, productId, quantity, reason) => {
        try {
          return await this.services.inventory.adjustStock(
            productId,
            quantity,
            reason
          );
        } catch (error) {
          console.error("Adjust stock error:", error);
          return { success: false, error: error.message };
        }
      }
    );

    ipcMain.handle("inventory:getInventoryReport", async (event) => {
      try {
        return await this.services.inventory.getInventoryReport();
      } catch (error) {
        console.error("Get inventory report error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle(
      "inventory:getInventoryTransactions",
      async (event, filters) => {
        try {
          return await this.services.inventory.getInventoryTransactions(
            filters
          );
        } catch (error) {
          console.error("Get inventory transactions error:", error);
          return { success: false, error: error.message };
        }
      }
    );

    // Sales handlers
    ipcMain.handle("sales:createSale", async (event, saleData) => {
      try {
        return await this.services.sales.createSale(saleData);
      } catch (error) {
        console.error("Create sale error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("sales:getSales", async (event, filters = {}) => {
      try {
        return await this.services.sales.getSales(filters);
      } catch (error) {
        console.error("Get sales error:", error);
        return [];
      }
    });

    ipcMain.handle("sales:getDailySummary", async (event, date) => {
      try {
        return await this.services.sales.getDailySummary(date);
      } catch (error) {
        console.error("Get daily summary error:", error);
        return null;
      }
    });

    ipcMain.handle("sales:getReceiptData", async (event, saleId) => {
      try {
        return await this.services.sales.getReceiptData(saleId);
      } catch (error) {
        console.error("Get receipt data error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("sales:getWeeklySummary", async (event, startDate) => {
      try {
        return await this.services.sales.getWeeklySummary(startDate);
      } catch (error) {
        console.error("Get weekly summary error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("sales:getMonthlySummary", async (event, year, month) => {
      try {
        return await this.services.sales.getMonthlySummary(year, month);
      } catch (error) {
        console.error("Get monthly summary error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("sales:getTopSellingProducts", async (event, period) => {
      try {
        return await this.services.sales.getTopSellingProducts(period);
      } catch (error) {
        console.error("Get top selling products error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("sales:getSalesByUser", async (event, userId, filters) => {
      try {
        return await this.services.sales.getSalesByUser(userId, filters);
      } catch (error) {
        console.error("Get sales by user error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("sales:voidSale", async (event, saleId, reason) => {
      try {
        return await this.services.sales.voidSale(saleId, reason);
      } catch (error) {
        console.error("Void sale error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("sales:deleteSale", async (event, saleId) => {
      try {
        return await this.services.sales.deleteSale(saleId);
      } catch (error) {
        console.error("Delete sale error:", error);
        return { success: false, error: error.message };
      }
    });

    // User management handlers
    ipcMain.handle("users:getUsers", async (event) => {
      try {
        return await this.services.user.getUsers();
      } catch (error) {
        console.error("Get users error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("users:addUser", async (event, userData) => {
      try {
        return await this.services.user.addUser(userData);
      } catch (error) {
        console.error("Add user error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("users:getUserById", async (event, userId) => {
      try {
        return await this.services.user.getUserById(userId);
      } catch (error) {
        console.error("Get user by ID error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("users:updateUser", async (event, userId, userData) => {
      try {
        return await this.services.user.updateUser(userId, userData);
      } catch (error) {
        console.error("Update user error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("users:changePin", async (event, userId, newPin) => {
      try {
        return await this.services.user.changePin(userId, newPin);
      } catch (error) {
        console.error("Change PIN error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("users:toggleUserStatus", async (event, userId) => {
      try {
        return await this.services.user.toggleUserStatus(userId);
      } catch (error) {
        console.error("Toggle user status error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("users:getUserActivity", async (event, userId, filters) => {
      try {
        return await this.services.user.getUserActivity(userId, filters);
      } catch (error) {
        console.error("Get user activity error:", error);
        return { success: false, error: error.message };
      }
    });

    // Reports handlers
    ipcMain.handle("reports:getDashboardData", async (event) => {
      try {
        return await this.services.reports.getDashboardData();
      } catch (error) {
        console.error("Get dashboard data error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("reports:getSalesReport", async (event, filters) => {
      try {
        return await this.services.reports.getSalesReport(filters);
      } catch (error) {
        console.error("Get sales report error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("reports:getInventoryReport", async (event) => {
      try {
        return await this.services.reports.getInventoryReport();
      } catch (error) {
        console.error("Get inventory report error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle(
      "reports:getUserPerformanceReport",
      async (event, filters) => {
        try {
          return await this.services.reports.getUserPerformanceReport(filters);
        } catch (error) {
          console.error("Get user performance report error:", error);
          return { success: false, error: error.message };
        }
      }
    );

    ipcMain.handle(
      "reports:exportReport",
      async (event, reportType, filters) => {
        try {
          return await this.services.reports.exportReport(
            reportType,
            filters,
            this.mainWindow
          );
        } catch (error) {
          console.error("Export report error:", error);
          return { success: false, error: error.message };
        }
      }
    );

    // Printer handlers
    ipcMain.handle("printer:printReceipt", async (event, receiptData) => {
      try {
        return await this.services.printer.printReceipt(receiptData);
      } catch (error) {
        console.error("Print receipt error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("printer:testPrinter", async (event) => {
      try {
        return await this.services.printer.testPrinter();
      } catch (error) {
        console.error("Test printer error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("printer:detectPrinters", async (event) => {
      try {
        return await this.services.printer.detectPrinters();
      } catch (error) {
        console.error("Detect printers error:", error);
        return { success: false, error: error.message };
      }
    });

    // System handlers
    ipcMain.handle("system:backup", async (event) => {
      try {
        return await this.services.system.backup(this.mainWindow);
      } catch (error) {
        console.error("Backup error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("system:restore", async (event, backupPath) => {
      try {
        return await this.services.system.restore(backupPath);
      } catch (error) {
        console.error("Restore error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("system:getSettings", async (event) => {
      try {
        return await this.services.system.getSettings();
      } catch (error) {
        console.error("Get settings error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("system:updateSettings", async (event, settings) => {
      try {
        return await this.services.system.updateSettings(settings);
      } catch (error) {
        console.error("Update settings error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("system:showError", async (event, message) => {
      return await dialog.showErrorBox("Error", message);
    });

    ipcMain.handle("system:showInfo", async (event, message) => {
      return await dialog.showMessageBox(this.mainWindow, {
        type: "info",
        title: "Information",
        message: message,
        buttons: ["OK"],
      });
    });

    ipcMain.handle("system:exportData", async (event, type) => {
      try {
        return await this.services.system.exportData(type, this.mainWindow);
      } catch (error) {
        console.error("Export data error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("system:getSystemInfo", async (event) => {
      try {
        return await this.services.system.getSystemInfo();
      } catch (error) {
        console.error("Get system info error:", error);
        return { success: false, error: error.message };
      }
    });

    // Bulk upload products
    ipcMain.handle(
      "bulk-upload-products",
      async (event, fileData, fileType = "csv") => {
        try {
          const result = await this.services.inventory.bulkUploadProducts(
            fileData,
            fileType
          );
          return { success: true, data: result };
        } catch (error) {
          console.error("Bulk upload products error:", error);
          return { success: false, error: error.message };
        }
      }
    );

    // Generate template (both CSV and Excel)
    ipcMain.handle("generate-template", async (event, format = "csv") => {
      try {
        const template = this.services.inventory.generateTemplate(format);
        return { success: true, data: template };
      } catch (error) {
        console.error("Generate template error:", error);
        return { success: false, error: error.message };
      }
    });

    // Generate CSV template
    ipcMain.handle("generate-csv-template", async () => {
      try {
        const template = this.services.inventory.generateCSVTemplate();
        return { success: true, data: template };
      } catch (error) {
        console.error("Generate CSV template error:", error);
        return { success: false, error: error.message };
      }
    });

    // Additional handlers for preload.js compatibility
    ipcMain.handle("get-products", async (event, filters = {}) => {
      try {
        const result = await this.services.inventory.getProducts(filters);

        if (result.success) {
          return { success: true, data: result.data };
        } else {
          console.error("Inventory service failed:", result.error);
          return { success: false, error: result.error };
        }
      } catch (error) {
        console.error("Get products error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-categories", async (event) => {
      try {
        const categories = await this.services.inventory.getCategories();
        return { success: true, data: categories };
      } catch (error) {
        console.error("Get categories error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("add-product", async (event, product) => {
      try {
        const result = await this.services.inventory.addProduct(product);
        return result; // Return the result directly from InventoryService
      } catch (error) {
        console.error("Add product error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("update-product", async (event, id, product) => {
      try {
        const result = await this.services.inventory.updateProduct(id, product);
        return result; // Return the result directly from InventoryService
      } catch (error) {
        console.error("Update product error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("delete-product", async (event, id) => {
      try {
        const result = await this.services.inventory.deleteProduct(id);
        return result; // Return the result directly from InventoryService
      } catch (error) {
        console.error("Delete product error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-product-by-id", async (event, id) => {
      try {
        const product = await this.services.inventory.getProductById(id);
        return { success: true, data: product };
      } catch (error) {
        console.error("Get product by ID error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-product-by-barcode", async (event, barcode) => {
      try {
        const product = await this.services.inventory.getProductByBarcode(
          barcode
        );
        return { success: true, data: product };
      } catch (error) {
        console.error("Get product by barcode error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("add-category", async (event, category) => {
      try {
        const result = await this.services.inventory.addCategory(category);
        return result; // Return the result directly from InventoryService
      } catch (error) {
        console.error("Add category error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("update-category", async (event, id, category) => {
      try {
        const result = await this.services.inventory.updateCategory(
          id,
          category
        );
        return { success: true, data: result };
      } catch (error) {
        console.error("Update category error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("delete-category", async (event, id) => {
      try {
        const result = await this.services.inventory.deleteCategory(id);
        return { success: true, data: result };
      } catch (error) {
        console.error("Delete category error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-low-stock-products", async (event) => {
      try {
        const products = await this.services.inventory.getLowStockProducts();
        return { success: true, data: products };
      } catch (error) {
        console.error("Get low stock products error:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle(
      "adjust-stock",
      async (event, productId, quantity, reason) => {
        try {
          const result = await this.services.inventory.adjustStock(
            productId,
            quantity,
            reason
          );
          return result; // Return the result directly from InventoryService
        } catch (error) {
          console.error("Adjust stock error:", error);
          return { success: false, error: error.message };
        }
      }
    );
  }
}

// Initialize the application
new MainApp();
