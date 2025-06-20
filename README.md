# DOMINAK 757 BUSINESS CENTRE - POS System

A complete offline inventory management and Point of Sale (POS) system built with Electron for wholesale businesses in Ghana.

## 🏪 Features

### Core Functionality

- **100% Offline Operation** - No internet connection required
- **Point of Sale (POS)** - Complete sales transaction processing
- **Inventory Management** - Product catalog and stock tracking
- **User Authentication** - PIN-based login system (Admin/Cashier roles)
- **Receipt Printing** - Thermal receipt printer support
- **Sales Reporting** - Daily, weekly, and monthly reports
- **Database Backup** - Local database backup functionality

### User Roles

- **Admin**: Full POS access, inventory viewing, sales reports, system settings
- **Cashier**: POS access, receipt printing, limited inventory viewing

### Business Features

- Product search and barcode scanning
- Shopping cart management
- Cash and card payment processing
- Low stock alerts
- Sales analytics
- Receipt generation

## 🚀 Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Windows 10/11 (primary target)

### Setup Instructions

1. **Clone or download the project**

   ```bash
   cd dominak-757-pos
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up sample data (optional)**

   ```bash
   npm run setup-data
   ```

4. **Start the application**
   ```bash
   npm start
   ```

## 🔐 Default Login Credentials

| Role    | PIN  |
| ------- | ---- |
| Admin   | 1234 |
| Cashier | 0000 |

## 💻 Usage

### Starting a Sale

1. Login with your PIN and role
2. Navigate to the POS view (default)
3. Search for products or scan barcodes
4. Click products to add to cart
5. Adjust quantities as needed
6. Select payment method (Cash/Card)
7. Click "Complete Sale" to process

### Managing Inventory

1. Login as Admin
2. Navigate to "Inventory" tab
3. View current stock levels
4. Monitor low stock alerts
5. Review product information

### Viewing Sales Reports

1. Navigate to "Sales" tab
2. View today's sales summary
3. Access detailed transaction history
4. Generate reports for specific date ranges

## 🗂️ Project Structure

```
dominak-757-pos/
├── src/
│   ├── main.js                 # Electron main process
│   ├── preload.js             # Secure IPC bridge
│   ├── database/
│   │   ├── DatabaseManager.js # SQLite database manager
│   │   └── sampleData.js      # Sample data insertion
│   ├── services/
│   │   ├── AuthService.js     # User authentication
│   │   ├── SalesService.js    # Sales processing
│   │   ├── InventoryService.js# Inventory management
│   │   └── PrinterService.js  # Receipt printing
│   └── renderer/
│       ├── index.html         # Main UI
│       ├── css/
│       │   └── styles.css     # Application styling
│       └── js/
│           └── app.js         # Frontend JavaScript
├── data/                      # Database files (auto-created)
├── package.json
├── context.txt               # Project requirements
└── README.md
```

## 🛠️ Development

### Available Scripts

```bash
npm start          # Start the application
npm run dev        # Start in development mode
npm run setup-data # Insert sample data
npm run build      # Build for production
npm run build-win  # Build Windows installer
```

### Adding Sample Data

To populate the database with sample products:

```bash
npm run setup-data
```

This adds various products across different categories including:

- Food & Beverages (Rice, Oil, Sugar, etc.)
- Electronics (Chargers, Cables, Batteries)
- General merchandise (Soap, Stationery, etc.)

## 🗄️ Database

The system uses SQLite for local data storage with the following main tables:

- **users** - User accounts and authentication
- **products** - Product catalog
- **categories** - Product categories
- **sales** - Sales transactions
- **sale_items** - Individual sale line items
- **inventory_transactions** - Stock movement history
- **settings** - System configuration

## 🖨️ Printer Setup

The system supports thermal receipt printers. To configure:

1. Connect your thermal printer via USB
2. Install printer drivers
3. Use "Test Printer" in settings to verify connection
4. Receipts will print automatically after each sale

## 📊 Business Configuration

Default business information can be updated:

- **Business Name**: DOMINAK 757 BUSINESS CENTRE
- **Phone**: 0549831901
- **Location**: Ghana
- **Currency**: Ghana Cedi (GHS)

## 🔒 Security Features

- PIN-based authentication (4-digit numeric)
- Role-based access control
- Session timeout (30 minutes)
- Database encryption at rest
- Audit logging for all transactions

## 💾 Backup & Recovery

### Creating Backups

1. Navigate to Settings (Admin only)
2. Click "Backup Database"
3. Choose backup location
4. Backup file will be saved with timestamp

### Restoring from Backup

Replace the database file in the `data/` directory with your backup file.

## 🌍 Localization

The system is configured for Ghana with:

- Ghana Cedi (GHS) currency
- DD/MM/YYYY date format
- English language interface
- Local business practices

## 🐛 Troubleshooting

### Common Issues

**Application won't start:**

- Ensure Node.js is installed
- Run `npm install` to install dependencies
- Check console for error messages

**Database errors:**

- Ensure `data/` directory has write permissions
- Try deleting database and restarting (will reset data)

**Printer not working:**

- Verify printer connection and drivers
- Use "Test Printer" function in settings
- Check printer compatibility

**Login issues:**

- Use default PINs: Admin (1234), Cashier (0000)
- Ensure PIN is exactly 4 digits
- Check if user account is active

## 📝 License

This project is licensed under the MIT License.

## 🤝 Support

For technical support or feature requests, please refer to the project documentation or contact your system administrator.

---

**Built for DOMINAK 757 BUSINESS CENTRE**  
_Professional offline POS solution for wholesale businesses in Ghana_
