function registerPaymentMethodRoutes(app, io, db) {
  app.get('/api/payment-methods', (req, res) => {
    const { passenger_email } = req.query;
    db.query('SELECT id, passenger_email, card_name, card_number, expiry_date, created_at FROM payment_methods WHERE passenger_email = $1 ORDER BY created_at DESC', [passenger_email], (err, result) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json(result.rows);
    });
  });

  app.post('/api/payment-methods', (req, res) => {
    const { passenger_email, card_number, card_name, expiry_date, cvv } = req.body;
    db.query(
      'INSERT INTO payment_methods (passenger_email, card_number, card_name, expiry_date, cvv) VALUES ($1, $2, $3, $4, $5) RETURNING id, passenger_email, card_name, card_number, expiry_date',
      [passenger_email, card_number, card_name, expiry_date, cvv],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(result.rows[0]);
      }
    );
  });

  app.delete('/api/payment-methods/:id', (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM payment_methods WHERE id = $1', [id], (err, result) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json({ message: 'Payment method deleted' });
    });
  });
}

module.exports = { registerPaymentMethodRoutes };
