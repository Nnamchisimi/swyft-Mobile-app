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

     db.query('UPDATE rides SET driver_lat=$1, driver_lng=$2 WHERE id=$3 AND driver_assigned=true AND status IN ($4,$5)', [lat, lng, rideId, 'accepted', 'picked_up'], (err, result) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (result.rowCount === 0) return res.status(400).json({ error: "Cannot update location" });
      io.emit('driverLocationUpdated', { rideId, lat, lng });
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
        io.emit('rideUpdated', {
          id: ride.id,
          status: 'arrived_dropoff',
          passenger_email: ride.passenger_email,
          driver_email: ride.driver_email,
        });
        res.json({ message: 'Arrived at dropoff', rideId });
      });
    });
  });
}

module.exports = { registerStatusRoutes };
