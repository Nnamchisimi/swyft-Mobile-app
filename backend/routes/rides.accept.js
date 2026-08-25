function registerAcceptRoutes(app, io, db) {
  app.post('/api/rides/:rideId/accept', (req, res) => {
    const rideId = req.params.rideId;
    const { name, email, phone, vehicle } = req.body;

    console.log('=== ACCEPT RIDE ENDPOINT ===');
    console.log('rideId:', rideId);
    console.log('Request body:', req.body);
    console.log('Driver name:', name);
    console.log('Driver email:', email);
    console.log('Driver phone:', phone);
    console.log('Driver vehicle:', vehicle);

    db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Ride not found' });

      const ride = results.rows[0];
      if (ride.driver_assigned) return res.status(400).json({ error: 'Ride already accepted' });

      const tryAccept = () => {
        console.log('=== ACCEPT RIDE DEBUG ===');
        console.log('Driver email:', email);
        console.log('Driver name:', name);
        console.log('Driver phone:', phone);
        console.log('Driver vehicle:', vehicle);

        const userQuery = `SELECT id, first_name, phone FROM public.users WHERE email = $1`;
        db.query(userQuery, [email], (errUser, userResults) => {
          console.log('User query error:', errUser);
          console.log('User query results:', userResults);

          let vehicleDetails = vehicle || '';
          let driverName = name || 'Driver';
          let driverPhone = phone || '';
          let driverUserId = null;

          if (userResults && userResults.rows.length > 0) {
            const userRecord = userResults.rows[0];
            driverUserId = userRecord.id;
            const userFirstName = userRecord.first_name;
            const userPhone = userRecord.phone;

            console.log('User record - id:', driverUserId, 'first_name:', userFirstName, 'phone:', userPhone);

            if (userFirstName) {
              driverName = name || userFirstName;
            }

            if (userPhone && !driverPhone) {
              driverPhone = userPhone;
            }

            const joinQuery = `
              SELECT
                c.make, c.model, c.year, c.color, c.plate_number,
                dp.current_lat, dp.current_lng, dp.rating
              FROM cars c
              LEFT JOIN driver_profiles dp ON c.user_id = dp.user_id
              WHERE c.user_id = $1
            `;

            console.log('>>> STEP 1: Querying cars and driver_profiles with user_id:', driverUserId);
            db.query(joinQuery, [driverUserId], (errJoin, joinResults) => {
              console.log('>>> JOIN query error:', errJoin);
              console.log('>>> JOIN results:', JSON.stringify(joinResults));

              let vehicleDetails = vehicle || '';
              let driverLat = null;
              let driverLng = null;
              let driverRating = null;

              if (joinResults && joinResults.rows.length > 0) {
                const result = joinResults.rows[0];

                if (result.plate_number || result.make || result.model) {
                  vehicleDetails = `${result.plate_number || ''} ${result.make || ''} ${result.model || ''} ${result.year || ''}`.trim();
                  console.log('Car found - make:', result.make, 'model:', result.model, 'plate:', result.plate_number);
                } else {
                  console.log('No car found for user_id:', driverUserId);
                }

                if (result.current_lat || result.current_lng) {
                  driverLat = result.current_lat;
                  driverLng = result.current_lng;
                  driverRating = result.rating;
                  console.log('Driver profile found - lat:', driverLat, 'lng:', driverLng, 'rating:', driverRating);
                } else {
                  console.log('No driver profile found for user_id:', driverUserId);
                }
              } else {
                console.log('No car or driver profile found for user_id:', driverUserId);
              }

              console.log('vehicleDetails set to:', vehicleDetails);
              console.log('Final values - driverName:', driverName, 'driverPhone:', driverPhone, 'vehicleDetails:', vehicleDetails, 'driverLat:', driverLat, 'driverLng:', driverLng);

              db.query('UPDATE rides SET driver_id=$1, driver_name=$2, driver_email=$3, driver_phone=$4, driver_vehicle=$5, driver_lat=$6, driver_lng=$7, status=$8, driver_assigned=true WHERE id=$9',
                [driverUserId, driverName, email, driverPhone, vehicleDetails, driverLat, driverLng, 'accepted', rideId], (err2) => {
                if (err2) {
                  console.error('UPDATE rides error:', err2);
                  return res.status(500).json({ error: 'Failed to accept ride', details: err2.message });
                }

                const passengerRidePayload = {
                  ...ride,
                  id: rideId,
                  status: 'accepted',
                  driver_name: driverName,
                  driver_email: email,
                  driver_phone: driverPhone,
                  driver_vehicle: vehicleDetails,
                  driver_id: driverUserId,
                  driver_lat: driverLat,
                  driver_lng: driverLng,
                  driver_rating: driverRating
                };
                io.to(ride.passenger_email).emit('rideUpdated', passengerRidePayload);

                const driverRidePayload = {
                  ...ride,
                  id: rideId,
                  status: 'accepted',
                  driver_name: driverName,
                  driver_email: email,
                  driver_phone: driverPhone,
                  driver_vehicle: vehicleDetails,
                  driver_id: driverUserId,
                  driver_lat: driverLat,
                  driver_lng: driverLng,
                  driver_rating: driverRating
                };
                io.to('onlineDrivers').emit('rideUpdated', { id: rideId, status: 'accepted', driver_email: email, driver_name: driverName });
                if (email) io.to(email).emit('rideUpdated', driverRidePayload);

                res.json({ message: 'Ride accepted successfully', rideId });
              });
            });
          } else {
            db.query('UPDATE rides SET driver_name=$1, driver_email=$2, driver_phone=$3, driver_vehicle=$4, status=$5, driver_assigned=true WHERE id=$6',
              [driverName, email, driverPhone, vehicleDetails, 'accepted', rideId], (err2) => {
              if (err2) {
                console.error('UPDATE rides error (no user):', err2);
                return res.status(500).json({ error: 'Failed to accept ride', details: err2.message });
              }

              const passengerRidePayloadNoUser = {
                ...ride,
                id: rideId,
                status: 'accepted',
                driver_name: driverName,
                driver_email: email,
                driver_phone: driverPhone,
                driver_vehicle: vehicleDetails
              };
              io.to(ride.passenger_email).emit('rideUpdated', passengerRidePayloadNoUser);

              io.to('onlineDrivers').emit('rideUpdated', { id: rideId, status: 'accepted', driver_email: email, driver_name: driverName });

              res.json({ message: 'Ride accepted successfully', rideId });
            });
          }
        });
      };

      if (ride.status === 'pending') {
        const createdAt = new Date(ride.created_at);
        const now = new Date();
        const secondsDiff = (now - createdAt) / 1000;
        const rideExpirySeconds = parseInt(process.env.RIDE_EXPIRY_SECONDS || '1800', 10);
        if (secondsDiff > rideExpirySeconds) {
          db.query('SELECT * FROM payments WHERE ride_id = $1 AND verified = true AND status = $2', [rideId, 'succeeded'], (errPay, paymentResults) => {
            const hasVerifiedPayment = !errPay && paymentResults.rows.length > 0;
            if (!hasVerifiedPayment) {
              console.log('Ride expired and no verified payment found, cancelling ride:', rideId);
              db.query('UPDATE rides SET status = $1 WHERE id = $2', ['cancelled', rideId]);
              io.emit('rideUpdated', { id: rideId, status: 'cancelled', reason: 'expired' });
              return res.status(400).json({ error: 'Ride request has expired' });
            } else {
              console.log('Ride has verified card payment, skipping expiration check for ride:', rideId);
              tryAccept();
            }
          });
          return;
        }
      }

      tryAccept();
    });
  });

  app.post('/api/rides/:rideId/passenger-confirm', (req, res) => {
    const rideId = req.params.rideId;
    db.query('SELECT id, status FROM rides WHERE id = $1', [rideId], (err, results) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (results.rows.length === 0) return res.status(404).json({ error: "Ride not found" });

      const ride = results.rows[0];
      if (ride.status === 'accepted' || ride.status === 'picked_up' || ride.status === 'completed') {
        return res.json({ message: "Ride already accepted", rideId });
      }

      db.query('UPDATE rides SET status=$1 WHERE id=$2', ['accepted', rideId], (err2) => {
        if (err2) return res.status(500).json({ error: "Server error" });

        db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err3, rides) => {
          if (err3) return res.status(500).json({ error: "Server error" });
          const updatedRide = rides.rows[0];

          io.to(updatedRide.passenger_email).emit('rideUpdated', {
            id: rideId,
            status: "accepted",
            passenger_confirmed: true,
            driver_name: updatedRide.driver_name,
            driver_email: updatedRide.driver_email,
            driver_phone: updatedRide.driver_phone,
            driver_vehicle: updatedRide.driver_vehicle,
            driver_lat: updatedRide.driver_lat,
            driver_lng: updatedRide.driver_lng,
            pickup_lat: updatedRide.pickup_lat,
            pickup_lng: updatedRide.pickup_lng,
            dropoff_lat: updatedRide.dropoff_lat,
            dropoff_lng: updatedRide.dropoff_lng,
            dropoff_location: updatedRide.dropoff_location,
            pickup_location: updatedRide.pickup_location
          });

          if (updatedRide.driver_email) {
            io.to(updatedRide.driver_email).emit('rideUpdated', {
              id: rideId,
              status: "accepted",
              passenger_confirmed: true,
              passenger_email: updatedRide.passenger_email,
              pickup_lat: updatedRide.pickup_lat,
              pickup_lng: updatedRide.pickup_lng,
              pickup_location: updatedRide.pickup_location,
              dropoff_lat: updatedRide.dropoff_lat,
              dropoff_lng: updatedRide.dropoff_lng,
              dropoff_location: updatedRide.dropoff_location
            });
          }

          res.json({ message: "Ride confirmed successfully", rideId });
        });
      });
    });
  });
}

module.exports = { registerAcceptRoutes };
