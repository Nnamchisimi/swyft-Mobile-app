const jwt = require('jsonwebtoken');
const { verifyToken } = require('../utils/helpers');

// Admin auth check helper (mirrors adminGuard but inline for clarity)
function requireAdmin(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return { ok: false, res: res.status(401).json({ error: 'Unauthorized' }) };
  try {
    verifyToken(token);
    return { ok: true, token };
  } catch (e) {
    return { ok: false, res: res.status(401).json({ error: 'Invalid or expired token' }) };
  }
}

// The DB only stores a reference in selfie_verifications.selfie_image_url:
//   - a Supabase Storage public URL (actual file lives in the bucket)
//   - a `data:image/...;base64,...` data URI (the image is embedded in the row)
// resolveImageRef normalizes either into a renderable { type, url } object.
function resolveImageRef(ref) {
  if (!ref) return null;
  if (ref.startsWith('data:image/')) return { type: 'base64', url: ref };
  return { type: 'url', url: ref };
}

// Register all driver-verification endpoints + table setup/migration
function registerVerificationRoutes(app, db) {
  // Ensure verification tables exist
  const ensureVerificationTables = () => {
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
  };

  // Idempotently ensure all expected columns exist. CREATE TABLE IF NOT EXISTS will
  // NOT modify a table that already exists from an older deployment, which causes
  // INSERTs to fail on missing/mismatched columns. ADD COLUMN IF NOT EXISTS fixes
  // that drift safely on every startup.
  const migrateVerificationTables = () => {
    const alters = [
      // id_documents
      `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) NOT NULL DEFAULT 'national_id'`,
      `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS document_number VARCHAR(100) NOT NULL DEFAULT 'unknown'`,
      `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS expiry_date DATE`,
      `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS front_image_url TEXT`,
      `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS back_image_url TEXT`,
      `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending'`,
      `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS rejection_reason TEXT`,
      // selfie_verifications
      `ALTER TABLE selfie_verifications ADD COLUMN IF NOT EXISTS selfie_image_url TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE selfie_verifications ADD COLUMN IF NOT EXISTS id_document_image_url TEXT`,
      `ALTER TABLE selfie_verifications ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending'`,
      `ALTER TABLE selfie_verifications ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
      // phone_verifications
      `ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) NOT NULL DEFAULT ''`,
      `ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10) NOT NULL DEFAULT ''`,
      `ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
      // bank_accounts
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100) NOT NULL DEFAULT ''`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(50) NOT NULL DEFAULT ''`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(100) NOT NULL DEFAULT ''`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS routing_number VARCHAR(20)`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS iban VARCHAR(50)`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS swift_code VARCHAR(20)`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending'`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE`,
      // driver_verification_status
      `ALTER TABLE driver_verification_status ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE driver_verification_status ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP`,
      // ratings
      `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS ride_id INTEGER`,
      `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
      `ALTER TABLE ratings ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::TIMESTAMPTZ`,
      `ALTER TABLE ratings ALTER COLUMN rating TYPE SMALLINT USING rating::SMALLINT`,
      // Widen image columns to TEXT so base64 image data fits
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
  };

  ensureVerificationTables();
  migrateVerificationTables();

  // Upload government-issued ID
  app.post('/api/drivers/:email/id-document', (req, res) => {
    const { email } = req.params;
    const { document_type, document_number, expiry_date, front_image_url, back_image_url } = req.body;

    if (!document_type || !document_number) {
      return res.status(400).json({ error: 'Document type and number are required' });
    }

    db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error', details: err.message });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const userId = userResult.rows[0].id;

      const insertQuery = 'INSERT INTO id_documents (user_id, document_type, document_number, expiry_date, front_image_url, back_image_url, verification_status) VALUES ($1, $2, $3, $4, $5, $6, \'pending\') RETURNING *';

      const values = [
        userId,
        document_type,
        document_number,
        (() => {
          if (!expiry_date || expiry_date === '') return null;
          const d = new Date(expiry_date);
          return isNaN(d.getTime()) ? null : expiry_date;
        })(),
        front_image_url && front_image_url !== '' ? front_image_url : null,
        back_image_url && back_image_url !== '' ? back_image_url : null
      ];

      db.query(insertQuery, values, (err2, result) => {
        if (err2) {
          console.error('ID document insert error:', err2);
          console.error('Error code:', err2.code);
          console.error('Error detail:', err2.detail);
          return res.status(500).json({
            error: 'Failed to save ID document',
            details: err2.message,
            code: err2.code
          });
        }

        res.json({
          message: 'ID document submitted successfully',
          document: result.rows[0]
        });
      });
    });
  });

  // Upload live selfie for verification
  app.post('/api/drivers/:email/selfie', (req, res) => {
    const { email } = req.params;
    const { selfie_image_url, id_document_image_url } = req.body;

    if (!selfie_image_url) {
      return res.status(400).json({ error: 'Selfie image is required' });
    }

    db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const userId = userResult.rows[0].id;

      const insertQuery = 'INSERT INTO selfie_verifications (user_id, selfie_image_url, id_document_image_url, verification_status) VALUES ($1, $2, $3, \'pending\') RETURNING *';

      const values = [
        userId,
        selfie_image_url,
        id_document_image_url && id_document_image_url !== '' ? id_document_image_url : null
      ];

      db.query(insertQuery, values, (err2, result) => {
        if (err2) {
          console.error('Selfie insert error:', err2);
          return res.status(500).json({ error: 'Failed to save selfie', details: err2.message });
        }

        res.json({
          message: 'Selfie submitted successfully',
          selfie: result.rows[0]
        });
      });
    });
  });

  // Verify phone number
  app.post('/api/drivers/:email/phone-verify', (req, res) => {
    const { email } = req.params;
    const { phone_number, verification_code } = req.body;

    if (!phone_number || !verification_code) {
      return res.status(400).json({ error: 'Phone number and verification code are required' });
    }

    db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const userId = userResult.rows[0].id;

      db.query('SELECT * FROM phone_verifications WHERE user_id = $1 AND phone_number = $2 AND verification_code = $3', [userId, phone_number, verification_code], (err2, verifyResult) => {
        if (err2) return res.status(500).json({ error: 'Server error' });
        if (verifyResult.rows.length === 0) {
          return res.status(401).json({ error: 'Invalid verification code' });
        }

        db.query('UPDATE phone_verifications SET is_verified = true, verified_at = NOW() WHERE user_id = $1 AND phone_number = $2', [userId, phone_number], (err3) => {
          if (err3) return res.status(500).json({ error: 'Failed to verify phone' });

          db.query('UPDATE public.users SET phone = $1 WHERE id = $2', [phone_number, userId], (err4) => {
            if (err4) return res.status(500).json({ error: 'Failed to update phone' });

            res.json({
              message: 'Phone number verified successfully',
              phone_number: phone_number
            });
          });
        });
      });
    });
  });

  // Request phone verification code
  app.post('/api/drivers/:email/phone-request-code', (req, res) => {
    const { email } = req.params;
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const userId = userResult.rows[0].id;
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      db.query('DELETE FROM phone_verifications WHERE user_id = $1', [userId], (err2) => {
        db.query('INSERT INTO phone_verifications (user_id, phone_number, verification_code, created_at) VALUES ($1, $2, $3, NOW())', [userId, phone_number, verificationCode], (err3) => {
          if (err3) return res.status(500).json({ error: 'Failed to save verification code' });

          // In production, send SMS via Twilio or similar service
          // For now, return the code (development mode)
          res.json({
            message: 'Verification code sent',
            verification_code: verificationCode, // Remove in production, use SMS
            phone_number: phone_number
          });
        });
      });
    });
  });

  // Add bank account
  app.post('/api/drivers/:email/bank-account', (req, res) => {
    const { email } = req.params;
    const { bank_name, account_number, account_holder_name, routing_number, iban, swift_code } = req.body;

    if (!bank_name || !account_number || !account_holder_name) {
      return res.status(400).json({ error: 'Bank name, account number, and account holder name are required' });
    }

    db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const userId = userResult.rows[0].id;

      const insertQuery = 'INSERT INTO bank_accounts (user_id, bank_name, account_number, account_holder_name, routing_number, iban, swift_code, verification_status, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, \'pending\', true) RETURNING *';

      db.query(insertQuery, [userId, bank_name, account_number, account_holder_name, routing_number || null, iban || null, swift_code || null], (err2, result) => {
        if (err2) return res.status(500).json({ error: 'Failed to save bank account' });

        res.json({
          message: 'Bank account submitted successfully',
          bank_account: result.rows[0]
        });
      });
    });
  });

  // Get driver verification status
  app.get('/api/drivers/:email/verification-status', (req, res) => {
    const { email } = req.params;

    db.query('SELECT id, is_verified FROM public.users WHERE email = $1 AND LOWER(role) = \'driver\'', [email], (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

      const userId = userResult.rows[0].id;
      const userVerified = !!userResult.rows[0].is_verified;

      db.query('SELECT is_approved FROM driver_verification_status WHERE user_id = $1', [userId], (errAppr, apprResults) => {
        if (errAppr) {
          console.error('Approval check error in getVerificationStatus:', errAppr.message);
        }

        const driverApproved = apprResults && apprResults.rows.length > 0 && apprResults.rows[0].is_approved;

        // Get ID document status
        db.query('SELECT verification_status, is_verified FROM id_documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (err1, idResult) => {
          // Get selfie verification status
          db.query('SELECT verification_status, is_verified FROM selfie_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (err2, selfieResult) => {
            // Get phone verification status
            db.query('SELECT is_verified FROM phone_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (err3, phoneResult) => {
              // Get bank account status
              db.query('SELECT verification_status, is_verified FROM bank_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (err4, bankResult) => {

                const idVerified = idResult.rows.length > 0 && idResult.rows[0].is_verified;
                const selfieVerified = selfieResult.rows.length > 0 && selfieResult.rows[0].is_verified;
                const phoneVerified = phoneResult.rows.length > 0 && phoneResult.rows[0].is_verified;
                const bankVerified = bankResult.rows.length > 0 && bankResult.rows[0].is_verified;

                const allVerified = idVerified && selfieVerified && phoneVerified && bankVerified;
                const isApproved = driverApproved || userVerified || allVerified;

                res.json({
                  is_approved: isApproved,
                  verifications: {
                    id_document: {
                      is_verified: idVerified,
                      status: idResult.rows.length > 0 ? idResult.rows[0].verification_status : 'not_submitted'
                    },
                    selfie: {
                      is_verified: selfieVerified,
                      status: selfieResult.rows.length > 0 ? selfieResult.rows[0].verification_status : 'not_submitted'
                    },
                    phone: {
                      is_verified: phoneVerified,
                      status: phoneResult.rows.length > 0 ? 'pending' : 'not_submitted'
                    },
                    bank_account: {
                      is_verified: bankVerified,
                      status: bankResult.rows.length > 0 ? bankResult.rows[0].verification_status : 'not_submitted'
                    }
                  }
                });
              });
            });
          });
        });
      });
    });
  });

  // Update driver verification approval status
  app.patch('/api/drivers/:email/approve', (req, res) => {
    const { email } = req.params;
    const { is_approved } = req.body;

    db.query('SELECT id FROM public.users WHERE email = $1 AND LOWER(role) = \'driver\'', [email], (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

      const userId = userResult.rows[0].id;

      db.query('INSERT INTO driver_verification_status (user_id, is_approved, approval_date) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET is_approved = $2, approval_date = $3',
        [userId, is_approved, is_approved ? new Date().toISOString() : null], (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to update approval status' });

        res.json({ message: 'Approval status updated', is_approved });
      });
    });
  });

  // Submit all driver verifications for manual review.
  // Each verification record is already saved when the driver completes its step;
  // this guarantees every record is flagged as 'pending' and the overall
  // submission is recorded so an admin can review and approve directly from the DB.
  app.post('/api/drivers/:email/submit-for-review', (req, res) => {
    const { email } = req.params;

    db.query('SELECT id, is_verified FROM public.users WHERE email = $1 AND LOWER(role) = \'driver\'', [email], (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

      const userId = userResult.rows[0].id;
      const userVerified = !!userResult.rows[0].is_verified;

      let pending = 3;
      const afterMark = () => {
        if (--pending > 0) return;

        // Record the overall submission (submitted for review, not yet approved)
        db.query(
          `INSERT INTO driver_verification_status (user_id, is_approved, approval_date)
           VALUES ($1, false, null)
           ON CONFLICT (user_id) DO UPDATE SET is_approved = false, approval_date = null`,
          [userId],
          (err3) => {
            if (err3) return res.status(500).json({ error: 'Failed to submit for review' });

            const summaryQuery = `
              SELECT
                (SELECT COUNT(*) FROM id_documents WHERE user_id = $1) AS id_documents,
                (SELECT COUNT(*) FROM selfie_verifications WHERE user_id = $1) AS selfies,
                (SELECT COUNT(*) FROM phone_verifications WHERE user_id = $1) AS phones,
                (SELECT COUNT(*) FROM bank_accounts WHERE user_id = $1) AS bank_accounts
            `;
            db.query(summaryQuery, [userId], (err4, sumResult) => {
              if (err4) return res.status(500).json({ error: 'Failed to load submission summary' });
              res.json({ message: 'Submitted for review', submitted: sumResult.rows[0] });
            });
          }
        );
      };

      db.query('UPDATE id_documents SET verification_status = \'pending\' WHERE user_id = $1', [userId], afterMark);
      db.query('UPDATE selfie_verifications SET verification_status = \'pending\' WHERE user_id = $1', [userId], afterMark);
      db.query('UPDATE bank_accounts SET verification_status = \'pending\' WHERE user_id = $1', [userId], afterMark);
    });
  });

  // Get a single driver's latest selfie + id-document image for review
  app.get('/api/admin/drivers/:email/selfie', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { email } = req.params;
    db.query('SELECT id, first_name, last_name, email, role FROM public.users WHERE email = $1', [email], (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const user = userResult.rows[0];
      db.query(
        'SELECT * FROM selfie_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [user.id],
        (err2, selfieResult) => {
          if (err2) return res.status(500).json({ error: 'Failed to load selfie' });

          const selfie = selfieResult.rows[0] || null;
          res.json({
            driver: {
              id: user.id,
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email,
              role: user.role,
            },
            selfie: selfie ? {
              id: selfie.id,
              selfie_image: resolveImageRef(selfie.selfie_image_url),
              id_document_image: resolveImageRef(selfie.id_document_image_url),
              match_confidence: selfie.match_confidence,
              is_verified: selfie.is_verified,
              verification_status: selfie.verification_status,
              rejection_reason: selfie.rejection_reason,
              created_at: selfie.created_at,
              updated_at: selfie.updated_at,
            } : null,
          });
        }
      );
    });
  });

  // List selfie verification records (review queue), optionally filtered by status
  app.get('/api/admin/selfies', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { status } = req.query;
    const params = [];
    let statusCond = '';
    if (status) {
      params.push(status);
      statusCond = 'WHERE sv.verification_status = $1';
    }

    const query = `
      SELECT
        sv.id,
        sv.selfie_image_url,
        sv.id_document_image_url,
        sv.match_confidence,
        sv.is_verified,
        sv.verification_status,
        sv.created_at,
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email
      FROM selfie_verifications sv
      JOIN public.users u ON u.id = sv.user_id
      ${statusCond}
      ORDER BY sv.created_at DESC
    `;

    db.query(query, params, (err, results) => {
      if (err) return res.status(500).json({ error: 'Failed to load selfies' });
      res.json(results.rows.map((r) => ({
        id: r.id,
        driver: { id: r.user_id, first_name: r.first_name, last_name: r.last_name, email: r.email },
        selfie_image: resolveImageRef(r.selfie_image_url),
        id_document_image: resolveImageRef(r.id_document_image_url),
        match_confidence: r.match_confidence,
        is_verified: r.is_verified,
        verification_status: r.verification_status,
        created_at: r.created_at,
      })));
    });
  });

  // List drivers who have submitted verifications and still need review (any pending/rejected piece)
  app.get('/api/admin/drivers/pending', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const query = `
      SELECT DISTINCT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.created_at AS registered_at,
        COALESCE(dvs.is_approved, false) AS is_approved
      FROM public.users u
      LEFT JOIN driver_verification_status dvs ON dvs.user_id = u.id
      WHERE LOWER(u.role) = 'driver'
        AND (
          EXISTS (
            SELECT 1 FROM (
              SELECT DISTINCT ON (user_id) verification_status
              FROM id_documents WHERE user_id = u.id
              ORDER BY user_id, created_at DESC
            ) idv WHERE idv.verification_status IN ('pending','rejected')
          )
          OR EXISTS (
            SELECT 1 FROM (
              SELECT DISTINCT ON (user_id) verification_status
              FROM selfie_verifications WHERE user_id = u.id
              ORDER BY user_id, created_at DESC
            ) sv WHERE sv.verification_status IN ('pending','rejected')
          )
          OR EXISTS (
            SELECT 1 FROM (
              SELECT DISTINCT ON (user_id) verification_status
              FROM bank_accounts WHERE user_id = u.id
              ORDER BY user_id, created_at DESC
            ) ba WHERE ba.verification_status IN ('pending','rejected')
          )
          OR EXISTS (
            SELECT 1 FROM (
              SELECT DISTINCT ON (user_id) is_verified
              FROM phone_verifications WHERE user_id = u.id
              ORDER BY user_id, created_at DESC
            ) pv WHERE pv.is_verified = false
          )
        )
      ORDER BY u.created_at DESC
    `;

    db.query(query, [], (err, results) => {
      if (err) return res.status(500).json({ error: 'Failed to load pending drivers' });
      res.json(results.rows);
    });
  });

  // Approve or reject a single selfie verification
  app.post('/api/admin/drivers/:email/selfie/review', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { email } = req.params;
    const { decision, rejection_reason } = req.body; // decision: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
    }

    db.query('SELECT id FROM public.users WHERE email = $1', [email], (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      const userId = userResult.rows[0].id;

      const status = decision === 'approve' ? 'verified' : 'rejected';
      const isVerified = decision === 'approve';
      const reason = decision === 'reject' ? (rejection_reason || 'Rejected by moderator') : null;

      db.query(
        `UPDATE selfie_verifications
           SET verification_status = $1,
               is_verified = $2,
               rejection_reason = $3,
               reviewed_at = NOW()
         WHERE user_id = $4 AND id = (
           SELECT id FROM selfie_verifications WHERE user_id = $4 ORDER BY created_at DESC LIMIT 1
         )`,
        [status, isVerified, reason, userId],
        (err2) => {
          if (err2) return res.status(500).json({ error: 'Failed to review selfie' });
          res.json({ message: `Selfie ${status}`, email, verification_status: status, is_verified: isVerified });
        }
      );
    });
  });

  // Approve or reject an ID document
  app.post('/api/admin/drivers/:email/id-document/review', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { email } = req.params;
    const { decision, rejection_reason } = req.body;

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
    }

    db.query('SELECT id FROM public.users WHERE email = $1', [email], (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      const userId = userResult.rows[0].id;

      const status = decision === 'approve' ? 'verified' : 'rejected';
      const isVerified = decision === 'approve';
      const reason = decision === 'reject' ? (rejection_reason || 'Rejected by moderator') : null;

      db.query(
        `UPDATE id_documents
           SET verification_status = $1,
               is_verified = $2,
               rejection_reason = $3
         WHERE user_id = $4 AND id = (
           SELECT id FROM id_documents WHERE user_id = $4 ORDER BY created_at DESC LIMIT 1
         )`,
        [status, isVerified, reason, userId],
        (err2) => {
          if (err2) return res.status(500).json({ error: 'Failed to review ID document' });
          res.json({ message: `ID document ${status}`, email, verification_status: status, is_verified: isVerified });
        }
      );
    });
  });

  // Approve or reject a phone verification
  app.post('/api/admin/drivers/:email/phone/review', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { email } = req.params;
    const { decision, verified } = req.body; // decision: 'approve' | 'reject' OR verified: boolean

    const isVerified = decision ? decision === 'approve' : !!verified;
    if (typeof isVerified !== 'boolean') {
      return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
    }

    db.query('SELECT id FROM public.users WHERE email = $1', [email], (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      const userId = userResult.rows[0].id;

      db.query(
        `UPDATE phone_verifications SET is_verified = $1 WHERE user_id = $2 AND id = (
           SELECT id FROM phone_verifications WHERE user_id = $2 ORDER BY created_at DESC LIMIT 1
         )`,
        [isVerified, userId],
        (err2) => {
          if (err2) return res.status(500).json({ error: 'Failed to review phone' });
          res.json({ message: `Phone ${isVerified ? 'verified' : 'rejected'}`, email, is_verified: isVerified });
        }
      );
    });
  });

  // Approve or reject a bank account
  app.post('/api/admin/drivers/:email/bank/review', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { email } = req.params;
    const { decision, rejection_reason } = req.body;

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
    }

    db.query('SELECT id FROM public.users WHERE email = $1', [email], (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      const userId = userResult.rows[0].id;

      const status = decision === 'approve' ? 'verified' : 'rejected';
      const isVerified = decision === 'approve';
      const reason = decision === 'reject' ? (rejection_reason || 'Rejected by moderator') : null;

      db.query(
        `UPDATE bank_accounts
           SET verification_status = $1, is_verified = $2, rejection_reason = $3
         WHERE user_id = $4 AND id = (
           SELECT id FROM bank_accounts WHERE user_id = $4 ORDER BY created_at DESC LIMIT 1
         )`,
        [status, isVerified, reason, userId],
        (err2) => {
          if (err2) return res.status(500).json({ error: 'Failed to review bank account' });
          res.json({ message: `Bank account ${status}`, email, verification_status: status, is_verified: isVerified });
        }
      );
    });
  });

  // Build a driver's full verification bundle (ID doc + images, selfie + image, phone, bank)
  const getVerificationBundle = (userId, callback) => {
    db.query(
      `SELECT * FROM id_documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
      (e1, idResult) => {
        db.query(
          `SELECT * FROM selfie_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [userId],
          (e2, selfieResult) => {
            db.query(
              `SELECT * FROM phone_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
              [userId],
              (e3, phoneResult) => {
                db.query(
                  `SELECT * FROM bank_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
                  [userId],
                  (e4, bankResult) => {
                    const id = idResult.rows[0] || null;
                    const selfie = selfieResult.rows[0] || null;
                    const phone = phoneResult.rows[0] || null;
                    const bank = bankResult.rows[0] || null;

                    const bundle = {
                      id_document: id ? {
                        id: id.id,
                        document_type: id.document_type,
                        document_number: id.document_number,
                        expiry_date: id.expiry_date,
                        front_image: resolveImageRef(id.front_image_url),
                        back_image: resolveImageRef(id.back_image_url),
                        is_verified: id.is_verified,
                        verification_status: id.verification_status,
                        rejection_reason: id.rejection_reason,
                      } : null,
                      selfie: selfie ? {
                        id: selfie.id,
                        selfie_image: resolveImageRef(selfie.selfie_image_url),
                        id_document_image: resolveImageRef(selfie.id_document_image_url),
                        match_confidence: selfie.match_confidence,
                        is_verified: selfie.is_verified,
                        verification_status: selfie.verification_status,
                        rejection_reason: selfie.rejection_reason,
                        created_at: selfie.created_at,
                      } : null,
                      phone: phone ? {
                        id: phone.id,
                        phone_number: phone.phone_number,
                        is_verified: phone.is_verified,
                        verified_at: phone.verified_at,
                      } : null,
                      bank_account: bank ? {
                        id: bank.id,
                        bank_name: bank.bank_name,
                        account_holder_name: bank.account_holder_name,
                        account_number: bank.account_number,
                        routing_number: bank.routing_number,
                        iban: bank.iban,
                        swift_code: bank.swift_code,
                        is_verified: bank.is_verified,
                        verification_status: bank.verification_status,
                        rejection_reason: bank.rejection_reason,
                      } : null,
                    };
                    callback(null, bundle);
                  }
                );
              }
            );
          }
        );
      }
    );
  };

  // Get the FULL verification bundle for a driver (ID doc + images, selfie + image, phone, bank) for moderator review
  app.get('/api/admin/drivers/:email/verification', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { email } = req.params;

    db.query(
      `SELECT id, first_name, last_name, email, phone, role, created_at FROM public.users WHERE email = $1`,
      [email],
      (err, userResult) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const user = userResult.rows[0];
        const userId = user.id;

        getVerificationBundle(userId, (bundleErr, bundle) => {
          if (bundleErr) return res.status(500).json({ error: 'Server error' });
          res.json({
            driver: {
              id: user.id,
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email,
              phone: user.phone,
              role: user.role,
              created_at: user.created_at,
            },
            id_document: bundle.id_document,
            selfie: bundle.selfie,
            phone: bundle.phone,
            bank_account: bundle.bank_account,
          });
        });
      }
    );
  });

  // Approve/reject overall driver (sets the aggregated verification flags + is_approved)
  app.post('/api/admin/drivers/:email/approve', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { email } = req.params;
    const { approved } = req.body; // boolean

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved must be a boolean' });
    }

    db.query('SELECT id, is_verified FROM public.users WHERE email = $1 AND LOWER(role) = \'driver\'', [email], (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

      const userId = userResult.rows[0].id;
      const userVerified = !!userResult.rows[0].is_verified;

      db.query(
        `INSERT INTO driver_verification_status (user_id, is_approved, approval_date)
         VALUES ($1, $2, CASE WHEN $2 THEN NOW() ELSE NULL END)
         ON CONFLICT (user_id) DO UPDATE SET is_approved = $2, approval_date = CASE WHEN $2 THEN NOW() ELSE NULL END`,
        [userId, approved],
        (err2) => {
          if (err2) return res.status(500).json({ error: 'Failed to update approval' });
          res.json({ message: approved ? 'Driver approved' : 'Driver not approved', email, is_approved: approved });
        }
      );
    });
  });

  // Snapshot a driver's full verification bundle for archival reference
  const buildArchiveSnapshot = (bundle) => ({
    id_document: bundle.id_document
      ? {
        document_type: bundle.id_document.document_type,
        document_number: bundle.id_document.document_number,
        expiry_date: bundle.id_document.expiry_date,
        verification_status: bundle.id_document.verification_status,
        is_verified: bundle.id_document.is_verified,
        rejection_reason: bundle.id_document.rejection_reason,
        front_image: bundle.id_document.front_image,
        back_image: bundle.id_document.back_image,
      }
      : null,
    selfie: bundle.selfie
      ? {
        verification_status: bundle.selfie.verification_status,
        is_verified: bundle.selfie.is_verified,
        match_confidence: bundle.selfie.match_confidence,
        rejection_reason: bundle.selfie.rejection_reason,
        selfie_image: bundle.selfie.selfie_image,
        id_document_image: bundle.selfie.id_document_image,
      }
      : null,
    phone: bundle.phone
      ? {
        phone_number: bundle.phone.phone_number,
        is_verified: bundle.phone.is_verified,
        verified_at: bundle.phone.verified_at,
      }
      : null,
    bank_account: bundle.bank_account
      ? {
        bank_name: bundle.bank_account.bank_name,
        account_holder_name: bundle.bank_account.account_holder_name,
        account_number: bundle.bank_account.account_number,
        routing_number: bundle.bank_account.routing_number,
        iban: bundle.bank_account.iban,
        swift_code: bundle.bank_account.swift_code,
        verification_status: bundle.bank_account.verification_status,
        is_verified: bundle.bank_account.is_verified,
        rejection_reason: bundle.bank_account.rejection_reason,
      }
      : null,
  });

  // Archive a driver's verification details for future reference (called after review actions)
  app.post('/api/admin/drivers/:email/archive', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { email } = req.params;
    const { decision, notes } = req.body; // decision: 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    let reviewerEmail = null;
    try {
      const decoded = jwt.verify(req.headers.authorization?.split(' ')[1], process.env.JWT_SECRET);
      reviewerEmail = decoded.email || null;
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    db.query('SELECT id, first_name, last_name, phone FROM public.users WHERE email = $1', [email], (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });
      const user = userResult.rows[0];
      const userId = user.id;

      // Reuse the verification bundle builder
      getVerificationBundle(userId, (bundleErr, bundle) => {
        if (bundleErr) return res.status(500).json({ error: 'Failed to build archive' });
        const snapshot = buildArchiveSnapshot(bundle);
        db.query(
           `INSERT INTO driver_verification_archive
              (user_id, email, first_name, last_name, phone, decision, reviewer_email, notes, id_document, selfie, phone_verification, bank_account)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
           [
             userId, email, user.first_name, user.last_name, user.phone, decision, reviewerEmail,
             notes || null,
             JSON.stringify(snapshot.id_document), JSON.stringify(snapshot.selfie),
             JSON.stringify(snapshot.phone), JSON.stringify(snapshot.bank_account),
           ],
          (err2) => {
            if (err2) return res.status(500).json({ error: 'Failed to archive driver' });
            res.json({ message: 'Driver archived', email, decision });
          }
        );
      });
    });
  });

  // List all archived drivers (for moderator reference)
  app.get('/api/admin/drivers/archived', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    db.query(
      `SELECT id, email, first_name, last_name, phone, decision, reviewer_email, notes, archived_at
       FROM driver_verification_archive ORDER BY archived_at DESC`,
      [],
      (err, results) => {
        if (err) return res.status(500).json({ error: 'Failed to load archived drivers' });
        res.json(results.rows);
      }
    );
  });

  // Get a single archived driver's full details (for moderator reference)
  app.get('/api/admin/drivers/archived/:id', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { id } = req.params;
    db.query(
       `SELECT id, user_id, email, first_name, last_name, phone, decision, reviewer_email, notes, id_document, selfie, phone_verification, bank_account, archived_at
        FROM driver_verification_archive WHERE id = $1`,
      [id],
      (err, results) => {
        if (err) return res.status(500).json({ error: 'Failed to load archived driver' });
        if (results.rows.length === 0) return res.status(404).json({ error: 'Archived driver not found' });
        const row = results.rows[0];
        res.json({
          ...row,
          id_document: row.id_document ? JSON.parse(row.id_document) : null,
          selfie: row.selfie ? JSON.parse(row.selfie) : null,
          phone_verification: row.phone_verification ? JSON.parse(row.phone_verification) : null,
          bank_account: row.bank_account ? JSON.parse(row.bank_account) : null,
        });
      }
    );
  });
}

module.exports = { registerVerificationRoutes };
