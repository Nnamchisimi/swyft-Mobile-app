-- Fix for: invalid input value for enum ride_type_enum: "lefkosa"
-- The app sends city hub area IDs but the ENUM had economy/standard/luxury
-- Run this SQL to fix the ride_type column in the rides table

ALTER TABLE rides MODIFY COLUMN ride_type ENUM('lefkosa', 'girne', 'magusa', 'iskele') DEFAULT 'lefkosa';

DESCRIBE rides;
