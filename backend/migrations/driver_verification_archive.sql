-- Archive of approved (and rejected) driver verification details for moderator reference.
-- Snapshots the full verification bundle at review time so details remain available
-- for future reference even if the underlying verification records change.

CREATE TABLE IF NOT EXISTS driver_verification_archive (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(50),
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reviewer_email VARCHAR(255),
  notes TEXT,
   id_document JSONB,
   selfie JSONB,
   phone_verification JSONB,
   bank_account JSONB,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_verification_archive_user_id ON driver_verification_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_verification_archive_archived_at ON driver_verification_archive(archived_at DESC);
