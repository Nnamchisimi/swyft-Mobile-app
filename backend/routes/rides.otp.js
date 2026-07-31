const { generateVerificationCode, hashOtp, verifyOtp, sendDeliveryOtp } = require('../utils/helpers');

function registerOtpRoutes(app, io, db) {
  app.post('/api/rides/:id/verify-otp', (req, res) => {
    const rideId = req.params.id;
    const { otp } = req.body;

    if (!otp || otp.length !== 6) {
      return res.status(400).json({ error: 'Valid 6-digit OTP required' });
    }

    db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Ride not found' });

      const ride = results.rows[0];

      if (ride.status !== 'accepted' && ride.status !== 'picked_up' && ride.status !== 'arrived_dropoff') {
        return res.status(400).json({ error: 'Ride must be accepted, picked up, or arrived at dropoff to complete' });
      }

      if (!ride.delivery_otp_hash) {
        return res.status(400).json({ error: 'No OTP configured for this delivery' });
      }

      if (ride.delivery_otp_expires_at && new Date(ride.delivery_otp_expires_at) < new Date()) {
        return res.status(400).json({ error: 'OTP has expired' });
      }

      if (ride.delivery_otp_attempts >= 3) {
        db.query('UPDATE rides SET delivery_flagged = true WHERE id = $1', [rideId]);
        return res.status(403).json({ error: 'Too many failed attempts. Delivery flagged for review.' });
      }

      verifyOtp(otp, ride.delivery_otp_hash).then(async (isValid) => {
        if (!isValid) {
          const newAttempts = (ride.delivery_otp_attempts || 0) + 1;
          await db.query('UPDATE rides SET delivery_otp_attempts = $1 WHERE id = $2', [newAttempts, rideId]);
          return res.status(401).json({ error: 'Invalid OTP', attempts_remaining: 3 - newAttempts });
        }

        const completionLocation = req.body.completion_location || {};

        db.query(
          'UPDATE rides SET status = $1, price = COALESCE($2, price), completed_at = NOW(), delivery_completed_at = NOW(), delivery_completed_lat = $3, delivery_completed_lng = $4 WHERE id = $5 AND status IN ($6, $7, $8)',
          ['completed', ride.price, completionLocation.lat || null, completionLocation.lng || null, rideId, 'accepted', 'picked_up', 'arrived_dropoff'],
          (err2, result2) => {
            if (err2) return res.status(500).json({ error: 'Server error' });
            if (result2.rowCount === 0) return res.status(400).json({ error: 'Cannot complete ride' });

            io.emit('rideUpdated', { id: rideId, status: 'completed' });

            if (ride.passenger_email) {
              io.to(ride.passenger_email).emit('rideCompleted', { id: rideId, status: 'completed' });
            }

            if (ride.driver_email) {
              io.to(ride.driver_email).emit('rideCompleted', { id: rideId, status: 'completed' });

              db.query('SELECT COALESCE(SUM(price), 0) as today FROM rides WHERE driver_email = $1 AND status IN ($2, $3) AND DATE(created_at) = CURRENT_DATE',
                [ride.driver_email, 'completed', 'picked_up'], (err3, earningsResult) => {
                const todayEarnings = earningsResult?.rows[0]?.today || 0;
                db.query('SELECT COUNT(*) as count FROM rides WHERE driver_email = $1 AND status IN ($2, $3)',
                  [ride.driver_email, 'completed', 'picked_up'], (err4, countResult) => {
                  const totalTrips = countResult?.rows[0]?.count || 0;
                  io.to(ride.driver_email).emit('earningsUpdated', {
                    driver_email: ride.driver_email,
                    today_earnings: todayEarnings,
                    total_trips: totalTrips
                  });
                });
              });
            }

            res.json({ message: 'Delivery completed successfully', rideId });
          }
        );
      }).catch(err => {
        console.error('OTP verification error:', err);
        res.status(500).json({ error: 'OTP verification failed' });
      });
    });
  });

  app.post('/api/rides/:id/resend-otp', (req, res) => {
    const rideId = req.params.id;

    db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Ride not found' });

      const ride = results.rows[0];

      if (!ride.passenger_email) {
        return res.status(400).json({ error: 'No passenger email associated with this ride' });
      }

      (async () => {
        const otp = generateVerificationCode();
        const otpHash = await hashOtp(otp);
        const otpExpires = new Date(Date.now() + 2 * 60 * 60 * 1000);

        db.query('UPDATE rides SET delivery_otp_hash = $1, delivery_otp_expires_at = $2, delivery_otp_plain = $3, delivery_otp_attempts = 0 WHERE id = $4',
          [otpHash, otpExpires, otp, rideId], (errUpdate) => {
            if (errUpdate) {
              console.error('Error resending OTP:', errUpdate.message);
              return res.status(500).json({ error: 'Failed to resend OTP' });
            }

            const otpRecipient = ride.receiver_email || ride.passenger_email;
            sendDeliveryOtp(otpRecipient, otp, ride.delivery_id);

            res.json({ message: 'OTP resent successfully', email: otpRecipient });
          });
      })();
    });
  });
}

module.exports = { registerOtpRoutes };
