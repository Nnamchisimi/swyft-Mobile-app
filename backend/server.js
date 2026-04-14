const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = require('./db-supabase');

const app = express();
app.use(cors());
app.use(express.json());

const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("joinRoom", (email) => socket.join(email));
  socket.on("leaveRoom", (email) => socket.leave(email));
  
  // Driver goes online - join drivers room and store location
  socket.on("driverOnline", (data) => {
    console.log('driverOnline event received:', data.email);
    // Join the online drivers room for receiving ride requests
    socket.join("onlineDrivers");
    // Also join a room with their email for personal messages
    socket.join(data.email);
    socket.driverEmail = data.email;
    socket.driverLocation = data.location;
    
    console.log('Driver joined onlineDrivers room');
    
    // Update driver_profiles table with online status and location
    const query = `
      INSERT INTO driver_profiles (user_id, is_online, current_lat, current_lng)
      SELECT id, true, $1, $2 FROM users WHERE email = $3
      ON CONFLICT (user_id) DO UPDATE SET is_online = true, current_lat = EXCLUDED.current_lat, current_lng = EXCLUDED.current_lng
    `;
    db.query(query, [data.location?.lat || null, data.location?.lng || null, data.email], (err) => {
      if (err) console.error('Error updating driver online status:', err);
    });
    
    console.log(`Driver ${data.email} is now online at ${data.location?.lat}, ${data.location?.lng}`);
    
    // Notify all passengers about available driver
    io.emit('driverStatusChanged', { email: data.email, isOnline: true, location: data.location });
  });
  
  // Driver goes offline
  socket.on("driverOffline", (email) => {
    socket.leave("onlineDrivers");
    
    // Update driver_profiles table with offline status
    db.query(`
      UPDATE driver_profiles dp
      SET is_online = false, current_lat = NULL, current_lng = NULL
      FROM users u
      WHERE dp.user_id = u.id AND u.email = $1
    `, [email], (err) => {
      if (err) console.error('Error updating driver offline status:', err);
    });
    
    console.log(`Driver ${email} is now offline`);
    
    // Notify all passengers
    io.emit('driverStatusChanged', { email, isOnline: false });
  });
  
  // Driver location update (real-time tracking)
  socket.on("updateDriverLocation", (data) => {
    socket.driverLocation = data.location;
    
    // Update driver_profiles table
    db.query(`
      UPDATE driver_profiles dp
      SET current_lat = $1, current_lng = $2
      FROM users u
      WHERE dp.user_id = u.id AND u.email = $3
    `, 
      [data.location?.lat, data.location?.lng, data.email], (err) => {
      if (err) console.error('Error updating driver location:', err);
    });
    
    // Emit to online drivers room
    io.to("onlineDrivers").emit("driverLocationUpdate", data);
    
    // Also emit to specific passenger if they have an active ride
    if (data.rideId) {
      // Get passenger email for this ride
      db.query('SELECT passenger_email FROM rides WHERE id = $1', [data.rideId], (err, results) => {
        if (results && results.rows.length > 0) {
          const passengerEmail = results.rows[0].passenger_email;
          // Send to specific passenger room
          io.to(passengerEmail).emit('driverLocationUpdated', { 
            rideId: data.rideId, 
            lat: data.location.lat, 
            lng: data.location.lng,
            status: data.status
          });
        }
      });
    }
  });
  
  // Passenger sends location update (for driver to see on map)
  socket.on("passengerLocationUpdate", (data) => {
    const { email, location, rideId } = data;
    
    console.log('Received passenger location update:', data);
    
    // Also emit to specific driver if they have an active ride
    if (data.rideId) {
      // Get driver email for this ride
      db.query('SELECT driver_email FROM rides WHERE id = $1', [data.rideId], (err, results) => {
        if (results && results.rows.length > 0) {
          const driverEmail = results.rows[0].driver_email;
          // Send to specific driver room
          io.to(driverEmail).emit('passengerLocationUpdated', { 
            rideId: data.rideId, 
            lat: data.location.lat, 
            lng: data.location.lng 
          });
          console.log('Emitting passengerLocationUpdated to driver:', driverEmail);
        }
      });
    }
  });
  
  // Driver heartbeat to maintain connection status
  socket.on("driverHeartbeat", (data) => {
    if (socket.driverEmail) {
      db.query('UPDATE users SET last_active = NOW() WHERE email = $1', [socket.driverEmail], (err) => {
        if (err) console.error('Error updating driver heartbeat:', err);
      });
    }
  });
  
  // New ride request - broadcast to all online drivers with countdown
  socket.on("newRide", (ride) => {
    // Add created timestamp for countdown
    ride.createdAt = new Date().toISOString();
    ride.expiresAt = new Date(Date.now() + 15000).toISOString(); // 15 seconds countdown
    
    io.to("onlineDrivers").emit("newRide", ride);
    io.emit("newRide", ride);
  });
  
  socket.on("rideUpdated", (ride) => {
    io.emit("rideUpdated", ride);
    if (ride.passenger_email) io.to(ride.passenger_email).emit("rideUpdated", ride);
    if (ride.driver_email) io.to(ride.driver_email).emit("rideUpdated", ride);
  });
  
  socket.on("driverLocationUpdated", (data) => io.emit("driverLocationUpdated", data));
  
  socket.on("disconnect", () => {
    if (socket.driverEmail) {
      socket.leave("onlineDrivers");
      console.log(`Driver ${socket.driverEmail} disconnected`);
    }
    console.log("Client disconnected");
  });
});

// Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// Health check route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Swyft API is running',
    database: 'Supabase PostgreSQL',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: 'Supabase PostgreSQL',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// === PRICING CONFIG ===
app.get('/api/pricing', (req, res) => {
  res.json({
    locationPrices: {
      economy: 100,
      standard: 150,
      luxury: 250
    },
    vehiclePrices: {
      motorcycle: 50,
      sedan: 150,
      truck: 400
    },
    currency: 'TL'
  });
});

// === SIGNUP ===
app.post('/api/users', async (req, res) => {
  console.log('Registration request received:', req.body);
  
  const { 
    first_name, 
    last_name, 
    email, 
    password, 
    role, 
    phone, 
    vehicle_make,
    vehicle_model,
    vehicle_year,
    vehicle_color,
    vehicle_plate 
  } = req.body;
  
  if (!first_name || !last_name || !email || !password || !role)
    return res.status(400).json({ error: 'Missing required fields', missing: {!first_name ? 'first_name' : !last_name ? 'last_name' : !email ? 'email' : !password ? 'password' : !role ? 'role' : ''} });

  if (role === 'driver' && (!vehicle_make || !vehicle_model || !vehicle_plate))
    return res.status(400).json({ error: 'Vehicle details required for drivers' });

  const normalizedRole = (role || 'passenger');
  
  // Capitalize first letter to match database format
  const dbRole = normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
  
  db.query('SELECT id FROM users WHERE email = $1', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
    if (results.rows.length > 0) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user - specify public schema to avoid auth.users conflict
    const userQuery = 'INSERT INTO public.users (first_name, last_name, email, password, role, phone, is_verified, verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, role';
    const userValues = [first_name, last_name, email, hashedPassword, dbRole, phone || null, true, true];

    db.query(userQuery, userValues, (err2, result) => {
      if (err2) {
        console.log('User insert error:', err2.message);
        return res.status(500).json({ error: 'Failed to create user', details: err2.message });
      }

      const userId = result.rows[0].id;
      const userRole = result.rows[0].role;
      
      console.log('User created:', userId, 'Role:', userRole);

      // If driver, insert car details (check case-insensitive)
      if (userRole && userRole.toLowerCase() === 'driver') {
        const carQuery = 'INSERT INTO cars (user_id, make, model, year, color, plate_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
        const carValues = [userId, vehicle_make, vehicle_model, vehicle_year || '2020', vehicle_color || 'White', vehicle_plate];
        
        db.query(carQuery, carValues, (err3, carResult) => {
          if (err3) console.log('Car insert error (may be missing table):', err3.message);
          else {
            db.query('UPDATE users SET vehicle_id = $1 WHERE id = $2', [carResult.rows[0].id, userId]);
          }
        });

        // Create driver profile for tracking online status and location
        const driverProfileQuery = 'INSERT INTO driver_profiles (user_id, is_online, rating, total_trips) VALUES ($1, false, 5.0, 0)';
        db.query(driverProfileQuery, [userId], (err4) => {
          if (err4) console.log('Driver profile error (may be missing table):', err4.message);
        });
      }

      const token = jwt.sign({ id: userId, email, role }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({ 
        message: 'User created successfully', 
        token,
        first_name,
        last_name,
        email,
        role,
        phone,
        vehicle_make,
        vehicle_model,
        vehicle_year,
        vehicle_color,
        vehicle_plate
      });
    });
  });
});

