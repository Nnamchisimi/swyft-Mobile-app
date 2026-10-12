const { requireAdmin, resolveImageRef } = require('./verification.helpers');

function registerDriverVerificationRoutes(app, db) {
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

          res.json({
            message: 'Verification code sent',
            verification_code: verificationCode,
            phone_number: phone_number
          });
        });
      });
    });
  });

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

  app.get('/api/drivers/:email/verification-status', (req, res) => {
    const { email } = req.params;

    db.query('SELECT id, is_verified FROM public.users WHERE email = $1 AND LOWER(role) = \'driver\'', [email], (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

      const userId = userResult.rows[0].id;

      db.query('SELECT is_approved FROM driver_verification_status WHERE user_id = $1', [userId], (errAppr, apprResults) => {
        if (errAppr) {
          console.error('Approval check error in getVerificationStatus:', errAppr.message);
        }

        const hasSubmissionRecord = apprResults && apprResults.rows.length > 0;
        const driverApproved = hasSubmissionRecord && apprResults.rows[0].is_approved;
        const submittedForReview = hasSubmissionRecord && !apprResults.rows[0].is_approved;

        db.query('SELECT verification_status, is_verified FROM id_documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (err1, idResult) => {
          db.query('SELECT verification_status, is_verified FROM selfie_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (err2, selfieResult) => {
            db.query('SELECT is_verified FROM phone_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (err3, phoneResult) => {
              db.query('SELECT verification_status, is_verified FROM bank_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (err4, bankResult) => {
                db.query('SELECT make, model, year, color, plate_number, image_url FROM cars WHERE user_id = $1', [userId], (err5, carResult) => {
                  const car = carResult.rows.length > 0 ? carResult.rows[0] : null;

                  const idVerified = idResult.rows.length > 0 && idResult.rows[0].is_verified;
                  const selfieVerified = selfieResult.rows.length > 0 && selfieResult.rows[0].is_verified;
                  const phoneVerified = phoneResult.rows.length > 0 && phoneResult.rows[0].is_verified;
                  const bankVerified = bankResult.rows.length > 0 && bankResult.rows[0].is_verified;

                  const allVerified = idVerified && selfieVerified && phoneVerified && bankVerified;
                  const isApproved = driverApproved || allVerified;

                  res.json({
                    is_approved: isApproved,
                    submitted_for_review: submittedForReview,
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
                    },
                    car: car
                  });
                });
              });
            });
          });
        });
      });
    });
  });

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
}

module.exports = { registerDriverVerificationRoutes };
