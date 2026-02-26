import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { authService } from '../../services/auth';
import { COLORS } from '../../constants/config';

export default function PassengerHomeScreen() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [location, setLocation] = useState(null);

  useEffect(() => {
    loadUserData();
    requestLocation();
  }, []);

  const loadUserData = async () => {
    const email = await authService.getUserEmail();
    setUserEmail(email || '');
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
            router.replace('/signin');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.email}>{userEmail}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>What would you like to do?</Text>
        
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(passenger)/book-ride')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="car" size={24} color="#2196F3" />
            </View>
            <Text style={styles.actionTitle}>Book a Ride</Text>
            <Text style={styles.actionDesc}>Get to your destination</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(passenger)/history')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="list" size={24} color="#FF9800" />
            </View>
            <Text style={styles.actionTitle}>My Rides</Text>
            <Text style={styles.actionDesc}>View ride history</Text>
          </TouchableOpacity>
        </View>

        {/* Location Info */}
        <View style={styles.locationCard}>
          <Text style={styles.locationTitle}>Current Location</Text>
          {location ? (
            <Text style={styles.locationText}>
              Lat: {location.latitude.toFixed(4)}, Lng: {location.longitude.toFixed(4)}
            </Text>
          ) : (
            <Text style={styles.locationText}>Fetching location...</Text>
          )}
        </View>

        {/* How it works */}
        <Text style={styles.sectionTitle}>How it works</Text>
        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Enter Location</Text>
              <Text style={styles.stepDesc}>Tell us where you want to go</Text>
            </View>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Get Matched</Text>
              <Text style={styles.stepDesc}>We'll find the nearest driver</Text>
            </View>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Track Your Ride</Text>
              <Text style={styles.stepDesc}>See your driver arrive in real-time</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={24} color={COLORS.primary} />
          <Text style={[styles.navText, styles.navTextActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(passenger)/book-ride')}
        >
          <Ionicons name="car" size={24} color={COLORS.textSecondary} />
          <Text style={styles.navText}>Book</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(passenger)/history')}
        >
          <Ionicons name="list" size={24} color={COLORS.textSecondary} />
          <Text style={styles.navText}>Rides</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(passenger)/profile')}
        >
          <Ionicons name="person" size={24} color={COLORS.textSecondary} />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  email: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionEmoji: {
    fontSize: 28,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  locationCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  locationTitle: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.8,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '600',
  },
  stepsContainer: {
    gap: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  stepDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  navText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  navTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
