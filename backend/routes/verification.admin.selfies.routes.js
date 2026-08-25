const { requireAdmin, resolveImageRef } = require('./verification.helpers');

function registerAdminSelfieRoutes(app, db) {
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

  app.post('/api/admin/drivers/:email/selfie/review', (req, res) => {
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
}

module.exports = { registerAdminSelfieRoutes };
