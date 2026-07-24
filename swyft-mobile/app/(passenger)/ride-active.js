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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { ridesAPI } from '../../src/services/api';
import { authService } from '../../src/services/auth';
import { socketService } from '../../src/services/socket';
import { COLORS } from '../../src/constants/config';

export default function RideActiveScreen() {
  const router = useRouter();
  const { rideId } = useLocalSearchParams();

  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState(null);
  const currentRideRef = useRef(null);

  useEffect(() => {
    currentRideRef.current = ride;
  }, [ride]);

  useEffect(() => {
    loadRide();
    const cleanup = setupSocketListeners();
    return () => { cleanup?.(); };
  }, []);

  const loadRide = async () => {
    if (!rideId) return;
    try {
      const response = await ridesAPI.getRideById(rideId);
      setRide(response.data);
    } catch (error) {
      console.error('Error loading ride:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    socketService.removeAllListeners();
    socketService.connect();

    const handleRideUpdated = (updatedRide) => {
      if (updatedRide.id === rideId) {
        setRide(updatedRide);
        currentRideRef.current = updatedRide;

        if (updatedRide.status === 'cancelled' || updatedRide.status === 'canceled') {
          Alert.alert('Ride Cancelled', 'Your ride has been cancelled.');
          router.replace('/(passenger)/home');
        } else if (updatedRide.status === 'completed') {
          router.replace({
            pathname: '/(passenger)/rate-ride',
            params: { rideId: updatedRide.id },
          });
        }
      }
    };

    const handleDriverLocation = (data) => {
      if (data.rideId === rideId) {
        setDriverLocation({ latitude: data.lat, longitude: data.lng });
      }
    };

    socketService.on('rideUpdated', handleRideUpdated);
    socketService.on('driverLocationUpdated', handleDriverLocation);

    return () => {
      socketService.off('rideUpdated', handleRideUpdated);
      socketService.off('driverLocationUpdated', handleDriverLocation);
    };
  };

  const handleCallDriver = (phone) => {
    if (!phone) {
      Alert.alert('Error', 'Driver phone number not available');
      return;
    }
    const url = Platform.select({
      ios: `tel://${phone}`,
      android: `tel://${phone}`,
      default: `tel:${phone}`,
    });
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Unable to make phone call'));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ride in Progress</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading ride details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(passenger)/home')}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ride in Progress</Text>
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Ride not found</Text>
          <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/(passenger)/home')}>
            <Text style={styles.homeButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(passenger)/home')}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride in Progress</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusEmoji}>🚚</Text>
          <Text style={styles.statusTitle}>Your package is on the way!</Text>
          <Text style={styles.statusSubtitle}>Track your courier in real-time.</Text>
        </View>

        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: driverLocation?.latitude || parseFloat(ride.pickup_lat) || 0,
              longitude: driverLocation?.longitude || parseFloat(ride.pickup_lng) || 0,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsUserLocation
            showsMyLocationButton
          >
            {ride.pickup_lat && ride.pickup_lng && (
              <Marker
                coordinate={{
                  latitude: parseFloat(ride.pickup_lat),
                  longitude: parseFloat(ride.pickup_lng),
                }}
                title="Pickup"
                pinColor={COLORS.success}
              />
            )}
            {ride.dropoff_lat && ride.dropoff_lng && (
              <Marker
                coordinate={{
                  latitude: parseFloat(ride.dropoff_lat),
                  longitude: parseFloat(ride.dropoff_lng),
                }}
                title="Dropoff"
                pinColor={COLORS.error}
              />
            )}
            {driverLocation && (
              <Marker
                coordinate={driverLocation}
                title="Courier"
              >
                <View style={styles.driverMarkerStyle}>
                  <Ionicons name="car" size={14} color={COLORS.white} />
                </View>
              </Marker>
            )}
          </MapView>
        </View>

        <View style={styles.driverCard}>
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{(ride.driver_name || 'D').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{ride.driver_name || 'Your Courier'}</Text>
              <Text style={styles.driverPhone}>{ride.driver_phone || 'Phone not available'}</Text>
              <Text style={styles.driverVehicle}>Courier: {ride.driver_vehicle || ride.vehicle_type || 'Vehicle'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.callButton} onPress={() => handleCallDriver(ride.driver_phone)}>
            <Ionicons name="call" size={20} color={COLORS.white} />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tripCard}>
          <View style={styles.tripRow}>
            <View style={[styles.tripDot, { backgroundColor: COLORS.success }]} />
            <View style={styles.tripTextContainer}>
              <Text style={styles.tripLabel}>PICKUP</Text>
              <Text style={styles.tripText}>{ride.pickup_location || ride.pickup || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.tripConnector} />
          <View style={styles.tripRow}>
            <View style={[styles.tripDot, { backgroundColor: COLORS.error }]} />
            <View style={styles.tripTextContainer}>
              <Text style={styles.tripLabel}>DROPOFF</Text>
              <Text style={styles.tripText}>{ride.dropoff_location || ride.dropoff || 'N/A'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.fareCard}>
          <Text style={styles.fareLabel}>Fare</Text>
          <Text style={styles.fareValue}>₺{ride.price || '0.00'}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 20,
    color: COLORS.text,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  errorText: {
    fontSize: 18,
    color: COLORS.error,
    fontWeight: '600',
  },
  homeButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  homeButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  statusHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  statusEmoji: {
    fontSize: 48,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  mapContainer: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  driverMarkerStyle: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 4,
  },
  driverCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  driverInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  driverPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  driverVehicle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  callButton: {
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  callButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  tripCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tripDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  tripTextContainer: {
    flex: 1,
  },
  tripLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 2,
  },
  tripText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 18,
  },
  tripConnector: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.border,
    marginLeft: 5,
    marginVertical: 4,
  },
  fareCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  fareLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  fareValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.success,
  },
});
