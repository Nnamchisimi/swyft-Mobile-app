import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ridesAPI } from '../services/api';
import { authService } from '../services/auth';
import { socketService } from '../services/socket';
import { COLORS } from '../constants/config';

export default function BookRideScreen() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [rideBooked, setRideBooked] = useState(false);
  const [currentRide, setCurrentRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    loadUserData();
    getCurrentLocation();

    return () => {
      socketService.removeAllListeners();
    };
  }, []);

  // Set up socket listeners when userEmail is loaded
  useEffect(() => {
    if (userEmail) {
      setupSocketListeners();
    }
  }, [userEmail]);

  const loadUserData = async () => {
    const email = await authService.getUserEmail();
    setUserEmail(email || '');
  };

  const getCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        setLocationLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(coords);
      setPickupLocation(coords);
      setPickupAddress(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const setupSocketListeners = () => {
    console.log('Setting up socket listeners for:', userEmail);
    socketService.connect();
    
    // Join passenger's email room to receive targeted ride updates
    if (userEmail) {
      console.log('Joining room:', userEmail);
      socketService.joinRoom(userEmail);
    }
    
    // Listen for ride creation confirmation
    socketService.on('rideCreated', (ride) => {
      console.log('rideCreated received:', ride);
      if (ride.passenger_email === userEmail) {
        setCurrentRide(ride);
        setRideBooked(true);
      }
    });
    
    socketService.on('rideUpdated', (ride) => {
      console.log('rideUpdated received:', ride, 'looking for:', userEmail);
      if (ride.passenger_email === userEmail) {
        console.log('Ride update matches passenger!');
        setCurrentRide(prev => ({ ...prev, ...ride }));
        if (ride.status === 'accepted' || ride.status === 'driver_arrived') {
          setRideBooked(true);
          Alert.alert('Driver Found!', `Your driver ${ride.driver_name} has accepted the ride!`);
        } else if (ride.status === 'cancelled' || ride.status === 'canceled') {
          setRideBooked(false);
          setCurrentRide(null);
          Alert.alert('Ride Cancelled', 'Your ride has been cancelled.');
        }
      }
    });

    socketService.on('driverLocationUpdated', (data) => {
      console.log('driverLocationUpdated received:', data);
      if (data.rideId === currentRide?.id) {
        setDriverLocation({ latitude: data.lat, longitude: data.lng });
      }
    });
  };

  const handleBookRide = async () => {
    if (!pickupLocation || !dropoffLocation) {
      Alert.alert('Error', 'Please enter both locations');
      return;
    }

    setLoading(true);
    try {
      const rideData = {
        passengerName: userEmail.split('@')[0],
        passengerEmail: userEmail,
        passengerPhone: 'N/A',
        pickup: pickupAddress,
        dropoff: dropoffAddress,
        rideType: 'standard',
        ridePrice: '15.00',
        pickupLat: pickupLocation.latitude,
        pickupLng: pickupLocation.longitude,
      };

      const response = await ridesAPI.createRide(rideData);
      
      // Join the passenger's email room to receive socket updates
      socketService.joinRoom(userEmail);
      
      setCurrentRide(response.data.ride || response.data);
      setRideBooked(true);
      Alert.alert('Ride Requested', 'Looking for a driver...');
    } catch (error) {
      console.error('Error booking ride:', error);
      Alert.alert('Error', 'Failed to book ride');
    } finally {
      setLoading(false);
    }
  };

  const handlePickupChange = (text) => {
    setPickupAddress(text);
    const coords = text.split(',').map(s => parseFloat(s.trim()));
    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      setPickupLocation({ latitude: coords[0], longitude: coords[1] });
    }
  };

  const handleDropoffChange = (text) => {
    setDropoffAddress(text);
    const coords = text.split(',').map(s => parseFloat(s.trim()));
    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      setDropoffLocation({ latitude: coords[0], longitude: coords[1] });
    }
  };

  const handleCancelRide = async () => {
    if (!currentRide?.id) return;
    
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await ridesAPI.cancelRide(currentRide.id);
              setCurrentRide(null);
              setRideBooked(false);
              Alert.alert('Ride Cancelled', 'Your ride has been cancelled.');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel ride');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Book a Ride</Text>
        
        {/* Show ride status when booked */}
        {rideBooked && currentRide && (
          <View style={styles.rideStatusContainer}>
            {currentRide.status === 'pending' ? (
              <>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.statusTitle}>Finding your driver...</Text>
                <Text style={styles.statusSubtitle}>Waiting for a driver to accept your ride</Text>
                <View style={styles.rideDetailsCard}>
                  <Text style={styles.rideDetailLabel}>Pickup:</Text>
                  <Text style={styles.rideDetailText}>{currentRide.pickup_location || currentRide.pickup}</Text>
                  <Text style={styles.rideDetailLabel}>Dropoff:</Text>
                  <Text style={styles.rideDetailText}>{currentRide.dropoff_location || currentRide.dropoff}</Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelRide}
                >
                  <Text style={styles.cancelButtonText}>Cancel Ride</Text>
                </TouchableOpacity>
              </>
            ) : currentRide.status === 'accepted' ? (
              <>
                <View style={[styles.statusIcon, { backgroundColor: COLORS.success }]}>
                  <Text style={styles.statusIconText}>✓</Text>
                </View>
                <Text style={styles.statusTitle}>Driver Found!</Text>
                <Text style={styles.statusSubtitle}>Your driver is on the way</Text>
                <View style={styles.rideDetailsCard}>
                  <Text style={styles.rideDetailLabel}>Driver:</Text>
                  <Text style={styles.rideDetailText}>{currentRide.driver_name || 'Driver'}</Text>
                  <Text style={styles.rideDetailLabel}>Vehicle:</Text>
                  <Text style={styles.rideDetailText}>{currentRide.driver_vehicle || 'Car'}</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.statusTitle}>Ride Status: {currentRide.status}</Text>
              </>
            )}
          </View>
        )}
        
        {/* Show input form when not waiting for driver */}
        {!rideBooked && (
          <>
            <View style={styles.locationBox}>
              <Text style={styles.label}>Pickup Location</Text>
              <TextInput
                style={styles.input}
                placeholder="lat, lng"
                value={pickupAddress}
                onChangeText={handlePickupChange}
              />
            </View>

            <View style={styles.locationBox}>
              <Text style={styles.label}>Dropoff Location</Text>
              <TextInput
                style={styles.input}
                placeholder="lat, lng"
                value={dropoffAddress}
                onChangeText={handleDropoffChange}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, (!pickupLocation || !dropoffLocation) && styles.buttonDisabled]}
              onPress={handleBookRide}
              disabled={!pickupLocation || !dropoffLocation || loading}
            >
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Request Ride</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.locationBtn} onPress={getCurrentLocation}>
              <Text style={styles.locationBtnText}>Get Current Location</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: COLORS.text },
  locationBox: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: COLORS.text },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  locationBtn: { marginTop: 16, alignItems: 'center' },
  locationBtnText: { color: COLORS.primary, fontSize: 14 },
  // Ride status styles
  rideStatusContainer: { 
    backgroundColor: '#f8f9fa', 
    borderRadius: 12, 
    padding: 24, 
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: COLORS.text, 
    marginTop: 16,
    textAlign: 'center',
  },
  statusSubtitle: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 8,
    textAlign: 'center',
  },
  statusIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconText: {
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
  },
  rideDetailsCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    marginTop: 16,
  },
  rideDetailLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginTop: 8,
  },
  rideDetailText: {
    fontSize: 14,
    color: COLORS.text,
    marginTop: 2,
  },
  cancelButton: {
    backgroundColor: COLORS.error || '#dc3545',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
