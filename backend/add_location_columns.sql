-- Add location columns to rides table for real-time tracking
-- Run these commands in your MySQL database

-- Add pickup location coordinates
ALTER TABLE rides ADD COLUMN pickup_lat DECIMAL(10, 8) DEFAULT NULL;
ALTER TABLE rides ADD COLUMN pickup_lng DECIMAL(11, 8) DEFAULT NULL;

-- Add dropoff location coordinates
ALTER TABLE rides ADD COLUMN dropoff_lat DECIMAL(10, 8) DEFAULT NULL;
ALTER TABLE rides ADD COLUMN dropoff_lng DECIMAL(11, 8) DEFAULT NULL;

-- Create indexes for location queries
CREATE INDEX IF NOT EXISTS idx_rides_pickup_location ON rides(pickup_lat, pickup_lng);
CREATE INDEX IF NOT EXISTS idx_rides_dropoff_location ON rides(dropoff_lat, dropoff_lng);
