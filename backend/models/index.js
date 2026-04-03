const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  password: { type: String, required: true },
  role: { type: String, enum: ['passenger', 'driver'], default: 'passenger' },
  vehicle_plate: { type: String },
  is_verified: { type: Boolean, default: false },
  is_online: { type: Boolean, default: false },
  current_lat: { type: Number },
  current_lng: { type: Number },
  rating: { type: Number, default: 5.0 },
  vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Car' },
  last_active: { type: Date }
}, { timestamps: true });

// Car Schema (for driver vehicles)
const carSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: String, required: true },
  color: { type: String, required: true },
  plate_number: { type: String, required: true }
}, { timestamps: true });

// Ride Schema
const rideSchema = new mongoose.Schema({
  passenger_email: { type: String, required: true },
  driver_email: { type: String },
  driver_name: { type: String },
  driver_phone: { type: String },
  driver_vehicle: { type: String },
  pickup_location: { type: String },
  dropoff_location: { type: String },
  pickup_lat: { type: Number },
  pickup_lng: { type: Number },
  dropoff_lat: { type: Number },
  dropoff_lng: { type: Number },
  price: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['requested', 'accepted', 'arrived', 'in_progress', 'active', 'completed', 'confirmed', 'cancelled', 'canceled'], 
    default: 'requested' 
  },
  ride_type: { type: String, enum: ['economy', 'standard', 'luxury'], default: 'economy' },
  driver_lat: { type: Number },
  driver_lng: { type: Number },
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  passenger_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  driver_assigned: { type: Boolean, default: false },
  completed_at: { type: Date },
  confirmed_at: { type: Date },
  distance_km: { type: Number },
  package_type: { type: String },
  package_size: { type: String },
  package_details: { type: String },
  special_instructions: { type: String },
  vehicle_type: { type: String }
}, { timestamps: true });

// Indexes for ride queries
rideSchema.index({ status: 1 });
rideSchema.index({ driver_email: 1 });
rideSchema.index({ passenger_email: 1 });
rideSchema.index({ pickup_lat: 1, pickup_lng: 1 });
rideSchema.index({ dropoff_lat: 1, dropoff_lng: 1 });

// Driver Profile Schema
const driverProfileSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  is_online: { type: Boolean, default: false },
  current_lat: { type: Number },
  current_lng: { type: Number },
  rating: { type: Number, default: 5.0 },
  total_trips: { type: Number, default: 0 }
}, { timestamps: true });

// Rating Schema
const ratingSchema = new mongoose.Schema({
  ride_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  user_email: { type: String, required: true },
  driver_email: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String }
}, { timestamps: true });

ratingSchema.index({ driver_email: 1 });
ratingSchema.index({ user_email: 1 });

// Email Verification Token Schema
const emailTokenSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  expires_at: { type: Date, required: true }
}, { timestamps: true });

// Export models
const User = mongoose.model('User', userSchema);
const Car = mongoose.model('Car', carSchema);
const Ride = mongoose.model('Ride', rideSchema);
const DriverProfile = mongoose.model('DriverProfile', driverProfileSchema);
const Rating = mongoose.model('Rating', ratingSchema);
const EmailToken = mongoose.model('EmailToken', emailTokenSchema);

module.exports = {
  User,
  Car,
  Ride,
  DriverProfile,
  Rating,
  EmailToken
};
