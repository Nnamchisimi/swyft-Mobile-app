-- Fix for: Data truncated for column 'ride_type' at row 1
-- The app sends 'standard' but the ENUM only has 'economy', 'premium', 'luxury'
-- Run this SQL to fix the ride_type column in the rides table

-- Replace premium with standard in the ENUM values
ALTER TABLE rides MODIFY COLUMN ride_type ENUM('economy', 'standard', 'luxury') DEFAULT 'economy';

-- Verify the change
DESCRIBE rides;
