import React, { useState } from 'react';
import { Box, Button, Container, TextField, Typography, Link, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

export default function GetStarted() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userType, setUserType] = useState(location.state?.defaultUserType || '');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userType) {
      alert('Please select a user type: Passenger or Driver');
      return;
    }

    if (userType === 'Driver' && !vehiclePlate.trim()) {
      alert('Please provide your vehicle plate');
      return;
    }

    const newUser = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      role: userType,
      phone: phoneNumber.trim() || null,
      vehiclePlate: userType === 'Driver' ? vehiclePlate.trim() : null
    };

    try {
      setLoading(true);

      const res = await fetch('http://localhost:3001/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      const data = await res.json();      
        localStorage.setItem('token', data.token); // optional


      if (!res.ok) {
        if (data.error === 'Email already exists') {
          alert('This email is already registered. Please use a different email.');
        } else {
          alert(data.error || 'Failed to create account');
        }
        setLoading(false);
        return;
      }

      // ✅ Success: show email verification message
      console.log('Account created:', data);
      alert('Account created! Please check your email to verify your account before signing in.');
      navigate('/signin');
    } catch (err) {
      console.error('Error:', err);
      alert('Something went wrong');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <Box
        sx={{
          bgcolor: '#82b1ff',
          color: 'white',
          p: 2,
          textAlign: 'left',
          fontWeight: 'bold',
          fontSize: '1.5rem',
          pl: { xs: 2, sm: '50px' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box
            component="img"
            src="/taxifav.png"
            alt="Taxi Icon"
            sx={{ width: 35, height: 35, mt: -1.25, ml: { xs: 1, sm: 15 } }}
          />
          <Box
            component="span"
            sx={{ fontWeight: 'bold', fontSize: { xs: '1.25rem', sm: '1.75rem' }, ml: '10px' }}
          >
            SWYFT
          </Box>
        </Box>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            mr: { xs: 0, sm: 15 },
            mt: { xs: 2, sm: 0 }
          }}
        >
          <Button
            variant="outlined"
            onClick={() => navigate('/')}
            sx={{
              borderRadius: '15px',
              borderColor: '#ffffff',
              color: '#ffffff',
              fontWeight: 'bold',
              px: { xs: 2, sm: 3 },
              py: { xs: 1, sm: 1.25 },
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: '#ffffff' }
            }}
          >
            Home
          </Button>
        </Box>
      </Box>

      {/* User Type Selector */}
      <Container
        maxWidth="xs"
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 4 }}
      >
        <Typography variant="h6" gutterBottom sx={{ color: '#4e4e4eff' }}>
          Create Account
        </Typography>
        <Typography
          variant="subtitle1"
          sx={{ color: '#4e4e4eff', fontWeight: 'bold', alignSelf: 'flex-start', ml: 1 }}
        >
          I want to join as:
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
          <Button
            variant={userType === 'Passenger' ? 'contained' : 'outlined'}
            onClick={() => setUserType('Passenger')}
            sx={{
              flex: 1,
              borderRadius: '15px',
              borderColor: '#82b1ff',
              color: userType === 'Passenger' ? '#fff' : '#82b1ff',
              backgroundColor: userType === 'Passenger' ? '#82b1ff' : 'transparent',
              fontWeight: 'bold',
              py: 1.25,
              '&:hover': {
                backgroundColor: userType === 'Passenger' ? '#5e97f6' : 'rgba(130,177,255,0.15)',
                borderColor: '#82b1ff'
              }
            }}
          >
            Passenger
          </Button>
          <Button
            variant={userType === 'Driver' ? 'contained' : 'outlined'}
            onClick={() => setUserType('Driver')}
            sx={{
              flex: 1,
              borderRadius: '15px',
              borderColor: '#82b1ff',
              color: userType === 'Driver' ? '#fff' : '#82b1ff',
              backgroundColor: userType === 'Driver' ? '#82b1ff' : 'transparent',
              fontWeight: 'bold',
              py: 1.25,
              '&:hover': {
                backgroundColor: userType === 'Driver' ? '#5e97f6' : 'rgba(130,177,255,0.15)',
                borderColor: '#82b1ff'
              }
            }}
          >
            Driver
          </Button>
        </Box>
      </Container>

      {/* Form */}
      {userType && (
        <Container
          maxWidth="xs"
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4 }}
        >
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ mt: 2, width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              label="First Name"
              fullWidth
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <TextField
              label="Last Name"
              fullWidth
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Phone Number (optional)"
              type="tel"
              fullWidth
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            {userType === 'Driver' && (
              <TextField
                label="Vehicle Plate"
                fullWidth
                required
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
              />
            )}
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                borderRadius: '15px',
                backgroundColor: '#82b1ff',
                fontWeight: 'bold',
                py: 1.25,
                '&:hover': { backgroundColor: '#5e97f6' }
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Create Account'}
            </Button>

            <Typography variant="body2" textAlign="center">
              Already have an account?{' '}
              <Link
                component="button"
                onClick={() => navigate('/signin')}
                sx={{ color: '#82b1ff', fontWeight: 'bold' }}
              >
                Sign In
              </Link>
            </Typography>
          </Box>
        </Container>
      )}
    </>
  );
}
