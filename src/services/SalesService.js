const { v4: uuidv4 } = require("uuid");
const moment = require("moment");

class SalesService {
  constructor(databaseManager) {
    this.db = databaseManager;
    this.inventoryService = null; // Will be injected
  }

  setInventoryService(inventoryService) {
    this.inventoryService = inventoryService;
  }

  async createSale(saleData) {
    try {
      const { user_id, items, payment_method = "cash", notes = "" } = saleData;

      // Validation
      if (!user_id || !items || !Array.isArray(items) || items.length === 0) {
        return { success: false, error: "Invalid sale data" };
      }

      // Calculate total amount
      let totalAmount = 0;
      for (const item of items) {
        if (!item.product_id || !item.quantity || !item.unit_price) {
          return { success: false, error: "Invalid item data" };
        }
        totalAmount += item.quantity * item.unit_price;
      }

      // Generate receipt number
      const receiptNumber = `DOM${Date.now()}`;

      await this.db.beginTransaction();

      try {
        // Create sale record
        const saleResult = await this.db.runQuery(
          `
                    INSERT INTO sales (
                        user_id, total_amount, payment_method, receipt_number, notes
                    ) VALUES (?, ?, ?, ?, ?)
                `,
          [user_id, totalAmount, payment_method, receiptNumber, notes]
        );

        const saleId = saleResult.id;
        console.log("💾 Sale created with ID:", saleId, "Receipt:", receiptNumber);

        // Process each item
        for (const item of items) {
          // Add sale item
          await this.db.runQuery(
            `
                        INSERT INTO sale_items (
                            sale_id, product_id, quantity, unit_price, total_price
                        ) VALUES (?, ?, ?, ?, ?)
                    `,
            [
              saleId,
              item.product_id,
              item.quantity,
              item.unit_price,
              item.quantity * item.unit_price,
            ]
          );

          // Reduce stock
          if (this.inventoryService) {
            await this.inventoryService.reduceStock(
              item.product_id,
              item.quantity,
              saleId
            );
          }
        }

        await this.db.commitTransaction();

        return {
          success: true,
          data: {
            sale_id: saleId,
            receipt_number: receiptNumber,
            total_amount: totalAmount,
          },
          message: "Sale completed successfully",
        };
      } catch (error) {
        await this.db.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      console.error("Create sale error:", error);
      return { success: false, error: error.message };
    }
  }

  async getSales(filters = {}) {
    try {
      let query = `
                SELECT s.*, u.username as cashier_name,
                       COUNT(si.item_id) as item_count
                FROM sales s
                JOIN users u ON s.user_id = u.user_id
                LEFT JOIN sale_items si ON s.sale_id = si.sale_id
            `;
      let params = [];
      let conditions = [];

      // Apply filters
      if (filters.user_id) {
        conditions.push("s.user_id = ?");
        params.push(filters.user_id);
      }

      if (filters.start_date) {
        conditions.push("DATE(s.sale_date) >= ?");
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        conditions.push("DATE(s.sale_date) <= ?");
        params.push(filters.end_date);
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
      return { success: true, data: sales };
    } catch (error) {
      console.error("Get sales error:", error);
      return { success: false, error: error.message };
    }
  }

  async getSaleDetails(saleId) {
    try {
      // Get sale info
      const sale = await this.db.getQuery(
        `
                SELECT s.*, u.username as cashier_name
                FROM sales s
                JOIN users u ON s.user_id = u.user_id
                WHERE s.sale_id = ?
            `,
        [saleId]
      );

      if (!sale) {
        return { success: false, error: "Sale not found" };
      }

      // Get sale items
      const items = await this.db.allQuery(
        `
                SELECT si.*, p.product_name, p.barcode
                FROM sale_items si
                JOIN products p ON si.product_id = p.product_id
                WHERE si.sale_id = ?
            `,
        [saleId]
      );

      return {
        success: true,
        data: {
          ...sale,
          items: items,
        },
      };
    } catch (error) {
      console.error("Get sale details error:", error);
      return { success: false, error: error.message };
    }
  }

  async getDailySummary(date = null) {
    try {
      const targetDate = date || new Date().toISOString().split("T")[0];

      const summary = await this.db.getQuery(
        `
          SELECT COUNT(*) as total_sales, SUM(total_amount) as total_revenue
          FROM sales WHERE DATE(sale_date) = ?
      `,
        [targetDate]
      );

      return {
        success: true,
        data: {
          date: targetDate,
          summary: summary || { total_sales: 0, total_revenue: 0 },
        },
      };
    } catch (error) {
      console.error("Get daily summary error:", error);
      return { success: false, error: error.message };
    }
  }

  async generateReceiptNumber() {
    try {
      const today = moment().format("YYYYMMDD");
      const count = await this.db.getQuery(`
                SELECT COUNT(*) as count
                FROM sales
                WHERE DATE(sale_date) = DATE('now')
            `);

      const sequence = String(count.count + 1).padStart(4, "0");
      return `DOM${today}${sequence}`;
    } catch (error) {
      console.error("Generate receipt number error:", error);
      return `DOM${Date.now()}`;
    }
  }

  async getWeeklySummary(startDate) {
    try {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      const endDateStr = endDate.toISOString().split("T")[0];

      const summary = await this.db.getQuery(
        `SELECT 
          COUNT(*) as total_sales,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as average_sale,
          COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as cash_sales,
          COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as card_sales
        FROM sales 
        WHERE DATE(sale_date) BETWEEN ? AND ?`,
        [startDate, endDateStr]
      );

      const dailyBreakdown = await this.db.allQuery(
        `SELECT 
          DATE(sale_date) as date,
          COUNT(*) as sales_count,
          SUM(total_amount) as revenue
        FROM sales 
        WHERE DATE(sale_date) BETWEEN ? AND ?
        GROUP BY DATE(sale_date)
        ORDER BY date`,
        [startDate, endDateStr]
      );

      return {
        success: true,
        data: {
          period: { start: startDate, end: endDateStr },
          summary,
          daily_breakdown: dailyBreakdown,
        },
      };
    } catch (error) {
      console.error("Get weekly summary error:", error);
      return { success: false, error: error.message };
    }
  }

  async getMonthlySummary(year, month) {
    try {
      const monthStr = `${year}-${month.toString().padStart(2, "0")}`;

      const summary = await this.db.getQuery(
        `SELECT 
          COUNT(*) as total_sales,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as average_sale,
          COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as cash_sales,
          COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as card_sales
        FROM sales 
        WHERE strftime('%Y-%m', sale_date) = ?`,
        [monthStr]
      );

      const dailyBreakdown = await this.db.allQuery(
        `SELECT 
          DATE(sale_date) as date,
          COUNT(*) as sales_count,
          SUM(total_amount) as revenue
        FROM sales 
        WHERE strftime('%Y-%m', sale_date) = ?
        GROUP BY DATE(sale_date)
        ORDER BY date`,
        [monthStr]
      );

      const topProducts = await this.db.allQuery(
        `SELECT p.product_name, SUM(si.quantity) as total_sold, 
                SUM(si.total_price) as revenue
        FROM sale_items si
        JOIN products p ON si.product_id = p.product_id
        JOIN sales s ON si.sale_id = s.sale_id
        WHERE strftime('%Y-%m', s.sale_date) = ?
        GROUP BY p.product_id, p.product_name
        ORDER BY total_sold DESC
        LIMIT 10`,
        [monthStr]
      );

      return {
        success: true,
        data: {
          period: { year, month, month_str: monthStr },
          summary,
          daily_breakdown: dailyBreakdown,
          top_products: topProducts,
        },
      };
    } catch (error) {
      console.error("Get monthly summary error:", error);
      return { success: false, error: error.message };
    }
  }

  async getTopSellingProducts(period = "30days") {
    try {
      let dateCondition = "";
      let params = [];

      switch (period) {
        case "today":
          dateCondition = "WHERE DATE(s.sale_date) = DATE('now')";
          break;
        case "week":
          dateCondition = "WHERE s.sale_date >= date('now', '-7 days')";
          break;
        case "month":
          dateCondition = "WHERE s.sale_date >= date('now', '-30 days')";
          break;
        case "all":
          dateCondition = "";
          break;
        default:
          dateCondition = "WHERE s.sale_date >= date('now', '-30 days')";
      }

      const topProducts = await this.db.allQuery(
        `SELECT p.product_name, p.barcode, c.category_name,
                SUM(si.quantity) as total_sold,
                SUM(si.total_price) as total_revenue,
                COUNT(DISTINCT s.sale_id) as sales_count,
                AVG(si.unit_price) as avg_price
        FROM sale_items si
        JOIN products p ON si.product_id = p.product_id
        JOIN sales s ON si.sale_id = s.sale_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        ${dateCondition}
        GROUP BY p.product_id, p.product_name, p.barcode, c.category_name
        ORDER BY total_sold DESC
        LIMIT 20`,
        params
      );

      return {
        success: true,
        data: {
          period,
          products: topProducts,
        },
      };
    } catch (error) {
      console.error("Get top selling products error:", error);
      return { success: false, error: error.message };
    }
  }

  async getSalesByUser(userId, filters = {}) {
    try {
      let query = `
        SELECT s.sale_id, s.total_amount, s.payment_method, s.sale_date,
               s.receipt_number, COUNT(si.item_id) as item_count
        FROM sales s
        LEFT JOIN sale_items si ON s.sale_id = si.sale_id
        WHERE s.user_id = ?
      `;
      let params = [userId];

      if (filters.start_date) {
        query += " AND DATE(s.sale_date) >= ?";
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        query += " AND DATE(s.sale_date) <= ?";
        params.push(filters.end_date);
      }

      if (filters.payment_method) {
        query += " AND s.payment_method = ?";
        params.push(filters.payment_method);
      }

      query += " GROUP BY s.sale_id ORDER BY s.sale_date DESC";

      if (filters.limit) {
        query += " LIMIT ?";
        params.push(filters.limit);
      }

      const sales = await this.db.allQuery(query, params);

      // Get user summary
      const summaryQuery = `
        SELECT 
          COUNT(s.sale_id) as total_sales,
          SUM(s.total_amount) as total_revenue,
          AVG(s.total_amount) as average_sale
        FROM sales s
        WHERE s.user_id = ?
        ${filters.start_date ? "AND DATE(s.sale_date) >= ?" : ""}
        ${filters.end_date ? "AND DATE(s.sale_date) <= ?" : ""}
      `;

      const summaryParams = [userId];
      if (filters.start_date) summaryParams.push(filters.start_date);
      if (filters.end_date) summaryParams.push(filters.end_date);

      const summary = await this.db.getQuery(summaryQuery, summaryParams);

      return {
        success: true,
        data: {
          sales,
          summary: {
            total_sales: summary.total_sales || 0,
            total_revenue: summary.total_revenue || 0,
            average_sale: summary.average_sale || 0,
          },
        },
      };
    } catch (error) {
      console.error("Get sales by user error:", error);
      return { success: false, error: error.message };
    }
  }

  async voidSale(saleId, reason) {
    try {
      // Check if sale exists
      const sale = await this.db.getQuery(
        "SELECT * FROM sales WHERE sale_id = ?",
        [saleId]
      );

      if (!sale) {
        return { success: false, error: "Sale not found" };
      }

      // Get sale items to restore stock
      const saleItems = await this.db.allQuery(
        "SELECT * FROM sale_items WHERE sale_id = ?",
        [saleId]
      );

      await this.db.beginTransaction();

      try {
        // Restore stock for each item
        for (const item of saleItems) {
          if (this.inventoryService) {
            await this.inventoryService.adjustStock(
              item.product_id,
              item.quantity,
              `Sale void: ${reason}`
            );
          }
        }

        // Mark sale as voided (we don't delete for audit purposes)
        await this.db.runQuery("UPDATE sales SET notes = ? WHERE sale_id = ?", [
          `VOIDED: ${reason}`,
          saleId,
        ]);

        await this.db.commitTransaction();

        return {
          success: true,
          message: "Sale voided successfully",
          data: { voided_amount: sale.total_amount },
        };
      } catch (error) {
        await this.db.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      console.error("Void sale error:", error);
      return { success: false, error: error.message };
    }
  }

  async deleteSale(saleId) {
    try {
      // Check if sale exists
      const sale = await this.db.getQuery(
        "SELECT * FROM sales WHERE sale_id = ?",
        [saleId]
      );

      if (!sale) {
        return { success: false, error: "Sale not found" };
      }

      // Get sale items to restore stock
      const saleItems = await this.db.allQuery(
        "SELECT * FROM sale_items WHERE sale_id = ?",
        [saleId]
      );

      await this.db.beginTransaction();

      try {
        // Restore stock for each item
        for (const item of saleItems) {
          if (this.inventoryService) {
            await this.inventoryService.adjustStock(
              item.product_id,
              item.quantity,
              `Sale deleted - stock restored`
            );
          }

          // Remove inventory transaction for this sale
          await this.db.runQuery(
            "DELETE FROM inventory_transactions WHERE reference_id = ? AND transaction_type = 'sale'",
            [saleId]
          );
        }

        // Delete sale items first (foreign key constraint)
        await this.db.runQuery("DELETE FROM sale_items WHERE sale_id = ?", [
          saleId,
        ]);

        // Delete the sale record
        await this.db.runQuery("DELETE FROM sales WHERE sale_id = ?", [
          saleId,
        ]);

        await this.db.commitTransaction();

        return {
          success: true,
          message: "Sale deleted successfully",
          data: { 
            deleted_sale_id: saleId,
            restored_amount: sale.total_amount 
          },
        };
      } catch (error) {
        await this.db.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      console.error("Delete sale error:", error);
      return { success: false, error: error.message };
    }
  }

  async getReceiptData(saleId) {
    try {
      const saleDetails = await this.getSaleDetails(saleId);
      if (!saleDetails.success) {
        return saleDetails;
      }

      // Get business settings
      const businessSettings = await this.db.allQuery(
        "SELECT setting_key, setting_value FROM settings WHERE setting_key IN (?, ?, ?, ?, ?)",
        [
          "business_name",
          "business_phone",
          "business_address",
          "currency",
          "receipt_footer",
        ]
      );

      const settings = {};
      businessSettings.forEach((setting) => {
        settings[setting.setting_key] = setting.setting_value;
      });

      return {
        success: true,
        data: {
          sale: saleDetails.data,
          business: settings,
        },
      };
    } catch (error) {
      console.error("Get receipt data error:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SalesService;
