import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../src/constants/config';

export default function CurrentRide({ ride, eta, etaDropoff, onStartRide, onCompleteRide, onCancelCurrentRide, onOpenNavigation, driverLocation, onArrived }) {
  if (!ride) return null;

  const statusColors = {
    accepted: COLORS.primary,
    arrived_pickup: '#FF9500',
    picked_up: COLORS.success,
    arrived_dropoff: '#FF9500',
    completed: '#8E8E93',
  };

  const statusLabels = {
    accepted: 'Accepted',
    arrived_pickup: 'Arrived at Pickup',
    picked_up: 'Picked Up',
    arrived_dropoff: 'Arrived at Dropoff',
    completed: 'Completed',
  };

  const isAccepted = ride.status === 'accepted' || ride.status === 'arrived_pickup';
  const isPickedUp = ride.status === 'picked_up' || ride.status === 'arrived_dropoff';
  const hasArrived = ride.status === 'arrived_dropoff';

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
            <Ionicons name="navigate-outline" size={13} color={COLORS.white} />
            <Text style={styles.navigationButtonText}>Navigate to Pickup</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.startButton} onPress={onStartRide}>
            <Ionicons name="cube-outline" size={13} color={COLORS.white} />
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

      {hasArrived && (
        <View style={styles.arrivedPrompt}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
          <Text style={styles.arrivedPromptText}>
            You have arrived at the dropoff location. Please complete the delivery by tapping the button below.
          </Text>
        </View>
      )}

      {isPickedUp && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.navigationButton} onPress={() => onOpenNavigation(ride.dropoff_lat, ride.dropoff_lng, ride.dropoff_location || ride.dropoff)}>
            <Ionicons name="navigate-outline" size={20} color={COLORS.white} />
            <Text style={styles.navigationButtonText}>Navigate</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.arrivedButton, hasArrived && styles.arrivedButtonDisabled]} 
            onPress={onArrived}
            disabled={hasArrived}
          >
            <Ionicons name="flag-outline" size={20} color={hasArrived ? COLORS.textSecondary : COLORS.white} />
            <Text style={[styles.arrivedButtonText, hasArrived && styles.arrivedButtonTextDisabled]}>
              {hasArrived ? 'Arrived' : 'Arrived'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isPickedUp && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.completeButton} onPress={onCompleteRide}>
            <Ionicons name="checkmark-done-outline" size={20} color={COLORS.white} />
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
    gap: 2,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  navigationButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: COLORS.success,
    height: 56,
    borderRadius: 18,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  startButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  completeButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  arrivedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9500',
    height: 56,
    borderRadius: 18,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  arrivedButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  arrivedButtonDisabled: {
    backgroundColor: COLORS.surface,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  arrivedButtonTextDisabled: {
    color: COLORS.textSecondary,
  },
  arrivedPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E8F5E9',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  arrivedPromptText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    fontWeight: '600',
  },
  cancelRideButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.error + '30',
  },
  cancelRideButtonText: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: 14,
  },
});
