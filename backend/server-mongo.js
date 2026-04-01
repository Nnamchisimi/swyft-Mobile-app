const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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

// Connect to MongoDB
const connectDB = require('./db-mongo');
const { User, Car, Ride, DriverProfile, Rating, EmailToken } = require('./models');

// Initialize database connection
connectDB();

// ==================== ROUTES ====================

// Email verification
app.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const emailToken = await EmailToken.findOne({ 
      token, 
      expires_at: { $gt: new Date() } 
    });
    
    if (!emailToken) {
      return res.send('<h3>Invalid or expired token</h3>');
    }
    
    await User.findByIdAndUpdate(decoded.id, { is_verified: true });
    await EmailToken.deleteOne({ token });
    
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3003'}/signin?verified=1`);
  } catch (error) {
    res.send('<h3>Verification failed</h3>');
  }
});

// Register
app.post('/api/users', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password, role, vehicle_info } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      first_name,
      last_name,
      email,
      phone,
      password: hashedPassword,
      role: role || 'passenger'
    });
    
    await user.save();
    
    // If driver, create car and driver profile
    if (role && role.toLowerCase() === 'driver' && vehicle_info) {
      const car = new Car({
        user_id: user._id,
        make: vehicle_info.make,
        model: vehicle_info.model,
        year: vehicle_info.year,
        color: vehicle_info.color,
        plate_number: vehicle_info.plate_number
      });
      await car.save();
      
      await User.findByIdAndUpdate(user._id, { vehicle_id: car._id });
      
      const driverProfile = new DriverProfile({
        user_id: user._id,
        is_online: false,
        rating: 5.0,
        total_trips: 0
      });
      await driverProfile.save();
    }
    
    // Create verification token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const emailToken = new EmailToken({
      user_id: user._id,
      token,
      expires_at
    });
    await emailToken.save();
    
    // Send verification email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    const verifyUrl = `${process.env.API_URL || 'http://localhost:3001'}/verify-email/${token}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your Swyft account',
      html: `<h3>Click <a href="${verifyUrl}">here</a> to verify your email</h3>`
    });
    
    res.json({ message: 'User registered. Please check email to verify.', userId: user._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    let car = null;
    if (user.role && user.role.toLowerCase() === 'driver' && user.vehicle_id) {
      car = await Car.findOne({ user_id: user._id });
    }
    
    res.json({
      token,
      user: {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        vehicle_plate: user.vehicle_plate,
        rating: user.rating
      },
      car
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
app.get('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get all drivers
app.get('/api/drivers', async (req, res) => {
  try {
    const drivers = await User.find({ role: 'driver' })
      .select('id first_name last_name email phone vehicle_plate');
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a ride
app.post('/api/rides', async (req, res) => {
  try {
    const { passenger_email, pickup_location, dropoff_location, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, ride_type, distance_km } = req.body;
    
    const ride = new Ride({
      passenger_email,
      pickup_location,
      dropoff_location,
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
      ride_type: ride_type || 'economy',
      status: 'requested',
      distance_km
    });
    
    await ride.save();
    
    // Notify all drivers
    io.emit('newRide', ride);
    
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get rides
app.get('/api/rides', async (req, res) => {
  try {
    const { status, driver_email, passenger_email } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (driver_email) query.driver_email = driver_email;
    if (passenger_email) query.passenger_email = passenger_email;
    
    const rides = await Ride.find(query).sort({ createdAt: -1 });
    res.json(rides);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ride by ID
app.get('/api/rides/:id', async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept ride (driver accepts)
app.post('/api/rides/:id/accept', async (req, res) => {
  try {
    const { email, driverName, driverPhone, vehicleDetails, driverLat, driverLng } = req.body;
    
    const user = await User.findOne({ email });
    let driverNameToUse = driverName;
    let driverPhoneToUse = driverPhone;
    let vehicleDetailsToUse = vehicleDetails;
    
    if (user) {
      driverNameToUse = driverName || `${user.first_name} ${user.last_name}`;
      driverPhoneToUse = driverPhone || user.phone;
      
      if (user.vehicle_id) {
        const car = await Car.findOne({ user_id: user._id });
        if (car) {
          vehicleDetailsToUse = vehicleDetails || `${car.color} ${car.make} ${car.model} (${car.plate_number})`;
        }
      }
    }
    
    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      {
        driver_email: email,
        driver_name: driverNameToUse,
        driver_phone: driverPhoneToUse,
        driver_vehicle: vehicleDetailsToUse,
        driver_lat: driverLat,
        driver_lng: driverLng,
        status: 'accepted',
        driver_assigned: true,
        driver_id: user?._id
      },
      { new: true }
    );
    
    // Notify passenger
    io.to(ride.passenger_email).emit('rideUpdated', ride);
    
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Driver starts ride
app.post('/api/rides/:id/start', async (req, res) => {
  try {
    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      { status: 'active' },
      { new: true }
    );
    
    io.to(ride.passenger_email).emit('rideUpdated', ride);
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Driver arrives at pickup
app.post('/api/rides/:id/arrive', async (req, res) => {
  try {
    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      { status: 'active' },
      { new: true }
    );
    
    io.to(ride.passenger_email).emit('rideUpdated', ride);
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete ride
app.post('/api/rides/:id/complete', async (req, res) => {
  try {
    const { final_price } = req.body;
    
    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'completed', 
        price: final_price || 0,
        completed_at: new Date()
      },
      { new: true }
    );
    
    // Update driver stats
    if (ride.driver_id) {
      await DriverProfile.findOneAndUpdate(
        { user_id: ride.driver_id },
        { $inc: { total_trips: 1 } }
      );
    }
    
    io.to(ride.passenger_email).emit('rideUpdated', ride);
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm ride (passenger confirms)
app.post('/api/rides/:id/confirm', async (req, res) => {
  try {
    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'confirmed',
        confirmed_at: new Date()
      },
      { new: true }
    );
    
    io.to(ride.driver_email).emit('rideUpdated', ride);
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel ride
app.post('/api/rides/:id/cancel', async (req, res) => {
  try {
    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled', driver_assigned: false },
      { new: true }
    );
    
    io.emit('rideUpdated', { id: ride._id, status: 'cancelled' });
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update driver location
app.post('/api/rides/:id/driver-location', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      { driver_lat: lat, driver_lng: lng },
      { new: true }
    );
    
    io.to(ride.passenger_email).emit('driverLocationUpdated', { 
      rideId: ride._id, 
      lat, 
      lng 
    });
    
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rate ride
app.post('/api/rides/:id/rate', async (req, res) => {
  try {
    const { rating, comment, userType } = req.body;
    
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    
    if (userType === 'passenger') {
      const passengerRating = new Rating({
        ride_id: ride._id,
        user_email: ride.passenger_email,
        driver_email: ride.driver_email,
        rating,
        comment
      });
      await passengerRating.save();
      
      // Update driver average rating
      const ratings = await Rating.find({ driver_email: ride.driver_email });
      const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      await User.findOneAndUpdate({ email: ride.driver_email }, { rating: avgRating });
      await DriverProfile.findOneAndUpdate({ user_id: ride.driver_id }, { rating: avgRating });
    } else {
      const driverRating = new Rating({
        ride_id: ride._id,
        user_email: ride.driver_email,
        driver_email: ride.passenger_email,
        rating,
        comment
      });
      await driverRating.save();
    }
    
    res.json({ message: 'Rating saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Driver status (online/offline)
app.post('/api/drivers/status', async (req, res) => {
  try {
    const { email, is_online, lat, lng } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await User.findByIdAndUpdate(user._id, {
      is_online,
      current_lat: lat,
      current_lng: lng
    });
    
    await DriverProfile.findOneAndUpdate(
      { user_id: user._id },
      {
        is_online,
        current_lat: lat,
        current_lng: lng
      },
      { upsert: true }
    );
    
    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get nearby drivers
app.get('/api/drivers/nearby', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    
    if (!lat || !lng) {
      // Return all online drivers if no location
      const drivers = await DriverProfile.find({ is_online: true })
        .populate('user_id', 'first_name last_name email phone');
      return res.json(drivers);
    }
    
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = parseFloat(radius) || 5;
    
    // Simple bounding box query
    const latDelta = radiusNum / 111; // 1 degree latitude ≈ 111 km
    const lngDelta = radiusNum / (111 * Math.cos(latNum * Math.PI / 180));
    
    const drivers = await DriverProfile.find({
      is_online: true,
      current_lat: { $gte: latNum - latDelta, $lte: latNum + latDelta },
      current_lng: { $gte: lngNum - lngDelta, $lte: lngNum + lngDelta }
    }).populate('user_id', 'first_name last_name email phone rating');
    
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver info
app.get('/api/drivers/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    let car = null;
    if (user.vehicle_id) {
      car = await Car.findOne({ user_id: user._id });
    }
    
    const driverProfile = await DriverProfile.findOne({ user_id: user._id });
    
    res.json({ user, car, driverProfile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver earnings
app.get('/api/drivers/earnings', async (req, res) => {
  try {
    const { email } = req.query;
    
    const completedRides = await Ride.find({
      driver_email: email,
      status: { $in: ['completed', 'confirmed'] }
    });
    
    const total = completedRides.reduce((sum, ride) => sum + (ride.price || 0), 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRides = completedRides.filter(ride => 
      ride.completed_at && new Date(ride.completed_at) >= today
    );
    const todayEarnings = todayRides.reduce((sum, ride) => sum + (ride.price || 0), 0);
    
    res.json({ total, today: todayEarnings, trips: completedRides.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver stats
app.get('/api/drivers/stats', async (req, res) => {
  try {
    const { email } = req.query;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    const driverProfile = await DriverProfile.findOne({ user_id: user._id });
    
    const completedRides = await Ride.countDocuments({
      driver_email: email,
      status: { $in: ['completed', 'confirmed'] }
    });
    
    res.json({
      rating: driverProfile?.rating || 5.0,
      totalTrips: driverProfile?.total_trips || completedRides,
      isOnline: driverProfile?.is_online || false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fare calculation
app.post('/api/fare/calculate', async (req, res) => {
  try {
    const { distance_km, ride_type } = req.body;
    
    const baseFare = 5;
    const perKm = ride_type === 'luxury' ? 5 : ride_type === 'standard' ? 3 : 2;
    
    const estimatedPrice = baseFare + (distance_km * perKm);
    
    res.json({ estimated_price: estimatedPrice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SOCKET EVENTS ====================

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("joinRoom", (email) => socket.join(email));
  socket.on("leaveRoom", (email) => socket.leave(email));
  
  // Driver goes online
  socket.on("driverOnline", async (data) => {
    console.log('driverOnline event received:', data.email);
    socket.join("onlineDrivers");
    socket.join(data.email);
    socket.driverEmail = data.email;
    socket.driverLocation = data.location;
    
    const user = await User.findOne({ email: data.email });
    if (user) {
      await DriverProfile.findOneAndUpdate(
        { user_id: user._id },
        { 
          is_online: true, 
          current_lat: data.location?.lat, 
          current_lng: data.location?.lng 
        },
        { upsert: true }
      );
    }
    
    io.emit('driverStatusChanged', { email: data.email, isOnline: true, location: data.location });
  });
  
  // Driver goes offline
  socket.on("driverOffline", async (email) => {
    socket.leave("onlineDrivers");
    
    const user = await User.findOne({ email });
    if (user) {
      await DriverProfile.findOneAndUpdate(
        { user_id: user._id },
        { is_online: false, current_lat: null, current_lng: null }
      );
    }
    
    io.emit('driverStatusChanged', { email, isOnline: false });
  });
  
  // Driver location update
  socket.on("updateDriverLocation", async (data) => {
    socket.driverLocation = data.location;
    
    const user = await User.findOne({ email: data.email });
    if (user) {
      await DriverProfile.findOneAndUpdate(
        { user_id: user._id },
        { current_lat: data.location?.lat, current_lng: data.location?.lng }
      );
    }
    
    io.to("onlineDrivers").emit("driverLocationUpdate", data);
    
    if (data.rideId) {
      const ride = await Ride.findById(data.rideId);
      if (ride) {
        io.to(ride.passenger_email).emit('driverLocationUpdated', {
          rideId: ride._id,
          lat: data.location?.lat,
          lng: data.location?.lng
        });
      }
    }
  });
  
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
