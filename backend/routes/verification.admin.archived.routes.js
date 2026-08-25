const { requireAdmin } = require('./verification.helpers');

function registerAdminArchivedRoutes(app, db) {
  app.get('/api/admin/drivers/archived', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    db.query(
      `SELECT id, email, first_name, last_name, phone, decision, reviewer_email, notes, id_document, selfie, phone_verification, bank_account, car, withdrawals, id_document_history, selfie_history, phone_history, bank_history, archived_at
       FROM driver_verification_archive ORDER BY archived_at DESC`,
      [],
      (err, results) => {
        if (err) return res.status(500).json({ error: 'Failed to load archived drivers' });
        res.json(results.rows);
      }
    );
  });

  app.get('/api/admin/drivers/archived/:id', (req, res) => {
    const guard = requireAdmin(req, res);
    if (!guard.ok) return guard.res;

    const { id } = req.params;
    db.query(
      `SELECT id, user_id, email, first_name, last_name, phone, decision, reviewer_email, notes, id_document, selfie, phone_verification, bank_account, car, withdrawals, id_document_history, selfie_history, phone_history, bank_history, archived_at
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
          car: row.car ? JSON.parse(row.car) : null,
          withdrawals: row.withdrawals ? JSON.parse(row.withdrawals) : [],
          id_document_history: row.id_document_history ? JSON.parse(row.id_document_history) : [],
          selfie_history: row.selfie_history ? JSON.parse(row.selfie_history) : [],
          phone_history: row.phone_history ? JSON.parse(row.phone_history) : [],
          bank_history: row.bank_history ? JSON.parse(row.bank_history) : [],
        });
      }
    );
  });
}

module.exports = { registerAdminArchivedRoutes };
