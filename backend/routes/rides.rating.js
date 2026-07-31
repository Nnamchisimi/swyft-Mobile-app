function registerRatingRoutes(app, io, db) {
  app.post('/api/rides/:id/rate', (req, res) => {
    const rideId = req.params.id;
    const { rating, comment, rated_by } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Ride not found' });

      const ride = results.rows[0];

      if (rated_by === 'passenger') {
        db.query('INSERT INTO ratings (ride_id, user_email, driver_email, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
          [rideId, ride.passenger_email, ride.driver_email, rating, comment || ''], (err2) => {
          if (err2) return res.status(500).json({ error: 'Failed to save rating' });

          updateDriverRating(db, ride.driver_email);
          res.json({ message: 'Rating submitted successfully' });
        });
      } else if (rated_by === 'driver') {
        db.query('INSERT INTO ratings (ride_id, driver_email, user_email, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
          [rideId, ride.driver_email, ride.passenger_email, rating, comment || ''], (err2) => {
          if (err2) return res.status(500).json({ error: 'Failed to save rating' });

          updateUserRating(db, ride.passenger_email);
          res.json({ message: 'Rating submitted successfully' });
        });
      } else {
        return res.status(400).json({ error: 'Invalid rated_by value' });
      }
    });
  });
}

module.exports = { registerRatingRoutes };
