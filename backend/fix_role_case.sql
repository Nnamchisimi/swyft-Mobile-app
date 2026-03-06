-- Fix case sensitivity issues in users table
-- Run this SQL to update existing roles to lowercase

-- Update all roles to lowercase
UPDATE users SET role = LOWER(role) WHERE role IS NOT NULL;

-- Verify the update
SELECT id, email, role FROM users;
