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
CREATE TYPE ride_status AS ENUM ('requested', 'pending', 'accepted', 'arrived_pickup', 'picked_up', 'arrived_dropoff', 'active', 'arriving', 'completed', 'confirmed', 'cancelled');
CREATE TYPE ride_type AS ENUM ('lefkosa', 'girne', 'magusa', 'iskele');

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
  ride_type ride_type DEFAULT 'lefkosa',
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
  receiver_name VARCHAR(100),
  receiver_phone VARCHAR(20),
  receiver_email VARCHAR(255),
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

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_id VARCHAR(255) UNIQUE NOT NULL,
  ride_id INTEGER NOT NULL,
  passenger_email VARCHAR(255) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  token VARCHAR(255),
  verified BOOLEAN DEFAULT FALSE,
  raw_response JSONB,
  callback_params JSONB,
  webhook_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_ride_id ON payments(ride_id);
CREATE INDEX IF NOT EXISTS idx_payments_passenger_email ON payments(passenger_email);

-- Create ID Documents table for driver verification
CREATE TABLE IF NOT EXISTS id_documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  document_number VARCHAR(100) NOT NULL,
  expiry_date DATE,
  front_image_url VARCHAR(500),
  back_image_url VARCHAR(500),
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bank accounts table for driver payouts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_holder_name VARCHAR(100) NOT NULL,
  routing_number VARCHAR(50),
  iban VARCHAR(50),
  swift_code VARCHAR(20),
  is_default BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create phone verifications table
CREATE TABLE IF NOT EXISTS phone_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  verification_code VARCHAR(10) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  UNIQUE(user_id, phone_number)
);

-- Create selfie verifications table
CREATE TABLE IF NOT EXISTS selfie_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selfie_image_url VARCHAR(500) NOT NULL,
  id_document_image_url VARCHAR(500),
  match_confidence DECIMAL(5, 2),
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create driver verification status table
CREATE TABLE IF NOT EXISTS driver_verification_status (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  id_document_verified BOOLEAN DEFAULT FALSE,
  selfie_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  bank_account_verified BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  approval_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for verification tables
CREATE INDEX IF NOT EXISTS idx_id_documents_user_id ON id_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_id_documents_verification_status ON id_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_verification_status ON bank_accounts(verification_status);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_id ON phone_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_selfie_verifications_user_id ON selfie_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_selfie_verifications_status ON selfie_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_driver_verification_status_user_id ON driver_verification_status(user_id);

-- Add CHECK constraints for verification_status columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_id_document_type' AND conrelid = 'id_documents'::regclass
  ) THEN
    ALTER TABLE id_documents ADD CONSTRAINT chk_id_document_type 
      CHECK (document_type IN ('drivers_license', 'national_id', 'passport', 'residence_permit'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_id_verification_status' AND conrelid = 'id_documents'::regclass
  ) THEN
    ALTER TABLE id_documents ADD CONSTRAINT chk_id_verification_status 
      CHECK (verification_status IN ('pending', 'verified', 'rejected'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_bank_verification_status' AND conrelid = 'bank_accounts'::regclass
  ) THEN
    ALTER TABLE bank_accounts ADD CONSTRAINT chk_bank_verification_status 
      CHECK (verification_status IN ('pending', 'verified', 'rejected'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_selfie_verification_status' AND conrelid = 'selfie_verifications'::regclass
  ) THEN
    ALTER TABLE selfie_verifications ADD CONSTRAINT chk_selfie_verification_status 
      CHECK (verification_status IN ('pending', 'verified', 'rejected', 'manual_review'));
  END IF;
END $$;

-- Create driver verification archive table (reference snapshot of reviewed drivers)
CREATE TABLE IF NOT EXISTS driver_verification_archive (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(50),
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reviewer_email VARCHAR(255),
  notes TEXT,
   id_document JSONB,
   selfie JSONB,
   phone_verification JSONB,
   bank_account JSONB,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_verification_archive_user_id ON driver_verification_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_verification_archive_archived_at ON driver_verification_archive(archived_at DESC);
