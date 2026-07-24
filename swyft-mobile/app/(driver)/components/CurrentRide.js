import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../src/constants/config';

export default function CurrentRide({ ride, eta, etaDropoff, onStartRide, onCompleteRide, onCancelCurrentRide, onOpenNavigation }) {
  if (!ride) return null;

  const statusColors = {
    'driver_accepted': '#FF9500',
    'accepted': COLORS.primary,
    'completed': '#8E8E93',
    'confirmed': '#34C759',
  };

  const statusLabels = {
    'driver_accepted': 'Awaiting Passenger',
    'accepted': 'Accepted',
    'completed': 'Completed',
    'confirmed': 'Confirmed',
  };

  const isWaitingConfirmation = ride.status === 'driver_accepted';

  return (
    <View style={styles.currentRideCard}>
      <View style={styles.currentRideHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.currentRideTitle}>Current Ride</Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: statusColors[ride.status] || COLORS.primary }
        ]}>
          <Text style={styles.statusText}>{statusLabels[ride.status] || ride.status}</Text>
        </View>
      </View>

      <View style={styles.rideLocations}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>PICKUP</Text>
            <Text style={styles.locationText} numberOfLines={2}>
              {ride.pickup_location || ride.pickup || 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.locationConnector} />

        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: COLORS.error }]} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>DROPOFF</Text>
            <Text style={styles.locationText} numberOfLines={2}>
              {ride.dropoff_location || ride.dropoff || 'N/A'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.passengerContact}>
        <View style={styles.passengerAvatar}>
          <Text style={styles.passengerAvatarText}>
            {(ride.passenger_name || 'P').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName}>{ride.passenger_name || 'Passenger'}</Text>
          <Text style={styles.passengerPhone}>{ride.passenger_phone || ride.passenger_email}</Text>
          {ride.vehicle_type && (
            <Text style={styles.vehicleTypeBadge}>Vehicle: {ride.vehicle_type}</Text>
          )}
        </View>
        <Text style={styles.ridePriceLarge}>₺{ride.price || '15.00'}</Text>
      </View>

      <View style={styles.currentRideActions}>
        {isWaitingConfirmation ? (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.waitingText}>Waiting for passenger to confirm your acceptance...</Text>
          </View>
        ) : (
          <>
            {ride.status === 'accepted' && (
              <TouchableOpacity style={styles.startButton} onPress={onStartRide}>
                <Text style={styles.startButtonText}>Start Ride</Text>
              </TouchableOpacity>
            )}
            {ride.status === 'completed' && (
              <View style={styles.waitingContainer}>
                <ActivityIndicator size="small" color={COLORS.success} />
                <Text style={styles.waitingText}>Waiting for receiver to confirm delivery...</Text>
              </View>
            )}
            {ride.status === 'confirmed' && (
              <View style={styles.waitingContainer}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                <Text style={[styles.waitingText, { color: COLORS.success }]}>Delivery confirmed! Payment received.</Text>
              </View>
            )}
          </>
        )}
        {ride.status !== 'confirmed' && ride.status !== 'completed' && (
          <TouchableOpacity style={styles.cancelRideButton} onPress={onCancelCurrentRide}>
            <Text style={styles.cancelRideButtonText}>Cancel Ride</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  currentRideCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  currentRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  currentRideTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  rideLocations: {
    marginBottom: 20,
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
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 18,
  },
  locationConnector: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.border,
    marginLeft: 5,
    marginVertical: 4,
  },
  passengerContact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  passengerPhone: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  vehicleTypeBadge: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  ridePriceLarge: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  currentRideActions: {
    gap: 10,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  waitingText: {
    fontSize: 14,
    color: COLORS.textLight,
    flex: 1,
  },
  startButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  startButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelRideButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 10,
  },
  cancelRideButtonText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
});