// === VERIFY EMAIL ===
app.get('/api/users/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.send('<h3>Invalid verification link</h3>');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    db.query('SELECT * FROM email_verification_tokens WHERE token = $1 AND expires_at > NOW()', [token], (err, results) => {
      if (err || results.rows.length === 0) return res.send('<h3>Invalid or expired token</h3>');

      const userId = decoded.id;
      db.query('UPDATE users SET is_verified = true WHERE id = $1', [userId], (err2) => {
        if (err2) return res.send('<h3>Failed to verify email</h3>');

        db.query('DELETE FROM email_verification_tokens WHERE token = $1', [token]);
        res.redirect('http://localhost:3003/signin');
      });
    });
  } catch {
    res.send('<h3>Invalid or expired token</h3>');
  }
});

// === LOGIN ===
app.post('/api/users/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  db.query('SELECT * FROM users WHERE email = $1', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = results.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // If driver, get car details
    if (user.role && user.role.toLowerCase() === 'driver') {
      db.query('SELECT * FROM cars WHERE user_id = $1', [user.id], (err2, carResults) => {
        const car = carResults && carResults.rows.length > 0 ? carResults.rows[0] : null;
        res.json({
          token,
          id: user.id,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone: user.phone,
          vehicle: car ? `${car.year} ${car.make} ${car.model}` : null,
          vehicle_make: car ? car.make : null,
          vehicle_model: car ? car.model : null,
          vehicle_year: car ? car.year : null,
          vehicle_color: car ? car.color : null,
          vehicle_plate: car ? car.plate_number : null
        });
      });
    } else {
      res.json({
        token,
        id: user.id,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone
      });
    }
  });
});

