import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_OSM } from 'react-native-maps';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { authService } from '../../src/services/auth';
import { ridesAPI, driverAPI } from '../../src/services/api';
import { socketService } from '../../src/services/socket';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';

export default function DriverDashboard() {
  const router = useRouter();
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);
  const isOnlineRef = useRef(false); 
  const locationRef = useRef(null); 
  const currentRideRef = useRef(null); 
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
  


  useEffect(() => {
    
    loadDriverData().then(() => {
      
      setupSocketListeners();
    });
    requestLocation();

    return () => {
      
      socketService.removeAllListeners();
      if (locationSubscription.current) {
        try {
          locationSubscription.current.remove();
        } catch (e) {
          
        }
        locationSubscription.current = null;
      }
    };
  }, []);

  
  useEffect(() => {
    if (isOnline && location) {
      
      startLocationTracking();
    } else {
      
      if (locationSubscription.current) {
        try {
          locationSubscription.current.remove();
        } catch (e) {
          
        }
        locationSubscription.current = null;
      }
    }
  }, [isOnline, location]);

  
  useEffect(() => {
    currentRideRef.current = currentRide;
  }, [currentRide]);

  const loadDriverData = async () => {
    const info = await authService.getDriverInfo();
    setDriverInfo(info);
    const email = await authService.getUserEmail();
    if (email) {
      socketService.connect();
      socketService.joinRoom(email);
      
      loadEarnings(email);
      
      loadActiveRide(email);
    }
  };

  const loadActiveRide = async (email) => {
    try {
      
      const response = await ridesAPI.getRides({ 
        driver_email: email,
        status: 'accepted,arrived,active' 
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
    try {
      const response = await driverAPI.getEarnings(email);
      const data = response?.data;
      if (data && typeof data === 'object') {
        setEarnings({
          today_earnings: Number(data.today_earnings) || 0,
          total_trips: Number(data.total_trips) || 0,
        });
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
    if (locationSubscription.current) return;
    
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000, 
        distanceInterval: 10, 
      },
      (loc) => {
        setLocation(loc.coords);
        locationRef.current = loc.coords;
        
        
        const email = driverInfo?.email;
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
          
          
          if ((ride.status === 'accepted' || ride.status === 'arrived') && ride.pickup_lat && ride.pickup_lng) {
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
      locationSubscription.current = subscription;
    }).catch((error) => {
      console.error('Error starting location tracking:', error);
    });
  };

  const setupSocketListeners = () => {
    
    socketService.on('newRide', (ride) => {
      console.log('Received newRide event:', ride);
      
      if (ride.status === 'pending') {
        
        setPendingRides((prev) => {
          if (prev.find(r => r.id === ride.id)) return prev;
          
          console.log('Adding new ride to list:', ride.id);
          return [...prev, ride];
        });
        
        
        if (isOnlineRef.current) {
          Alert.alert(
            'New Ride Request!',
            `Passenger: ${ride.passenger_name || 'Customer'}\nPickup: ${ride.pickup_location || ride.pickup || 'Nearby'}\nFare: ₺${ride.price || '0.00'}`,
            [{ text: 'OK' }]
          );
        }
      }
    });

    
    socketService.on('rideUpdated', (ride) => {
      console.log('rideUpdated received:', ride);
      if (ride.driver_email === driverInfo?.email || ride.driver_email === driverInfo?.email) {
        if (ride.status === 'accepted' || ride.status === 'arrived' || ride.status === 'active') {
          setCurrentRide(ride);
          
          
          if (ride.pickup_lat && ride.pickup_lng) {
            setPassengerLocation({
              latitude: parseFloat(ride.pickup_lat),
              longitude: parseFloat(ride.pickup_lng),
            });
          }
          
          if (ride.pickup_lat && ride.pickup_lng) {
            setPassengerLocation({
              latitude: ride.pickup_lat,
              longitude: ride.pickup_lng,
            });
          }
        } else if (ride.status === 'completed') {
          
          loadEarnings(driverInfo?.email);
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
    });

    
    socketService.on('passengerLocationUpdated', (data) => {
      console.log('Received passenger location update:', data);
      if (currentRide && data.rideId === currentRide.id) {
        setPassengerLocation({
          latitude: data.lat,
          longitude: data.lng,
        });
      }
    });

    
    socketService.on('driverStatusChanged', (data) => {
      console.log('Driver status changed:', data);
    });
  };

  const toggleOnline = async () => {
    if (!isOnline && !location && !locationRef.current) {
      Alert.alert('Error', 'Location not available. Please try again.');
      return;
    }

    const email = driverInfo?.email || await authService.getUserEmail();
    const currentLocation = location || locationRef.current;
    const newStatus = !isOnline;
    
    if (newStatus) {
      
      socketService.driverOnline(email, {
        lat: currentLocation?.latitude,
        lng: currentLocation?.longitude,
      });
      
      fetchPendingRides();
    } else {
      
      socketService.driverOffline(email);
      setPendingRides([]);
    }
    
    setIsOnline(newStatus);
    isOnlineRef.current = newStatus; 
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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPendingRides();
    setRefreshing(false);
  };

  const handleAcceptRide = async (ride) => {
    
    Alert.alert(
      'Accept Ride',
      `Accept ride from ${ride.passenger_name || ride.passenger_email}?\n\nPickup: ${ride.pickup_location || ride.pickup}\nFare: ₺${ride.price || '0.00'}`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => handleDeclineRide(ride) },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              const driverData = {
                name: `${driverInfo?.firstName || ''} ${driverInfo?.lastName || ''}`.trim() || 'Driver',
                email: driverInfo?.email || await authService.getUserEmail(),
                phone: driverInfo?.phone || 'N/A',
                vehicle: driverInfo?.vehicle || `${driverInfo?.vehicleYear || ''} ${driverInfo?.vehicleMake || ''} ${driverInfo?.vehicleModel || ''}`.trim(),
              };
              
              await ridesAPI.acceptRide(ride.id, driverData);
              
              setCurrentRide({ ...ride, ...driverData, status: 'accepted' });
              setPendingRides((prev) => prev.filter((r) => r.id !== ride.id));
              
              Alert.alert('Success', 'Ride accepted! Navigate to pickup location.');
            } catch (error) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to accept ride');
            }
          },
        },
      ]
    );
  };

  const handleDeclineRide = (ride) => {
    
    setPendingRides((prev) => prev.filter((r) => r.id !== ride.id));
  };

  const handleArrivedAtPickup = async () => {
    if (!currentRide) return;
    
    try {
      await ridesAPI.arriveRide(currentRide.id);
      setCurrentRide({ ...currentRide, status: 'arrived' });
      Alert.alert('Passenger Notified', 'The passenger has been notified that you have arrived.');
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleStartRide = async () => {
    if (!currentRide) return;
    
    try {
      await ridesAPI.startRide(currentRide.id);
      setCurrentRide({ ...currentRide, status: 'active' });
      
      
      if (mapRef.current && currentRide.pickup_lat && currentRide.pickup_lng && currentRide.dropoff_lat && currentRide.dropoff_lng) {
        
        const pickupLat = parseFloat(currentRide.pickup_lat);
        const pickupLng = parseFloat(currentRide.pickup_lng);
        const dropoffLat = parseFloat(currentRide.dropoff_lat);
        const dropoffLng = parseFloat(currentRide.dropoff_lng);
        
        const centerLat = (pickupLat + dropoffLat) / 2;
        const centerLng = (pickupLng + dropoffLng) / 2;
        
        
        const latDelta = Math.abs(dropoffLat - pickupLat) * 1.5 + 0.01;
        const lngDelta = Math.abs(dropoffLng - pickupLng) * 1.5 + 0.01;
        
        mapRef.current.animateToRegion({
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: Math.max(latDelta, 0.02),
          longitudeDelta: Math.max(lngDelta, 0.02),
        }, 1000);
      }
      
      Alert.alert('Ride Started', 'Drive safely!');
    } catch (error) {
      Alert.alert('Error', 'Failed to start ride');
    }
  };

  const handleCompleteRide = async () => {
    if (!currentRide) return;
    
    Alert.alert(
      'Complete Ride',
      'Mark this ride as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await ridesAPI.completeRide(currentRide.id);
              Alert.alert('Success', 'Ride completed! Great job!');
              setCurrentRide(null);
              fetchPendingRides();
              loadEarnings(driverInfo?.email);
            } catch (error) {
              Alert.alert('Error', 'Failed to complete ride');
            }
          },
        },
      ]
    );
  };
  
  
  const openNavigation = (lat, lng, address) => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    const appleMapsUrl = `maps://?daddr=${latitude},${longitude}`;
    const wazeUrl = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
    
    Alert.alert(
      'Open Navigation',
      'Choose a navigation app',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Google Maps',
          onPress: () => Linking.openURL(googleMapsUrl),
        },
        {
          text: 'Waze',
          onPress: () => Linking.openURL(wazeUrl),
        },
        Platform.OS === 'ios' ? {
          text: 'Apple Maps',
          onPress: () => Linking.openURL(appleMapsUrl),
        } : { text: '', style: 'cancel' },
      ]
    );
  };
  
  
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  
  const calculateETA = (distanceKm, avgSpeedKmh = 30) => {
    const timeHours = distanceKm / avgSpeedKmh;
    const timeMinutes = Math.round(timeHours * 60);
    if (timeMinutes < 1) return 'Less than 1 min';
    if (timeMinutes === 1) return '1 min away';
    if (timeMinutes < 60) return `${timeMinutes} mins away`;
    const hours = Math.floor(timeMinutes / 60);
    const mins = timeMinutes % 60;
    return `${hours}h ${mins}m away`;
  };

  const handleCancelCurrentRide = async () => {
    if (!currentRide) return;
    
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride? This may affect your rating.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await ridesAPI.cancelRide(currentRide.id);
              setCurrentRide(null);
              fetchPendingRides();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel ride');
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          
          if (isOnline) {
            const email = await authService.getUserEmail();
            socketService.driverOffline(email);
          }
          await authService.logout();
          socketService.disconnect();
          router.replace('/(auth)/signin');
        },
      },
    ]);
  };

  const renderRideCard = (ride) => {
    return (
      <View key={ride.id} style={styles.rideCard}>
        <View style={styles.rideHeader}>
          <View style={styles.rideIdBadge}>
            <Text style={styles.rideIdText}>#{ride.id}</Text>
          </View>
          <Text style={styles.ridePrice}>₺{ride.price || '15.00'}</Text>
        </View>
        
        <View style={styles.rideLocations}>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>PICKUP</Text>
              <Text style={styles.locationText} numberOfLines={2}>
                {ride.pickup_location || ride.pickup || 'Location not specified'}
              </Text>
            </View>
          </View>
          
          <View style={styles.locationConnector} />
          
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: COLORS.error }]} />
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>DROPOFF</Text>
              <Text style={styles.locationText} numberOfLines={2}>
                {ride.dropoff_location || ride.dropoff || 'Location not specified'}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.ridePassenger}>
          <View style={styles.passengerAvatar}>
            <Text style={styles.passengerAvatarText}>
              {(ride.passenger_name || ride.passenger_email || 'P').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.passengerInfo}>
            <Text style={styles.passengerName}>{ride.passenger_name || 'Passenger'}</Text>
            <Text style={styles.passengerPhone}>{ride.passenger_phone || 'No phone'}</Text>
          </View>
          <View style={styles.rideTypeBadge}>
            <Text style={styles.rideTypeText}>{ride.ride_type || 'Standard'}</Text>
          </View>
        </View>
        
        <View style={styles.rideActions}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={() => handleDeclineRide(ride)}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptRide(ride)}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCurrentRide = () => {
    if (!currentRide) return null;
    
    const statusColors = {
      'accepted': COLORS.primary,
      'arrived': COLORS.secondary,
      'active': COLORS.success,
    };
    
    const statusLabels = {
      'accepted': 'Accepted',
      'arrived': 'Arrived at Pickup',
      'active': 'In Progress',
    };
    
    
    const displayEta = currentRide.status === 'active' ? etaDropoff : eta;
    const etaLabel = currentRide.status === 'active' ? 'ETA to Dropoff' : 'ETA to Pickup';
    
    return (
      <View style={styles.currentRideCard}>
        <View style={styles.currentRideHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.currentRideTitle}>Current Ride</Text>
            {displayEta && (
              <View style={styles.etaContainer}>
                <Text style={styles.etaLabel}>{etaLabel}: </Text>
                <Text style={styles.etaText}>{displayEta}</Text>
              </View>
            )}
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: statusColors[currentRide.status] || COLORS.primary }
          ]}>
            <Text style={styles.statusText}>{statusLabels[currentRide.status] || currentRide.status}</Text>
          </View>
        </View>
        
        <View style={styles.rideLocations}>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>PICKUP</Text>
              <Text style={styles.locationText} numberOfLines={2}>
                {currentRide.pickup_location || currentRide.pickup || 'N/A'}
              </Text>
            </View>
          </View>
          
          <View style={styles.locationConnector} />
          
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: COLORS.error }]} />
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>DROPOFF</Text>
              <Text style={styles.locationText} numberOfLines={2}>
                {currentRide.dropoff_location || currentRide.dropoff || 'N/A'}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.passengerContact}>
          <View style={styles.passengerAvatar}>
            <Text style={styles.passengerAvatarText}>
              {(currentRide.passenger_name || 'P').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.passengerInfo}>
            <Text style={styles.passengerName}>{currentRide.passenger_name || 'Passenger'}</Text>
            <Text style={styles.passengerPhone}>{currentRide.passenger_phone || currentRide.passenger_email}</Text>
          </View>
          <Text style={styles.ridePriceLarge}>₺{currentRide.price || '15.00'}</Text>
        </View>
        
        <View style={styles.currentRideActions}>
          {currentRide.status === 'accepted' && (
            <TouchableOpacity style={styles.arrivedButton} onPress={handleArrivedAtPickup}>
              <Text style={styles.arrivedButtonText}>Arrived at Pickup</Text>
            </TouchableOpacity>
          )}
          {(currentRide.status === 'arrived') && (
            <TouchableOpacity style={styles.startButton} onPress={handleStartRide}>
              <Text style={styles.startButtonText}>Start Ride</Text>
            </TouchableOpacity>
          )}
          {currentRide.status === 'active' && (
            <>
              <TouchableOpacity style={styles.navigationButton} onPress={() => openNavigation(currentRide.dropoff_lat, currentRide.dropoff_lng, currentRide.dropoff_location)}>
                <Ionicons name="navigate" size={20} color={COLORS.white} />
                <Text style={styles.navigationButtonText}>Navigate to Dropoff</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.completeButton} onPress={handleCompleteRide}>
                <Text style={styles.completeButtonText}>Complete Ride</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={styles.cancelRideButton} onPress={handleCancelCurrentRide}>
            <Text style={styles.cancelRideButtonText}>Cancel Ride</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {}
        <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brandName}>SWYFTinc</Text>
          <Text style={styles.headerTitle}>Driver Mode</Text>
          <Text style={styles.headerSubtitle}>{driverInfo?.firstName || 'Driver'}</Text>
        </View>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => router.push('/(driver)/profile')}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {(driverInfo?.firstName || 'D').charAt(0).toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusInfo}>
            <Text style={styles.statusLabel}>Your Status</Text>
            <Text style={[styles.statusValue, isOnline ? styles.onlineText : styles.offlineText]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggleButton, isOnline && styles.toggleButtonActive]}
            onPress={toggleOnline}
          >
            <Text style={[styles.toggleText, isOnline && styles.toggleTextActive]}>
              {isOnline ? 'Go Offline' : 'Go Online'}
            </Text>
          </TouchableOpacity>
        </View>
        {location && (
          <View style={styles.locationInfo}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.locationCoords}>
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </Text>
          </View>
        )}
      </View>

      {}
      <View style={styles.mapContainer}>
        {location ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_OSM}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
            showsCompass={true}
          >
            {}
            <Marker
              coordinate={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              title="Your Location"
              description="You are here"
            >
              <View style={styles.driverMarkerStyle}>
                <Ionicons name="car" size={20} color="white" />
              </View>
            </Marker>
            
            {}
            {passengerLocation && (
              <Marker
                coordinate={passengerLocation}
                title="Passenger Location"
                pinColor={COLORS.success}
              >
                <View style={[styles.driverMarkerStyle, { backgroundColor: COLORS.success }]}>
                  <Ionicons name="person" size={16} color="white" />
                </View>
              </Marker>
            )}
            
            {}
            {currentRide?.pickup_lat && currentRide?.pickup_lng && (
              <Marker
                coordinate={{
                  latitude: parseFloat(currentRide.pickup_lat),
                  longitude: parseFloat(currentRide.pickup_lng),
                }}
                title="Pickup"
                pinColor={COLORS.success}
              />
            )}
            
            {}
            {currentRide?.dropoff_lat && currentRide?.dropoff_lng && (
              <Marker
                coordinate={{
                  latitude: parseFloat(currentRide.dropoff_lat),
                  longitude: parseFloat(currentRide.dropoff_lng),
                }}
                title="Dropoff"
                pinColor={COLORS.error}
              />
            )}
            
            {}
            {currentRide && (currentRide.status === 'accepted' || currentRide.status === 'arrived' || currentRide.status === 'active') && location && currentRide?.pickup_lat && currentRide?.pickup_lng && (
              <Polyline
                coordinates={[
                  { latitude: location.latitude, longitude: location.longitude },
                  { latitude: parseFloat(currentRide.pickup_lat), longitude: parseFloat(currentRide.pickup_lng) },
                ]}
                strokeColor={COLORS.primary}
                strokeWidth={4}
                lineDashPattern={[0]}
              />
            )}
            
            {}
            {(currentRide?.status === 'active') && currentRide?.pickup_lat && currentRide?.pickup_lng && currentRide?.dropoff_lat && currentRide?.dropoff_lng && (
              <>
                <Polyline
                  coordinates={[
                    { latitude: parseFloat(currentRide.pickup_lat), longitude: parseFloat(currentRide.pickup_lng) },
                    { latitude: parseFloat(currentRide.dropoff_lat), longitude: parseFloat(currentRide.dropoff_lng) },
                  ]}
                  strokeColor={COLORS.success}
                  strokeWidth={5}
                  lineDashPattern={[0]}
                />
              </>
            )}
            
            {}
            {currentRide?.status === 'active' && location && currentRide?.dropoff_lat && currentRide?.dropoff_lng && (
              <Polyline
                coordinates={[
                  { latitude: location.latitude, longitude: location.longitude },
                  { latitude: parseFloat(currentRide.dropoff_lat), longitude: parseFloat(currentRide.dropoff_lng) },
                ]}
                strokeColor={COLORS.primary}
                strokeWidth={3}
                lineDashPattern={[10, 5]}
              />
            )}
          </MapView>
        ) : (
          <View style={[styles.mapPlaceholder, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.mapPlaceholderText}>Getting your location...</Text>
          </View>
        )}
      </View>

      {}
      {currentRide && renderCurrentRide()}

        {}
        {isOnline && !currentRide && (
          <View style={styles.availableSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Rides</Text>
            <Text style={styles.rideCount}>{pendingRides.length} requests</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Finding rides...</Text>
            </View>
          ) : pendingRides.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="car" size={48} color={COLORS.gray} />
              <Text style={styles.emptyTitle}>No rides available</Text>
              <Text style={styles.emptyText}>Waiting for ride requests...</Text>
              <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.ridesList}
              contentContainerStyle={styles.ridesListContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              showsVerticalScrollIndicator={false}
            >
              {pendingRides.map(renderRideCard)}
            </ScrollView>
          )}
        </View>
      )}

      {}
      {!isOnline && !currentRide && (
        <View style={styles.offlineContainer}>
          <Ionicons name="cloud-offline" size={48} color={COLORS.gray} />
          <Text style={styles.offlineTitle}>You're Offline</Text>
          <Text style={styles.offlineText}>
            Go online to start receiving ride requests from passengers nearby.
          </Text>
          <TouchableOpacity style={styles.goOnlineButton} onPress={toggleOnline}>
            <Text style={styles.goOnlineButtonText}>Go Online Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {}
      <View style={styles.bottomStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{earnings.total_trips}</Text>
          <Text style={styles.statLabel}>Total Rides</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>₺{earnings.today_earnings?.toFixed(2) || '0.00'}</Text>
          <Text style={styles.statLabel}>Today's Earnings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>⭐ {driverInfo?.rating ? Number(driverInfo.rating).toFixed(1) : '5.0'}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  mapContainer: {
    height: 250,
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  mapPlaceholderText: {
    marginTop: 10,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  driverMarkerStyle: {
    backgroundColor: COLORS.primary,
    padding: 8,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flex: 1,
  },
  brandName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  profileButton: {
    padding: 4,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  statusCard: {
    margin: 16,
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  onlineText: {
    color: COLORS.success,
  },
  offlineText: {
    color: COLORS.error,
  },
  toggleButton: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.error,
  },
  toggleText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  toggleTextActive: {
    color: COLORS.white,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationCoords: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  availableSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  rideCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  ridesList: {
    flex: 1,
  },
  ridesListContent: {
    paddingBottom: 20,
  },
  rideCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  rideCardUrgent: {
    borderLeftColor: COLORS.error,
    backgroundColor: '#fff5f5',
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rideIdBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rideIdText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  ridePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  rideLocations: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  locationConnector: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    marginLeft: 5,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.text,
  },
  ridePassenger: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  passengerAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  passengerPhone: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  rideTypeBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rideTypeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  rideActions: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  currentRideCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  currentRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentRideTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  etaLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  etaText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  passengerContact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },
  ridePriceLarge: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  currentRideActions: {
    marginTop: 16,
    gap: 12,
  },
  arrivedButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  arrivedButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  startButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  completeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  navigationButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  navigationButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  cancelRideButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelRideButtonText: {
    color: COLORS.error,
    fontWeight: '500',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  refreshButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  offlineIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  offlineText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  goOnlineButton: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  goOnlineButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  bottomStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
});
