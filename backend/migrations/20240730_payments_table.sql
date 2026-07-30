-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_id VARCHAR(255) UNIQUE NOT NULL,
  ride_id INTEGER NOT NULL,
  passenger_email VARCHAR(255) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  raw_response JSONB,
  callback_params JSONB,
  webhook_payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_ride_id ON payments(ride_id);
CREATE INDEX IF NOT EXISTS idx_payments_passenger_email ON payments(passenger_email);
