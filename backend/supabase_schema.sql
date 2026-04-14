-- Swyft Full Database Schema for Supabase (PostgreSQL)
-- Run these commands in your Supabase SQL Editor

-- Drop tables if they exist (for clean slate)
DROP TABLE IF EXISTS email_tokens CASCADE;
DROP TABLE IF EXISTS ratings CASCADE;
DROP TABLE IF EXISTS driver_profiles CASCADE;
DROP TABLE IF EXISTS rides CASCADE;
DROP TABLE IF EXISTS cars CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS ride_status CASCADE;
DROP TYPE IF EXISTS ride_type CASCADE;

-- Create custom ENUM types
CREATE TYPE user_role AS ENUM ('passenger', 'driver');
CREATE TYPE ride_status AS ENUM ('requested', 'accepted', 'arrived', 'in_progress', 'active', 'completed', 'confirmed', 'cancelled', 'canceled');
CREATE TYPE ride_type AS ENUM ('economy', 'standard', 'luxury');

-- Create users table
CREATE TABLE users (
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
  current_lat DECIMAL(10, 8) DEFAULT NULL,
  current_lng DECIMAL(11, 8) DEFAULT NULL,
  rating DECIMAL(2, 1) DEFAULT 5.0,
  vehicle_id INTEGER,
  last_active TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cars table
CREATE TABLE cars (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year VARCHAR(4) NOT NULL,
  color VARCHAR(50) NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (plate_number)
);

-- Create rides table
CREATE TABLE rides (
  id SERIAL PRIMARY KEY,
  passenger_email VARCHAR(255) NOT NULL,
  driver_email VARCHAR(255),
  driver_name VARCHAR(255),
  driver_phone VARCHAR(50),
  driver_vehicle VARCHAR(255),
  pickup_location VARCHAR(255),
  dropoff_location VARCHAR(255),
  pickup_lat DECIMAL(10, 8) DEFAULT NULL,
  pickup_lng DECIMAL(11, 8) DEFAULT NULL,
  dropoff_lat DECIMAL(10, 8) DEFAULT NULL,
  dropoff_lng DECIMAL(11, 8) DEFAULT NULL,
  price DECIMAL(10, 2) DEFAULT 0,
  status ride_status DEFAULT 'requested',
  ride_type ride_type DEFAULT 'economy',
  driver_lat DECIMAL(10, 8) DEFAULT NULL,
  driver_lng DECIMAL(11, 8) DEFAULT NULL,
  driver_id INTEGER,
  passenger_id INTEGER,
  driver_assigned BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  confirmed_at TIMESTAMPTZ DEFAULT NULL,
  distance_km DECIMAL(8, 2) DEFAULT NULL,
  package_type VARCHAR(50),
  package_size VARCHAR(50),
  package_details TEXT,
  special_instructions TEXT,
  vehicle_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (passenger_id) REFERENCES users(id)
);

-- Create driver_profiles table
CREATE TABLE driver_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  is_online BOOLEAN DEFAULT FALSE,
  current_lat DECIMAL(10, 8) DEFAULT NULL,
  current_lng DECIMAL(11, 8) DEFAULT NULL,
  rating DECIMAL(2, 1) DEFAULT 5.0,
  total_trips INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create ratings table
CREATE TABLE ratings (
  id SERIAL PRIMARY KEY,
  ride_id INTEGER NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  driver_email VARCHAR(255) NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

-- Create email_tokens table
CREATE TABLE email_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_online ON users(is_online);
CREATE INDEX idx_users_vehicle_id ON users(vehicle_id);

-- Cars indexes
CREATE INDEX idx_cars_user_id ON cars(user_id);

-- Rides indexes
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_driver_email ON rides(driver_email);
CREATE INDEX idx_rides_passenger_email ON rides(passenger_email);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_passenger_id ON rides(passenger_id);
CREATE INDEX idx_rides_pickup_location ON rides(pickup_lat, pickup_lng);
CREATE INDEX idx_rides_dropoff_location ON rides(dropoff_lat, dropoff_lng);
CREATE INDEX idx_rides_status_driver ON rides(status, driver_email);
CREATE INDEX idx_rides_status_passenger ON rides(status, passenger_email);
CREATE INDEX idx_rides_created_at ON rides(created_at);

-- DriverProfiles indexes
CREATE INDEX idx_driver_profiles_user_id ON driver_profiles(user_id);
CREATE INDEX idx_driver_profiles_is_online ON driver_profiles(is_online);

-- Ratings indexes
CREATE INDEX idx_ratings_ride_id ON ratings(ride_id);
CREATE INDEX idx_ratings_driver_email ON ratings(driver_email);
CREATE INDEX idx_ratings_user_email ON ratings(user_email);
CREATE INDEX idx_ratings_created_at ON ratings(created_at);

-- EmailTokens indexes
CREATE INDEX idx_email_tokens_user_id ON email_tokens(user_id);
CREATE INDEX idx_email_tokens_token ON email_tokens(token);
CREATE INDEX idx_email_tokens_expires_at ON email_tokens(expires_at);

-- Add foreign key constraints for users table (self-referencing for vehicle_id)
ALTER TABLE users ADD CONSTRAINT fk_users_vehicle FOREIGN KEY (vehicle_id) REFERENCES cars(id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cars_updated_at BEFORE UPDATE ON cars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_profiles_updated_at BEFORE UPDATE ON driver_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_tokens_updated_at BEFORE UPDATE ON email_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some initial data (optional)
-- INSERT INTO users (first_name, last_name, email, password, role) VALUES 
-- ('Admin', 'User', 'admin@swyft.com', 'hashed_password_here', 'passenger');

-- Create favorites table
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

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  passenger_email VARCHAR(255) NOT NULL,
  card_number VARCHAR(20),
  card_name VARCHAR(255),
  expiry_date VARCHAR(10),
  cvv VARCHAR(4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
