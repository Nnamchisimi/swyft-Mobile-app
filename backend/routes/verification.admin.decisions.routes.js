const jwt = require('jsonwebtoken');
const { requireAdmin, buildArchiveSnapshot } = require('./verification.helpers');
const { getWithdrawalHistory, getDocumentHistory, getVerificationBundle } = require('./verification.data');

function registerAdminDecisionRoutes(app, db) {
  app.post('/api/admin/drivers/:email/approve', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { email } = req.params;
    const { approved } = req.body;

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

          const message = approved ? 'Driver approved' : 'Driver not approved';
          res.json({ message, email, is_approved: approved });

          if (approved) {
            const reviewerEmail = (() => {
              try {
                const decoded = jwt.verify(req.headers.authorization?.split(' ')[1], process.env.JWT_SECRET);
                return decoded.email || null;
              } catch (e) {
                return null;
              }
            })();

            getVerificationBundle(userId, (bundleErr, bundle) => {
              if (bundleErr) return;
              getDocumentHistory(userId, (histErr, history) => {
                if (histErr) return;
                const snapshot = buildArchiveSnapshot(bundle, history);
                getWithdrawalHistory(userId, (wErr, withdrawals) => {
                  if (wErr) return;
                  const finalSnapshot = { ...snapshot, withdrawals };
                  db.query(
                    `INSERT INTO driver_verification_archive
                      (user_id, email, first_name, last_name, phone, decision, reviewer_email, notes, id_document, selfie, phone_verification, bank_account, withdrawals, id_document_history, selfie_history, phone_history, bank_history)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                     ON CONFLICT (user_id) DO UPDATE SET
                       decision = EXCLUDED.decision,
                       reviewer_email = EXCLUDED.reviewer_email,
                       notes = EXCLUDED.notes,
                       id_document = EXCLUDED.id_document,
                       selfie = EXCLUDED.selfie,
                       phone_verification = EXCLUDED.phone_verification,
                       bank_account = EXCLUDED.bank_account,
                       withdrawals = EXCLUDED.withdrawals,
                       id_document_history = EXCLUDED.id_document_history,
                       selfie_history = EXCLUDED.selfie_history,
                       phone_history = EXCLUDED.phone_history,
                       bank_history = EXCLUDED.bank_history,
                       archived_at = NOW()`,
                    [
                      userId,
                      email,
                      userResult.rows[0].first_name,
                      userResult.rows[0].last_name,
                      userResult.rows[0].phone,
                      'approved',
                      reviewerEmail,
                      null,
                      JSON.stringify(finalSnapshot.id_document),
                      JSON.stringify(finalSnapshot.selfie),
                      JSON.stringify(finalSnapshot.phone),
                      JSON.stringify(finalSnapshot.bank_account),
                      JSON.stringify(finalSnapshot.withdrawals),
                      JSON.stringify(finalSnapshot.id_document_history || []),
                      JSON.stringify(finalSnapshot.selfie_history || []),
                      JSON.stringify(finalSnapshot.phone_history || []),
                      JSON.stringify(finalSnapshot.bank_history || []),
                    ],
                    (archiveErr) => {
                      if (archiveErr) console.error('Auto-archive error:', archiveErr);
                    }
                  );
                });
              });
            });
          }
        }
      );
    });
  });

  app.post('/api/admin/drivers/:email/reject-all', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { email } = req.params;
    const { notes } = req.body;

    db.query('SELECT id, first_name, last_name, phone FROM public.users WHERE email = $1 AND LOWER(role) = \'driver\'', [email], (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

      const userId = userResult.rows[0].id;

      let reviewerEmail = null;
      try {
        const decoded = jwt.verify(req.headers.authorization?.split(' ')[1], process.env.JWT_SECRET);
        reviewerEmail = decoded.email || null;
      } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      db.query(
        `UPDATE id_documents SET verification_status = 'rejected', is_verified = false, rejection_reason = $1 WHERE user_id = $2`,
        [notes || 'Rejected by moderator', userId],
        (err1) => {
          if (err1) return res.status(500).json({ error: 'Failed to reject ID document' });

          db.query(
            `UPDATE selfie_verifications SET verification_status = 'rejected', is_verified = false, rejection_reason = $1 WHERE user_id = $2`,
            [notes || 'Rejected by moderator', userId],
            (err2) => {
              if (err2) return res.status(500).json({ error: 'Failed to reject selfie' });

              db.query(
                `UPDATE phone_verifications SET is_verified = false WHERE user_id = $1`,
                [userId],
                (err3) => {
                  if (err3) return res.status(500).json({ error: 'Failed to reject phone' });

                  db.query(
                    `UPDATE bank_accounts SET verification_status = 'rejected', is_verified = false, rejection_reason = $1 WHERE user_id = $2`,
                    [notes || 'Rejected by moderator', userId],
                    (err4) => {
                      if (err4) return res.status(500).json({ error: 'Failed to reject bank account' });

                      db.query(
                        `INSERT INTO driver_verification_status (user_id, is_approved, approval_date)
                         VALUES ($1, false, null)
                         ON CONFLICT (user_id) DO UPDATE SET is_approved = false, approval_date = null`,
                        [userId],
                        (err5) => {
                          if (err5) return res.status(500).json({ error: 'Failed to update approval status' });

                          getVerificationBundle(userId, (bundleErr, bundle) => {
                            if (bundleErr) return res.status(500).json({ error: 'Failed to build archive' });
                            getDocumentHistory(userId, (histErr, history) => {
                              if (histErr) return res.status(500).json({ error: 'Failed to load history' });
                              const snapshot = buildArchiveSnapshot(bundle, history);
                              getWithdrawalHistory(userId, (wErr, withdrawals) => {
                                if (wErr) return res.status(500).json({ error: 'Failed to load withdrawals' });
                                const finalSnapshot = { ...snapshot, withdrawals };
                                db.query(
                                  `INSERT INTO driver_verification_archive
                                    (user_id, email, first_name, last_name, phone, decision, reviewer_email, notes, id_document, selfie, phone_verification, bank_account, car, withdrawals, id_document_history, selfie_history, phone_history, bank_history)
                                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                                  ON CONFLICT (user_id) DO UPDATE SET
                                    decision = EXCLUDED.decision,
                                    reviewer_email = EXCLUDED.reviewer_email,
                                    notes = EXCLUDED.notes,
                                    id_document = EXCLUDED.id_document,
                                    selfie = EXCLUDED.selfie,
                                    phone_verification = EXCLUDED.phone_verification,
                                    bank_account = EXCLUDED.bank_account,
                                    car = EXCLUDED.car,
                                    withdrawals = EXCLUDED.withdrawals,
                                    id_document_history = EXCLUDED.id_document_history,
                                    selfie_history = EXCLUDED.selfie_history,
                                    phone_history = EXCLUDED.phone_history,
                                    bank_history = EXCLUDED.bank_history,
                                    archived_at = NOW()`,
                                  [
                                    userId, email, userResult.rows[0].first_name, userResult.rows[0].last_name, userResult.rows[0].phone,
                                    'rejected', reviewerEmail, notes || 'Rejected by moderator',
                                    JSON.stringify(finalSnapshot.id_document), JSON.stringify(finalSnapshot.selfie),
                                    JSON.stringify(finalSnapshot.phone), JSON.stringify(finalSnapshot.bank_account),
                                    JSON.stringify(finalSnapshot.car), JSON.stringify(finalSnapshot.withdrawals),
                                    JSON.stringify(finalSnapshot.id_document_history || []),
                                    JSON.stringify(finalSnapshot.selfie_history || []),
                                    JSON.stringify(finalSnapshot.phone_history || []),
                                    JSON.stringify(finalSnapshot.bank_history || []),
                                  ],
                                  (archiveErr) => {
                                    if (archiveErr) return res.status(500).json({ error: 'Failed to archive driver' });
                                    res.json({ message: 'All verifications rejected', email, is_approved: false });
                                  }
                                );
                              });
                            });
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });

  app.post('/api/admin/drivers/:email/archive', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { email } = req.params;
    const { decision, notes } = req.body;

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

      getVerificationBundle(userId, (bundleErr, bundle) => {
        if (bundleErr) return res.status(500).json({ error: 'Failed to build archive' });
        getDocumentHistory(userId, (histErr, history) => {
          if (histErr) return res.status(500).json({ error: 'Failed to load history' });
          const snapshot = buildArchiveSnapshot(bundle, history);
          getWithdrawalHistory(userId, (wErr, withdrawals) => {
            if (wErr) return res.status(500).json({ error: 'Failed to load withdrawals' });
            const finalSnapshot = { ...snapshot, withdrawals };
            db.query(
              `INSERT INTO driver_verification_archive
                (user_id, email, first_name, last_name, phone, decision, reviewer_email, notes, id_document, selfie, phone_verification, bank_account, car, withdrawals, id_document_history, selfie_history, phone_history, bank_history)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
              ON CONFLICT (user_id) DO UPDATE SET
                decision = EXCLUDED.decision,
                reviewer_email = EXCLUDED.reviewer_email,
                notes = EXCLUDED.notes,
                id_document = EXCLUDED.id_document,
                selfie = EXCLUDED.selfie,
                phone_verification = EXCLUDED.phone_verification,
                bank_account = EXCLUDED.bank_account,
                car = EXCLUDED.car,
                withdrawals = EXCLUDED.withdrawals,
                id_document_history = EXCLUDED.id_document_history,
                selfie_history = EXCLUDED.selfie_history,
                phone_history = EXCLUDED.phone_history,
                bank_history = EXCLUDED.bank_history,
                archived_at = NOW()`,
              [
                userId, email, user.first_name, user.last_name, user.phone, decision, reviewerEmail,
                notes || null,
                JSON.stringify(finalSnapshot.id_document), JSON.stringify(finalSnapshot.selfie),
                JSON.stringify(finalSnapshot.phone), JSON.stringify(finalSnapshot.bank_account),
                JSON.stringify(finalSnapshot.car),
                JSON.stringify(finalSnapshot.withdrawals),
                JSON.stringify(finalSnapshot.id_document_history || []),
                JSON.stringify(finalSnapshot.selfie_history || []),
                JSON.stringify(finalSnapshot.phone_history || []),
                JSON.stringify(finalSnapshot.bank_history || []),
              ],
              (err2) => {
                if (err2) return res.status(500).json({ error: 'Failed to archive driver' });
                res.json({ message: 'Driver archived', email, decision });
              }
            );
          });
        });
      });
    });
  });
}

module.exports = { registerAdminDecisionRoutes };
