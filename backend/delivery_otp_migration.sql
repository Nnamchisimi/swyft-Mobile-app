-- Delivery OTP Confirmation Migration
-- Add columns for secure OTP-based delivery confirmation

ALTER TABLE rides 
ADD COLUMN delivery_id VARCHAR(50) UNIQUE,
ADD COLUMN delivery_otp_hash VARCHAR(255),
ADD COLUMN delivery_otp_attempts INT DEFAULT 0,
ADD COLUMN delivery_otp_expires_at TIMESTAMP NULL,
ADD COLUMN delivery_completed_at TIMESTAMP NULL,
ADD COLUMN delivery_completed_lat DECIMAL(10, 8) DEFAULT NULL,
ADD COLUMN delivery_completed_lng DECIMAL(11, 8) DEFAULT NULL,
ADD COLUMN delivery_flagged BOOLEAN DEFAULT FALSE;

-- Create index for delivery_id lookups
CREATE INDEX idx_rides_delivery_id ON rides(delivery_id);
CREATE INDEX idx_rides_delivery_otp_hash ON rides(delivery_otp_hash);

-- Generate unique delivery_id for existing rides
UPDATE rides SET delivery_id = CONCAT('DEL', id, '_', FLOOR(RANDOM() * 10000)) WHERE delivery_id IS NULL;