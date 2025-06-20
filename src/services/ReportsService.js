class ReportsService {
  constructor(db) {
    this.db = db;
  }

  async getDashboardData() {
    try {
      const today = new Date().toISOString().split("T")[0];
      const thisMonth = new Date().toISOString().slice(0, 7);

      // Today's sales
      const todaySales = await this.db.getQuery(
        `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE DATE(sale_date) = ?`,
        [today]
      );

      // This month's sales
      const monthSales = await this.db.getQuery(
        `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE strftime('%Y-%m', sale_date) = ?`,
        [thisMonth]
      );

      // Low stock products
      const lowStockProducts = await this.db.allQuery(
        `SELECT product_name, stock_quantity, minimum_stock
         FROM products WHERE stock_quantity <= minimum_stock
         ORDER BY (stock_quantity - minimum_stock) ASC`
      );

      // Top selling products (last 30 days)
      const topProducts = await this.db.allQuery(
        `SELECT p.product_name, SUM(si.quantity) as total_sold, SUM(si.total_price) as revenue
         FROM sale_items si
         JOIN products p ON si.product_id = p.product_id
         JOIN sales s ON si.sale_id = s.sale_id
         WHERE s.sale_date >= date('now', '-30 days')
         GROUP BY p.product_id, p.product_name
         ORDER BY total_sold DESC
         LIMIT 5`
      );

      // Recent sales
      const recentSales = await this.db.allQuery(
        `SELECT s.sale_id, s.total_amount, s.sale_date, s.receipt_number, u.username
         FROM sales s
         JOIN users u ON s.user_id = u.user_id
         ORDER BY s.sale_date DESC
         LIMIT 10`
      );

      // Inventory summary
      const inventorySummary = await this.db.getQuery(
        `SELECT 
           COUNT(*) as total_products,
           SUM(stock_quantity) as total_stock,
           SUM(stock_quantity * selling_price) as total_value,
           COUNT(CASE WHEN stock_quantity <= minimum_stock THEN 1 END) as low_stock_count
         FROM products`
      );

      // User performance (today)
      const userPerformance = await this.db.allQuery(
        `SELECT u.username, u.role, COUNT(s.sale_id) as sales_count, 
                COALESCE(SUM(s.total_amount), 0) as total_revenue
         FROM users u
         LEFT JOIN sales s ON u.user_id = s.user_id AND DATE(s.sale_date) = ?
         WHERE u.is_active = 1
         GROUP BY u.user_id, u.username, u.role
         ORDER BY total_revenue DESC`,
        [today]
      );

      return {
        success: true,
        data: {
          today: {
            sales_count: todaySales.count,
            revenue: todaySales.total,
          },
          month: {
            sales_count: monthSales.count,
            revenue: monthSales.total,
          },
          low_stock_products: lowStockProducts,
          top_products: topProducts,
          recent_sales: recentSales,
          inventory_summary: inventorySummary,
          user_performance: userPerformance,
        },
      };
    } catch (error) {
      console.error("Get dashboard data error:", error);
      return { success: false, error: error.message };
    }
  }

  async getSalesReport(filters = {}) {
    try {
      let query = `
        SELECT s.sale_id, s.total_amount, s.payment_method, s.sale_date, 
               s.receipt_number, u.username, COUNT(si.item_id) as item_count
        FROM sales s
        JOIN users u ON s.user_id = u.user_id
        LEFT JOIN sale_items si ON s.sale_id = si.sale_id
      `;
      let params = [];
      let conditions = [];

      if (filters.start_date) {
        conditions.push("DATE(s.sale_date) >= ?");
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        conditions.push("DATE(s.sale_date) <= ?");
        params.push(filters.end_date);
      }

      if (filters.user_id) {
        conditions.push("s.user_id = ?");
        params.push(filters.user_id);
      }

      if (filters.payment_method) {
        conditions.push("s.payment_method = ?");
        params.push(filters.payment_method);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " GROUP BY s.sale_id ORDER BY s.sale_date DESC";

      if (filters.limit) {
        query += " LIMIT ?";
        params.push(filters.limit);
      }

      const sales = await this.db.allQuery(query, params);

      // Get summary statistics
      const summaryQuery = `
        SELECT 
          COUNT(s.sale_id) as total_sales,
          SUM(s.total_amount) as total_revenue,
          AVG(s.total_amount) as average_sale,
          COUNT(CASE WHEN s.payment_method = 'cash' THEN 1 END) as cash_sales,
          COUNT(CASE WHEN s.payment_method = 'card' THEN 1 END) as card_sales
        FROM sales s
        ${conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : ""}
      `;

      const summary = await this.db.getQuery(summaryQuery, params.slice(0, -1));

      return {
        success: true,
        data: {
          sales,
          summary: {
            total_sales: summary.total_sales || 0,
            total_revenue: summary.total_revenue || 0,
            average_sale: summary.average_sale || 0,
            cash_sales: summary.cash_sales || 0,
            card_sales: summary.card_sales || 0,
          },
        },
      };
    } catch (error) {
      console.error("Get sales report error:", error);
      return { success: false, error: error.message };
    }
  }

  async getInventoryReport() {
    try {
      // Product summary by category
      const categoryReport = await this.db.allQuery(`
        SELECT c.category_name, 
               COUNT(p.product_id) as product_count,
               SUM(p.stock_quantity) as total_stock,
               SUM(p.stock_quantity * p.selling_price) as total_value,
               COUNT(CASE WHEN p.stock_quantity <= p.minimum_stock THEN 1 END) as low_stock_count
        FROM categories c
        LEFT JOIN products p ON c.category_id = p.category_id
        GROUP BY c.category_id, c.category_name
        ORDER BY total_value DESC
      `);

      // Low stock products
      const lowStockProducts = await this.db.allQuery(`
        SELECT p.product_name, p.barcode, p.stock_quantity, p.minimum_stock,
               p.selling_price, c.category_name,
               (p.minimum_stock - p.stock_quantity) as shortage
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE p.stock_quantity <= p.minimum_stock
        ORDER BY shortage DESC
      `);

      // Inventory movements (last 30 days)
      const recentMovements = await this.db.allQuery(`
        SELECT it.transaction_type, it.quantity_change, it.notes, it.created_at,
               p.product_name, p.barcode
        FROM inventory_transactions it
        JOIN products p ON it.product_id = p.product_id
        WHERE it.created_at >= date('now', '-30 days')
        ORDER BY it.created_at DESC
        LIMIT 50
      `);

      // Overall inventory summary
      const overallSummary = await this.db.getQuery(`
        SELECT 
          COUNT(*) as total_products,
          SUM(stock_quantity) as total_stock_units,
          SUM(stock_quantity * purchase_price) as total_cost_value,
          SUM(stock_quantity * selling_price) as total_selling_value,
          COUNT(CASE WHEN stock_quantity <= minimum_stock THEN 1 END) as low_stock_count,
          COUNT(CASE WHEN stock_quantity = 0 THEN 1 END) as out_of_stock_count
        FROM products
      `);

      return {
        success: true,
        data: {
          category_report: categoryReport,
          low_stock_products: lowStockProducts,
          recent_movements: recentMovements,
          overall_summary: overallSummary,
        },
      };
    } catch (error) {
      console.error("Get inventory report error:", error);
      return { success: false, error: error.message };
    }
  }

  async getUserPerformanceReport(filters = {}) {
    try {
      let query = `
        SELECT u.user_id, u.username, u.role,
               COUNT(s.sale_id) as total_sales,
               SUM(s.total_amount) as total_revenue,
               AVG(s.total_amount) as average_sale,
               MIN(s.sale_date) as first_sale,
               MAX(s.sale_date) as last_sale,
               COUNT(CASE WHEN s.payment_method = 'cash' THEN 1 END) as cash_sales,
               COUNT(CASE WHEN s.payment_method = 'card' THEN 1 END) as card_sales
        FROM users u
        LEFT JOIN sales s ON u.user_id = s.user_id
      `;
      let params = [];
      let conditions = [];

      if (filters.start_date) {
        conditions.push("(s.sale_date IS NULL OR DATE(s.sale_date) >= ?)");
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        conditions.push("(s.sale_date IS NULL OR DATE(s.sale_date) <= ?)");
        params.push(filters.end_date);
      }

      if (filters.user_id) {
        conditions.push("u.user_id = ?");
        params.push(filters.user_id);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query +=
        " GROUP BY u.user_id, u.username, u.role ORDER BY total_revenue DESC";

      const userPerformance = await this.db.allQuery(query, params);

      // Get top performing products by user
      const topProductsByUser = await this.db.allQuery(
        `
        SELECT u.username, p.product_name, SUM(si.quantity) as total_sold,
               SUM(si.total_price) as revenue
        FROM users u
        JOIN sales s ON u.user_id = s.user_id
        JOIN sale_items si ON s.sale_id = si.sale_id
        JOIN products p ON si.product_id = p.product_id
        ${filters.start_date ? "WHERE DATE(s.sale_date) >= ?" : ""}
        ${
          filters.end_date
            ? (filters.start_date ? "AND" : "WHERE") + " DATE(s.sale_date) <= ?"
            : ""
        }
        GROUP BY u.user_id, p.product_id
        ORDER BY u.username, revenue DESC
      `,
        params.slice(0, 2)
      );

      return {
        success: true,
        data: {
          user_performance: userPerformance,
          top_products_by_user: topProductsByUser,
        },
      };
    } catch (error) {
      console.error("Get user performance report error:", error);
      return { success: false, error: error.message };
    }
  }

  async exportReport(reportType, filters = {}, mainWindow) {
    try {
      const XLSX = require("xlsx");
      const { dialog } = require("electron");
      const fs = require("fs").promises;
      const path = require("path");
      const os = require("os");

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      let filename;
      let workbook;

      switch (reportType) {
        case "sales":
          filename = `DOMINAK-757-Sales-Report-${timestamp}.xlsx`;
          workbook = await this.createSalesReportExcel(filters);
          break;
        case "inventory":
          filename = `DOMINAK-757-Inventory-Report-${timestamp}.xlsx`;
          workbook = await this.createInventoryReportExcel();
          break;
        case "user-performance":
          filename = `DOMINAK-757-User-Performance-Report-${timestamp}.xlsx`;
          workbook = await this.createUserPerformanceReportExcel(filters);
          break;
        default:
          return { success: false, error: "Invalid report type" };
      }

      // Let user choose save location
      const saveResult = await dialog.showSaveDialog(mainWindow, {
        title: `Save ${reportType} Report`,
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

      // Write the Excel file
      XLSX.writeFile(workbook, exportPath);

      const stats = await fs.stat(exportPath);

      return {
        success: true,
        data: {
          export_path: exportPath,
          filename: path.basename(exportPath),
          file_size: stats.size,
          export_date: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("Export report error:", error);
      return { success: false, error: error.message };
    }
  }

  async createSalesReportExcel(filters = {}) {
    const XLSX = require("xlsx");
    const workbook = XLSX.utils.book_new();

    // Get sales data with user-friendly formatting
    const salesData = await this.db.allQuery(
      `
      SELECT 
        s.receipt_number as "Receipt Number",
        DATE(s.sale_date) as "Date",
        TIME(s.sale_date) as "Time",
        u.username as "Cashier",
        s.total_amount as "Amount (GHS)",
        s.payment_method as "Payment Method",
        GROUP_CONCAT(
          p.product_name || ' (Qty: ' || si.quantity || ', Price: GHS' || si.unit_price || ')'
        ) as "Items Sold"
      FROM sales s
      JOIN users u ON s.user_id = s.user_id
      LEFT JOIN sale_items si ON s.sale_id = si.sale_id
      LEFT JOIN products p ON si.product_id = p.product_id
      ${filters.start_date ? "WHERE DATE(s.sale_date) >= ?" : ""}
      ${
        filters.end_date
          ? (filters.start_date ? "AND" : "WHERE") + " DATE(s.sale_date) <= ?"
          : ""
      }
      GROUP BY s.sale_id
      ORDER BY s.sale_date DESC
    `,
      filters.start_date && filters.end_date
        ? [filters.start_date, filters.end_date]
        : filters.start_date
        ? [filters.start_date]
        : filters.end_date
        ? [filters.end_date]
        : []
    );

    // Sales Summary
    const summary = await this.db.getQuery(
      `
      SELECT 
        COUNT(*) as "Total Sales",
        SUM(total_amount) as "Total Revenue (GHS)",
        AVG(total_amount) as "Average Sale (GHS)",
        COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as "Cash Sales",
        COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as "Card Sales"
      FROM sales s
      ${filters.start_date ? "WHERE DATE(s.sale_date) >= ?" : ""}
      ${
        filters.end_date
          ? (filters.start_date ? "AND" : "WHERE") + " DATE(s.sale_date) <= ?"
          : ""
      }
    `,
      filters.start_date && filters.end_date
        ? [filters.start_date, filters.end_date]
        : filters.start_date
        ? [filters.start_date]
        : filters.end_date
        ? [filters.end_date]
        : []
    );

    // Top selling products
    const topProducts = await this.db.allQuery(
      `
      SELECT 
        p.product_name as "Product Name",
        SUM(si.quantity) as "Total Sold",
        SUM(si.total_price) as "Revenue (GHS)",
        AVG(si.unit_price) as "Average Price (GHS)"
      FROM sale_items si
      JOIN products p ON si.product_id = p.product_id
      JOIN sales s ON si.sale_id = s.sale_id
      ${filters.start_date ? "WHERE DATE(s.sale_date) >= ?" : ""}
      ${
        filters.end_date
          ? (filters.start_date ? "AND" : "WHERE") + " DATE(s.sale_date) <= ?"
          : ""
      }
      GROUP BY p.product_id, p.product_name
      ORDER BY "Total Sold" DESC
      LIMIT 20
    `,
      filters.start_date && filters.end_date
        ? [filters.start_date, filters.end_date]
        : filters.start_date
        ? [filters.start_date]
        : filters.end_date
        ? [filters.end_date]
        : []
    );

    // Create worksheets
    const salesSheet = XLSX.utils.json_to_sheet(salesData);
    const summarySheet = XLSX.utils.json_to_sheet([summary]);
    const topProductsSheet = XLSX.utils.json_to_sheet(topProducts);

    // Set column widths
    salesSheet["!cols"] = [
      { wch: 15 },
      { wch: 12 },
      { wch: 10 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 50 },
    ];
    summarySheet["!cols"] = [
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
    ];
    topProductsSheet["!cols"] = [
      { wch: 30 },
      { wch: 12 },
      { wch: 15 },
      { wch: 18 },
    ];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(workbook, salesSheet, "Sales Details");
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Sales Summary");
    XLSX.utils.book_append_sheet(workbook, topProductsSheet, "Top Products");

    return workbook;
  }

  async createInventoryReportExcel() {
    const XLSX = require("xlsx");
    const workbook = XLSX.utils.book_new();

    // Current inventory status
    const inventoryData = await this.db.allQuery(`
      SELECT 
        p.product_name as "Product Name",
        c.category_name as "Category",
        p.barcode as "Barcode",
        p.stock_quantity as "Current Stock",
        p.minimum_stock as "Minimum Stock",
        CASE 
          WHEN p.stock_quantity <= p.minimum_stock THEN 'Low Stock'
          WHEN p.stock_quantity = 0 THEN 'Out of Stock'
          ELSE 'In Stock'
        END as "Status",
        p.purchase_price as "Purchase Price (GHS)",
        p.selling_price as "Selling Price (GHS)",
        (p.stock_quantity * p.purchase_price) as "Inventory Value (GHS)"
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      ORDER BY p.product_name
    `);

    // Category summary
    const categoryData = await this.db.allQuery(`
      SELECT 
        c.category_name as "Category",
        COUNT(p.product_id) as "Products Count",
        SUM(p.stock_quantity) as "Total Stock Units",
        SUM(p.stock_quantity * p.purchase_price) as "Total Value (GHS)",
        COUNT(CASE WHEN p.stock_quantity <= p.minimum_stock THEN 1 END) as "Low Stock Items"
      FROM categories c
      LEFT JOIN products p ON c.category_id = p.category_id
      GROUP BY c.category_id, c.category_name
      ORDER BY "Total Value (GHS)" DESC
    `);

    // Low stock alerts
    const lowStockData = await this.db.allQuery(`
      SELECT 
        p.product_name as "Product Name",
        p.stock_quantity as "Current Stock",
        p.minimum_stock as "Minimum Required",
        (p.minimum_stock - p.stock_quantity) as "Shortage",
        p.selling_price as "Selling Price (GHS)"
      FROM products p
      WHERE p.stock_quantity <= p.minimum_stock
      ORDER BY "Shortage" DESC
    `);

    // Recent inventory movements
    const movementsData = await this.db.allQuery(`
      SELECT 
        p.product_name as "Product Name",
        it.transaction_type as "Transaction Type",
        it.quantity_changed as "Quantity Changed",
        it.reason as "Reason",
        DATE(it.created_at) as "Date",
        TIME(it.created_at) as "Time"
      FROM inventory_transactions it
      JOIN products p ON it.product_id = p.product_id
      WHERE it.created_at >= date('now', '-30 days')
      ORDER BY it.created_at DESC
      LIMIT 100
    `);

    // Create worksheets
    const inventorySheet = XLSX.utils.json_to_sheet(inventoryData);
    const categorySheet = XLSX.utils.json_to_sheet(categoryData);
    const lowStockSheet = XLSX.utils.json_to_sheet(lowStockData);
    const movementsSheet = XLSX.utils.json_to_sheet(movementsData);

    // Set column widths
    inventorySheet["!cols"] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
    ];
    categorySheet["!cols"] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
    ];
    lowStockSheet["!cols"] = [
      { wch: 25 },
      { wch: 12 },
      { wch: 15 },
      { wch: 10 },
      { wch: 15 },
    ];
    movementsSheet["!cols"] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 12 },
      { wch: 10 },
    ];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(workbook, inventorySheet, "Current Inventory");
    XLSX.utils.book_append_sheet(workbook, categorySheet, "By Category");
    XLSX.utils.book_append_sheet(workbook, lowStockSheet, "Low Stock Alerts");
    XLSX.utils.book_append_sheet(workbook, movementsSheet, "Recent Movements");

    return workbook;
  }

  async createUserPerformanceReportExcel(filters = {}) {
    const XLSX = require("xlsx");
    const workbook = XLSX.utils.book_new();

    // User performance data
    const userPerformanceData = await this.db.allQuery(
      `
      SELECT 
        u.username as "Username",
        u.role as "Role",
        COUNT(s.sale_id) as "Total Sales",
        SUM(s.total_amount) as "Total Revenue (GHS)",
        AVG(s.total_amount) as "Average Sale (GHS)",
        COUNT(CASE WHEN s.payment_method = 'cash' THEN 1 END) as "Cash Sales",
        COUNT(CASE WHEN s.payment_method = 'card' THEN 1 END) as "Card Sales",
        DATE(MIN(s.sale_date)) as "First Sale Date",
        DATE(MAX(s.sale_date)) as "Last Sale Date"
      FROM users u
      LEFT JOIN sales s ON u.user_id = s.user_id
      ${
        filters.start_date
          ? "WHERE (s.sale_date IS NULL OR DATE(s.sale_date) >= ?)"
          : ""
      }
      ${
        filters.end_date
          ? (filters.start_date ? "AND" : "WHERE") +
            " (s.sale_date IS NULL OR DATE(s.sale_date) <= ?)"
          : ""
      }
      GROUP BY u.user_id, u.username, u.role
      ORDER BY "Total Revenue (GHS)" DESC
    `,
      filters.start_date && filters.end_date
        ? [filters.start_date, filters.end_date]
        : filters.start_date
        ? [filters.start_date]
        : filters.end_date
        ? [filters.end_date]
        : []
    );

    // Daily performance summary
    const dailyPerformanceData = await this.db.allQuery(
      `
      SELECT 
        DATE(s.sale_date) as "Date",
        COUNT(s.sale_id) as "Total Sales",
        SUM(s.total_amount) as "Revenue (GHS)",
        COUNT(DISTINCT s.user_id) as "Active Cashiers"
      FROM sales s
      ${
        filters.start_date
          ? "WHERE DATE(s.sale_date) >= ?"
          : "WHERE DATE(s.sale_date) >= date('now', '-30 days')"
      }
      ${
        filters.end_date
          ? (filters.start_date ? "AND" : "WHERE") + " DATE(s.sale_date) <= ?"
          : ""
      }
      GROUP BY DATE(s.sale_date)
      ORDER BY DATE(s.sale_date) DESC
    `,
      filters.start_date && filters.end_date
        ? [filters.start_date, filters.end_date]
        : filters.start_date
        ? [filters.start_date]
        : filters.end_date
        ? [filters.end_date]
        : []
    );

    // Create worksheets
    const userPerformanceSheet = XLSX.utils.json_to_sheet(userPerformanceData);
    const dailyPerformanceSheet =
      XLSX.utils.json_to_sheet(dailyPerformanceData);

    // Set column widths
    userPerformanceSheet["!cols"] = [
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
    ];
    dailyPerformanceSheet["!cols"] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
    ];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(
      workbook,
      userPerformanceSheet,
      "User Performance"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      dailyPerformanceSheet,
      "Daily Summary"
    );

    return workbook;
  }
}

module.exports = ReportsService;
