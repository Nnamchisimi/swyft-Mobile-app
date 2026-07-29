-- Fix missing ride_status enum values
-- Run this in Supabase SQL Editor

ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'arrived_pickup';
ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'arriving';
ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'arrived_dropoff';
