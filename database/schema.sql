-- GreenVerse Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'client', 'cluster')),
  location VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'In Stock',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clusters table
CREATE TABLE IF NOT EXISTS clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  manager_id UUID REFERENCES users(id),
  capacity INTEGER NOT NULL,
  utilization INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'Pending',
  delivery_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Production table
CREATE TABLE IF NOT EXISTS production (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id UUID REFERENCES clusters(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  shift VARCHAR(20) CHECK (shift IN ('Morning', 'Evening', 'Night')),
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id UUID REFERENCES clusters(id),
  worker_name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  status VARCHAR(20) CHECK (status IN ('Present', 'Absent', 'Leave')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  amount DECIMAL(10, 2) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE,
  status VARCHAR(50) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Impact metrics table (for tracking environmental impact)
CREATE TABLE IF NOT EXISTS impact_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  waste_processed DECIMAL(10, 2) DEFAULT 0,
  co2_saved DECIMAL(10, 2) DEFAULT 0,
  landfill_diverted DECIMAL(10, 2) DEFAULT 0,
  farmers_supported INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_production_cluster_id ON production(cluster_id);
CREATE INDEX idx_production_date ON production(date);

-- Insert default admin user (password: admin123)
-- Note: In production, change this password immediately!
INSERT INTO users (email, password_hash, name, role, location) 
VALUES (
  'admin@greenverse.com',
  '$2a$10$8K1p/a0dL3LKBYbKK6P9xO5rFGq8VL5k7jK2F8Qd0tR6pN8mH9ZyC',
  'Admin User',
  'admin',
  'Sukkur, Pakistan'
) ON CONFLICT (email) DO NOTHING;

-- Insert sample products
INSERT INTO products (name, description, category, price, stock, status) VALUES
  ('Banana Fiber Plate (10")', '100% biodegradable dinner plate made from banana stem fiber', 'Tableware', 45, 500, 'In Stock'),
  ('Eco-Bowl (500ml)', 'Sustainable serving bowl perfect for soups and salads', 'Tableware', 35, 350, 'In Stock'),
  ('Biodegradable Cutlery Set', 'Complete cutlery set: fork, knife, spoon', 'Utensils', 25, 800, 'In Stock'),
  ('Fiber Gift Box', 'Elegant gift packaging made from natural fibers', 'Packaging', 55, 200, 'Low Stock'),
  ('Banana Fiber Tray', 'Sturdy serving tray for various occasions', 'Tableware', 65, 150, 'In Stock')
ON CONFLICT DO NOTHING;

-- Insert sample clusters
INSERT INTO clusters (name, location, capacity, utilization, status) VALUES
  ('Sukkur Cluster', 'Sukkur, Sindh', 100, 85, 'Active'),
  ('Khairpur Unit', 'Khairpur, Sindh', 80, 70, 'Active'),
  ('Rohri Production', 'Rohri, Sindh', 60, 45, 'Active')
ON CONFLICT DO NOTHING;

-- Insert current impact metrics
INSERT INTO impact_metrics (date, waste_processed, co2_saved, landfill_diverted, farmers_supported)
VALUES (CURRENT_DATE, 8900, 12500, 8900, 350)
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_clusters_updated_at BEFORE UPDATE ON clusters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