// === USER PROFILE ===
app.get('/api/user/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    db.query('SELECT id, first_name, last_name, email, phone, vehicle_plate, role FROM users WHERE id = $1', [decoded.id], (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const user = results.rows[0];
      res.json({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        vehicle: user.vehicle_plate,
        role: user.role
      });
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// GET all drivers
app.get('/api/drivers', (req, res) => {
  db.query('SELECT id, first_name, last_name, email, phone, vehicle_plate FROM users WHERE role = $1', ['driver'], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch drivers' });
    res.json(results.rows);
  });
});

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

  db.query('SELECT * FROM rides WHERE driver_email = $1 AND status IN ($2, $3) ORDER BY created_at DESC', [driver_email, 'accepted', 'active'], (err, results) => {
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
  
  const { passengerName, passengerEmail, passengerPhone, pickup, dropoff, rideType, ridePrice, pickupLat, pickupLng, dropoffLat, dropoffLng, packageType, packageSize, packageDetails, specialInstructions, vehicleType } = req.body;
  
  if (!passengerName || !passengerEmail || !passengerPhone || !pickup || !dropoff || !rideType || ridePrice == null) {
    console.log('Missing required fields');
    return res.status(400).json({ error: 'Please provide all required fields' });
  }

  // First get the passenger's user ID from the users table
  const getUserQuery = 'SELECT id FROM users WHERE email = $1';
  db.query(getUserQuery, [passengerEmail], (errUser, userResults) => {
    let passengerId = null;
    if (userResults && userResults.rows.length > 0) {
      passengerId = userResults.rows[0].id;
    }
    
    // Insert with passenger_id foreign key and package details
    const query = 'INSERT INTO rides (passenger_id, passenger_name, passenger_email, passenger_phone, pickup_location, dropoff_location, ride_type, price, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, package_type, package_size, package_details, special_instructions, vehicle_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id';
    const values = [passengerId, passengerName, passengerEmail, passengerPhone, pickup, dropoff, rideType, ridePrice, 'pending', pickupLat || null, pickupLng || null, dropoffLat || null, dropoffLng || null, packageType || null, packageSize || null, packageDetails || null, specialInstructions || null, vehicleType || null];
  
  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to save ride', details: err.message });
    }
    
    console.log('Ride created with ID:', result.rows[0].id);
    const rideId = result.rows[0].id;
    
    const newRide = { 
      id: rideId, 
      passenger_name: passengerName, 
      passenger_email: passengerEmail, 
      passenger_phone: passengerPhone, 
      pickup_location: pickup, 
      dropoff_location: dropoff, 
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      dropoff_lat: dropoffLat,
      dropoff_lng: dropoffLng,
      ride_type: rideType, 
      price: ridePrice, 
      status: 'pending', 
      package_type: packageType || null,
      package_size: packageSize || null,
      package_details: packageDetails || null,
      special_instructions: specialInstructions || null,
      vehicle_type: vehicleType || null,
      created_at: new Date().toISOString() 
    };
    
    // Emit to all online drivers
    console.log('Emitting newRide to onlineDrivers room');
    io.to('onlineDrivers').emit('newRide', newRide);
    console.log('Emitting rideCreated to passenger:', passengerEmail);
    io.to(passengerEmail).emit('rideCreated', newRide);
    
    res.status(201).json({ message: 'Ride booked successfully', rideId, ride: newRide });
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
    
    const userQuery = `SELECT id, first_name, phone FROM users WHERE email = $1`;
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
              [driverUserId, driverName, email, driverPhone, vehicleDetails, driverLat, driverLng, 'accepted', rideId], (err2) => {
              if (err2) {
                console.error('UPDATE rides error:', err2);
                return res.status(500).json({ error: 'Failed to accept ride', details: err2.message });
              }
              
              // Get full ride details including pickup location
              db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err4, rideResults) => {
                if (rideResults && rideResults.rows.length > 0) {
                  const ride = rideResults.rows[0];
                  const passengerEmail = ride.passenger_email;
                  console.log('Emitting rideUpdated to passenger room:', passengerEmail);
                  // Emit to specific passenger room
                  io.to(passengerEmail).emit('rideUpdated', { 
                    id: rideId, 
                    passenger_email: passengerEmail,
                    status: 'accepted', 
                    driver_name: driverName, 
                    driver_email: email, 
                    driver_phone: driverPhone,
                    driver_vehicle: vehicleDetails,
                    driver_id: driverUserId,
                    driver_lat: driverLat,
                    driver_lng: driverLng,
                    driver_rating: driverRating,
                    pickup_lat: ride.pickup_lat,
                    pickup_lng: ride.pickup_lng
                  });
                } else {
                  console.log('Could not find ride details for ride:', rideId);
                }
              });
              
              // Also broadcast to all clients
              console.log('Broadcasting rideUpdated to all clients');
              io.emit('rideUpdated', { 
                id: rideId, 
                status: 'accepted', 
                driver_name: driverName, 
                driver_email: email, 
                driver_phone: driverPhone,
                driver_vehicle: vehicleDetails, 
                driver_id: driverUserId,
                driver_lat: driverLat,
                driver_lng: driverLng,
                driver_rating: driverRating,
                pickup_lat: null,
                pickup_lng: null
              });
              res.json({ message: 'Ride accepted successfully', rideId });
            });
          });
      } else {
        // No user found, use basic info
        db.query('UPDATE rides SET driver_name=$1, driver_email=$2, driver_phone=$3, driver_vehicle=$4, status=$5, driver_assigned=true WHERE id=$6',
          [driverName, email, driverPhone, vehicleDetails, 'accepted', rideId], (err2) => {
          if (err2) {
            console.error('UPDATE rides error (no user):', err2);
            return res.status(500).json({ error: 'Failed to accept ride', details: err2.message });
          }
          io.emit('rideUpdated', { id: rideId, status: 'accepted', driver_name: driverName, driver_email: email, driver_vehicle: vehicleDetails });
          res.json({ message: 'Ride accepted successfully', rideId });
        });
      }
    });
  });
});

// Start ride
app.post('/api/rides/:id/start', (req,res)=>{
  const rideId = req.params.id;
  // Accept both 'accepted' and 'active' status, and work even without driver_assigned flag
  db.query('UPDATE rides SET status=$1 WHERE id=$2 AND status IN ($3, $4)', ['active', rideId, 'accepted', 'active'], (err, result)=>{
    if(err) return res.status(500).json({error:"Server error"});
    if(result.rowCount===0) return res.status(400).json({error:"Cannot start ride - ride may already be in progress or completed"});
    io.emit('rideUpdated',{id:rideId,status:"active"});
    io.emit('dispatchUpdated',{id:rideId,status:"active"});
    res.json({message:"Ride started", rideId});
  });
});

// Complete ride - driver marks as complete, but passenger must confirm
app.post('/api/rides/:id/complete', (req,res)=>{
  const rideId = req.params.id;
  const { final_price } = req.body;
  // Driver completes ride - status is 'completed' but passenger needs to confirm
  db.query('UPDATE rides SET status=$1, price = COALESCE($2, price), completed_at = NOW() WHERE id=$3 AND status IN ($4, $5)', ['completed', final_price, rideId, 'accepted', 'active'], (err,result)=>{
    if(err) return res.status(500).json({error:"Server error"});
    if(result.rowCount===0) return res.status(400).json({error:"Cannot complete ride"});
    io.emit('rideUpdated',{id:rideId,status:"completed"});
    io.emit('dispatchUpdated',{id:rideId,status:"completed"});
    res.json({message:"Ride marked as completed. Waiting for passenger confirmation.", rideId});
  });
});

