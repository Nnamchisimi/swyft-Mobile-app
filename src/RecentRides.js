import React, { useEffect, useState } from 'react';
import { Box, Typography, List, ListItem, ListItemText, Divider, useTheme, useMediaQuery } from '@mui/material';
import { io } from 'socket.io-client';

// Same socket instance
const socket = io("http://localhost:3001");

export default function RecentRides({ userEmail }) {
  const [rides, setRides] = useState([]);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  // Fetch initial rides
  useEffect(() => {
    if (!userEmail) return;

    async function fetchRides() {
      try {
       const res = await fetch(`http://localhost:3001/api/rides?passenger_email=${encodeURIComponent(userEmail)}`);

        const data = await res.json();
        setRides(data);
      } catch (err) {
        console.error('Error fetching rides:', err);
      }
    }

    fetchRides();
  }, [userEmail]);

  // Real-time updates
  useEffect(() => {
    if (!userEmail) return;

    socket.emit("joinRoom", userEmail);

    const handleRideUpdate = (rideData) => {
      setRides(prevRides => {
        const index = prevRides.findIndex(r => r.id === rideData.id);
        if (index !== -1) {
          const updated = [...prevRides];
          updated[index] = rideData;
          return updated;
        } else {
          return [rideData, ...prevRides];
        }
      });
    };

    socket.on("rideUpdate", handleRideUpdate);

    return () => {
      socket.off("rideUpdate", handleRideUpdate);
      socket.emit("leaveRoom", userEmail);
    };
  }, [userEmail]);

  return (
    <Box
      sx={{
        width: isDesktop ? 1000 : '100%',
        maxWidth: isDesktop ? 'none' : 500,
        border: '1px solid #ccc',
        borderRadius: 3,
        p: 0,
        mt: isDesktop ? 2 : 0,
        ml: isDesktop ? 4 : 0,
        maxHeight: 500,
        overflowY: 'auto',
        bgcolor: '#f5f5f5',
      }}
    >
      <Box
        sx={{
          width: '100%',
          bgcolor: '#82b1ff',
          color: 'white',
          p: 2,
          fontWeight: 'bold',
          fontSize: isDesktop ? '1.25rem' : '1rem',
          textAlign: 'left',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        Recent Rides
      </Box>
      <List sx={{ p: 2 }}>
        {rides.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No rides found.
          </Typography>
        ) : (
          rides.map(ride => (
            <React.Fragment key={ride.id}>
              <ListItem alignItems="flex-start">
                <ListItemText
                  primary={`${ride.passenger_name} (${ride.ride_type})`}
                  secondary={`${ride.pickup_location} → ${ride.dropoff_location} | Status: ${ride.status || 'pending'}`}
                />
              </ListItem>
              <Divider component="li" />
            </React.Fragment>
          ))
        )}
      </List>
    </Box>
  );
}
