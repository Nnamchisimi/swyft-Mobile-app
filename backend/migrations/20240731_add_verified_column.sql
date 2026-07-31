-- Add verified column to payments if missing
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