// Passenger confirms ride completion - this is when driver gets earnings
app.post('/api/rides/:id/confirm', (req,res)=>{
  const rideId = req.params.id;
  // Passenger confirms the ride is complete - driver now gets earnings
  db.query('UPDATE rides SET status=$1, confirmed_at = NOW() WHERE id=$2 AND status = $3', ['confirmed', rideId, 'completed'], (err,result)=>{
    if(err) {
      console.error('Error confirming ride:', err.message);
      return res.status(500).json({error:"Server error"});
    }
    if(result.rowCount===0) return res.status(400).json({error:"Cannot confirm ride - may already be confirmed"});
    
    // Get ride details to emit with confirmation
    db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err2, rides) => {
      if (err2) {
        console.error('Error getting ride details:', err2.message);
        return res.status(500).json({error:"Server error"});
      }
      const ride = rides.rows[0];
      
      // Emit ride updated with confirmation
      io.emit('rideUpdated',{
        id:rideId,
        status:"confirmed",
        passenger_confirmed: true
      });
      
      // Emit earnings updated to the specific driver
      if (ride.driver_email) {
        db.query('SELECT COALESCE(SUM(price), 0) as today FROM rides WHERE driver_email = $1 AND status IN ($2, $3, $4) AND DATE(created_at) = CURRENT_DATE',
          [ride.driver_email, 'completed', 'confirmed', 'active'], (err3, earningsResult) => {
            const todayEarnings = earningsResult?.rows[0]?.today || 0;
            db.query('SELECT COUNT(*) as count FROM rides WHERE driver_email = $1 AND status IN ($2, $3, $4)',
              [ride.driver_email, 'completed', 'confirmed', 'active'], (err4, countResult) => {
                const totalTrips = countResult?.rows[0]?.count || 0;
                io.to(ride.driver_email).emit('earningsUpdated', {
                  driver_email: ride.driver_email,
                  today_earnings: todayEarnings,
                  total_trips: totalTrips
                });
              });
          });
      }
      
      res.json({message:"Ride confirmed! Driver has been notified.", rideId});
    });
  });
});


// Cancel ride
app.post('/api/rides/:id/cancel', (req,res)=>{
  const rideId = req.params.id;
  db.query('UPDATE rides SET status=$1, driver_assigned=false WHERE id=$2', ['cancelled', rideId], (err,result)=>{
    if(err) return res.status(500).json({error:"Server error"});
    if(result.rowCount===0) return res.status(404).json({error:"Ride not found"});
    io.emit('rideUpdated',{id:rideId,status:"cancelled", driver_assigned:false});
    res.json({message:"Ride cancelled successfully", rideId});
  });
});

// Driver location update
app.post('/api/rides/:id/driver-location', (req,res)=>{
  const rideId = req.params.id;
  const { lat, lng } = req.body;
  if(lat==null||lng==null) return res.status(400).json({error:"Latitude and longitude required"});

  db.query('UPDATE rides SET driver_lat=$1, driver_lng=$2 WHERE id=$3 AND driver_assigned=true AND status IN ($4,$5)', [lat,lng,rideId,'accepted','active'], (err,result)=>{
    if(err) return res.status(500).json({error:"Server error"});
    if(result.rowCount===0) return res.status(400).json({error:"Cannot update location"});
    io.emit('driverLocationUpdated',{rideId,lat,lng});
    res.json({message:"Driver location updated",rideId});
  });
});

// === DRIVER STATUS ===

// Set driver online/offline status
app.post('/api/drivers/status', (req, res) => {
  const { email, is_online, lat, lng } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const query = `
    UPDATE driver_profiles dp
    SET is_online = $1, current_lat = $2, current_lng = $3
    FROM users u
    WHERE dp.user_id = u.id AND u.email = $4
  `;
  db.query(query, [is_online ? true : false, lat || null, lng || null, email], (err, result) => {
    if (err) return res.status(500).json({ error: 'Failed to update driver status' });
    res.json({ message: `Driver is now ${is_online ? 'online' : 'offline'}`, is_online });
  });
});

