# MongoDB Collections - Schema Definitions

Create these collections in MongoDB Atlas and their fields:

---

## 1. users Collection

```javascript
{
  _id: ObjectId,
  first_name: String (required),
  last_name: String (required),
  email: String (required, unique),
  phone: String,
  password: String (required, hashed),
  role: String (enum: "passenger" | "driver", default: "passenger"),
  vehicle_plate: String,
  is_verified: Boolean (default: false),
  is_online: Boolean (default: false),
  current_lat: Number,
  current_lng: Number,
  rating: Number (default: 5.0),
  vehicle_id: ObjectId (ref: cars),
  last_active: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `email` (unique)
- `role`
- `is_online`

---

## 2. cars Collection

```javascript
{
  _id: ObjectId,
  user_id: ObjectId (required, ref: users),
  make: String (required),
  model: String (required),
  year: String (required),
  color: String (required),
  plate_number: String (required, unique),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `user_id`
- `plate_number` (unique)

---

## 3. rides Collection

```javascript
{
  _id: ObjectId,
  passenger_email: String (required),
  driver_email: String,
  driver_name: String,
  driver_phone: String,
  driver_vehicle: String,
  pickup_location: String,
  dropoff_location: String,
  pickup_lat: Number,
  pickup_lng: Number,
  dropoff_lat: Number,
  dropoff_lng: Number,
  price: Number (default: 0),
  status: String (enum: "requested" | "accepted" | "arrived" | "in_progress" | "active" | "completed" | "confirmed" | "cancelled" | "canceled", default: "requested"),
  ride_type: String (enum: "economy" | "standard" | "luxury", default: "economy"),
  driver_lat: Number,
  driver_lng: Number,
  driver_id: ObjectId (ref: users),
  passenger_id: ObjectId (ref: users),
  driver_assigned: Boolean (default: false),
  completed_at: Date,
  confirmed_at: Date,
  distance_km: Number,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `status`
- `driver_email`
- `passenger_email`
- `pickup_lat`, `pickup_lng` (2dsphere recommended)
- `dropoff_lat`, `dropoff_lng`

---

## 4. driverprofiles Collection

```javascript
{
  _id: ObjectId,
  user_id: ObjectId (required, unique, ref: users),
  is_online: Boolean (default: false),
  current_lat: Number,
  current_lng: Number,
  rating: Number (default: 5.0),
  total_trips: Number (default: 0),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `user_id` (unique)
- `is_online`
- `current_lat`, `current_lng` (2dsphere)

---

## 5. ratings Collection

```javascript
{
  _id: ObjectId,
  ride_id: ObjectId (required, ref: rides),
  user_email: String (required),
  driver_email: String (required),
  rating: Number (required, min: 1, max: 5),
  comment: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `driver_email`
- `user_email`
- `ride_id`

---

## 6. emailtokens Collection

```javascript
{
  _id: ObjectId,
  user_id: ObjectId (required, ref: users),
  token: String (required),
  expires_at: Date (required),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `token` (unique)
- `expires_at`

---

# Quick Create Script (MongoDB Shell)

Run this in MongoDB Atlas "MongoDB Shell":

```javascript
// Create collections
db.createCollection("users");
db.createCollection("cars");
db.createCollection("rides");
db.createCollection("driverprofiles");
db.createCollection("ratings");
db.createCollection("emailtokens");

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ is_online: 1 });

db.cars.createIndex({ user_id: 1 });
db.cars.createIndex({ plate_number: 1 }, { unique: true });

db.rides.createIndex({ status: 1 });
db.rides.createIndex({ driver_email: 1 });
db.rides.createIndex({ passenger_email: 1 });

db.driverprofiles.createIndex({ user_id: 1 }, { unique: true });
db.driverprofiles.createIndex({ is_online: 1 });

db.ratings.createIndex({ driver_email: 1 });
db.ratings.createIndex({ user_email: 1 });

db.emailtokens.createIndex({ token: 1 }, { unique: true });
db.emailtokens.createIndex({ expires_at: 1 });

print("Collections and indexes created successfully!");
```

---

# Sample Test Data

```javascript
// Insert test user (password is "test123" hashed with bcrypt)
db.users.insertOne({
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  phone: "+1234567890",
  password: "$2b$10$YOUR_HASHED_PASSWORD_HERE",
  role: "passenger",
  is_verified: true,
  rating: 5.0,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Insert test driver
db.users.insertOne({
  first_name: "Mike",
  last_name: "Driver",
  email: "mike@example.com",
  phone: "+0987654321",
  password: "$2b$10$YOUR_HASHED_PASSWORD_HERE",
  role: "driver",
  vehicle_plate: "ABC123",
  is_verified: true,
  rating: 4.5,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Insert driver profile
db.driverprofiles.insertOne({
  user_id: ObjectId("DRIVER_USER_ID"),
  is_online: false,
  rating: 4.5,
  total_trips: 0,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

---

# Summary

| Collection | Key Fields |
|------------|-----------|
| users | first_name, last_name, email, password, role, rating |
| cars | user_id, make, model, year, color, plate_number |
| rides | passenger_email, driver_email, pickup/dropoff locations, status, price |
| driverprofiles | user_id, is_online, current_lat/lng, rating, total_trips |
| ratings | ride_id, user_email, driver_email, rating, comment |
| emailtokens | user_id, token, expires_at |
