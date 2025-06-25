class POSApp {
  constructor() {
    this.currentUser = null;
    this.selectedRole = "cashier";
    this.cart = [];
    this.products = [];
    this.paymentMethod = "cash";
    this.loginInProgress = false;
    this.currentEditingProduct = null;
    this.currentReport = "sales";
    this.refreshTimeout = null; // For debouncing refresh operations

    // Virtual scrolling configuration
    this.virtualScrollConfig = {
      itemsPerChunk: 15, // Render 15 items per chunk
      visibleItems: 30, // Show max 30 items at once
      currentPage: 1,
      totalPages: 1,
    };

    // Pagination configuration
    this.pagination = {
      currentPage: 1,
      itemsPerPage: 50,
      totalItems: 0,
      totalPages: 0,
      filteredProducts: []
    };

    // Performance optimization flags
    this.isRendering = false;
    this.pendingRenderRequests = new Set();

    this.init();
  }

  // Debounce utility to prevent rapid successive calls
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Chunked rendering for better performance
  async renderInChunks(items, renderFunction, container, chunkSize = 15) {
    if (this.isRendering) {
      this.pendingRenderRequests.add({
        items,
        renderFunction,
        container,
        chunkSize,
      });
      return;
    }

    this.isRendering = true;

    // Clear container efficiently
    const fragment = document.createDocumentFragment();
    container.innerHTML = "";

    const totalChunks = Math.ceil(items.length / chunkSize);
    let currentChunk = 0;

    const processChunk = () => {
      const startIndex = currentChunk * chunkSize;
      const endIndex = Math.min(startIndex + chunkSize, items.length);
      const chunk = items.slice(startIndex, endIndex);

      // Render chunk using the provided function
      const chunkFragment = renderFunction(chunk, startIndex);
      fragment.appendChild(chunkFragment);

      currentChunk++;

      if (currentChunk < totalChunks) {
        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(processChunk);
      } else {
        // Final DOM operation
        container.appendChild(fragment);
        this.isRendering = false;

        // Process any pending render requests
        if (this.pendingRenderRequests.size > 0) {
          const nextRequest = this.pendingRenderRequests.values().next().value;
          this.pendingRenderRequests.delete(nextRequest);
          this.renderInChunks(
            nextRequest.items,
            nextRequest.renderFunction,
            nextRequest.container,
            nextRequest.chunkSize
          );
        }
      }
    };

    // Start rendering with a small delay to allow UI updates
    requestAnimationFrame(processChunk);
  }

  // Optimized product card renderer
  createProductCards(products, startIndex = 0) {
    const fragment = document.createDocumentFragment();

    products.forEach((product) => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.dataset.productId = product.product_id;

      // More efficient DOM creation (avoid innerHTML)
      const title = document.createElement("h4");
      title.textContent = product.product_name;

      const price = document.createElement("div");
      price.className = "price";
      price.textContent = `GHS ${product.selling_price.toFixed(2)}`;

      const stock = document.createElement("div");
      stock.className = "stock";
      stock.textContent = `Stock: ${product.stock_quantity}`;

      card.appendChild(title);
      card.appendChild(price);
      card.appendChild(stock);

      fragment.appendChild(card);
    });

    return fragment;
  }

  // Optimized inventory row renderer
  createInventoryRows(products, startIndex = 0) {
    const fragment = document.createDocumentFragment();

    products.forEach((product) => {
      const row = document.createElement("tr");
      row.dataset.productId = product.product_id;

      const stockStatus =
        product.stock_quantity <= product.minimum_stock
          ? "Low Stock"
          : "In Stock";
      const statusClass =
        product.stock_quantity <= product.minimum_stock ? "low" : "normal";

      // Create cells efficiently
      const cells = [
        `<div class="admin-only">
          <input type="checkbox" class="product-checkbox" value="${product.product_id}" 
                 onchange="window.posApp.toggleProductSelection(this, ${product.product_id})">
        </div>`,
        product.product_name,
        product.category_name || "N/A",
        product.barcode || "N/A",
        product.stock_quantity,
        product.minimum_stock,
        `GHS ${(product.purchase_price || 0).toFixed(2)}`,
        `GHS ${product.selling_price.toFixed(2)}`,
        `<span class="stock-status ${statusClass}">${stockStatus}</span>`,
        `<div class="admin-only action-buttons">
          <button class="btn-small edit-btn" data-action="edit" data-id="${product.product_id}">Edit</button>
          <button class="btn-small btn-danger delete-btn" data-action="delete" data-id="${product.product_id}">Delete</button>
        </div>`,
      ];

      cells.forEach((cellContent) => {
        const cell = document.createElement("td");
        if (typeof cellContent === "string" && cellContent.includes("<")) {
          cell.innerHTML = cellContent;
        } else {
          cell.textContent = cellContent;
        }
        row.appendChild(cell);
      });

      fragment.appendChild(row);
    });

    return fragment;
  }

  // Virtual scrolling for large datasets
  setupVirtualScrolling(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const scrollHandler = this.debounce(() => {
      if (
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - 100
      ) {
        // Load more items when near bottom
        this.loadMoreItems(containerId);
      }
    }, 100);

    container.addEventListener("scroll", scrollHandler);
  }

  async loadMoreItems(containerId) {
    if (containerId === "inventoryTable") {
      const currentItems =
        this.virtualScrollConfig.currentPage *
        this.virtualScrollConfig.visibleItems;
      if (currentItems < this.allProducts.length) {
        this.virtualScrollConfig.currentPage++;
        await this.displayInventoryVirtual();
      }
    }
  }

  // Enhanced display functions with chunked rendering
  async displayProducts(products = this.products) {
    const grid = document.getElementById("productGrid");
    if (!grid) {
      console.error("Product grid element not found!");
      return;
    }

    console.log(
      `Rendering ${products.length} products...`
    );

    // Clear existing content
    grid.innerHTML = "";

    // Use chunked rendering for better performance but show ALL products
    await this.renderInChunks(
      products,
      this.createProductCards.bind(this),
      grid,
      50 // Larger chunk size for better performance
    );

    // Setup event delegation for product cards
    this.setupProductCardEvents(grid);

    console.log("Product rendering completed - showing all products");
  }

  async displayInventory(products) {
    console.log("=== displayInventory called ===");
    console.log(`Total products for pagination: ${products.length}`);

    // Store filtered products for pagination
    this.pagination.filteredProducts = products;
    this.pagination.totalItems = products.length;
    this.pagination.totalPages = Math.ceil(products.length / this.pagination.itemsPerPage);

    // Get current page products
    const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
    const endIndex = startIndex + this.pagination.itemsPerPage;
    const currentPageProducts = products.slice(startIndex, endIndex);

    console.log(`Rendering page ${this.pagination.currentPage}: ${currentPageProducts.length} products (${startIndex + 1}-${Math.min(endIndex, products.length)} of ${products.length})`);

    const tbody = document.querySelector("#inventoryTable tbody");
    if (!tbody) {
      console.error("Inventory table tbody not found!");
      return;
    }

    // Clear existing content
    tbody.innerHTML = "";

    // Render current page products
    await this.renderInChunks(
      currentPageProducts,
      this.createInventoryRows.bind(this),
      tbody,
      50 // Larger chunk size for better performance
    );

    // Setup event delegation for inventory actions
    this.setupInventoryEvents(tbody);

    // Update pagination controls
    this.updatePaginationControls();

    console.log("Inventory rendering completed with pagination");
  }

  // Update pagination controls
  updatePaginationControls() {
    const paginationInfo = document.getElementById('paginationInfo');
    const pageNumbers = document.getElementById('pageNumbers');
    const firstPageBtn = document.getElementById('firstPageBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const lastPageBtn = document.getElementById('lastPageBtn');
    const itemsPerPageSelect = document.getElementById('itemsPerPage');

    if (!paginationInfo || !pageNumbers) return;

    // Update info text
    const startItem = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage + 1;
    const endItem = Math.min(this.pagination.currentPage * this.pagination.itemsPerPage, this.pagination.totalItems);
    paginationInfo.textContent = `Showing ${startItem} - ${endItem} of ${this.pagination.totalItems} products`;

    // Update button states
    if (firstPageBtn) firstPageBtn.disabled = this.pagination.currentPage === 1;
    if (prevPageBtn) prevPageBtn.disabled = this.pagination.currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = this.pagination.currentPage === this.pagination.totalPages;
    if (lastPageBtn) lastPageBtn.disabled = this.pagination.currentPage === this.pagination.totalPages;

    // Update items per page select
    if (itemsPerPageSelect) {
      itemsPerPageSelect.value = this.pagination.itemsPerPage === this.pagination.totalItems ? 'all' : this.pagination.itemsPerPage;
    }

    // Generate page numbers
    this.generatePageNumbers();
  }

  // Generate page number buttons
  generatePageNumbers() {
    const pageNumbers = document.getElementById('pageNumbers');
    if (!pageNumbers) return;

    pageNumbers.innerHTML = '';

    const totalPages = this.pagination.totalPages;
    const currentPage = this.pagination.currentPage;

    if (totalPages <= 1) return;

    // Calculate page range to show
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    // Adjust range if we're near the beginning or end
    if (currentPage <= 3) {
      endPage = Math.min(5, totalPages);
    } else if (currentPage >= totalPages - 2) {
      startPage = Math.max(1, totalPages - 4);
    }

    // Add ellipsis at the beginning if needed
    if (startPage > 1) {
      this.createPageButton(1, pageNumbers);
      if (startPage > 2) {
        const ellipsis = document.createElement('span');
        ellipsis.textContent = '...';
        ellipsis.className = 'pagination-ellipsis';
        pageNumbers.appendChild(ellipsis);
      }
    }

    // Add page number buttons
    for (let i = startPage; i <= endPage; i++) {
      this.createPageButton(i, pageNumbers);
    }

    // Add ellipsis at the end if needed
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ellipsis = document.createElement('span');
        ellipsis.textContent = '...';
        ellipsis.className = 'pagination-ellipsis';
        pageNumbers.appendChild(ellipsis);
      }
      this.createPageButton(totalPages, pageNumbers);
    }
  }

  // Create individual page button
  createPageButton(pageNumber, container) {
    const button = document.createElement('button');
    button.textContent = pageNumber;
    button.className = 'page-number';
    button.onclick = () => this.goToPage(pageNumber);
    
    if (pageNumber === this.pagination.currentPage) {
      button.classList.add('active');
    }
    
    container.appendChild(button);
  }

  // Pagination navigation methods
  goToPage(page) {
    if (page < 1 || page > this.pagination.totalPages) return;
    this.pagination.currentPage = page;
    this.displayInventory(this.pagination.filteredProducts);
  }

  nextPage() {
    if (this.pagination.currentPage < this.pagination.totalPages) {
      this.pagination.currentPage++;
      this.displayInventory(this.pagination.filteredProducts);
    }
  }

  previousPage() {
    if (this.pagination.currentPage > 1) {
      this.pagination.currentPage--;
      this.displayInventory(this.pagination.filteredProducts);
    }
  }

  goToLastPage() {
    this.pagination.currentPage = this.pagination.totalPages;
    this.displayInventory(this.pagination.filteredProducts);
  }

  changeItemsPerPage(value) {
    if (value === 'all') {
      this.pagination.itemsPerPage = this.pagination.totalItems;
    } else {
      this.pagination.itemsPerPage = parseInt(value);
    }
    
    // Reset to first page when changing items per page
    this.pagination.currentPage = 1;
    this.displayInventory(this.pagination.filteredProducts);
  }

  // Virtual scrolling version for inventory
  async displayInventoryVirtual() {
    if (!this.allProducts) return;

    const startIndex = 0;
    const endIndex =
      this.virtualScrollConfig.currentPage *
      this.virtualScrollConfig.visibleItems;
    const visibleProducts = this.allProducts.slice(startIndex, endIndex);

    await this.displayInventory(visibleProducts);
  }

  // Event delegation for product cards
  setupProductCardEvents(container) {
    // Remove existing listener to avoid duplicates
    container.removeEventListener("click", this.handleProductCardClick);

    // Add single event listener for all product cards
    this.handleProductCardClick = (e) => {
      const card = e.target.closest(".product-card");
      if (card) {
        const productId = parseInt(card.dataset.productId);
        const product = this.products.find((p) => p.product_id === productId);
        if (product) {
          this.addToCart(product);
        }
      }
    };

    container.addEventListener("click", this.handleProductCardClick);
  }

  // Event delegation for inventory table
  setupInventoryEvents(container) {
    // Remove existing listener to avoid duplicates
    container.removeEventListener("click", this.handleInventoryClick);

    // Add single event listener for all inventory actions
    this.handleInventoryClick = (e) => {
      const button = e.target.closest("button[data-action]");
      if (button) {
        e.preventDefault();
        const action = button.dataset.action;
        const productId = parseInt(button.dataset.id);

        if (action === "edit") {
          this.editProduct(productId);
        } else if (action === "delete") {
          this.deleteProduct(productId);
        }
      }
    };

    container.addEventListener("click", this.handleInventoryClick);
  }

  // Optimized search with debouncing
  searchProducts(query) {
    console.log("searchProducts called with query:", query);

    if (!this.products || this.products.length === 0) {
      console.log("No products available for search");
      return;
    }

    if (!query || !query.trim()) {
      console.log("Empty query, showing all products");
      this.displayProducts(this.products); // Show ALL products, not limited
      return;
    }

    const filtered = this.products.filter(
      (product) =>
        product.product_name.toLowerCase().includes(query.toLowerCase()) ||
        (product.barcode && product.barcode.includes(query))
    );

    console.log("Filtered products count:", filtered.length);
    this.displayProducts(filtered);
  }

  // Optimized inventory filtering
  filterInventory() {
    console.log("filterInventory called with pagination");

    if (!this.allProducts) {
      console.log("No allProducts available for filtering");
      return;
    }

    const searchInput = document.getElementById("inventorySearch");
    const searchTerm = searchInput?.value.toLowerCase() || "";
    const categoryFilter =
      document.getElementById("categoryFilter")?.value || "";
    const stockFilter = document.getElementById("stockFilter")?.value || "";

    console.log(
      `Inventory search: "${searchTerm}" | Products: ${this.allProducts.length}`
    );

    let filtered = this.allProducts.filter((product) => {
      const matchesSearch =
        product.product_name.toLowerCase().includes(searchTerm) ||
        (product.barcode && product.barcode.includes(searchTerm));
      const matchesCategory =
        !categoryFilter || product.category_id == categoryFilter;

      let matchesStock = true;
      if (stockFilter === "low") {
        matchesStock = product.stock_quantity <= product.minimum_stock;
      } else if (stockFilter === "out") {
        matchesStock = product.stock_quantity === 0;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });

    console.log(`Filtered results: ${filtered.length} products`);

    // Reset pagination for new results
    this.pagination.currentPage = 1;
    this.displayInventory(filtered);
  }

  async init() {
    this.setupEventListeners();
    await this.loadProducts();

    // Show login screen
    document.getElementById("loginScreen").classList.remove("hidden");
  }

  setupEventListeners() {
    // Role selection
    document.querySelectorAll(".role-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document
          .querySelectorAll(".role-btn")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.selectedRole = e.target.dataset.role;
      });
    });

    // Login
    document
      .getElementById("loginBtn")
      .addEventListener("click", () => this.handleLogin());

    // Allow Enter key to login
    document.getElementById("pinInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleLogin();
      }
    });

    // Logout
    document
      .getElementById("logoutBtn")
      .addEventListener("click", () => this.handleLogout());

    // Navigation
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchView(e.target.dataset.view);
      });
    });

    // Product search with debouncing
    const productSearchInput = document.getElementById("productSearch");
    if (productSearchInput) {
      const debouncedSearch = this.debounce((value) => {
        console.log("Debounced POS search:", value);
        this.searchProducts(value);
      }, 300);

      productSearchInput.addEventListener("input", (e) => {
        console.log("Search input event triggered:", e.target.value);
        debouncedSearch(e.target.value);
      });

      productSearchInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter") {
          console.log("Search Enter key triggered:", e.target.value);
          this.searchProducts(e.target.value);
        }
      });

      console.log(
        "POS search input found and debounced event listeners attached"
      );
    } else {
      console.error("Product search input not found!");
    }

    // Barcode input
    if (document.getElementById("barcodeInput")) {
      document
        .getElementById("barcodeInput")
        .addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            this.searchByBarcode(e.target.value);
          }
        });
    }

    // Checkout
    document
      .getElementById("checkoutBtn")
      .addEventListener("click", () => this.handleCheckout());

    // Payment method selection
    document.querySelectorAll(".payment-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document
          .querySelectorAll(".payment-btn")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.paymentMethod = e.target.dataset.method;
      });
    });

    // Test printer button
    document
      .getElementById("testPrinterBtn")
      .addEventListener("click", () => this.testPrinter());

    // Admin-only event listeners
    this.setupAdminEventListeners();
  }

  setupAdminEventListeners() {
    // Inventory management
    const addProductBtn = document.getElementById("addProductBtn");
    if (addProductBtn) {
      addProductBtn.addEventListener("click", () => this.showAddProductModal());
    }

    const addCategoryBtn = document.getElementById("addCategoryBtn");
    if (addCategoryBtn) {
      addCategoryBtn.addEventListener("click", () =>
        this.showAddCategoryModal()
      );
    }

    const stockAdjustmentBtn = document.getElementById("stockAdjustmentBtn");
    if (stockAdjustmentBtn) {
      stockAdjustmentBtn.addEventListener("click", () =>
        this.showStockAdjustmentModal()
      );
    }

    const addUserBtn = document.getElementById("addUserBtn");
    if (addUserBtn) {
      addUserBtn.addEventListener("click", () => {
        console.log("🔍 Add User button clicked");
        this.showAddUserModal();
      });
    }

    // Inventory filters with debounced search
    const inventorySearch = document.getElementById("inventorySearch");
    if (inventorySearch) {
      const debouncedFilter = this.debounce(() => {
        console.log(
          "Debounced inventory search triggered:",
          inventorySearch.value
        );
        this.filterInventory();
      }, 300);

      inventorySearch.addEventListener("input", (e) => {
        console.log("Inventory search input event triggered:", e.target.value);
        debouncedFilter();
      });

      // Test alert to confirm setup
      console.log(
        "Inventory search input found and debounced event listeners attached"
      );
    } else {
      console.error("Inventory search input not found!");
      console.error("❌ ERROR: Inventory search input not found!");
    }

    const categoryFilter = document.getElementById("categoryFilter");
    if (categoryFilter) {
      categoryFilter.addEventListener("change", () => this.filterInventory());
    }

    const stockFilter = document.getElementById("stockFilter");
    if (stockFilter) {
      stockFilter.addEventListener("change", () => this.filterInventory());
    }

    // Modal event listeners
    this.setupModalEventListeners();

    // Reports
    this.setupReportsEventListeners();

    // Settings
    this.setupSettingsEventListeners();

    // Setup virtual scrolling for large tables
    this.setupVirtualScrolling("inventoryTable");

    // Sales filters
    const filterSalesBtn = document.getElementById("filterSalesBtn");
    if (filterSalesBtn) {
      filterSalesBtn.addEventListener("click", () => this.filterSales());
    }
  }

  setupModalEventListeners() {
    // Product modal
    const productForm = document.getElementById("productForm");
    if (productForm) {
      productForm.addEventListener("submit", (e) =>
        this.handleProductSubmit(e)
      );
    }

    const cancelProductBtn = document.getElementById("cancelProductBtn");
    if (cancelProductBtn) {
      cancelProductBtn.addEventListener("click", () =>
        this.hideModal("productModal")
      );
    }

    // Category modal
    const categoryForm = document.getElementById("categoryForm");
    if (categoryForm) {
      categoryForm.addEventListener("submit", (e) =>
        this.handleCategorySubmit(e)
      );
    }

    const cancelCategoryBtn = document.getElementById("cancelCategoryBtn");
    if (cancelCategoryBtn) {
      cancelCategoryBtn.addEventListener("click", () =>
        this.hideModal("categoryModal")
      );
    }

    // Stock adjustment modal
    const stockAdjustmentForm = document.getElementById("stockAdjustmentForm");
    if (stockAdjustmentForm) {
      stockAdjustmentForm.addEventListener("submit", (e) =>
        this.handleStockAdjustmentSubmit(e)
      );
    }

    const cancelStockAdjustmentBtn = document.getElementById(
      "cancelStockAdjustmentBtn"
    );
    if (cancelStockAdjustmentBtn) {
      cancelStockAdjustmentBtn.addEventListener("click", () =>
        this.hideModal("stockAdjustmentModal")
      );
    }

    // User modal
    const userForm = document.getElementById("userForm");
    if (userForm) {
      userForm.addEventListener("submit", (e) => this.handleUserSubmit(e));
    }

    const cancelUserBtn = document.getElementById("cancelUserBtn");
    if (cancelUserBtn) {
      cancelUserBtn.addEventListener("click", () =>
        this.hideModal("userModal")
      );
    }
  }

  setupReportsEventListeners() {
    // Report tabs
    document.querySelectorAll(".report-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        document
          .querySelectorAll(".report-tab")
          .forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");
        this.currentReport = e.target.dataset.report;
      });
    });

    const generateReportBtn = document.getElementById("generateReportBtn");
    if (generateReportBtn) {
      generateReportBtn.addEventListener("click", () => this.generateReport());
    }

    const exportReportBtn = document.getElementById("exportReportBtn");
    if (exportReportBtn) {
      exportReportBtn.addEventListener("click", () => this.exportReport());
    }
  }

  setupSettingsEventListeners() {
    const saveSettingsBtn = document.getElementById("saveSettingsBtn");
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener("click", () => this.saveSettings());
    }

    const backupBtn = document.getElementById("backupBtn");
    if (backupBtn) {
      backupBtn.addEventListener("click", () => this.createBackup());
    }

    const exportDataBtn = document.getElementById("exportDataBtn");
    if (exportDataBtn) {
      exportDataBtn.addEventListener("click", () =>
        this.showExportDataOptions()
      );
    }
  }

  async handleLogin() {
    const pin = document.getElementById("pinInput").value.trim();

    console.log(
      `Frontend login attempt - PIN: "${pin}", Role: "${this.selectedRole}"`
    );

    if (!pin || pin.length !== 4) {
      this.showLoginError("Please enter a 4-digit PIN");
      return;
    }

    // Prevent multiple simultaneous login attempts
    if (this.loginInProgress) {
      console.log("Login already in progress, ignoring");
      return;
    }

    this.loginInProgress = true;

    try {
      const result = await window.electronAPI.auth.login(
        pin,
        this.selectedRole
      );

      if (result.success) {
        console.log("Login successful");
        this.currentUser = result.user;
        this.updateUserInfo();
        this.showMainApp();
        await this.refreshData();
        // Clear PIN input after successful login
        document.getElementById("pinInput").value = "";
      } else {
        console.log("Login failed:", result.error);
        this.showLoginError(result.error || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      this.showLoginError("System error. Please try again.");
    } finally {
      this.loginInProgress = false;
    }
  }

  async handleLogout() {
    try {
      await window.electronAPI.auth.logout();
      this.currentUser = null;
      this.cart = [];
      this.updateCart();
      document.getElementById("pinInput").value = "";
      this.showLoginScreen();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  showLoginError(message) {
    const errorEl = document.getElementById("loginError");
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  showLoginScreen() {
    document.getElementById("loginScreen").classList.remove("hidden");
    document.getElementById("mainApp").classList.add("hidden");
  }

  showMainApp() {
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("mainApp").classList.remove("hidden");
  }

  updateUserInfo() {
    if (this.currentUser) {
      document.getElementById("currentUserRole").textContent =
        this.currentUser.role.toUpperCase();

      // Show/hide admin-only elements
      const adminElements = document.querySelectorAll(".admin-only");
      adminElements.forEach((element) => {
        if (this.currentUser.role === "admin") {
          element.style.display = "";
        } else {
          element.style.display = "none";
        }
      });
    }
  }

  switchView(viewName) {
    document.querySelectorAll(".view").forEach((view) => {
      view.classList.remove("active");
    });

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    document.getElementById(viewName + "View").classList.add("active");
    document.querySelector(`[data-view="${viewName}"]`).classList.add("active");

    this.loadViewData(viewName);
  }

  async loadViewData(viewName) {
    switch (viewName) {
      case "dashboard":
        await this.loadDashboardData();
        break;
      case "inventory":
        await this.loadInventory();
        await this.loadCategories();
        break;
      case "sales":
        await this.loadSalesData();
        await this.updatePrinterStatus();
        break;
      case "users":
        await this.loadUsersData();
        break;
      case "reports":
        await this.loadReportsView();
        break;
      case "settings":
        await this.loadSettings();
        break;
    }
  }

  async loadProducts() {
    try {
      const result = await window.electronAPI.inventory.getProducts();
      if (result.success) {
        this.products = result.data;
        this.displayProducts();
      } else {
        console.error("Failed to load products:", result.error);
      }
    } catch (error) {
      console.error("Error loading products:", error.message);
    }
  }

  async loadInventory() {
    try {
      const result = await window.electronAPI.inventory.getProducts();
      if (result.success) {
        this.allProducts = result.data;
        
        // Reset pagination when loading new data
        this.pagination.currentPage = 1;
        
        this.displayInventory(result.data);
        this.clearSelection(); // Clear any previous selections

        // Test if inventory search input exists after loading
        setTimeout(() => {
          const inventorySearchInput =
            document.getElementById("inventorySearch");
          console.log(
            "Inventory search input check:",
            inventorySearchInput ? "FOUND" : "NOT FOUND"
          );
          if (!inventorySearchInput) {
            console.warn(
              "⚠️ WARNING: Inventory search input not found after loading!"
            );
          }
        }, 500);
      }
    } catch (error) {
      console.error("Error loading inventory:", error);
    }
  }

  async loadCategories() {
    try {
      const result = await window.electronAPI.inventory.getCategories();
      if (result.success) {
        this.populateCategorySelects(result.data);
      } else {
        console.error("Failed to load categories:", result.error);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  populateCategorySelects(categories) {
    const selects = ["categoryFilter", "productCategory", "adjustmentProduct"];

    selects.forEach((selectId) => {
      const select = document.getElementById(selectId);
      if (select) {
        const isProductSelect = selectId === "adjustmentProduct";
        select.innerHTML = isProductSelect
          ? ""
          : '<option value="">All Categories</option>';

        if (isProductSelect && this.allProducts) {
          // Populate with products for stock adjustment
          this.allProducts.forEach((product) => {
            const option = document.createElement("option");
            option.value = product.product_id;
            option.textContent = `${product.product_name} (Current: ${product.stock_quantity})`;
            select.appendChild(option);
          });
        } else {
          // Populate with categories
          categories.forEach((category) => {
            const option = document.createElement("option");
            option.value = category.category_id;
            option.textContent = category.category_name;
            select.appendChild(option);
          });
        }
      }
    });
  }

  showModal(modalId) {
    console.log("Showing modal:", modalId);
    const modal = document.getElementById(modalId);
    modal.classList.remove("hidden");
  }

  hideModal(modalId) {
    console.log(`=== Hiding Modal: ${modalId} ===`);

    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("hidden");
      console.log(`Modal ${modalId} hidden successfully`);
    } else {
      console.error(`Modal ${modalId} not found`);
    }

    // Clear the editing state immediately
    this.currentEditingProduct = null;
    this.currentEditingUser = null;
    console.log("Cleared editing state");

    // Only do thorough cleanup for non-user modals to prevent interference
    if (modalId !== "userModal") {
      // Thorough form reset and cleanup
      const form = modal.querySelector("form");
      if (form) {
        console.log("Form found in modal, resetting...");
        setTimeout(() => {
          // Reset form values
          form.reset();

          // Clean up any debugging attributes and ensure inputs are responsive
          const inputs = form.querySelectorAll("input, select, textarea");
          inputs.forEach((input) => {
            input.removeAttribute("data-listeners-added");
            input.disabled = false;
            input.readOnly = false;
            // Clear any focus or selection
            if (document.activeElement === input) {
              input.blur();
            }
          });

          console.log("Form reset completed");

          // Debug form state after reset
          if (modalId === "productModal") {
            console.log("Form inputs after reset:");
            inputs.forEach((input, index) => {
              console.log(
                `  Input ${index}: ${input.name || input.id} - disabled: ${
                  input.disabled
                }, readonly: ${input.readOnly}, value: "${input.value}"`
              );
            });
          }
        }, 50);
      } else {
        console.log("No form found in modal");
      }
    } else {
      console.log("Skipping form reset for user modal");
    }
  }

  showAddProductModal() {
    console.log("=== Opening Add Product Modal ===");

    // Clear any existing state first
    this.currentEditingProduct = null;
    document.getElementById("productModalTitle").textContent = "Add Product";

    // Show modal first
    this.showModal("productModal");

    // Then handle form after modal is visible
    setTimeout(() => {
      const form = document.getElementById("productForm");
      console.log("Form element:", form);

      if (form) {
        console.log("Form found, resetting...");
        form.reset();

        // Debug all form inputs
        const inputs = form.querySelectorAll("input, select, textarea");
        console.log("Found", inputs.length, "form inputs:");
        inputs.forEach((input, index) => {
          console.log(
            `  Input ${index}: ${input.name || input.id} - disabled: ${
              input.disabled
            }, readonly: ${input.readOnly}, tabindex: ${input.tabIndex}`
          );
        });

        // Ensure form is completely clean and responsive
        const firstInput = form.querySelector("input");
        if (firstInput) {
          console.log(
            "First input found:",
            firstInput.id,
            "- attempting focus"
          );

          // Remove any existing attributes that might interfere
          inputs.forEach((input) => {
            input.removeAttribute("data-listeners-added");
            // Ensure inputs are enabled and editable
            input.disabled = false;
            input.readOnly = false;
          });

          // Focus with a slight delay to ensure modal is fully rendered
          setTimeout(() => {
            firstInput.focus();
            console.log(
              "First input after delayed focus - activeElement:",
              document.activeElement === firstInput
            );
          }, 150);

          // Test if we can type in it
          setTimeout(() => {
            console.log("Testing input responsiveness...");
            firstInput.value = "test";
            console.log("Test value set:", firstInput.value);
            firstInput.value = "";
            console.log("Test value cleared:", firstInput.value);
          }, 200);
        }
      } else {
        console.error("Form not found!");
      }
    }, 100);
  }

  showAddCategoryModal() {
    this.showModal("categoryModal");
  }

  showStockAdjustmentModal() {
    this.populateProductSelect();
    this.showModal("stockAdjustmentModal");
  }

  populateProductSelect() {
    const select = document.getElementById("adjustmentProduct");
    if (!select) return;

    select.innerHTML = '<option value="">Select Product</option>';

    this.allProducts.forEach((product) => {
      const option = document.createElement("option");
      option.value = product.product_id;
      option.textContent = `${product.product_name} (Stock: ${product.stock_quantity})`;
      select.appendChild(option);
    });
  }

  showAddUserModal() {
    console.log("🔍 showAddUserModal called");

    // Clear any existing editing state first
    this.currentEditingUser = null;

    console.log("🔍 About to show user modal");
    this.showModal("userModal");

    // Setup form AFTER modal is shown to prevent interference
    setTimeout(() => {
      console.log("🔍 Setting up user form");

      // Reset form and editing state
      document.getElementById("userForm").reset();
      document.getElementById("userModalTitle").textContent = "Add New User";

      // Reset PIN field requirements for new user
      const pinInput = document.getElementById("userPin");
      const pinHelp = document.getElementById("pinHelp");
      if (pinInput && pinHelp) {
        pinInput.required = true;
        pinInput.placeholder = "Enter PIN";
        pinHelp.textContent = "Must be exactly 4 digits";
      }

      console.log("🔍 User form setup completed");
    }, 50);
  }

  async editProduct(productId) {
    try {
      const products = this.allProducts || [];
      const product = products.find((p) => p.product_id === productId);

      if (!product) {
        console.warn("⚠️ Product not found");
        return;
      }

      this.currentEditingProduct = product;
      document.getElementById("productModalTitle").textContent = "Edit Product";

      // Populate form
      document.getElementById("productName").value = product.product_name;
      document.getElementById("productCategory").value =
        product.category_id || "";
      document.getElementById("productBarcode").value = product.barcode || "";
      document.getElementById("purchasePrice").value =
        product.purchase_price || 0;
      document.getElementById("sellingPrice").value = product.selling_price;
      document.getElementById("stockQuantity").value = product.stock_quantity;
      document.getElementById("minimumStock").value = product.minimum_stock;

      this.showModal("productModal");
    } catch (error) {
      console.error("Error editing product:", error);
      console.error("❌ Error loading product data");
    }
  }

  async deleteProduct(productId) {
    // Remove blocking confirm dialog - proceed directly with deletion
    console.log("🗑️ Deleting product ID:", productId);

    // Clear search filters immediately
    const searchInput = document.getElementById("productSearch");
    if (searchInput) {
      searchInput.value = "";
    }
    const inventorySearchInput = document.getElementById("inventorySearch");
    if (inventorySearchInput) {
      inventorySearchInput.value = "";
    }

    // Use setTimeout to break blocking IPC chain
    setTimeout(async () => {
      try {
        const result = await window.electronAPI.inventory.deleteProduct(
          productId
        );

        if (result.success) {
          console.log("✅ PRODUCT DELETED successfully");

          // Background refresh without blocking UI
          window.requestIdleCallback(() => {
            Promise.all([this.loadInventory(), this.loadProducts()]).then(
              () => {
                console.log("Product deletion refresh completed in background");
              }
            );
          });
        } else {
          console.error("❌ DELETE ERROR:", result.error);
        }
      } catch (error) {
        console.error("❌ Error deleting product:", error);
      }
    }, 10);
  }

  async handleProductSubmit(e) {
    console.log("=== Product Submit Handler (Non-Blocking IPC) ===");
    e.preventDefault();

    const formData = new FormData(e.target);
    const productData = {
      product_name:
        formData.get("productName") ||
        document.getElementById("productName").value,
      category_id: document.getElementById("productCategory").value || null,
      barcode: document.getElementById("productBarcode").value.trim() || null,
      purchase_price:
        parseFloat(document.getElementById("purchasePrice").value) || 0,
      selling_price: parseFloat(document.getElementById("sellingPrice").value),
      stock_quantity:
        parseInt(document.getElementById("stockQuantity").value) || 0,
      minimum_stock:
        parseInt(document.getElementById("minimumStock").value) || 5,
    };

    console.log("Product data to save:", productData);

    // Store editing state BEFORE hiding modal (modal clears this.currentEditingProduct)
    const isEditing = !!this.currentEditingProduct;
    const editingProductId = this.currentEditingProduct?.product_id;
    
    console.log("Edit state:", { isEditing, editingProductId });

    // Hide modal and clear filters IMMEDIATELY to maintain UI responsiveness
    console.log("Providing immediate UI feedback...");
    this.hideModal("productModal");

    // Clear search filters immediately (before database operation)
    const searchInput = document.getElementById("productSearch");
    if (searchInput) {
      searchInput.value = "";
    }
    const inventorySearchInput = document.getElementById("inventorySearch");
    if (inventorySearchInput) {
      inventorySearchInput.value = "";
    }

    // Show immediate optimistic feedback
    const originalTitle = document.title;
    document.title = "Saving product...";

    try {
      // Start the database operation but don't block the UI
      console.log("Starting non-blocking database operation...");

      // Use setTimeout to break the blocking IPC call
      setTimeout(async () => {
        try {
          let result;
          if (isEditing && editingProductId) {
            console.log(
              "Updating existing product (non-blocking):",
              editingProductId
            );
            result = await window.electronAPI.inventory.updateProduct(
              editingProductId,
              productData
            );
          } else {
            console.log("Adding new product (non-blocking)");
            result = await window.electronAPI.inventory.addProduct(productData);
          }

          console.log("Database operation completed:", result);

          // Restore title and show result
          document.title = originalTitle;

          if (result.success) {
            // Show success in console and title instead of blocking alert
            console.log("✅ SUCCESS:", result.message);
            document.title = "✅ Product saved successfully!";

            // Reset title after 3 seconds
            setTimeout(() => {
              document.title = originalTitle;
            }, 3000);

            // Refresh data in background without blocking UI
            window.requestIdleCallback(() => {
              console.log("Background refresh starting...");
              Promise.all([this.loadInventory(), this.loadProducts()])
                .then(() => {
                  console.log(
                    "Background refresh completed - UI never blocked!"
                  );
                })
                .catch((error) => {
                  console.error("Background refresh error:", error);
                });
            });
          } else {
            console.error("❌ ERROR:", result.error);
            document.title = "❌ Error saving product";
            setTimeout(() => {
              document.title = originalTitle;
            }, 3000);
          }
        } catch (error) {
          document.title = "❌ Database error";
          console.error("Database operation error:", error);
          setTimeout(() => {
            document.title = originalTitle;
          }, 3000);
        }
      }, 10); // 10ms delay breaks the blocking synchronous chain

      console.log(
        "Product submission started in background - UI remains responsive!"
      );
    } catch (error) {
      document.title = "❌ Submission error";
      console.error("Error starting product submission:", error);
      setTimeout(() => {
        document.title = originalTitle;
      }, 3000);
    }
  }

  async handleCategorySubmit(e) {
    e.preventDefault();

    const categoryData = {
      category_name: document.getElementById("categoryName").value,
      description: document.getElementById("categoryDescription").value || "",
    };

    try {
      const result = await window.electronAPI.inventory.addCategory(
        categoryData
      );
      if (result.success) {
        console.log("✅ Category added successfully");
        this.hideModal("categoryModal");
        await this.loadCategories();
      } else {
        console.error("❌ Error:", result.error);
      }
    } catch (error) {
      console.error("❌ Error adding category:", error);
    }
  }

  async handleUserSubmit(e) {
    e.preventDefault();

    const userData = {
      username: document.getElementById("userName").value.trim(),
      pin: document.getElementById("userPin").value.trim(),
      role: document.getElementById("userRole").value,
    };

    const isEditing = !!this.currentEditingUser;
    const actionText = isEditing ? "Updating" : "Creating";

    console.log(`🔍 ${actionText} user form data:`, {
      ...userData,
      pin: "****",
    });
    console.log(
      `🔍 Form validation - username: ${userData.username?.length} chars, pin: ${userData.pin?.length} chars, role: "${userData.role}"`
    );

    // Debug form elements
    const usernameEl = document.getElementById("userName");
    const pinEl = document.getElementById("userPin");
    const roleEl = document.getElementById("userRole");
    console.log(`🔍 Form elements:`, {
      username: { element: !!usernameEl, value: usernameEl?.value },
      pin: { element: !!pinEl, value: pinEl?.value ? "****" : "empty" },
      role: {
        element: !!roleEl,
        value: roleEl?.value,
        selectedIndex: roleEl?.selectedIndex,
      },
    });

    // Basic validation before proceeding
    if (!userData.username || userData.username.length < 3) {
      console.error(
        "❌ Username validation failed - username:",
        userData.username
      );
      document.title = "❌ Username must be at least 3 characters";
      setTimeout(() => (document.title = "DOMINAK 757 POS System"), 3000);
      return;
    }
    if (!userData.pin || userData.pin.length !== 4) {
      console.error(
        "❌ PIN validation failed - pin length:",
        userData.pin?.length
      );
      document.title = "❌ PIN must be exactly 4 digits";
      setTimeout(() => (document.title = "DOMINAK 757 POS System"), 3000);
      return;
    }
    if (!userData.role) {
      console.error("❌ Role validation failed - role:", userData.role);
      console.error(
        "❌ Role element:",
        roleEl,
        "value:",
        roleEl?.value,
        "options:",
        Array.from(roleEl?.options || []).map((o) => ({
          value: o.value,
          text: o.text,
        }))
      );
      document.title = "❌ Please select a role (Admin or Cashier)";
      setTimeout(() => (document.title = "DOMINAK 757 POS System"), 3000);
      return;
    }

    console.log("✅ Frontend validation passed");

    // Hide modal immediately to prevent blocking
    this.hideModal("userModal");

    // Show immediate optimistic feedback
    const originalTitle = document.title;
    document.title = `${actionText} user...`;

    try {
      // Use setTimeout to break blocking IPC chain
      setTimeout(async () => {
        try {
          let result;

          if (isEditing) {
            // For editing, only send PIN if it was changed
            const updateData = {
              username: userData.username,
              role: userData.role,
            };

            if (userData.pin) {
              // PIN was provided, change it
              await window.electronAPI.users.changePin(
                this.currentEditingUser.user_id,
                userData.pin
              );
            }

            result = await window.electronAPI.users.updateUser(
              this.currentEditingUser.user_id,
              updateData
            );
            this.currentEditingUser = null; // Clear editing state
          } else {
            console.log("🔍 Frontend calling addUser with:", {
              ...userData,
              pin: "****",
            });
            result = await window.electronAPI.users.addUser(userData);
            console.log("🔍 Frontend received addUser result:", result);
          }

          console.log(`User ${actionText.toLowerCase()} result:`, result);

          if (result.success) {
            console.log("✅ SUCCESS:", result.message);
            document.title = `✅ User ${actionText.toLowerCase()}d successfully!`;

            // Reset title after 3 seconds
            setTimeout(() => {
              document.title = originalTitle;
            }, 3000);

            // Refresh users data in background
            window.requestIdleCallback(() => {
              this.loadUsersData().then(() => {
                console.log(
                  `Users data refreshed after ${actionText.toLowerCase()}`
                );
              });
            });
          } else {
            console.error("❌ ERROR:", result.error);
            document.title = `❌ Error ${actionText.toLowerCase()} user`;
            setTimeout(() => {
              document.title = originalTitle;
            }, 3000);
          }
        } catch (error) {
          document.title = `❌ User ${actionText.toLowerCase()} error`;
          console.error(`User ${actionText.toLowerCase()} error:`, error);
          setTimeout(() => {
            document.title = originalTitle;
          }, 3000);
        }
      }, 10);

      console.log(
        `User ${actionText.toLowerCase()} started in background - UI remains responsive!`
      );
    } catch (error) {
      document.title = "❌ Submission error";
      console.error(`Error starting user ${actionText.toLowerCase()}:`, error);
      setTimeout(() => {
        document.title = originalTitle;
      }, 3000);
    }
  }

  async handleStockAdjustmentSubmit(e) {
    e.preventDefault();

    const productId = parseInt(
      document.getElementById("adjustmentProduct").value
    );
    const quantity = parseInt(
      document.getElementById("adjustmentQuantity").value
    );
    const reason =
      document.getElementById("adjustmentReason").value || "Manual adjustment";

    // Hide modal immediately to prevent blocking
    this.hideModal("stockAdjustmentModal");

    // Clear search filters immediately
    const searchInput = document.getElementById("productSearch");
    if (searchInput) {
      searchInput.value = "";
    }
    const inventorySearchInput = document.getElementById("inventorySearch");
    if (inventorySearchInput) {
      inventorySearchInput.value = "";
    }

    // Use setTimeout to break blocking IPC chain
    setTimeout(async () => {
      try {
        const result = await window.electronAPI.inventory.adjustStock(
          productId,
          quantity,
          reason
        );

        if (result.success) {
          console.log(
            "✅ STOCK ADJUSTED:",
            `New quantity: ${result.data.new_quantity}`
          );

          // Background refresh without blocking UI
          window.requestIdleCallback(() => {
            Promise.all([this.loadInventory(), this.loadProducts()]).then(
              () => {
                console.log("Stock adjustment refresh completed in background");
              }
            );
          });
        } else {
          console.error("❌ STOCK ADJUSTMENT ERROR:", result.error);
        }
      } catch (error) {
        console.error("❌ Error adjusting stock:", error);
      }
    }, 10);
  }

  async loadSalesData() {
    await this.loadTodaySales();
    await this.loadSalesTable();
  }

  async loadSalesTable() {
    try {
      const startDate = document.getElementById("salesStartDate")?.value;
      const endDate = document.getElementById("salesEndDate")?.value;

      const filters = {};
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;

      const result = await window.electronAPI.reports.getSalesReport(filters);
      if (result.success) {
        this.displaySalesTable(result.data.sales);
        this.updateSalesSummary(result.data.summary);
      }
    } catch (error) {
      console.error("Error loading sales data:", error);
    }
  }

  displaySalesTable(sales) {
    const tbody = document.querySelector("#salesTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    sales.forEach((sale) => {
      const row = document.createElement("tr");
      const date = new Date(sale.sale_date).toLocaleDateString();

      row.innerHTML = `
        <td>${sale.receipt_number}</td>
        <td>${date}</td>
        <td>${sale.username}</td>
        <td>${sale.item_count}</td>
        <td>${sale.payment_method}</td>
        <td>GHS ${sale.total_amount.toFixed(2)}</td>
        <td>
          <button onclick="posApp.printReceipt(${
            sale.sale_id
          })" class="btn-small">Reprint</button>
          ${this.currentUser && this.currentUser.role === 'admin' ? 
            `<button onclick="posApp.deleteSale(${sale.sale_id}, '${sale.receipt_number}')" class="btn-small btn-danger" title="Delete Sale">
              <i class="fas fa-trash"></i>
            </button>` : ''
          }
        </td>
            `;
      tbody.appendChild(row);
    });
  }

  updateSalesSummary(summary) {
    const periodSales = document.getElementById("periodTotalSales");
    const periodRevenue = document.getElementById("periodTotalRevenue");

    if (periodSales) periodSales.textContent = summary.total_sales || 0;
    if (periodRevenue)
      periodRevenue.textContent = `GHS ${(summary.total_revenue || 0).toFixed(
        2
      )}`;
  }

  filterSales() {
    this.loadSalesTable();
  }

  async loadUsersData() {
    try {
      const result = await window.electronAPI.users.getUsers();
      if (result.success) {
        this.displayUsersTable(result.data);
      }
    } catch (error) {
      console.error("Error loading users data:", error);
    }
  }

  displayUsersTable(users) {
    const tbody = document.querySelector("#usersTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    users.forEach((user) => {
      const row = document.createElement("tr");
      const created = new Date(user.created_at).toLocaleDateString();
      const lastLogin = user.last_login
        ? new Date(user.last_login).toLocaleDateString()
        : "Never";
      const status = user.is_active ? "Active" : "Inactive";

      row.innerHTML = `
        <td>${user.username}</td>
        <td>${user.role}</td>
        <td>${created}</td>
        <td>${lastLogin}</td>
        <td>${status}</td>
        <td>
          <button onclick="posApp.editUser(${
            user.user_id
          })" class="btn-small admin-only" title="Edit User">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="posApp.toggleUserStatus(${
            user.user_id
          })" class="btn-small" title="${
        user.is_active ? "Deactivate" : "Activate"
      } User">
            ${
              user.is_active
                ? '<i class="fas fa-user-slash"></i>'
                : '<i class="fas fa-user-check"></i>'
            }
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  async editUser(userId) {
    try {
      const result = await window.electronAPI.users.getUserById(userId);
      if (result.success) {
        const user = result.data;

        // Populate form with user data
        document.getElementById("userName").value = user.username;
        document.getElementById("userRole").value = user.role;
        document.getElementById("userPin").value = ""; // Don't show existing PIN

        // Update modal title and store editing user
        document.getElementById("userModalTitle").textContent = "Edit User";
        this.currentEditingUser = user;

        // Make PIN optional for editing
        const pinInput = document.getElementById("userPin");
        const pinHelp = document.getElementById("pinHelp");
        pinInput.required = false;
        pinInput.placeholder = "Leave blank to keep current PIN";
        pinHelp.textContent =
          "Leave blank to keep current PIN, or enter 4 digits to change";

        this.showModal("userModal");
      } else {
        console.error("❌ Error loading user:", result.error);
      }
    } catch (error) {
      console.error("❌ Error loading user data:", error);
    }
  }

  async toggleUserStatus(userId) {
    try {
      const result = await window.electronAPI.users.toggleUserStatus(userId);
      if (result.success) {
        console.log("✅", result.message);
        await this.loadUsersData();
      } else {
        console.error("❌ Error:", result.error);
      }
    } catch (error) {
      console.error("❌ Error toggling user status:", error);
    }
  }

  async loadReportsView() {
    // Initialize report view
  }

  async generateReport() {
    const startDate = document.getElementById("reportStartDate")?.value;
    const endDate = document.getElementById("reportEndDate")?.value;

    const filters = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;

    try {
      let result;
      switch (this.currentReport) {
        case "sales":
          result = await window.electronAPI.reports.getSalesReport(filters);
          break;
        case "inventory":
          result = await window.electronAPI.reports.getInventoryReport();
          break;
        case "user-performance":
          result = await window.electronAPI.reports.getUserPerformanceReport(
            filters
          );
          break;
        default:
          console.error("❌ Invalid report type");
          return;
      }

      if (result.success) {
        this.displayReportResults(result.data);
      } else {
        console.error("❌ Error generating report:", result.error);
      }
    } catch (error) {
      console.error("❌ Error generating report:", error);
    }
  }

  displayReportResults(data) {
    const container = document.getElementById("reportResults");
    if (!container) return;

    let html = "";

    switch (this.currentReport) {
      case "sales":
        html = this.formatSalesReport(data);
        break;
      case "inventory":
        html = this.formatInventoryReport(data);
        break;
      case "user-performance":
        html = this.formatUserPerformanceReport(data);
        break;
      default:
        html = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }

    container.innerHTML = html;
  }

  formatSalesReport(data) {
    const { sales, summary } = data;

    return `
      <div class="report-summary">
        <h3>📊 Sales Summary</h3>
        <div class="summary-grid">
          <div class="summary-card">
            <h4>Total Sales</h4>
            <p class="big-number">${summary.total_sales || 0}</p>
          </div>
          <div class="summary-card">
            <h4>Total Revenue</h4>
            <p class="big-number">GHS ${(summary.total_revenue || 0).toFixed(
              2
            )}</p>
          </div>
          <div class="summary-card">
            <h4>Average Sale</h4>
            <p class="big-number">GHS ${(summary.average_sale || 0).toFixed(
              2
            )}</p>
          </div>
          <div class="summary-card">
            <h4>Cash Sales</h4>
            <p class="big-number">${summary.cash_sales || 0}</p>
          </div>
        </div>
      </div>
      
      <div class="report-details">
        <h3>📋 Recent Sales (Last 10)</h3>
        <div class="report-table-container">
          <table class="report-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date</th>
                <th>Cashier</th>
                <th>Amount</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              ${sales
                .slice(0, 10)
                .map(
                  (sale) => `
                <tr>
                  <td>${sale.receipt_number}</td>
                  <td>${new Date(sale.sale_date).toLocaleDateString()}</td>
                  <td>${sale.username}</td>
                  <td>GHS ${sale.total_amount.toFixed(2)}</td>
                  <td>${sale.payment_method}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <p class="report-note">💡 Export to Excel for complete sales data and detailed analytics</p>
      </div>
    `;
  }

  formatInventoryReport(data) {
    const { category_report, low_stock_products, overall_summary } = data;

    return `
      <div class="report-summary">
        <h3>📦 Inventory Overview</h3>
        <div class="summary-grid">
          <div class="summary-card">
            <h4>Total Products</h4>
            <p class="big-number">${overall_summary.total_products || 0}</p>
          </div>
          <div class="summary-card">
            <h4>Total Stock Value</h4>
            <p class="big-number">GHS ${(
              overall_summary.total_selling_value || 0
            ).toFixed(2)}</p>
          </div>
          <div class="summary-card">
            <h4>Low Stock Items</h4>
            <p class="big-number text-warning">${
              overall_summary.low_stock_count || 0
            }</p>
          </div>
          <div class="summary-card">
            <h4>Out of Stock</h4>
            <p class="big-number text-danger">${
              overall_summary.out_of_stock_count || 0
            }</p>
          </div>
        </div>
      </div>

      <div class="report-details">
        <h3>🏷️ Category Summary</h3>
        <div class="report-table-container">
          <table class="report-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Products</th>
                <th>Total Stock</th>
                <th>Total Value</th>
                <th>Low Stock Items</th>
              </tr>
            </thead>
            <tbody>
              ${category_report
                .map(
                  (cat) => `
                <tr>
                  <td>${cat.category_name}</td>
                  <td>${cat.product_count}</td>
                  <td>${cat.total_stock}</td>
                  <td>GHS ${(cat.total_value || 0).toFixed(2)}</td>
                  <td class="${
                    cat.low_stock_count > 0 ? "text-warning" : ""
                  }">${cat.low_stock_count}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>

      ${
        low_stock_products.length > 0
          ? `
        <div class="report-details">
          <h3>⚠️ Low Stock Alerts</h3>
          <div class="report-table-container">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Current Stock</th>
                  <th>Minimum Required</th>
                  <th>Shortage</th>
                </tr>
              </thead>
              <tbody>
                ${low_stock_products
                  .slice(0, 10)
                  .map(
                    (product) => `
                  <tr>
                    <td>${product.product_name}</td>
                    <td class="text-warning">${product.stock_quantity}</td>
                    <td>${product.minimum_stock}</td>
                    <td class="text-danger">${product.shortage}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `
          : ""
      }

      <p class="report-note">💡 Export to Excel for complete inventory analysis with charts and trends</p>
    `;
  }

  formatUserPerformanceReport(data) {
    const { user_performance } = data;

    return `
      <div class="report-details">
        <h3>👥 User Performance Summary</h3>
        <div class="report-table-container">
          <table class="report-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Total Sales</th>
                <th>Total Revenue</th>
                <th>Average Sale</th>
                <th>Last Sale</th>
              </tr>
            </thead>
            <tbody>
              ${user_performance
                .map(
                  (user) => `
                <tr>
                  <td>${user.username}</td>
                  <td>${user.role}</td>
                  <td>${user.total_sales || 0}</td>
                  <td>GHS ${(user.total_revenue || 0).toFixed(2)}</td>
                  <td>GHS ${(user.average_sale || 0).toFixed(2)}</td>
                  <td>${
                    user.last_sale
                      ? new Date(user.last_sale).toLocaleDateString()
                      : "N/A"
                  }</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <p class="report-note">💡 Export to Excel for detailed user analytics and performance trends</p>
      </div>
    `;
  }

  async exportReport() {
    try {
      // Get date filters
      const startDate = document.getElementById("reportStartDate")?.value;
      const endDate = document.getElementById("reportEndDate")?.value;

      const filters = {};
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;

      // Show loading state
      const loadingMsg = this.showLoadingMessage(
        `Generating ${this.currentReport} report...`
      );

      const result = await window.electronAPI.reports.exportReport(
        this.currentReport,
        filters
      );

      // Hide loading
      this.hideLoadingMessage(loadingMsg);

      if (result.success) {
        this.showSuccessToast(
          `${this.currentReport} Report Exported!`,
          `File: ${result.data.filename} (${this.formatFileSize(
            result.data.file_size
          )}) saved to ${result.data.export_path}`,
          8000
        );
        console.log("✅ Report exported:", result.data);
      } else {
        this.showErrorToast("Export Failed", result.error);
        console.error("❌ Error exporting report:", result.error);
      }
    } catch (error) {
      this.showErrorToast("Export Error", error.message);
      console.error("❌ Error exporting report:", error);
    }
  }

  async loadSettings() {
    try {
      const result = await window.electronAPI.system.getSettings();
      if (result.success) {
        this.populateSettings(result.data);
      }

      const systemInfo = await window.electronAPI.system.getSystemInfo();
      if (systemInfo.success) {
        this.displaySystemInfo(systemInfo.data);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  populateSettings(settings) {
    Object.keys(settings).forEach((key) => {
      const element = document.getElementById(key);
      if (element) {
        element.value = settings[key];
      }
    });
  }

  displaySystemInfo(info) {
    const container = document.getElementById("systemInfo");
    if (!container) return;

    container.innerHTML = `
      <h4>System Information</h4>
      <p>Database Size: ${info.database.size_mb} MB</p>
      <p>Total Products: ${info.database.total_products}</p>
      <p>Total Sales: ${info.database.total_sales}</p>
      <p>Backups Available: ${info.backup_info.count}</p>
    `;
  }

  async saveSettings() {
    const settings = {
      business_name: document.getElementById("businessName")?.value,
      business_phone: document.getElementById("businessPhone")?.value,
      business_address: document.getElementById("businessAddress")?.value,
      currency: document.getElementById("currency")?.value,
      low_stock_threshold: document.getElementById("lowStockThreshold")?.value,
      session_timeout: document.getElementById("sessionTimeout")?.value,
    };

    try {
      // Show loading state
      const loadingMsg = this.showLoadingMessage("Saving settings...");

      const result = await window.electronAPI.system.updateSettings(settings);

      // Hide loading
      this.hideLoadingMessage(loadingMsg);

      if (result.success) {
        this.showSuccessToast(
          "Settings Saved!",
          "Your business settings have been updated and will take effect immediately."
        );
        console.log("✅ Settings saved successfully");

        // Refresh system info
        await this.loadSettings();
      } else {
        this.showErrorToast("Failed to Save Settings", result.error);
        console.error("❌ Error saving settings:", result.error);
      }
    } catch (error) {
      this.showErrorToast("Settings Error", error.message);
      console.error("❌ Error saving settings:", error);
    }
  }

  async createBackup() {
    try {
      // Show loading state
      const loadingMsg = this.showLoadingMessage("Creating backup...");

      const result = await window.electronAPI.system.backup();

      // Hide loading
      this.hideLoadingMessage(loadingMsg);

      if (result.success) {
        this.showSuccessToast(
          "Backup Created Successfully!",
          `File: ${result.data.backup_filename} (${result.data.backup_size}) saved to ${result.data.backup_path}`,
          8000
        );
        console.log("✅ Backup created:", result.data);
      } else {
        this.showErrorToast("Backup Failed", result.error);
        console.error("❌ Error creating backup:", result.error);
      }
    } catch (error) {
      this.showErrorToast("Backup Error", error.message);
      console.error("❌ Error creating backup:", error);
    }
  }

  showExportDataOptions() {
    // Create a proper modal for export options
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h3><i class="fas fa-download"></i> Export Data</h3>
        <p>Choose what data you want to export:</p>
        <div class="export-options">
          <button class="btn-primary export-option" data-type="products">
            <i class="fas fa-boxes"></i> Products & Inventory
          </button>
          <button class="btn-primary export-option" data-type="sales">
            <i class="fas fa-chart-line"></i> Sales Data
          </button>
          <button class="btn-primary export-option" data-type="users">
            <i class="fas fa-users"></i> Users Data
          </button>
          <button class="btn-primary export-option" data-type="inventory">
            <i class="fas fa-history"></i> Inventory Transactions
          </button>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary close-export-modal">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelectorAll(".export-option").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const type = e.currentTarget.dataset.type;
        this.exportData(type);
        document.body.removeChild(modal);
      });
    });

    modal.querySelector(".close-export-modal").addEventListener("click", () => {
      document.body.removeChild(modal);
    });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  async exportData(type) {
    try {
      // Show loading state
      const loadingMsg = this.showLoadingMessage(`Exporting ${type} data...`);

      const result = await window.electronAPI.system.exportData(type);

      // Hide loading
      this.hideLoadingMessage(loadingMsg);

      if (result.success) {
        this.showSuccessToast(
          `${type} Data Exported!`,
          `File: ${result.data.filename} (${
            result.data.record_count
          } records, ${this.formatFileSize(result.data.file_size)}) saved to ${
            result.data.export_path
          }`,
          8000
        );
        console.log("✅ Data exported:", result.data);
      } else {
        this.showErrorToast("Export Failed", result.error);
        console.error("❌ Error exporting data:", result.error);
      }
    } catch (error) {
      this.showErrorToast("Export Error", error.message);
      console.error("❌ Error exporting data:", error);
    }
  }

  showLoadingMessage(message) {
    const loading = document.createElement("div");
    loading.className = "modal";
    loading.innerHTML = `
      <div class="modal-content text-center">
        <div class="loading"></div>
        <p>${message}</p>
      </div>
    `;
    document.body.appendChild(loading);
    return loading;
  }

  hideLoadingMessage(loadingElement) {
    if (loadingElement && loadingElement.parentNode) {
      loadingElement.parentNode.removeChild(loadingElement);
    }
  }

  // Utility function to format file sizes
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  async searchByBarcode(barcode) {
    if (!barcode.trim()) return;

    try {
      const product = await window.electronAPI.inventory.getProductByBarcode(
        barcode
      );
      if (product) {
        this.addToCart(product);
        document.getElementById("barcodeInput").value = "";
      } else {
        console.warn("⚠️ Product not found");
      }
    } catch (error) {
      console.error("❌ Error searching by barcode:", error);
    }
  }

  async loadDashboardData() {
    try {
      const result = await window.electronAPI.reports.getDashboardData();
      if (result.success) {
        this.displayDashboardData(result.data);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  }

  displayDashboardData(data) {
    // Today's metrics
    document.getElementById("todaySalesCount").textContent =
      data.today.sales_count || 0;
    document.getElementById("todayRevenue").textContent = `GHS ${(
      data.today.revenue || 0
    ).toFixed(2)}`;

    // Month's metrics
    document.getElementById("monthSalesCount").textContent =
      data.month.sales_count || 0;
    document.getElementById("monthRevenue").textContent = `GHS ${(
      data.month.revenue || 0
    ).toFixed(2)}`;

    // Inventory metrics
    document.getElementById("totalProducts").textContent =
      data.inventory_summary.total_products || 0;
    document.getElementById("lowStockCount").textContent =
      data.inventory_summary.low_stock_count || 0;

    // Low stock alerts
    this.displayLowStockAlerts(data.low_stock_products);

    // Top products
    this.displayTopProducts(data.top_products);

    // Recent sales
    this.displayRecentSales(data.recent_sales);
  }

  displayLowStockAlerts(products) {
    const container = document.getElementById("lowStockAlerts");
    if (!container) return;

    container.innerHTML = "";

    if (products.length === 0) {
      container.innerHTML = "<p>No low stock alerts</p>";
      return;
    }

    products.forEach((product) => {
      const alert = document.createElement("div");
      alert.className = "alert-item";
      alert.innerHTML = `
        <span class="product-name">${product.product_name}</span>
        <span class="stock-info">Stock: ${product.stock_quantity} (Min: ${product.minimum_stock})</span>
      `;
      container.appendChild(alert);
    });
  }

  displayTopProducts(products) {
    const container = document.getElementById("topProducts");
    if (!container) return;

    container.innerHTML = "";

    if (products.length === 0) {
      container.innerHTML = "<p>No sales data available</p>";
      return;
    }

    products.forEach((product, index) => {
      const item = document.createElement("div");
      item.className = "top-product-item";
      item.innerHTML = `
        <span class="rank">${index + 1}.</span>
        <span class="product-name">${product.product_name}</span>
        <span class="sales-info">Sold: ${product.total_sold}</span>
      `;
      container.appendChild(item);
    });
  }

  displayRecentSales(sales) {
    const container = document.getElementById("recentSales");
    if (!container) return;

    container.innerHTML = "";

    if (sales.length === 0) {
      container.innerHTML = "<p>No recent sales</p>";
      return;
    }

    sales.forEach((sale) => {
      const item = document.createElement("div");
      item.className = "recent-sale-item";
      const date = new Date(sale.sale_date).toLocaleString();
      item.innerHTML = `
        <span class="receipt-number">${sale.receipt_number}</span>
        <span class="sale-amount">GHS ${sale.total_amount.toFixed(2)}</span>
        <span class="sale-date">${date}</span>
      `;
      container.appendChild(item);
    });
  }

  async loadTodaySales() {
    try {
      const result = await window.electronAPI.sales.getDailySummary();
      if (result.success) {
        const summary = result.data.summary;
        document.getElementById("todayTotalSales").textContent =
          summary.total_sales || 0;
        document.getElementById("todayTotalRevenue").textContent = `GHS ${(
          summary.total_revenue || 0
        ).toFixed(2)}`;
      }
    } catch (error) {
      console.error("Error loading today's sales:", error);
    }
  }

  async refreshData() {
    await this.loadProducts();
    await this.loadTodaySales();
  }

  async printReceipt(saleId) {
    try {
      // Get receipt data
      const receiptResult = await window.electronAPI.sales.getReceiptData(
        saleId
      );

      if (!receiptResult.success) {
        throw new Error(receiptResult.error);
      }

      // Print receipt
      const printResult = await window.electronAPI.printer.printReceipt(
        receiptResult.data
      );

      if (printResult.success) {
        console.log("Receipt printed successfully");
      } else {
        console.error("Print failed:", printResult.error);
      }

      return printResult;
    } catch (error) {
      console.error("Print receipt error:", error);
      throw error;
    }
  }

  async deleteSale(saleId, receiptNumber) {
    // Only allow admins to delete sales
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      this.showErrorToast("Access Denied", "Only administrators can delete sales");
      return;
    }

    const confirmed = await this.showConfirmDialog(
      "Delete Sale Confirmation",
      `Are you sure you want to delete this sale?`,
      `Receipt: ${receiptNumber}\n\n⚠️ THIS ACTION CANNOT BE UNDONE!\n\n` +
      `This will permanently remove the sale from the database and restore the stock for all items in this sale.`
    );

    if (!confirmed) return;

    try {
      // Show loading
      const loadingMsg = this.showLoadingMessage("Deleting sale...");

      const result = await window.electronAPI.sales.deleteSale(saleId);

      this.hideLoadingMessage(loadingMsg);

      if (result.success) {
        this.showSuccessToast(
          "Sale Deleted Successfully",
          `Receipt ${receiptNumber} has been deleted and stock restored`
        );
        
        // Refresh the sales table
        await this.loadSalesTable();
        
        // Refresh dashboard if we're on dashboard
        if (this.currentView === 'dashboard') {
          await this.loadDashboardData();
        }
        
        // Refresh inventory to show restored stock
        await this.loadInventory();
      } else {
        this.showErrorToast("Delete Failed", result.error || "Failed to delete sale");
      }
    } catch (error) {
      console.error("Delete sale error:", error);
      this.showErrorToast("Delete Error", error.message);
    }
  }

  async testPrinter() {
    try {
      const result = await window.electronAPI.printer.testPrinter();
      if (result.success) {
        let message = result.message;
        if (result.details && result.details.found) {
          message += `\n\nPrinter Details:\n${result.details.message}`;
        } else if (result.details && !result.details.found) {
          message += `\n\n${result.details.message}`;
          if (result.details.suggestion) {
            message += `\n\n${result.details.suggestion}`;
          }
        }
        console.log("✅ PRINTER:", message);
      } else {
        console.error("❌ Printer test failed:", result.error);
      }
    } catch (error) {
      console.error("❌ Printer test error:", error);
    }
  }

  async checkPrinterStatus() {
    const indicator = document.getElementById("printerIndicator");
    const statusText = document.getElementById("printerStatusText");

    // Show checking status
    indicator.className = "status-indicator checking";
    statusText.textContent = "Checking printer status...";

    try {
      const result = await window.electronAPI.printer.detectPrinters();

      if (result.found) {
        indicator.className = "status-indicator connected";
        statusText.textContent = result.message;

        // Show detailed info in console
        console.log("Printer Details:", result);
        if (result.printers) {
          console.log(
            "Working Printers:",
            result.printers.filter((p) => p.status.includes("working"))
          );
        }
      } else {
        indicator.className = "status-indicator disconnected";
        statusText.textContent =
          result.message || "No working thermal printer detected";

        // Show troubleshooting info
        if (result.suggestion) {
          console.log("Printer Troubleshooting:", result.suggestion);
        }
        if (result.printers && result.printers.length > 0) {
          console.log("Detected but non-working devices:", result.printers);
        }
      }
    } catch (error) {
      console.error("Printer status check error:", error);
      indicator.className = "status-indicator disconnected";
      statusText.textContent = "Error checking printer status";
    }
  }

  async updatePrinterStatus() {
    // Auto-check printer status when switching to sales view
    if (document.getElementById("salesView").classList.contains("active")) {
      await this.checkPrinterStatus();
    }
  }

  // Cart functionality with optimized rendering
  addToCart(product) {
    if (product.stock_quantity <= 0) {
      console.warn("⚠️ Product is out of stock");
      return;
    }

    const existingItem = this.cart.find(
      (item) => item.product_id === product.product_id
    );

    if (existingItem) {
      if (existingItem.quantity < product.stock_quantity) {
        existingItem.quantity++;
        existingItem.total_price =
          existingItem.quantity * existingItem.unit_price;
      } else {
        console.warn("⚠️ Cannot add more items. Insufficient stock.");
        return;
      }
    } else {
      this.cart.push({
        product_id: product.product_id,
        product_name: product.product_name,
        unit_price: product.selling_price,
        quantity: 1,
        total_price: product.selling_price,
      });
    }

    this.updateCart();
  }

  updateCart() {
    const cartItems = document.getElementById("cartItems");
    const cartTotal = document.getElementById("cartTotal");
    const checkoutBtn = document.getElementById("checkoutBtn");

    if (this.cart.length === 0) {
      cartItems.innerHTML = '<div class="cart-empty">Cart is empty</div>';
      cartTotal.textContent = "GHS 0.00";
      checkoutBtn.disabled = true;
      return;
    }

    cartItems.innerHTML = "";
    let total = 0;

    this.cart.forEach((item, index) => {
      const cartItem = document.createElement("div");
      cartItem.className = "cart-item";
      cartItem.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.product_name}</div>
                    <div class="cart-item-price">GHS ${item.unit_price.toFixed(
                      2
                    )} each</div>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="posApp.updateQuantity(${index}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="posApp.updateQuantity(${index}, 1)">+</button>
                    <button class="remove-btn" onclick="posApp.removeFromCart(${index})">×</button>
                </div>
            `;
      cartItems.appendChild(cartItem);
      total += item.total_price;
    });

    cartTotal.textContent = `GHS ${total.toFixed(2)}`;
    checkoutBtn.disabled = false;
  }

  updateQuantity(index, change) {
    const item = this.cart[index];
    const product = this.products.find((p) => p.product_id === item.product_id);

    const newQuantity = item.quantity + change;

    if (newQuantity <= 0) {
      this.removeFromCart(index);
      return;
    }

    if (newQuantity > product.stock_quantity) {
      console.warn("⚠️ Cannot add more items. Insufficient stock.");
      return;
    }

    item.quantity = newQuantity;
    item.total_price = item.quantity * item.unit_price;
    this.updateCart();
  }

  removeFromCart(index) {
    this.cart.splice(index, 1);
    this.updateCart();
  }

  async handleCheckout() {
    if (this.cart.length === 0) {
      this.showWarningToast(
        "Empty Cart",
        "Please add items to cart before checkout"
      );
      return;
    }
    if (!this.currentUser) return;

    const total = this.cart.reduce((sum, item) => sum + item.total_price, 0);

    // Remove blocking confirm - proceed directly with checkout
    console.log("💰 Processing checkout for GHS", total.toFixed(2));
    try {
      const saleData = {
        user_id: this.currentUser.user_id,
        items: this.cart,
        payment_method: this.paymentMethod,
      };

      const result = await window.electronAPI.sales.createSale(saleData);

      if (result.success) {
        console.log("✅ Sale completed! Receipt:", result.data.receipt_number);
        
        // Show success message with print option
        this.showSuccessToastWithPrintOption(
          "Sale Completed!",
          `Receipt #${result.data.receipt_number} - GHS ${total.toFixed(2)}`,
          result.data.sale_id
        );

        // Automatically print receipt using the SAME method as manual reprint
        setTimeout(async () => {
          try {
            console.log("🖨️ Auto-printing receipt for sale ID:", result.data.sale_id);
            
            // First verify the sale data is available before printing
            const receiptResult = await window.electronAPI.sales.getReceiptData(result.data.sale_id);
            
            if (!receiptResult.success) {
              throw new Error(`Failed to get receipt data: ${receiptResult.error}`);
            }
            
            console.log("📄 Receipt data retrieved successfully");
            
            // Now print using the exact same method as manual reprint
            const printResult = await window.electronAPI.printer.printReceipt(receiptResult.data);
            
            if (printResult.success) {
              console.log("✅ Receipt printed successfully via auto-print");
              this.showInfoToast(
                "Receipt Printed",
                "Receipt sent to printer/notepad automatically",
                3000
              );
            } else {
              console.log("⚠️ Receipt printing had issues:", printResult.error);
              this.showWarningToast(
                "Printing Issue", 
                "Auto-print failed. Use 'Print Receipt' button or reprint from Sales history.",
                6000
              );
            }
            
          } catch (printError) {
            console.error("❌ Auto-print failed:", printError);
            this.showWarningToast(
              "Auto-Print Failed", 
              "Sale completed successfully. Use 'Print Receipt' button below or reprint from Sales history.",
              6000
            );
          }
        }, 1000); // Longer delay to ensure database transaction is complete
        this.cart = [];
        this.updateCart();

        // Use chunked rendering for refresh
        await this.loadProducts();
        await this.loadTodaySales();
      } else {
        console.error("❌ Sale failed:", result.error);
        this.showErrorToast("Sale Failed", result.error || "Please try again");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      this.showErrorToast("Checkout Error", "Please try again");
    }
  }

  // Bulk Selection and Deletion Functions
  toggleSelectAll() {
    const selectAllCheckbox = document.getElementById("selectAll");
    const productCheckboxes = document.querySelectorAll(".product-checkbox");

    productCheckboxes.forEach((checkbox) => {
      checkbox.checked = selectAllCheckbox.checked;
      const row = checkbox.closest("tr");
      if (selectAllCheckbox.checked) {
        row.classList.add("selected");
      } else {
        row.classList.remove("selected");
      }
    });

    this.updateBulkActionsVisibility();
  }

  toggleProductSelection(checkbox, productId) {
    const row = checkbox.closest("tr");
    if (checkbox.checked) {
      row.classList.add("selected");
    } else {
      row.classList.remove("selected");
    }

    // Update select all checkbox
    const selectAllCheckbox = document.getElementById("selectAll");
    const productCheckboxes = document.querySelectorAll(".product-checkbox");
    const checkedBoxes = document.querySelectorAll(".product-checkbox:checked");

    selectAllCheckbox.checked =
      checkedBoxes.length === productCheckboxes.length;
    selectAllCheckbox.indeterminate =
      checkedBoxes.length > 0 && checkedBoxes.length < productCheckboxes.length;

    this.updateBulkActionsVisibility();
  }

  updateBulkActionsVisibility() {
    const checkedBoxes = document.querySelectorAll(".product-checkbox:checked");
    const bulkActions = document.getElementById("bulkActions");
    const selectedCount = document.getElementById("selectedCount");

    if (checkedBoxes.length > 0) {
      bulkActions.classList.remove("hidden");
      selectedCount.textContent = checkedBoxes.length;
    } else {
      bulkActions.classList.add("hidden");
    }
  }

  clearSelection() {
    const selectAllCheckbox = document.getElementById("selectAll");
    const productCheckboxes = document.querySelectorAll(".product-checkbox");
    const bulkActions = document.getElementById("bulkActions");

    if (selectAllCheckbox) selectAllCheckbox.checked = false;

    productCheckboxes.forEach((checkbox) => {
      checkbox.checked = false;
      const row = checkbox.closest("tr");
      row.classList.remove("selected");
    });

    if (bulkActions) bulkActions.classList.add("hidden");
  }

  async bulkDeleteProducts() {
    const checkedBoxes = document.querySelectorAll(".product-checkbox:checked");

    if (checkedBoxes.length === 0) {
      this.showWarningToast(
        "No Selection",
        "Please select products to delete first"
      );
      return;
    }

    const productIds = Array.from(checkedBoxes).map((checkbox) =>
      parseInt(checkbox.value)
    );
    const productNames = Array.from(checkedBoxes).map((checkbox) => {
      const row = checkbox.closest("tr");
      return row.querySelector("td:nth-child(3)").textContent; // Product name column (accounting for checkbox column)
    });

    // Show confirmation dialog
    const confirmed = await this.showConfirmDialog(
      "Bulk Delete Confirmation",
      `Are you sure you want to delete ${productIds.length} selected products?`,
      `Products to be deleted:\n${productNames.slice(0, 5).join("\n")}` +
        `${
          productNames.length > 5
            ? `\n... and ${productNames.length - 5} more`
            : ""
        }\n\n` +
        `⚠️ THIS ACTION CANNOT BE UNDONE!`
    );

    if (!confirmed) {
      return;
    }

    // Show loading state
    const loadingMsg = this.showLoadingMessage(
      `Deleting ${productIds.length} products...`
    );

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Delete products one by one
      for (const productId of productIds) {
        try {
          const result = await window.electronAPI.inventory.deleteProduct(
            productId
          );
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`Product ID ${productId}: ${result.error}`);
          }
        } catch (error) {
          errorCount++;
          errors.push(`Product ID ${productId}: ${error.message}`);
        }
      }

      // Hide loading
      this.hideLoadingMessage(loadingMsg);

      // Show results
      if (successCount > 0) {
        // Reload inventory to reflect changes
        await this.loadInventory();
        await this.loadProducts(); // Refresh POS products too
      }

      if (errorCount === 0) {
        this.showSuccessToast(
          "Bulk Deletion Successful!",
          `Successfully deleted ${successCount} products. Inventory refreshed.`
        );
      } else {
        this.showWarningToast(
          "Bulk Deletion Completed",
          `${successCount} products deleted, ${errorCount} failed. Check console for details.`,
          8000
        );
        console.error("Deletion errors:", errors);
      }
    } catch (error) {
      this.hideLoadingMessage(loadingMsg);
      this.showErrorToast(
        "Deletion Failed",
        `Bulk deletion failed: ${error.message}`
      );
      console.error("Bulk deletion error:", error);
    }
  }

  // Modal and Toast System
  showConfirmDialog(title, message, details = "") {
    return new Promise((resolve) => {
      const modal = document.getElementById("confirmModal");
      const titleEl = document.getElementById("confirmTitle");
      const messageEl = document.getElementById("confirmMessage");
      const detailsEl = document.getElementById("confirmDetails");
      const cancelBtn = document.getElementById("confirmCancelBtn");
      const okBtn = document.getElementById("confirmOkBtn");

      titleEl.textContent = title;
      messageEl.textContent = message;

      if (details) {
        detailsEl.textContent = details;
        detailsEl.style.display = "block";
      } else {
        detailsEl.style.display = "none";
      }

      modal.classList.remove("hidden");

      const handleCancel = () => {
        modal.classList.add("hidden");
        cancelBtn.removeEventListener("click", handleCancel);
        okBtn.removeEventListener("click", handleOk);
        resolve(false);
      };

      const handleOk = () => {
        modal.classList.add("hidden");
        cancelBtn.removeEventListener("click", handleCancel);
        okBtn.removeEventListener("click", handleOk);
        resolve(true);
      };

      cancelBtn.addEventListener("click", handleCancel);
      okBtn.addEventListener("click", handleOk);
    });
  }

  showToast(type, title, message, duration = 5000) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icons = {
      success: "fas fa-check-circle",
      error: "fas fa-exclamation-circle",
      warning: "fas fa-exclamation-triangle",
      info: "fas fa-info-circle",
    };

    toast.innerHTML = `
      <button class="toast-close">&times;</button>
      <div class="toast-header">
        <i class="${icons[type]}"></i>
        <span>${title}</span>
      </div>
      <div class="toast-body">${message}</div>
    `;

    container.appendChild(toast);

    // Show toast with animation
    setTimeout(() => toast.classList.add("show"), 100);

    // Auto remove
    const autoRemove = setTimeout(() => this.removeToast(toast), duration);

    // Manual close
    const closeBtn = toast.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => {
      clearTimeout(autoRemove);
      this.removeToast(toast);
    });

    return toast;
  }

  removeToast(toast) {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  // Convenience methods for different toast types
  showSuccessToast(title, message, duration) {
    return this.showToast("success", title, message, duration);
  }

  showErrorToast(title, message, duration) {
    return this.showToast("error", title, message, duration);
  }

  showWarningToast(title, message, duration) {
    return this.showToast("warning", title, message, duration);
  }

  showInfoToast(title, message, duration) {
    return this.showToast("info", title, message, duration);
  }

  showSuccessToastWithPrintOption(title, message, saleId, duration = 8000) {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = "toast toast-success";
    
    const uniqueId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    toast.id = uniqueId;

    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-header">
          <i class="fas fa-check-circle"></i>
          <span class="toast-title">${title}</span>
          <button class="toast-close" onclick="posApp.removeToast(document.getElementById('${uniqueId}'))">&times;</button>
        </div>
        <div class="toast-message">${message}</div>
        <div class="toast-actions" style="margin-top: 10px; display: flex; gap: 10px;">
          <button class="btn-small" onclick="posApp.printReceipt(${saleId}); posApp.removeToast(document.getElementById('${uniqueId}'));" 
                  style="background: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
            <i class="fas fa-print"></i> Print Receipt
          </button>
          <button class="btn-small" onclick="posApp.removeToast(document.getElementById('${uniqueId}'));" 
                  style="background: #6c757d; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
            Skip
          </button>
        </div>
      </div>
    `;

    toastContainer.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
      if (document.getElementById(uniqueId)) {
        this.removeToast(toast);
      }
    }, duration);

    return toast;
  }
}

// Bulk Upload Functions
function showBulkUploadModal() {
  document.getElementById("bulkUploadModal").classList.remove("hidden");
  resetBulkUploadModal();
  setupFileUploadHandlers();
}

function closeBulkUploadModal() {
  document.getElementById("bulkUploadModal").classList.add("hidden");
  resetBulkUploadModal();
}

function resetBulkUploadModal() {
  // Reset file input
  document.getElementById("csvFileInput").value = "";

  // Hide file info and show placeholder
  document.getElementById("fileInfo").classList.add("hidden");
  document.querySelector(".upload-placeholder").classList.remove("hidden");

  // Reset upload button
  document.getElementById("uploadBtn").disabled = true;

  // Hide progress and results
  document.getElementById("uploadProgress").classList.add("hidden");
  document.getElementById("uploadResults").classList.add("hidden");

  // Reset progress bar
  const progressFill = document.getElementById("progressFill");
  if (progressFill) {
    progressFill.classList.remove("processing");
    progressFill.style.width = "0%";
  }
}

function setupFileUploadHandlers() {
  const fileUploadArea = document.getElementById("fileUploadArea");
  const csvFileInput = document.getElementById("csvFileInput");

  // Click to select file
  fileUploadArea.addEventListener("click", () => {
    csvFileInput.click();
  });

  // File selection handler
  csvFileInput.addEventListener("change", handleFileSelection);

  // Drag and drop handlers
  fileUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    fileUploadArea.classList.add("dragover");
  });

  fileUploadArea.addEventListener("dragleave", () => {
    fileUploadArea.classList.remove("dragover");
  });

  fileUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    fileUploadArea.classList.remove("dragover");

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      csvFileInput.files = files;
      handleFileSelection();
    }
  });
}

function handleFileSelection() {
  const fileInput = document.getElementById("csvFileInput");
  const file = fileInput.files[0];

  if (file) {
    // Show file info
    document.getElementById("fileName").textContent = file.name;
    document.getElementById("fileInfo").classList.remove("hidden");
    document.querySelector(".upload-placeholder").classList.add("hidden");

    // Enable upload button
    document.getElementById("uploadBtn").disabled = false;

    // Hide previous results
    document.getElementById("uploadResults").classList.add("hidden");
  }
}

function clearSelectedFile() {
  document.getElementById("csvFileInput").value = "";
  document.getElementById("fileInfo").classList.add("hidden");
  document.querySelector(".upload-placeholder").classList.remove("hidden");
  document.getElementById("uploadBtn").disabled = true;
  document.getElementById("uploadResults").classList.add("hidden");
}

async function processBulkUpload() {
  const fileInput = document.getElementById("csvFileInput");
  const file = fileInput.files[0];

  if (!file) {
    console.warn("⚠️ Please select a file");
    return;
  }

  try {
    // Show progress
    document.getElementById("uploadProgress").classList.remove("hidden");
    document.getElementById("uploadResults").classList.add("hidden");
    document.getElementById("uploadBtn").disabled = true;

    // Animate progress bar
    const progressFill = document.getElementById("progressFill");
    progressFill.classList.add("processing");
    progressFill.style.width = "30%";
    document.getElementById("progressText").textContent = "Reading file...";

    // Determine file type and read content
    const fileExtension = file.name.toLowerCase().split(".").pop();
    let fileData;
    let fileType;

    if (fileExtension === "csv") {
      fileData = await readFileContent(file);
      fileType = "csv";
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      fileData = await readFileAsBuffer(file);
      fileType = "excel";
    } else {
      throw new Error("Unsupported file format");
    }

    // Update progress
    progressFill.style.width = "60%";
    document.getElementById("progressText").textContent =
      "Processing products...";

    // Process bulk upload
    const result = await window.electronAPI.inventory.bulkUploadProducts(
      fileData,
      fileType
    );

    // Complete progress
    progressFill.style.width = "100%";
    document.getElementById("progressText").textContent = "Complete!";

    setTimeout(() => {
      progressFill.classList.remove("processing");
      document.getElementById("uploadProgress").classList.add("hidden");

      if (result.success) {
        displayUploadResults(result.data);
        if (result.data.successful > 0) {
          console.log(
            "✅ Successfully uploaded",
            result.data.successful,
            "products!"
          );
          // Refresh both inventory and POS product lists
          if (window.posApp) {
            window.posApp.loadInventory();
            window.posApp.loadProducts();

            // Clear any search filters to show new products
            const searchInput = document.getElementById("productSearch");
            if (searchInput) {
              searchInput.value = "";
              window.posApp.displayProducts(); // Show all products
            }

            // Also clear inventory search filters
            const inventorySearchInput =
              document.getElementById("inventorySearch");
            if (inventorySearchInput) {
              inventorySearchInput.value = "";
              window.posApp.filterInventory(); // Show all inventory products
            }
          }
        }
      } else {
        console.error("❌ Upload failed:", result.error);
      }

      document.getElementById("uploadBtn").disabled = false;
    }, 1000);
  } catch (error) {
    console.error("Bulk upload error:", error);
    console.error(
      "❌ Failed to process file. Please check the format and try again."
    );

    // Hide progress and reset
    document.getElementById("uploadProgress").classList.add("hidden");
    document.getElementById("progressFill").classList.remove("processing");
    document.getElementById("uploadBtn").disabled = false;
  }
}

function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

function readFileAsBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
}

function displayUploadResults(results) {
  document.getElementById("uploadResults").classList.remove("hidden");

  // Update summary
  document.getElementById("successCount").textContent = results.successful;
  document.getElementById("failedCount").textContent = results.failed;

  // Display errors if any
  const errorDetails = document.getElementById("errorDetails");
  const errorList = document.getElementById("errorList");

  if (results.errors && results.errors.length > 0) {
    errorDetails.classList.remove("hidden");
    errorList.innerHTML = "";

    results.errors.forEach((error) => {
      const errorItem = document.createElement("div");
      errorItem.className = "error-item";
      errorItem.textContent = error;
      errorList.appendChild(errorItem);
    });
  } else {
    errorDetails.classList.add("hidden");
  }
}

async function downloadTemplate(format = "csv") {
  console.log("downloadTemplate called with format:", format);

  try {
    console.log("Calling electronAPI.inventory.generateTemplate...");
    const result = await window.electronAPI.inventory.generateTemplate(format);
    console.log("generateTemplate result:", result);

    if (result.success) {
      let blob, filename, mimeType;

      if (format === "excel") {
        blob = new Blob([result.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        filename = "product_upload_template.xlsx";
        mimeType = "Excel";
      } else {
        blob = new Blob([result.data], { type: "text/csv" });
        filename = "product_upload_template.csv";
        mimeType = "CSV";
      }

      console.log("Creating download link for:", filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log("Download initiated successfully");
      console.log("✅", mimeType, "template downloaded successfully!");
    } else {
      console.error("generateTemplate failed:", result.error);
      console.error("❌ Failed to generate template:", result.error);
    }
  } catch (error) {
    console.error("Download template error:", error);
    console.error("❌ Failed to download template:", error.message);
  }
}

// Keep backward compatibility
async function downloadCSVTemplate() {
  return downloadTemplate("csv");
}

// Initialize the app
let posApp;

// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", () => {
  posApp = new POSApp();

  // Make it globally available for onclick handlers
  window.posApp = posApp;

  // Also make functions globally available
  window.showAddProductModal = () => posApp.showAddProductModal();
  window.showBulkUploadModal = showBulkUploadModal;
  window.closeBulkUploadModal = closeBulkUploadModal;
  window.downloadCSVTemplate = downloadCSVTemplate;
  window.downloadTemplate = downloadTemplate;
  window.processBulkUpload = processBulkUpload;
  window.handleFileSelection = handleFileSelection;
  window.clearSelectedFile = clearSelectedFile;

  // Bulk operations functions
  window.toggleSelectAll = () => posApp.toggleSelectAll();
  window.bulkDeleteProducts = () => posApp.bulkDeleteProducts();
  window.clearSelection = () => posApp.clearSelection();
});
