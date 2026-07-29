-- Swyft Full Database Schema
-- Run these commands in your MySQL database to create the complete schema

-- Drop tables if they exist (for clean slate)
DROP TABLE IF EXISTS email_tokens;
DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS driver_profiles;
DROP TABLE IF EXISTS rides;
DROP TABLE IF EXISTS cars;
DROP TABLE IF EXISTS users;

-- Create users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password VARCHAR(255) NOT NULL,
  role ENUM('passenger', 'driver') DEFAULT 'passenger',
  vehicle_plate VARCHAR(20),
  is_verified BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT FALSE,
  current_lat DECIMAL(10, 8) DEFAULT NULL,
  current_lng DECIMAL(11, 8) DEFAULT NULL,
  rating DECIMAL(2, 1) DEFAULT 5.0,
  vehicle_id INT,
  last_active TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create cars table
CREATE TABLE cars (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year VARCHAR(4) NOT NULL,
  color VARCHAR(50) NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_plate (plate_number)
);

-- Create rides table
CREATE TABLE rides (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
  status ENUM('requested', 'accepted', 'arrived', 'in_progress', 'active', 'completed', 'confirmed', 'cancelled') DEFAULT 'requested',
  ride_type ENUM('lefkosa', 'girne', 'magusa', 'iskele') DEFAULT 'lefkosa',
  driver_lat DECIMAL(10, 8) DEFAULT NULL,
  driver_lng DECIMAL(11, 8) DEFAULT NULL,
  driver_id INT,
  passenger_id INT,
  driver_assigned BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  confirmed_at TIMESTAMP NULL,
  distance_km DECIMAL(8, 2) DEFAULT NULL,
  vehicle_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (passenger_id) REFERENCES users(id)
);

-- Create driver_profiles table
CREATE TABLE driver_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  is_online BOOLEAN DEFAULT FALSE,
  current_lat DECIMAL(10, 8) DEFAULT NULL,
  current_lng DECIMAL(11, 8) DEFAULT NULL,
  rating DECIMAL(2, 1) DEFAULT 5.0,
  total_trips INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create ratings table
CREATE TABLE ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ride_id INT NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  driver_email VARCHAR(255) NOT NULL,
  rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

-- Create email_tokens table
CREATE TABLE email_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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

-- Insert some initial data (optional)
-- INSERT INTO users (first_name, last_name, email, password, role) VALUES 
-- ('Admin', 'User', 'admin@swyft.com', 'hashed_password_here', 'passenger');

-- Create ID Documents table for driver verification
CREATE TABLE id_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  document_type ENUM('drivers_license', 'national_id', 'passport', 'residence_permit') NOT NULL,
  document_number VARCHAR(100) NOT NULL,
  expiry_date DATE DEFAULT NULL,
  front_image_url VARCHAR(500) DEFAULT NULL,
  back_image_url VARCHAR(500) DEFAULT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create bank accounts table for driver payouts
CREATE TABLE bank_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_holder_name VARCHAR(100) NOT NULL,
  routing_number VARCHAR(50) DEFAULT NULL,
  iban VARCHAR(50) DEFAULT NULL,
  swift_code VARCHAR(20) DEFAULT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create phone verifications table
CREATE TABLE phone_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  verification_code VARCHAR(10) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_phone (user_id, phone_number)
);

-- Create selfie verifications table
CREATE TABLE selfie_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  selfie_image_url VARCHAR(500) NOT NULL,
  id_document_image_url VARCHAR(500) DEFAULT NULL,
  match_confidence DECIMAL(5, 2) DEFAULT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status ENUM('pending', 'verified', 'rejected', 'manual_review') DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by VARCHAR(100) DEFAULT NULL,
  reviewed_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create driver verification status table
CREATE TABLE driver_verification_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  id_document_verified BOOLEAN DEFAULT FALSE,
  selfie_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  bank_account_verified BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  approval_date TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for verification tables
CREATE INDEX idx_id_documents_user_id ON id_documents(user_id);
CREATE INDEX idx_id_documents_verification_status ON id_documents(verification_status);
CREATE INDEX idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX idx_bank_accounts_verification_status ON bank_accounts(verification_status);
CREATE INDEX idx_phone_verifications_user_id ON phone_verifications(user_id);
CREATE INDEX idx_selfie_verifications_user_id ON selfie_verifications(user_id);
CREATE INDEX idx_selfie_verifications_status ON selfie_verifications(verification_status);
CREATE INDEX idx_driver_verification_status_user_id ON driver_verification_status(user_id);
