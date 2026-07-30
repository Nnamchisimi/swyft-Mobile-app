import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ridesAPI } from '../../src/services/api';
import { authService } from '../../src/services/auth';
import { COLORS } from '../../src/constants/config';

export default function RideDetailsScreen() {
  const router = useRouter();
  const { rideId } = useLocalSearchParams();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (rideId) loadRide();
  }, [rideId]);

  const loadRide = async () => {
    try {
      const response = await ridesAPI.getRideById(rideId);
      setRide(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load ride details');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setResending(true);
      await ridesAPI.resendOtp?.(rideId);
      Alert.alert('OTP Sent', 'A new 6-digit OTP has been sent to your email.');
    } catch (error) {
      Alert.alert('Error', 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'confirmed':
        return COLORS.success;
      case 'cancelled':
        return COLORS.error;
      case 'picked_up':
      case 'arrived_dropoff':
        return '#FF9500';
      case 'accepted':
      case 'arrived_pickup':
        return COLORS.primary;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Awaiting Courier';
      case 'accepted':
        return 'Courier Assigned';
      case 'arrived_pickup':
        return 'Courier at Pickup';
      case 'picked_up':
        return 'Package in Transit';
      case 'arrived_dropoff':
        return 'Courier Arrived at Dropoff';
      case 'completed':
      case 'confirmed':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const maskOtp = (otp) => {
    if (!otp) return null;
    if (otp.length === 6) {
      return `${otp.slice(0, 3)} ${otp.slice(3)}`;
    }
    return otp;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Details</Text>
          <View style={{ width: 40 }} />
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
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Details</Text>
          <View style={{ width: 40 }} />
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery Details</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.statusCard}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(ride.status)}</Text>
          </View>
          <Text style={styles.deliveryIdText}>Delivery #{ride.delivery_id || ride.id}</Text>
        </View>

        {ride.delivery_otp_plain && (
          <View style={styles.otpCard}>
            <View style={styles.otpHeader}>
              <Ionicons name="key" size={20} color={COLORS.primary} />
              <Text style={styles.otpTitle}>Package Verification OTP</Text>
            </View>
            <Text style={styles.otpValue}>{maskOtp(ride.delivery_otp_plain)}</Text>
            <Text style={styles.otpHint}>
              Share this code with your courier when they arrive to confirm delivery.
            </Text>
            {ride.delivery_otp_expires_at && (
              <Text style={styles.otpExpiry}>
                Expires: {new Date(ride.delivery_otp_expires_at).toLocaleString()}
              </Text>
            )}
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendOtp}
              disabled={resending}
            >
              {resending ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.resendButtonText}>Resend OTP</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!ride.delivery_otp_plain && (
          <View style={styles.otpCard}>
            <View style={styles.otpHeader}>
              <Ionicons name="information-circle" size={20} color={COLORS.textSecondary} />
              <Text style={styles.otpTitle}>Package Verification</Text>
            </View>
            <Text style={styles.otpHint}>
              The 6-digit OTP was sent to {ride.receiver_email || 'your email'}. Check your inbox to share it with your courier.
            </Text>
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendOtp}
              disabled={resending}
            >
              {resending ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.resendButtonText}>Resend OTP</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Delivery Information</Text>

          <View style={styles.detailRow}>
            <Ionicons name="person" size={18} color={COLORS.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Customer</Text>
              <Text style={styles.detailValue}>{ride.passenger_name || ride.passenger_email}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="location" size={18} color={COLORS.success} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Pickup</Text>
              <Text style={styles.detailValue}>{ride.pickup_location || ride.pickup || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="flag" size={18} color={COLORS.error} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Dropoff</Text>
              <Text style={styles.detailValue}>{ride.dropoff_location || ride.dropoff || 'N/A'}</Text>
            </View>
          </View>

          {(ride.receiver_name || ride.receiver_email || ride.receiver_phone) && (
            <View style={styles.detailRow}>
              <Ionicons name="person" size={18} color={COLORS.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Receiver</Text>
                {ride.receiver_name && <Text style={styles.detailValue}>{ride.receiver_name}</Text>}
                {ride.receiver_email && <Text style={styles.detailValue}>{ride.receiver_email}</Text>}
                {ride.receiver_phone && <Text style={styles.detailValue}>{ride.receiver_phone}</Text>}
              </View>
            </View>
          )}

          {ride.driver_name && (
            <View style={styles.detailRow}>
              <Ionicons name="car" size={18} color={COLORS.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Courier</Text>
                <Text style={styles.detailValue}>{ride.driver_name}</Text>
              </View>
            </View>
          )}

          {ride.price && (
            <View style={styles.detailRow}>
              <Ionicons name="cash" size={18} color={COLORS.success} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Price</Text>
                <Text style={styles.detailValue}>₺{ride.price}</Text>
              </View>
            </View>
          )}

          {(ride.package_type || ride.package_size) && (
            <View style={styles.detailRow}>
              <Ionicons name="cube" size={18} color={COLORS.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Package</Text>
                <Text style={styles.detailValue}>
                  {[ride.package_size, ride.package_type].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          )}

          {ride.ride_type && (
            <View style={styles.detailRow}>
              <Ionicons name="map" size={18} color={COLORS.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Ride Type</Text>
                <Text style={styles.detailValue}>{ride.ride_type}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.timestampCard}>
          <Text style={styles.timestampLabel}>Created</Text>
          <Text style={styles.timestampValue}>
            {ride.created_at ? new Date(ride.created_at).toLocaleString() : 'N/A'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    paddingBottom: 20,
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  backButtonText: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  homeButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  homeButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 15,
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  deliveryIdText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  otpCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 20,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  otpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  otpValue: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 6,
    textAlign: 'center',
    marginVertical: 12,
  },
  otpHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
  },
  otpExpiry: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  resendButton: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  resendButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  detailsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  timestampCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
  },
  timestampLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  timestampValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
});
