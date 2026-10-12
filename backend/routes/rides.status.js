function calculateEtaString(driverLat, driverLng, dropoffLat, dropoffLng) {
  if (!isFinite(driverLat) || !isFinite(driverLng) || !isFinite(dropoffLat) || !isFinite(dropoffLng)) return null;
  const R = 6371;
  const dLat = (dropoffLat - driverLat) * Math.PI / 180;
  const dLng = (dropoffLng - driverLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(driverLat * Math.PI / 180) * Math.cos(dropoffLat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  const avgSpeedKmh = 30;
  const timeHours = distanceKm / avgSpeedKmh;
  const timeMinutes = Math.round(timeHours * 60);
  if (timeMinutes < 1) return 'Less than 1 min';
  if (timeMinutes === 1) return '1 min away';
  if (timeMinutes < 60) return `${timeMinutes} mins away`;
  const hours = Math.floor(timeMinutes / 60);
  const mins = timeMinutes % 60;
  return `${hours}h ${mins}m away`;
}

function registerStatusRoutes(app, io, db) {
  app.post('/api/rides/:id/confirm-pickup', (req, res) => {
    const rideId = req.params.id;
    db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, rides) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (!rides || rides.rows.length === 0) return res.status(404).json({ error: "Ride not found" });

      const ride = rides.rows[0];
      if (ride.status === 'completed') {
        return res.json({ message: "Ride already completed", rideId });
      }

      res.status(400).json({ error: "Ride must be completed first" });
    });
  });

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

  app.post('/api/rides/:id/driver-location', (req, res) => {
    const rideId = req.params.id;
    const { lat, lng } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: "Latitude and longitude required" });

     db.query('UPDATE rides SET driver_lat=$1, driver_lng=$2 WHERE id=$3 AND driver_assigned=true AND status IN ($4,$5) RETURNING dropoff_lat, dropoff_lng', [lat, lng, rideId, 'accepted', 'picked_up'], (err, result) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (result.rowCount === 0) return res.status(400).json({ error: "Cannot update location" });
      const ride = result.rows[0];
      const eta = calculateEtaString(lat, lng, ride.dropoff_lat, ride.dropoff_lng);
      io.emit('driverLocationUpdated', { rideId, lat, lng, eta });
      res.json({ message: "Driver location updated", rideId });
    });
  });

  app.post('/api/rides/:id/start', (req, res) => {
    const rideId = req.params.id;
    db.query("UPDATE rides SET status = 'picked_up' WHERE id = $1 AND status IN ($2, $3)", [rideId, 'accepted', 'arrived_pickup'], (err, result) => {
      if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
      if (result.rowCount === 0) return res.status(400).json({ error: 'Cannot start ride - ride may not be accepted' });

      db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, rides) => {
        if (err || !rides || rides.rows.length === 0) {
          io.emit('rideUpdated', { id: rideId, status: 'picked_up' });
          return res.json({ message: 'Ride started', rideId });
        }

        const ride = rides.rows[0];
        io.emit('rideUpdated', {
          id: ride.id,
          status: 'picked_up',
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
          status: 'picked_up',
          passenger_email: ride.passenger_email,
          driver_email: ride.driver_email,
        });
         res.json({ message: 'Ride started', rideId });
       });
     });
   });

  app.post('/api/rides/:id/arrive', (req, res) => {
    const rideId = req.params.id;
    db.query("UPDATE rides SET status = 'arrived_dropoff' WHERE id = $1 AND status = $2", [rideId, 'picked_up'], (err, result) => {
      if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
      if (result.rowCount === 0) return res.status(400).json({ error: 'Cannot mark as arrived - ride may not be picked up' });

      db.query('SELECT * FROM rides WHERE id = $1', [rideId], (err, rides) => {
        if (err || !rides || rides.rows.length === 0) {
          io.emit('rideUpdated', { id: rideId, status: 'arrived_dropoff' });
          return res.json({ message: 'Arrived at dropoff', rideId });
        }

        const ride = rides.rows[0];
        const updatedRidePayload = {
          id: ride.id,
          passenger_email: ride.passenger_email,
          driver_email: ride.driver_email,
          status: 'arrived_dropoff',
          pickup_location: ride.pickup_location,
          dropoff_location: ride.dropoff_location,
          pickup_lat: ride.pickup_lat,
          pickup_lng: ride.pickup_lng,
          dropoff_lat: ride.dropoff_lat,
          dropoff_lng: ride.dropoff_lng,
          driver_name: ride.driver_name,
          driver_phone: ride.driver_phone,
          driver_vehicle: ride.driver_vehicle,
          driver_lat: ride.driver_lat,
          driver_lng: ride.driver_lng,
          driver_rating: ride.driver_rating,
          price: ride.price,
          delivery_id: ride.delivery_id,
          receiver_email: ride.receiver_email,
          receiver_phone: ride.receiver_phone,
          receiver_name: ride.receiver_name,
          created_at: ride.created_at,
        };
        io.emit('rideUpdated', updatedRidePayload);
        res.json({ message: 'Arrived at dropoff', rideId, ride: updatedRidePayload });
      });
    });
  });
}

module.exports = { registerStatusRoutes };
