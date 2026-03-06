import React, { useEffect, useState } from 'react';
import socket from "./socket";
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, useTheme, useMediaQuery } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ActiveRides from './activerides';
import axios from 'axios';
import DriverMap from './driverMap';

export default function DriverDashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [pendingRides, setPendingRides] = useState([]);
  const [activeRides, setActiveRides] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [driverInfo, setDriverInfo] = useState({ name: '', email: '', phone: '', vehicle: '' });

  const handleOpenDialog = ride => { setSelectedRide(ride); setOpenDialog(true); };
  const handleCloseDialog = () => { setOpenDialog(false); setSelectedRide(null); };

  // Load driver info from sessionStorage
  useEffect(() => {
    const savedDriver = sessionStorage.getItem('driverInfo');
    if (savedDriver) {
      const driver = JSON.parse(savedDriver);
      driver.name = `${driver.first_name || ''} ${driver.last_name || ''}`.trim();
      setDriverInfo(driver);
    }
  }, []);

  // Fetch driver details from backend
  useEffect(() => {
    const email = JSON.parse(sessionStorage.getItem('driverInfo'))?.email;
    if (!email) return;

    axios.get('http://localhost:3001/api/drivers')
      .then(res => {
        const driver = res.data.find(d => d.email === email);
        if (driver) {
          setDriverInfo({
            name: `${driver.first_name} ${driver.last_name}`,
            email: driver.email,
            phone: driver.phone,
            vehicle: driver.vehicle || '',
          });
        }
      })
      .catch(err => console.error('Error fetching drivers:', err));
  }, []);

  // Fetch rides
  useEffect(() => {
    const fetchRides = async () => {
      try {
        const token = sessionStorage.getItem('authToken');

        // Pending rides
        const pendingRes = await fetch('http://localhost:3001/api/rides', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const pendingData = await pendingRes.json();
        setPendingRides(pendingData.filter(ride => !ride.driver_assigned));

        // Active rides
        if (driverInfo.email) {
          const activeRes = await fetch(`http://localhost:3001/api/active-rides?driver_email=${driverInfo.email}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const activeData = await activeRes.json();
          setActiveRides(activeData);
        }
      } catch (err) {
        console.error('Error fetching rides:', err);
      }
    };

    fetchRides();
    const interval = setInterval(fetchRides, 15000); // 15s
    return () => clearInterval(interval);
  }, [driverInfo.email]);

  const handleCancelRide = async (ride) => {
    const confirmed = window.confirm(`Are you sure you want to cancel ride #${ride.id}?`);
    if (!confirmed) return;

    try {
      const token = sessionStorage.getItem("authToken");
      const res = await fetch(`http://localhost:3001/api/rides/${ride.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel ride");
      setActiveRides(prev => prev.filter(r => r.id !== ride.id));
    } catch (err) {
      console.error("Cancel ride failed:", err.message);
      alert(`Cancel ride failed: ${err.message}`);
    }
  };

  const handleConfirmAccept = async () => {
    if (!selectedRide) return;
    const rideId = selectedRide.id || selectedRide._id;
    if (!rideId) { alert("Invalid ride selected"); return; }

    try {
      const token = sessionStorage.getItem("authToken");
      const response = await fetch(`http://localhost:3001/api/rides/${rideId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(driverInfo),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 400 && data.error.includes("already accepted")) {
          alert("This ride has already been accepted by another driver.");
          setPendingRides(prev => prev.filter(r => (r.id || r._id) !== rideId));
          handleCloseDialog();
          return;
        }
        throw new Error(data.error || "Failed to accept ride");
      }

      const acceptedRide = { ...selectedRide, status: "accepted", driver_name: driverInfo.name, driver_phone: driverInfo.phone, driver_vehicle: driverInfo.vehicle, driver_email: driverInfo.email };
      socket.emit("rideUpdated", acceptedRide);

      setPendingRides(prev => prev.filter(r => (r.id || r._id) !== rideId));
      setActiveRides(prev => [...prev, acceptedRide]);
      handleCloseDialog();
    } catch (error) {
      console.error("Accept ride failed:", error.message);
      alert(`Accept ride failed: ${error.message}`);
    }
  };

  return (
    <Box sx={{ p: 0, bgcolor: '#f0f2f5', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ bgcolor: '#82b1ff', color: 'white', p: 2, display: 'flex', alignItems: 'center', justifyContent: isDesktop ? 'space-between' : 'flex-start', pl: isDesktop ? '50px' : '20px', fontWeight: 'bold', fontSize: isDesktop ? '1.5rem' : '1.25rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <img src="/taxifav.png" alt="Taxi Icon" style={{ width: isDesktop ? 35 : 30, height: isDesktop ? 35 : 30, marginRight: 10 }} />
          <span style={{ fontWeight: 'bold', fontSize: isDesktop ? '1.75rem' : '1.5rem' }}>SWYFT - Driver Dashboard</span>
        </Box>
        {isDesktop && (
          <Box sx={{ display: 'flex', gap: 2, mr: 10 }}>
            <Button variant="contained" sx={{ borderRadius: '15px', backgroundColor: '#fff', color: '#000', fontWeight: 'bold', padding: '10px 24px', '&:hover': { backgroundColor: '#f0f0f0' } }} onClick={() => navigate('/')}>Home</Button>
            <Button variant="outlined" sx={{ borderRadius: '15px', borderColor: '#fff', color: '#fff', fontWeight: 'bold', '&:hover': { borderColor: '#f0f0f0', color: '#f0f0f0' } }} onClick={() => alert('Sign Out')}>Sign Out</Button>
          </Box>
        )}
      </Box>

      <Typography variant="h6" gutterBottom sx={{ mt: 2, pl: isDesktop ? 5 : 3 }}>
        Welcome, {driverInfo.name} ({driverInfo.email}) | Driver Phone: {driverInfo.phone || 'No phone number found'}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', gap: 3, alignItems: isDesktop ? 'flex-start' : 'center', mt: 2, pl: isDesktop ? 5 : 2, pr: isDesktop ? 5 : 2 }}>
        {/* Pending Rides */}
        <Box sx={{ width: isDesktop ? 500 : '100%' }}>
          <Box sx={{ width: '92%', bgcolor: '#82b1ff', color: 'white', p: 2, fontWeight: 'bold', fontSize: '1.25rem', textAlign: 'left', borderTopLeftRadius: 12, borderTopRightRadius: 12, mb: 1 }}>Available Rides</Box>
          <Box sx={{ border: '1px solid #ccc', borderRadius: 3, p: 2, bgcolor: '#f5f5f5', maxHeight: 500, overflowY: 'auto' }}>
            {pendingRides.length === 0 ? <Typography sx={{ mt: 2 }}>No pending rides</Typography> :
              pendingRides.map(ride => (
                <Box key={ride.id} sx={{ border: '1px solid #ccc', borderRadius: 2, p: 2, mb: 2 }}>
                  <Typography># {ride.id} - {ride.passenger_name} ({ride.ride_type})</Typography>
                  <Typography>Pickup: {ride.pickup_location}</Typography>
                  <Typography>Dropoff: {ride.dropoff_location}</Typography>
                  <Typography>Fare: ${ride.price?.toFixed(2) || '0.00'}</Typography>
                  <Button variant="contained" sx={{ mt: 1 }} onClick={() => handleOpenDialog(ride)}>Accept Ride</Button>
                </Box>
              ))
            }
          </Box>
        </Box>

        {/* Driver Map */}
        <DriverMap ride={activeRides[0]} />

        {/* Active Rides */}
        <ActiveRides
          rides={activeRides.filter(ride => ride.driver_email === driverInfo.email)}
          onCancelRide={handleCancelRide}
        />
      </Box>

      {/* Confirm Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Accept Ride</DialogTitle>
        <DialogContent>
          Are you sure you want to accept ride #{selectedRide?.id}?
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleConfirmAccept} variant="contained">Confirm</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
