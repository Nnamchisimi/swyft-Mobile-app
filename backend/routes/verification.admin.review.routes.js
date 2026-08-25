const { requireAdmin } = require('./verification.helpers');
const { getVerificationBundle } = require('./verification.data');

function registerAdminReviewRoutes(app, db) {
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

  app.post('/api/admin/drivers/:email/phone/review', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { email } = req.params;
    const { decision, verified } = req.body;

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
            car: bundle.car,
          });
        });
      }
    );
  });
}

module.exports = { registerAdminReviewRoutes };
