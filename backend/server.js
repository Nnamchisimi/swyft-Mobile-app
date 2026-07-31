const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const db = require('./db-supabase');
const { adminGuard, verifyToken } = require('./utils/helpers');

// Route modules
const { registerAuthRoutes } = require('./routes/auth');
const { registerRidesRoutes } = require('./routes/rides');
const { registerDriversRoutes } = require('./routes/drivers');
const { registerVerificationRoutes } = require('./routes/verification');
const { registerPaymentsRoutes } = require('./routes/payments');
const { registerWithdrawalRoutes } = require('./routes/withdrawals');

const app = express();

// Health check endpoint for Render
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Swyft API is running' });
});

app.use(cors());

app.use('/api/payments/webhook', (req, res, next) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks);
    req.rawBody = rawBody;
    try {
      req.body = JSON.parse(rawBody.toString('utf8'));
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    next();
  });
  req.on('error', () => {
    res.status(400).json({ error: 'Failed to read request body' });
  });
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Admin guard: every /api/admin/* request must carry a valid JWT with role = 'admin'
app.use('/api/admin', adminGuard);

// === SOCKET.IO (real-time) ===
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST'],
  },
});

// === Register all route modules ===
// rides/drivers/sockets depend on `io`, so register after it is created.
registerAuthRoutes(app, db);
registerRidesRoutes(app, io, db);
registerWithdrawalRoutes(app, io, db);
registerDriversRoutes(app, db);
registerVerificationRoutes(app, db);
registerPaymentsRoutes(app, db, io);

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('joinRoom', (email) => socket.join(email));
  socket.on('leaveRoom', (email) => socket.leave(email));

  // Driver goes online - join drivers room and store location
  socket.on('driverOnline', (data) => {
    console.log('driverOnline event received:', data.email);
    // Join the online drivers room for receiving ride requests
    socket.join('onlineDrivers');
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
  socket.on('driverOffline', (email) => {
    socket.leave('onlineDrivers');

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
  socket.on('updateDriverLocation', (data) => {
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
    io.to('onlineDrivers').emit('driverLocationUpdate', data);

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
  socket.on('passengerLocationUpdate', (data) => {
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
  socket.on('driverHeartbeat', (data) => {
    if (socket.driverEmail) {
      db.query('UPDATE public.users SET last_active = NOW() WHERE email = $1', [socket.driverEmail], (err) => {
        if (err) console.error('Error updating driver heartbeat:', err);
      });
    }
  });

  // New ride request - broadcast to all online drivers with countdown
  socket.on('newRide', (ride) => {
    ride.createdAt = new Date().toISOString();
    ride.expiresAt = new Date(Date.now() + 15000).toISOString();

    io.to('onlineDrivers').emit('newRide', ride);
  });

  socket.on('rideUpdated', (ride) => {
    io.emit('rideUpdated', ride);
    if (ride.passenger_email) io.to(ride.passenger_email).emit('rideUpdated', ride);
    if (ride.driver_email) io.to(ride.driver_email).emit('rideUpdated', ride);
  });

  socket.on('driverLocationUpdated', (data) => io.emit('driverLocationUpdated', data));

  socket.on('disconnect', () => {
    if (socket.driverEmail) {
      socket.leave('onlineDrivers');
      console.log(`Driver ${socket.driverEmail} disconnected`);
    }
    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
