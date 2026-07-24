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
import { ridesAPI } from '../../src/services/api';
import { authService } from '../../src/services/auth';
import { socketService } from '../../src/services/socket';
import { COLORS } from '../../src/constants/config';

export default function AwaitingDriverScreen() {
  const router = useRouter();
  const { rideId } = useLocalSearchParams();

  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);
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
        } else if (updatedRide.status === 'active') {
          router.replace({
            pathname: '/(passenger)/ride-active',
            params: { rideId: updatedRide.id },
          });
        }
      }
    };

    socketService.on('rideUpdated', handleRideUpdated);

    return () => {
      socketService.off('rideUpdated', handleRideUpdated);
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

  const handleConfirmDriver = async () => {
    if (!ride || confirming) return;

    Alert.alert('Confirm Driver', 'Are you sure you want to confirm this driver?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Confirm',
        style: 'default',
        onPress: async () => {
          setConfirming(true);
          try {
            await ridesAPI.passengerConfirmRide(ride.id);
            Alert.alert('Confirmed!', 'Your driver has been confirmed. Waiting for them to start the ride.');
          } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Failed to confirm driver';
            Alert.alert('Error', message);
          } finally {
            setConfirming(false);
          }
        },
      },
    ]);
  };

  const handleCancelRide = async () => {
    if (!ride || cancelling) return;

    Alert.alert('Cancel Ride', 'Are you sure you want to cancel this ride?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            const email = await authService.getUserEmail();
            await ridesAPI.cancelRide(ride.id, email);
            Alert.alert('Cancelled', 'Your ride has been cancelled.');
            router.replace('/(passenger)/home');
          } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Failed to cancel ride';
            Alert.alert('Error', message);
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Awaiting Driver</Text>
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
          <Text style={styles.headerTitle}>Awaiting Driver</Text>
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
        <Text style={styles.headerTitle}>Awaiting Driver</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusEmoji}>🚗</Text>
          <Text style={styles.statusTitle}>Driver is coming!</Text>
          <Text style={styles.statusSubtitle}>Your courier is on the way to pickup.</Text>
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

        <TouchableOpacity
          style={[styles.confirmButton, confirming && styles.disabledButton]}
          onPress={handleConfirmDriver}
          disabled={confirming}
        >
          <Text style={styles.confirmButtonText}>{confirming ? 'Confirming...' : 'Confirm Driver'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, cancelling && styles.disabledButton]}
          onPress={handleCancelRide}
          disabled={cancelling}
        >
          <Text style={styles.cancelButtonText}>{cancelling ? 'Cancelling...' : 'Cancel Ride'}</Text>
        </TouchableOpacity>
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
    paddingVertical: 32,
    gap: 12,
  },
  statusEmoji: {
    fontSize: 48,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
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
  confirmButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.error,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  cancelButtonText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '600',
  },
});
