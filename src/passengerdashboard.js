import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Box,
  Snackbar,
  Alert,
  useMediaQuery,
  useTheme,
  List,
  ListItem,
  ListItemButton
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import RecentRides from './RecentRides';
import socket from "./socket";
import PassengerMap from './passengermap';

// ------------------ LocationInput Component ------------------
function LocationInput({ label, onSelect, value }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    if (!query) return setSuggestions([]);
    const service = new window.google.maps.places.AutocompleteService();
    service.getPlacePredictions(
      { input: query, location: new window.google.maps.LatLng(41.0082, 28.9784), radius: 5000 },
      (predictions, status) => setSuggestions(status === 'OK' && predictions ? predictions : [])
    );
  }, [query]);

  return (
    <Box sx={{ position: 'relative', mb: 2 }}>
      <TextField
        fullWidth
        label={label}
        variant="outlined"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {suggestions.length > 0 && (
        <List
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: 200,
            bgcolor: 'background.paper',
            overflowY: 'auto',
            border: '1px solid #ccc',
            zIndex: 10,
          }}
        >
          {suggestions.map((s) => (
            <ListItem key={s.place_id} disablePadding>
              <ListItemButton
                onClick={() => {
                  setQuery(s.description);
                  setSuggestions([]);
                  onSelect(s.description);
                }}
              >
                {s.description}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}

// ------------------ PassengerDashboard Component ------------------
export default function PassengerDashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const [recentRides, setRecentRides] = useState([]);
  const [passengerName, setPassengerName] = useState('');
  const [passengerEmail, setPassengerEmail] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [rideType, setRideType] = useState('economy');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [selectedRide, setSelectedRide] = useState(null); // currently tracked ride
  const [rideBooked, setRideBooked] = useState(false); // triggers map reset

  // Fetch user email & info
  useEffect(() => {
    const savedEmail = sessionStorage.getItem('userEmail');
    if (savedEmail) setPassengerEmail(savedEmail);
    else {
      async function fetchUserEmail() {
        try {
          const token = sessionStorage.getItem('authToken');
          const res = await fetch('http://localhost:3001/api/user/profile', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (res.ok && data.email) {
            setPassengerEmail(data.email);
            setPassengerName(data.name || '');
            setPassengerPhone(data.phone || '');
            sessionStorage.setItem('userEmail', data.email);
          }
        } catch (err) {
          console.error(err);
        }
      }
      fetchUserEmail();
    }
  }, []);

  // Listen for ride updates
  useEffect(() => {
    if (!passengerEmail) return;
    socket.emit("joinRoom", passengerEmail);

    const handleRideUpdate = (ride) => {
      if (ride.passenger_email !== passengerEmail) return;

      setRecentRides(prev => {
        const exists = prev.find(r => r.id === ride.id);
        if (exists) return prev.map(r => r.id === ride.id ? ride : r);
        else return [ride, ...prev];
      });

      // Track only accepted or in-progress rides
      if (["accepted", "in_progress"].includes(ride.status)) {
        setSelectedRide(ride);
      } else if (selectedRide?.id === ride.id && ride.status === "completed") {
        setSelectedRide(null);
      }

      setSnackbar({ open: true, message: `Ride Update: ${ride.status}`, severity: 'info' });
    };

    socket.on("rideUpdated", handleRideUpdate);
    return () => {
      socket.off("rideUpdated", handleRideUpdate);
      socket.emit("leaveRoom", passengerEmail);
    };
  }, [passengerEmail, selectedRide]);

  const handleChange = (setter) => (e) => setter(e.target.value);
  const handleRideTypeChange = (_, newType) => { if (newType) setRideType(newType); };

  // Handle ride booking
  const onBookClick = async () => {
    if (!passengerName || !passengerEmail || !passengerPhone || !pickup || !dropoff) {
      setSnackbar({ open: true, message: 'Please fill all fields', severity: 'error' });
      return;
    }
    try {
      const response = await fetch('http://localhost:3001/api/rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passengerName, passengerEmail, passengerPhone, pickup, dropoff, rideType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Booking failed');

      setSnackbar({ open: true, message: data.message, severity: 'success' });

      // Reset fields
      setPassengerName('');
      setPassengerPhone('');
      setPickup('');
      setDropoff('');
      setRideType('economy');
      setRideBooked(true);

      socket.emit("newRide", {
        id: data.rideId,
        passenger_name: passengerName,
        passenger_email: passengerEmail,
        passenger_phone: passengerPhone,
        pickup_location: pickup,
        dropoff_location: dropoff,
        ride_type: rideType,
      });
    } catch (error) {
      setSnackbar({ open: true, message: error.message, severity: 'error' });
    }
  };

  const onSnackbarClose = () => setSnackbar(prev => ({ ...prev, open: false }));

  return (
    <>
      {/* Header */}
      <Box sx={{ bgcolor: '#82b1ff', color: 'white', p: 2, textAlign: 'left', fontWeight: 'bold', fontSize: isDesktop ? '1.5rem' : '1.25rem', pl: isDesktop ? '50px' : '20px', display: 'flex', alignItems: 'center', justifyContent: isDesktop ? 'space-between' : 'flex-start' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <img src="/taxifav.png" alt="Taxi Icon" style={{ width: isDesktop ? 35 : 30, height: isDesktop ? 35 : 30, marginRight: 10 }} />
          <span style={{ fontWeight: 'bold', fontSize: isDesktop ? '1.75rem' : '1.5rem' }}>SWYFT - Passenger Dashboard</span>
        </Box>
        <Typography variant="h6" gutterBottom sx={{ mt: 2, pl: isDesktop ? 5 : 3 }}>
          Welcome, {passengerName} ({passengerEmail}) : {passengerPhone}
        </Typography>
        {isDesktop && <Button variant="contained" color="secondary" onClick={() => navigate('/')} sx={{ mr: 15, borderRadius: '15px', backgroundColor: '#ffffff', fontWeight: 'bold', padding: '10px 24px', color: '#000000', '&:hover': { backgroundColor: '#f0f0f0' } }}>Home</Button>}
      </Box>

      {/* Main content */}
      <Box sx={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', justifyContent: 'center', mt: 2, px: isDesktop ? 7 : 2, gap: 3, alignItems: isDesktop ? 'flex-start' : 'center' }}>
        {/* Ride booking form */}
        <Container maxWidth="xs" sx={{ p: 4, border: '1px solid #ccc', borderRadius: 3, width: '100%', maxWidth: 360 }}>
          <Typography variant={isDesktop ? "h5" : "h6"} align={isDesktop ? "left" : "center"} gutterBottom sx={{ fontWeight: 'bold' }}>Book a Ride</Typography>
          <TextField fullWidth label="Passenger Name" margin="normal" value={passengerName} onChange={handleChange(setPassengerName)} />
          <TextField fullWidth label="Passenger Email" margin="normal" value={passengerEmail} disabled />
          <TextField fullWidth label="Passenger Phone" margin="normal" value={passengerPhone} onChange={handleChange(setPassengerPhone)} />

          <LocationInput label="Pickup Location" value={pickup} onSelect={(address) => setPickup(address)} />
          <LocationInput label="Drop-off Location" value={dropoff} onSelect={(address) => setDropoff(address)} />

          <Box sx={{ my: isDesktop ? 3 : 2, display: 'flex', justifyContent: 'center' }}>
            <ToggleButtonGroup value={rideType} exclusive onChange={handleRideTypeChange}>
              <ToggleButton value="economy">Economy — 150 TL</ToggleButton>
              <ToggleButton value="premium">Premium — 200 TL</ToggleButton>
              <ToggleButton value="luxury">Luxury — 300 TL</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Button variant="contained" fullWidth size="large" onClick={onBookClick} sx={{ bgcolor: '#82b1ff', '&:hover': { bgcolor: '#5a8de0' } }}>Book Ride</Button>

          <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={onSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
            <Alert onClose={onSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
          </Snackbar>
        </Container>

        {/* Passenger Map with real-time driver */}
        <PassengerMap
          passengerEmail={passengerEmail}
          pickupLocation={pickup ? { address: pickup } : null}
          dropoffLocation={dropoff ? { address: dropoff } : null}
          ride={selectedRide}
          rideId={selectedRide?.id || null}
          rideBooked={rideBooked}
        />

        {/* Recent rides */}
        <RecentRides userEmail={passengerEmail} />
      </Box>
    </>
  );
}
