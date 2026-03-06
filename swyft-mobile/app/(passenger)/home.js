import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { authService } from '../../src/services/auth';
import { ridesAPI } from '../../src/services/api';
import { socketService } from '../../src/services/socket';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';

const { width } = Dimensions.get('window');

export default function PassengerHomeScreen() {
  const router = useRouter();
  const currentRideRef = useRef(null); 
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [location, setLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [currentRide, setCurrentRide] = useState(null);

  useEffect(() => {
    loadUserData();
    requestLocation();
    setupSocket();

    return () => {
      socketService.removeAllListeners();
    };
  }, []);

  const loadUserData = async () => {
    const email = await authService.getUserEmail();
    const info = await authService.getDriverInfo();
    setUserEmail(email || '');
    setUserName(info?.name || 'Passenger');
    
    
    if (email) {
      loadActiveRide(email);
    }
  };

  const loadActiveRide = async (email) => {
    try {
      const response = await ridesAPI.getRides({ 
        passenger_email: email,
        status: 'accepted,arrived,active,pending' 
      });
      
      if (response.data && response.data.length > 0) {
        const activeRide = response.data[0];
        setCurrentRide(activeRide);
        currentRideRef.current = activeRide;
        console.log('Loaded active ride on passenger app start:', activeRide.id, activeRide.status);
      }
    } catch (error) {
      console.log('No active ride found');
    }
  };

  const setupSocket = async () => {
    const email = await authService.getUserEmail();
    if (email) {
      socketService.connect();
      socketService.joinRoom(email);
      
      
      socketService.on('rideUpdated', (ride) => {
        console.log('rideUpdated received in home:', ride);
        if (ride.passenger_email === email || ride.id === currentRideRef.current?.id) {
          setCurrentRide(ride);
          currentRideRef.current = ride;
          if (ride.status === 'accepted') {
            Alert.alert(
              '🎉 Driver Found!',
              `Your driver is on the way!\n\nDriver: ${ride.driver_name || 'Driver'}\nVehicle: ${ride.driver_vehicle || 'N/A'}`,
              [{ 
                text: 'View Ride', 
                onPress: () => router.push('/(passenger)/book-ride')
              }]
            );
          } else if (ride.status === 'arrived' || ride.status === 'active') {
            Alert.alert(
              '🚗 Driver Arrived', 
              'Your driver has arrived at the pickup location!',
              [{ 
                text: 'View Ride', 
                onPress: () => router.push({
                  pathname: '/(passenger)/driver-arrived',
                  params: {
                    rideId: ride.id,
                    driverName: ride.driver_name,
                    driverPhone: ride.driver_phone,
                    driverVehicle: ride.driver_vehicle,
                    pickupAddress: ride.pickup_location,
                    dropoffAddress: ride.dropoff_location,
                    pickupLat: ride.pickup_lat,
                    pickupLng: ride.pickup_lng,
                  },
                })
              }]
            );
          } else if (ride.status === 'in_progress') {
            Alert.alert('🚀 Ride Started', 'Your ride has begun. Enjoy your trip!');
          } else if (ride.status === 'completed') {
            Alert.alert(
              '✅ Ride Completed', 
              `Thank you for riding with Swyft!\n\nFare: ₺${ride.price || '0.00'}`,
              [{ 
                text: 'Rate Your Driver',
                onPress: () => router.push({
                  pathname: '/(passenger)/rate-ride',
                  params: { 
                    rideId: ride.id,
                    driverName: ride.driver_name,
                    driverVehicle: ride.driver_vehicle,
                  },
                })
              }]
            );
            setCurrentRide(null);
          } else if (ride.status === 'cancelled' || ride.status === 'canceled') {
            Alert.alert('❌ Ride Cancelled', 'Your ride has been cancelled.');
            setCurrentRide(null);
          }
        }
      });
      
      
      socketService.on('driverLocationUpdated', (data) => {
        if (data.rideId === currentRideRef.current?.id) {
          console.log('Driver location updated:', data);
        }
      });
    }
  };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for this feature.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      
      
      try {
        const addresses = await Location.reverseGeocodeAsync(loc.coords);
        if (addresses.length > 0) {
          const addr = addresses[0];
          setLocationAddress(`${addr.street || ''} ${addr.city || ''}`.trim());
        }
      } catch (e) {
        setLocationAddress(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await authService.logout();
            socketService.disconnect();
            router.replace('/(auth)/signin');
          },
        },
      ]
    );
  };

  const quickActions = [
    {
      icon: <Ionicons name="car" size={24} color={'#2196F3'} />,
      title: 'Book a Ride',
      description: 'Get a ride to your destination',
      route: '/(passenger)/book-ride',
      color: '#E3F2FD',
      iconBg: '#2196F3',
    },
    {
      icon: <Ionicons name="list" size={24} color={'#FF9800'} />,
      title: 'My Rides',
      description: 'View your ride history',
      route: '/(passenger)/history',
      color: '#FFF3E0',
      iconBg: '#FF9800',
    },
    {
      icon: <Ionicons name="star" size={24} color={'#9C27B0'} />,
      title: 'Favorites',
      description: 'Saved locations',
      route: '/(passenger)/favorites',
      color: '#F3E5F5',
      iconBg: '#9C27B0',
    },
    {
      icon: <Ionicons name="card" size={24} color={'#4CAF50'} />,
      title: 'Payment',
      description: 'Manage payment methods',
      route: '/(passenger)/payment',
      color: '#E8F5E9',
      iconBg: '#4CAF50',
    },
  ];

  const recentDestinations = [
    { id: 1, name: 'Home', address: '123 Main Street', icon: 'home' },
    { id: 2, name: 'Work', address: '456 Business Ave', icon: 'business' },
    { id: 3, name: 'Gym', address: '789 Fitness Blvd', icon: 'fitness' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      {}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brandName}>SWYFTinc</Text>
          <Text style={styles.greeting}>Hello, {userName}!</Text>
          <Text style={styles.email}>{userEmail}</Text>
        </View>
        <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/(passenger)/profile')}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Text style={styles.locationLabel}>Current Location</Text>
            <TouchableOpacity onPress={requestLocation}>
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.locationContent}>
            <Ionicons name="location" size={24} color={COLORS.primary} />
            <View style={styles.locationTextContainer}>
              {location ? (
                <>
                  <Text style={styles.locationAddress} numberOfLines={1}>
                    {locationAddress || 'Current Location'}
                  </Text>
                  <Text style={styles.locationCoords}>
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </Text>
                </>
              ) : (
                <Text style={styles.locationLoading}>Getting your location...</Text>
              )}
            </View>
          </View>
        </View>

        {}
        <TouchableOpacity 
          style={styles.bookRideButton}
          onPress={() => router.push('/(passenger)/book-ride')}
        >
          <View style={styles.bookRideContent}>
            <View style={styles.bookRideIconContainer}>
              <Ionicons name="car" size={40} color={COLORS.primary} />
            </View>
            <View style={styles.bookRideTextContainer}>
              <Text style={styles.bookRideTitle}>Where to?</Text>
              <Text style={styles.bookRideSubtitle}>Book a ride to your destination</Text>
            </View>
            <Text style={styles.bookRideArrow}>→</Text>
          </View>
        </TouchableOpacity>

        {}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionCard, { backgroundColor: action.color }]}
                onPress={() => router.push(action.route)}
              >
                <View style={[styles.actionIconBg, { backgroundColor: action.iconBg }]}>
                  <Text style={styles.actionIcon}>{action.icon}</Text>
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDesc}>{action.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Destinations</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentDestinations.map((dest) => (
            <TouchableOpacity key={dest.id} style={styles.destinationItem}>
              <View style={styles.destinationIcon}>
                <Ionicons 
                  name={dest.icon === 'home' ? 'home' : dest.icon === 'work' ? 'business' : 'fitness'} 
                  size={20} 
                  color={COLORS.primary} 
                />
              </View>
              <View style={styles.destinationInfo}>
                <Text style={styles.destinationName}>{dest.name}</Text>
                <Text style={styles.destinationAddress}>{dest.address}</Text>
              </View>
              <Text style={styles.destinationArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        {}
        <View style={styles.promoBanner}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>First Ride Free!</Text>
            <Text style={styles.promoText}>Use code SWYFT2024 for ₺100 off your first ride</Text>
          </View>
          <Ionicons name="gift" size={24} color="#FF9800" />
        </View>

        {}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How Swyft Works</Text>
          <View style={styles.stepsContainer}>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: '#E3F2FD' }]}>
                <Text style={[styles.stepNumberText, { color: '#2196F3' }]}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Set Your Location</Text>
                <Text style={styles.stepDesc}>Enter your pickup and destination</Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: '#FFF3E0' }]}>
                <Text style={[styles.stepNumberText, { color: '#FF9800' }]}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Get Matched</Text>
                <Text style={styles.stepDesc}>We'll find nearby drivers for you</Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: '#E8F5E9' }]}>
                <Text style={[styles.stepNumberText, { color: '#4CAF50' }]}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Enjoy Your Ride</Text>
                <Text style={styles.stepDesc}>Track your driver in real-time</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={24} color={COLORS.primary} />
          <Text style={[styles.navText, styles.navTextActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(passenger)/book-ride')}
        >
          <Ionicons name="car" size={24} color={COLORS.gray} />
          <Text style={styles.navText}>Book</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(passenger)/history')}
        >
          <Ionicons name="list" size={24} color={COLORS.gray} />
          <Text style={styles.navText}>Rides</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
  },
  headerLeft: {
    flex: 1,
  },
  brandName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
    marginBottom: 2,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  email: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  profileButton: {
    padding: 4,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  locationCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  refreshText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  locationCoords: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  locationLoading: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  bookRideButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  bookRideContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookRideIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bookRideIcon: {
    fontSize: 24,
  },
  bookRideTextContainer: {
    flex: 1,
  },
  bookRideTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  bookRideSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  bookRideArrow: {
    fontSize: 24,
    color: COLORS.white,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (width - 44) / 2,
    padding: 16,
    borderRadius: 16,
    alignItems: 'flex-start',
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  destinationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  destinationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  destinationInfo: {
    flex: 1,
  },
  destinationName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  destinationAddress: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  destinationArrow: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  promoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  promoIcon: {
    fontSize: 32,
  },
  stepsContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  stepDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 22,
  },
  navText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  navTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
