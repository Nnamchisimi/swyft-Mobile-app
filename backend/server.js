const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');
const nodemailer = require('nodemailer');
require('dotenv').config();

const db = require('./db-supabase');

const app = express();

// Health check endpoint for Render
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Swyft API is running' });
});

// Generate a 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate unique delivery ID
function generateDeliveryId() {
  return 'DEL' + Date.now() + Math.floor(1000 + Math.random() * 9000);
}

// Hash OTP for secure storage
async function hashOtp(otp) {
  return await bcrypt.hash(otp, 10);
}

// Verify OTP against hash
async function verifyOtp(otp, hash) {
  return await bcrypt.compare(otp, hash);
}

// Send OTP to customer via email
async function sendDeliveryOtp(email, otp, deliveryId) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Swyft <support@otoekspert.com>',
      to: [email],
      subject: `Swyft - Your Delivery OTP for ${deliveryId}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Swyft Delivery Confirmation</h2>
          <p>Your delivery has been picked up and is on its way!</p>
          <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
            <p style="font-size: 14px; color: #666; margin-bottom: 8px;">Your Delivery OTP:</p>
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb; margin: 0;">${otp}</p>
          </div>
          <p>Please provide this OTP to your driver when they arrive to confirm delivery.</p>
          <p style="color: #dc2626; font-size: 14px;">This OTP will expire in 2 hours.</p>
        </div>
      `,
      text: `Your Swyft Delivery OTP: ${otp}\n\nProvide this to your driver to confirm delivery.\n\nThis OTP expires in 2 hours.`,
    });
    if (error) {
      console.error('Failed to send OTP:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('OTP send error:', err.message);
    return false;
  }
}
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Admin guard: every /api/admin/* request must carry a valid JWT with role = 'admin'
function adminGuard(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role && decoded.role.toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
app.use('/api/admin', adminGuard);

// Resend email client
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function to send verification email via Resend
async function sendVerificationEmail(toEmail, code) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Swyft <support@otoekspert.com>',
      to: [toEmail],
      subject: 'Swyft - Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Welcome to Swyft!</h2>
          <p>Thank you for creating an account. Use the verification code below to verify your email:</p>
          <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
            <p style="font-size: 14px; color: #666; margin-bottom: 8px;">Your verification code is:</p>
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb; margin: 0;">${code}</p>
          </div>
          <p style="text-align: center; color: #666;">Enter this code in the Swyft app to verify your email.</p>
          <p style="color: #dc2626; font-size: 14px;">This code will expire in 15 minutes.</p>
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">If you didn't create an account with Swyft, please ignore this email.</p>
        </div>
      `,
      text: `Welcome to Swyft!\n\nYour verification code is: ${code}\n\nEnter this code in the Swyft app to verify your email.\n\nThis code will expire in 15 minutes.\n\nIf you didn't create an account, please ignore this email.`,
    });

    if (error) {
      console.error('Email send error:', error);
      return false;
    }

    console.log('Email sent successfully to:', toEmail);
    console.log('Message ID:', data?.id);
    return true;
  } catch (err) {
    console.error('Email send error:', err.message);
    return false;
  }
};

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
      SELECT id, true, $1, $2 FROM public.users WHERE email = $3
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
      FROM public.users u
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
      FROM public.users u
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
      db.query('UPDATE public.users SET last_active = NOW() WHERE email = $1', [socket.driverEmail], (err) => {
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

// === VERIFY EMAIL CODE (POST - for mobile app) ===
app.post('/api/users/verify-code', (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code required' });
  }
  
  console.log('Verifying code:', email, code);
  
  db.query('SELECT id FROM public.users WHERE email = $1', [email], (err0, userResult) => {
    if (err0) return res.status(500).json({ error: 'Server error finding user: ' + err0.message });
    if (userResult.rows.length === 0) return res.status(400).json({ error: 'User not found' });
    
    const userId = userResult.rows[0].id;
    console.log('Found userId:', userId);
    
    db.query('SELECT * FROM email_verification_tokens WHERE user_id = $1 AND token = $2 AND expires_at > NOW()', [userId, code], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
      console.log('Token query results:', results.rows);
      
      if (results.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired code' });
      
      db.query('UPDATE public.users SET is_verified = true, verified = true WHERE id = $1', [userId], (err3) => {
        if (err3) return res.status(500).json({ error: 'Verification failed: ' + err3.message });
        
        db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
        
        db.query('SELECT * FROM public.users WHERE id = $1', [userId], (err4, user) => {
          if (err4 || user.rows.length === 0) return res.status(500).json({ error: 'User not found' });
          
          const token = jwt.sign({ id: userId, email, role: user.rows[0].role }, process.env.JWT_SECRET, { expiresIn: '7d' });
          const userData = user.rows[0];
          userData.token = token;
          
          console.log('Verification successful for user:', userId);
          
          res.json({ 
            message: 'Email verified successfully',
            token,
            user: userData
          });
        });
      });
    });
  });
});

// === RESEND VERIFICATION CODE ===
app.post('/api/users/resend-code', (req, res) => {
  const { email } = req.body;
  
  if (!email) return res.status(400).json({ error: 'Email required' });
  
  db.query('SELECT id, is_verified FROM public.users WHERE email = $1', [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (results.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (results.rows[0].is_verified) return res.status(400).json({ error: 'Email already verified' });
    
    const userId = results.rows[0].id;
    const code = generateVerificationCode();
    
    db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
    
    // Insert new verification token
    db.query('INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'15 minutes\')', [userId, code], (err2) => {
      if (err2) {
        console.log('Verification token error:', err2.message);
        // Continue anyway - user can resend code
      }

      // Send verification email
      sendVerificationEmail(email, code);

      res.json({ message: 'Verification code sent' });
    });
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
    return res.status(400).json({ error: 'Missing required fields: first_name, last_name, email, password, role' });

  if (role === 'driver' && (!vehicle_make || !vehicle_model || !vehicle_plate))
    return res.status(400).json({ error: 'Vehicle details required for drivers' });

  const normalizedRole = (role || 'passenger').toLowerCase();
  
  // For Google OAuth users, use a special marker (don't need real password)
  const finalPassword = password === 'google-oauth' ? 'google-oauth' : password;
  
  db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
    if (results.rows.length > 0) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    // Insert user - NOT verified yet (requires email verification)
    // role is stored lowercase for consistent comparisons (e.g. 'driver', 'passenger', 'admin')
    const userQuery = 'INSERT INTO public.users (first_name, last_name, email, password, role, phone, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, role';
    const userValues = [first_name?.trim(), last_name?.trim(), email?.trim(), hashedPassword, normalizedRole, phone || null, false];

    db.query(userQuery, userValues, (err2, result) => {
      if (err2) {
        console.log('User insert error:', err2.message);
        return res.status(500).json({ error: 'Failed to create user', details: err2.message });
      }

      const userId = result.rows[0].id;
      const userRole = result.rows[0].role;
      console.log('User created (pending verification):', userId, 'Role:', userRole);

      // If driver, create car record
      if (userRole === 'Driver') {
        const carQuery = 'INSERT INTO cars (user_id, make, model, year, color, plate_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
        const carValues = [userId, vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_plate];
        
        db.query(carQuery, carValues, (err2, carResult) => {
          if (err2) {
            console.log('Car insert error:', err2.message);
          } else {
            const carId = carResult.rows[0].id;
            
            // Update user record to reference the car
            db.query('UPDATE users SET vehicle_id = $1 WHERE id = $2', [carId, userId]);
          }
        });
      }

      // Generate and store verification code
      const code = generateVerificationCode();
      
      // Delete any existing tokens for this user
      db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
      
      // Insert new verification token
      db.query('INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'15 minutes\')', [userId, code], async (err3) => {
        if (err3) {
          console.log('Verification token error:', err3.message);
          // Continue anyway - user can resend code
        }

        // Send verification email and wait for result
        const emailSent = await sendVerificationEmail(email, code);
        console.log('Email send result:', emailSent ? 'SUCCESS' : 'FAILED');

        // Return success - user needs to verify email
        res.status(201).json({ 
          message: emailSent 
            ? 'User created successfully. Please verify your email.' 
            : 'User created, but verification email failed. Please request a new code.',
          requiresVerification: true,
          email: email,
          emailSent: emailSent
        });
      });
    });
  });
});

// === VERIFY EMAIL (GET - for email link) ===
app.get('/api/users/verify', (req, res) => {
  const { token, email } = req.query;
  if (!token) return res.status(400).json({ error: 'Invalid verification link' });

  try {
    // token here is the 6-digit code, not a JWT
    db.query('SELECT id FROM public.users WHERE email = $1', [email], (err0, userResult) => {
      if (err0 || userResult.rows.length === 0) return res.status(400).json({ error: 'Invalid verification link' });
      
      const userId = userResult.rows[0].id;
      db.query('SELECT * FROM email_verification_tokens WHERE user_id = $1 AND token = $2 AND expires_at > NOW()', [userId, token], (err, results) => {
        if (err || results.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });

        db.query('UPDATE public.users SET is_verified = true, verified = true WHERE id = $1', [userId], (err2) => {
          if (err2) return res.status(500).json({ error: 'Failed to verify email' });

          db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);

          // Generate JWT for auto-login after verification
          db.query('SELECT * FROM public.users WHERE id = $1', [userId], (err4, user) => {
            if (err4 || user.rows.length === 0) return res.status(500).json({ error: 'User not found' });

            const jwtToken = jwt.sign({ id: userId, email, role: user.rows[0].role }, process.env.JWT_SECRET, { expiresIn: '7d' });
            const userData = user.rows[0];
            userData.token = jwtToken;

            // Redirect to app deep link with token and user data for auto-login
            const appScheme = process.env.APP_SCHEME || 'swyftmobile';
            const redirectUrl = `${appScheme}://verify?token=${jwtToken}&email=${encodeURIComponent(email)}`;
            res.redirect(redirectUrl);
          });
        });
      });
    });
  } catch {
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});

// === LOGIN ===
app.post('/api/users/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  db.query('SELECT * FROM public.users WHERE email = $1', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = results.rows[0];
    
    // Handle Google OAuth users specially
    if (user.password === 'google-oauth') {
      if (password !== 'google-oauth') {
        return res.status(401).json({ error: 'Incorrect password' });
      }
    } else {
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: 'Incorrect password' });
    }

    // Check if user is verified
    if (!user.is_verified && !user.verified) {
      return res.status(403).json({ 
        error: 'Email not verified',
        requiresVerification: true,
        email: email
      });
    }

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
    db.query('SELECT id, first_name, last_name, email, phone, vehicle_plate, role FROM public.users WHERE id = $1', [decoded.id], (err, results) => {
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
  db.query('SELECT id, first_name, last_name, email, phone, vehicle_plate FROM public.users WHERE role = $1', ['driver'], (err, results) => {
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

  const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID || '1077024630815-l4o088f9l2q4udhgvnasd89v2cqmesb5.apps.googleusercontent.com',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
});

// Google OAuth callback endpoint
app.post('/api/auth/google/callback', async (req, res) => {
  const { code, redirectUri } = req.body;
  
  console.log('=== GOOGLE OAUTH CALLBACK ===');
  console.log('Code received:', code ? 'Yes' : 'No');
  console.log('Redirect URI:', redirectUri);
  
  try {
    // Exchange authorization code for tokens
    const { tokens } = await googleClient.getToken({
      code,
      redirect_uri: redirectUri || 'https://auth.expo.io/@njapp/swyft-mobile',
    });
    
    // Verify the ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID || '1077024630815-l4o088f9l2q4udhgvnasd89v2cqmesb5.apps.googleusercontent.com',
    });
    
    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;
    
    // Check if user exists
    db.query('SELECT * FROM public.users WHERE email = $1', [email], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (results.rows.length === 0) {
        // Auto-register new Google user
        bcrypt.hash('google-oauth', 10, (err2, hashedPassword) => {
          if (err2) return res.status(500).json({ error: 'Hashing failed' });
          
          db.query(
            'INSERT INTO public.users (first_name, last_name, email, password, role, phone, is_verified, verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, role',
            [name ? name.split(' ')[0] : '', name ? name.split(' ').slice(1).join(' ') : '', email, hashedPassword, 'passenger', '', true, true],
            (err3, result) => {
              if (err3) {
                console.error('User creation error:', err3);
                return res.status(500).json({ error: 'Failed to create user' });
              }
              
              const token = jwt.sign(
                { id: result.rows[0].id, email, role: 'passenger' },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
              );
              
              res.json({ 
                token, 
                user: { 
                  ...result.rows[0], 
                  email,
                  first_name: name ? name.split(' ')[0] : '',
                  last_name: name ? name.split(' ').slice(1).join(' ') : ''
                } 
              });
            }
          );
        });
      } else {
        // Login existing user
        const user = results.rows[0];
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        res.json({ token, user });
      }
    });
  } catch (error) {
    console.error('Google callback error:', error.message);
    console.error('Full error:', error);
    res.status(400).json({ error: 'Invalid code or token verification failed', details: error.message });
  }
});

// GET pricing for city hub areas and vehicle types
app.get('/api/pricing', (req, res) => {
  const locationPrices = {
    lefkosa: 250,
    girne: 350,
    magusa: 250,
    iskele: 300
  };

  const vehiclePrices = {
    motorcycle: 50,
    sedan: 150,
    truck: 400
  };

  res.json({ locationPrices, vehiclePrices });
});

// POST new ride
  app.post('/api/rides', (req, res) => {
    console.log('Ride request received:', req.body);
    
    const { passenger_email, passenger_name, passenger_phone, pickup, dropoff, pickup_location, dropoff_location, ride_type, price, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, package_type, package_size, package_details, special_instructions, vehicle_type, inter_city } = req.body;
    
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
  typeof price !== 'number'
) {
  console.log('Missing required fields validation failed:', {
    passenger_name,
    passenger_email,
    passenger_phone,
    pickupLoc,
    dropoffLoc,
    ride_type,
    price,
    priceType: typeof price
  });

  return res.status(400).json({
    error: 'Please provide all required fields'
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
     const query = 'INSERT INTO rides (passenger_id, passenger_email, passenger_name, passenger_phone, pickup_location, dropoff_location, ride_type, price, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, package_type, package_size, package_details, special_instructions, vehicle_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id';
      const values = [passengerId, passenger_email, passengerName, passenger_phone, pickupLoc, dropoffLoc, ride_type, price, 'pending', pickLat, pickLng, dropLat, dropLng, package_type || null, package_size || null, package_details || null, special_instructions || null, vehicle_type || null];
  
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
          
          // Send OTP to customer
          sendDeliveryOtp(passenger_email, otp, deliveryId);
          
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

// Start ride - driver arrives at pickup, waiting for passenger confirmation
app.post('/api/rides/:id/start', (req,res)=>{
  const rideId = req.params.id;
  db.query('UPDATE rides SET status=$1 WHERE id=$2 AND status IN ($3, $4)', ['arrived', rideId, 'accepted', 'arrived'], (err, result)=>{
    if(err) return res.status(500).json({error:"Server error"});
    if(result.rowCount===0) return res.status(400).json({error:"Cannot start ride - ride may already be in progress or completed"});
    io.emit('rideUpdated',{id:rideId,status:"arrived"});
    io.emit('dispatchUpdated',{id:rideId,status:"arrived"});
    res.json({message:"Driver arrived at pickup. Waiting for passenger confirmation.", rideId});
  });
});

// Passenger confirms pickup - ride officially starts
app.post('/api/rides/:id/confirm-pickup', (req,res)=>{
  const rideId = req.params.id;
  db.query('UPDATE rides SET status=$1 WHERE id=$2 AND status = $3', ['in_progress', rideId, 'arrived'], (err, result)=>{
    if(err) return res.status(500).json({error:"Server error"});
    if(result.rowCount===0) return res.status(400).json({error:"Cannot confirm pickup - driver has not arrived yet"});
    io.emit('rideUpdated',{id:rideId,status:"in_progress",passenger_confirmed_pickup:true});
    io.emit('dispatchUpdated',{id:rideId,status:"in_progress",passenger_confirmed_pickup:true});
    res.json({message:"Pickup confirmed! Ride is now in progress.", rideId});
  });
});

// Complete ride - driver marks as complete, but passenger must confirm before earnings
app.post('/api/rides/:id/complete', (req,res)=>{
  const rideId = req.params.id;
  const { final_price } = req.body;
  db.query('UPDATE rides SET status=$1, price = COALESCE($2, price), completed_at = NOW() WHERE id=$3 AND status IN ($4)', ['completed', final_price, rideId, 'in_progress'], (err,result)=>{
    if(err) return res.status(500).json({error:"Server error"});
    if(result.rowCount===0) return res.status(400).json({error:"Cannot complete ride"});
    io.emit('rideUpdated',{id:rideId,status:"completed"});
    io.emit('dispatchUpdated',{id:rideId,status:"completed"});
    res.json({message:"Ride marked as completed. Waiting for passenger confirmation.", rideId});
  });
});

// Passenger confirms ride completion - this is when driver gets earnings
app.post('/api/rides/:id/confirm-complete', (req,res)=>{
  const rideId = req.params.id;
  db.query('UPDATE rides SET status=$1, confirmed_at = NOW() WHERE id=$2 AND status = $3', ['confirmed', rideId, 'completed'], (err,result)=>{
    if(err) {
      console.error('Error confirming ride:', err.message);
      return res.status(500).json({error:"Server error"});
    }
    if(result.rowCount===0) return res.status(400).json({error:"Cannot confirm ride - may already be confirmed"});
    
    db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err2, rides) => {
      if (err2) {
        console.error('Error getting ride details:', err2.message);
        return res.status(500).json({error:"Server error"});
      }
      const ride = rides.rows[0];
      
      io.emit('rideUpdated',{
        id:rideId,
        status:"confirmed",
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
      
      res.json({message:"Ride confirmed! Driver has been paid.",rideId});
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
    FROM public.users u
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
      FROM public.users u
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
    FROM public.users u
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
  
  // Include completed statuses: completed, confirmed (passenger confirmed), active
  // Earnings are counted when ride is COMPLETED (driver marks complete), not just confirmed
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
    
    // Get today's earnings - count on COMPLETED status (driver marks complete)
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
    SELECT 
      u.id, u.first_name, u.last_name, u.email, u.phone, dp.rating, dp.is_online,
      c.make, c.model, c.year, c.color, c.plate_number
    FROM public.users u
    LEFT JOIN driver_profiles dp ON u.id = dp.user_id
    LEFT JOIN cars c ON u.vehicle_id = c.user_id
    WHERE u.email = $1 AND LOWER(u.role) = 'driver'
  `, [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch driver info', details: err.message });
    if (results.rows.length === 0) {
      console.log(`[DEBUG] Driver not found for email: ${email}`);
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    const driver = results.rows[0];
    console.log(`[DEBUG] Driver info found:`, JSON.stringify(driver));
    res.json(driver);
  });
});

// Get passenger info
app.get('/api/passengers/:email', (req, res) => {
  const { email } = req.params;
  
  db.query('SELECT id, first_name, last_name, email, phone, rating FROM public.users WHERE email = $1', [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch passenger info' });
    if (results.rows.length === 0) return res.status(404).json({ error: 'Passenger not found' });
    res.json(results.rows[0]);
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
    
    if (ride.status !== 'active') {
      return res.status(400).json({ error: 'Ride must be in active status to complete' });
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
        'UPDATE rides SET status = $1, price = COALESCE($2, price), completed_at = NOW(), delivery_completed_at = NOW(), delivery_completed_lat = $3, delivery_completed_lng = $4 WHERE id = $5 AND status = $6',
        ['completed', ride.price, completionLocation.lat || null, completionLocation.lng || null, rideId, 'active'],
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

// === DRIVER VERIFICATION ENDPOINTS ===

// Ensure verification tables exist
const ensureVerificationTables = () => {
  const createTables = [
    `CREATE TABLE IF NOT EXISTS id_documents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_type VARCHAR(50) NOT NULL,
      document_number VARCHAR(100) NOT NULL,
      expiry_date DATE,
      front_image_url VARCHAR(500),
      back_image_url VARCHAR(500),
      is_verified BOOLEAN DEFAULT FALSE,
      verification_status VARCHAR(20) DEFAULT 'pending',
      rejection_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS selfie_verifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      selfie_image_url VARCHAR(500) NOT NULL,
      id_document_image_url VARCHAR(500),
      verification_status VARCHAR(20) DEFAULT 'pending',
      is_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS phone_verifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      phone_number VARCHAR(20) NOT NULL,
      verification_code VARCHAR(10) NOT NULL,
      is_verified BOOLEAN DEFAULT FALSE,
      verified_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS bank_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bank_name VARCHAR(100) NOT NULL,
      account_number VARCHAR(50) NOT NULL,
      account_holder_name VARCHAR(100) NOT NULL,
      routing_number VARCHAR(20),
      iban VARCHAR(50),
      swift_code VARCHAR(20),
      verification_status VARCHAR(20) DEFAULT 'pending',
      is_verified BOOLEAN DEFAULT FALSE,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS driver_verification_status (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      is_approved BOOLEAN DEFAULT FALSE,
      approval_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ratings (
      id SERIAL PRIMARY KEY,
      ride_id INTEGER NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
      user_email VARCHAR(255) NOT NULL,
      driver_email VARCHAR(255),
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ratings_ride_id ON ratings(ride_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ratings_driver_email ON ratings(driver_email)`
  ];

  let completed = 0;
  createTables.forEach((query, index) => {
    db.query(query, [], (err) => {
      if (err) {
        console.error(`Error creating verification table ${index}:`, err.message);
      }
      completed++;
      if (completed === createTables.length) {
        console.log('All verification tables ensured');
      }
    });
  });
};

// Idempotently ensure all expected columns exist. CREATE TABLE IF NOT EXISTS will
// NOT modify a table that already exists from an older deployment, which causes
// INSERTs to fail on missing/mismatched columns. ADD COLUMN IF NOT EXISTS fixes
// that drift safely on every startup.
const migrateVerificationTables = () => {
  const alters = [
    // id_documents
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) NOT NULL DEFAULT 'national_id'`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS document_number VARCHAR(100) NOT NULL DEFAULT 'unknown'`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS expiry_date DATE`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS front_image_url TEXT`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS back_image_url TEXT`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending'`,
    `ALTER TABLE id_documents ADD COLUMN IF NOT EXISTS rejection_reason TEXT`,
    // selfie_verifications
    `ALTER TABLE selfie_verifications ADD COLUMN IF NOT EXISTS selfie_image_url TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE selfie_verifications ADD COLUMN IF NOT EXISTS id_document_image_url TEXT`,
    `ALTER TABLE selfie_verifications ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending'`,
    `ALTER TABLE selfie_verifications ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
    // phone_verifications
    `ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) NOT NULL DEFAULT ''`,
    `ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10) NOT NULL DEFAULT ''`,
    `ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
    // bank_accounts
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100) NOT NULL DEFAULT ''`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(50) NOT NULL DEFAULT ''`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(100) NOT NULL DEFAULT ''`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS routing_number VARCHAR(20)`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS iban VARCHAR(50)`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS swift_code VARCHAR(20)`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending'`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE`,
    // driver_verification_status
    `ALTER TABLE driver_verification_status ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE driver_verification_status ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP`,
    // Widen image columns to TEXT so base64 image data fits
    `ALTER TABLE id_documents ALTER COLUMN front_image_url TYPE TEXT`,
    `ALTER TABLE id_documents ALTER COLUMN back_image_url TYPE TEXT`,
    `ALTER TABLE selfie_verifications ALTER COLUMN selfie_image_url TYPE TEXT`,
    `ALTER TABLE selfie_verifications ALTER COLUMN id_document_image_url TYPE TEXT`,
  ];

  let completed = 0;
  alters.forEach((query, index) => {
    db.query(query, [], (err) => {
      if (err) {
        console.error(`Error migrating verification table column ${index}:`, err.message);
      }
      completed++;
      if (completed === alters.length) {
        console.log('All verification table migrations ensured');
      }
    });
  });
};

ensureVerificationTables();
migrateVerificationTables();

// Upload government-issued ID
app.post('/api/drivers/:email/id-document', (req, res) => {
  const { email } = req.params;
  const { document_type, document_number, expiry_date, front_image_url, back_image_url } = req.body;
  
  if (!document_type || !document_number) {
    return res.status(400).json({ error: 'Document type and number are required' });
  }
  
  db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error', details: err.message });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const userId = userResult.rows[0].id;
    
    const insertQuery = 'INSERT INTO id_documents (user_id, document_type, document_number, expiry_date, front_image_url, back_image_url, verification_status) VALUES ($1, $2, $3, $4, $5, $6, \'pending\') RETURNING *';
    
    const values = [
      userId, 
      document_type, 
      document_number, 
      (() => {
        if (!expiry_date || expiry_date === '') return null;
        const d = new Date(expiry_date);
        return isNaN(d.getTime()) ? null : expiry_date;
      })(), 
      front_image_url && front_image_url !== '' ? front_image_url : null, 
      back_image_url && back_image_url !== '' ? back_image_url : null
    ];
    
    db.query(insertQuery, values, (err2, result) => {
      if (err2) {
        console.error('ID document insert error:', err2);
        console.error('Error code:', err2.code);
        console.error('Error detail:', err2.detail);
        return res.status(500).json({ 
          error: 'Failed to save ID document', 
          details: err2.message,
          code: err2.code
        });
      }
      
      res.json({ 
        message: 'ID document submitted successfully',
        document: result.rows[0]
      });
    });
  });
});

// Upload live selfie for verification
app.post('/api/drivers/:email/selfie', (req, res) => {
  const { email } = req.params;
  const { selfie_image_url, id_document_image_url } = req.body;
  
  if (!selfie_image_url) {
    return res.status(400).json({ error: 'Selfie image is required' });
  }
  
  db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const userId = userResult.rows[0].id;
    
    const insertQuery = 'INSERT INTO selfie_verifications (user_id, selfie_image_url, id_document_image_url, verification_status) VALUES ($1, $2, $3, \'pending\') RETURNING *';
    
    const values = [
      userId, 
      selfie_image_url, 
      id_document_image_url && id_document_image_url !== '' ? id_document_image_url : null
    ];
    
    db.query(insertQuery, values, (err2, result) => {
      if (err2) {
        console.error('Selfie insert error:', err2);
        return res.status(500).json({ error: 'Failed to save selfie', details: err2.message });
      }
      
      res.json({ 
        message: 'Selfie submitted successfully',
        selfie: result.rows[0]
      });
    });
  });
});

// Verify phone number
app.post('/api/drivers/:email/phone-verify', (req, res) => {
  const { email } = req.params;
  const { phone_number, verification_code } = req.body;
  
  if (!phone_number || !verification_code) {
    return res.status(400).json({ error: 'Phone number and verification code are required' });
  }
  
  db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const userId = userResult.rows[0].id;
    
    db.query('SELECT * FROM phone_verifications WHERE user_id = $1 AND phone_number = $2 AND verification_code = $3', [userId, phone_number, verification_code], (err2, verifyResult) => {
      if (err2) return res.status(500).json({ error: 'Server error' });
      if (verifyResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid verification code' });
      }
      
      db.query('UPDATE phone_verifications SET is_verified = true, verified_at = NOW() WHERE user_id = $1 AND phone_number = $2', [userId, phone_number], (err3) => {
        if (err3) return res.status(500).json({ error: 'Failed to verify phone' });
        
        db.query('UPDATE public.users SET phone = $1 WHERE id = $2', [phone_number, userId], (err4) => {
          if (err4) return res.status(500).json({ error: 'Failed to update phone' });
          
          res.json({ 
            message: 'Phone number verified successfully',
            phone_number: phone_number
          });
        });
      });
    });
  });
});

// Request phone verification code
app.post('/api/drivers/:email/phone-request-code', (req, res) => {
  const { email } = req.params;
  const { phone_number } = req.body;
  
  if (!phone_number) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  
  db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const userId = userResult.rows[0].id;
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    db.query('DELETE FROM phone_verifications WHERE user_id = $1', [userId], (err2) => {
      db.query('INSERT INTO phone_verifications (user_id, phone_number, verification_code, created_at) VALUES ($1, $2, $3, NOW())', [userId, phone_number, verificationCode], (err3) => {
        if (err3) return res.status(500).json({ error: 'Failed to save verification code' });
        
        // In production, send SMS via Twilio or similar service
        // For now, return the code (development mode)
        res.json({ 
          message: 'Verification code sent',
          verification_code: verificationCode, // Remove in production, use SMS
          phone_number: phone_number
        });
      });
    });
  });
});

// Add bank account
app.post('/api/drivers/:email/bank-account', (req, res) => {
  const { email } = req.params;
  const { bank_name, account_number, account_holder_name, routing_number, iban, swift_code } = req.body;
  
  if (!bank_name || !account_number || !account_holder_name) {
    return res.status(400).json({ error: 'Bank name, account number, and account holder name are required' });
  }
  
  db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const userId = userResult.rows[0].id;
    
    const insertQuery = 'INSERT INTO bank_accounts (user_id, bank_name, account_number, account_holder_name, routing_number, iban, swift_code, verification_status, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, \'pending\', true) RETURNING *';
    
    db.query(insertQuery, [userId, bank_name, account_number, account_holder_name, routing_number || null, iban || null, swift_code || null], (err2, result) => {
      if (err2) return res.status(500).json({ error: 'Failed to save bank account' });
      
      res.json({ 
        message: 'Bank account submitted successfully',
        bank_account: result.rows[0]
      });
    });
  });
});

// Get driver verification status
app.get('/api/drivers/:email/verification-status', (req, res) => {
  const { email } = req.params;
  
  db.query('SELECT id, is_verified FROM public.users WHERE email = $1 AND LOWER(role) = \'driver\'', [email], (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

    const userId = userResult.rows[0].id;
    const userVerified = !!userResult.rows[0].is_verified;

    // Get ID document status
    db.query('SELECT verification_status, is_verified FROM id_documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (err1, idResult) => {
      // Get selfie verification status
      db.query('SELECT verification_status, is_verified FROM selfie_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (err2, selfieResult) => {
          // Get phone verification status
          db.query('SELECT is_verified FROM phone_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (err3, phoneResult) => {
          // Get bank account status
          db.query('SELECT verification_status, is_verified FROM bank_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (err4, bankResult) => {
            
            const idVerified = idResult.rows.length > 0 && idResult.rows[0].is_verified;
            const selfieVerified = selfieResult.rows.length > 0 && selfieResult.rows[0].is_verified;
            const phoneVerified = phoneResult.rows.length > 0 && phoneResult.rows[0].is_verified;
            const bankVerified = bankResult.rows.length > 0 && bankResult.rows[0].is_verified;
            
            const allVerified = idVerified && selfieVerified && phoneVerified && bankVerified;
            const isApproved = userVerified || allVerified;
            
            res.json({
              is_approved: isApproved,
              verifications: {
                id_document: {
                  is_verified: idVerified,
                  status: idResult.rows.length > 0 ? idResult.rows[0].verification_status : 'not_submitted'
                },
                selfie: {
                  is_verified: selfieVerified,
                  status: selfieResult.rows.length > 0 ? selfieResult.rows[0].verification_status : 'not_submitted'
                },
                phone: {
                  is_verified: phoneVerified,
                  status: phoneResult.rows.length > 0 ? 'pending' : 'not_submitted'
                },
                bank_account: {
                  is_verified: bankVerified,
                  status: bankResult.rows.length > 0 ? bankResult.rows[0].verification_status : 'not_submitted'
                }
              }
            });
          });
        });
      });
    });
  });
});

// Update driver verification approval status
app.patch('/api/drivers/:email/approve', (req, res) => {
  const { email } = req.params;
  const { is_approved } = req.body;
  
  db.query('SELECT id FROM public.users WHERE email = $1 AND LOWER(role) = \'driver\'', [email], (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });
    
    const userId = userResult.rows[0].id;
    
    db.query('INSERT INTO driver_verification_status (user_id, is_approved, approval_date) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET is_approved = $2, approval_date = $3', 
      [userId, is_approved, is_approved ? new Date().toISOString() : null], (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to update approval status' });
        
        res.json({ message: 'Approval status updated', is_approved });
      });
  });
});

// Submit all driver verifications for manual review.
// Each verification record is already saved when the driver completes its step;
// this guarantees every record is flagged as 'pending' and the overall
// submission is recorded so an admin can review and approve directly from the DB.
app.post('/api/drivers/:email/submit-for-review', (req, res) => {
  const { email } = req.params;

  db.query('SELECT id, is_verified FROM public.users WHERE email = $1 AND LOWER(role) = \'driver\'', [email], (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

    const userId = userResult.rows[0].id;
    const userVerified = !!userResult.rows[0].is_verified;

    let pending = 3;
    const afterMark = () => {
      if (--pending > 0) return;

      // Record the overall submission (submitted for review, not yet approved)
      db.query(
        `INSERT INTO driver_verification_status (user_id, is_approved, approval_date)
         VALUES ($1, false, null)
         ON CONFLICT (user_id) DO UPDATE SET is_approved = false, approval_date = null`,
        [userId],
        (err3) => {
          if (err3) return res.status(500).json({ error: 'Failed to submit for review' });

          const summaryQuery = `
            SELECT
              (SELECT COUNT(*) FROM id_documents WHERE user_id = $1) AS id_documents,
              (SELECT COUNT(*) FROM selfie_verifications WHERE user_id = $1) AS selfies,
              (SELECT COUNT(*) FROM phone_verifications WHERE user_id = $1) AS phones,
              (SELECT COUNT(*) FROM bank_accounts WHERE user_id = $1) AS bank_accounts
          `;
          db.query(summaryQuery, [userId], (err4, sumResult) => {
            if (err4) return res.status(500).json({ error: 'Failed to load submission summary' });
            res.json({ message: 'Submitted for review', submitted: sumResult.rows[0] });
          });
        }
      );
    };

    db.query('UPDATE id_documents SET verification_status = \'pending\' WHERE user_id = $1', [userId], afterMark);
    db.query('UPDATE selfie_verifications SET verification_status = \'pending\' WHERE user_id = $1', [userId], afterMark);
    db.query('UPDATE bank_accounts SET verification_status = \'pending\' WHERE user_id = $1', [userId], afterMark);
  });
});

// === ADMIN: review driver selfie / verification images ===
// The DB only stores a reference in selfie_verifications.selfie_image_url:
//   - a Supabase Storage public URL (actual file lives in the bucket)
//   - a `data:image/...;base64,...` data URI (the image is embedded in the row)
// resolveImageRef normalizes either into a renderable { type, url } object.
const resolveImageRef = (ref) => {
  if (!ref) return null;
  if (ref.startsWith('data:image/')) return { type: 'base64', url: ref };
  return { type: 'url', url: ref };
};

// Get a single driver's latest selfie + id-document image for review
app.get('/api/admin/drivers/:email/selfie', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { email } = req.params;
  db.query('SELECT id, first_name, last_name, email, role FROM public.users WHERE email = $1', [email], (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userResult.rows[0];
    db.query(
      'SELECT * FROM selfie_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user.id],
      (err2, selfieResult) => {
        if (err2) return res.status(500).json({ error: 'Failed to load selfie' });

        const selfie = selfieResult.rows[0] || null;
        res.json({
          driver: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
          },
          selfie: selfie ? {
            id: selfie.id,
            selfie_image: resolveImageRef(selfie.selfie_image_url),
            id_document_image: resolveImageRef(selfie.id_document_image_url),
            match_confidence: selfie.match_confidence,
            is_verified: selfie.is_verified,
            verification_status: selfie.verification_status,
            rejection_reason: selfie.rejection_reason,
            created_at: selfie.created_at,
            updated_at: selfie.updated_at,
          } : null,
        });
      }
    );
  });
});

// List selfie verification records (review queue), optionally filtered by status
app.get('/api/admin/selfies', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { status } = req.query;
  const params = [];
  let statusCond = '';
  if (status) {
    params.push(status);
    statusCond = 'WHERE sv.verification_status = $1';
  }

  const query = `
    SELECT
      sv.id,
      sv.selfie_image_url,
      sv.id_document_image_url,
      sv.match_confidence,
      sv.is_verified,
      sv.verification_status,
      sv.created_at,
      u.id AS user_id,
      u.first_name,
      u.last_name,
      u.email
    FROM selfie_verifications sv
    JOIN public.users u ON u.id = sv.user_id
    ${statusCond}
    ORDER BY sv.created_at DESC
  `;

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to load selfies' });
    res.json(results.rows.map((r) => ({
      id: r.id,
      driver: { id: r.user_id, first_name: r.first_name, last_name: r.last_name, email: r.email },
      selfie_image: resolveImageRef(r.selfie_image_url),
      id_document_image: resolveImageRef(r.id_document_image_url),
      match_confidence: r.match_confidence,
      is_verified: r.is_verified,
      verification_status: r.verification_status,
      created_at: r.created_at,
    })));
  });
});

// List drivers who have submitted verifications and still need review (any pending/rejected piece)
app.get('/api/admin/drivers/pending', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const query = `
    SELECT DISTINCT
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.phone,
      u.created_at AS registered_at,
      COALESCE(dvs.is_approved, false) AS is_approved
    FROM public.users u
    LEFT JOIN driver_verification_status dvs ON dvs.user_id = u.id
    WHERE LOWER(u.role) = 'driver'
      AND (
        EXISTS (
          SELECT 1 FROM (
            SELECT DISTINCT ON (user_id) verification_status
            FROM id_documents WHERE user_id = u.id
            ORDER BY user_id, created_at DESC
          ) idv WHERE idv.verification_status IN ('pending','rejected')
        )
        OR EXISTS (
          SELECT 1 FROM (
            SELECT DISTINCT ON (user_id) verification_status
            FROM selfie_verifications WHERE user_id = u.id
            ORDER BY user_id, created_at DESC
          ) sv WHERE sv.verification_status IN ('pending','rejected')
        )
        OR EXISTS (
          SELECT 1 FROM (
            SELECT DISTINCT ON (user_id) verification_status
            FROM bank_accounts WHERE user_id = u.id
            ORDER BY user_id, created_at DESC
          ) ba WHERE ba.verification_status IN ('pending','rejected')
        )
        OR EXISTS (
          SELECT 1 FROM (
            SELECT DISTINCT ON (user_id) is_verified
            FROM phone_verifications WHERE user_id = u.id
            ORDER BY user_id, created_at DESC
          ) pv WHERE pv.is_verified = false
        )
      )
    ORDER BY u.created_at DESC
  `;

  db.query(query, [], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to load pending drivers' });
    res.json(results.rows);
  });
});

// Approve or reject a single selfie verification
app.post('/api/admin/drivers/:email/selfie/review', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { email } = req.params;
  const { decision, rejection_reason } = req.body; // decision: 'approve' | 'reject'

  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
  }

  db.query('SELECT id FROM public.users WHERE email = $1', [email], (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const userId = userResult.rows[0].id;

    const status = decision === 'approve' ? 'verified' : 'rejected';
    const isVerified = decision === 'approve';
    const reason = decision === 'reject' ? (rejection_reason || 'Rejected by moderator') : null;

    db.query(
      `UPDATE selfie_verifications
         SET verification_status = $1,
             is_verified = $2,
             rejection_reason = $3,
             reviewed_at = NOW()
       WHERE user_id = $4 AND id = (
         SELECT id FROM selfie_verifications WHERE user_id = $4 ORDER BY created_at DESC LIMIT 1
       )`,
      [status, isVerified, reason, userId],
      (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to review selfie' });
        res.json({ message: `Selfie ${status}`, email, verification_status: status, is_verified: isVerified });
      }
    );
  });
});

// Approve or reject an ID document
app.post('/api/admin/drivers/:email/id-document/review', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { email } = req.params;
  const { decision, rejection_reason } = req.body;

  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
  }

  db.query('SELECT id FROM public.users WHERE email = $1', [email], (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const userId = userResult.rows[0].id;

    const status = decision === 'approve' ? 'verified' : 'rejected';
    const isVerified = decision === 'approve';
    const reason = decision === 'reject' ? (rejection_reason || 'Rejected by moderator') : null;

    db.query(
      `UPDATE id_documents
         SET verification_status = $1,
             is_verified = $2,
             rejection_reason = $3
       WHERE user_id = $4 AND id = (
         SELECT id FROM id_documents WHERE user_id = $4 ORDER BY created_at DESC LIMIT 1
       )`,
      [status, isVerified, reason, userId],
      (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to review ID document' });
        res.json({ message: `ID document ${status}`, email, verification_status: status, is_verified: isVerified });
      }
    );
  });
});

// Approve or reject a phone verification
app.post('/api/admin/drivers/:email/phone/review', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { email } = req.params;
  const { decision, verified } = req.body; // decision: 'approve' | 'reject' OR verified: boolean

  const isVerified = decision ? decision === 'approve' : !!verified;
  if (typeof isVerified !== 'boolean') {
    return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
  }

  db.query('SELECT id FROM public.users WHERE email = $1', [email], (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const userId = userResult.rows[0].id;

    db.query(
      `UPDATE phone_verifications SET is_verified = $1 WHERE user_id = $2 AND id = (
         SELECT id FROM phone_verifications WHERE user_id = $2 ORDER BY created_at DESC LIMIT 1
       )`,
      [isVerified, userId],
      (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to review phone' });
        res.json({ message: `Phone ${isVerified ? 'verified' : 'rejected'}`, email, is_verified: isVerified });
      }
    );
  });
});

// Approve or reject a bank account
app.post('/api/admin/drivers/:email/bank/review', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { email } = req.params;
  const { decision, rejection_reason } = req.body;

  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
  }

  db.query('SELECT id FROM public.users WHERE email = $1', [email], (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const userId = userResult.rows[0].id;

    const status = decision === 'approve' ? 'verified' : 'rejected';
    const isVerified = decision === 'approve';
    const reason = decision === 'reject' ? (rejection_reason || 'Rejected by moderator') : null;

    db.query(
      `UPDATE bank_accounts
         SET verification_status = $1, is_verified = $2, rejection_reason = $3
       WHERE user_id = $4 AND id = (
         SELECT id FROM bank_accounts WHERE user_id = $4 ORDER BY created_at DESC LIMIT 1
       )`,
      [status, isVerified, reason, userId],
      (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to review bank account' });
        res.json({ message: `Bank account ${status}`, email, verification_status: status, is_verified: isVerified });
      }
    );
  });
});

// Get the FULL verification bundle for a driver (ID doc + images, selfie + image, phone, bank) for moderator review
app.get('/api/admin/drivers/:email/verification', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { email } = req.params;

  db.query(
    `SELECT id, first_name, last_name, email, phone, role, created_at FROM public.users WHERE email = $1`,
    [email],
    (err, userResult) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      const user = userResult.rows[0];
      const userId = user.id;

      db.query(
        `SELECT * FROM id_documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId],
        (e1, idResult) => {
          db.query(
            `SELECT * FROM selfie_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [userId],
            (e2, selfieResult) => {
              db.query(
                `SELECT * FROM phone_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [userId],
                (e3, phoneResult) => {
                  db.query(
                    `SELECT * FROM bank_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
                    [userId],
                    (e4, bankResult) => {
                      const id = idResult.rows[0] || null;
                      const selfie = selfieResult.rows[0] || null;
                      const phone = phoneResult.rows[0] || null;
                      const bank = bankResult.rows[0] || null;

                      res.json({
                        driver: {
                          id: user.id,
                          first_name: user.first_name,
                          last_name: user.last_name,
                          email: user.email,
                          phone: user.phone,
                          role: user.role,
                          created_at: user.created_at,
                        },
                        id_document: id ? {
                          id: id.id,
                          document_type: id.document_type,
                          document_number: id.document_number,
                          expiry_date: id.expiry_date,
                          front_image: resolveImageRef(id.front_image_url),
                          back_image: resolveImageRef(id.back_image_url),
                          is_verified: id.is_verified,
                          verification_status: id.verification_status,
                          rejection_reason: id.rejection_reason,
                        } : null,
                        selfie: selfie ? {
                          id: selfie.id,
                          selfie_image: resolveImageRef(selfie.selfie_image_url),
                          id_document_image: resolveImageRef(selfie.id_document_image_url),
                          match_confidence: selfie.match_confidence,
                          is_verified: selfie.is_verified,
                          verification_status: selfie.verification_status,
                          rejection_reason: selfie.rejection_reason,
                          created_at: selfie.created_at,
                        } : null,
                        phone: phone ? {
                          id: phone.id,
                          phone_number: phone.phone_number,
                          is_verified: phone.is_verified,
                          verified_at: phone.verified_at,
                        } : null,
                        bank_account: bank ? {
                          id: bank.id,
                          bank_name: bank.bank_name,
                          account_holder_name: bank.account_holder_name,
                          account_number: bank.account_number,
                          routing_number: bank.routing_number,
                          iban: bank.iban,
                          swift_code: bank.swift_code,
                          is_verified: bank.is_verified,
                          verification_status: bank.verification_status,
                          rejection_reason: bank.rejection_reason,
                        } : null,
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

// Approve/reject overall driver (sets the aggregated verification flags + is_approved)
app.post('/api/admin/drivers/:email/approve', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { email } = req.params;
  const { approved } = req.body; // boolean

  if (typeof approved !== 'boolean') {
    return res.status(400).json({ error: 'approved must be a boolean' });
  }

  db.query('SELECT id, is_verified FROM public.users WHERE email = $1 AND LOWER(role) = \'driver\'', [email], (err, userResult) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

    const userId = userResult.rows[0].id;
    const userVerified = !!userResult.rows[0].is_verified;

    db.query(
      `INSERT INTO driver_verification_status (user_id, is_approved, approval_date)
       VALUES ($1, $2, CASE WHEN $2 THEN NOW() ELSE NULL END)
       ON CONFLICT (user_id) DO UPDATE SET is_approved = $2, approval_date = CASE WHEN $2 THEN NOW() ELSE NULL END`,
      [userId, approved],
      (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to update approval' });
        res.json({ message: approved ? 'Driver approved' : 'Driver not approved', email, is_approved: approved });
      }
    );
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