// Get nearby online drivers
app.get('/api/drivers/nearby', (req, res) => {
  const { lat, lng, radius = 5 } = req.query; // radius in km
  
  if (!lat || !lng) {
    // Return all online drivers if no location specified
    db.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, dp.rating, dp.is_online, dp.current_lat, dp.current_lng
      FROM users u
      JOIN driver_profiles dp ON u.id = dp.user_id
      WHERE LOWER(u.role) = $1 AND dp.is_online = true
    `, ['driver'], (err, results) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch drivers' });
      res.json(results);
    });
    return;
  }

  // Calculate nearby drivers using Haversine formula (simplified)
  const query = `
    SELECT u.id, u.first_name, u.last_name, u.email, u.phone, dp.rating, dp.is_online, dp.current_lat, dp.current_lng,
    (6371 * acos(cos(radians(?)) * cos(radians(dp.current_lat)) * cos(radians(dp.current_lng) - radians(?)) + sin(radians(?)) * sin(radians(dp.current_lat)))) AS distance
    FROM users u
    JOIN driver_profiles dp ON u.id = dp.user_id
    WHERE LOWER(u.role) = 'driver' AND dp.is_online = true AND dp.current_lat IS NOT NULL
    HAVING distance < ?
    ORDER BY distance
  `;
  
  db.query(query, [parseFloat(lat), parseFloat(lng), parseFloat(lat), parseFloat(radius)], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch nearby drivers' });
    res.json(results);
  });
});

// Get driver earnings - must be defined BEFORE /api/drivers/:email to avoid route conflicts
app.get('/api/drivers/earnings', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  console.log('Fetching earnings for:', email);
  
  // Include multiple completed statuses: completed, confirmed, active (in case completed but not confirmed)
  const completedStatuses = ['completed', 'confirmed', 'active'];
  const statusList = completedStatuses.map(s => "'" + s + "'").join(',');

  // Get total earnings
  const simpleQuery = `SELECT COALESCE(SUM(price), 0) as total FROM rides WHERE driver_email = $1 AND status IN (${statusList})`;
  db.query(simpleQuery, [email], (err, results) => {
    if (err) {
      console.log('Earnings query error:', err.message);
      return res.json({ today_earnings: 0, total_earnings: 0, total_trips: 0, recent_rides: [] });
    }
    const total = results.rows[0]?.total || 0;
    
    // Get today's earnings
    const todayQuery = `SELECT COALESCE(SUM(price), 0) as today FROM rides WHERE driver_email = $1 AND status IN (${statusList}) AND DATE(created_at) = CURRENT_DATE`;
    db.query(todayQuery, [email], (err2, todayResults) => {
      if (err2) {
        console.log('Today earnings query error:', err2.message);
      }
      const today = todayResults.rows[0]?.today || 0;
      
      // Get this week's earnings (last 7 days)
      const weekQuery = `SELECT COALESCE(SUM(price), 0) as week FROM rides WHERE driver_email = $1 AND status IN (${statusList}) AND created_at >= CURRENT_DATE - INTERVAL '7 days'`;
      db.query(weekQuery, [email], (errWeek, weekResults) => {
        if (errWeek) {
          console.log('Week earnings query error:', errWeek.message);
        }
        const week = weekResults.rows[0]?.week || 0;
        
        // Get this month's earnings
        const monthQuery = `SELECT COALESCE(SUM(price), 0) as month FROM rides WHERE driver_email = $1 AND status IN (${statusList}) AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
        db.query(monthQuery, [email], (errMonth, monthResults) => {
          if (errMonth) {
            console.log('Month earnings query error:', errMonth.message);
          }
          const month = monthResults.rows[0]?.month || 0;
          
          // Get trip count
          const countQuery = `SELECT COUNT(*) as count FROM rides WHERE driver_email = $1 AND status IN (${statusList})`;
          db.query(countQuery, [email], (err3, countResults) => {
            if (err3) {
              console.log('Count query error:', err3.message);
            }
            const trips = countResults.rows[0]?.count || 0;
            
            // Get recent rides
            const recentRidesQuery = `
              SELECT r.id, r.passenger_name, r.price, r.status, r.created_at, 
                     r.pickup_location, r.dropoff_location
              FROM rides r 
              WHERE r.driver_email = $1 AND r.status IN (${statusList})
              ORDER BY r.created_at DESC 
              LIMIT 10
            `;
            db.query(recentRidesQuery, [email], (err4, ridesResults) => {
              if (err4) {
                console.log('Recent rides query error:', err4.message);
              }
              const recentRides = ridesResults?.rows || [];
              
              res.json({ 
                today_earnings: today, 
                total_earnings: total, 
                total_trips: trips, 
                week_earnings: week,
                month_earnings: month,
                recent_rides: recentRides
              });
            });
          });
        });
      });
    });
  });
});

