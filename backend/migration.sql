-- Swyft Database Schema
-- Run these commands in your MySQL database

-- Create cars table for driver vehicles
CREATE TABLE IF NOT EXISTS cars (
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

-- Add vehicle_id column to users table (for quick reference)
ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_id INT;
ALTER TABLE users ADD CONSTRAINT fk_vehicle FOREIGN KEY (vehicle_id) REFERENCES cars(id);

-- If the above doesn't work (MySQL version < 8.0), run these:
-- ALTER TABLE users ADD COLUMN vehicle_id INT;

-- Create index for faster queries
CREATE INDEX idx_cars_user_id ON cars(user_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_driver ON rides(driver_email);
CREATE INDEX idx_rides_passenger ON rides(passenger_email);

-- === NEW COLUMNS FOR MVP FEATURES ===

-- Add driver online status and location columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online TINYINT(1) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10, 8) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_lng DECIMAL(11, 8) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1) DEFAULT 5.0;

-- If MySQL version doesn't support IF NOT EXISTS, run these:
-- ALTER TABLE users ADD COLUMN is_online TINYINT(1) DEFAULT 0;
-- ALTER TABLE users ADD COLUMN current_lat DECIMAL(10, 8) DEFAULT NULL;
-- ALTER TABLE users ADD COLUMN current_lng DECIMAL(11, 8) DEFAULT NULL;
-- ALTER TABLE users ADD COLUMN rating DECIMAL(2, 1) DEFAULT 5.0;

-- Create ratings table for storing ride ratings
CREATE TABLE IF NOT EXISTS ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ride_id INT NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  driver_email VARCHAR(255) NOT NULL,
  rating TINYINT(1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
  INDEX idx_ratings_driver (driver_email),
  INDEX idx_ratings_user (user_email)
);

-- Add driver location columns to rides table for real-time tracking
ALTER TABLE rides ADD COLUMN IF NOT EXISTS driver_lat DECIMAL(10, 8) DEFAULT NULL;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS driver_lng DECIMAL(11, 8) DEFAULT NULL;

-- If MySQL version doesn't support IF NOT EXISTS, run these:
-- ALTER TABLE rides ADD COLUMN driver_lat DECIMAL(10, 8) DEFAULT NULL;
-- ALTER TABLE rides ADD COLUMN driver_lng DECIMAL(11, 8) DEFAULT NULL;

-- Create index for online drivers query
CREATE INDEX idx_drivers_online ON users(role, is_online);

-- Update rides status enum to include 'arrived' status
-- Run this if your rides table uses ENUM for status:
-- ALTER TABLE rides MODIFY COLUMN status ENUM('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled') DEFAULT 'requested';

-- Add completed_at column to rides table for tracking when rides were completed
ALTER TABLE rides ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;
