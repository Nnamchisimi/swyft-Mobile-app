import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_OSM } from 'react-native-maps';
import { ridesAPI } from '../../src/services/api';
import { authService } from '../../src/services/auth';
import { socketService } from '../../src/services/socket';
import { COLORS } from '../../src/constants/config';

export default function DriverArrivedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  
  const rideId = params.rideId;
  const driverName = params.driverName || 'Driver';
  const driverPhone = params.driverPhone || '';
  const driverVehicle = params.driverVehicle || 'Vehicle';
  const pickupAddress = params.pickupAddress || '';
  const dropoffAddress = params.dropoffAddress || '';
  
  const [loading, setLoading] = useState(false);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [rideData, setRideData] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [eta, setEta] = useState(null);
  const mapRef = useRef(null);
  
  
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
  
  useEffect(() => {
    
    getUserInfo();
    
    
    getCurrentLocation();
    
    
    if (rideId) {
      loadRideDetails(rideId);
    }
    
    return () => {
      
      if (userEmail) {
        socketService.leaveRoom(userEmail);
      }
      socketService.removeAllListeners();
    };
  }, [rideId]);
  
  
  useEffect(() => {
    if (userEmail) {
      console.log('Joining passenger room:', userEmail);
      socketService.joinRoom(userEmail);
      setupSocketListeners();
    }
  }, [userEmail, rideId]);
  
  const getUserInfo = async () => {
    try {
      const email = await authService.getUserEmail();
      if (email) {
        setUserEmail(email);
        console.log('User email loaded:', email);
      }
    } catch (error) {
      console.error('Error getting user info:', error);
    }
  };
  
  const loadRideDetails = async (id) => {
    try {
      const response = await ridesAPI.getRideById(id);
      if (response.data) {
        const ride = response.data;
        setRideData(ride);
        
        
        if (ride.pickup_lat && ride.pickup_lng) {
          setPickupLocation({
            latitude: parseFloat(ride.pickup_lat),
            longitude: parseFloat(ride.pickup_lng),
          });
        }
        
        
        if (ride.dropoff_lat && ride.dropoff_lng) {
          setDropoffLocation({
            latitude: parseFloat(ride.dropoff_lat),
            longitude: parseFloat(ride.dropoff_lng),
          });
        }
        
        
        if (ride.driver_lat && ride.driver_lng) {
          setDriverLocation({
            latitude: parseFloat(ride.driver_lat),
            longitude: parseFloat(ride.driver_lng),
          });
          
          
          if (ride.pickup_lat && ride.pickup_lng) {
            const distance = calculateDistance(
              parseFloat(ride.driver_lat),
              parseFloat(ride.driver_lng),
              parseFloat(ride.pickup_lat),
              parseFloat(ride.pickup_lng)
            );
            setEta(calculateETA(distance));
          }
        }
        
        console.log('Loaded ride details:', ride.id, ride.status);
      }
    } catch (error) {
      console.error('Error loading ride details:', error);
    }
  };
  
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      
      if (params.pickupLat && params.pickupLng) {
        setPickupLocation({
          latitude: parseFloat(params.pickupLat),
          longitude: parseFloat(params.pickupLng),
        });
      }
      
      
      if (params.dropoffLat && params.dropoffLng) {
        setDropoffLocation({
          latitude: parseFloat(params.dropoffLat),
          longitude: parseFloat(params.dropoffLng),
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };
  
  const setupSocketListeners = () => {
    
    socketService.removeAllListeners();
    
    socketService.on('rideUpdated', (ride) => {
      console.log('rideUpdated received in driver-arrived:', ride);
      if (ride.id === rideId) {
        if (ride.status === 'arrived' || ride.status === 'active') {
          
          Alert.alert(
            'Driver Arrived!',
            'Your Courier has arrived at the pickup location.',
            [{ text: 'OK' }]
          );
        } else if (ride.status === 'completed') {
          
          Alert.alert(
            'Arrived at Destination!',
            `You have arrived at your destination!\n\nFare: ₺${ride.price || '0.00'}`,
            [{ text: 'Confirm & Rate Courier', onPress: async () => {
              try {
                await ridesAPI.confirmRide(rideId);
              } catch (error) {
                console.log('Confirm error:', error.message);
              }
              router.replace('/(passenger)/rate-ride?rideId=' + rideId);
            }}]
          );
        } else if (ride.status === 'cancelled' || ride.status === 'canceled') {
          Alert.alert('Dispatch Cancelled', 'Your dispatch has been cancelled.');
          router.replace('/(passenger)/home');
        }
      }
    });
    
    
    socketService.on('driverLocationUpdated', (data) => {
      console.log('driverLocationUpdated received in driver-arrived:', data);
      if (data.rideId === rideId) {
        const newLocation = {
          latitude: data.lat,
          longitude: data.lng,
        };
        console.log('Updating Courier location to:', newLocation);
        setDriverLocation(newLocation);
        
        
        if (pickupLocation) {
          const distance = calculateDistance(newLocation.latitude, newLocation.longitude, pickupLocation.latitude, pickupLocation.longitude);
          setEta(calculateETA(distance));
        }
        
        
        if (mapRef.current && newLocation) {
          mapRef.current.animateToRegion({
            latitude: newLocation.latitude,
            longitude: newLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
      }
    });
  };
  
  const handleConfirmPickup = async () => {
    setLoading(true);
    try {
      
      await ridesAPI.updateRideStatus(rideId, 'active');
      
      Alert.alert(
        'Ride Started!',
        'Dispatch is on the way to destination!',
        [{ text: 'OK', onPress: () => router.replace('/(passenger)/home') }]
      );
    } catch (error) {
      console.error('Confirm pickup error:', error);
      Alert.alert('Error', 'Failed to confirm dispatch pickup. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCallDriver = () => {
    if (driverPhone) {
      Linking.openURL(`tel:${driverPhone}`);
    } else {
      Alert.alert('No Phone Number', 'Courier phone number not available.');
    }
  };
  
  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Dispatch',
      'Are you sure you want to cancel this Dispatch service?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await ridesAPI.cancelRide(rideId);
              Alert.alert('Cancelled', 'Your Dispatch has been cancelled.');
              router.replace('/(passenger)/home');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel dispatch');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };
  
  const initialRegion = pickupLocation ? {
    latitude: pickupLocation.latitude,
    longitude: pickupLocation.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : currentLocation ? {
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : {
    latitude: 35.1856,
    longitude: 33.3823,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          provider={PROVIDER_OSM}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {}
          {pickupLocation && (
            <Marker
              coordinate={pickupLocation}
              title="Pickup Location"
              description={pickupAddress}
              pinColor={COLORS.primary}
            />
          )}
          
          {}
          {(dropoffLocation || (params.dropoffLat && params.dropoffLng)) && (
            <Marker
              coordinate={dropoffLocation || {
                latitude: parseFloat(params.dropoffLat),
                longitude: parseFloat(params.dropoffLng),
              }}
              title="Dropoff Location"
              description={dropoffAddress || params.dropoffAddress}
              pinColor={COLORS.error}
            />
          )}
          
          {}
          {driverLocation && (
            <Marker
              coordinate={driverLocation}
              title={driverName}
              description={`${driverVehicle} - Driver's location`}
            >
              <View style={styles.driverMarkerContainer}>
                <View style={styles.driverMarker}>
                  <Text style={styles.driverMarkerIcon}>🚗</Text>
                </View>
                <View style={styles.driverMarkerPulse} />
              </View>
            </Marker>
          )}
          
          {}
          {driverLocation && pickupLocation && (
            <Polyline
              coordinates={[
                driverLocation,
                pickupLocation,
              ]}
              strokeColor={COLORS.primary}
              strokeWidth={4}
              lineDashPattern={[0]}
            />
          )}
          
          {}
          {pickupLocation && (dropoffLocation || (params.dropoffLat && params.dropoffLng)) && (
            <Polyline
              coordinates={[
                pickupLocation,
                dropoffLocation || { latitude: parseFloat(params.dropoffLat), longitude: parseFloat(params.dropoffLng) },
              ]}
              strokeColor={COLORS.success}
              strokeWidth={4}
              lineDashPattern={[0]}
            />
          )}
        </MapView>
      </View>
      
      {}
      <View style={styles.infoCard}>
        <View style={styles.header}>
          <View style={styles.driverIconContainer}>
            <Text style={styles.driverIcon}>🚗</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Driver Arrived!</Text>
            <Text style={styles.subtitle}>Your driver is waiting for you</Text>
            {eta && (
              <Text style={styles.etaText}>📍 {eta}</Text>
            )}
          </View>
        </View>
        
        {}
        <View style={styles.driverInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Driver:</Text>
            <Text style={styles.infoValue}>{driverName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vehicle:</Text>
            <Text style={styles.infoValue}>{driverVehicle}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Pickup:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{pickupAddress}</Text>
          </View>
          {dropoffAddress && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dropoff:</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{dropoffAddress}</Text>
            </View>
          )}
          {rideData?.price && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fare:</Text>
              <Text style={[styles.infoValue, styles.priceValue]}>₺{rideData.price}</Text>
            </View>
          )}
        </View>
        
        {}
        <View style={styles.actions}>
          {}
          <TouchableOpacity
            style={[styles.button, styles.confirmButton]}
            onPress={handleConfirmPickup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>✓ Confirm Pickup</Text>
            )}
          </TouchableOpacity>
          
          {}
          <TouchableOpacity
            style={[styles.button, styles.callButton]}
            onPress={handleCallDriver}
          >
            <Text style={styles.buttonText}>📞 Call Driver</Text>
          </TouchableOpacity>
          
          {}
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancelRide}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel Ride</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  
  driverMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarker: {
    backgroundColor: COLORS.success,
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  driverMarkerIcon: {
    fontSize: 24,
  },
  driverMarkerPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.success,
    opacity: 0.3,
    zIndex: -1,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  driverIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  driverIcon: {
    fontSize: 30,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  etaText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.success,
    marginTop: 4,
  },
  driverInfo: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  actions: {
    gap: 10,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    backgroundColor: COLORS.success,
  },
  callButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '600',
  },
});