// Get driver stats (today's trips and earnings) - must be defined BEFORE /api/drivers/:email
app.get('/api/drivers/stats', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Include multiple completed statuses
  const completedStatuses = ['completed', 'confirmed', 'active'];
  
  try {
    // Get today's stats
    const statsQuery = `
      SELECT 
        COUNT(*) as today_trips,
        COALESCE(SUM(price), 0) as today_earnings
      FROM rides 
      WHERE driver_email = $1 AND status IN (${completedStatuses.map(s => `'${s}'`).join(',')}) 
      AND DATE(created_at) = CURRENT_DATE
    `;
    db.query(statsQuery, [email], (err, results) => {
      if (err) {
        console.log('Stats query error:', err.message);
        return res.json({ today_trips: 0, today_earnings: 0 });
      }
      res.json({ 
        today_trips: results.rows[0]?.today_trips || 0, 
        today_earnings: results.rows[0]?.today_earnings || 0 
      });
    });
  } catch (e) {
    console.log('Stats catch error:', e.message);
    res.json({ today_trips: 0, today_earnings: 0 });
  }
});

// Get driver info by email
app.get('/api/drivers/:email', (req, res) => {
  const { email } = req.params;
  console.log(`[DEBUG] Fetching driver info for email: ${email}`);
  
  db.query(`
    SELECT u.id, u.first_name, u.last_name, u.email, u.phone, dp.rating, dp.is_online,
           c.make, c.model, c.year, c.color, c.plate_number, 
           u.vehicle_plate, u.vehicle_id
    FROM users u
    LEFT JOIN driver_profiles dp ON u.id = dp.user_id
    LEFT JOIN cars c ON (u.vehicle_id = c.id OR u.id = c.user_id)
    WHERE u.email = $1 AND LOWER(u.role) = 'driver'
  `, [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch driver info', details: err.message });
    if (results.rows.length === 0) {
      console.log(`[DEBUG] Driver not found for email: ${email}`);
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    const driver = results.rows[0];
    
    // If no car data from cars table, try to parse from vehicle_plate column
    if (!driver.make && driver.vehicle_plate) {
      // Parse vehicle_plate like "kj234 Mercedes-Benz C class 2021"
      const plateMatch = driver.vehicle_plate.match(/^([A-Za-z0-9]+)\s+(.+?)\s+(\d{4})$/);
      if (plateMatch) {
        driver.plate_number = plateMatch[1];
        const vehicleInfo = plateMatch[2].split(' ');
        driver.make = vehicleInfo[0];
        driver.model = vehicleInfo.slice(1).join(' ');
        driver.year = plateMatch[3];
        driver.color = 'White';
      } else {
        driver.plate_number = driver.vehicle_plate;
        driver.make = 'Unknown';
        driver.model = 'Unknown';
        driver.year = 'Unknown';
        driver.color = 'Unknown';
      }
    }
    
    console.log(`[DEBUG] Driver info found:`, JSON.stringify(driver));
    res.json(driver);
  });
});

// Get passenger info
app.get('/api/passengers/:email', (req, res) => {
  const { email } = req.params;
  
  db.query('SELECT id, first_name, last_name, email, phone, rating FROM users WHERE email = $1', [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch passenger info' });
    if (results.rows.length === 0) return res.status(404).json({ error: 'Passenger not found' });
    res.json(results.rows[0]);
  });
});

// === FARE CALCULATION ===

app.post('/api/fare/calculate', (req, res) => {
  const { distance_km, ride_type, vehicle_type } = req.body;
  
  // Base prices for locations
  const locationPrices = {
    economy: 100,
    standard: 150,
    luxury: 250
  };
  
  // Vehicle type prices
  const vehiclePrices = {
    motorcycle: 50,
    sedan: 150,
    truck: 400
  };
  
  const locationPrice = ride_type ? (locationPrices[ride_type] || 0) : 0;
  const vehiclePrice = vehicle_type ? (vehiclePrices[vehicle_type] || 0) : 0;
  
  const totalFare = locationPrice + vehiclePrice;
  
  res.json({
    location_price: locationPrice,
    vehicle_price: vehiclePrice,
    total_fare: totalFare,
    currency: 'TL'
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
        updateDriverRating(ride.driver_email);
        res.json({ message: 'Rating submitted successfully' });
      });
    } else if (rated_by === 'driver') {
      // Driver rating for passenger
      db.query('INSERT INTO ratings (ride_id, driver_email, user_email, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5, NOW())', 
        [rideId, ride.driver_email, ride.passenger_email, rating, comment || ''], (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to save rating' });
        
        // Update passenger's average rating
        updateUserRating(ride.passenger_email);
        res.json({ message: 'Rating submitted successfully' });
      });
    } else {
      return res.status(400).json({ error: 'Invalid rated_by value' });
    }
  });
});

