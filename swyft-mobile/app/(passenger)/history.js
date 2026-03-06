import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/auth';
import { ridesAPI } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';

export default function HistoryScreen() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { key: 'all', label: 'All', icon: ' rides' },
    { key: 'accepted', label: 'Accepted', icon: ' rides' },
    { key: 'active', label: 'In Progress', icon: ' rides' },
    { key: 'completed', label: 'Completed', icon: ' rides' },
    { key: 'cancelled', label: 'Cancelled', icon: ' rides' },
  ];

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const email = await authService.getUserEmail();
    setUserEmail(email || '');
    if (email) {
      fetchRides(email);
    }
  };

  const fetchRides = async (email) => {
    try {
      const response = await ridesAPI.getRides();
      
      const passengerRides = response.data.filter(
        (ride) => ride.passenger_email === email
      );
      setRides(passengerRides);
    } catch (error) {
      console.error('Error fetching rides:', error);
      Alert.alert('Error', 'Failed to load ride history');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRides = () => {
    if (activeTab === 'all') return rides;
    if (activeTab === 'cancelled') {
      return rides.filter(ride => ride.status === 'cancelled' || ride.status === 'canceled');
    }
    return rides.filter(ride => ride.status === activeTab);
  };

  const getRideCounts = () => {
    return {
      all: rides.length,
      accepted: rides.filter(r => r.status === 'accepted').length,
      active: rides.filter(r => r.status === 'active').length,
      completed: rides.filter(r => r.status === 'completed').length,
      cancelled: rides.filter(r => r.status === 'cancelled' || r.status === 'canceled').length,
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return COLORS.success;
      case 'cancelled':
      case 'canceled':
        return COLORS.error;
      case 'active':
        return COLORS.primary;
      case 'accepted':
        return '#FF9500';
      default:
        return COLORS.textSecondary;
    }
  };

  const renderRide = ({ item }) => (
    <View style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <Text style={styles.rideId}>Ride #{item.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <View style={styles.rideDetails}>
        <View style={styles.locationRow}>
          <Text style={styles.locationLabel}>From:</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickup_location || 'N/A'}
          </Text>
        </View>
        <View style={styles.locationRow}>
          <Text style={styles.locationLabel}>To:</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {item.dropoff_location || 'N/A'}
          </Text>
        </View>
        {item.driver_name && (
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Driver:</Text>
            <Text style={styles.locationText}>{item.driver_name}</Text>
          </View>
        )}
        {item.price && (
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Price:</Text>
            <Text style={styles.priceText}>₺{item.price}</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.dateText}>
        {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
      </Text>
    </View>
  );

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
            router.replace('/(auth)/signin');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Rides</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No rides yet</Text>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => router.push('/(passenger)/book-ride')}
          >
            <Text style={styles.bookButtonText}>Book Your First Ride</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rides}
          renderItem={renderRide}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
        />
      )}

      {}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(passenger)/home')}
        >
          <Ionicons name="home" size={24} color={COLORS.gray} />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="list" size={24} color={COLORS.primary} />
          <Text style={[styles.navText, styles.navTextActive]}>Rides</Text>
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
  backButton: {
    fontSize: 16,
    color: COLORS.primary,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  logoutText: {
    fontSize: 14,
    color: COLORS.error,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  bookButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  rideCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideId: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  rideDetails: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  locationLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    width: 70,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  priceText: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 24,
  },
  navText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  navTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
