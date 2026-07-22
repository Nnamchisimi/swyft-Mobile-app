import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useDriverDashboardState } from './hooks';
import { useDriverDashboardEffects } from './hooks';
import { toggleOnline, handleAcceptRide, handleDeclineRide, handleArrivedAtPickup, handleStartRide, handleArriving, handleCompleteRide, handleCancelCurrentRide, handleLogout, openNavigation } from './actions';
import { socketService } from '../../src/services/socket';
import { authService } from '../../src/services/auth';
import { ridesAPI } from '../../src/services/api';
import RideCard from './components/RideCard';
import CurrentRide from './components/CurrentRide';
import { COLORS } from '../../src/constants/config';
import styles from './styles';

export default function DriverDashboard() {
  const router = useRouter();
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);
  const isOnlineRef = useRef(false);
  const locationRef = useRef(null);
  const currentRideRef = useRef(null);

  const state = useDriverDashboardState();
  const refs = {
    currentRideRef,
    locationSubscriptionRef: locationSubscription,
    isOnlineRef,
    locationRef,
  };

  const effects = useDriverDashboardEffects(state, refs);

  const onToggleOnline = async () => {
    await toggleOnline(
      state.isOnline,
      state.setIsOnline,
      isOnlineRef,
      state.driverInfo,
      socketService,
      effects.fetchPendingRides,
      state.setPendingRides,
      state.location,
      locationRef,
      router
    );
  };

  const onAcceptRide = async (ride) => {
    await handleAcceptRide(ride, state.driverInfo, authService, ridesAPI, state.setCurrentRide, state.setPendingRides);
  };

  const onDeclineRide = (ride) => {
    handleDeclineRide(ride, state.setPendingRides);
  };

  const onRefresh = async () => {
    await effects.onRefreshHandler();
  };

  const onArrivedAtPickup = async () => {
    await handleArrivedAtPickup(state.currentRide, ridesAPI, state.setCurrentRide);
  };

  const onStartRide = async () => {
    await handleStartRide(state.currentRide, ridesAPI, state.setCurrentRide, mapRef);
  };

  const onArriving = async () => {
    await handleArriving(state.currentRide, ridesAPI, state.setCurrentRide);
  };

  const onCompleteRide = async () => {
    await handleCompleteRide(state.currentRide, ridesAPI, state.setCurrentRide, state.setLoading);
  };

  const onCancelCurrentRide = async () => {
    await handleCancelCurrentRide(state.currentRide, ridesAPI, state.setCurrentRide, effects.fetchPendingRides);
  };

  const onLogout = async () => {
    await handleLogout(state.isOnline, authService, socketService, router);
  };

  const onOpenNavigation = (lat, lng, address) => {
    openNavigation(lat, lng, address);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brandName}>SWYFTinc</Text>
          <Text style={styles.headerTitle}>Driver Mode</Text>
          <Text style={styles.headerSubtitle}>{state.driverInfo?.firstName || 'Driver'}</Text>
<View style={styles.vehicleInfoContainer}>
  <Text style={styles.vehicleInfoTitle}>Vehicle:</Text>
  <Text style={styles.vehicleInfo}>{state.driverInfo?.vehicleMake || 'N/A'} {state.driverInfo?.vehicleModel || ''} {state.driverInfo?.vehicleYear || ''}</Text>
  <Text style={styles.vehicleInfo}>Plate: {state.driverInfo?.vehiclePlate || 'N/A'}</Text>
