const bcrypt = require("bcrypt");

class AuthService {
  constructor(databaseManager) {
    this.db = databaseManager;
    this.currentUser = null;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.sessionTimer = null;
  }

  async login(pin, role) {
    try {
      console.log(`Login attempt - PIN: "${pin}", Role: "${role}"`);

      // Validate input
      if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        console.log(
          `PIN validation failed: length=${
            pin?.length
          }, isDigits=${/^\d{4}$/.test(pin)}`
        );
        return { success: false, error: "PIN must be exactly 4 digits" };
      }

      if (!role || !["admin", "cashier"].includes(role)) {
        console.log(`Role validation failed: "${role}"`);
        return { success: false, error: "Invalid role specified" };
      }

      // Find all users with the specified role
      const users = await this.db.allQuery(
        "SELECT * FROM users WHERE role = ? AND is_active = 1",
        [role]
      );

      if (!users || users.length === 0) {
        console.log(`No users found for role: "${role}"`);
        return { success: false, error: "No users found for this role" };
      }

      console.log(`Found ${users.length} user(s) with role: ${role}`);

      // Try to find a user with matching PIN
      let authenticatedUser = null;
      for (const user of users) {
        console.log(
          `Checking PIN for user: ${user.username} (ID: ${user.user_id})`
        );
        const isValidPin = await bcrypt.compare(pin, user.pin_hash);

        if (isValidPin) {
          console.log(`✅ PIN match found for user: ${user.username}`);
          authenticatedUser = user;
          break;
        } else {
          console.log(`❌ PIN mismatch for user: ${user.username}`);
        }
      }

      if (!authenticatedUser) {
        // Log failed login attempts for all users checked
        for (const user of users) {
          await this.logFailedLogin(user.user_id);
        }
        return {
          success: false,
          error: "Invalid PIN for this role",
        };
      }

      const user = authenticatedUser;

      // Update last login
      await this.db.runQuery(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?",
        [user.user_id]
      );

      // Set current user
      this.currentUser = {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        login_time: new Date(),
      };

      // Start session timer
      this.startSessionTimer();

      return {
        success: true,
        user: {
          user_id: user.user_id,
          username: user.username,
          role: user.role,
        },
      };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Login failed" };
    }
  }

  async logout() {
    try {
      if (this.sessionTimer) {
        clearTimeout(this.sessionTimer);
        this.sessionTimer = null;
      }

      this.currentUser = null;
      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      return { success: false, error: "Logout failed" };
    }
  }

  async getCurrentUser() {
    return this.currentUser;
  }

  async isAuthenticated() {
    return this.currentUser !== null;
  }

  async hasRole(role) {
    return this.currentUser && this.currentUser.role === role;
  }

  async isAdmin() {
    return this.hasRole("admin");
  }

  async isCashier() {
    return this.hasRole("cashier");
  }

  async changePin(currentPin, newPin) {
    try {
      if (!this.currentUser) {
        return { success: false, error: "User not authenticated" };
      }

      // Validate new PIN
      if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        return { success: false, error: "New PIN must be exactly 4 digits" };
      }

      // Get current user data
      const user = await this.db.getQuery(
        "SELECT * FROM users WHERE user_id = ?",
        [this.currentUser.user_id]
      );

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Verify current PIN
      const isValidPin = await bcrypt.compare(currentPin, user.pin_hash);
      if (!isValidPin) {
        return { success: false, error: "Current PIN is incorrect" };
      }

      // Hash new PIN
      const newPinHash = await bcrypt.hash(newPin, 10);

      // Update PIN
      await this.db.runQuery(
        "UPDATE users SET pin_hash = ? WHERE user_id = ?",
        [newPinHash, this.currentUser.user_id]
      );

      return { success: true, message: "PIN changed successfully" };
    } catch (error) {
      console.error("Change PIN error:", error);
      return { success: false, error: "Failed to change PIN" };
    }
  }

  startSessionTimer() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    this.sessionTimer = setTimeout(() => {
      this.logout();
    }, this.sessionTimeout);
  }

  resetSessionTimer() {
    if (this.currentUser) {
      this.startSessionTimer();
    }
  }

  async logFailedLogin(userId) {
    try {
      // Log failed login attempt (you can extend this to track multiple attempts)
      console.log(
        `Failed login attempt for user ID: ${userId} at ${new Date()}`
      );
    } catch (error) {
      console.error("Error logging failed login:", error);
    }
  }

  async getSessionInfo() {
    if (!this.currentUser) {
      return null;
    }

    const sessionAge = Date.now() - this.currentUser.login_time.getTime();
    const timeRemaining = this.sessionTimeout - sessionAge;

    return {
      user: this.currentUser,
      sessionAge: Math.floor(sessionAge / 1000), // seconds
      timeRemaining: Math.floor(timeRemaining / 1000), // seconds
    };
  }
}

module.exports = AuthService;
