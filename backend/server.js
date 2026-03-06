const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("joinRoom", (email) => socket.join(email));
  socket.on("leaveRoom", (email) => socket.leave(email));
  
  socket.on("driverOnline", (data) => {
    console.log('driverOnline event received:', data.email);
    socket.join("onlineDrivers");
    socket.join(data.email);
    socket.driverEmail = data.email;
    socket.driverLocation = data.location;
    
    console.log('Driver joined onlineDrivers room');
    
    const query = `
      INSERT INTO driver_profiles (user_id, is_online, current_lat, current_lng)
      SELECT id, 1, ?, ? FROM users WHERE email = ?
      ON DUPLICATE KEY UPDATE is_online = 1, current_lat = VALUES(current_lat), current_lng = VALUES(current_lng)
    `;
    db.query(query, [data.location?.lat || null, data.location?.lng || null, data.email], (err) => {
      if (err) console.error('Error updating driver online status:', err);
    });
    
    console.log(`Driver ${data.email} is now online at ${data.location?.lat}, ${data.location?.lng}`);
    
    io.emit('driverStatusChanged', { email: data.email, isOnline: true, location: data.location });
  });
  
  socket.on("driverOffline", (email) => {
    socket.leave("onlineDrivers");
    
    db.query(`
      UPDATE driver_profiles dp
      JOIN users u ON dp.user_id = u.id
      SET dp.is_online = 0, dp.current_lat = NULL, dp.current_lng = NULL
      WHERE u.email = ?
    `, [email], (err) => {
      if (err) console.error('Error updating driver offline status:', err);
    });
    
    console.log(`Driver ${email} is now offline`);
    
    io.emit('driverStatusChanged', { email, isOnline: false });
  });
  
  socket.on("updateDriverLocation", (data) => {
    socket.driverLocation = data.location;
    
    db.query(`
      UPDATE driver_profiles dp
      JOIN users u ON dp.user_id = u.id
      SET dp.current_lat = ?, dp.current_lng = ?
      WHERE u.email = ?
    `, 
      [data.location?.lat, data.location?.lng, data.email], (err) => {
      if (err) console.error('Error updating driver location:', err);
    });
    
    // Emit to online drivers room
    io.to("onlineDrivers").emit("driverLocationUpdate", data);
    
    // Also emit to specific passenger if they have an active ride
    if (data.rideId) {
      db.query('SELECT passenger_email FROM rides WHERE id = ?', [data.rideId], (err, results) => {
        if (results && results.length > 0) {
          const passengerEmail = results[0].passenger_email;
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

  socket.on("passengerLocationUpdate", (data) => {
    const { email, location, rideId } = data;
    
    console.log('Received passenger location update:', data);
    
    // Also emit to specific driver if they have an active ride
    if (data.rideId) {
      db.query('SELECT driver_email FROM rides WHERE id = ?', [data.rideId], (err, results) => {
        if (results && results.length > 0) {
          const driverEmail = results[0].driver_email;
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
  
  socket.on("driverHeartbeat", (data) => {
    if (socket.driverEmail) {
      db.query('UPDATE users SET last_active = NOW() WHERE email = ?', [socket.driverEmail], (err) => {
        if (err) console.error('Error updating driver heartbeat:', err);
      });
    }
  });
  
  socket.on("newRide", (ride) => {
    ride.createdAt = new Date().toISOString();
    ride.expiresAt = new Date(Date.now() + 15000).toISOString();
    
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

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '123456789',
  database: process.env.DB_NAME || 'swyft',
  port: process.env.DB_PORT || 3306,
});

db.connect((err) => {
  if (err) return console.error('Database connection failed:', err.stack);
  console.log('Connected to MySQL database.');
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

app.post('/api/users', async (req, res) => {
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
    return res.status(400).json({ error: 'Missing required fields' });

  if (role === 'driver' && (!vehicle_make || !vehicle_model || !vehicle_plate))
    return res.status(400).json({ error: 'Vehicle details required for drivers' });

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (results.length > 0) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user first
    const userQuery = 'INSERT INTO users (first_name, last_name, email, password, role, phone, is_verified) VALUES (?, ?, ?, ?, ?, ?, 1)';
    const userValues = [first_name, last_name, email, hashedPassword, role, phone || null];

    db.query(userQuery, userValues, (err2, result) => {
      if (err2) return res.status(500).json({ error: 'Failed to create user', details: err2.message });

      const userId = result.insertId;

      if (role === 'driver') {
        const carQuery = 'INSERT INTO cars (user_id, make, model, year, color, plate_number) VALUES (?, ?, ?, ?, ?, ?)';
        const carValues = [userId, vehicle_make, vehicle_model, vehicle_year || '2020', vehicle_color || 'White', vehicle_plate];
        
        db.query(carQuery, carValues, (err3, carResult) => {
          if (err3) return res.status(500).json({ error: 'Failed to save vehicle details', details: err3.message });
          
          db.query('UPDATE users SET vehicle_id = ? WHERE id = ?', [carResult.insertId, userId]);
        });

        const driverProfileQuery = 'INSERT INTO driver_profiles (user_id, is_online, rating, total_trips) VALUES (?, 0, 5.0, 0)';
        db.query(driverProfileQuery, [userId], (err4) => {
          if (err4) console.error('Error creating driver profile:', err4);
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

app.get('/api/users/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.send('<h3>Invalid verification link</h3>');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    db.query('SELECT * FROM email_verification_tokens WHERE token = ? AND expires_at > NOW()', [token], (err, results) => {
      if (err || results.length === 0) return res.send('<h3>Invalid or expired token</h3>');

      const userId = decoded.id;
      db.query('UPDATE users SET is_verified = 1 WHERE id = ?', [userId], (err2) => {
        if (err2) return res.send('<h3>Failed to verify email</h3>');

        db.query('DELETE FROM email_verification_tokens WHERE token = ?', [token]);
        res.redirect('http://localhost:3003/signin');
      });
    });
  } catch {
    res.send('<h3>Invalid or expired token</h3>');
  }
});

app.post('/api/users/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    if (user.role === 'driver') {
      db.query('SELECT * FROM cars WHERE user_id = ?', [user.id], (err2, carResults) => {
        const car = carResults && carResults.length > 0 ? carResults[0] : null;
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

app.get('/api/user/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    db.query('SELECT id, first_name, last_name, email, phone, vehicle_plate, role FROM users WHERE id = ?', [decoded.id], (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (results.length === 0) return res.status(404).json({ error: 'User not found' });

      const user = results[0];
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

app.get('/api/drivers', (req, res) => {
  db.query('SELECT id, first_name, last_name, email, phone, vehicle_plate FROM users WHERE role = "Driver"', (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch drivers' });
    res.json(results);
  });
});

app.get('/api/rides', (req, res) => {
  const { passenger_email, driver_email, status } = req.query;
  let query = 'SELECT * FROM rides';
  let conditions = [];
  let params = [];

  if (passenger_email) { conditions.push('passenger_email = ?'); params.push(passenger_email); }
  if (driver_email) { conditions.push('driver_email = ?'); params.push(driver_email); }
  if (status) { 
    const statusArray = status.split(',');
    conditions.push('status IN (' + statusArray.map(() => '?').join(',') + ')');
    params.push(...statusArray);
  }

  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created_at DESC';

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error fetching rides:', err);
      return res.status(500).json({ error: 'Failed to fetch rides' });
    }
    res.json(results);
  });
});

app.get('/api/active-rides', (req, res) => {
  const { driver_email } = req.query;
  if (!driver_email) return res.status(400).json({ error: 'driver_email is required' });

  db.query('SELECT * FROM rides WHERE driver_email = ? AND status IN ("accepted","active") ORDER BY created_at DESC', [driver_email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch active rides' });
    res.json(results);
  });
});

app.get('/api/rides/:id', (req, res) => {
  const rideId = req.params.id;
  
  db.query('SELECT * FROM rides WHERE id = ?', [rideId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (results.length === 0) return res.status(404).json({ error: 'Ride not found' });
    res.json(results[0]);
  });
});

app.get('/api/completed-rides', (req, res) => {
  const { driver_email } = req.query;
  if (!driver_email) return res.status(400).json({ error: 'driver_email is required' });

  db.query('SELECT * FROM rides WHERE driver_email = ? AND status IN ("completed","cancelled") ORDER BY created_at DESC', [driver_email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch completed/cancelled rides' });
    res.json(results);
  });
});

app.post('/api/rides', (req, res) => {
  console.log('Ride request received:', req.body);
  
  const { passengerName, passengerEmail, passengerPhone, pickup, dropoff, rideType, ridePrice, pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;
  
  if (!passengerName || !passengerEmail || !passengerPhone || !pickup || !dropoff || !rideType || ridePrice == null) {
    console.log('Missing required fields');
    return res.status(400).json({ error: 'Please provide all required fields' });
  }

  // First get the passenger's user ID from the users table
  const getUserQuery = 'SELECT id FROM users WHERE email = ?';
  db.query(getUserQuery, [passengerEmail], (errUser, userResults) => {
    let passengerId = null;
    if (userResults && userResults.length > 0) {
      passengerId = userResults[0].id;
    }
    
    // Insert with passenger_id foreign key
    const query = 'INSERT INTO rides (passenger_id, passenger_name, passenger_email, passenger_phone, pickup_location, dropoff_location, ride_type, price, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [passengerId, passengerName, passengerEmail, passengerPhone, pickup, dropoff, rideType, ridePrice, 'pending', pickupLat || null, pickupLng || null, dropoffLat || null, dropoffLng || null];
  
  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to save ride', details: err.message });
    }
    
    console.log('Ride created with ID:', result.insertId);
    const rideId = result.insertId;
    
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

  db.query('SELECT * FROM rides WHERE id = ?', [rideId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (results.length === 0) return res.status(404).json({ error: 'Ride not found' });

    const ride = results[0];
    if (ride.driver_assigned) return res.status(400).json({ error: 'Ride already accepted' });
    
    // Check if ride has expired (older than 60 seconds for pending rides)
    if (ride.status === 'pending') {
      const createdAt = new Date(ride.created_at);
      const now = new Date();
      const secondsDiff = (now - createdAt) / 1000;
      if (secondsDiff > 60) {
        // Ride expired, mark as cancelled
        db.query('UPDATE rides SET status = "cancelled" WHERE id = ?', [rideId]);
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
    
    const userQuery = `SELECT id, first_name, phone FROM users WHERE email = ?`;
    db.query(userQuery, [email], (errUser, userResults) => {
      console.log('User query error:', errUser);
      console.log('User query results:', userResults);
      
      // Store values in outer scope to avoid closure issues
      let vehicleDetails = vehicle || '';
      let driverName = name || 'Driver';
      let driverPhone = phone || '';
      let driverUserId = null;
      
      if (userResults && userResults.length > 0) {
        const userRecord = userResults[0];
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
          WHERE c.user_id = ?
        `;
        
        console.log('>>> STEP 1: Querying cars and driver_profiles with user_id:', driverUserId);
        db.query(joinQuery, [driverUserId], (errJoin, joinResults) => {
          console.log('>>> JOIN query error:', errJoin);
          console.log('>>> JOIN results:', JSON.stringify(joinResults));
          
          let vehicleDetails = vehicle || '';
          let driverLat = null;
          let driverLng = null;
          let driverRating = null;
          
          if (joinResults && joinResults.length > 0) {
            const result = joinResults[0];
            
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
            db.query('UPDATE rides SET driver_id=?, driver_name=?, driver_email=?, driver_phone=?, driver_vehicle=?, driver_lat=?, driver_lng=?, status="accepted", driver_assigned=1 WHERE id=?',
              [driverUserId, driverName, email, driverPhone, vehicleDetails, driverLat, driverLng, rideId], (err2) => {
              if (err2) {
                console.error('UPDATE rides error:', err2);
                return res.status(500).json({ error: 'Failed to accept ride', details: err2.message });
              }
              
              // Get full ride details including pickup location
              db.query('SELECT * FROM rides WHERE id = ?', [rideId], (err4, rideResults) => {
                if (rideResults && rideResults.length > 0) {
                  const ride = rideResults[0];
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
        db.query('UPDATE rides SET driver_name=?, driver_email=?, driver_phone=?, driver_vehicle=?, status="accepted", driver_assigned=1 WHERE id=?',
          [driverName, email, driverPhone, vehicleDetails, rideId], (err2) => {
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
  db.query('UPDATE rides SET status="active" WHERE id=? AND status IN ("accepted", "active")', [rideId], (err, result)=>{
    if(err) return res.status(500).json({error:"Server error"});
    if(result.affectedRows===0) return res.status(400).json({error:"Cannot start ride - ride may already be in progress or completed"});
    io.emit('rideUpdated',{id:rideId,status:"active"});
    res.json({message:"Ride started", rideId});
  });
});

// Complete ride
app.post('/api/rides/:id/complete', (req,res)=>{
  const rideId = req.params.id;
  db.query('UPDATE rides SET status="completed", completed_at = NOW() WHERE id=? AND status IN ("accepted", "active")', [rideId], (err,result)=>{
    if(err) return res.status(500).json({error:"Server error"});
    if(result.affectedRows===0) return res.status(400).json({error:"Cannot complete ride"});
    io.emit('rideUpdated',{id:rideId,status:"completed"});
    res.json({message:"Ride completed", rideId});
  });
});


// Cancel ride
app.post('/api/rides/:id/cancel', (req,res)=>{
  const rideId = req.params.id;
  db.query('UPDATE rides SET status="canceled", driver_assigned=0 WHERE id=?', [rideId], (err,result)=>{
    if(err) return res.status(500).json({error:"Server error"});
    if(result.affectedRows===0) return res.status(404).json({error:"Ride not found"});
    io.emit('rideUpdated',{id:rideId,status:"canceled", driver_assigned:0});
    res.json({message:"Ride cancelled successfully", rideId});
  });
});

// Driver location update
app.post('/api/rides/:id/driver-location', (req,res)=>{
  const rideId = req.params.id;
  const { lat, lng } = req.body;
  if(lat==null||lng==null) return res.status(400).json({error:"Latitude and longitude required"});

  db.query('UPDATE rides SET driver_lat=?, driver_lng=? WHERE id=? AND driver_assigned=1 AND status IN ("accepted","active")', [lat,lng,rideId], (err,result)=>{
    if(err) return res.status(500).json({error:"Server error"});
    if(result.affectedRows===0) return res.status(400).json({error:"Cannot update location"});
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
    JOIN users u ON dp.user_id = u.id
    SET dp.is_online = ?, dp.current_lat = ?, dp.current_lng = ?
    WHERE u.email = ?
  `;
  db.query(query, [is_online ? 1 : 0, lat || null, lng || null, email], (err, result) => {
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
      WHERE u.role = "driver" AND dp.is_online = 1
    `, (err, results) => {
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
    WHERE u.role = 'driver' AND dp.is_online = 1 AND dp.current_lat IS NOT NULL
    HAVING distance < ?
    ORDER BY distance
  `;
  
  db.query(query, [parseFloat(lat), parseFloat(lng), parseFloat(lat), parseFloat(radius)], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch nearby drivers' });
    res.json(results);
  });
});

// Get driver info by email
app.get('/api/drivers/:email', (req, res) => {
  const { email } = req.params;
  
  db.query(`
    SELECT u.id, u.first_name, u.last_name, u.email, u.phone, dp.rating, dp.is_online,
           c.make, c.model, c.year, c.color, c.plate_number
    FROM users u
    LEFT JOIN driver_profiles dp ON u.id = dp.user_id
    LEFT JOIN cars c ON u.vehicle_id = c.id
    WHERE u.email = ? AND u.role = 'driver'
  `, [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch driver info' });
    if (results.length === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json(results[0]);
  });
});

// Get passenger info
app.get('/api/passengers/:email', (req, res) => {
  const { email } = req.params;
  
  db.query('SELECT id, first_name, last_name, email, phone, rating FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch passenger info' });
    if (results.length === 0) return res.status(404).json({ error: 'Passenger not found' });
    res.json(results[0]);
  });
});

// === FARE CALCULATION ===

app.post('/api/fare/calculate', (req, res) => {
  const { distance_km, ride_type } = req.body;
  
  // Fare structure
  const BASE_FARE = 3.00;
  const PER_KM_RATE = 1.50;
  const PER_MIN_RATE = 0.25;
  
  // Multipliers for ride types
  const multipliers = {
    economy: 0.8,
    standard: 1.0,
    luxury: 1.5
  };
  
  const multiplier = multipliers[ride_type] || 1.0;
  const distance = parseFloat(distance_km) || 5; // Default 5km if not provided
  
  const fare = (BASE_FARE + (distance * PER_KM_RATE)) * multiplier;
  const estimatedTime = Math.ceil(distance * 3); // ~3 min per km
  
  res.json({
    base_fare: BASE_FARE,
    distance_km: distance,
    per_km_rate: PER_KM_RATE,
    multiplier,
    total_fare: Math.round(fare * 100) / 100,
    estimated_time: estimatedTime,
    currency: 'USD'
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
  db.query('SELECT * FROM rides WHERE id = ?', [rideId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (results.length === 0) return res.status(404).json({ error: 'Ride not found' });
    
    const ride = results[0];
    
    if (rated_by === 'passenger') {
      // Passenger rating for driver
      db.query('INSERT INTO ratings (ride_id, user_email, driver_email, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, NOW())', 
        [rideId, ride.passenger_email, ride.driver_email, rating, comment || ''], (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to save rating' });
        
        // Update driver's average rating
        updateDriverRating(ride.driver_email);
        res.json({ message: 'Rating submitted successfully' });
      });
    } else if (rated_by === 'driver') {
      // Driver rating for passenger
      db.query('INSERT INTO ratings (ride_id, driver_email, user_email, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, NOW())', 
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
  db.query('SELECT AVG(rating) as avg_rating FROM ratings WHERE driver_email = ?', [email], (err, results) => {
    if (!err && results.length > 0) {
      const avgRating = results[0].avg_rating || 0;
      db.query('UPDATE users SET rating = ? WHERE email = ?', [Math.round(avgRating * 10) / 10, email]);
    }
  });
}

// Helper function to update user rating
function updateUserRating(email) {
  db.query('SELECT AVG(rating) as avg_rating FROM ratings WHERE user_email = ?', [email], (err, results) => {
    if (!err && results.length > 0) {
      const avgRating = results[0].avg_rating || 0;
      db.query('UPDATE users SET rating = ? WHERE email = ?', [Math.round(avgRating * 10) / 10, email]);
    }
  });
}

// === DRIVER EARNINGS ===

// Get driver earnings
app.get('/api/drivers/earnings', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Get today's earnings - use created_at as fallback if completed_at doesn't exist
  const todayQuery = `
    SELECT COALESCE(SUM(price), 0) as today_earnings
    FROM rides 
    WHERE driver_email = ? AND status = 'completed' 
    AND (DATE(completed_at) = CURDATE() OR (completed_at IS NULL AND DATE(created_at) = CURDATE()))
  `;
  
  // Get total earnings
  const totalQuery = `
    SELECT COALESCE(SUM(price), 0) as total_earnings, COUNT(*) as total_trips
    FROM rides 
    WHERE driver_email = ? AND status = 'completed'
  `;
  
  // Get recent rides for earnings history
  const recentQuery = `
    SELECT id, passenger_name, pickup_location, dropoff_location, price, created_at, status
    FROM rides 
    WHERE driver_email = ? AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 20
  `;

  db.query(todayQuery, [email], (err, todayResults) => {
    if (err) {
      console.error('Error fetching today earnings:', err.message);
      // Return default values instead of error
      return db.query(totalQuery, [email], (err2, totalResults) => {
        if (err2) {
          console.error('Error fetching total earnings:', err2.message);
          return res.status(500).json({ error: 'Failed to fetch earnings' });
        }
        return db.query(recentQuery, [email], (err3, recentResults) => {
          if (err3) {
            console.error('Error fetching recent rides:', err3.message);
          }
          res.json({
            today_earnings: 0,
            total_earnings: totalResults[0]?.total_earnings || 0,
            total_trips: totalResults[0]?.total_trips || 0,
            recent_rides: recentResults || []
          });
        });
      });
    }
    
    db.query(totalQuery, [email], (err2, totalResults) => {
      if (err2) {
        console.error('Error fetching total earnings:', err2.message);
        return res.status(500).json({ error: 'Failed to fetch earnings' });
      }
      
      db.query(recentQuery, [email], (err3, recentResults) => {
        if (err3) {
          console.error('Error fetching recent rides:', err3.message);
        }
        
        res.json({
          today_earnings: todayResults[0]?.today_earnings || 0,
          total_earnings: totalResults[0]?.total_earnings || 0,
          total_trips: totalResults[0]?.total_trips || 0,
          recent_rides: recentResults
        });
      });
    });
  });
});

// === ARRIVE AND START RIDE ===

// Driver arrives at pickup
app.post('/api/rides/:id/arrive', (req, res) => {
  const rideId = req.params.id;
  // First get the ride to include all details in the socket emit
  db.query('SELECT * FROM rides WHERE id = ?', [rideId], (err, rides) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (!rides || rides.length === 0) return res.status(400).json({ error: 'Ride not found' });
    
    const ride = rides[0];
    // Use 'arrived' status when driver arrives at pickup
    db.query('UPDATE rides SET status = "arrived" WHERE id = ? AND status = "accepted"', [rideId], (err, result) => {
      if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
      if (result.affectedRows === 0) return res.status(400).json({ error: 'Cannot mark as arrived - ride may already be in progress or completed' });
      
      // Emit ride updated with all ride details including driver info
      // Use correct column names: pickup_location, dropoff_location
      io.emit('rideUpdated', {
        id: ride.id,
        status: 'arrived', // Send 'arrived' to frontend for consistency
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
      res.json({ message: 'Driver arrived at pickup', rideId });
    });
  });
});

// Start ride (after passenger boards)
app.post('/api/rides/:id/start', (req, res) => {
  const rideId = req.params.id;
  // Database uses 'active' status, update to 'active'
  db.query('UPDATE rides SET status = "active" WHERE id = ? AND status IN ("accepted", "active")', [rideId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Cannot start ride - ride may already be in progress or completed' });
    
    // Get ride details for socket emit
    db.query('SELECT * FROM rides WHERE id = ?', [rideId], (err, rides) => {
      if (err || !rides || rides.length === 0) {
        io.emit('rideUpdated', { id: rideId, status: 'active' });
        return res.json({ message: 'Ride started', rideId });
      }
      
      const ride = rides[0];
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
      res.json({ message: 'Ride started', rideId });
    });
  });
});

// Complete ride
app.post('/api/rides/:id/complete', (req, res) => {
  const rideId = req.params.id;
  const { final_price } = req.body;
  
  db.query('UPDATE rides SET status = "completed", price = COALESCE(?, price), completed_at = NOW() WHERE id = ? AND status = "active"', [final_price, rideId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Cannot complete ride' });
    io.emit('rideUpdated', { id: rideId, status: 'completed' });
    res.json({ message: 'Ride completed', rideId });
  });
});

// Start server
server.listen(3002, '0.0.0.0', () => console.log("Server running on port 3002"));