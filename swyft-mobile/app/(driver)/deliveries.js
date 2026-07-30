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
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../src/services/auth';
import { ridesAPI } from '../../src/services/api';
import { COLORS } from '../../src/constants/config';
import DriverBottomTabBar from './components/BottomTabBar';

export default function DriverDeliveriesScreen() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'active', label: 'Active' },
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
      const allRides = response.data || [];
      const driverRides = allRides.filter(ride => ride.driver_email === email);
      setRides(driverRides);
    } catch (error) {
      console.error('Error fetching rides:', error);
      Alert.alert('Error', 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'confirmed':
        return COLORS.success;
      case 'cancelled':
        return COLORS.error;
      case 'picked_up':
      case 'arrived_dropoff':
        return '#FF9500';
      case 'accepted':
      case 'arrived_pickup':
        return COLORS.primary;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'accepted':
        return 'Accepted';
      case 'arrived_pickup':
        return 'At Pickup';
      case 'picked_up':
        return 'Picked Up';
      case 'arrived_dropoff':
        return 'At Dropoff';
      case 'completed':
      case 'confirmed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const getFilteredRides = () => {
    let filtered = rides;

    if (activeTab !== 'all') {
      if (activeTab === 'active') {
        filtered = rides.filter(ride => ['accepted', 'picked_up', 'arrived_pickup', 'arrived_dropoff', 'active', 'arriving'].includes(ride.status));
      } else if (activeTab === 'completed') {
        filtered = rides.filter(ride => ride.status === 'completed' || ride.status === 'confirmed');
      } else {
        filtered = rides.filter(ride => ride.status === activeTab);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(ride => 
        String(ride.id).includes(q) ||
        (ride.delivery_id && ride.delivery_id.toLowerCase().includes(q)) ||
        (ride.pickup_location && ride.pickup_location.toLowerCase().includes(q)) ||
        (ride.dropoff_location && ride.dropoff_location.toLowerCase().includes(q)) ||
        (ride.passenger_name && ride.passenger_name.toLowerCase().includes(q))
      );
    }

    return filtered;
  };

  const getTabCount = (key) => {
    if (key === 'all') return rides.length;
    if (key === 'active') return rides.filter(ride => ['accepted', 'picked_up', 'arrived_pickup', 'arrived_dropoff', 'active', 'arriving'].includes(ride.status)).length;
    if (key === 'completed') return rides.filter(ride => ride.status === 'completed' || ride.status === 'confirmed').length;
    return rides.filter(ride => ride.status === key).length;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  const renderRide = ({ item }) => (
    <TouchableOpacity 
      style={styles.rideCard}
      onPress={() => router.push({ pathname: '/(driver)/delivery-details', params: { rideId: item.id } })}
      activeOpacity={0.8}
    >
      <View style={styles.rideHeader}>
        <Text style={styles.rideId} numberOfLines={1} ellipsizeMode="tail">#{item.delivery_id || item.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <View style={styles.rideDetails}>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={16} color={COLORS.success} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickup_location || item.pickup || 'N/A'}
          </Text>
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="flag" size={16} color={COLORS.error} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.dropoff_location || item.dropoff || 'N/A'}
          </Text>
        </View>
        {item.passenger_name && (
          <View style={styles.locationRow}>
            <Ionicons name="person" size={16} color={COLORS.textSecondary} />
            <Text style={styles.locationText}>{item.passenger_name}</Text>
          </View>
        )}
      </View>

      <View style={styles.rideFooter}>
        <Text style={styles.priceText}>₺{item.price ? Number(item.price).toFixed(2) : '0.00'}</Text>
        <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );

  const filteredRides = getFilteredRides();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Deliveries</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredRides}
          renderItem={renderRide}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by ID, address, or name..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={COLORS.textSecondary}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabScroll}
                contentContainerStyle={styles.tabContainer}
              >
                {tabs.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                      {tab.label} ({getTabCount(tab.key)})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>No deliveries found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? 'Try a different search term' : 'Your delivery history will appear here'}
              </Text>
            </View>
          }
        />
      )}

      <DriverBottomTabBar />
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 4,
  },
  tabScroll: {
    backgroundColor: COLORS.white,
    marginBottom: 8,
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 10,
  },
  tab: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#EAF4FF',
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  rideCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideId: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
    textTransform: 'capitalize',
  },
  rideDetails: {
    gap: 8,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.success,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
