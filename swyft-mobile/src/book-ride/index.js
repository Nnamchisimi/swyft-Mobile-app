import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, ScrollView, Dimensions, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/config';
import { ridesAPI, fareAPI } from '../services/api';
import { authService } from '../services/auth';
import { socketService } from '../services/socket';
import geoService from '../services/geo';
import { useBookRideState, useBookRideEffects, useBookRideActions } from './hooks';
import { setupSocketListeners, useDriverLocationListener } from './socket';
import { handleBookRide, handleCancelRide } from './actions';
import { calculateFare } from './pricing';
import { parseGoogleMapsUrl, reverseGeocode, getPlaceDetails, getRouteCoordinates } from './location';
import { interCityRoutesData, defaultVehicleTypes } from './constants';
import { BookingForm } from './components/booking-form';
import styles from './styles';

const { width } = Dimensions.get('window');

export default function BookRideScreen() {
  const router = useRouter();
  const mapRef = useRef(null);

  const state = useBookRideState();
  const { handleBookRide: bookRide, handleCancelRide: cancelRide } = state.actions;

  useBookRideEffects(state);
  useDriverLocationListener(state);

  useEffect(() => {
    if (state.rideBooked && state.currentRide) {
      router.replace({
        pathname: '/(passenger)/track-ride',
        params: { rideId: state.currentRide.id },
      });
    }
  }, [state.rideBooked, state.currentRide]);

  const handlePickupChange = (address) => {
    state.set('pickupAddress', address);
    if (address.length > 0) state.set('pickupManuallySelected', true);
    state.set('showPickupSuggestions', address.length > 2);
    
    if (state.pickupDebounceRef?.current) clearTimeout(state.pickupDebounceRef.current);
    
    if (address.length < 2) {
      state.set('pickupSuggestions', []);
      return;
    }
    
    const timeout = setTimeout(async () => {
      const suggestions = await geoService.getPlaceSuggestions(address, state.currentLocation?.latitude, state.currentLocation?.longitude);
      state.set('pickupSuggestions', suggestions);
    }, 300);
    
    state.set('pickupDebounceRef', timeout);
  };

  const handleDropoffChange = (address) => {
    state.set('dropoffAddress', address);
    state.set('showDropoffSuggestions', address.length > 2);
    
    if (state.dropoffDebounceRef?.current) clearTimeout(state.dropoffDebounceRef.current);
    
    if (address.length < 2) {
      state.set('dropoffSuggestions', []);
      state.set('dropoffLocation', null);
      return;
    }
    
    const timeout = setTimeout(async () => {
      const suggestions = await geoService.getPlaceSuggestions(address, state.currentLocation?.latitude, state.currentLocation?.longitude);
      state.set('dropoffSuggestions', suggestions);
      
      if (suggestions.length > 0) {
        state.set('dropoffLocation', { latitude: suggestions[0].lat, longitude: suggestions[0].lon });
      }
    }, 300);
    
    state.set('dropoffDebounceRef', timeout);
  };

  const handleSelectPickupSuggestion = async (suggestion) => {
    const details = await getPlaceDetails(suggestion.place_id);
    if (details) {
      const pickupCoords = { latitude: details.lat, longitude: details.lon };
      state.set('pickupAddress', details.display_name);
      state.set('pickupLocation', pickupCoords);
      state.set('pickupSuggestions', []);
      state.set('showPickupSuggestions', false);
      state.set('pickupManuallySelected', true);
      
      if (state.dropoffLocation) {
        const routeCoords = await getRouteCoordinates(pickupCoords, state.dropoffLocation);
        state.set('routeCoordinates', routeCoords && routeCoords.length > 0 ? routeCoords : [pickupCoords, state.dropoffLocation]);
      }
    }
  };

  const handleSelectDropoffSuggestion = async (suggestion) => {
    const details = await getPlaceDetails(suggestion.place_id);
    if (details) {
      const dropoffCoords = { latitude: details.lat, longitude: details.lon };
      state.set('dropoffAddress', details.display_name);
      state.set('dropoffLocation', dropoffCoords);
      state.set('dropoffSuggestions', []);
      state.set('showDropoffSuggestions', false);
      
      if (state.pickupLocation) {
        const routeCoords = await getRouteCoordinates(state.pickupLocation, dropoffCoords);
        state.set('routeCoordinates', routeCoords && routeCoords.length > 0 ? routeCoords : [state.pickupLocation, dropoffCoords]);
      } else if (state.currentLocation) {
        const routeCoords = await getRouteCoordinates(
          { latitude: state.currentLocation.latitude, longitude: state.currentLocation.longitude },
          dropoffCoords
        );
        state.set('routeCoordinates', routeCoords && routeCoords.length > 0 ? routeCoords : [
          { latitude: state.currentLocation.latitude, longitude: state.currentLocation.longitude },
          dropoffCoords
        ]);
      }
    }
  };

  const handleGetCurrentLocation = async () => {
    state.set('locationLoading', true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for automatic location detection.');
        state.set('locationLoading', false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      state.set('currentLocation', coords);
      
      if (state.dropoffLocation) {
        const routeCoords = await getRouteCoordinates(coords, state.dropoffLocation);
        state.set('routeCoordinates', routeCoords && routeCoords.length > 0 ? routeCoords : [coords, state.dropoffLocation]);
      }
      
      try {
        const addressStr = await reverseGeocode(coords.latitude, coords.longitude);
        if (addressStr) {
          if (!state.pickupManuallySelected && !state.pickupLockedForRide && !state.pickupAddress) {
            state.set('pickupAddress', addressStr);
          }
        } else {
          if (!state.pickupManuallySelected && !state.pickupLockedForRide && !state.pickupAddress) {
            state.set('pickupAddress', `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
          }
        }
      } catch (e) {
        if (!state.pickupManuallySelected && !state.pickupLockedForRide && !state.pickupAddress) {
          state.set('pickupAddress', `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your current location. Please enter manually.');
    } finally {
      state.set('locationLoading', false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.brandName}>SWYFTinc</Text>
            <Text style={styles.headerTitle}>Book a Courier</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {state.rideBooked && state.currentRide ? (
          <View style={{ flex: 1 }} />
        ) : (
          <BookingForm 
            state={state} 
            styles={styles} 
            mapRef={mapRef}
            onPickupChange={handlePickupChange}
            onDropoffChange={handleDropoffChange}
            onPickupSelect={handleSelectPickupSuggestion}
            onDropoffSelect={handleSelectDropoffSuggestion}
            onGetCurrentLocation={handleGetCurrentLocation}
            onBookRide={bookRide}
          />
        )}
      </KeyboardAvoidingView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(passenger)/home')}>
          <Ionicons name="home" size={24} color={COLORS.gray} />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(passenger)/book-ride')}
        >
          <Ionicons name="car" size={24} color={COLORS.primary} />
          <Text style={[styles.navText, styles.navTextActive]}>Book</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(passenger)/history')}
        >
          <Ionicons name="list" size={24} color={COLORS.gray} />
          <Text style={styles.navText}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(passenger)/profile')}
        >
          <Ionicons name="person" size={24} color={COLORS.gray} />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}