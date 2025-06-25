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

  async exportReport(reportType, filters = {}) {
    try {
      let reportData;
      let filename;

      switch (reportType) {
        case "sales":
          reportData = await this.getSalesReport(filters);
          filename = `sales_report_${
            new Date().toISOString().split("T")[0]
          }.json`;
          break;
        case "inventory":
          reportData = await this.getInventoryReport();
          filename = `inventory_report_${
            new Date().toISOString().split("T")[0]
          }.json`;
          break;
        case "user_performance":
          reportData = await this.getUserPerformanceReport(filters);
          filename = `user_performance_report_${
            new Date().toISOString().split("T")[0]
          }.json`;
          break;
        default:
          return { success: false, error: "Invalid report type" };
      }

      if (!reportData.success) {
        return reportData;
      }

      return {
        success: true,
        data: {
          report_data: reportData.data,
          filename,
          export_date: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("Export report error:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ReportsService;
