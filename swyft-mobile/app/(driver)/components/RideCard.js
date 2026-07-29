import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../src/constants/config';
import { calculateDistance } from '../utils';
import styles from '../styles';

export default function RideCard({ ride, onAccept, onDecline, location }) {
  let pickupDistance = null;
  let dropoffDistance = null;

  if (location && ride.pickup_lat && ride.pickup_lng) {
    const d = calculateDistance(location.latitude, location.longitude, parseFloat(ride.pickup_lat), parseFloat(ride.pickup_lng));
    if (d < 1000) {
      pickupDistance = `${Math.round(d)} m`;
    } else {
      pickupDistance = `${(d / 1000).toFixed(1)} km`;
    }
  }

  return (
    <View style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <View style={styles.rideIdBadge}>
          <Text style={styles.rideIdText}>#{ride.id}</Text>
        </View>
        <Text style={styles.ridePrice}>₺{ride.price || '0.00'}</Text>
      </View>

      <View style={styles.rideLocations}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>PICKUP</Text>
            <Text style={styles.locationText} numberOfLines={2}>
              {ride.pickup_location || ride.pickup || 'Location not specified'}
            </Text>
            {pickupDistance && (
              <Text style={styles.distanceText}>{pickupDistance} away</Text>
            )}
          </View>
        </View>

        <View style={styles.locationConnector} />

        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: COLORS.error }]} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>DROPOFF</Text>
            <Text style={styles.locationText} numberOfLines={2}>
              {ride.dropoff_location || ride.dropoff || 'Location not specified'}
            </Text>
          </View>
        </View>
      </View>

      {(ride.package_size || ride.package_type || ride.package_details) && (
        <View style={styles.packageInfo}>
          <View style={styles.packageHeader}>
            <Ionicons name="cube-outline" size={16} color={COLORS.primary} />
            <Text style={styles.packageHeaderText}>Package</Text>
            {ride.package_size && (
              <View style={styles.packageBadge}>
                <Text style={styles.packageBadgeText}>{ride.package_size}</Text>
              </View>
            )}
          </View>
          {(ride.package_type || ride.package_details) && (
            <View style={styles.packageDetails}>
              {ride.package_type && (
                <View style={styles.packageItem}>
                  <Text style={styles.packageLabel}>Type:</Text>
                  <Text style={styles.packageValue}>{ride.package_type}</Text>
                </View>
              )}
              {ride.package_details && (
                <View style={styles.packageItem}>
                  <Text style={styles.packageLabel}>Details:</Text>
                  <Text style={styles.packageValue} numberOfLines={2}>{ride.package_details}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.rideActions}>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={() => onDecline(ride)}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => onAccept(ride)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
