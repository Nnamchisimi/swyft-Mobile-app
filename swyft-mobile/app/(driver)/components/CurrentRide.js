import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../src/constants/config';

export default function CurrentRide({ ride, eta, etaDropoff, onArrivedAtPickup, onStartRide, onArriving, onCompleteRide, onCancelCurrentRide, onOpenNavigation }) {
  if (!ride) return null;

  const statusColors = {
    'driver_accepted': '#FF9500',
    'accepted': COLORS.primary,
    'arrived': COLORS.secondary,
    'active': COLORS.success,
  };

  const statusLabels = {
    'driver_accepted': 'Awaiting Passenger',
    'accepted': 'Accepted',
    'arrived': 'Arrived at Pickup',
    'active': 'In Progress',
  };

  const isWaitingConfirmation = ride.status === 'driver_accepted';

  const displayEta = ride.status === 'active' ? etaDropoff : eta;
  const etaLabel = ride.status === 'active' ? 'ETA to Dropoff' : 'ETA to Pickup';

  return (
    <View style={styles.currentRideCard}>
      <View style={styles.currentRideHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.currentRideTitle}>Current Ride</Text>
          {displayEta && (
            <View style={styles.etaContainer}>
              <Text style={styles.etaLabel}>{etaLabel}: </Text>
              <Text style={styles.etaText}>{displayEta}</Text>
            </View>
          )}
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

      {(ride.package_type || ride.package_size || ride.package_details || ride.special_instructions) && (
        <View style={styles.packageInfoCurrent}>
          <View style={styles.packageHeader}>
            <Ionicons name="cube-outline" size={16} color={COLORS.primary} />
            <Text style={styles.packageHeaderText}>Package Details</Text>
          </View>
          <View style={styles.packageDetailsRow}>
            {ride.package_type && (
              <View style={styles.packageChip}>
                <Text style={styles.packageChipText}>{ride.package_type}</Text>
              </View>
            )}
            {ride.package_size && (
              <View style={styles.packageChip}>
                <Text style={styles.packageChipText}>{ride.package_size}</Text>
              </View>
            )}
            {ride.package_details && (
              <View style={styles.packageChip}>
                <Text style={styles.packageChipText} numberOfLines={1}>{ride.package_details}</Text>
              </View>
            )}
            {ride.special_instructions && (
              <View style={[styles.packageChip, styles.packageChipSpecial]}>
                <Ionicons name="alert-circle" size={12} color={COLORS.error} />
                <Text style={[styles.packageChipText, styles.packageChipTextSpecial]}>{ride.special_instructions}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <View style={styles.currentRideActions}>
        {isWaitingConfirmation ? (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.waitingText}>Waiting for passenger to confirm your acceptance...</Text>
          </View>
        ) : (
          <>
            {ride.status === 'accepted' && (
              <TouchableOpacity style={styles.arrivedButton} onPress={onArrivedAtPickup}>
                <Text style={styles.arrivedButtonText}>Arrived at Pickup</Text>
              </TouchableOpacity>
            )}
            {ride.status === 'arrived_pickup' && (
              <TouchableOpacity style={styles.startButton} onPress={onStartRide}>
                <Text style={styles.startButtonText}>Pick Up Package</Text>
              </TouchableOpacity>
            )}
            {ride.status === 'active' && (
              <>
                <TouchableOpacity style={styles.navigationButton} onPress={() => onOpenNavigation(ride.dropoff_lat, ride.dropoff_lng, ride.dropoff_location)}>
                  <Ionicons name="navigate" size={20} color={COLORS.white} />
                  <Text style={styles.navigationButtonText}>Navigate to Dropoff</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.arrivingButton} onPress={onArriving}>
                  <Text style={styles.arrivingButtonText}>Arriving at Destination</Text>
                </TouchableOpacity>
              </>
            )}
            {ride.status === 'arriving' && (
              <TouchableOpacity style={styles.completeButton} onPress={onCompleteRide}>
                <Text style={styles.completeButtonText}>Complete Delivery (OTP)</Text>
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
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaLabel: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  etaText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
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
  packageInfoCurrent: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  packageHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 6,
  },
  packageDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  packageChip: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  packageChipSpecial: {
    backgroundColor: '#FFF3F3',
    borderColor: COLORS.error,
    flexDirection: 'row',
    alignItems: 'center',
  },
  packageChipText: {
    fontSize: 12,
    color: COLORS.text,
  },
  packageChipTextSpecial: {
    marginLeft: 4,
    color: COLORS.error,
  },
  currentRideActions: {
    gap: 10,
  },
  arrivedButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  arrivedButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  startButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  navigationButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navigationButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  arrivingButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  arrivingButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
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
