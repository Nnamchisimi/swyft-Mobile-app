-- Simplified SQL Setup for Supabase
-- Run this in your Supabase SQL Editor

-- 1. Create ENUM types (ignore if already exists)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('passenger', 'driver');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ride_status AS ENUM ('requested', 'accepted', 'arrived', 'in_progress', 'active', 'completed', 'confirmed', 'cancelled', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password VARCHAR(255) NOT NULL,
  role user_role DEFAULT 'passenger',
  vehicle_plate VARCHAR(20),
  is_verified BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT FALSE,
  rating DECIMAL(2, 1) DEFAULT 5.0,
  vehicle_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create cars table
CREATE TABLE IF NOT EXISTS cars (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year VARCHAR(4) NOT NULL,
  color VARCHAR(50) NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Create rides table
CREATE TABLE IF NOT EXISTS rides (
  id SERIAL PRIMARY KEY,
  passenger_email VARCHAR(255) NOT NULL,
  driver_email VARCHAR(255),
  driver_name VARCHAR(255),
  driver_phone VARCHAR(50),
  driver_vehicle VARCHAR(255),
  pickup_location VARCHAR(255),
  dropoff_location VARCHAR(255),
  pickup_lat DECIMAL(10, 8),
  pickup_lng DECIMAL(11, 8),
  dropoff_lat DECIMAL(10, 8),
  dropoff_lng DECIMAL(11, 8),
  price DECIMAL(10, 2) DEFAULT 0,
  status ride_status DEFAULT 'requested',
  ride_type VARCHAR(20) DEFAULT 'economy',
  driver_lat DECIMAL(10, 8),
  driver_lng DECIMAL(11, 8),
  driver_id INTEGER,
  passenger_id INTEGER,
  completed_at TIMESTAMPTZ,
  package_type VARCHAR(50),
  package_size VARCHAR(50),
  package_details TEXT,
  special_instructions TEXT,
  vehicle_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (passenger_id) REFERENCES users(id)
);

-- 5. Create driver_profiles table
CREATE TABLE IF NOT EXISTS driver_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  is_online BOOLEAN DEFAULT FALSE,
  current_lat DECIMAL(10, 8),
  current_lng DECIMAL(11, 8),
  rating DECIMAL(2, 1) DEFAULT 5.0,
  total_trips INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  passenger_email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  pickup_location VARCHAR(255),
  dropoff_location VARCHAR(255),
  pickup_lat DECIMAL(10, 8),
  pickup_lng DECIMAL(11, 8),
  dropoff_lat DECIMAL(10, 8),
  dropoff_lng DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  passenger_email VARCHAR(255) NOT NULL,
  card_number VARCHAR(20),
  card_name VARCHAR(255),
  expiry_date VARCHAR(10),
  cvv VARCHAR(4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  ride_id INTEGER NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  driver_email VARCHAR(255) NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

-- 9. Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. Create pricing table
CREATE TABLE IF NOT EXISTS pricing (
  id SERIAL PRIMARY KEY,
  location VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  base_price DECIMAL(10, 2) DEFAULT 0,
  price_per_km DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pricing
INSERT INTO pricing (location, vehicle_type, base_price, price_per_km) VALUES
  ('Lefkosa', 'motorcycle', 50, 10),
  ('Lefkosa', 'sedan', 80, 15),
  ('Lefkosa', 'truck', 150, 25),
  ('Girne', 'motorcycle', 70, 12),
  ('Girne', 'sedan', 100, 18),
  ('Girne', 'truck', 180, 28),
  ('Magusa', 'motorcycle', 90, 15),
  ('Magusa', 'sedan', 120, 20),
  ('Magusa', 'truck', 200, 30)
ON CONFLICT DO NOTHING;
