-- Database Schema for Inventory and Order Management System

-- Drop tables if they exist (for clean setup/re-migration)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'seller')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    dimension VARCHAR(20) NOT NULL CHECK (dimension IN ('weight', 'volume', 'count')),
    base_unit VARCHAR(10) NOT NULL CHECK (base_unit IN ('g', 'mL', 'items')),
    base_price NUMERIC(20, 8) NOT NULL CHECK (base_price >= 0), -- Base price per 1 base_unit (e.g. price per 1g, 1mL, or 1 item)
    stock_quantity NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0), -- Total stock in the base_unit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders Table (also referred to as Quotations)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    total_price NUMERIC(20, 8) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order Items Table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ordered_unit VARCHAR(10) NOT NULL, -- The unit selected by the user (g, kg, mL, L, items)
    ordered_quantity NUMERIC(20, 8) NOT NULL CHECK (ordered_quantity > 0), -- The quantity in the ordered unit
    base_quantity NUMERIC(20, 8) NOT NULL CHECK (base_quantity > 0), -- The quantity in base units (for stock calculations)
    unit_price NUMERIC(20, 8) NOT NULL CHECK (unit_price >= 0), -- Price per unit of ordered_unit at the time of order
    total_item_price NUMERIC(20, 8) NOT NULL CHECK (total_item_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for search performance
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
