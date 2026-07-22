import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../src/constants/config';
import { calculateDistance, calculateETA } from '../utils';
import styles from '../styles';

export default function RideCard({ ride, onAccept, onDecline, location }) {
  return (
    <View style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <View style={styles.rideIdBadge}>
          <Text style={styles.rideIdText}>#{ride.id}</Text>
        </View>
        <Text style={styles.ridePrice}>₺{ride.price || '15.00'}</Text>
      </View>

      <View style={styles.rideLocations}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>PICKUP</Text>
            <Text style={styles.locationText} numberOfLines={2}>
              {ride.pickup_location || ride.pickup || 'Location not specified'}
            </Text>
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

      <View style={styles.ridePassenger}>
        <View style={styles.passengerAvatar}>
          <Text style={styles.passengerAvatarText}>
            {(ride.passenger_name || ride.passenger_email || 'P').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName}>{ride.passenger_name || 'Passenger'}</Text>
          <Text style={styles.passengerPhone}>{ride.passenger_phone || 'No phone'}</Text>
        </View>
        <View style={styles.rideTypeBadge}>
          <Text style={styles.rideTypeText}>{ride.vehicle_type || ride.ride_type || 'Standard'}</Text>
        </View>
      </View>

      {(ride.package_type || ride.package_size || ride.package_details || ride.special_instructions) && (
        <View style={styles.packageInfo}>
          <View style={styles.packageHeader}>
            <Ionicons name="cube-outline" size={16} color={COLORS.primary} />
            <Text style={styles.packageHeaderText}>Package Details</Text>
          </View>
          <View style={styles.packageDetails}>
            {ride.package_type && (
              <View style={styles.packageItem}>
                <Text style={styles.packageLabel}>Type:</Text>
                <Text style={styles.packageValue}>{ride.package_type}</Text>
              </View>
            )}
            {ride.package_size && (
              <View style={styles.packageItem}>
                <Text style={styles.packageLabel}>Size:</Text>
                <Text style={styles.packageValue}>{ride.package_size}</Text>
              </View>
            )}
            {ride.package_details && (
              <View style={styles.packageItem}>
                <Text style={styles.packageLabel}>Details:</Text>
                <Text style={styles.packageValue}>{ride.package_details}</Text>
              </View>
            )}
            {ride.special_instructions && (
              <View style={styles.packageItem}>
                <Text style={styles.packageLabel}>Note:</Text>
                <Text style={[styles.packageValue, styles.packageSpecial]}>{ride.special_instructions}</Text>
              </View>
            )}
          </View>
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
