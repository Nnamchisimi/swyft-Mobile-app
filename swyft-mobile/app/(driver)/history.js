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
} from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/auth';
import { ridesAPI } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';

export default function DriverHistoryScreen() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'active', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
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
      const driverRides = response.data.filter(
        (ride) => ride.driver_email === email
      );
      setRides(driverRides);
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
      completed: rides.filter(r => r.status === 'completed' || r.status === 'confirmed').length,
      cancelled: rides.filter(r => r.status === 'cancelled' || r.status === 'canceled').length,
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'confirmed':
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

  const formatStatus = (status) => {
    if (status === 'confirmed') return 'completed';
    return status;
  };

  const renderRide = ({ item }) => (
    <View style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <Text style={styles.rideId}>Dispatch #{item.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{formatStatus(item.status)}</Text>
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
        {item.passenger_name && (
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Customer:</Text>
            <Text style={styles.locationText}>{item.passenger_name}</Text>
          </View>
        )}
        {item.price && (
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Fare:</Text>
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

  const counts = getRideCounts();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My dispatch History</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={tabs}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tab, activeTab === item.key && styles.activeTab]}
              onPress={() => setActiveTab(item.key)}
            >
              <Text style={[styles.tabText, activeTab === item.key && styles.activeTabText]}>
                {item.label}
              </Text>
              <Text style={[styles.tabCount, activeTab === item.key && styles.activeTabCount]}>
                {counts[item.key] || 0}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.tabsContent}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : getFilteredRides().length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={60} color={COLORS.gray} />
          <Text style={styles.emptyText}>No dispatches found</Text>
          <Text style={styles.emptySubtext}>
            {activeTab === 'all' 
              ? 'Go online to start receiving dispatch requests'
              : `No ${activeTab} dispatches`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredRides()}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          renderItem={renderRide}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  logoutText: {
    fontSize: 14,
    color: COLORS.error,
    fontWeight: '600',
  },
  tabsContainer: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabsContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.white,
  },
  tabCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  activeTabCount: {
    color: 'rgba(255,255,255,0.8)',
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
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  rideCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
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
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    width: 70,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 12,
    textAlign: 'right',
  },
});