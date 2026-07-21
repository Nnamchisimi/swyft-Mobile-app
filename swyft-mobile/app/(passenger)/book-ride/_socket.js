import { useEffect } from 'react';
import { socketService } from '../../../src/services/socket';
import { ridesAPI } from '../../../src/services/api';
import geoService from '../../../src/services/geo';
import { Alert, Linking } from 'react-native';

export function setupSocketListeners(state) {
  const {
    userEmail, currentRide, setCurrentRide, setRideBooked,
    setPickupLockedForRide, setPickupLocation, setPickupAddress,
    setDriverLocation, setDriverDistance, setDriverStatus,
    setRouteCoordinates, setUserDataLoading,
    setPickupManuallySelected, setDropoffAddress, setSelectedRideType,
    setSelectedVehicleType, setPackageType, setPackageSize,
    setPackageDetails, setSpecialInstructions
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
    console.log('rideUpdated received:', ride);
    if (ride.id === currentRide?.id || ride.passenger_email === userEmail || ride.passengerEmail === userEmail) {
      setCurrentRide(ride);
      setRideBooked(true);
      
      if (ride.status === 'accepted') {
        Alert.alert(
          'Driver Found!',
          `Your courier is on the way!\n\nCourier: ${ride.driver_name || 'Courier'}\nRating: ⭐ ${ride.driver_rating ? Number(ride.driver_rating).toFixed(1) : '5.0'}\nPhone: ${ride.driver_phone || 'N/A'}\nVehicle: ${ride.driver_vehicle || ride.vehicle_type || 'N/A'}`,
          [{ text: 'Great!' }]
        );
        if (ride.driver_lat && ride.driver_lng) {
          setDriverLocation({ latitude: parseFloat(ride.driver_lat), longitude: parseFloat(ride.driver_lng) });
          if (state.pickupLocation) {
            geoService.getETA(
              { latitude: parseFloat(ride.driver_lat), longitude: parseFloat(ride.driver_lng) },
              state.pickupLocation
            ).then(result => {
              if (result?.duration) setDriverDistance(Math.round(result.duration / 60));
            });
          }
        } else if (ride.pickup_lat && ride.pickup_lng) {
          setDriverLocation({ latitude: ride.pickup_lat, longitude: ride.pickup_lng });
        }
      } else if (ride.status === 'arrived_pickup') {
        Alert.alert('Courier Arrived!', `${ride.driver_name || 'Your courier'} has arrived at the pickup location.\n\nPlease hand over the package to the courier.`, [{ text: 'OK' }]);
      } else if (ride.status === 'active') {
        Alert.alert('Package Picked Up', 'Your package is now in transit!');
      } else if (ride.status === 'arriving') {
        Alert.alert('Arriving Soon', 'The courier is almost at your destination!');
      } else if (ride.status === 'completed') {
        Alert.alert(
          'Delivery Completed!',
          `Your delivery has arrived at the destination!\n\nFare: ₺${ride.price || 0}\n\nPlease confirm to release payment to the courier.`,
          [
            {
              text: 'Confirm Delivery',
              onPress: async () => {
                try {
                  await ridesAPI.confirmComplete(ride.id);
                  Alert.alert('Payment Released', 'Payment has been released to the courier. Thank you!');
                  state.resetForm();
                } catch (error) {
                  Alert.alert('Error', 'Failed to confirm delivery');
                }
              },
            },
          ]
        );
      } else if (ride.status === 'cancelled' || ride.status === 'canceled') {
        Alert.alert('Ride Cancelled', 'Your ride has been cancelled.');
        state.resetForm();
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