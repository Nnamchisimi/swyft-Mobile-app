import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../src/constants/config';

export default function CurrentRide({ ride, eta, etaDropoff, onStartRide, onCompleteRide, onCancelCurrentRide, onOpenNavigation, driverLocation }) {
  if (!ride) return null;

  const statusColors = {
    accepted: COLORS.primary,
    arrived_pickup: '#FF9500',
    picked_up: COLORS.success,
    completed: '#8E8E93',
  };

  const statusLabels = {
    accepted: 'Accepted',
    arrived_pickup: 'Arrived at Pickup',
    picked_up: 'Picked Up',
    completed: 'Completed',
  };

  const isAccepted = ride.status === 'accepted' || ride.status === 'arrived_pickup';
  const isPickedUp = ride.status === 'picked_up';

  return (
    <View style={styles.currentRideCard}>
      <View style={styles.currentRideHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.currentRideTitle}>Current Delivery</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[ride.status] || COLORS.primary }]}>
          <Text style={styles.statusText}>{statusLabels[ride.status] || ride.status}</Text>
        </View>
      </View>

      {isAccepted && (
        <View style={styles.passengerBlock}>
          <View style={styles.passengerLine}>
            <Ionicons name="person" size={18} color={COLORS.textSecondary} />
            <Text style={styles.passengerText}>{ride.passenger_name || ride.passenger_email || 'Customer'}</Text>
          </View>
          <View style={styles.passengerLine}>
            <Ionicons name="call" size={18} color={COLORS.textSecondary} />
            <Text style={styles.passengerText}>{ride.passenger_phone || ride.passenger_email || 'No phone'}</Text>
          </View>
          {(ride.package_size || ride.package_type) && (
            <View style={styles.packageRow}>
              <Ionicons name="cube" size={16} color={COLORS.primary} />
              <Text style={styles.packageText}>
                {[ride.package_size, ride.package_type].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}
        </View>
      )}

      {isAccepted && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.navigationButton} onPress={() => onOpenNavigation(ride.pickup_lat, ride.pickup_lng, ride.pickup_location || ride.pickup)}>
            <Ionicons name="navigate" size={18} color={COLORS.white} />
            <Text style={styles.navigationButtonText}>Navigate to Pickup</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.startButton} onPress={onStartRide}>
            <Text style={styles.startButtonText}>Package Collected</Text>
          </TouchableOpacity>
        </View>
      )}

      {isPickedUp && (
        <View style={styles.passengerBlock}>
          <View style={styles.passengerLine}>
            <Ionicons name="location" size={18} color={COLORS.textSecondary} />
            <Text style={styles.passengerText}>
              {ride.dropoff_location || ride.dropoff || 'Destination'}
            </Text>
          </View>
          {etaDropoff && (
            <Text style={styles.etaText}>ETA: {etaDropoff} min</Text>
          )}
        </View>
      )}

      {isPickedUp && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.navigationButton} onPress={() => onOpenNavigation(ride.dropoff_lat, ride.dropoff_lng, ride.dropoff_location || ride.dropoff)}>
            <Ionicons name="navigate" size={18} color={COLORS.white} />
            <Text style={styles.navigationButtonText}>Navigate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.completeButton} onPress={onCompleteRide}>
            <Text style={styles.completeButtonText}>Complete Delivery</Text>
          </TouchableOpacity>
        </View>
      )}

      {ride.status !== 'completed' && (
        <TouchableOpacity style={styles.cancelRideButton} onPress={onCancelCurrentRide}>
          <Text style={styles.cancelRideButtonText}>Cancel Ride</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  currentRideCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currentRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
  },
  currentRideTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
  passengerBlock: {
    gap: 8,
    marginBottom: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  passengerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passengerText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  packageText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  etaText: {
    fontSize: 13,
    color: COLORS.success,
    fontWeight: '600',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  navigationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    elevation: 5,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  navigationButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 15,
  },
  startButton: {
    flex: 1,
    backgroundColor: COLORS.success,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 15,
  },
  completeButton: {
    flex: 1,
    backgroundColor: COLORS.success,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 15,
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
});
