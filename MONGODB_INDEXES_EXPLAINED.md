# Why Indexes? 

Indexes are like a book index - they help MongoDB find data **much faster** without scanning every document.

---

## Why These Indexes?

| Index | Why You Need It |
|-------|-----------------|
| `status` | When querying "get all requested rides" or "get active rides" - without index, MongoDB scans EVERY ride |
| `driver_email` | When driver checks their ride history - without index, slow on large data |
| `passenger_email` | When passenger views their ride history - without index, slow |
| `pickup_lat/lng` | For finding nearby rides/drivers by location |
| `dropoff_lat/lng` | For location-based queries |

---

## Index Types Explained

| Type | Use Case |
|------|----------|
| **Single Field** `{ status: 1 }` | Filter by one field |
| **Compound** `{ status: 1, driver_email: 1 }` | Filter by multiple fields together |
| **2dsphere** `{ pickup_location: "2dsphere" }` | Geo/ location queries (find nearby) |
| **Unique** `{ email: 1 }, { unique: true }` | No duplicate values allowed |

---

## Correct Index Commands for Rides

```javascript
// Single field indexes (most common)
db.rides.createIndex({ status: 1 });
db.rides.createIndex({ driver_email: 1 });
db.rides.createIndex({ passenger_email: 1 });

// For location queries - use 2dsphere (recommended but requires GeoJSON)
db.rides.createIndex({ pickup_location: "2dsphere" });
db.rides.createIndex({ dropoff_location: "2dsphere" });

// Alternative: regular 2D index for simple lat/lng
db.rides.createIndex({ pickup_lat: 1, pickup_lng: 1 });
db.rides.createIndex({ dropoff_lat: 1, dropoff_lng: 1 });

// For sorting
db.rides.createIndex({ createdAt: -1 }); // newest first
```

---

## If You Want Location Queries (Find Nearby Drivers)

The proper way is using **GeoJSON** format in MongoDB. Change your rides collection to store locations as GeoJSON:

```javascript
{
  pickup_location: {
    type: "Point",
    coordinates: [longitude, latitude]  // Note: [lng, lat] NOT [lat, lng]
  }
}
```

Then create 2dsphere index:
```javascript
db.rides.createIndex({ pickup_location: "2dsphere" });
```

Then you can query:
```javascript
db.rides.find({
  pickup_location: {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [lng, lat]
      },
      $maxDistance: 5000 // meters
    }
  }
})
```

---

## Simple Version (Recommended)

If you don't need "find nearby" geo queries, just use regular indexes:

```javascript
// Just these 4 - enough for most apps
db.rides.createIndex({ status: 1 });
db.rides.createIndex({ driver_email: 1 });
db.rides.createIndex({ passenger_email: 1 });
db.rides.createIndex({ createdAt: -1 });
```

---

## Why It Matters

| Without Index | With Index |
|--------------|------------|
| 100 rides = scans all 100 | 100 rides = instantly finds 5 |
| 10,000 rides = VERY SLOW | 10,000 rides = fast |
| 1,000,000 rides = minutes | 1,000,000 rides = milliseconds |

**Indexes make your app feel fast!** Without them, your app will slow down as users/rides increase.
