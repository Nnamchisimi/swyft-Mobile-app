-- Driver Verification Schema
-- Add tables for driver identity verification, bank accounts, and phone verification
-- PostgreSQL compatible version

-- ID Documents table for storing government-issued ID information
CREATE TABLE IF NOT EXISTS id_documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  document_number VARCHAR(100) NOT NULL,
  expiry_date DATE,
  front_image_url VARCHAR(500),
  back_image_url VARCHAR(500),
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bank Accounts table for driver payouts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_holder_name VARCHAR(100) NOT NULL,
  routing_number VARCHAR(50),
  iban VARCHAR(50),
  swift_code VARCHAR(20),
  is_default BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Phone Verifications table for phone number verification
CREATE TABLE IF NOT EXISTS phone_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  verification_code VARCHAR(10) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP,
  UNIQUE(user_id, phone_number)
);

-- Selfie Verifications table for live selfie verification
CREATE TABLE IF NOT EXISTS selfie_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selfie_image_url VARCHAR(500) NOT NULL,
  id_document_image_url VARCHAR(500),
  match_confidence DECIMAL(5, 2),
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Driver Verification Status table to track overall verification progress
CREATE TABLE IF NOT EXISTS driver_verification_status (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  id_document_verified BOOLEAN DEFAULT FALSE,
  selfie_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  bank_account_verified BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  approval_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_id_documents_user_id ON id_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_id_documents_verification_status ON id_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_verification_status ON bank_accounts(verification_status);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_id ON phone_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_selfie_verifications_user_id ON selfie_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_selfie_verifications_status ON selfie_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_driver_verification_status_user_id ON driver_verification_status(user_id);

-- Add CHECK constraints using DO blocks (PostgreSQL 9.5+)
DO $$
BEGIN
  -- Check and add constraint for id_documents document_type
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_id_document_type' AND conrelid = 'id_documents'::regclass
  ) THEN
    ALTER TABLE id_documents ADD CONSTRAINT chk_id_document_type 
      CHECK (document_type IN ('drivers_license', 'national_id', 'passport', 'residence_permit'));
  END IF;
  
  -- Check and add constraint for id_documents verification_status
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_id_verification_status' AND conrelid = 'id_documents'::regclass
  ) THEN
    ALTER TABLE id_documents ADD CONSTRAINT chk_id_verification_status 
      CHECK (verification_status IN ('pending', 'verified', 'rejected'));
  END IF;
  
  -- Check and add constraint for bank_accounts verification_status
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 74
    WHERE conname = 'chk_bank_verification_status' AND conrelid = 'bank_accounts'::regclass
  ) THEN
    ALTER TABLE bank_accounts ADD CONSTRAINT chk_bank_verification_status 
      CHECK (verification_status IN ('pending', 'verified', 'rejected'));
  END IF;
  
  -- Check and add constraint for selfie_verifications verification_status
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_selfie_verification_status' AND conrelid = 'selfie_verifications'::regclass
  ) THEN
    ALTER TABLE selfie_verifications ADD CONSTRAINT chk_selfie_verification_status 
      CHECK (verification_status IN ('pending', 'verified', 'rejected', 'manual_review'));
  END IF;
END $$;