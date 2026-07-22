import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
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
