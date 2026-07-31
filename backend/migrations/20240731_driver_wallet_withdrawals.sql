-- Driver wallet and withdrawal request system
-- Run these commands in your Supabase SQL Editor

-- Wallet table: one row per driver
CREATE TABLE IF NOT EXISTS driver_wallets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  available_balance NUMERIC(10, 2) DEFAULT 0,
  pending_balance NUMERIC(10, 2) DEFAULT 0,
  total_earned NUMERIC(10, 2) DEFAULT 0,
  total_withdrawn NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_wallets_user_id ON driver_wallets(user_id);

-- Withdrawal request state machine
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  bank_name VARCHAR(100),
  iban VARCHAR(50),
  account_holder_name VARCHAR(100),
  admin_notes TEXT,
  processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  transfer_reference VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_driver_id ON withdrawal_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at DESC);

-- Ensure status is one of the allowed state machine values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_withdrawal_status' AND conrelid = 'withdrawal_requests'::regclass
  ) THEN
    ALTER TABLE withdrawal_requests ADD CONSTRAINT chk_withdrawal_status 
      CHECK (status IN ('PENDING', 'PROCESSING', 'REJECTED', 'PAID'));
  END IF;
END $$;

-- Trigger to update driver_wallets.updated_at
CREATE TRIGGER update_driver_wallets_updated_at BEFORE UPDATE ON driver_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_withdrawal_requests_updated_at BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
