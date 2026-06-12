-- ============================================================
-- Hardware Shop IMS - SQLite Schema
-- Run this script to set up the complete database
-- ============================================================

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    shop_owner_name TEXT NOT NULL,
    phone_number TEXT,
    shop_name TEXT,
    address TEXT,
    city TEXT,
    gst_number TEXT,
    is_active BOOLEAN DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── Products ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT,
    purchase_price REAL NOT NULL,
    selling_price REAL NOT NULL,
    current_stock INTEGER DEFAULT 0,
    minimum_stock_level INTEGER DEFAULT 10,
    unit_type TEXT NOT NULL DEFAULT 'pcs',
    sku TEXT,
    product_code TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT products_positive_purchase_price CHECK (purchase_price > 0),
    CONSTRAINT products_positive_selling_price CHECK (selling_price > 0),
    CONSTRAINT products_non_negative_stock CHECK (current_stock >= 0),
    CONSTRAINT products_non_negative_min_stock CHECK (minimum_stock_level >= 0)
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_product_name ON products(product_name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_unique ON products(sku) WHERE sku IS NOT NULL;

-- ─── Suppliers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    supplier_name TEXT NOT NULL,
    mobile_number TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    gst_number TEXT,
    bank_account TEXT,
    balance REAL DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);

-- ─── Purchase Orders ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
    purchase_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    supplier_id TEXT NOT NULL REFERENCES suppliers(supplier_id),
    purchase_date DATE NOT NULL,
    total_amount REAL DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'Pending',
    payment_method TEXT,
    reference_number TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT po_payment_status CHECK (payment_status IN ('Paid', 'Pending', 'Partial')),
    CONSTRAINT po_total_amount_non_negative CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_po_user_id ON purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_purchase_date ON purchase_orders(purchase_date);

-- ─── Purchase Items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_items (
    purchase_item_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    purchase_id TEXT NOT NULL REFERENCES purchase_orders(purchase_id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    quantity_purchased INTEGER NOT NULL,
    purchase_price_per_unit REAL NOT NULL,
    total_item_cost REAL GENERATED ALWAYS AS (quantity_purchased * purchase_price_per_unit) STORED,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pi_positive_quantity CHECK (quantity_purchased > 0),
    CONSTRAINT pi_positive_price CHECK (purchase_price_per_unit > 0)
);

CREATE INDEX IF NOT EXISTS idx_pi_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_pi_product_id ON purchase_items(product_id);

-- ─── Customers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    customer_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    mobile_number TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    balance REAL DEFAULT 0,
    is_regular BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile_number);

-- ─── Sales Orders ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_orders (
    sale_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
    sale_date DATE NOT NULL,
    sale_time TIME,
    total_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    final_amount REAL GENERATED ALWAYS AS (total_amount - discount_amount) STORED,
    amount_paid REAL DEFAULT 0,
    payment_method TEXT NOT NULL,
    payment_status TEXT DEFAULT 'Paid',
    invoice_number TEXT UNIQUE,
    walkin_customer_name TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT so_payment_status CHECK (payment_status IN ('Paid', 'Pending')),
    CONSTRAINT so_payment_method CHECK (payment_method IN ('Cash', 'Card', 'Cheque', 'Credit', 'UPI')),
    CONSTRAINT so_non_negative_discount CHECK (discount_amount >= 0),
    CONSTRAINT so_non_negative_total CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_so_user_id ON sales_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_so_sale_date ON sales_orders(sale_date);
CREATE INDEX IF NOT EXISTS idx_so_customer_id ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_invoice ON sales_orders(invoice_number);

-- ─── Sale Items ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
    sale_item_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    sale_id TEXT NOT NULL REFERENCES sales_orders(sale_id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    quantity_sold INTEGER NOT NULL,
    selling_price_per_unit REAL NOT NULL,
    total_item_revenue REAL GENERATED ALWAYS AS (quantity_sold * selling_price_per_unit) STORED,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT si_positive_quantity CHECK (quantity_sold > 0),
    CONSTRAINT si_positive_price CHECK (selling_price_per_unit > 0)
);

CREATE INDEX IF NOT EXISTS idx_si_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_si_product_id ON sale_items(product_id);

-- ─── Stock History ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_history (
    history_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    transaction_type TEXT NOT NULL,
    reference_id TEXT,
    quantity_change INTEGER NOT NULL,
    old_stock INTEGER,
    new_stock INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sh_transaction_type CHECK (transaction_type IN ('Purchase', 'Sale', 'Adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_sh_user_id ON stock_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sh_product_id ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_sh_created_at ON stock_history(created_at);
