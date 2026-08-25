const { generateDeliveryId, generateVerificationCode, hashOtp, sendDeliveryOtp } = require('../utils/helpers');

function registerCreateRoutes(app, io, db) {
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
        return res.status(500).json({ error: 'Failed to fetch rides', details: err.message });
      }
      res.json(results.rows);
    });
  });

  // Active rides
  app.get('/api/active-rides', (req, res) => {
    const { driver_email } = req.query;
    if (!driver_email) return res.status(400).json({ error: 'driver_email is required' });

    db.query('SELECT * FROM rides WHERE driver_email = $1 AND status IN ($2, $3, $4) ORDER BY created_at DESC', [driver_email, 'accepted', 'active', 'accepted'], (err, results) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch active rides' });
      res.json(results.rows);
    });
  });

  // Get ride by ID
  app.get('/api/rides/:id', (req, res) => {
    const rideId = req.params.id;

    db.query(`SELECT
        r.id, r.passenger_email, r.driver_email, r.status, r.pickup_location, r.dropoff_location,
        r.pickup_lat, r.pickup_lng, r.dropoff_lat, r.dropoff_lng, r.price, r.ride_type,
        r.package_type, r.package_size, r.package_details, r.package_image_url, r.special_instructions,
        r.vehicle_type, r.receiver_name, r.receiver_phone, r.receiver_email,
        r.created_at, r.updated_at, r.delivery_id, r.delivery_otp_plain, r.delivery_otp_expires_at,
        r.driver_id, r.driver_name, r.driver_phone, r.driver_vehicle, r.driver_lat, r.driver_lng,
        c.make, c.model, c.year, c.color, c.plate_number, c.image_url AS vehicle_image_url
      FROM rides r
      LEFT JOIN cars c ON c.user_id = r.driver_id
      WHERE r.id = $1`, [rideId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Ride not found' });

      const ride = results.rows[0];
      if (ride.driver_id && (ride.make || ride.model || ride.plate_number)) {
        ride.vehicle = {
          make: ride.make,
          model: ride.model,
          year: ride.year,
          color: ride.color,
          plate: ride.plate_number,
          image_url: ride.vehicle_image_url,
        };
        delete ride.make;
        delete ride.model;
        delete ride.year;
        delete ride.color;
        delete ride.plate_number;
        delete ride.vehicle_image_url;
      }

      res.json(ride);
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

    const { passenger_email, passenger_name, passenger_phone, pickup, dropoff, pickup_location, dropoff_location, ride_type, price, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, package_type, package_size, package_details, special_instructions, vehicle_type, receiver_name, receiver_phone, receiver_email, payment_method, package_image_url } = req.body;

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

    const priceFloat = parseFloat(price);
    if (isNaN(priceFloat) || priceFloat < 0) {
      return res.status(400).json({ error: 'Price must be a valid positive number' });
    }

    const pickLat = pickup_lat ? parseFloat(pickup_lat) : null;
    const pickLng = pickup_lng ? parseFloat(pickup_lng) : null;
    const dropLat = dropoff_lat ? parseFloat(dropoff_lat) : null;
    const dropLng = dropoff_lng ? parseFloat(dropoff_lng) : null;

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

      const query = 'INSERT INTO rides (passenger_id, passenger_email, passenger_name, passenger_phone, pickup_location, dropoff_location, ride_type, price, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, package_type, package_size, package_details, package_image_url, special_instructions, vehicle_type, receiver_name, receiver_phone, receiver_email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING id';
      const values = [passengerId, passenger_email, passengerName, passenger_phone, pickupLoc, dropoffLoc, ride_type, price, 'pending', pickLat, pickLng, dropLat, dropLng, package_type || null, package_size || null, package_details || null, package_image_url || null, special_instructions || null, vehicle_type || null, receiver_name || null, receiver_phone || null, receiver_email || null];

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

        (async () => {
          const deliveryId = generateDeliveryId();
          const otp = generateVerificationCode();
          const otpHash = await hashOtp(otp);
          const otpExpires = new Date(Date.now() + 2 * 60 * 60 * 1000);

          db.query('UPDATE rides SET delivery_id = $1, delivery_otp_hash = $2, delivery_otp_expires_at = $3, delivery_otp_plain = $4 WHERE id = $5',
                   [deliveryId, otpHash, otpExpires, otp, rideId], (errUpdate) => {
                   if (errUpdate) {
                     console.error('Error updating delivery ID and OTP:', errUpdate.message);
                   }
                 });

          const otpRecipient = receiver_email || passenger_email;
          sendDeliveryOtp(otpRecipient, otp, deliveryId);

          const newRide = {
            id: rideId,
            delivery_id: deliveryId,
            delivery_otp_plain: otp,
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
            receiver_name: receiver_name || null,
            receiver_phone: receiver_phone || null,
            receiver_email: receiver_email || null,
            created_at: new Date().toISOString()
          };

          if (payment_method !== 'card') {
            console.log('Emitting newRide to onlineDrivers room');
            io.to("onlineDrivers").emit("newRide", newRide);
          }
          console.log('Emitting rideCreated to passenger:', passenger_email);
          io.to(passenger_email).emit('rideCreated', newRide);

          res.status(201).json({ message: 'Ride booked successfully', rideId, ride: newRide });
        })();
      });
    });
  });
}

module.exports = { registerCreateRoutes };
