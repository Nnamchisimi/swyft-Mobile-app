import React, { useState } from 'react';
import RideBookingView from './RideBookingView';

export default function RideBooking() {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [passengerName, setPassengerName] = useState('');
  const [passengerEmail, setPassengerEmail] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [rideType, setRideType] = useState('economy');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleRideType = (event, newType) => {
    if (newType !== null) setRideType(newType);
  };

  const handleBooking = () => {
    if (!passengerName.trim() || !pickup.trim() || !dropoff.trim() || !passengerEmail.trim() || !passengerPhone.trim()) {
      setSnackbar({ open: true, message: 'Please fill in all fields.', severity: 'error' });
      return;
    }

    
    const rideData = { passengerName, passengerEmail, passengerPhone, pickup, dropoff, rideType };

    
    fetch('http://localhost:3001/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rideData),
    })
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to book ride');
        }
        return res.json();
      })
      .then(data => {
        setSnackbar({ open: true, message: data.message, severity: 'success' });
        
        setPassengerName('');
        setPassengerEmail('');
        setPassengerPhone('');
        setPickup('');
        setDropoff('');
        setRideType('economy');
      })
      .catch(error => {
        setSnackbar({ open: true, message: error.message, severity: 'error' });
      });
  };

  return (
    <RideBookingView
      passengerName={passengerName}
      onPassengerNameChange={(e) => setPassengerName(e.target.value)}
      passengerEmail={passengerEmail}
      onPassengerEmailChange={(e) => setPassengerEmail(e.target.value)}
      passengerPhone={passengerPhone}
      onPassengerPhoneChange={(e) => setPassengerPhone(e.target.value)}
      pickup={pickup}
      onPickupChange={(e) => setPickup(e.target.value)}
      dropoff={dropoff}
      onDropoffChange={(e) => setDropoff(e.target.value)}
      rideType={rideType}
      onRideTypeChange={handleRideType}
      onBookClick={handleBooking}
      snackbar={snackbar}
      onSnackbarClose={() => setSnackbar({ ...snackbar, open: false })}
    />
  );
}
