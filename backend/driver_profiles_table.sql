-- Create driver_profiles table for driver-specific data
-- Run these commands in your MySQL database (phpMyAdmin or MySQL Workbench)

-- 1. Create the driver_profiles table
CREATE TABLE IF NOT EXISTS driver_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  is_online TINYINT(1) DEFAULT 0,
  current_lat DECIMAL(10, 8) DEFAULT NULL,
  current_lng DECIMAL(11, 8) DEFAULT NULL,
  rating DECIMAL(2, 1) DEFAULT 5.0,
  total_trips INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Create index for finding online drivers
CREATE INDEX IF NOT EXISTS idx_driver_online ON driver_profiles(is_online);

-- 3. For existing drivers, create their profiles (if any drivers already exist)
INSERT INTO driver_profiles (user_id, is_online, current_lat, current_lng, rating, total_trips)
SELECT id, COALESCE(is_online, 0), current_lat, current_lng, COALESCE(rating, 5.0), 0
FROM users WHERE role = 'driver'
ON DUPLICATE KEY UPDATE is_online = VALUES(is_online);

-- 4. OPTIONAL: Remove old columns from users table (safe to run after step 3)
-- ALTER TABLE users DROP COLUMN IF EXISTS is_online;
-- ALTER TABLE users DROP COLUMN IF EXISTS current_lat;
-- ALTER TABLE users DROP COLUMN IF EXISTS current_lng;
-- ALTER TABLE users DROP COLUMN IF EXISTS rating;
