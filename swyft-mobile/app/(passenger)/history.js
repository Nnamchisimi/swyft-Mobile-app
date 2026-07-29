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
    { key: 'all', label: 'All', icon: 'list' },
    { key: 'accepted', label: 'Accepted', icon: 'checkmark-circle' },
    { key: 'active', label: 'In Progress', icon: 'car' },
    { key: 'completed', label: 'Completed', icon: 'checkmark-done' },
    { key: 'cancelled', label: 'Cancelled', icon: 'close-circle' },
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
      return rides.filter(ride => ride.status === 'cancelled');
    }
    if (activeTab === 'active') {
      return rides.filter(ride => ['accepted', 'picked_up', 'active', 'arrived_pickup'].includes(ride.status));
    }
    return rides.filter(ride => ride.status === activeTab);
  };

  const getRideCounts = () => {
    return {
      all: rides.length,
      accepted: rides.filter(r => r.status === 'accepted' || r.status === 'picked_up').length,
      active: rides.filter(r => ['accepted', 'picked_up', 'active', 'arrived_pickup'].includes(r.status)).length,
      completed: rides.filter(r => r.status === 'completed' || r.status === 'confirmed').length,
      cancelled: rides.filter(r => r.status === 'cancelled').length,
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return COLORS.success;
      case 'cancelled':
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
    <TouchableOpacity
      style={styles.rideCard}
      onPress={() => router.push({ pathname: '/(passenger)/ride-details', params: { rideId: item.id } })}
      activeOpacity={0.8}
    >
      <View style={styles.rideHeader}>
        <Text style={styles.rideId}>Delivery #{item.delivery_id || item.id}</Text>
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
            <Text style={styles.locationLabel}>Courier:</Text>
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

      <View style={styles.rideFooter}>
        <Text style={styles.dateText}>
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
        </Text>
        <Text style={styles.viewDetailsText}>View details →</Text>
      </View>
    </TouchableOpacity>
  );


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.brandName}>SWYFTinc</Text>
          <Text style={styles.headerTitle}>My dispatch History</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabContent}>
    <ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={styles.tabScroll}
  contentContainerStyle={styles.tabContainer}
  bounces={false}
>
  {tabs.map((tab) => {
    const isActive = activeTab === tab.key;

    return (
      <TouchableOpacity
        key={tab.key}
        style={[styles.tab, isActive && styles.activeTab]}
        onPress={() => setActiveTab(tab.key)}
      >
        <Ionicons
          name={tab.icon}
          size={16}
          color={isActive ? COLORS.white : COLORS.text}
        />

        <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
          {tab.label}
        </Text>

        {getRideCounts()[tab.key] > 0 && (
          <View
            style={[
              styles.tabBadge,
              {
                backgroundColor: isActive
                  ? COLORS.white
                  : COLORS.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.tabBadgeText,
                {
                  color: isActive
                    ? COLORS.primary
                    : COLORS.white,
                },
              ]}
            >
              {getRideCounts()[tab.key]}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  })}
</ScrollView>

        <FlatList
          style={{ flex: 1 }}
          data={getFilteredRides()}
          renderItem={renderRide}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.listEmptyContainer}>
              <Ionicons name="car-outline" size={48} color={COLORS.gray} />
              {rides.length === 0 ? (
                <>
                  <Text style={styles.listEmptyText}>No rides yet</Text>
                  <Text style={styles.listEmptySubtext}>Book your first ride to get started</Text>
                  <TouchableOpacity
                    style={styles.listEmptyButton}
                    onPress={() => router.push('/(passenger)/book-ride')}
                  >
                    <Text style={styles.listEmptyButtonText}>Book Your First Ride</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.listEmptyText}>No {activeTab} rides</Text>
                  <Text style={styles.listEmptySubtext}>
                    You don't have any {activeTab} rides
                  </Text>
                  <TouchableOpacity
                    style={styles.listEmptyButton}
                    onPress={() => setActiveTab('all')}
                  >
                    <Text style={styles.listEmptyButtonText}>Show All Rides</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
        />
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(passenger)/home')}>
          <Ionicons name="home" size={24} color={COLORS.gray} />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(passenger)/book-ride')}>
          <Ionicons name="car" size={24} color={COLORS.gray} />
          <Text style={styles.navText}>Book</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="list" size={24} color={COLORS.primary} />
          <Text style={[styles.navText, styles.navTextActive]}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(passenger)/profile')}>
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
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: COLORS.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  brandName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  headerAction: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
    flexGrow: 1,
    padding: 16,
    paddingBottom: 90,
  },

  listEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    backgroundColor: COLORS.white,
  },

  listEmptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'capitalize',
  },

  listEmptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },

  listEmptyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },

  listEmptyButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },

  tabContent: {
    flex: 1,
  },

  tabScroll: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexGrow: 0,
  },

  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },

  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 70,
    marginRight: 10,
  },

  activeTab: {
    backgroundColor: '#EAF4FF',
    borderColor: COLORS.primary,
  },

  tabLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
    fontWeight: '600',
    marginLeft: 4,
  },

  activeTabLabel: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    paddingHorizontal: 4,
  },

  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
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
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewDetailsText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },

  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
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