import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { ridesAPI, driverAPI } from '../../src/services/api';
import { socketService } from '../../src/services/socket';
import { authService } from '../../src/services/auth';
import { calculateDistance, calculateETA } from './utils';

export function useDriverDashboardState() {
  const [driverInfo, setDriverInfo] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [pendingRides, setPendingRides] = useState([]);
  const [currentRide, setCurrentRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState(null);
  const [passengerLocation, setPassengerLocation] = useState(null);
  const [earnings, setEarnings] = useState({ today_earnings: 0, total_trips: 0 });
  const [eta, setEta] = useState(null);
  const [etaDropoff, setEtaDropoff] = useState(null);

  return {
    driverInfo, setDriverInfo,
    isOnline, setIsOnline,
    pendingRides, setPendingRides,
    currentRide, setCurrentRide,
    loading, setLoading,
    refreshing, setRefreshing,
    location, setLocation,
    passengerLocation, setPassengerLocation,
    earnings, setEarnings,
    eta, setEta,
    etaDropoff, setEtaDropoff,
  };
}

export function useDriverDashboardEffects(state, refs) {
  const {
    setDriverInfo,
    setIsOnline,
    isOnline,
    location,
    setCurrentRide,
    setPendingRides,
    setEarnings,
    setPassengerLocation,
    setLoading,
    setRefreshing,
    setLocation,
    setEta,
    setEtaDropoff,
  } = state;

  const { currentRideRef, locationSubscriptionRef, isOnlineRef, locationRef } = refs;

  useEffect(() => {
    loadDriverData().then(() => {
      setupSocketListeners();
    });
    requestLocation();

    return () => {
      socketService.removeAllListeners();
      if (locationSubscriptionRef.current) {
        try {
          locationSubscriptionRef.current.remove();
        } catch (e) {}
        locationSubscriptionRef.current = null;
      }
    };
  }, []);

  // Make socket re-announce driverOnline after reconnect
  useEffect(() => {
    if (!isOnline || !state.driverInfo?.email || !location) return;

    const email = state.driverInfo.email;
    const driverOnlineData = { email, location: { lat: location.latitude, lng: location.longitude } };

    const handleReconnect = () => {
      console.log('Socket reconnected, re-joining as online driver');
      socketService.joinRoom(email);
      socketService.connectDriver(driverOnlineData);
    };

    socketService.socket?.on('reconnect', handleReconnect);

    return () => {
      socketService.socket?.off('reconnect', handleReconnect);
    };
  }, [isOnline, state.driverInfo?.email, location]);

  useEffect(() => {
    if (!isOnline) return;

    const email = state.driverInfo?.email;
    if (!email) return;

    socketService.joinRoom(email);
    socketService.connectDriver({ email, location: { lat: location?.latitude, lng: location?.longitude } });
  }, [isOnline, state.driverInfo?.email, location]);

  useEffect(() => {
    if (isOnline && location) {
      startLocationTracking();
    } else {
      if (locationSubscriptionRef.current) {
        try {
          locationSubscriptionRef.current.remove();
        } catch (e) {}
        locationSubscriptionRef.current = null;
      }
    }
  }, [isOnline, location]);

  useEffect(() => {
    currentRideRef.current = state.currentRide;
  }, [state.currentRide]);

  async function loadDriverData() {
    const info = await authService.getDriverInfo();
    setDriverInfo(info);
    const email = await authService.getUserEmail();
    console.log('Driver email for earnings:', email);
    if (email) {
      socketService.connect();
      socketService.joinRoom(email);
      console.log('Calling loadEarnings for:', email);
      loadEarnings(email);
      loadActiveRide(email);
      loadVerificationStatus(email);
    }
  }

  const loadVerificationStatus = async (email) => {
    try {
      const response = await driverAPI.getVerificationStatus(email);
      const status = response.data;
      console.log('Driver verification status:', status);
    } catch (error) {
      console.error('Error loading verification status:', error);
      if (error.response?.status === 404) {
        console.log('Verification endpoint not available, allowing driver to proceed');
      }
    }
  };

  const loadActiveRide = async (email) => {
    try {
      const response = await ridesAPI.getRides({
        driver_email: email,
        status: 'driver_accepted,accepted,arrived,active'
      });

      if (response.data && response.data.length > 0) {
        const activeRide = response.data[0];
        setCurrentRide(activeRide);
        currentRideRef.current = activeRide;

        if (activeRide.pickup_lat && activeRide.pickup_lng) {
          setPassengerLocation({
            latitude: parseFloat(activeRide.pickup_lat),
            longitude: parseFloat(activeRide.pickup_lng),
          });
        }

        console.log('Loaded active ride on app start:', activeRide.id, activeRide.status);
      }
    } catch (error) {
      console.error('Error loading active ride:', error);
    }
  };

  const loadEarnings = async (email) => {
    console.log('loadEarnings called with email:', email);
    try {
      console.log('Calling driverAPI.getEarnings...');
      const response = await driverAPI.getEarnings(email);
      console.log('Earnings response:', response);
      const data = response?.data;
      if (data && typeof data === 'object') {
        setEarnings({
          today_earnings: Number(data.today_earnings) || 0,
          total_trips: Number(data.total_trips) || 0,
        });
        console.log('Earnings set:', data);
      }
    } catch (error) {
      console.error('Error loading earnings:', error);

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        console.log('Earnings request timed out, will retry...');

        setTimeout(() => {
          driverAPI.getEarnings(email)
            .then((response) => {
              const data = response?.data;
              if (data && typeof data === 'object') {
                setEarnings({
                  today_earnings: Number(data.today_earnings) || 0,
                  total_trips: Number(data.total_trips) || 0,
                });
              }
            })
            .catch((retryError) => {
              console.error('Retry failed for earnings:', retryError);
            });
        }, 2000);
      }
    }
  };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      locationRef.current = loc.coords;
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const startLocationTracking = () => {
    if (locationSubscriptionRef.current) return;

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (loc) => {
        setLocation(loc.coords);
        locationRef.current = loc.coords;

        const email = state.driverInfo?.email;
        if (email) {
          socketService.updateDriverLocation(email, {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          }, currentRideRef.current?.id, currentRideRef.current?.status);
        }

        if (currentRideRef.current) {
          const ride = currentRideRef.current;
          const currentLat = loc.coords.latitude;
          const currentLng = loc.coords.longitude;

          if ((ride.status === 'driver_accepted' || ride.status === 'accepted' || ride.status === 'arrived_pickup') && ride.pickup_lat && ride.pickup_lng) {
            const distanceToPickup = calculateDistance(currentLat, currentLng, parseFloat(ride.pickup_lat), parseFloat(ride.pickup_lng));
            setEta(calculateETA(distanceToPickup));
          }

          if (ride.status === 'active' && ride.dropoff_lat && ride.dropoff_lng) {
            const distanceToDropoff = calculateDistance(currentLat, currentLng, parseFloat(ride.dropoff_lat), parseFloat(ride.dropoff_lng));
            setEtaDropoff(calculateETA(distanceToDropoff));
          }
        }
      }
    ).then((subscription) => {
      locationSubscriptionRef.current = subscription;
    }).catch((error) => {
      console.error('Error starting location tracking:', error);
    });
  };

  const setupSocketListeners = () => {
    socketService.on('newRide', (ride) => {
    console.log('New ride received:', ride);
    if (isOnlineRef.current) {
      setPendingRides((prev) => {
        if (prev.find(r => r.id === ride.id)) return prev;
        return [...prev, ride];
      });
      Alert.alert(
        'New Ride Request!',
        `Passenger: ${ride.passenger_name || 'Customer'}\nPickup: ${ride.pickup_location || ride.pickup || 'Nearby'}\nFare: ₺${ride.price || '0.00'}`,
        [{ text: 'OK' }]
      );
    }
      console.log('Received newRide event:', ride);

      if (ride.status === 'pending') {
        setPendingRides((prev) => {
          if (prev.find(r => r.id === ride.id)) return prev;

          console.log('Adding new ride to list:', ride.id);
          return [...prev, ride];
        });

        if (isOnlineRef.current) {
          Alert.alert(
            'New Dispatch service Request!',
            `Passenger: ${ride.passenger_name || 'Customer'}\nPickup: ${ride.pickup_location || ride.pickup || 'Nearby'}\nFare: ₺${ride.price || '0.00'}`,
            [{ text: 'OK' }]
          );
        }
      }
    });

    socketService.on('rideUpdated', (ride) => {
      console.log('rideUpdated received:', ride);

      if (ride.driver_email === state.driverInfo?.email) {
        if (ride.status === 'driver_accepted') {
          setCurrentRide(ride);
          Alert.alert('Waiting for Confirmation', 'The passenger is reviewing your acceptance. Please wait for them to confirm.');
        } else if (ride.status === 'accepted' || ride.status === 'arrived_pickup' || ride.status === 'active' || ride.status === 'arriving') {
          setCurrentRide(ride);

          if (ride.pickup_lat && ride.pickup_lng) {
            setPassengerLocation({
              latitude: parseFloat(ride.pickup_lat),
              longitude: parseFloat(ride.pickup_lng),
            });
          }
        } else if (ride.status === 'completed') {
          console.log('Ride completed, reloading earnings');
          loadEarnings(state.driverInfo?.email);
          setCurrentRide(null);
          setPassengerLocation(null);
          fetchPendingRides();
        } else if (ride.status === 'cancelled' || ride.status === 'canceled') {
          Alert.alert('Ride Cancelled', 'The ride has been cancelled.');
          setCurrentRide(null);
          setPassengerLocation(null);
          fetchPendingRides();
        }
      }

      if (ride.id) {
        const acceptedByOther = ride.status === 'driver_accepted' && ride.driver_email !== state.driverInfo?.email;
        const isCancelled = ride.status === 'cancelled' || ride.status === 'canceled';

        if (acceptedByOther || isCancelled) {
          setPendingRides((prev) => {
            const exists = prev.some((r) => (r.id || r._id) === ride.id);
            if (!exists) return prev;
            console.log('Removing stale ride from pending:', ride.id);
            return prev.filter((r) => (r.id || r._id) !== ride.id);
          });
        }
      }
    });

    socketService.on('passengerLocationUpdated', (data) => {
      console.log('Received passenger location update:', data);
      if (state.currentRide && data.rideId === state.currentRide.id) {
        setPassengerLocation({
          latitude: data.lat,
          longitude: data.lng,
        });
      }
    });

    socketService.on('driverStatusChanged', (data) => {
      console.log('Driver status changed:', data);
    });

    socketService.on('dispatchAssigned', (dispatch) => {
      console.log('Dispatch assigned received:', dispatch);
      if (dispatch && dispatch.status === 'pending') {
        setPendingRides((prev) => {
          if (prev.find(d => d.id === dispatch.id)) return prev;
          return [...prev, dispatch];
        });

        if (isOnlineRef.current) {
          Alert.alert(
            'New Dispatch!',
            `Customer: ${dispatch.passenger_name || 'Customer'}\nPickup: ${dispatch.pickup_location || 'Nearby'}\nPrice: ₺${dispatch.price || '0.00'}`,
            [{ text: 'OK' }]
          );
        }
      }
    });

    socketService.on('earningsUpdated', (data) => {
      console.log('Earnings updated received:', data);
      if (data && data.driver_email === state.driverInfo?.email) {
        setEarnings({
          today_earnings: Number(data.today_earnings) || earnings.today_earnings,
          total_trips: Number(data.total_trips) || earnings.total_trips,
        });
      }
    });

    socketService.on('dispatchUpdated', (dispatch) => {
      console.log('Dispatch updated received:', dispatch);
      if (dispatch.driver_email === state.driverInfo?.email) {
        if (dispatch.status === 'accepted' || dispatch.status === 'arrived_pickup' || dispatch.status === 'active' || dispatch.status === 'arriving') {
          setCurrentRide(dispatch);
          if (dispatch.pickup_lat && dispatch.pickup_lng) {
            setPassengerLocation({
              latitude: parseFloat(dispatch.pickup_lat),
              longitude: parseFloat(dispatch.pickup_lng),
            });
          }
        } else if (dispatch.status === 'completed') {
          console.log('Dispatch completed, reloading earnings');
          loadEarnings(state.driverInfo?.email);
          setCurrentRide(null);
          setPassengerLocation(null);
          fetchPendingRides();
        }
      }
    });
  };

  const fetchPendingRides = async () => {
    try {
      setLoading(true);
      const response = await ridesAPI.getRides({ status: 'pending' });

      const pending = response.data.filter(ride => ride.status === 'pending');
      setPendingRides(pending);

    } catch (error) {
      console.error('Error fetching rides:', error);

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        setTimeout(async () => {
          try {
            const response = await ridesAPI.getRides({ status: 'pending' });
            const pending = response.data.filter(ride => ride.status === 'pending');
            setPendingRides(pending);
          } catch (retryError) {
            console.error('Retry failed for rides:', retryError);
          }
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefreshHandler = async () => {
    setRefreshing(true);
    await fetchPendingRides();
    setRefreshing(false);
  };

  return {
    loadDriverData,
    loadVerificationStatus,
    loadActiveRide,
    loadEarnings,
    requestLocation,
    startLocationTracking,
    setupSocketListeners,
    fetchPendingRides,
    onRefreshHandler,
  };
}
