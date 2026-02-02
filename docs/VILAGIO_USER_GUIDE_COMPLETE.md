# Vilagio Inventory Management System - Complete User Guide

**Version:** 1.0.0  
**Last Updated:** February 1, 2026  
**Company:** Vilagio Technologies Ltd.  
**System Status:** Production Ready

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Login & Authentication](#login--authentication)
3. [Dashboard Overview](#dashboard-overview)
4. [Products Management](#products-management)
5. [Inventory Operations](#inventory-operations)
6. [Analytics](#analytics)
7. [Reports](#reports)
8. [Settings](#settings)
9. [Common Workflows](#common-workflows)
10. [Troubleshooting](#troubleshooting)
11. [Keyboard Shortcuts](#keyboard-shortcuts)
12. [FAQ](#frequently-asked-questions)

---

## Getting Started

### What is Vilagio Inventory System?

The Vilagio Inventory Management System is your complete solution for managing water bottle inventory across multiple warehouse locations. The system helps you:

- Track stock levels in real-time across 6 warehouse locations
- Record all inventory movements (receipts, issues, transfers, adjustments)
- Generate comprehensive reports on stock levels, movements, and valuations
- Manage 88+ water bottle products across 12 categories
- View analytics and trends with interactive charts
- Manage multiple currencies with automatic conversion

### Who Can Use It?

The system supports 4 user roles with different access levels:

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| **Admin** | Everything - full system access, user management, all operations | Nothing restricted |
| **Manager** | Manage products, inventory operations, view all reports, export data | Add/remove users |
| **Staff** | Record transactions (receive, issue, transfer, adjust), view products and inventory | Create products, access reports, manage users |
| **Viewer** | View products, inventory levels, basic reports | Make any changes, record transactions |

### System Access

**URL:** http://localhost:3000 (Development) or https://inventory.vilag.io (Production)

**Default Login Credentials:**
- Email: admin@vilag.io
- Password: Admin@123

⚠️ **Important:** Change the default password after first login!

---

## Login & Authentication

### Logging In

1. **Navigate to Login Page**
   - Open your web browser
   - Go to the system URL
   - You'll see the Vilagio login page with the globe logo

2. **Enter Credentials**
   - Email: Your registered email address
   - Password: Your secure password
   - Click "Sign In" button

3. **What Happens Next**
   - System validates your credentials
   - If correct: Redirects to Dashboard
   - If incorrect: Shows error message "Invalid credentials"
   - Session created with 15-minute access token

### Understanding Sessions

- **Access Token:** Valid for 15 minutes
- **Refresh Token:** Valid for 7 days
- **Auto-Refresh:** Token automatically refreshes when you're active
- **Auto-Logout:** After 7 days of inactivity, you'll need to login again

### Logging Out

**Option 1: Sidebar Menu**
1. Look at the left sidebar
2. Scroll to the bottom
3. Click "Logout" (icon with arrow leaving)

**Option 2: Profile Dropdown** (Future feature)
1. Click your profile picture/name (top right)
2. Select "Logout"

**What Happens:**
- Session terminated immediately
- Tokens cleared from browser
- Redirected to login page
- For security, logout on shared computers!

### Security Tips

✅ **Do:**
- Use strong, unique passwords
- Logout when leaving your desk
- Change password regularly
- Report suspicious activity

❌ **Don't:**
- Share your password
- Use simple passwords (123456, password)
- Stay logged in on public computers
- Share your session with others

---

## Dashboard Overview

The Dashboard is your command center - the first page you see after login. It provides a quick snapshot of your entire inventory operation.

### Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  Dashboard    [Search Bar]    [Bell] [Profile]      │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                   │
│ Sidebar  │              Dashboard Content                    │
│          │                                                   │
│ • Dash   │  ┌──────────┬──────────┬──────────┬──────────┐  │
│ • Prod   │  │ Total    │ Low      │ Total    │ Active   │  │
│ • Inv    │  │ Products │ Stock    │ Value    │ Users    │  │
│ • Analy  │  │  88      │  12      │ K124,590 │  24      │  │
│ • Report │  └──────────┴──────────┴──────────┴──────────┘  │
│ • Set    │                                                   │
│          │  Quick Actions:                                   │
│          │  [Add Product] [Record Transaction] [Report]     │
│          │                                                   │
│          │  Recent Activity:                                 │
│          │  • Received 500 units of WB-500-001               │
│          │  • Transferred 200 units WH-A → WH-C              │
│          │                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

### Statistics Cards (Top Row)

**1. Total Products**
- **Number Shown:** Count of all active products in catalog
- **Current Value:** 88 products
- **What It Means:** Your complete product range
- **Color:** Blue card
- **Icon:** Package icon

**2. Low Stock Items**
- **Number Shown:** Count of products below reorder level
- **Example:** 12 items
- **What It Means:** Products that need reordering soon
- **Color:** Orange/Yellow card (warning)
- **Icon:** Alert triangle
- **Action:** Click to see which items need attention

**3. Total Inventory Value**
- **Number Shown:** Total value of all stock (cost price × quantity)
- **Example:** K124,590 (Zambian Kwacha)
- **Currency:** Displays in your selected currency (Settings → Currency)
- **Calculation:** Sum of (quantity × standard cost) for all products
- **Color:** Green card
- **Icon:** Trending up arrow

**4. Active Users**
- **Number Shown:** Count of active user accounts
- **Example:** 24 users
- **What It Means:** Team members who can access the system
- **Color:** Purple card
- **Icon:** Users icon
- **Who Sees This:** Admin only

### Quick Actions (Middle Section)

Three prominent buttons for common tasks:

**1. Add New Product**
- **What It Does:** Opens modal to create a new product
- **Who Can Use:** Admin, Manager
- **When to Use:** Adding new water bottle types to catalog
- **Color:** Blue button
- **Result:** Opens product creation form

**2. Record Transaction**
- **What It Does:** Takes you to Inventory page
- **Who Can Use:** Admin, Manager, Staff
- **When to Use:** Need to receive, issue, transfer, or adjust stock
- **Color:** Gray button
- **Result:** Redirects to /inventory page

**3. Generate Report**
- **What It Does:** Takes you to Reports page
- **Who Can Use:** Admin, Manager
- **When to Use:** Need stock reports, valuations, or analysis
- **Color:** Gray button
- **Result:** Redirects to /reports page

### Recent Activity (Bottom Section)

Shows the last 5 inventory transactions:

**What You See:**
- Transaction type (Received, Issued, Transferred, Adjusted)
- Product SKU and name
- Quantity and unit
- Location(s)
- Timestamp
- User who performed it

**Example Entries:**
```
📦 Received 500 pieces of WB-500-001 at WH-A
    By John Mwale • 2 hours ago

🔄 Transferred 200 cartons WB-1L-003 from WH-A to WH-C
    By Mary Banda • 5 hours ago

⚙️ Adjusted +50 pieces WB-750-002 at WH-D (Cycle count)
    By Peter Phiri • Yesterday, 3:45 PM
```

**Color Coding:**
- Green = Received (stock in)
- Blue = Issued (stock out)
- Purple = Transferred (moved)
- Yellow = Adjusted (corrected)

---

## Products Management

The Products page is where you manage your entire product catalog - all 88+ water bottle products across 12 categories.

### Page Structure

```
┌──────────────────────────────────────────────────────────────┐
│                        PRODUCTS                               │
├──────────────────────────────────────────────────────────────┤
│  Stock Status Cards:                                         │
│  ┌────────────┬────────────┬────────────┐                   │
│  │ In Stock   │ Low Stock  │ Out Stock  │                   │
│  │    76      │     12     │     0      │                   │
│  │  (Green)   │  (Yellow)  │   (Red)    │                   │
│  └────────────┴────────────┴────────────┘                   │
│                                                               │
│  [Search: ___________] [Category: All ▼] [Status: All ▼]     │
│  [Add Product]                               [Export CSV]     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ SKU       │ Product    │ Category  │ Stock │ Status│    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ WB-500-001│ 500ML PET  │ 500ML     │ 5,000 │ ✓ In  │    │
│  │ WB-500-002│ 500ML HDPE │ 500ML     │  800  │ ⚠ Low │    │
│  │ WB-1L-001 │ 1L PET     │ 1 Liter   │ 3,200 │ ✓ In  │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Stock Status Cards

At the top of the page, three cards show your stock health:

**In Stock (Green)**
- **Count:** Products with stock above reorder level
- **Example:** 76 products
- **Meaning:** Products adequately stocked
- **Action:** Click card to filter table to show only in-stock items

**Low Stock (Yellow)**
- **Count:** Products at or below reorder level but not zero
- **Example:** 12 products
- **Meaning:** Products need reordering soon
- **Action:** Click card to see which items to reorder
- **Urgent:** Review and create purchase orders

**Out of Stock (Red)**
- **Count:** Products with zero stock
- **Example:** 0 products (good!)
- **Meaning:** Products completely depleted
- **Action:** Immediate reordering needed
- **Impact:** Cannot fulfill orders for these items

### Search and Filters

**Search Box (Left)**
- **Search By:** SKU, product name, or description
- **How It Works:** Type and results filter instantly
- **Examples:**
  - Type "500" → Shows all 500ML products
  - Type "WB-1L" → Shows all 1-liter products
  - Type "clear" → Shows all clear bottles
- **Clear Search:** Delete text or click X

**Category Filter (Dropdown)**
- **Options:**
  - All Categories (default - shows everything)
  - 500ML Bottles
  - 750ML Bottles
  - 1 Liter Bottles
  - 1.5 Liter Bottles
  - 2 Liter Bottles
  - 5 Liter Bottles
  - 10 Liter Bottles
  - 20 Liter Bottles
  - Caps & Closures
  - Labels & Packaging
  - Bottles (Refillable)
  - Water Treatment Chemicals
- **Result:** Table shows only products in selected category

**Stock Status Filter (Dropdown)**
- **Options:**
  - All Status (default)
  - In Stock (above reorder level)
  - Low Stock (at or below reorder level)
  - Out of Stock (zero quantity)
- **Result:** Table filters to matching products

**Combining Filters:**
You can use all three together:
- Search: "500"
- Category: "500ML Bottles"
- Status: "Low Stock"
- Result: 500ML bottles that are running low

### Products Table

**Columns Explained:**

1. **SKU** (Stock Keeping Unit)
   - Format: WB-{size}-{number}
   - Example: WB-500-001
   - Unique identifier for each product
   - Clickable (opens product details)

2. **Product Name**
   - Full descriptive name
   - Example: "500ML PET Bottle - Clear"
   - Clickable (opens product details)

3. **Category**
   - Product category
   - Example: "500ML Bottles"
   - Groups similar products

4. **Stock**
   - Total quantity across all locations
   - Example: 5,000
   - Sum of all warehouse quantities

5. **Status**
   - Visual badge with color
   - ✓ In Stock (green) - Adequate stock
   - ⚠ Low Stock (yellow) - Below reorder level
   - ✗ Out of Stock (red) - Zero quantity

6. **Selling Price**
   - Price per unit
   - Currency: Your selected currency (ZMW default)
   - Example: K27.50

7. **Standard Cost**
   - Cost per unit
   - Used for valuation calculations
   - Example: K22.00

8. **Actions**
   - Eye icon (👁️) - View details
   - Clickable row - Same as eye icon

### Adding a New Product

**Who Can:** Admin, Manager

**Steps:**

1. **Click "Add Product" Button** (top right)
   - Blue button with plus icon
   - Opens modal dialog

2. **Fill Required Fields** (marked with *)

   **Basic Information:**
   - **SKU*** - Unique code (e.g., WB-500-009)
     - Must be unique
     - Format: Letters, numbers, hyphens
     - Cannot duplicate existing SKU
   
   - **Product Name*** - Full descriptive name
     - Example: "500ML PET Bottle - Blue Tinted"
     - Be specific and clear
   
   - **Category*** - Select from dropdown
     - Choose appropriate size category
     - Required for organization
   
   - **Description** - Optional details
     - Material, color, special features
     - Example: "Food-grade PET, BPA-free, blue tinted"

   **Measurements:**
   - **Unit of Measure*** - Select from dropdown
     - Options: piece, carton, pallet, case, bottle, unit
     - Default: piece
     - Affects all transactions

   **Pricing:**
   - **Standard Cost** - Cost per unit
     - Enter in USD (converted automatically)
     - Example: 0.06
     - Used for valuation

   - **Selling Price** - Price per unit
     - Enter in USD (converted automatically)
     - Example: 0.08
     - Margin calculated automatically

   **Inventory:**
   - **Reorder Level** - Minimum stock threshold
     - Example: 1000
     - Triggers low stock alerts

   **Status:**
   - **Active** - Checkbox (checked by default)
     - Checked = Product available for use
     - Unchecked = Product discontinued/inactive

3. **Click "Create Product"**
   - Blue button at bottom
   - System validates all fields
   - Creates product in database

4. **Success Confirmation**
   - Green checkmark animation
   - "Product created successfully" message
   - Modal closes automatically
   - New product appears in table

**Common Errors:**
- ❌ "SKU already exists" → Choose different SKU
- ❌ "Missing required fields" → Fill all fields marked *
- ❌ "Invalid price" → Enter positive numbers only

### Viewing Product Details

**How to Open:**
- Click anywhere on product row, OR
- Click eye icon (👁️) in Actions column

**Product Detail Modal Shows:**

**Section 1: Basic Information**
- SKU
- Product Name
- Category
- Unit of Measure
- Description
- Status (Active/Inactive badge)

**Section 2: Pricing & Costs**
- Standard Cost (in your currency)
- Selling Price (in your currency)
- Margin (auto-calculated percentage)
  - Formula: ((Selling - Cost) / Selling) × 100
  - Example: Cost K22, Sell K27.50 → 20% margin
- Displayed in green if positive margin

**Section 3: Stock Summary**
- **Total Stock:** Sum across all locations
- **Available:** Stock not allocated/reserved
- **Allocated:** Stock reserved for orders (future feature)
- **Reorder Level:** Minimum threshold
- Color-coded:
  - Green if stock > reorder level
  - Orange if stock ≤ reorder level
  - Red if stock = 0

**Section 4: Inventory by Location** (Table)

Shows stock breakdown by warehouse:

| Location | Type | On Hand | Allocated | Available |
|----------|------|---------|-----------|-----------|
| WH-A - Main Warehouse | Main | 2,000 | 0 | 2,000 |
| WH-B - Overflow | Overflow | 1,500 | 0 | 1,500 |
| WH-C - Finished Goods | Finished | 1,000 | 0 | 1,000 |
| WH-D - Raw Materials | Raw | 500 | 0 | 500 |

**Column Meanings:**
- **On Hand:** Physical stock at location
- **Allocated:** Reserved for specific orders
- **Available:** On Hand - Allocated (can be used)
- **Type:** Location purpose (Main, Overflow, Retail, etc.)

**Section 5: Record Information**
- Created At: When product was added
- Last Updated: When product was last modified
- Format: "Feb 1, 2026, 10:30 AM"

**Closing the Modal:**
- Click X (top right)
- Click outside modal (dark area)
- Press ESC key

### Exporting Products

**Who Can:** Everyone (all roles)

**Steps:**

1. **Apply Filters** (optional)
   - Search for specific products
   - Filter by category
   - Filter by stock status

2. **Click "Export CSV"** (top right)
   - Button with download icon
   - Exports currently filtered products

3. **File Downloads**
   - Filename: `products_export_YYYY-MM-DD.csv`
   - Example: `products_export_2026-02-01.csv`
   - Saves to your Downloads folder

4. **CSV Contains:**
   - All visible columns
   - Filtered results only
   - Current stock quantities
   - Prices in your selected currency

**Using the Export:**
- Open in Excel or Google Sheets
- Analyze data offline
- Create presentations
- Share with suppliers
- Print reports

---

## Inventory Operations

The Inventory page is where all stock movements happen. This is the heart of the system - where you receive deliveries, issue materials to production, transfer stock between warehouses, and make adjustments.

### Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│                       INVENTORY                               │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────┬─────────┬──────────┬────────────┬─────────┐    │
│  │ Receive │ Issue   │ Transfer │ Adjustment │ History │    │
│  └─────────┴─────────┴──────────┴────────────┴─────────┘    │
│                                                               │
│  [Tab Content Shows Here]                                     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

The page has 5 tabs across the top. Each tab does a different type of operation:

### Tab 1: Receive (Incoming Stock)

**When to Use:**
- Receiving delivery from supplier
- Stock arrived at warehouse
- Incoming materials

**Who Can Use:** Admin, Manager, Staff

**Step-by-Step Process:**

1. **Select Product**
   - Click "Product" dropdown
   - Search or scroll to find product
   - Format: "SKU - Product Name"
   - Example: "WB-500-001 - 500ML PET Bottle - Clear"

2. **Enter Quantity**
   - Type number in "Quantity" field
   - Must be positive number
   - Example: 5000
   - Unit of Measure shows automatically (e.g., "pieces")

3. **Select Receiving Location**
   - Click "Receiving Location" dropdown
   - Choose warehouse where stock is going
   - Options:
     - WH-A - Main Warehouse
     - WH-B - Overflow Storage
     - WH-C - Finished Goods
     - WH-D - Raw Materials
     - WH-E - Quality Control
     - WH-F - Retail Outlet

4. **Add Reference Number** (Optional)
   - PO Number, Delivery Note, etc.
   - Example: "PO-2024-001"
   - Helps track source of stock

5. **Add Unit Cost** (Optional)
   - Cost per unit from supplier
   - Enter in USD
   - Example: 0.06
   - Used for cost tracking

6. **Add Notes** (Optional)
   - Any additional information
   - Example: "Partial delivery, balance next week"
   - Helpful for record keeping

7. **Click "Receive Inventory"**
   - Green button at bottom
   - System validates everything
   - Creates transaction

**What Happens:**
- ✅ Stock increases at selected location
- ✅ Transaction recorded with unique number (RCV-YYYYMMDD-NNNN)
- ✅ Timestamp recorded
- ✅ Your user ID logged
- ✅ Green success animation shows
- ✅ Form resets for next entry

**Success Message:**
```
✓ Inventory Received!
Transaction recorded successfully
```

**Example Transaction:**
```
Received: 5,000 pieces of WB-500-001
Location: WH-A - Main Warehouse
Reference: PO-2024-001
Unit Cost: $0.06
Total Value: $300.00
Performed By: John Mwale
Transaction #: RCV-20260201-0001
```

### Tab 2: Issue (To Production)

**When to Use:**
- Sending materials to production line
- Issuing raw materials for manufacturing
- Stock leaving warehouse for use

**Who Can Use:** Admin, Manager, Staff

**Step-by-Step Process:**

1. **Select Product**
   - Choose product to issue
   - Example: "WB-500-001 - 500ML PET Bottle - Clear"

2. **Select Source Location** ("Issue From")
   - Where is the stock currently?
   - Example: WH-D - Raw Materials

3. **System Shows Available Stock**
   - Real-time availability displayed
   - Example: "Available at WH-D: 5,000 pieces"
   - Updates when you change location

4. **Enter Quantity to Issue**
   - Type quantity
   - **Important:** Cannot exceed available stock
   - System prevents negative inventory
   - If you try to issue more than available:
     - Field turns red
     - Warning message: "Exceeds available stock"
     - Button becomes disabled

5. **Add Production Order Reference** (Optional)
   - Production order number
   - Example: "PROD-2024-001"
   - Links to production batch

6. **Add Notes** (Optional)
   - Example: "For production line 2"

7. **Click "Issue to Production"**
   - Blue button
   - Only enabled if quantity is valid

**What Happens:**
- ✅ Stock decreases at source location
- ✅ Transaction recorded (ISS-YYYYMMDD-NNNN)
- ✅ Cannot create negative stock
- ✅ Availability checked before saving

**Stock Validation:**
```
Current Stock: 5,000 pieces
You Try to Issue: 6,000 pieces
Result: ❌ Error - "Insufficient stock. Available: 5,000"

Current Stock: 5,000 pieces
You Issue: 2,000 pieces
Result: ✓ Success - Stock now 3,000
```

**Example Transaction:**
```
Issued: 2,000 pieces of WB-500-001
From: WH-D - Raw Materials
To: Production
Reference: PROD-2024-001
New Stock at WH-D: 3,000 pieces
Transaction #: ISS-20260201-0002
```

### Tab 3: Transfer (Between Locations)

**When to Use:**
- Moving stock from one warehouse to another
- Balancing stock across locations
- Relocating inventory

**Who Can Use:** Admin, Manager, Staff

**Step-by-Step Process:**

1. **Select Product**
   - Choose product to move

2. **Select "From Location" (Source)**
   - Where is stock currently?
   - Example: WH-A - Main Warehouse
   - System shows available stock at this location

3. **Available Stock Display**
   - Shows stock at source location
   - Example: "Available: 5,000 pieces"

4. **Select "To Location" (Destination)**
   - Where should stock go?
   - Example: WH-C - Finished Goods
   - **Validation:** Cannot be same as "From Location"
   - If you select same location:
     - Warning: "Source and destination must be different"
     - Button disabled

5. **Visual Indicator**
   - Arrow shows direction
   - Example display:
   ```
   ┌──────────┐    ➜    ┌──────────┐
   │  WH-A    │  ====▶  │  WH-C    │
   │   From   │         │    To    │
   └──────────┘         └──────────┘
   ```

6. **Enter Quantity**
   - Must not exceed available at source
   - Validated in real-time

7. **Add Notes** (Optional)
   - Why transferring?
   - Example: "Preparing for distribution"

8. **Click "Transfer Stock"**
   - Purple button
   - Validates both locations different
   - Checks source availability

**What Happens:**
- ✅ Stock decreases at source location
- ✅ Stock increases at destination location
- ✅ Both locations updated in same transaction
- ✅ Transaction recorded (TRF-YYYYMMDD-NNNN)

**Example Transaction:**
```
Transferred: 1,000 pieces of WB-500-001
From: WH-A - Main Warehouse (was 5,000, now 4,000)
To: WH-C - Finished Goods (was 1,000, now 2,000)
Reason: Preparing for distribution
Transaction #: TRF-20260201-0003
```

**Common Scenarios:**
```
Scenario 1: Overflow to Main
From: WH-B (Overflow) - 3,000 pieces
To: WH-A (Main) - 2,000 pieces
Transfer: 1,500 pieces
Result: WH-B = 1,500, WH-A = 3,500

Scenario 2: Balancing Stock
From: WH-A - 10,000 pieces
To: WH-F (Retail) - 500 pieces
Transfer: 2,000 pieces
Result: WH-A = 8,000, WH-F = 2,500
```

### Tab 4: Adjustment (Stock Corrections)

**When to Use:**
- Physical count differs from system
- Found missing stock
- Found extra stock
- Damaged goods write-off
- Cycle count corrections

**Who Can Use:** Admin, Manager, Staff

**Step-by-Step Process:**

1. **Select Product**
   - Product to adjust

2. **Select Location**
   - Which warehouse needs adjustment?

3. **Current Stock Display**
   - System shows: "Current Stock: 5,000 pieces"
   - Real-time from database

4. **Select Adjustment Type**
   - Two large buttons:
   
   **Add Stock (Green)**
   - Found extra stock
   - Physical count higher than system
   - Click to select
   - Button highlights green

   **Remove Stock (Red)**
   - Stock missing
   - Physical count lower than system
   - Damaged/expired items
   - Click to select
   - Button highlights red

5. **Enter Quantity**
   - Amount to add or remove
   - Always enter as positive number
   - System applies direction based on type selected
   - Example: To remove 100, select "Remove" and enter 100

6. **Stock Preview Box Appears**
   - Shows calculation:
   ```
   Current Stock:    5,000 pieces
   Adjustment:       +500 pieces    (or -500 pieces)
   ─────────────────────────────────
   New Stock:        5,500 pieces   (or 4,500 pieces)
   ```
   - Color-coded:
     - Green for additions
     - Red for removals
     - Red with warning if would go negative

7. **Negative Stock Prevention**
   - If removal would create negative stock:
     - Field turns red
     - Warning: "Would result in negative stock"
     - Button disabled
     - Example:
       - Current: 100 pieces
       - Try to remove: 150 pieces
       - System blocks it

8. **Select Reason** (Required dropdown)
   - 9 predefined reasons:
     1. **Cycle Count Adjustment** - Regular count correction
     2. **Damaged/Defective Items** - Goods damaged
     3. **Expired Items** - Products past expiry
     4. **Items Found** - Discovered stock
     5. **Items Lost/Missing** - Can't find stock
     6. **Inventory Reconciliation** - Periodic reconciliation
     7. **Data Entry Correction** - Fix input errors
     8. **Quality Control Rejection** - Failed QC
     9. **Other (See Notes)** - Other reasons

9. **Add Notes** (Strongly Recommended)
   - Explain the adjustment
   - Examples:
     - "Annual physical count - found 50 extra cartons"
     - "5 pallets damaged in forklift incident"
     - "Data entry error during last receive"
   - Required for audit trail

10. **Click Add/Remove Button**
    - Button text matches selection:
      - "Add Stock" (green) if adding
      - "Remove Stock" (red) if removing
    - Only enabled if everything valid

**What Happens:**
- ✅ Stock adjusted at location (up or down)
- ✅ Transaction recorded (ADJ-YYYYMMDD-NNNN)
- ✅ Reason and notes saved
- ✅ Audit trail complete

**Example Adjustments:**

**Example 1: Cycle Count - Found Extra**
```
Product: WB-500-001
Location: WH-A
Current: 5,000 pieces
Physical Count: 5,050 pieces
Adjustment: +50 pieces (Add Stock)
Reason: Cycle Count Adjustment
Notes: "Monthly cycle count, found 50 extra pieces on shelf B-12"
New Stock: 5,050 pieces
Transaction #: ADJ-20260201-0004
```

**Example 2: Damaged Goods**
```
Product: WB-1L-003
Location: WH-C
Current: 2,000 pieces
Damaged: 75 pieces
Adjustment: -75 pieces (Remove Stock)
Reason: Damaged/Defective Items
Notes: "Forklift damaged pallet during transfer, 75 bottles broken"
New Stock: 1,925 pieces
Transaction #: ADJ-20260201-0005
```

**Example 3: Data Entry Error**
```
Product: WB-2L-001
Location: WH-B
Current: 1,500 pieces
Should Be: 1,450 pieces
Adjustment: -50 pieces (Remove Stock)
Reason: Data Entry Correction
Notes: "Receive transaction on Jan 15 entered 200 instead of 150"
New Stock: 1,450 pieces
Transaction #: ADJ-20260201-0006
```

### Tab 5: History (Transaction Log)

**Purpose:** View complete record of all inventory movements

**Who Can See:** Everyone (all roles)

**Page Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  Search: [____________]  [Filter ▼]  [Export CSV]            │
├──────────────────────────────────────────────────────────────┤
│  Showing 487 transactions                                     │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Txn #  │ Date    │ Type │ Product  │ Qty │ Location  │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ RCV-001│ Feb 1   │ RCV  │ WB-500-  │ 5K  │ To: WH-A  │ │
│  │ ISS-002│ Feb 1   │ ISS  │ WB-500-  │ 2K  │ From: WH-D│ │
│  │ TRF-003│ Jan 31  │ TRF  │ WB-1L-   │ 1K  │ A→C       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ◀ Previous    Page 1 of 25    Next ▶                        │
└──────────────────────────────────────────────────────────────┘
```

**Features:**

**1. Search Box**
- Search across multiple fields:
  - Transaction number
  - Product SKU
  - Product name
  - Location code
  - User name
- Real-time filtering
- Example searches:
  - "RCV" → All receive transactions
  - "WB-500" → All 500ML bottle transactions
  - "WH-A" → All transactions involving WH-A
  - "John" → All transactions by John

**2. Filter Panel**

Click "Filter" button to show options:

**Transaction Type Filter:**
- All Types (default)
- RECEIVE (green badge)
- ISSUE (blue badge)
- TRANSFER (purple badge)
- ADJUSTMENT (yellow badge)
- RETURN (teal badge)
- DAMAGE (red badge)

**Date Range Filter:**
- Start Date: Pick from calendar
- End Date: Pick from calendar
- Examples:
  - Today only
  - Last 7 days
  - Last month
  - Custom range

**Buttons:**
- **Apply Filters:** Shows filtered results
- **Clear All:** Resets to show everything

**3. Results Table**

**Columns:**

1. **Transaction #**
   - Format: XXX-YYYYMMDD-NNNN
   - Prefixes:
     - RCV = Receive
     - ISS = Issue
     - TRF = Transfer
     - ADJ = Adjustment
   - Example: RCV-20260201-0001
   - Clickable to view full details

2. **Date & Time**
   - Format: "Feb 1, 2026, 10:30 AM"
   - Timezone: Your setting (Africa/Lusaka default)
   - Sorted newest first

3. **Type**
   - Color-coded badge
   - Examples:
     - RECEIVE (green)
     - ISSUE (blue)
     - TRANSFER (purple)
     - ADJUSTMENT (yellow)

4. **Product**
   - Shows two lines:
     - Product name
     - SKU (smaller, gray)
   - Example:
     ```
     500ML PET Bottle - Clear
     WB-500-001
     ```

5. **Quantity**
   - Amount moved
   - Unit of measure
   - Example: "5,000 pieces"

6. **Location**
   - For RECEIVE: "To: WH-A"
   - For ISSUE: "From: WH-D"
   - For TRANSFER: "From: WH-A, To: WH-C"
   - For ADJUSTMENT: "At: WH-B"

7. **User**
   - Full name of person who did it
   - Example: "John Mwale"

**4. Pagination**

- Shows 20 transactions per page
- Bottom of table shows:
  - "Page X of Y"
  - Previous button (disabled on first page)
  - Next button (disabled on last page)
- Total count shown at top

**5. Export to CSV**

**Steps:**
1. Apply any filters you want
2. Click "Export CSV" button (top right)
3. File downloads: `inventory_transactions_YYYY-MM-DD.csv`

**CSV Contains:**
- All columns from table
- Only filtered results (if filters applied)
- All pages (not just current page)

**Use Cases:**
- Audit reports
- Month-end reconciliation
- Compliance documentation
- Analysis in Excel
- Sharing with management

**Example Exported Data:**
```csv
Transaction #,Date,Type,SKU,Product,Quantity,UOM,From Location,To Location,User,Notes
RCV-20260201-0001,2026-02-01 10:30,RECEIVE,WB-500-001,500ML PET Bottle,5000,pieces,,WH-A,John Mwale,PO-2024-001
ISS-20260201-0002,2026-02-01 11:15,ISSUE,WB-500-001,500ML PET Bottle,2000,pieces,WH-D,,Mary Banda,PROD-2024-001
TRF-20260201-0003,2026-02-01 14:20,TRANSFER,WB-1L-003,1L PET Bottle,1000,pieces,WH-A,WH-C,Peter Phiri,Distribution
```

**6. Transaction Details** (Future Feature)

Clicking transaction number will show:
- Complete details
- Attached documents
- Related transactions
- Full audit trail

---

## Analytics

The Analytics page provides visual insights into your inventory through interactive charts and graphs.

### Page Overview

```
┌──────────────────────────────────────────────────────────────┐
│                       ANALYTICS                               │
├──────────────────────────────────────────────────────────────┤
│  Date Range: [Last 30 Days ▼]  [Custom: From___ To___]      │
│                                                               │
│  ┌─────────────────────────┬─────────────────────────┐      │
│  │ Stock Movement Trend    │ Stock by Category        │      │
│  │ (Line Chart)            │ (Bar Chart)              │      │
│  └─────────────────────────┴─────────────────────────┘      │
│                                                               │
│  ┌─────────────────────────┬─────────────────────────┐      │
│  │ Stock by Location       │ Transaction Volume       │      │
│  │ (Bar Chart)             │ (Area Chart)             │      │
│  └─────────────────────────┴─────────────────────────┘      │
│                                                               │
│  ┌─────────────────────────┬─────────────────────────┐      │
│  │ Low Stock Items         │ Stock Status             │      │
│  │ (Bar Chart)             │ (Pie Chart)              │      │
│  └─────────────────────────┴─────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

### Date Range Selector

**Preset Options:**
- Last 7 Days
- Last 30 Days (default)
- Last 90 Days
- Year to Date
- Custom Range

**Custom Range:**
- Click "Custom"
- Select Start Date from calendar
- Select End Date from calendar
- Click "Apply"
- All charts update to show selected period

### Chart 1: Stock Movement Trend (Line Chart)

**What It Shows:**
- Stock levels over time
- Multiple products on same chart
- Trend lines for top products

**Features:**
- **X-Axis:** Time (daily/weekly/monthly depending on range)
- **Y-Axis:** Quantity
- **Lines:** Different color per product
- **Hover:** Shows exact values
  - Date
  - Product name
  - Quantity at that point

**Insights You Get:**
- Which products are declining (need reorder)
- Which products are growing (good sales)
- Seasonal patterns
- Unusual spikes or drops

**Example:**
```
Feb 1: WB-500-001 = 5,000 pieces
Jan 25: WB-500-001 = 4,200 pieces
Jan 20: WB-500-001 = 6,500 pieces
Trend: Declining → May need reorder
```

### Chart 2: Stock by Category (Bar Chart)

**What It Shows:**
- Total stock quantity for each category
- Compares categories side-by-side

**Features:**
- **X-Axis:** Categories (500ML, 1L, 2L, etc.)
- **Y-Axis:** Total quantity
- **Bars:** Color-coded by category
- **Hover:** Shows exact count
- **Sorted:** Highest to lowest

**Insights You Get:**
- Which categories have most stock
- Which categories running low
- Stock distribution across product types
- Inventory balance

**Example:**
```
500ML Bottles:    45,000 pieces
1L Bottles:       32,000 pieces
2L Bottles:       18,000 pieces
5L Bottles:       8,500 pieces
```

### Chart 3: Stock by Location (Bar Chart)

**What It Shows:**
- Total stock at each warehouse
- Space utilization

**Features:**
- **X-Axis:** Locations (WH-A, WH-B, etc.)
- **Y-Axis:** Total quantity
- **Bars:** Color per location
- **Hover:** Shows quantity and % of capacity
- **Capacity Line:** Shows max capacity

**Insights You Get:**
- Which warehouses are full
- Which warehouses have space
- Need for redistribution
- Capacity planning

**Example:**
```
WH-A (Main):         75,000 / 100,000 (75% full)
WH-C (Finished):     52,000 / 75,000 (69% full)
WH-B (Overflow):     28,000 / 50,000 (56% full)
```

### Chart 4: Transaction Volume (Area Chart)

**What It Shows:**
- Number of transactions over time
- Transaction types breakdown

**Features:**
- **X-Axis:** Time
- **Y-Axis:** Transaction count
- **Areas:** Stacked by type
  - Green area = Receives
  - Blue area = Issues
  - Purple area = Transfers
  - Yellow area = Adjustments
- **Hover:** Shows count by type

**Insights You Get:**
- Busiest days/weeks
- Transaction patterns
- Operational tempo
- Peak periods

**Example:**
```
Feb 1: 45 transactions (20 receives, 15 issues, 8 transfers, 2 adjustments)
Jan 31: 38 transactions
Jan 30: 52 transactions (peak day)
```

### Chart 5: Low Stock Items (Bar Chart)

**What It Shows:**
- Products below reorder level
- Urgency indication

**Features:**
- **X-Axis:** Product SKUs
- **Y-Axis:** Current stock
- **Bars:** Color shows urgency
  - Red = Critical (≤ minimum level)
  - Orange = Low (≤ reorder point)
- **Reference Line:** Shows reorder level

**Insights You Get:**
- What needs immediate reordering
- Priority sequence
- Reorder quantities needed

**Example:**
```
WB-500-002:  800 (Reorder: 1,000) → Low
WB-1L-005:   250 (Reorder: 500) → Low
WB-2L-002:   50 (Minimum: 100) → Critical!
```

### Chart 6: Stock Status Distribution (Pie Chart)

**What It Shows:**
- Percentage breakdown of stock status
- Overall inventory health

**Segments:**
- **Green Slice:** In Stock (above reorder)
- **Yellow Slice:** Low Stock (at/below reorder)
- **Red Slice:** Out of Stock (zero)

**Features:**
- **Percentages:** Shown on chart
- **Legend:** Color key
- **Hover:** Shows count and percentage
- **Click:** Filters to that status

**Insights You Get:**
- Overall stock health at a glance
- Percentage of products needing attention
- Inventory management performance

**Example:**
```
In Stock:     76 products (86%)    ✓ Healthy
Low Stock:    12 products (14%)    ⚠ Needs attention
Out of Stock: 0 products (0%)      ✓ Good
```

### Using Analytics for Decisions

**Scenario 1: Planning Purchases**
1. Check Stock Movement Trend
   - See which products declining
2. Check Low Stock Items chart
   - Identify urgent needs
3. Export data for PO creation

**Scenario 2: Optimizing Storage**
1. Check Stock by Location
   - Find overloaded warehouses
2. Plan transfers to balance load
3. Maximize space utilization

**Scenario 3: Understanding Patterns**
1. Check Transaction Volume
   - Identify busy periods
2. Plan staffing accordingly
3. Optimize receiving schedules

---

## Reports

The Reports page generates comprehensive reports for analysis, compliance, and decision-making.

### Page Structure

```
┌──────────────────────────────────────────────────────────────┐
│                        REPORTS                                │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │ Stock    │ Low      │ Valua-   │ Movement │ Trans.   │   │
│  │ Levels   │ Stock    │ tion     │ History  │ Summary  │   │
│  │ (Active) │          │          │          │          │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
│                                                               │
│  [Report Content and Filters Show Here]                      │
└──────────────────────────────────────────────────────────────┘
```

### Report 1: Stock Levels Report

**Purpose:** Current stock snapshot across all products and locations

**Who Can Use:** Admin, Manager

**Filters Available:**

1. **Location Filter**
   - All Locations (default)
   - Specific warehouse (WH-A, WH-B, etc.)

2. **Category Filter**
   - All Categories (default)
   - Specific category (500ML, 1L, etc.)

3. **Stock Status Filter**
   - All Status (default)
   - In Stock only
   - Low Stock only
   - Out of Stock only

**Report Contains:**

| SKU | Product | Category | Location | On Hand | Available | Status |
|-----|---------|----------|----------|---------|-----------|--------|
| WB-500-001 | 500ML PET | 500ML | WH-A | 5,000 | 5,000 | ✓ In Stock |
| WB-500-002 | 500ML HDPE | 500ML | WH-A | 800 | 800 | ⚠ Low |

**Additional Columns:**
- Unit of Measure
- Reorder Level
- Unit Cost
- Total Value (Quantity × Cost)

**Summary Section:**
- Total Items: Count of products
- Total Value: Sum of all inventory value
- Critical Items: Count of items at minimum level
- Low Items: Count of items at reorder level

**Export:**
- Click "Export CSV"
- Filename: `stock_levels_YYYY-MM-DD.csv`
- Opens in Excel for further analysis

**Use Cases:**
- Month-end reports
- Physical count preparation
- Inventory audits
- Management presentations

### Report 2: Low Stock Report

**Purpose:** Identify products needing reorder

**Who Can Use:** Admin, Manager

**Shows Only:**
- Products at or below reorder level
- Sorted by urgency (critical first)

**Report Contains:**

| SKU | Product | Current | Reorder | Shortage | Status |
|-----|---------|---------|---------|----------|--------|
| WB-2L-002 | 2L PET | 50 | 100 | 50 | ⚠ Critical |
| WB-500-002 | 500ML | 800 | 1,000 | 200 | ⚠ Low |

**Additional Information:**
- Recommended reorder quantity
- Lead time (if configured)
- Preferred supplier (if configured)
- Reorder cost estimate

**Status Levels:**
- 🔴 **Critical:** At or below minimum stock level (immediate action)
- 🟡 **Low:** At or below reorder point (action soon)

**Summary:**
- Total Items Below Reorder: Count
- Critical Items: Count (need urgent attention)
- Total Reorder Value: Estimated cost to restock

**Actions You Can Take:**
1. Export list
2. Create purchase orders
3. Contact suppliers
4. Plan deliveries

**Urgency Indicator:**
```
Critical (Red):
- Current: 50
- Minimum: 100
- Days of Stock: 2 days
- Action: ORDER NOW

Low (Yellow):
- Current: 800
- Reorder Point: 1,000
- Days of Stock: 7 days
- Action: Order this week
```

### Report 3: Inventory Valuation

**Purpose:** Financial value of inventory

**Who Can Use:** Admin, Manager

**Group By Options:**
- **By Category:** Total value per category
- **By Location:** Total value per warehouse
- **By Product:** Value of each product
- **Summary:** Grand total only

**Report Contains:**

| Group | Total Qty | Avg Cost | Total Value |
|-------|-----------|----------|-------------|
| 500ML Bottles | 45,000 | K1.65 | K74,250 |
| 1L Bottles | 32,000 | K2.75 | K88,000 |
| **TOTAL** | **103,500** | | **K2,848,750** |

**Currency:**
- Displays in your selected currency
- Values based on standard cost
- Real-time calculation

**Use Cases:**
- Financial statements
- Insurance valuations
- Asset reporting
- Budget planning
- Shareholder reports

**Export Options:**
- CSV for Excel
- PDF (future feature)

### Report 4: Movement History

**Purpose:** Track stock movements over period

**Date Range Required:**
- Start Date
- End Date

**Filters:**
- Product
- Location
- Transaction Type

**Report Shows:**

| Date | Product | Opening | In | Out | Closing | Net |
|------|---------|---------|----|----|---------|-----|
| Feb 1 | WB-500-001 | 4,200 | 5,000 | 2,000 | 7,200 | +3,000 |
| Jan 31 | WB-500-001 | 6,500 | 0 | 2,300 | 4,200 | -2,300 |

**Columns Explained:**
- **Opening:** Stock at start of period
- **In:** Total received/added
- **Out:** Total issued/removed
- **Closing:** Stock at end of period
- **Net:** Overall change (+/-)

**Insights:**
- Movement velocity
- Turnover rate
- Fast/slow movers
- Demand patterns

### Report 5: Transaction Summary

**Purpose:** Summarize transactions by dimension

**Group By Options:**
- Transaction Type
- Product
- Location
- User
- Date (daily/weekly/monthly)

**Example - By Transaction Type:**

| Type | Count | Total Qty | Avg Qty |
|------|-------|-----------|---------|
| RECEIVE | 125 | 145,000 | 1,160 |
| ISSUE | 98 | 87,000 | 888 |
| TRANSFER | 45 | 32,000 | 711 |
| ADJUSTMENT | 12 | 1,200 | 100 |

**Example - By User:**

| User | Transactions | Total Handled |
|------|--------------|---------------|
| John Mwale | 78 | 95,000 pcs |
| Mary Banda | 65 | 82,000 pcs |
| Peter Phiri | 43 | 51,000 pcs |

**Use Cases:**
- Performance analysis
- Workload distribution
- Process optimization
- User productivity

### Report 6: Location Summary

**Purpose:** Warehouse capacity and utilization

**Shows Per Location:**
- Total capacity
- Current stock
- % Utilization
- Available space
- Product count
- Top products stored

**Report Contains:**

| Location | Capacity | Current | Util % | Available | Products |
|----------|----------|---------|--------|-----------|----------|
| WH-A Main | 100,000 | 75,000 | 75% | 25,000 | 45 |
| WH-C Finished | 75,000 | 52,000 | 69% | 23,000 | 32 |

**Visual Indicators:**
- Green: < 70% (good capacity)
- Yellow: 70-85% (getting full)
- Red: > 85% (critical)

**Top Products Section:**
Shows top 5 products by volume at each location

**Use Cases:**
- Capacity planning
- Transfer planning
- Warehouse optimization
- Space allocation

### General Report Features

**All Reports Include:**
- Generated timestamp
- Filter criteria used
- Total record count
- Summary statistics
- Export capability

**Export Formats:**
- CSV (available now)
- PDF (future)
- Excel (future)

**Report Scheduling** (Future):
- Daily/weekly/monthly auto-generation
- Email delivery
- Saved report templates

---

## Settings

The Settings page lets you customize the system to your preferences. There are 5 main sections.

### Page Structure

```
┌──────────────────────────────────────────────────────────────┐
│                       SETTINGS                                │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────┬─────────┬──────────┬─────────────┬──────────┐  │
│  │ General │ Display │ Inventory│ Notifications│ Currency│  │
│  └─────────┴─────────┴──────────┴─────────────┴──────────┘  │
│                                                               │
│  [Section Content Shows Here]                                 │
│                                                               │
│  [Save Settings]                                              │
└──────────────────────────────────────────────────────────────┘
```

### Section 1: General Settings

**Language**
- Current: English
- Future: Multiple languages (Bemba, Nyanja, etc.)

**Timezone**
- Default: Africa/Lusaka (for Zambia)
- Affects all date/time displays
- Options: All world timezones
- Example times:
  - Africa/Lusaka = UTC+2
  - Africa/Nairobi = UTC+3
  - Europe/London = UTC+0

**Date Format**
- Options:
  - DD/MM/YYYY (31/01/2026) - Default for Zambia
  - MM/DD/YYYY (01/31/2026) - US format
  - YYYY-MM-DD (2026-01-31) - ISO format
- Affects all date displays system-wide

### Section 2: Display Settings

**Theme**
- Current: Dark (default)
- Future: Light, Auto (based on time)

**View Density**
- Compact: More rows per page, smaller spacing
- Comfortable: Default, balanced
- Spacious: Larger spacing, fewer rows

**Items Per Page**
- Options: 10, 20, 50, 100
- Default: 20
- Affects table pagination

### Section 3: Inventory Settings

**Low Stock Threshold**
- How many days of stock = "low"
- Example: 7 days
- Used for alerts and calculations

**Default Unit of Measure**
- Your most common UOM
- Default: pieces
- Speeds up data entry

**Auto-Reorder Preferences** (Future)
- Enable/disable auto-suggestions
- Safety stock levels
- Lead time considerations

### Section 4: Notification Settings

**Email Notifications**
- Toggle on/off
- Email address for notifications

**Types:**
- Low stock alerts (when item hits reorder level)
- Transaction confirmations (every transaction)
- Daily summaries (end of day recap)
- Weekly reports (Monday mornings)

**SMS Notifications** (Future)
- Phone number
- Critical alerts only
- Stock-outs
- System issues

### Section 5: Currency Settings

**This is one of the most important settings!**

**Display Currency**
- Currency you see on screen
- Default: ZMW (Zambian Kwacha)
- Options: 15+ currencies
  - USD - US Dollar ($)
  - EUR - Euro (€)
  - GBP - British Pound (£)
  - ZMW - Zambian Kwacha (K)
  - ZAR - South African Rand (R)
  - KES - Kenyan Shilling (KSh)
  - And more...

**Exchange Rates**
- Base Currency: USD (always)
- Display Rate: Auto-updated
- Example:
  - 1 USD = 27.50 ZMW
  - 1 USD = 18.75 ZAR

**How It Works:**
```
Database stores:     $100.00 USD
Exchange rate:       × 27.50
You see on screen:   K 2,750.00 ZMW
```

**Update Exchange Rate:**
1. Select currencies (From: USD, To: ZMW)
2. Enter new rate (e.g., 27.75)
3. Click "Update Rate"
4. All prices update instantly

**Auto-Update** (Future Feature):
- Daily rate updates from API
- Historical rates tracked
- Manual override available

**Currency Formatting:**
- Symbol: K, $, £, etc.
- Decimal places: 2 (always)
- Thousands separator: Comma
- Example: K 124,590.00

**Conversion Preview:**
Shows sample amounts in both currencies:
```
USD 100.00  =  K 2,750.00
USD 1,000  =  K 27,500.00
USD 10,000  =  K 275,000.00
```

### Saving Settings

**Auto-Save:**
- Some settings save automatically (currency, theme)
- No need to click Save

**Manual Save:**
- General, Display, Inventory sections
- Click "Save Settings" button at bottom
- Green confirmation: "Settings saved successfully"

**Settings Storage:**
- Saved to your browser (localStorage)
- Synced across tabs
- Persists when you close browser
- Future: Saved to your user profile on server

### Resetting to Defaults

**Reset Button** (bottom of page):
- Click "Reset to Defaults"
- Confirmation dialog: "Are you sure?"
- Reverts all to factory settings
- Zambia defaults:
  - Timezone: Africa/Lusaka
  - Currency: ZMW
  - Date Format: DD/MM/YYYY
  - Theme: Dark

---

## Common Workflows

### Workflow 1: Daily Morning Routine

**Goal:** Start your day informed

1. **Login**
   - Go to system URL
   - Enter credentials
   - Click Sign In

2. **Check Dashboard**
   - Review 4 stat cards
   - Note low stock count
   - Review recent activity

3. **Review Low Stock** (if any showing)
   - Click Low Stock card
   - Or: Go to Reports → Low Stock Report
   - Note products needing attention

4. **Check Analytics** (weekly)
   - View movement trends
   - Identify any unusual patterns

5. **Ready for Day's Work**

**Time:** 5-10 minutes

### Workflow 2: Receiving Supplier Delivery

**Goal:** Record incoming stock

**Scenario:** Supplier delivers 5,000 units of WB-500-001

1. **Navigate to Inventory**
   - Click "Inventory" in sidebar
   - Select "Receive" tab

2. **Select Product**
   - Dropdown: Find WB-500-001
   - Or type "WB-500" to search

3. **Enter Quantity**
   - Type: 5000
   - Unit auto-fills: "pieces"

4. **Select Location**
   - Choose receiving dock location
   - Example: WH-A - Main Warehouse

5. **Add Reference**
   - PO Number from delivery note
   - Example: PO-2024-001

6. **Add Unit Cost** (optional but recommended)
   - Enter supplier's price
   - Example: 0.06 (USD)

7. **Add Notes**
   - "Full delivery as per PO-2024-001"
   - Driver name, truck number, etc.

8. **Click "Receive Inventory"**
   - Green button
   - Success animation

9. **Verify**
   - Go to Products page
   - Find WB-500-001
   - Stock should be increased by 5,000

10. **Physical Storage**
    - Store items at WH-A
    - Update bin location labels
    - Done!

**Time:** 2-3 minutes per line item

### Workflow 3: Issuing to Production

**Goal:** Send materials to production line

**Scenario:** Production needs 2,000 bottles for today's run

1. **Check Availability First**
   - Go to Products page
   - Find product (WB-500-001)
   - Click to open details
   - Check "Inventory by Location" table
   - Verify WH-D (Raw Materials) has stock

2. **Navigate to Inventory → Issue Tab**

3. **Select Product**
   - WB-500-001

4. **Select Source**
   - WH-D - Raw Materials

5. **Check Available Stock Display**
   - Shows: "Available: 5,000 pieces"

6. **Enter Quantity**
   - Type: 2000
   - Must be ≤ 5,000 (available)

7. **Add Production Order**
   - Reference: PROD-2024-001

8. **Click "Issue to Production"**

9. **Production Team Notified** (future feature)
   - Email/SMS to production manager
   - Materials ready for pickup

10. **Track Usage