const {
  generateDeliveryId,
  generateVerificationCode,
  hashOtp,
  verifyOtp,
  sendDeliveryOtp
} = require('../utils/helpers');

// Helper function to update driver rating
function updateDriverRating(db, email) {
  db.query('SELECT AVG(rating) as avg_rating FROM ratings WHERE driver_email = $1', [email], (err, results) => {
    if (!err && results.rows.length > 0) {
      const avgRating = results.rows[0].avg_rating || 0;
      db.query('UPDATE users SET rating = $1 WHERE email = $2', [Math.round(avgRating * 10) / 10, email]);
    }
  });
}

// Helper function to update user rating
function updateUserRating(db, email) {
  db.query('SELECT AVG(rating) as avg_rating FROM ratings WHERE user_email = $1', [email], (err, results) => {
    if (!err && results.rows.length > 0) {
      const avgRating = results.rows[0].avg_rating || 0;
      db.query('UPDATE users SET rating = $1 WHERE email = $2', [Math.round(avgRating * 10) / 10, email]);
    }
  });
}

// Register ride, rating, favorites and payment endpoints
function registerRidesRoutes(app, io, db) {
  // === RIDES ===

  // Get rides
  app.get('/api/rides', (req, res) => {
    const { passenger_email, driver_email, status } = req.query;
    let query = 'SELECT * FROM rides';
    let conditions = [];
    let params = [];

    if (passenger_email) { params.push(passenger_email); conditions.push(`passenger_email = $${params.length}`); }
    if (driver_email) { params.push(driver_email); conditions.push(`driver_email = $${params.length}`); }
    if (status) {
      const statusArray = status.split(',');
      statusArray.forEach(s => { params.push(s); });
      conditions.push('status IN (' + statusArray.map((_, i) => `$${params.length - statusArray.length + 1 + i}`).join(',') + ')');
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    db.query(query, params, (err, results) => {
      if (err) {
        console.error('Error fetching rides:', err);
        return res.status(500).json({ error: 'Failed to fetch rides' });
      }
      res.json(results.rows);
    });
  });

  // Active rides
  app.get('/api/active-rides', (req, res) => {
    const { driver_email } = req.query;
    if (!driver_email) return res.status(400).json({ error: 'driver_email is required' });

    db.query('SELECT * FROM rides WHERE driver_email = $1 AND status IN ($2, $3, $4) ORDER BY created_at DESC', [driver_email, 'accepted', 'active', 'driver_accepted'], (err, results) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch active rides' });
      res.json(results.rows);
    });
  });

  // Get ride by ID
  app.get('/api/rides/:id', (req, res) => {
    const rideId = req.params.id;

    db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Ride not found' });
      res.json(results.rows[0]);
    });
  });

  // Completed & cancelled rides
  app.get('/api/completed-rides', (req, res) => {
    const { driver_email } = req.query;
    if (!driver_email) return res.status(400).json({ error: 'driver_email is required' });

    db.query('SELECT * FROM rides WHERE driver_email = $1 AND status IN ($2, $3) ORDER BY created_at DESC', [driver_email, 'completed', 'cancelled'], (err, results) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch completed/cancelled rides' });
      res.json(results.rows);
    });
  });

  // POST new ride
  app.post('/api/rides', (req, res) => {
    console.log('Ride request received:', req.body);

    const { passenger_email, passenger_name, passenger_phone, pickup, dropoff, pickup_location, dropoff_location, ride_type, price, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, package_type, package_size, package_details, special_instructions, vehicle_type, inter_city, receiver_name, receiver_phone, receiver_email } = req.body;

    // Support both field names (pickup/dropoff OR pickup_location/dropoff_location)
    const pickupLoc = pickup || pickup_location;
    const dropoffLoc = dropoff || dropoff_location;

    if (
      !passenger_name ||
      !passenger_name.trim() ||
      !passenger_email?.trim() ||
      !passenger_phone?.trim() ||
      !pickupLoc?.trim() ||
      !dropoffLoc?.trim() ||
      !ride_type?.trim() ||
      typeof price !== 'number' ||
      !receiver_name?.trim() ||
      !receiver_email?.trim() ||
      !receiver_phone?.trim()
    ) {
      console.log('Missing required fields validation failed:', {
        passenger_name,
        passenger_email,
        passenger_phone,
        pickupLoc,
        dropoffLoc,
        ride_type,
        price,
        receiver_name,
        receiver_email,
        receiver_phone,
        priceType: typeof price
      });

      return res.status(400).json({
        error: 'Please provide all required fields including receiver details'
      });
    }

    // Validate numeric price
    const priceFloat = parseFloat(price);
    if (isNaN(priceFloat) || priceFloat < 0) {
      return res.status(400).json({ error: 'Price must be a valid positive number' });
    }

    // Validate numeric coordinates
    const pickLat = pickup_lat ? parseFloat(pickup_lat) : null;
    const pickLng = pickup_lng ? parseFloat(pickup_lng) : null;
    const dropLat = dropoff_lat ? parseFloat(dropoff_lat) : null;
    const dropLng = dropoff_lng ? parseFloat(dropoff_lng) : null;

    // First get the passenger's user ID and name from the users table
    const getUserQuery = 'SELECT id, first_name, last_name FROM public.users WHERE email = $1';
    db.query(getUserQuery, [passenger_email], (errUser, userResults) => {
      let passengerId = null;
      let passengerName = passenger_name;
      if (userResults && userResults.rows.length > 0) {
        passengerId = userResults.rows[0].id;
        if (!passengerName || !passengerName.trim()) {
          const fn = userResults.rows[0].first_name || '';
          const ln = userResults.rows[0].last_name || '';
          passengerName = (fn + ' ' + ln).trim() || 'Passenger';
        }
      }
      if (!passengerName || !passengerName.trim()) {
        passengerName = 'Passenger';
      }

// Insert with passenger_id foreign key and package details
       const query = 'INSERT INTO rides (passenger_id, passenger_email, passenger_name, passenger_phone, pickup_location, dropoff_location, ride_type, price, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, package_type, package_size, package_details, special_instructions, vehicle_type, receiver_name, receiver_phone, receiver_email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING id';
       const values = [passengerId, passenger_email, passengerName, passenger_phone, pickupLoc, dropoffLoc, ride_type, price, 'pending', pickLat, pickLng, dropLat, dropLng, package_type || null, package_size || null, package_details || null, special_instructions || null, vehicle_type || null, receiver_name || null, receiver_phone || null, receiver_email || null];

      db.query(query, values, (err, result) => {
        if (err) {
          console.error('=== DATABASE ERROR ===');
          console.error('Query:', query);
          console.error('Values:', values);
          console.error('Error:', err);
          console.error('Error Code:', err.code);
          console.error('Error Detail:', err.detail);
          console.error('Error Hint:', err.hint);
          return res.status(500).json({ error: 'Failed to save ride', details: err.message });
        }

        console.log('Ride created with ID:', result.rows[0].id);
        const rideId = result.rows[0].id;

        // Generate delivery ID and OTP (async IIFE to handle await)
        (async () => {
          const deliveryId = generateDeliveryId();
          const otp = generateVerificationCode();
          const otpHash = await hashOtp(otp);
          const otpExpires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

          // Update ride with delivery ID and OTP
db.query('UPDATE rides SET delivery_id = $1, delivery_otp_hash = $2, delivery_otp_expires_at = $3 WHERE id = $4',
               [deliveryId, otpHash, otpExpires, rideId], (errUpdate) => {
               if (errUpdate) {
                 console.error('Error updating delivery ID and OTP:', errUpdate.message);
               }
             });

           // Send OTP to receiver (if provided) or passenger
           const otpRecipient = receiver_email || passenger_email;
           sendDeliveryOtp(otpRecipient, otp, deliveryId);

           const newRide = {
            id: rideId,
            delivery_id: deliveryId,
            passenger_name: passenger_name,
            passenger_email: passenger_email,
            passenger_phone: passenger_phone,
            pickup_location: pickup,
            dropoff_location: dropoff,
            pickup_lat: pickup_lat,
            pickup_lng: pickup_lng,
            dropoff_lat: dropoff_lat,
            dropoff_lng: dropoff_lng,
            ride_type: ride_type,
            price: price,
            status: 'pending',
            package_type: package_type || null,
            package_size: package_size || null,
            package_details: package_details || null,
            special_instructions: special_instructions || null,
            vehicle_type: vehicle_type || null,
            inter_city: inter_city || null,
            receiver_name: receiver_name || null,
            receiver_phone: receiver_phone || null,
            receiver_email: receiver_email || null,
            created_at: new Date().toISOString()
          };

          // Emit to all online drivers
          console.log('Emitting newRide to onlineDrivers room');
          io.to("onlineDrivers").emit("newRide", newRide);
          console.log('Emitting rideCreated to passenger:', passenger_email);
          io.to(passenger_email).emit('rideCreated', newRide);

          res.status(201).json({ message: 'Ride booked successfully', rideId, ride: newRide });
        })();
      });
    });
  });

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

      // Check if ride has expired (older than 60 seconds for pending rides)
      if (ride.status === 'pending') {
        const createdAt = new Date(ride.created_at);
        const now = new Date();
        const secondsDiff = (now - createdAt) / 1000;
        if (secondsDiff > 60) {
          // Ride expired, mark as cancelled
          db.query('UPDATE rides SET status = $1 WHERE id = $2', ['cancelled', rideId]);
          io.emit('rideUpdated', { id: rideId, status: 'cancelled', reason: 'expired' });
          return res.status(400).json({ error: 'Ride request has expired' });
        }
      }

      // Get driver's user_id and vehicle from users table, then get car details from cars table
      console.log('=== ACCEPT RIDE DEBUG ===');
      console.log('Driver email from socket:', email);
      console.log('Driver name from socket:', name);
      console.log('Driver phone from socket:', phone);
      console.log('Driver vehicle from socket:', vehicle);

      const userQuery = `SELECT id, first_name, phone FROM public.users WHERE email = $1`;
      db.query(userQuery, [email], (errUser, userResults) => {
        console.log('User query error:', errUser);
        console.log('User query results:', userResults);

        // Store values in outer scope to avoid closure issues
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

          // Use first_name from users table
          if (userFirstName) {
            driverName = name || userFirstName;
          }

          // Use phone from users table if not provided
          if (userPhone && !driverPhone) {
            driverPhone = userPhone;
          }

          // Use JOIN to get car details from cars table and driver location from driver_profiles
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

              // Get vehicle details from cars table
              if (result.plate_number || result.make || result.model) {
                vehicleDetails = `${result.plate_number || ''} ${result.make || ''} ${result.model || ''} ${result.year || ''}`.trim();
                console.log('Car found - make:', result.make, 'model:', result.model, 'plate:', result.plate_number);
              } else {
                console.log('No car found for user_id:', driverUserId);
              }

              // Get driver location from driver_profiles table
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

             // Update rides with driver_id, vehicle, name and location
             db.query('UPDATE rides SET driver_id=$1, driver_name=$2, driver_email=$3, driver_phone=$4, driver_vehicle=$5, driver_lat=$6, driver_lng=$7, status=$8, driver_assigned=true WHERE id=$9',
               [driverUserId, driverName, email, driverPhone, vehicleDetails, driverLat, driverLng, 'driver_accepted', rideId], (err2) => {
              if (err2) {
                console.error('UPDATE rides error:', err2);
                return res.status(500).json({ error: 'Failed to accept ride', details: err2.message });
              }

              // Notify passenger with FULL ride payload
              const passengerRidePayload = {
                ...ride,
                id: rideId,
                status: 'driver_accepted',
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

              // Notify accepting driver with FULL ride payload too, plus broadcast to other drivers
              const driverRidePayload = {
                ...ride,
                id: rideId,
                status: 'driver_accepted',
                driver_name: driverName,
                driver_email: email,
                driver_phone: driverPhone,
                driver_vehicle: vehicleDetails,
                driver_id: driverUserId,
                driver_lat: driverLat,
                driver_lng: driverLng,
                driver_rating: driverRating
              };
              io.to('onlineDrivers').emit('rideUpdated', { id: rideId, status: 'driver_accepted', driver_email: email, driver_name: driverName });
              if (email) io.to(email).emit('rideUpdated', driverRidePayload);

              res.json({ message: 'Ride accepted successfully', rideId });
            });
          });
        } else {
          // No user found, use basic info
          db.query('UPDATE rides SET driver_name=$1, driver_email=$2, driver_phone=$3, driver_vehicle=$4, status=$5, driver_assigned=true WHERE id=$6',
            [driverName, email, driverPhone, vehicleDetails, 'driver_accepted', rideId], (err2) => {
            if (err2) {
              console.error('UPDATE rides error (no user):', err2);
              return res.status(500).json({ error: 'Failed to accept ride', details: err2.message });
            }

            const passengerRidePayloadNoUser = {
              ...ride,
              id: rideId,
              status: 'driver_accepted',
              driver_name: driverName,
              driver_email: email,
              driver_phone: driverPhone,
              driver_vehicle: vehicleDetails
            };
            io.to(ride.passenger_email).emit('rideUpdated', passengerRidePayloadNoUser);

            io.to('onlineDrivers').emit('rideUpdated', { id: rideId, status: 'driver_accepted', driver_email: email, driver_name: driverName });

            res.json({ message: 'Ride accepted successfully', rideId });
          });
        }
      });
    });
  });

   // Passenger confirms driver acceptance - ride officially accepted
   app.post('/api/rides/:rideId/passenger-confirm', (req, res) => {
     const rideId = req.params.rideId;
     db.query('UPDATE rides SET status=$1 WHERE id=$2 AND status = $3', ['accepted', rideId, 'driver_accepted'], (err, result) => {
       if (err) {
         console.error('Error confirming ride:', err.message);
         return res.status(500).json({ error: "Server error" });
       }
       if (result.rowCount === 0) return res.status(400).json({ error: "Cannot confirm ride - may already be confirmed or cancelled" });

        db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err2, rides) => {
          if (err2) {
            console.error('Error getting ride details:', err2.message);
            return res.status(500).json({ error: "Server error" });
          }
          const ride = rides.rows[0];

          io.to(ride.passenger_email).emit('rideUpdated', {
            id: rideId,
            status: "accepted",
            passenger_confirmed: true,
            driver_name: ride.driver_name,
            driver_email: ride.driver_email,
            driver_phone: ride.driver_phone,
            driver_vehicle: ride.driver_vehicle,
            driver_lat: ride.driver_lat,
            driver_lng: ride.driver_lng,
            pickup_lat: ride.pickup_lat,
            pickup_lng: ride.pickup_lng,
            dropoff_lat: ride.dropoff_lat,
            dropoff_lng: ride.dropoff_lng,
            dropoff_location: ride.dropoff_location,
            pickup_location: ride.pickup_location
          });

          if (ride.driver_email) {
            io.to(ride.driver_email).emit('rideUpdated', {
              id: rideId,
              status: "accepted",
              passenger_confirmed: true,
              passenger_email: ride.passenger_email,
              pickup_lat: ride.pickup_lat,
              pickup_lng: ride.pickup_lng,
              pickup_location: ride.pickup_location,
              dropoff_lat: ride.dropoff_lat,
              dropoff_lng: ride.dropoff_lng,
              dropoff_location: ride.dropoff_location
            });
          }

          res.json({ message: "Ride confirmed successfully", rideId });
        });
     });
   });

   // Passenger confirms pickup - ride officially starts
   app.post('/api/rides/:id/confirm-pickup', (req, res) => {
    const rideId = req.params.id;
    db.query('UPDATE rides SET status=$1, confirmed_at = NOW() WHERE id=$2 AND status = $3', ['confirmed', rideId, 'completed'], (err, result) => {
      if (err) {
        console.error('Error confirming ride:', err.message);
        return res.status(500).json({ error: "Server error" });
      }
      if (result.rowCount === 0) return res.status(400).json({ error: "Cannot confirm ride - may already be confirmed" });

      db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err2, rides) => {
        if (err2) {
          console.error('Error getting ride details:', err2.message);
          return res.status(500).json({ error: "Server error" });
        }
        const ride = rides.rows[0];

        io.emit('rideUpdated', {
          id: rideId,
          status: "confirmed",
          passenger_confirmed_complete: true
        });

        if (ride.driver_email) {
          db.query('SELECT COALESCE(SUM(price), 0) as today FROM rides WHERE driver_email = $1 AND status IN ($2, $3) AND DATE(created_at) = CURRENT_DATE',
            [ride.driver_email, 'confirmed', 'completed'], (err3, earningsResult) => {
            const todayEarnings = earningsResult?.rows[0]?.today || 0;
            db.query('SELECT COUNT(*) as count FROM rides WHERE driver_email = $1 AND status IN ($2, $3)',
              [ride.driver_email, 'confirmed', 'completed'], (err4, countResult) => {
              const totalTrips = countResult?.rows[0]?.count || 0;
              io.to(ride.driver_email).emit('earningsUpdated', {
                driver_email: ride.driver_email,
                today_earnings: todayEarnings,
                total_trips: totalTrips
              });
            });
          });
        }

        res.json({ message: "Ride confirmed! Driver has been paid.", rideId });
      });
    });
  });

