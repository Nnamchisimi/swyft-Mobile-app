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

export default function DriverDeliveryDetailsScreen() {
  const router = useRouter();
  const { rideId } = useLocalSearchParams();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (rideId) loadRide();
  }, [rideId]);

  const loadRide = async () => {
    try {
      const response = await ridesAPI.getRideById(rideId);
      setRide(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load delivery details');
    } finally {
      setLoading(false);
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
        return 'Awaiting Driver';
      case 'accepted':
        return 'Driver Assigned';
      case 'arrived_pickup':
        return 'At Pickup';
      case 'picked_up':
        return 'In Transit';
      case 'arrived_dropoff':
        return 'At Dropoff';
      case 'completed':
      case 'confirmed':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
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
          <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/(driver)/dashboard')}>
            <Text style={styles.homeButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.statusCard}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(ride.status)}</Text>
          </View>
          <Text style={styles.deliveryIdText}>Delivery #{ride.delivery_id || ride.id}</Text>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Delivery Information</Text>

          <View style={styles.detailRow}>
            <Ionicons name="person" size={18} color={COLORS.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Customer</Text>
              <Text style={styles.detailValue}>{ride.passenger_name || ride.passenger_email || 'N/A'}</Text>
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

          {ride.receiver_name && (
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={18} color={COLORS.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Receiver</Text>
                <Text style={styles.detailValue}>{ride.receiver_name}</Text>
              </View>
            </View>
          )}

          {ride.receiver_phone && (
            <View style={styles.detailRow}>
              <Ionicons name="call" size={18} color={COLORS.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Receiver Phone</Text>
                <Text style={styles.detailValue}>{ride.receiver_phone}</Text>
              </View>
            </View>
          )}

          {ride.price && (
            <View style={styles.detailRow}>
              <Ionicons name="cash" size={18} color={COLORS.success} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Price</Text>
                <Text style={styles.detailValue}>₺{Number(ride.price).toFixed(2)}</Text>
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

          {ride.package_details && (
            <View style={styles.detailRow}>
              <Ionicons name="list" size={18} color={COLORS.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Package Details</Text>
                <Text style={styles.detailValue}>{ride.package_details}</Text>
              </View>
            </View>
          )}

          {ride.special_instructions && (
            <View style={styles.detailRow}>
              <Ionicons name="document-text" size={18} color={COLORS.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Special Instructions</Text>
                <Text style={styles.detailValue}>{ride.special_instructions}</Text>
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

          {ride.vehicle_type && (
            <View style={styles.detailRow}>
              <Ionicons name="car" size={18} color={COLORS.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Vehicle Type</Text>
                <Text style={styles.detailValue}>{ride.vehicle_type}</Text>
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

        {ride.updated_at && (
          <View style={styles.timestampCard}>
            <Text style={styles.timestampLabel}>Last Updated</Text>
            <Text style={styles.timestampValue}>
              {new Date(ride.updated_at).toLocaleString()}
            </Text>
          </View>
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
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
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
  detailsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 16,
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
    marginHorizontal: 16,
    marginTop: 12,
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
