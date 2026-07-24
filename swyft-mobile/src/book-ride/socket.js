import { useEffect } from 'react';
import { socketService } from '../services/socket';
import { ridesAPI } from '../services/api';
import geoService from '../services/geo';
import { Alert, Linking } from 'react-native';

export function setupSocketListeners(state) {
  const {
    userEmail, currentRide, setCurrentRide, setRideBooked,
    setPickupLockedForRide, setPickupLocation, setPickupAddress,
    setDriverLocation, setDriverDistance, setDriverStatus,
    setRouteCoordinates, setUserDataLoading,
    setPickupManuallySelected, setDropoffAddress, setSelectedRideType,
    setSelectedVehicleType, setPackageType, setPackageSize,
    setPackageDetails, setSpecialInstructions, resetForm
  } = state;

  socketService.connect();
  if (userEmail) socketService.joinRoom(userEmail);

  socketService.on('rideCreated', (ride) => {
    if (ride.passenger_email === userEmail) {
      setCurrentRide({ id: ride.id, ...ride, status: 'requested' });
      setRideBooked(true);
      setPickupLockedForRide(true);
      if (ride.pickup_lat && ride.pickup_lng) {
        setPickupLocation({ latitude: parseFloat(ride.pickup_lat), longitude: parseFloat(ride.pickup_lng) });
      }
      if (ride.pickup || ride.pickup_location) setPickupAddress(ride.pickup || ride.pickup_location);
    }
  });

  socketService.on('rideUpdated', (ride) => {
    if (ride.id === currentRide?.id || ride.passenger_email === userEmail || ride.passengerEmail === userEmail) {
      if (ride.status === 'driver_accepted' || ride.status === 'accepted') {
        if (ride.dropoff_location || ride.dropoff) {
          setDropoffAddress(ride.dropoff_location || ride.dropoff);
        }
        if (ride.price) {
          state.set('estimatedPrice', ride.price);
        }
        if (ride.pickup_lat && ride.pickup_lng) {
          setPickupLocation({ latitude: parseFloat(ride.pickup_lat), longitude: parseFloat(ride.pickup_lng) });
        }
        if (ride.dropoff_lat && ride.dropoff_lng) {
          setDropoffLocation({ latitude: parseFloat(ride.dropoff_lat), longitude: parseFloat(ride.dropoff_lng) });
        }
      }
      setCurrentRide((prev) => ({ ...(prev || {}), ...ride }));
      setRideBooked(true);
      if (ride.status === 'cancelled' || ride.status === 'canceled') {
        setRideBooked(false);
        resetForm();
      }
    }
  });

  socketService.on('dispatchUpdated', (dispatch) => {
    console.log('dispatchUpdated received:', dispatch);
    if (dispatch.passenger_email === userEmail || dispatch.passengerEmail === userEmail) {
      setCurrentRide(dispatch);
      setRideBooked(true);
    }
  });

  return () => socketService.removeAllListeners();
}

export function useDriverLocationListener(state) {
  const { currentRide, currentLocation, dropoffLocation, setDriverLocation, setDriverStatus, setRouteCoordinates, setDriverDistance } = state;

  useEffect(() => {
    const handleAllDriverLocation = (data) => {
      console.log('Received driverLocationUpdated:', data);
      
      if (currentRide && data.rideId === currentRide.id) {
        const newDriverLoc = { latitude: data.lat, longitude: data.lng };
        setDriverLocation(newDriverLoc);
        
        if (data.status) setDriverStatus(data.status);
        
        const pickupLoc = state.pickupLocation ? { latitude: state.pickupLocation.latitude, longitude: state.pickupLocation.longitude } : (currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : null);
        
        const newRoute = [newDriverLoc];
        if (pickupLoc) newRoute.push(pickupLoc);
        if (dropoffLocation) newRoute.push(dropoffLocation);
        setRouteCoordinates(newRoute);
        
        if (currentLocation) {
          const distanceKm = geoService.calculateDistance(
            newDriverLoc.latitude, newDriverLoc.longitude,
            currentLocation.latitude, currentLocation.longitude
          );
          setDriverDistance(Math.round(distanceKm * 2));
        }
      }
    };
    
    socketService.on('driverLocationUpdated', handleAllDriverLocation);
    
    return () => {
      socketService.off('driverLocationUpdated', handleAllDriverLocation);
    };
  }, [currentRide, currentLocation, dropoffLocation]);
}

export { geoService };