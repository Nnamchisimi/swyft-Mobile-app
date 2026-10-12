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
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { ridesAPI } from '../../src/services/api';
import { authService } from '../../src/services/auth';
import { socketService } from '../../src/services/socket';
import { COLORS } from '../../src/constants/config';
import geoService from '../../src/services/geo';

const { width } = Dimensions.get('window');

export default function TrackRideScreen() {
  const router = useRouter();
  const { rideId } = useLocalSearchParams();

  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const [nearDestination, setNearDestination] = useState(false);
  const currentRideRef = useRef(null);

  useEffect(() => {
    currentRideRef.current = ride;
  }, [ride]);

  useEffect(() => {
    if (!rideId) return;
    loadRide();
    const cleanup = setupSocketListeners();
    return () => { cleanup?.(); };
  }, [rideId]);

  const loadRide = async () => {
    if (!rideId) return;
    try {
      const response = await ridesAPI.getRideById(rideId);
      const rideData = response.data;
      setRide(rideData);

      if (rideData.driver_lat && rideData.driver_lng) {
        setDriverLocation({
          latitude: parseFloat(rideData.driver_lat),
          longitude: parseFloat(rideData.driver_lng),
        });
      }
    } catch (error) {
      console.error('Error loading ride:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProximity = (data) => {
    const current = data || ride;
    if (!current || current.status !== 'picked_up' || !current.dropoff_lat || !current.dropoff_lng || !driverLocation) {
      if (current && current.status !== 'picked_up') setNearDestination(false);
      return;
    }

    const distanceKm = geoService.calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      parseFloat(current.dropoff_lat),
      parseFloat(current.dropoff_lng)
    );
    const mins = Math.max(1, Math.round(distanceKm * 3));
    setEta(mins);
    setNearDestination(distanceKm < 1 || mins < 10);
  };

  const setupSocketListeners = () => {
    socketService.removeAllListeners();
    socketService.connect();

    const email = authService.getUserEmail();
    if (email) {
      socketService.joinRoom(email);
    }

    const handleReconnect = () => {
      const currentEmail = authService.getUserEmail();
      if (currentEmail) {
        socketService.joinRoom(currentEmail);
      }
    };
    socketService.socket?.on('reconnect', handleReconnect);

    const handleRideUpdated = (updatedRide) => {
      const matchesRide = updatedRide.id === rideId || updatedRide.id === ride?.id || String(updatedRide.id) === String(rideId);
      if (matchesRide) {
        setRide((prev) => {
          const base = prev || {};
          const safeRide = Object.fromEntries(
            Object.entries(updatedRide).filter(([_, v]) => v !== undefined)
          );
          return { ...base, ...safeRide };
        });
        currentRideRef.current = { ...(currentRideRef.current || {}), ...updatedRide };

        if (updatedRide.driver_lat && updatedRide.driver_lng) {
          setDriverLocation({
            latitude: parseFloat(updatedRide.driver_lat),
            longitude: parseFloat(updatedRide.driver_lng),
          });
        }

        if (updatedRide.status === 'cancelled') {
          Alert.alert('Ride Cancelled', 'Your ride has been cancelled.');
          router.replace('/(passenger)/home');
        } else if (updatedRide.status === 'completed') {
          router.replace({
            pathname: '/(passenger)/rate-ride',
            params: {
              rideId: updatedRide.id,
              driverName: updatedRide.driver_name,
              driverVehicle: updatedRide.driver_vehicle,
            },
          });
        }
      }
    };

    const handleDriverLocation = (data) => {
      const matchesRide = data.rideId === rideId || data.rideId === ride?.id || String(data.rideId) === String(rideId);
      if (matchesRide) {
        const loc = { latitude: data.lat, longitude: data.lng };
        setDriverLocation(loc);

        if (data.eta) {
          setEta(data.eta);
        } else if (ride?.dropoff_lat && ride?.dropoff_lng) {
          const distanceKm = geoService.calculateDistance(
            data.lat,
            data.lng,
            parseFloat(ride.dropoff_lat),
            parseFloat(ride.dropoff_lng)
          );
          const mins = Math.max(1, Math.round(distanceKm * 3));
          setEta(mins);
        }
      }
    };

    socketService.on('rideUpdated', handleRideUpdated);
    socketService.on('driverLocationUpdated', handleDriverLocation);

    return () => {
      socketService.socket?.off('reconnect', handleReconnect);
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

  const handleCancelRide = async () => {
    if (!ride || cancelling) return;

    Alert.alert('Cancel Delivery', 'Are you sure you want to cancel this delivery?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            const email = await authService.getUserEmail();
            await ridesAPI.cancelRide(ride.id, email);
            Alert.alert('Cancelled', 'Your delivery has been cancelled.');
            router.replace('/(passenger)/home');
          } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Failed to cancel delivery';
            Alert.alert('Error', message);
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleShareOtp = () => {
    if (!ride?.delivery_id) {
      Alert.alert('Info', 'Delivery ID will be shared with the receiver via email.');
      return;
    }

    Alert.alert(
      'Share OTP',
      `Delivery code: ${ride.delivery_id}\n\nAlso sent to: ${ride.receiver_email || ride.passenger_email}`
    );
  };

  const handleTrackRoute = () => {
    if (!driverLocation) {
      Alert.alert('Unavailable', 'Courier location not available yet. Please wait for the courier to accept the delivery.');
      return;
    }
    if (!ride?.dropoff_lat || !ride?.dropoff_lng) {
      Alert.alert('Unavailable', 'Drop-off location not available yet.');
      return;
    }

    const origin = `${driverLocation.latitude},${driverLocation.longitude}`;
    const destination = `${parseFloat(ride.dropoff_lat)},${parseFloat(ride.dropoff_lng)}`;

    const googleUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    const appleUrl = `http://maps.apple.com/?saddr=${origin}&daddr=${destination}`;
    const wazeUrl = `https://waze.com/ul?ll=${destination}&navigate=yes`;

    Alert.alert(
      'Open Navigation',
      'Choose your maps app',
      [
        {
          text: 'Google Maps',
          onPress: () => Linking.openURL(googleUrl).catch(() => Alert.alert('Error', 'Unable to open Google Maps')),
        },
        {
          text: 'Apple Maps',
          onPress: () => Linking.openURL(appleUrl).catch(() => Alert.alert('Error', 'Unable to open Apple Maps')),
        },
        {
          text: 'Waze',
          onPress: () => Linking.openURL(wazeUrl).catch(() => Alert.alert('Error', 'Unable to open Waze')),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending':
        return {
          emoji: '🔍',
          title: 'Looking for courier...',
          subtitle: 'We are matching you with a nearby courier.',
          color: '#FF9500',
        };
      case 'accepted':
        return {
          emoji: '👤',
          title: 'Courier Assigned',
          subtitle: 'Your courier is heading to pickup.',
          color: COLORS.primary,
        };
      case 'arrived_pickup':
        return {
          emoji: '📍',
          title: 'Courier at Pickup',
          subtitle: 'Your courier has arrived at the pickup location.',
          color: '#FF9500',
        };
      case 'picked_up':
        return {
          emoji: '📦',
          title: 'Package in Transit',
          subtitle: nearDestination ? 'Courier arriving' : 'Delivering package',
          color: COLORS.success,
        };
      case 'arrived_dropoff':
        return {
          emoji: '🏠',
          title: 'Courier Arrived',
          subtitle: 'Your courier has arrived at the delivery location.',
          color: '#FF9500',
        };
      case 'completed':
        return {
          emoji: '✓',
          title: 'Delivered',
          subtitle: 'Your package has been delivered successfully.',
          color: COLORS.success,
        };
      case 'cancelled':
        return {
          emoji: '✕',
          title: 'Cancelled',
          subtitle: 'This delivery has been cancelled.',
          color: COLORS.error,
        };
      default:
        return {
          emoji: '📋',
          title: status,
          subtitle: '',
          color: COLORS.textSecondary,
        };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(passenger)/home')}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Package Delivery</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading delivery details...</Text>
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
          <Text style={styles.headerTitle}>Package Delivery</Text>
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Delivery not found</Text>
          <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/(passenger)/home')}>
            <Text style={styles.homeButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const status = getStatusConfig(ride.status);
  const showDriverCard = ride.status === 'accepted' || ride.status === 'picked_up' || ride.status === 'arrived_dropoff';
  const showTripCard = ride.status === 'accepted' || ride.status === 'picked_up' || ride.status === 'arrived_dropoff';
  const showTransitCard = ride.status === 'picked_up' || ride.status === 'arrived_dropoff';
  const showMap = showTransitCard && driverLocation && ride.dropoff_lat && ride.dropoff_lng;
  const isActiveRide = ride.status === 'accepted' || ride.status === 'picked_up';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(passenger)/home')}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Package Delivery</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <Text style={styles.statusEmoji}>{status.emoji}</Text>
          <Text style={styles.statusTitle}>{status.title}</Text>
          <Text style={styles.statusSubtitle}>{status.subtitle}</Text>
        </View>

        {ride.status === 'picked_up' && (
          <View style={styles.pickedUpBanner}>
            <View style={styles.pickedUpIconContainer}>
              <Ionicons name="cube" size={28} color={COLORS.white} />
            </View>
            <View style={styles.pickedUpTextContainer}>
              <Text style={styles.pickedUpTitle}>Package Picked Up</Text>
              <Text style={styles.pickedUpSubtitle}>
                Your package has been picked up by the courier and will be delivered shortly.
              </Text>
            </View>
          </View>
        )}

        {showDriverCard && (
          <View style={styles.driverCard}>
            <View style={styles.driverInfo}>
              <View style={styles.driverAvatar}>
                {ride.driver_profile_picture ? (
                  <Image source={{ uri: ride.driver_profile_picture }} style={styles.driverAvatarImage} />
                ) : (
                  <Text style={styles.driverAvatarText}>{(ride.driver_name || 'D').charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{ride.driver_name || 'Your Courier'}</Text>
                <Text style={styles.ratingRow}>
                  <Text style={styles.ratingStar}>⭐</Text>
                  <Text style={styles.ratingText}>{ride.driver_rating ? Number(ride.driver_rating).toFixed(1) : '5.0'}</Text>
                </Text>
                {ride.vehicle ? (
                  <Text style={styles.driverVehicle}>
                    🚗 {ride.vehicle.year} {ride.vehicle.make} {ride.vehicle.model} · {ride.vehicle.plate}
                  </Text>
                ) : (
                  <Text style={styles.driverVehicle}>🚗 {ride.driver_vehicle || ride.vehicle_type || 'Vehicle'}</Text>
                )}
                {ride.vehicle && ride.vehicle.color && (
                  <Text style={styles.driverVehicle}>Color: {ride.vehicle.color}</Text>
                )}
                <Text style={styles.driverPhone}>{ride.driver_phone || 'Phone not available'}</Text>
              </View>
            </View>
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={[styles.iconButton, styles.callButton]} onPress={() => handleCallDriver(ride.driver_phone)}>
                <Ionicons name="call" size={18} color={COLORS.white} />
                <Text style={styles.iconButtonText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconButton, styles.trackButton]} onPress={handleTrackRoute}>
                <Ionicons name="navigate" size={18} color={COLORS.white} />
                <Text style={styles.iconButtonText}>Track Courier</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showTripCard && (
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
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Estimated fee</Text>
              <Text style={styles.fareValue}>₺{ride.price || '0.00'}</Text>
            </View>
          </View>
        )}

        {showTransitCard && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estimated arrival</Text>
              <Text style={styles.infoValue}>{eta || 'Calculating...'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Delivery ID</Text>
              <Text style={styles.infoValue}>{ride.delivery_id || `#${ride.id}`}</Text>
            </View>
          </View>
        )}

        {showMap && (
          <View style={styles.mapCard}>
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              showsUserLocation
              showsMyLocationButton
            >
              <Marker
                coordinate={{
                  latitude: parseFloat(ride.pickup_lat) || driverLocation.latitude,
                  longitude: parseFloat(ride.pickup_lng) || driverLocation.longitude,
                }}
                title="Pickup"
                pinColor={COLORS.success}
              />
              <Marker
                coordinate={{
                  latitude: parseFloat(ride.dropoff_lat),
                  longitude: parseFloat(ride.dropoff_lng),
                }}
                title="Dropoff"
                pinColor={COLORS.error}
              />
              <Marker coordinate={driverLocation} title="Courier">
                <View style={styles.driverMarkerStyle}>
                  <Ionicons name="car" size={14} color={COLORS.white} />
                </View>
              </Marker>
              <Polyline
                coordinates={[
                  driverLocation,
                  { latitude: parseFloat(ride.dropoff_lat), longitude: parseFloat(ride.dropoff_lng) },
                ]}
                strokeColor={COLORS.primary}
                strokeWidth={4}
              />
            </MapView>
          </View>
        )}

        {ride.status === 'picked_up' && nearDestination && (
          <TouchableOpacity style={styles.shareOtpButton} onPress={handleShareOtp}>
            <Ionicons name="share-social" size={18} color={COLORS.white} />
            <Text style={styles.shareOtpText}>Share OTP with receiver</Text>
          </TouchableOpacity>
        )}

        {!['completed', 'cancelled'].includes(ride.status) && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRide} disabled={cancelling}>
            <Text style={styles.cancelButtonText}>{cancelling ? 'Cancelling...' : ride.status === 'pending' ? 'Cancel Request' : 'Cancel Order'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
    backgroundColor: COLORS.white,
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
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 16,
  },
  statusCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statusEmoji: {
    fontSize: 40,
    marginBottom: 12,
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
    marginTop: 6,
  },
  driverCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  driverAvatarText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  driverAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingStar: {
    fontSize: 14,
    marginRight: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  driverVehicle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  driverPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  callButton: {
    backgroundColor: COLORS.success,
  },
  trackButton: {
    backgroundColor: COLORS.primary,
  },
  iconButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  tripCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
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
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  mapCard: {
    height: 240,
    borderRadius: 20,
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
  shareOtpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  shareOtpText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  cancelButtonText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: '600',
  },
  pickedUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.success,
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 2,
    elevation: 4,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  pickedUpIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickedUpTextContainer: {
    flex: 1,
  },
  pickedUpTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 4,
  },
  pickedUpSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
    fontWeight: '500',
  },
});
