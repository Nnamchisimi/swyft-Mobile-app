function ensureVerificationTables(db) {
  const createTables = [
    `CREATE TABLE IF NOT EXISTS id_documents (
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
    )`,
    `CREATE TABLE IF NOT EXISTS selfie_verifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      selfie_image_url VARCHAR(500) NOT NULL,
      id_document_image_url VARCHAR(500),
      verification_status VARCHAR(20) DEFAULT 'pending',
      is_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS phone_verifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      phone_number VARCHAR(20) NOT NULL,
      verification_code VARCHAR(10) NOT NULL,
      is_verified BOOLEAN DEFAULT FALSE,
      verified_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS bank_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bank_name VARCHAR(100) NOT NULL,
      account_number VARCHAR(50) NOT NULL,
      account_holder_name VARCHAR(100) NOT NULL,
      routing_number VARCHAR(20),
      iban VARCHAR(50),
      swift_code VARCHAR(20),
      verification_status VARCHAR(20) DEFAULT 'pending',
      is_verified BOOLEAN DEFAULT FALSE,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS driver_verification_status (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      is_approved BOOLEAN DEFAULT FALSE,
      approval_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
     `CREATE TABLE IF NOT EXISTS driver_verification_archive (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      phone VARCHAR(50),
      decision VARCHAR(20) NOT NULL,
      reviewer_email VARCHAR(255),
      notes TEXT,
      id_document JSONB,
      selfie JSONB,
      phone_verification JSONB,
      bank_account JSONB,
      withdrawals JSONB,
      archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ratings (
      id SERIAL PRIMARY KEY,
      ride_id INTEGER NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
      user_email VARCHAR(255) NOT NULL,
      driver_email VARCHAR(255),
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ratings_ride_id ON ratings(ride_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ratings_driver_email ON ratings(driver_email)`,
    `CREATE INDEX IF NOT EXISTS idx_ratings_user_email ON ratings(user_email)`,
    `CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON ratings(created_at)`
  ];

  let completed = 0;
  createTables.forEach((query, index) => {
    db.query(query, [], (err) => {
      if (err) {
        console.error(`Error creating verification table ${index}:`, err.message);
      }
      completed++;
      if (completed === createTables.length) {
        console.log('All verification tables ensured');
      }
    });
  });
}

function migrateVerificationTables(db) {
  const alters = [
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) NOT NULL DEFAULT 'national_id'`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS document_number VARCHAR(100) NOT NULL DEFAULT 'unknown'`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS expiry_date DATE`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS front_image_url TEXT`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS back_image_url TEXT`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending'`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS rejection_reason TEXT`,
    `ALTER TABLE selfie_verifications ADD COLUMN IF NOT EXISTS selfie_image_url TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE selfie_verifications ADD COLUMN IF NOT EXISTS id_document_image_url TEXT`,
    `ALTER TABLE selfie_verifications ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending'`,
    `ALTER TABLE selfie_verifications ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) NOT NULL DEFAULT ''`,
    `ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10) NOT NULL DEFAULT ''`,
    `ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100) NOT NULL DEFAULT ''`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(50) NOT NULL DEFAULT ''`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(100) NOT NULL DEFAULT ''`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS routing_number VARCHAR(20)`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS iban VARCHAR(50)`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS swift_code VARCHAR(20)`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending'`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE`,
     `ALTER TABLE driver_verification_status ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE`,
     `ALTER TABLE driver_verification_status ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP`,
      `ALTER TABLE driver_verification_archive ADD COLUMN IF NOT EXISTS withdrawals JSONB`,
      `ALTER TABLE driver_verification_archive ADD COLUMN IF NOT EXISTS car JSONB`,
      `ALTER TABLE driver_verification_archive ADD COLUMN IF NOT EXISTS id_document_history JSONB`,
      `ALTER TABLE driver_verification_archive ADD COLUMN IF NOT EXISTS selfie_history JSONB`,
      `ALTER TABLE driver_verification_archive ADD COLUMN IF NOT EXISTS phone_history JSONB`,
      `ALTER TABLE driver_verification_archive ADD COLUMN IF NOT EXISTS bank_history JSONB`,
    `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS ride_id INTEGER`,
    `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
    `ALTER TABLE ratings ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::TIMESTAMPTZ`,
    `ALTER TABLE ratings ALTER COLUMN rating TYPE SMALLINT USING rating::SMALLINT`,
    `ALTER TABLE id_documents ALTER COLUMN front_image_url TYPE TEXT`,
    `ALTER TABLE id_documents ALTER COLUMN back_image_url TYPE TEXT`,
    `ALTER TABLE selfie_verifications ALTER COLUMN selfie_image_url TYPE TEXT`,
    `ALTER TABLE selfie_verifications ALTER COLUMN id_document_image_url TYPE TEXT`,
  ];

  let completed = 0;
  alters.forEach((query, index) => {
    db.query(query, [], (err) => {
      if (err) {
        console.error(`Error migrating verification table column ${index}:`, err.message);
      }
      completed++;
      if (completed === alters.length) {
        console.log('All verification table migrations ensured');
      }
    });
  });
}

module.exports = { ensureVerificationTables, migrateVerificationTables };
