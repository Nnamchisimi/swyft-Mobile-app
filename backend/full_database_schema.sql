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
  status ENUM('requested', 'accepted', 'arrived', 'in_progress', 'active', 'completed', 'confirmed', 'cancelled', 'canceled') DEFAULT 'requested',
  ride_type ENUM('economy', 'standard', 'luxury') DEFAULT 'economy',
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
