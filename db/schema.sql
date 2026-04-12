-- Restaurants table
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  subscription VARCHAR(20) DEFAULT 'base',
  qr_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tables (physical tables in restaurant)
CREATE TABLE restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  table_label VARCHAR(10) NOT NULL,
  seats INTEGER NOT NULL,
  zone VARCHAR(50) NOT NULL,
  x_pos FLOAT NOT NULL,
  y_pos FLOAT NOT NULL,
  width FLOAT NOT NULL,
  height FLOAT NOT NULL,
  is_popular BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Queue entries
CREATE TABLE queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  token VARCHAR(10) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  party_size INTEGER NOT NULL,
  zone_preference VARCHAR(50) DEFAULT 'any',
  status VARCHAR(20) DEFAULT 'waiting',
  assigned_table_id UUID REFERENCES restaurant_tables(id),
  estimated_wait INTEGER,
  joined_at TIMESTAMP DEFAULT NOW(),
  seated_at TIMESTAMP,
  left_at TIMESTAMP
);

-- Table sessions (tracks occupancy history for ML)
CREATE TABLE table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  party_size INTEGER NOT NULL,
  seated_at TIMESTAMP DEFAULT NOW(),
  cleared_at TIMESTAMP,
  dwell_minutes INTEGER,
  day_of_week INTEGER,
  hour_of_day INTEGER
);