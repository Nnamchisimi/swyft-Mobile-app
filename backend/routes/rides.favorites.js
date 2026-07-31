function registerFavoriteRoutes(app, io, db) {
  app.get('/api/favorites', (req, res) => {
    const { passenger_email } = req.query;
    if (!passenger_email) return res.status(400).json({ error: 'passenger_email is required' });
    db.query(
      `SELECT dropoff_location, COUNT(*) AS visit_count
       FROM rides
       WHERE passenger_email = $1 AND status IN ('completed','picked_up','active','confirmed')
       GROUP BY dropoff_location
       ORDER BY visit_count DESC
       LIMIT 5`,
      [passenger_email],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(result.rows);
      }
    );
  });

  app.post('/api/favorites', (req, res) => {
    const { passenger_email, name, pickup_location, dropoff_location, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = req.body;
    db.query(
      'INSERT INTO favorites (passenger_email, name, pickup_location, dropoff_location, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [passenger_email, name, pickup_location, dropoff_location, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(result.rows[0]);
      }
    );
  });

  app.delete('/api/favorites/:id', (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM favorites WHERE id = $1', [id], (err, result) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json({ message: 'Favorite deleted' });
    });
  });
}

module.exports = { registerFavoriteRoutes };
