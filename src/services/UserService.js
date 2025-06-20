const bcrypt = require("bcrypt");

class UserService {
  constructor(db) {
    this.db = db;
  }

  async getUsers() {
    try {
      const users = await this.db.allQuery(`
        SELECT user_id, username, role, created_at, last_login, is_active
        FROM users
        ORDER BY created_at ASC
      `);

      return { success: true, data: users };
    } catch (error) {
      console.error("Get users error:", error);
      return { success: false, error: error.message };
    }
  }

  async getUserById(userId) {
    try {
      const user = await this.db.getQuery(
        `SELECT user_id, username, role, created_at, last_login, is_active
         FROM users WHERE user_id = ?`,
        [userId]
      );

      if (!user) {
        return { success: false, error: "User not found" };
      }

      return { success: true, data: user };
    } catch (error) {
      console.error("Get user by ID error:", error);
      return { success: false, error: error.message };
    }
  }

  async updateUser(userId, userData) {
    try {
      const { username, role } = userData;

      // Check if user exists
      const existingUser = await this.db.getQuery(
        "SELECT * FROM users WHERE user_id = ?",
        [userId]
      );

      if (!existingUser) {
        return { success: false, error: "User not found" };
      }

      // Check if username is being changed and if it already exists
      if (username && username !== existingUser.username) {
        const usernameExists = await this.db.getQuery(
          "SELECT * FROM users WHERE username = ? AND user_id != ?",
          [username, userId]
        );

        if (usernameExists) {
          return {
            success: false,
            error: "Username already exists",
          };
        }
      }

      // Validate role
      if (role && !["admin", "cashier"].includes(role)) {
        return { success: false, error: "Invalid role" };
      }

      await this.db.runQuery(
        "UPDATE users SET username = ?, role = ? WHERE user_id = ?",
        [username || existingUser.username, role || existingUser.role, userId]
      );

      return { success: true, message: "User updated successfully" };
    } catch (error) {
      console.error("Update user error:", error);
      return { success: false, error: error.message };
    }
  }

  async changePin(userId, newPin) {
    try {
      // Validate PIN
      if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        return { success: false, error: "PIN must be exactly 4 digits" };
      }

      // Check if user exists
      const user = await this.db.getQuery(
        "SELECT * FROM users WHERE user_id = ?",
        [userId]
      );

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Hash new PIN
      const pinHash = await bcrypt.hash(newPin, 10);

      await this.db.runQuery(
        "UPDATE users SET pin_hash = ? WHERE user_id = ?",
        [pinHash, userId]
      );

      return { success: true, message: "PIN changed successfully" };
    } catch (error) {
      console.error("Change PIN error:", error);
      return { success: false, error: error.message };
    }
  }

  async toggleUserStatus(userId) {
    try {
      const user = await this.db.getQuery(
        "SELECT * FROM users WHERE user_id = ?",
        [userId]
      );

      if (!user) {
        return { success: false, error: "User not found" };
      }

      const newStatus = !user.is_active;

      await this.db.runQuery(
        "UPDATE users SET is_active = ? WHERE user_id = ?",
        [newStatus, userId]
      );

      return {
        success: true,
        message: `User ${newStatus ? "activated" : "deactivated"} successfully`,
        data: { is_active: newStatus },
      };
    } catch (error) {
      console.error("Toggle user status error:", error);
      return { success: false, error: error.message };
    }
  }

  async getUserActivity(userId, filters = {}) {
    try {
      let query = `
        SELECT s.sale_id, s.total_amount, s.payment_method, s.sale_date, s.receipt_number,
               COUNT(si.item_id) as item_count
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

      query += " GROUP BY s.sale_id ORDER BY s.sale_date DESC";

      if (filters.limit) {
        query += " LIMIT ?";
        params.push(filters.limit);
      }

      const activities = await this.db.allQuery(query, params);

      // Get summary statistics
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
          activities,
          summary: {
            total_sales: summary.total_sales || 0,
            total_revenue: summary.total_revenue || 0,
            average_sale: summary.average_sale || 0,
          },
        },
      };
    } catch (error) {
      console.error("Get user activity error:", error);
      return { success: false, error: error.message };
    }
  }

  async addUser(userData) {
    try {
      console.log("🔍 UserService.addUser called with:", {
        ...userData,
        pin: "****",
      });

      const { username, pin, role } = userData;

      // Validation
      if (!username || !pin || !role) {
        console.log("❌ Validation failed: missing required fields");
        return {
          success: false,
          error: "Username, PIN, and role are required",
        };
      }

      // Validate username
      if (username.length < 3) {
        console.log("❌ Username validation failed: too short");
        return {
          success: false,
          error: "Username must be at least 3 characters long",
        };
      }

      // Validate PIN
      if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        console.log("❌ PIN validation failed:", {
          length: pin?.length,
          isDigits: /^\d{4}$/.test(pin),
        });
        return { success: false, error: "PIN must be exactly 4 digits" };
      }

      // Validate role
      if (!["admin", "cashier"].includes(role)) {
        console.log("❌ Role validation failed:", role);
        return {
          success: false,
          error: "Role must be either 'admin' or 'cashier'",
        };
      }

      console.log("✅ All validations passed, checking for existing user...");

      // Check if username already exists
      const existingUser = await this.db.getQuery(
        "SELECT * FROM users WHERE username = ?",
        [username]
      );

      if (existingUser) {
        console.log("❌ Username already exists:", username);
        return {
          success: false,
          error: "Username already exists",
        };
      }

      console.log("✅ Username is unique, hashing PIN...");

      // Hash PIN
      const pinHash = await bcrypt.hash(pin, 10);
      console.log("✅ PIN hashed successfully");

      // Insert new user
      console.log("🔍 Inserting user into database...");
      const result = await this.db.runQuery(
        `INSERT INTO users (username, pin_hash, role, is_active) 
         VALUES (?, ?, ?, 1)`,
        [username, pinHash, role]
      );

      console.log("✅ User inserted successfully:", {
        id: result.id,
        changes: result.changes,
      });

      return {
        success: true,
        message: `User '${username}' created successfully`,
        data: { user_id: result.id, username, role },
      };
    } catch (error) {
      console.error("❌ Add user error:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = UserService;
