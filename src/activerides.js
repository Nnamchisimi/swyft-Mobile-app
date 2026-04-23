import React from 'react'
import { Box, Typography, List, ListItem, ListItemText, Divider, Button, useTheme, useMediaQuery } from '@mui/material'

export default function ActiveRides ({ rides, onCancelRide }) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))

  return (
    <Box sx={{
      width: isDesktop ? 1000 : '100%',
      maxWidth: isDesktop ? 'none' : 500,
      border: '1px solid #ccc',
      borderRadius: 3,
      p: 0,
      mt: isDesktop ? 2 : 0,
      ml: isDesktop ? 4 : 0,
      maxHeight: 500,
      overflowY: 'auto',
      bgcolor: '#f5f5f5'
    }}
    >
      <Box sx={{ width: '100%', bgcolor: '#82b1ff', color: 'white', p: 2, fontWeight: 'bold', fontSize: isDesktop ? '1.25rem' : '1rem', textAlign: 'left', borderTopLeftRadius: 12, borderTopRightRadius: 12, position: 'sticky', top: 0, zIndex: 1 }}>
        Active Rides
      </Box>
      <List sx={{ p: 2 }}>
        {rides.length === 0
          ? (
            <Typography variant='body2' color='text.secondary'>No active rides.</Typography>
            )
          : (
              rides.map((ride) => (
                <React.Fragment key={ride.id || ride._id}>
                  <ListItem alignItems='flex-start' sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ListItemText
                      primary={`#${ride.id || ride._id} - ${ride.passenger_name} (${ride.ride_type})`}
                      secondary={
                        <>
                          <Typography variant='body2' color='textSecondary'>From: {ride.pickup_location}</Typography>
                          <Typography variant='body2' color='textSecondary'>To: {ride.dropoff_location}</Typography>
                          <Typography variant='body2' color='textSecondary'>Passenger: {ride.passenger_name} - {ride.passenger_phone}</Typography>
                          <Typography variant='body2' color='textSecondary'>Driver: {ride.driver_name || '—'}</Typography>
                          <Typography variant='body2' color='textSecondary'>Driver Phone: {ride.driver_phone || '—'}</Typography>
                          <Typography variant='body2' color='textSecondary'>Vehicle: {ride.driver_vehicle || '—'}</Typography>
                          <Typography variant='body2' color='textSecondary'>Requested: {new Date(ride.created_at).toLocaleString()}</Typography>
                          <Typography variant='body2' color='textSecondary'>Fare: ${ride.price?.toFixed(2) || '0.00'}</Typography>
                        </>
                  }
                    />
                    <Button variant='outlined' color='error' size='small' onClick={() => onCancelRide(ride)}>Cancel Ride</Button>
                  </ListItem>
                  <Divider component='li' />
                </React.Fragment>
              ))
            )}
      </List>
    </Box>
  )
}
