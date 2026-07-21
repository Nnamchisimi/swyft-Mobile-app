import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import { handleCallDriver } from '../actions';
import { ridesAPI } from '../../services/api';

export function RideStatus({ state, styles, onConfirmPickup, onConfirmComplete, onCancelRide }) {
  const { currentRide, pickupAddress, dropoffAddress, driverLocation, driverDistance, driverStatus, estimatedPrice, pickupLocation, dropoffLocation } = state;

  const showMap = currentRide && (currentRide.status === 'accepted' || currentRide.status === 'arrived_pickup' || currentRide.status === 'active' || currentRide.status === 'arriving' || currentRide.status === 'driver_accepted');

  return (
    <View style={styles.statusContainer}>
      {showMap && pickupLocation && (
        <View style={styles.mapCard}>
          <MapView
            style={styles.statusMap}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: driverLocation?.latitude || pickupLocation.latitude,
              longitude: driverLocation?.longitude || pickupLocation.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsUserLocation
            showsMyLocationButton
          >
            {pickupLocation && (
              <Marker coordinate={{ latitude: pickupLocation.latitude, longitude: pickupLocation.longitude }} title="Pickup" pinColor={COLORS.success} />
            )}
            {dropoffLocation && (
              <Marker coordinate={{ latitude: dropoffLocation.latitude, longitude: dropoffLocation.longitude }} title="Dropoff" pinColor={COLORS.error} />
            )}
            {driverLocation && currentRide.status !== 'driver_accepted' && (
              <Marker coordinate={{ latitude: driverLocation.latitude, longitude: driverLocation.longitude }} title="Courier">
                <View style={styles.driverMarkerStyle}>
                  <Ionicons name="car" size={14} color="white" />
                </View>
              </Marker>
            )}
          </MapView>
        </View>
      )}

      <View style={styles.statusHeader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.statusTitle}>
          {currentRide?.status === 'pending' && 'Finding your courier...'}
          {currentRide?.status === 'driver_accepted' && 'Driver accepted! Waiting for your confirmation...'}
          {currentRide?.status === 'accepted' && 'Courier is on the way!'}
          {currentRide?.status === 'arrived_pickup' && 'Courier has arrived at pickup!'}
          {currentRide?.status === 'active' && 'Package is in transit!'}
          {currentRide?.status === 'arriving' && 'Courier is arriving at destination!'}
          {currentRide?.status === 'completed' && 'Delivery completed! Please confirm.'}
          {currentRide?.status === 'confirmed' && 'Delivery confirmed!'}
        </Text>
      </View>

      {currentRide?.status === 'driver_accepted' && (
        <View style={styles.confirmCard}>
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{(currentRide.driver_name || 'D').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{currentRide.driver_name || 'Your Courier'}</Text>
              <Text style={styles.driverPhone}>{currentRide.driver_phone || 'Phone not available'}</Text>
              <Text style={styles.driverVehicle}>Courier: {currentRide.driver_vehicle || currentRide.vehicle_type || 'Vehicle'}</Text>
            </View>
          </View>
          <View style={styles.confirmButtons}>
            <TouchableOpacity style={styles.declineConfirmButton} onPress={onCancelRide}>
              <Text style={styles.declineConfirmButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptConfirmButton} onPress={async () => {
              try {
                await ridesAPI.passengerConfirmRide(currentRide.id);
                Alert.alert('Confirmed!', 'Your courier is on the way!');
              } catch { Alert.alert('Error', 'Failed to confirm ride'); }
            }}>
              <Text style={styles.acceptConfirmButtonText}>Accept Driver</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {(currentRide?.status === 'accepted' || currentRide?.status === 'arrived_pickup' || currentRide?.status === 'active' || currentRide?.status === 'arriving' || currentRide?.status === 'completed') && (
        <View style={styles.driverCard}>
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{(currentRide.driver_name || 'D').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{currentRide.driver_name || 'Your Courier'}</Text>
              <Text style={styles.driverPhone}>{currentRide.driver_phone || 'Phone not available'}</Text>
              <Text style={styles.driverVehicle}>Courier: {currentRide.driver_vehicle || currentRide.vehicle_type || 'Vehicle'}</Text>
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingStar}>⭐</Text>
                <Text style={styles.ratingText}>{currentRide.driver_rating ? Number(currentRide.driver_rating).toFixed(1) : '5.0'}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.callButton} onPress={() => handleCallDriver(currentRide.driver_phone)}>
            <Ionicons name="call" size={20} color={COLORS.white} />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
        </View>
      )}

      {currentRide?.status === 'arrived_pickup' && (
        <TouchableOpacity style={styles.confirmPickupButton} onPress={onConfirmPickup}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
          <Text style={styles.confirmPickupButtonText}>Confirm Pickup</Text>
        </TouchableOpacity>
      )}

      {currentRide?.status === 'completed' && (
        <TouchableOpacity style={styles.confirmCompleteButton} onPress={onConfirmComplete}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
          <Text style={styles.confirmCompleteButtonText}>Confirm Delivery Complete</Text>
        </TouchableOpacity>
      )}

      <View style={styles.tripDetails}>
        <View style={styles.tripRow}>
          <View style={[styles.tripDot, { backgroundColor: COLORS.success }]} />
          <View style={styles.tripTextContainer}>
            <Text style={styles.tripLabel}>PICKUP</Text>
            <Text style={styles.tripText}>{pickupAddress}</Text>
          </View>
        </View>
        <View style={styles.tripConnector} />
        <View style={styles.tripRow}>
          <View style={[styles.tripDot, { backgroundColor: COLORS.error }]} />
          <View style={styles.tripTextContainer}>
            <Text style={styles.tripLabel}>DROPOFF</Text>
            <Text style={styles.tripText}>{dropoffAddress}</Text>
          </View>
        </View>
      </View>

      {driverLocation && (driverDistance || driverDistance === 0) && currentRide.status !== 'driver_accepted' && (
        <View style={styles.etaContainer}>
          <Ionicons name="car" size={20} color={COLORS.white} />
          <Text style={styles.etaText}>
            {driverStatus === 'arrived' ? 'Driver has arrived!' : driverStatus === 'in_progress' ? 'Ride in progress' : `Driver arriving in ${driverDistance} min`}
          </Text>
        </View>
      )}

      {driverLocation && !driverDistance && currentRide.status !== 'driver_accepted' && (
        <View style={[styles.etaContainer, { backgroundColor: COLORS.secondary }]}>
          <Ionicons name="time" size={20} color={COLORS.white} />
          <Text style={styles.etaText}>Calculating ETA...</Text>
        </View>
      )}

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Estimated Fare</Text>
        <Text style={styles.priceValue}>₺{estimatedPrice}</Text>
      </View>

      {currentRide?.status !== 'confirmed' && currentRide?.status !== 'completed' && (
        <TouchableOpacity style={styles.cancelButton} onPress={onCancelRide}>
          <Text style={styles.cancelButtonText}>Cancel Ride</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}