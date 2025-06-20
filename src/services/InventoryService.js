const { v4: uuidv4 } = require("uuid");
const XLSX = require("xlsx");

class InventoryService {
  constructor(databaseManager) {
    this.db = databaseManager;
  }

  async getProducts(filters = {}) {
    try {
      let query = `
                SELECT p.*, c.category_name 
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id
            `;
      let params = [];
      let conditions = [];

      // Apply filters
      if (filters.search) {
        conditions.push("(p.product_name LIKE ? OR p.barcode LIKE ?)");
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      if (filters.category_id) {
        conditions.push("p.category_id = ?");
        params.push(filters.category_id);
      }

      if (filters.low_stock) {
        conditions.push("p.stock_quantity <= p.minimum_stock");
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " ORDER BY p.product_name ASC";

      if (filters.limit) {
        query += " LIMIT ?";
        params.push(filters.limit);
      }

      const products = await this.db.allQuery(query, params);
      return { success: true, data: products };
    } catch (error) {
      console.error("Get products error:", error);
      return { success: false, error: error.message };
    }
  }

  async getProductById(productId) {
    try {
      const product = await this.db.getQuery(
        `
                SELECT p.*, c.category_name 
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id
                WHERE p.product_id = ?
            `,
        [productId]
      );

      return product;
    } catch (error) {
      console.error("Get product by ID error:", error);
      return null;
    }
  }

  async getProductByBarcode(barcode) {
    if (!barcode) return null;

    const query = `
        SELECT * FROM products 
        WHERE barcode = ?
    `;

    try {
      const result = await this.db.getQuery(query, [barcode]);
      return result || null;
    } catch (error) {
      console.error("Error getting product by barcode:", error);
      return null;
    }
  }

  async addProduct(productData) {
    try {
      const {
        product_name,
        category_id,
        barcode,
        purchase_price = 0,
        selling_price,
        stock_quantity = 0,
        minimum_stock = 5,
      } = productData;

      // Validation
      if (!product_name || !selling_price) {
        return {
          success: false,
          error: "Product name and selling price are required",
        };
      }

      if (selling_price <= 0) {
        return {
          success: false,
          error: "Selling price must be greater than 0",
        };
      }

      // Check if barcode already exists
      if (barcode) {
        const existingProduct = await this.getProductByBarcode(barcode);
        if (existingProduct) {
          return {
            success: false,
            error: "Product with this barcode already exists",
          };
        }
      }

      await this.db.beginTransaction();

      try {
        // Insert product
        const result = await this.db.runQuery(
          `
                    INSERT INTO products (
                        product_name, category_id, barcode, purchase_price, 
                        selling_price, stock_quantity, minimum_stock
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          [
            product_name,
            category_id,
            barcode,
            purchase_price,
            selling_price,
            stock_quantity,
            minimum_stock,
          ]
        );

        // Record initial stock transaction if stock > 0
        if (stock_quantity > 0) {
          await this.db.runQuery(
            `
                        INSERT INTO inventory_transactions (
                            product_id, transaction_type, quantity_change, notes
                        ) VALUES (?, 'initial', ?, 'Initial stock')
                    `,
            [result.id, stock_quantity]
          );
        }

        await this.db.commitTransaction();

        return {
          success: true,
          data: { product_id: result.id },
          message: "Product added successfully",
        };
      } catch (error) {
        await this.db.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      console.error("Add product error:", error);
      return { success: false, error: error.message };
    }
  }

  async updateProduct(productId, productData) {
    try {
      const {
        product_name,
        category_id,
        barcode,
        purchase_price,
        selling_price,
        minimum_stock,
      } = productData;

      // Check if product exists
      const existingProduct = await this.getProductById(productId);
      if (!existingProduct) {
        return { success: false, error: "Product not found" };
      }

      // Check if barcode is being changed and if it already exists
      if (barcode && barcode !== existingProduct.barcode) {
        const productWithBarcode = await this.getProductByBarcode(barcode);
        if (productWithBarcode && productWithBarcode.product_id !== productId) {
          return {
            success: false,
            error: "Product with this barcode already exists",
          };
        }
      }

      // Update product
      await this.db.runQuery(
        `
                UPDATE products SET 
                    product_name = ?, 
                    category_id = ?, 
                    barcode = ?, 
                    purchase_price = ?, 
                    selling_price = ?, 
                    minimum_stock = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
            `,
        [
          product_name,
          category_id,
          barcode,
          purchase_price,
          selling_price,
          minimum_stock,
          productId,
        ]
      );

      return { success: true, message: "Product updated successfully" };
    } catch (error) {
      console.error("Update product error:", error);
      return { success: false, error: error.message };
    }
  }

  async adjustStock(productId, quantityChange, reason = "Manual adjustment") {
    try {
      const product = await this.getProductById(productId);
      if (!product) {
        return { success: false, error: "Product not found" };
      }

      const newQuantity = product.stock_quantity + quantityChange;
      if (newQuantity < 0) {
        return { success: false, error: "Stock cannot be negative" };
      }

      await this.db.beginTransaction();

      try {
        // Update product stock
        await this.db.runQuery(
          "UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?",
          [newQuantity, productId]
        );

        // Record transaction
        await this.db.runQuery(
          `INSERT INTO inventory_transactions (
                        product_id, transaction_type, quantity_change, notes
          ) VALUES (?, 'adjustment', ?, ?)`,
          [productId, quantityChange, reason]
        );

        await this.db.commitTransaction();

        return {
          success: true,
          message: "Stock adjusted successfully",
          data: { new_quantity: newQuantity },
        };
      } catch (error) {
        await this.db.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      console.error("Adjust stock error:", error);
      return { success: false, error: error.message };
    }
  }

  async reduceStock(productId, quantity, referenceId = null) {
    try {
      const product = await this.db.getQuery(
        "SELECT * FROM products WHERE product_id = ?",
        [productId]
      );

      if (!product) {
        throw new Error("Product not found");
      }

      if (product.stock_quantity < quantity) {
        throw new Error("Insufficient stock");
      }

      const newQuantity = product.stock_quantity - quantity;

      await this.db.runQuery(
        "UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?",
        [newQuantity, productId]
      );

      await this.db.runQuery(
        `
        INSERT INTO inventory_transactions (
          product_id, transaction_type, quantity_change, reference_id
        ) VALUES (?, 'sale', ?, ?)
      `,
        [productId, -quantity, referenceId]
      );

      return { success: true, new_quantity: newQuantity };
    } catch (error) {
      console.error("Reduce stock error:", error);
      throw error;
    }
  }

  async getCategories() {
    try {
      return await this.db.allQuery(
        "SELECT * FROM categories ORDER BY category_name ASC"
      );
    } catch (error) {
      console.error("Get categories error:", error);
      return [];
    }
  }

  async addCategory(categoryData) {
    try {
      const { category_name, description = "" } = categoryData;

      if (!category_name) {
        return { success: false, error: "Category name is required" };
      }

      // Check if category already exists
      const existingCategory = await this.db.getQuery(
        "SELECT * FROM categories WHERE category_name = ?",
        [category_name]
      );

      if (existingCategory) {
        return {
          success: false,
          error: "Category with this name already exists",
        };
      }

      const result = await this.db.runQuery(
        "INSERT INTO categories (category_name, description) VALUES (?, ?)",
        [category_name, description]
      );

      return {
        success: true,
        data: { category_id: result.id },
        message: "Category added successfully",
      };
    } catch (error) {
      console.error("Add category error:", error);
      return { success: false, error: error.message };
    }
  }

  async updateCategory(categoryId, categoryData) {
    try {
      const { category_name, description } = categoryData;

      // Check if category exists
      const existingCategory = await this.db.getQuery(
        "SELECT * FROM categories WHERE category_id = ?",
        [categoryId]
      );

      if (!existingCategory) {
        return { success: false, error: "Category not found" };
      }

      // Check if new name already exists (if name is being changed)
      if (category_name && category_name !== existingCategory.category_name) {
        const nameExists = await this.db.getQuery(
          "SELECT * FROM categories WHERE category_name = ? AND category_id != ?",
          [category_name, categoryId]
        );

        if (nameExists) {
          return {
            success: false,
            error: "Category with this name already exists",
          };
        }
      }

      await this.db.runQuery(
        "UPDATE categories SET category_name = ?, description = ? WHERE category_id = ?",
        [category_name, description, categoryId]
      );

      return { success: true, message: "Category updated successfully" };
    } catch (error) {
      console.error("Update category error:", error);
      return { success: false, error: error.message };
    }
  }

  async deleteCategory(categoryId) {
    try {
      // Check if category exists
      const existingCategory = await this.db.getQuery(
        "SELECT * FROM categories WHERE category_id = ?",
        [categoryId]
      );

      if (!existingCategory) {
        return { success: false, error: "Category not found" };
      }

      // Check if category has products
      const productsCount = await this.db.getQuery(
        "SELECT COUNT(*) as count FROM products WHERE category_id = ?",
        [categoryId]
      );

      if (productsCount.count > 0) {
        return {
          success: false,
          error: "Cannot delete category that has products",
        };
      }

      await this.db.runQuery("DELETE FROM categories WHERE category_id = ?", [
        categoryId,
      ]);

      return { success: true, message: "Category deleted successfully" };
    } catch (error) {
      console.error("Delete category error:", error);
      return { success: false, error: error.message };
    }
  }

  async getLowStockProducts() {
    try {
      return await this.db.allQuery(`
                SELECT p.*, c.category_name 
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id
                WHERE p.stock_quantity <= p.minimum_stock
                ORDER BY (p.stock_quantity - p.minimum_stock) ASC
            `);
    } catch (error) {
      console.error("Get low stock products error:", error);
      return [];
    }
  }

  async getInventoryReport() {
    try {
      const totalProducts = await this.db.getQuery(
        "SELECT COUNT(*) as count FROM products"
      );
      const totalValue = await this.db.getQuery(`
                SELECT SUM(stock_quantity * selling_price) as total_value 
                FROM products
            `);
      const lowStockCount = await this.db.getQuery(`
                SELECT COUNT(*) as count 
                FROM products 
                WHERE stock_quantity <= minimum_stock
            `);

      const categoryBreakdown = await this.db.allQuery(`
                SELECT c.category_name, 
                       COUNT(p.product_id) as product_count,
                       SUM(p.stock_quantity) as total_quantity,
                       SUM(p.stock_quantity * p.selling_price) as total_value
                FROM categories c
                LEFT JOIN products p ON c.category_id = p.category_id
                GROUP BY c.category_id, c.category_name
                ORDER BY total_value DESC
            `);

      return {
        success: true,
        data: {
          total_products: totalProducts.count,
          total_value: totalValue.total_value || 0,
          low_stock_count: lowStockCount.count,
          category_breakdown: categoryBreakdown,
        },
      };
    } catch (error) {
      console.error("Get inventory report error:", error);
      return { success: false, error: error.message };
    }
  }

  async getInventoryTransactions(filters = {}) {
    try {
      let query = `
        SELECT it.*, p.product_name, p.barcode
                FROM inventory_transactions it
                JOIN products p ON it.product_id = p.product_id
            `;
      let params = [];
      let conditions = [];

      if (filters.product_id) {
        conditions.push("it.product_id = ?");
        params.push(filters.product_id);
      }

      if (filters.transaction_type) {
        conditions.push("it.transaction_type = ?");
        params.push(filters.transaction_type);
      }

      if (filters.start_date) {
        conditions.push("DATE(it.created_at) >= ?");
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        conditions.push("DATE(it.created_at) <= ?");
        params.push(filters.end_date);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " ORDER BY it.created_at DESC";

      if (filters.limit) {
        query += " LIMIT ?";
        params.push(filters.limit);
      }

      const transactions = await this.db.allQuery(query, params);
      return { success: true, data: transactions };
    } catch (error) {
      console.error("Get inventory transactions error:", error);
      return { success: false, error: error.message };
    }
  }

  async deleteProduct(productId) {
    try {
      // Check if product exists
      const existingProduct = await this.getProductById(productId);
      if (!existingProduct) {
        return { success: false, error: "Product not found" };
      }

      // Check if product has been sold (has sale items)
      const saleItems = await this.db.getQuery(
        "SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?",
        [productId]
      );

      if (saleItems.count > 0) {
        return {
          success: false,
          error: "Cannot delete product that has sales history",
        };
      }

      await this.db.beginTransaction();

      try {
        // Delete inventory transactions
        await this.db.runQuery(
          "DELETE FROM inventory_transactions WHERE product_id = ?",
          [productId]
        );

        // Delete product
        await this.db.runQuery("DELETE FROM products WHERE product_id = ?", [
          productId,
        ]);

        await this.db.commitTransaction();

        return { success: true, message: "Product deleted successfully" };
      } catch (error) {
        await this.db.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      console.error("Delete product error:", error);
      return { success: false, error: error.message };
    }
  }

  async bulkUploadProducts(fileData, fileType = "csv") {
    const results = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Parse file data based on type
      let products;
      if (fileType === "excel" || fileType === "xlsx") {
        products = this.parseExcel(fileData);
      } else {
        products = this.parseCSV(fileData);
      }

      if (products.length === 0) {
        throw new Error("No valid products found in file");
      }

      // Get all categories for mapping
      const categoriesResult = await this.getCategories();
      const categories = categoriesResult.success ? categoriesResult.data : [];

      // Validate and insert products
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const rowNumber = i + 2; // +2 because of header row and 0-based index

        try {
          // Validate product data
          const validationError = this.validateProductData(product);
          if (validationError) {
            results.failed++;
            results.errors.push(`Row ${rowNumber}: ${validationError}`);
            continue;
          }

          // Map category name to category_id
          if (product.category) {
            const category = categories.find(
              (c) =>
                c.category_name.toLowerCase() === product.category.toLowerCase()
            );
            if (category) {
              product.category_id = category.category_id;
            } else {
              // Create new category if it doesn't exist
              try {
                const newCategoryResult = await this.addCategory({
                  category_name: product.category,
                  description: `Auto-created from bulk upload`,
                });
                if (newCategoryResult.success) {
                  product.category_id = newCategoryResult.data.category_id;
                  // Add to categories array for future products
                  categories.push({
                    category_id: newCategoryResult.data.category_id,
                    category_name: product.category,
                  });
                } else {
                  product.category_id = null;
                }
              } catch (error) {
                product.category_id = null;
              }
            }
          } else {
            product.category_id = null;
          }

          // Check if product with same barcode already exists
          if (product.barcode) {
            const existingProduct = await this.getProductByBarcode(
              product.barcode
            );
            if (existingProduct) {
              results.failed++;
              results.errors.push(
                `Row ${rowNumber}: Product with barcode ${product.barcode} already exists`
              );
              continue;
            }
          }

          // Prepare product data for addProduct
          const productData = {
            product_name: product.product_name,
            category_id: product.category_id,
            barcode: product.barcode,
            purchase_price: product.purchase_price || 0,
            selling_price: product.selling_price,
            stock_quantity: product.stock_quantity || 0,
            minimum_stock: product.minimum_stock || 5,
          };

          // Insert product
          const addResult = await this.addProduct(productData);
          if (addResult.success) {
            results.successful++;
          } else {
            results.failed++;
            results.errors.push(`Row ${rowNumber}: ${addResult.error}`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Row ${rowNumber}: ${error.message}`);
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Bulk upload failed: ${error.message}`);
    }
  }

  parseCSV(csvData) {
    const lines = csvData.trim().split("\n");
    if (lines.length < 2) {
      throw new Error(
        "CSV file must contain at least a header row and one data row"
      );
    }

    // Parse header row
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    // Validate required headers
    const requiredHeaders = ["product_name", "category", "selling_price"];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
    }

    const products = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = this.parseCSVLine(line);
      if (values.length !== headers.length) {
        throw new Error(`Row ${i + 1}: Column count mismatch`);
      }

      const product = {};
      headers.forEach((header, index) => {
        const value = values[index] ? values[index].trim() : "";
        // Convert empty barcode to null to avoid UNIQUE constraint issues
        if (header === "barcode" && !value) {
          product[header] = null;
        } else {
          product[header] = value;
        }
      });

      // Convert and validate data types
      product.selling_price = parseFloat(product.selling_price) || 0;
      product.purchase_price = parseFloat(product.purchase_price) || 0;
      product.stock_quantity = parseInt(product.stock_quantity) || 0;
      product.minimum_stock = parseInt(product.minimum_stock) || 5;

      products.push(product);
    }

    return products;
  }

  parseExcel(fileBuffer) {
    try {
      // Read the Excel file
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });

      // Get the first worksheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("Excel file must contain at least one worksheet");
      }

      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error(
          "Excel file must contain at least a header row and one data row"
        );
      }

      // Parse header row (convert to lowercase for consistency)
      const headers = jsonData[0].map((h) =>
        h ? h.toString().trim().toLowerCase() : ""
      );

      // Validate required headers
      const requiredHeaders = ["product_name", "category", "selling_price"];
      const missingHeaders = requiredHeaders.filter(
        (h) => !headers.includes(h)
      );
      if (missingHeaders.length > 0) {
        throw new Error(
          `Missing required columns: ${missingHeaders.join(", ")}`
        );
      }

      const products = [];

      // Parse data rows
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue; // Skip empty rows

        const product = {};
        headers.forEach((header, index) => {
          const value = row[index] ? row[index].toString().trim() : "";
          // Convert empty barcode to null to avoid UNIQUE constraint issues
          if (header === "barcode" && !value) {
            product[header] = null;
          } else {
            product[header] = value;
          }
        });

        // Skip rows where product_name is empty
        if (!product.product_name) continue;

        // Convert and validate data types
        product.selling_price = parseFloat(product.selling_price) || 0;
        product.purchase_price = parseFloat(product.purchase_price) || 0;
        product.stock_quantity = parseInt(product.stock_quantity) || 0;
        product.minimum_stock = parseInt(product.minimum_stock) || 5;

        products.push(product);
      }

      return products;
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  validateProductData(product) {
    // Required fields validation
    if (!product.product_name || product.product_name.trim() === "") {
      return "Product name is required";
    }

    if (!product.category || product.category.trim() === "") {
      return "Category is required";
    }

    if (!product.selling_price || product.selling_price <= 0) {
      return "Valid selling price is required";
    }

    // Optional field validation
    if (product.barcode && product.barcode.length > 50) {
      return "Barcode must be 50 characters or less";
    }

    if (product.product_name.length > 200) {
      return "Product name must be 200 characters or less";
    }

    if (product.category.length > 100) {
      return "Category must be 100 characters or less";
    }

    if (product.purchase_price < 0) {
      return "Purchase price cannot be negative";
    }

    if (product.stock_quantity < 0) {
      return "Stock quantity cannot be negative";
    }

    if (product.minimum_stock < 0) {
      return "Minimum stock cannot be negative";
    }

    return null; // No validation errors
  }

  generateTemplate(format = "csv") {
    const headers = [
      "product_name",
      "category",
      "barcode",
      "purchase_price",
      "selling_price",
      "stock_quantity",
      "minimum_stock",
    ];

    const sampleData = [
      ["Sample Product 1", "Electronics", "1234567890123", 10.5, 15.0, 100, 10],
      ["Sample Product 2", "Groceries", "9876543210987", 5.25, 8.5, 50, 5],
      ["Sample Product 3", "Clothing", "", 25.0, 40.0, 25, 5],
    ];

    if (format === "excel" || format === "xlsx") {
      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      const worksheetData = [headers, ...sampleData];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Set column widths
      const columnWidths = [
        { wch: 20 }, // product_name
        { wch: 15 }, // category
        { wch: 15 }, // barcode
        { wch: 12 }, // purchase_price
        { wch: 12 }, // selling_price
        { wch: 12 }, // stock_quantity
        { wch: 12 }, // minimum_stock
      ];
      worksheet["!cols"] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

      // Return buffer
      return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    } else {
      // Return CSV format
      const csvSampleData = [
        "Sample Product 1,Electronics,1234567890123,10.50,15.00,100,10",
        "Sample Product 2,Groceries,9876543210987,5.25,8.50,50,5",
        "Sample Product 3,Clothing,,25.00,40.00,25,5",
      ];

      return [headers.join(","), ...csvSampleData].join("\n");
    }
  }

  // Keep backward compatibility
  generateCSVTemplate() {
    return this.generateTemplate("csv");
  }
}

module.exports = InventoryService;
