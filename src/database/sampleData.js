const DatabaseManager = require("./DatabaseManager");

async function insertSampleData() {
  const db = new DatabaseManager();
  await db.initialize();

  console.log("Inserting sample data...");

  try {
    // Get category IDs
    const categories = await db.allQuery("SELECT * FROM categories");
    const generalCat = categories.find((c) => c.category_name === "General");
    const foodCat = categories.find(
      (c) => c.category_name === "Food & Beverages"
    );
    const electronicsCat = categories.find(
      (c) => c.category_name === "Electronics"
    );

    // Sample products
    const sampleProducts = [
      {
        product_name: "Rice (1kg)",
        category_id: foodCat.category_id,
        barcode: "1001",
        purchase_price: 8.0,
        selling_price: 12.0,
        stock_quantity: 50,
        minimum_stock: 10,
      },
      {
        product_name: "Cooking Oil (1L)",
        category_id: foodCat.category_id,
        barcode: "1002",
        purchase_price: 15.0,
        selling_price: 20.0,
        stock_quantity: 30,
        minimum_stock: 5,
      },
      {
        product_name: "Sugar (1kg)",
        category_id: foodCat.category_id,
        barcode: "1003",
        purchase_price: 6.0,
        selling_price: 9.0,
        stock_quantity: 25,
        minimum_stock: 8,
      },
      {
        product_name: "Bread",
        category_id: foodCat.category_id,
        barcode: "1004",
        purchase_price: 3.0,
        selling_price: 5.0,
        stock_quantity: 20,
        minimum_stock: 5,
      },
      {
        product_name: "Eggs (12 pieces)",
        category_id: foodCat.category_id,
        barcode: "1005",
        purchase_price: 8.0,
        selling_price: 12.0,
        stock_quantity: 15,
        minimum_stock: 3,
      },
      {
        product_name: "Milk (1L)",
        category_id: foodCat.category_id,
        barcode: "1006",
        purchase_price: 7.0,
        selling_price: 10.0,
        stock_quantity: 18,
        minimum_stock: 5,
      },
      {
        product_name: "Mobile Phone Charger",
        category_id: electronicsCat.category_id,
        barcode: "2001",
        purchase_price: 25.0,
        selling_price: 40.0,
        stock_quantity: 12,
        minimum_stock: 3,
      },
      {
        product_name: "USB Cable",
        category_id: electronicsCat.category_id,
        barcode: "2002",
        purchase_price: 8.0,
        selling_price: 15.0,
        stock_quantity: 20,
        minimum_stock: 5,
      },
      {
        product_name: "Batteries (AA 4-pack)",
        category_id: electronicsCat.category_id,
        barcode: "2003",
        purchase_price: 5.0,
        selling_price: 8.0,
        stock_quantity: 25,
        minimum_stock: 8,
      },
      {
        product_name: "Soap",
        category_id: generalCat.category_id,
        barcode: "3001",
        purchase_price: 2.0,
        selling_price: 4.0,
        stock_quantity: 40,
        minimum_stock: 10,
      },
      {
        product_name: "Toothpaste",
        category_id: generalCat.category_id,
        barcode: "3002",
        purchase_price: 6.0,
        selling_price: 10.0,
        stock_quantity: 15,
        minimum_stock: 5,
      },
      {
        product_name: "Detergent (500g)",
        category_id: generalCat.category_id,
        barcode: "3003",
        purchase_price: 8.0,
        selling_price: 12.0,
        stock_quantity: 22,
        minimum_stock: 6,
      },
      {
        product_name: "Notebook",
        category_id: generalCat.category_id,
        barcode: "3004",
        purchase_price: 3.0,
        selling_price: 5.5,
        stock_quantity: 30,
        minimum_stock: 10,
      },
      {
        product_name: "Pen (Blue)",
        category_id: generalCat.category_id,
        barcode: "3005",
        purchase_price: 1.0,
        selling_price: 2.0,
        stock_quantity: 50,
        minimum_stock: 15,
      },
      {
        product_name: "Tissue Paper",
        category_id: generalCat.category_id,
        barcode: "3006",
        purchase_price: 4.0,
        selling_price: 6.0,
        stock_quantity: 8,
        minimum_stock: 10, // This will show as low stock
      },
    ];

    // Insert sample products
    for (const product of sampleProducts) {
      // Check if product already exists
      const existing = await db.getQuery(
        "SELECT * FROM products WHERE barcode = ?",
        [product.barcode]
      );

      if (!existing) {
        const result = await db.runQuery(
          `
                    INSERT INTO products (
                        product_name, category_id, barcode, purchase_price, 
                        selling_price, stock_quantity, minimum_stock
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          [
            product.product_name,
            product.category_id,
            product.barcode,
            product.purchase_price,
            product.selling_price,
            product.stock_quantity,
            product.minimum_stock,
          ]
        );

        // Record initial stock transaction
        await db.runQuery(
          `
                    INSERT INTO inventory_transactions (
                        product_id, transaction_type, quantity_change, notes
                    ) VALUES (?, 'initial', ?, 'Initial stock setup')
                `,
          [result.id, product.stock_quantity]
        );

        console.log(`Added product: ${product.product_name}`);
      } else {
        console.log(`Product already exists: ${product.product_name}`);
      }
    }

    console.log("Sample data insertion completed!");
    console.log("\nDefault Login Credentials:");
    console.log("Admin - PIN: 1234");
    console.log("Cashier - PIN: 0000");
  } catch (error) {
    console.error("Error inserting sample data:", error);
  } finally {
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  insertSampleData();
}

module.exports = insertSampleData;
