-- Fix missing columns for driver online status
-- Run these commands in your MySQL database

-- Add is_online column (ignore error if it already exists)
ALTER TABLE users ADD COLUMN is_online TINYINT(1) DEFAULT 0;

-- Add current location columns
ALTER TABLE users ADD COLUMN current_lat DECIMAL(10, 8) DEFAULT NULL;
ALTER TABLE users ADD COLUMN current_lng DECIMAL(11, 8) DEFAULT NULL;

-- Add rating column
ALTER TABLE users ADD COLUMN rating DECIMAL(2, 1) DEFAULT 5.0;

-- Add driver location columns to rides table
ALTER TABLE rides ADD COLUMN driver_lat DECIMAL(10, 8) DEFAULT NULL;
ALTER TABLE rides ADD COLUMN driver_lng DECIMAL(11, 8) DEFAULT NULL;

-- Add pickup/dropoff location columns if missing
ALTER TABLE rides ADD COLUMN pickup_location VARCHAR(255);
ALTER TABLE rides ADD COLUMN dropoff_location VARCHAR(255);

-- Create index for online drivers query
CREATE INDEX IF NOT EXISTS idx_drivers_online ON users(role, is_online);

-- Add completed_at column to rides table (for tracking when rides were completed)
ALTER TABLE rides ADD COLUMN completed_at TIMESTAMP NULL;

-- Add driver_id column to rides table for proper foreign key relation to users
ALTER TABLE rides ADD COLUMN driver_id INT;

-- Add passenger_id column to rides table for proper foreign key relation to users
ALTER TABLE rides ADD COLUMN passenger_id INT;

-- Add driver_email column to rides table if missing
ALTER TABLE rides ADD COLUMN driver_email VARCHAR(255);
ALTER TABLE rides ADD COLUMN driver_name VARCHAR(255);
ALTER TABLE rides ADD COLUMN driver_phone VARCHAR(50);
ALTER TABLE rides ADD COLUMN driver_vehicle VARCHAR(255);
ALTER TABLE rides ADD COLUMN driver_assigned TINYINT(1) DEFAULT 0;

-- Add foreign key constraint (ignore if already exists or MySQL version doesn't support)
-- ALTER TABLE rides ADD CONSTRAINT fk_driver_user FOREIGN KEY (driver_id) REFERENCES users(id);