// Helper function to update driver rating
function updateDriverRating(email) {
  db.query('SELECT AVG(rating) as avg_rating FROM ratings WHERE driver_email = $1', [email], (err, results) => {
    if (!err && results.rows.length > 0) {
      const avgRating = results.rows[0].avg_rating || 0;
      db.query('UPDATE users SET rating = $1 WHERE email = $2', [Math.round(avgRating * 10) / 10, email]);
    }
  });
}

// Helper function to update user rating
function updateUserRating(email) {
  db.query('SELECT AVG(rating) as avg_rating FROM ratings WHERE user_email = $1', [email], (err, results) => {
    if (!err && results.rows.length > 0) {
      const avgRating = results.rows[0].avg_rating || 0;
      db.query('UPDATE users SET rating = $1 WHERE email = $2', [Math.round(avgRating * 10) / 10, email]);
    }
  });
}

// === ARRIVE AND START RIDE ===

// Driver arrives at pickup
app.post('/api/rides/:id/arrive', (req, res) => {
  const rideId = req.params.id;
  console.log('=== ARRIVE ENDPOINT ===');
  console.log('rideId:', rideId);
  // First get the ride to include all details in the socket emit
  db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, rides) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (!rides || rides.rows.length === 0) return res.status(400).json({ error: 'Ride not found' });
    
    const ride = rides.rows[0];
    console.log('Ride found, current status:', ride.status);
    // Use 'active' status when driver arrives at pickup - use 'active' instead of 'arrived' since it's not in the enum
    db.query('UPDATE rides SET status = \'active\' WHERE id = $1 AND (status = \'accepted\' OR status = \'active\')', [rideId], (err, result) => {
      if (err) {
        console.log('SQL Error:', err.message);
        return res.status(500).json({ error: 'Server error: ' + err.message });
      }
      console.log('Update result:', result);
      if (result.rowCount === 0) {
        console.log('No rows updated - status was:', ride.status);
        return res.status(400).json({ error: 'Cannot mark as arrived - ride may already be in progress or completed' });
      }
      
      // Emit ride updated with all ride details including driver info
      // Use correct column names: pickup_location, dropoff_location
      io.emit('rideUpdated', {
        id: ride.id,
        status: 'active', // Send 'active' to frontend
        passenger_email: ride.passenger_email,
        pickup: ride.pickup_location,
        pickup_lat: ride.pickup_lat,
        pickup_lng: ride.pickup_lng,
        dropoff: ride.dropoff_location,
        dropoff_lat: ride.dropoff_lat,
        dropoff_lng: ride.dropoff_lng,
        driver_email: ride.driver_email,
        driver_name: ride.driver_name,
        driver_phone: ride.driver_phone,
        driver_vehicle: ride.driver_vehicle,
        driver_rating: ride.driver_rating,
        price: ride.price,
      });
      io.emit('dispatchUpdated', {
        id: ride.id,
        status: 'active',
        passenger_email: ride.passenger_email,
        driver_email: ride.driver_email,
      });
      res.json({ message: 'Driver arrived at pickup', rideId });
    });
  });
});

// Start ride (after passenger boards)
app.post('/api/rides/:id/start', (req, res) => {
  const rideId = req.params.id;
  // Database uses 'active' status, update to 'active'
  db.query('UPDATE rides SET status = \'active\' WHERE id = $1 AND status IN (\'accepted\', \'active\')', [rideId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
    if (result.rowCount === 0) return res.status(400).json({ error: 'Cannot start ride - ride may already be in progress or completed' });
    
    // Get ride details for socket emit
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

// Complete ride
app.post('/api/rides/:id/complete', (req, res) => {
  const rideId = req.params.id;
  const { final_price } = req.body;
  
  db.query('UPDATE rides SET status = \'completed\', price = COALESCE($1, price), completed_at = NOW() WHERE id = $2 AND status = \'active\'', [final_price, rideId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (result.rowCount === 0) return res.status(400).json({ error: 'Cannot complete ride' });
    io.emit('rideUpdated', { id: rideId, status: 'completed' });
    res.json({ message: 'Ride completed', rideId });
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

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));