</View>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/(driver)/profile')}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {(state.driverInfo?.firstName || 'D').charAt(0).toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Your Status</Text>
              <Text style={[styles.statusValue, state.isOnline ? styles.onlineText : styles.offlineText]}>
                {state.isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggleButton, state.isOnline && styles.toggleButtonActive]}
              onPress={onToggleOnline}
            >
              <Text style={[styles.toggleText, state.isOnline && styles.toggleTextActive]}>
                {state.isOnline ? 'Go Offline' : 'Go Online'}
              </Text>
            </TouchableOpacity>
          </View>
          {state.location && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationCoords}>
                {state.location.latitude.toFixed(4)}, {state.location.longitude.toFixed(4)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.mapContainer}>
          {state.location ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: state.location.latitude,
                longitude: state.location.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
              showsCompass={true}
            >
              <Marker
                coordinate={{
                  latitude: state.location.latitude,
                  longitude: state.location.longitude,
                }}
                title="Your Location"
                description="You are here"
              >
                <View style={styles.driverMarkerStyle}>
                  <Text style={styles.driverMarkerText}>D</Text>
                </View>
              </Marker>

              {state.passengerLocation && (
                <Marker
                  coordinate={state.passengerLocation}
                  title="Passenger Location"
                  pinColor={COLORS.success}
                />
              )}

              {state.currentRide?.pickup_lat && state.currentRide?.pickup_lng && (
                <Marker
                  coordinate={{
                    latitude: parseFloat(state.currentRide.pickup_lat),
                    longitude: parseFloat(state.currentRide.pickup_lng),
                  }}
                  title="Pickup"
                  pinColor={COLORS.success}
                />
              )}

              {state.currentRide?.dropoff_lat && state.currentRide?.dropoff_lng && (
                <Marker
                  coordinate={{
                    latitude: parseFloat(state.currentRide.dropoff_lat),
                    longitude: parseFloat(state.currentRide.dropoff_lng),
                  }}
                  title="Dropoff"
                  pinColor={COLORS.error}
                />
              )}

              {state.currentRide && (state.currentRide.status === 'accepted' || state.currentRide.status === 'arrived_pickup' || state.currentRide.status === 'active' || state.currentRide.status === 'arriving') && state.location && state.currentRide?.pickup_lat && state.currentRide?.pickup_lng && (
                <Polyline
                  coordinates={[
                    { latitude: state.location.latitude, longitude: state.location.longitude },
                    { latitude: parseFloat(state.currentRide.pickup_lat), longitude: parseFloat(state.currentRide.pickup_lng) },
                  ]}
                  strokeColor={COLORS.primary}
                  strokeWidth={4}
                  lineDashPattern={[0]}
                />
              )}

              {(state.currentRide?.status === 'active') && state.currentRide?.pickup_lat && state.currentRide?.pickup_lng && state.currentRide?.dropoff_lat && state.currentRide?.dropoff_lng && (
                <Polyline
                  coordinates={[
                    { latitude: parseFloat(state.currentRide.pickup_lat), longitude: parseFloat(state.currentRide.pickup_lng) },
                    { latitude: parseFloat(state.currentRide.dropoff_lat), longitude: parseFloat(state.currentRide.dropoff_lng) },
                  ]}
                  strokeColor={COLORS.success}
                  strokeWidth={5}
                  lineDashPattern={[0]}
                />
              )}

              {state.currentRide?.status === 'active' && state.location && state.currentRide?.dropoff_lat && state.currentRide?.dropoff_lng && (
                <Polyline
                  coordinates={[
                    { latitude: state.location.latitude, longitude: state.location.longitude },
                    { latitude: parseFloat(state.currentRide.dropoff_lat), longitude: parseFloat(state.currentRide.dropoff_lng) },
                  ]}
                  strokeColor={COLORS.primary}
                  strokeWidth={3}
                  lineDashPattern={[10, 5]}
                />
              )}
            </MapView>
          ) : (
            <View style={[styles.mapPlaceholder, { justifyContent: 'center', alignItems: 'center' }]}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.mapPlaceholderText}>Getting your location...</Text>
            </View>
          )}
        </View>

        {state.currentRide && (
          <CurrentRide
            ride={state.currentRide}
            eta={state.eta}
            etaDropoff={state.etaDropoff}
            onArrivedAtPickup={onArrivedAtPickup}
            onStartRide={onStartRide}
            onArriving={onArriving}
            onCompleteRide={onCompleteRide}
            onCancelCurrentRide={onCancelCurrentRide}
            onOpenNavigation={onOpenNavigation}
          />
        )}

        {state.isOnline && !state.currentRide && (
          <View style={styles.availableSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Deliveries</Text>
              <Text style={styles.rideCount}>{state.pendingRides.length} requests</Text>
            </View>

            {state.loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Finding Deliveries...</Text>
              </View>
            ) : state.pendingRides.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🚚</Text>
                <Text style={styles.emptyTitle}>No Deliveries available</Text>
                <Text style={styles.emptyText}>Waiting for delivery requests...</Text>
                <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                style={styles.ridesList}
                contentContainerStyle={styles.ridesListContent}
                refreshControl={
                  <RefreshControl refreshing={state.refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
              >
                {state.pendingRides.map(ride => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    onAccept={onAcceptRide}
                    onDecline={onDeclineRide}
                    location={state.location}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {!state.isOnline && !state.currentRide && (
          <View style={styles.offlineContainer}>
            <Text style={styles.offlineIcon}>☁️</Text>
            <Text style={styles.offlineTitle}>You're Offline</Text>
            <Text style={styles.offlineText}>
              Go online to start receiving ride requests from passengers nearby.
            </Text>
            <TouchableOpacity style={styles.goOnlineButton} onPress={onToggleOnline}>
              <Text style={styles.goOnlineButtonText}>Go Online Now</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{state.earnings.total_trips}</Text>
            <Text style={styles.statLabel}>Total Rides</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₺{state.earnings.today_earnings?.toFixed(2) || '0.00'}</Text>
            <Text style={styles.statLabel}>Today's Earnings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>⭐ {state.driverInfo?.rating ? Number(state.driverInfo.rating).toFixed(1) : '5.0'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