// Cancel ride
  app.post('/api/rides/:id/cancel', (req, res) => {
    const rideId = req.params.id;
    const cancelledBy = req.body?.cancelled_by;

    db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, results) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (results.rows.length === 0) return res.status(404).json({ error: "Ride not found" });

      const ride = results.rows[0];
      const cancelledByDriver = cancelledBy === ride.driver_email;
      const cancelledByPassenger = cancelledBy === ride.passenger_email;

      db.query('UPDATE rides SET status=$1, driver_assigned=false WHERE id=$2', ['cancelled', rideId], (err, result) => {
        if (err) return res.status(500).json({ error: "Server error" });
        if (result.rowCount === 0) return res.status(404).json({ error: "Ride not found" });

        if (cancelledByDriver && ride.passenger_email) {
          io.to(ride.passenger_email).emit('rideUpdated', { id: rideId, status: "cancelled", driver_assigned: false, cancelled_by: ride.driver_email });
        } else if (cancelledByPassenger && ride.driver_email) {
          io.to(ride.driver_email).emit('rideUpdated', { id: rideId, status: "cancelled", driver_assigned: false, cancelled_by: ride.passenger_email });
        } else if (cancelledByPassenger && !ride.driver_email) {
          io.to('onlineDrivers').emit('rideUpdated', { id: rideId, status: "cancelled", driver_assigned: false });
        }

        res.json({ message: "Ride cancelled successfully", rideId, cancelled_by: cancelledBy });
      });
    });
  });

  // Driver location update
  app.post('/api/rides/:id/driver-location', (req, res) => {
    const rideId = req.params.id;
    const { lat, lng } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: "Latitude and longitude required" });

    db.query('UPDATE rides SET driver_lat=$1, driver_lng=$2 WHERE id=$3 AND driver_assigned=true AND status IN ($4,$5,$6)', [lat, lng, rideId, 'accepted', 'active', 'driver_accepted'], (err, result) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (result.rowCount === 0) return res.status(400).json({ error: "Cannot update location" });
      io.emit('driverLocationUpdated', { rideId, lat, lng });
      res.json({ message: "Driver location updated", rideId });
    });
  });

  // Start ride - driver begins delivery immediately after acceptance
  app.post('/api/rides/:id/start', (req, res) => {
    const rideId = req.params.id;
    db.query("UPDATE rides SET status = 'active' WHERE id = $1 AND status IN ($2, $3)", [rideId, 'accepted', 'driver_accepted'], (err, result) => {
      if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
      if (result.rowCount === 0) return res.status(400).json({ error: 'Cannot start ride - ride may not be accepted' });

      db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, rides) => {
        if (err || !rides || rides.rows.length === 0) {
          io.emit('rideUpdated', { id: rideId, status: 'active' });
          return res.json({ message: 'Ride started', rideId });
        }

        const ride = rides.rows[0];
        io.emit('rideUpdated', {
          id: ride.id,
          status: 'active',
          passenger_email: ride.passenger_email,
          pickup: ride.pickup_location,
          dropoff: ride.dropoff_location,
          driver_email: ride.driver_email,
          driver_name: ride.driver_name,
          driver_phone: ride.driver_phone,
          driver_vehicle: ride.driver_vehicle,
          price: ride.price,
        });
        io.emit('dispatchUpdated', {
          id: ride.id,
          status: 'active',
          passenger_email: ride.passenger_email,
          driver_email: ride.driver_email,
        });
        res.json({ message: 'Ride started', rideId });
      });
    });
  });

  // Confirm pickup - package picked up, ride begins (Stage 6)
  app.post('/api/rides/:id/confirm-pickup', (req, res) => {
    const rideId = req.params.id;
    db.query('UPDATE rides SET status = \'active\' WHERE id = $1 AND status = \'arrived_pickup\'', [rideId], (err, result) => {
      if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
      if (result.rowCount === 0) return res.status(400).json({ error: 'Cannot start ride - driver has not arrived at pickup' });

      db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, rides) => {
        if (err || !rides || rides.rows.length === 0) {
          io.emit('rideUpdated', { id: rideId, status: 'active' });
          return res.json({ message: 'Ride started', rideId });
        }

        const ride = rides.rows[0];
        io.emit('rideUpdated', {
          id: ride.id,
          status: 'active',
          passenger_email: ride.passenger_email,
          pickup: ride.pickup_location,
          dropoff: ride.dropoff_location,
          driver_email: ride.driver_email,
          driver_name: ride.driver_name,
          driver_phone: ride.driver_phone,
          driver_vehicle: ride.driver_vehicle,
          price: ride.price,
        });
        io.emit('dispatchUpdated', {
          id: ride.id,
          status: 'active',
          passenger_email: ride.passenger_email,
          driver_email: ride.driver_email,
        });
        res.json({ message: 'Package picked up, ride started', rideId });
      });
    });
  });

  // Driver arriving at destination (Stage 8)
  app.post('/api/rides/:id/arrive', (req, res) => {
    const rideId = req.params.id;
    db.query('UPDATE rides SET status = \'arriving\' WHERE id = $1 AND status = \'active\'', [rideId], (err, result) => {
      if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
      if (result.rowCount === 0) return res.status(400).json({ error: 'Cannot mark as arriving - ride is not active' });

      db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, rides) => {
        if (err || !rides || rides.rows.length === 0) {
          io.emit('rideUpdated', { id: rideId, status: 'arriving' });
          return res.json({ message: 'Arriving at destination', rideId });
        }

        const ride = rides.rows[0];
        io.emit('rideUpdated', {
          id: ride.id,
          status: 'arriving',
          passenger_email: ride.passenger_email,
          pickup: ride.pickup_location,
          dropoff: ride.dropoff_location,
          driver_email: ride.driver_email,
          driver_name: ride.driver_name,
          driver_phone: ride.driver_phone,
          driver_vehicle: ride.driver_vehicle,
          price: ride.price,
        });
        io.emit('dispatchUpdated', {
          id: ride.id,
          status: 'arriving',
          passenger_email: ride.passenger_email,
          driver_email: ride.driver_email,
        });
        res.json({ message: 'Arriving at destination', rideId });
      });
    });
  });

  // Verify OTP and complete delivery
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

      if (ride.status !== 'active' && ride.status !== 'arriving') {
        return res.status(400).json({ error: 'Ride must be in active or arriving status to complete' });
      }

      if (!ride.delivery_otp_hash) {
        return res.status(400).json({ error: 'No OTP configured for this delivery' });
      }

      // Check if OTP has expired
      if (ride.delivery_otp_expires_at && new Date(ride.delivery_otp_expires_at) < new Date()) {
        return res.status(400).json({ error: 'OTP has expired' });
      }

      // Check retry attempts
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

        // OTP verified - complete the delivery
        const completionLocation = req.body.completion_location || {};
        const completedAt = new Date();

        db.query(
          'UPDATE rides SET status = $1, price = COALESCE($2, price), completed_at = NOW(), delivery_completed_at = NOW(), delivery_completed_lat = $3, delivery_completed_lng = $4 WHERE id = $5 AND status IN ($6, $7)',
          ['completed', ride.price, completionLocation.lat || null, completionLocation.lng || null, rideId, 'active', 'arriving'],
          (err2, result2) => {
            if (err2) return res.status(500).json({ error: 'Server error' });
            if (result2.rowCount === 0) return res.status(400).json({ error: 'Cannot complete ride' });

            io.emit('rideUpdated', { id: rideId, status: 'completed' });

            // Emit to passenger
            if (ride.passenger_email) {
              io.to(ride.passenger_email).emit('rideCompleted', { id: rideId, status: 'completed' });
            }

            // Emit to driver
            if (ride.driver_email) {
              io.to(ride.driver_email).emit('rideCompleted', { id: rideId, status: 'completed' });
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

  // === RATINGS ===

  // Submit rating after ride
  app.post('/api/rides/:id/rate', (req, res) => {
    const rideId = req.params.id;
    const { rating, comment, rated_by } = req.body; // rated_by: 'passenger' or 'driver'

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Get ride details first
    db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Ride not found' });

      const ride = results.rows[0];

      if (rated_by === 'passenger') {
        // Passenger rating for driver
        db.query('INSERT INTO ratings (ride_id, user_email, driver_email, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
          [rideId, ride.passenger_email, ride.driver_email, rating, comment || ''], (err2) => {
          if (err2) return res.status(500).json({ error: 'Failed to save rating' });

          // Update driver's average rating
          updateDriverRating(db, ride.driver_email);
          res.json({ message: 'Rating submitted successfully' });
        });
      } else if (rated_by === 'driver') {
        // Driver rating for passenger
        db.query('INSERT INTO ratings (ride_id, driver_email, user_email, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
          [rideId, ride.driver_email, ride.passenger_email, rating, comment || ''], (err2) => {
          if (err2) return res.status(500).json({ error: 'Failed to save rating' });

          // Update passenger's average rating
          updateUserRating(db, ride.passenger_email);
          res.json({ message: 'Rating submitted successfully' });
        });
      } else {
        return res.status(400).json({ error: 'Invalid rated_by value' });
      }
    });
  });

  // Favorites endpoints
  app.get('/api/favorites', (req, res) => {
    const { passenger_email } = req.query;
    db.query('SELECT * FROM favorites WHERE passenger_email = $1 ORDER BY created_at DESC', [passenger_email], (err, result) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json(result.rows);
    });
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

  // Payment methods endpoints
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

module.exports = { registerRidesRoutes };
