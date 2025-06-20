const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Authentication methods
  auth: {
    login: (pin, role) => ipcRenderer.invoke("auth:login", { pin, role }),
    logout: () => ipcRenderer.invoke("auth:logout"),
    getCurrentUser: () => ipcRenderer.invoke("auth:getCurrentUser"),
  },

  // Inventory methods
  inventory: {
    getProducts: () => ipcRenderer.invoke("get-products"),
    addProduct: (product) => ipcRenderer.invoke("add-product", product),
    updateProduct: (id, product) =>
      ipcRenderer.invoke("update-product", id, product),
    deleteProduct: (id) => ipcRenderer.invoke("delete-product", id),
    getProductById: (id) => ipcRenderer.invoke("get-product-by-id", id),
    getProductByBarcode: (barcode) =>
      ipcRenderer.invoke("get-product-by-barcode", barcode),
    bulkUploadProducts: (fileData, fileType) =>
      ipcRenderer.invoke("bulk-upload-products", fileData, fileType),
    generateCSVTemplate: () => ipcRenderer.invoke("generate-csv-template"),
    generateTemplate: (format) =>
      ipcRenderer.invoke("generate-template", format),
    getCategories: () => ipcRenderer.invoke("get-categories"),
    addCategory: (category) => ipcRenderer.invoke("add-category", category),
    updateCategory: (id, category) =>
      ipcRenderer.invoke("update-category", id, category),
    deleteCategory: (id) => ipcRenderer.invoke("delete-category", id),
    getLowStockProducts: () => ipcRenderer.invoke("get-low-stock-products"),
    adjustStock: (productId, quantity, reason) =>
      ipcRenderer.invoke("adjust-stock", productId, quantity, reason),
    getInventoryReport: () =>
      ipcRenderer.invoke("inventory:getInventoryReport"),
    getInventoryTransactions: (filters) =>
      ipcRenderer.invoke("inventory:getInventoryTransactions", filters),
  },

  // Sales methods
  sales: {
    createSale: (saleData) => ipcRenderer.invoke("sales:createSale", saleData),
    getSales: (filters) => ipcRenderer.invoke("sales:getSales", filters),
    getDailySummary: (date) =>
      ipcRenderer.invoke("sales:getDailySummary", date),
    getReceiptData: (saleId) =>
      ipcRenderer.invoke("sales:getReceiptData", saleId),
    getWeeklySummary: (startDate) =>
      ipcRenderer.invoke("sales:getWeeklySummary", startDate),
    getMonthlySummary: (year, month) =>
      ipcRenderer.invoke("sales:getMonthlySummary", year, month),
    getTopSellingProducts: (period) =>
      ipcRenderer.invoke("sales:getTopSellingProducts", period),
    getSalesByUser: (userId, filters) =>
      ipcRenderer.invoke("sales:getSalesByUser", userId, filters),
    voidSale: (saleId, reason) =>
      ipcRenderer.invoke("sales:voidSale", saleId, reason),
  },

  // User management methods
  users: {
    getUsers: () => ipcRenderer.invoke("users:getUsers"),
    addUser: (userData) => ipcRenderer.invoke("users:addUser", userData),
    getUserById: (userId) => ipcRenderer.invoke("users:getUserById", userId),
    updateUser: (userId, userData) =>
      ipcRenderer.invoke("users:updateUser", userId, userData),
    changePin: (userId, newPin) =>
      ipcRenderer.invoke("users:changePin", userId, newPin),
    toggleUserStatus: (userId) =>
      ipcRenderer.invoke("users:toggleUserStatus", userId),
    getUserActivity: (userId, filters) =>
      ipcRenderer.invoke("users:getUserActivity", userId, filters),
  },

  // Reports methods
  reports: {
    getDashboardData: () => ipcRenderer.invoke("reports:getDashboardData"),
    getSalesReport: (filters) =>
      ipcRenderer.invoke("reports:getSalesReport", filters),
    getInventoryReport: () => ipcRenderer.invoke("reports:getInventoryReport"),
    getUserPerformanceReport: (filters) =>
      ipcRenderer.invoke("reports:getUserPerformanceReport", filters),
    exportReport: (reportType, filters) =>
      ipcRenderer.invoke("reports:exportReport", reportType, filters),
  },

  // Printer methods
  printer: {
    printReceipt: (receiptData) =>
      ipcRenderer.invoke("printer:printReceipt", receiptData),
    testPrinter: () => ipcRenderer.invoke("printer:testPrinter"),
    detectPrinters: () => ipcRenderer.invoke("printer:detectPrinters"),
  },

  // System methods
  system: {
    backup: () => ipcRenderer.invoke("system:backup"),
    restore: (backupPath) => ipcRenderer.invoke("system:restore", backupPath),
    getSettings: () => ipcRenderer.invoke("system:getSettings"),
    updateSettings: (settings) =>
      ipcRenderer.invoke("system:updateSettings", settings),
    showError: (message) => ipcRenderer.invoke("system:showError", message),
    showInfo: (message) => ipcRenderer.invoke("system:showInfo", message),
    exportData: (type) => ipcRenderer.invoke("system:exportData", type),
    getSystemInfo: () => ipcRenderer.invoke("system:getSystemInfo"),
  },
});
