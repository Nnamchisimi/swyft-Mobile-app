import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { authService } from '../../services/auth';
import { ridesAPI, driverAPI } from '../../services/api';
import { socketService } from '../../services/socket';
import { COLORS } from '../../constants/config';
import geoService from '../../services/geo';
import { Ionicons } from '@expo/vector-icons';

export default function DriverDashboardScreen() {
  const router = useRouter();
  const [driverInfo, setDriverInfo] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [pendingRides, setPendingRides] = useState([]);
  const [currentRide, setCurrentRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);

  useEffect(() => {
    loadDriverData();
    requestLocation();
    setupSocketListeners();

    return () => {
      socketService.removeAllListeners();
    };
  }, []);

  const loadDriverData = async () => {
    const info = await authService.getDriverInfo();
    setDriverInfo(info);
    
    const email = await authService.getUserEmail();
    if (email) {
      socketService.connect();
      socketService.joinRoom(email);
    }
  };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const setupSocketListeners = () => {
    socketService.on('newRide', (ride) => {
      if (ride.status === 'pending') {
        setPendingRides((prev) => [...prev, ride]);
      }
    });

    socketService.on('rideUpdated', (ride) => {
      if (ride.driver_email === driverInfo?.email) {
        if (ride.status === 'accepted' || ride.status === 'in_progress') {
          setCurrentRide(ride);
        } else if (ride.status === 'completed' || ride.status === 'cancelled') {
          setCurrentRide(null);
        }
      }
    });
  };

  const toggleOnline = () => {
    if (!isOnline && !location) {
      Alert.alert('Error', 'Location not available. Please try again.');
      return;
    }
    setIsOnline(!isOnline);
    
    if (!isOnline) {
      fetchPendingRides();
    }
  };

  const fetchPendingRides = async () => {
    try {
      setLoading(true);
      const response = await driverAPI.getPendingRides();
      setPendingRides(response.data);
    } catch (error) {
      console.error('Error fetching rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRide = async (ride) => {
    try {
      const driverData = {
        name: `${driverInfo?.first_name || ''} ${driverInfo?.last_name || ''}`.trim() || 'Driver',
        email: driverInfo?.email || await authService.getUserEmail(),
        phone: driverInfo?.phone || 'N/A',
        vehicle: driverInfo?.vehicle || `${driverInfo?.vehicle_year || ''} ${driverInfo?.vehicle_make || ''} ${driverInfo?.vehicle_model || ''}`.trim(),
      };
      
      await ridesAPI.acceptRide(ride.id, driverData);
      setPendingRides((prev) => prev.filter((r) => r.id !== ride.id));
      setCurrentRide({ ...ride, ...driverData, status: 'accepted' });
      Alert.alert('Success', 'Ride accepted!');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept ride');
    }
  };

  const handleCompleteRide = async () => {
    if (!currentRide) return;

    Alert.alert(
      'Complete Ride',
      'Mark this ride as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await driverAPI.completeRide(currentRide.id);
              setCurrentRide(null);
              Alert.alert('Success', 'Ride completed!');
            } catch (error) {
              Alert.alert('Error', 'Failed to complete ride');
            }
          },
        },
      ]
    );
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
            router.replace('/signin');
          },
        },
      ]
    );
  };

  const renderRideItem = ({ item }) => {
    const [eta, setEta] = useState(null);
    const [etaLoading, setEtaLoading] = useState(false);
    
    useEffect(() => {
      if (location && item.pickup_location) {
        const pickupLoc = JSON.parse(item.pickup_location || '{}');
        if (pickupLoc.latitude && pickupLoc.longitude) {
          setEtaLoading(true);
          geoService.getETA(location, pickupLoc).then(result => {
            if (result && result.duration) {
              setEta(Math.round(result.duration / 60));
            }
            setEtaLoading(false);
          }).catch(() => setEtaLoading(false));
        }
      }
    }, [location, item.pickup_location]);
    
    return (
      <TouchableOpacity
        style={styles.rideCard}
        onPress={() => handleAcceptRide(item)}
      >
        <View style={styles.rideHeader}>
          <Text style={styles.rideId}>Ride #{item.id}</Text>
          <Text style={styles.rideStatus}>{item.status}</Text>
        </View>
        <Text style={styles.rideRoute}>
          From: {JSON.parse(item.pickup_location || '{}').latitude?.toFixed(4)}, {JSON.parse(item.pickup_location || '{}').longitude?.toFixed(4)}
        </Text>
        <Text style={styles.rideRoute}>
          To: {JSON.parse(item.dropoff_location || '{}').latitude?.toFixed(4)}, {JSON.parse(item.dropoff_location || '{}').longitude?.toFixed(4)}
        </Text>
        {eta !== null && (
          <Text style={styles.etaText}>
            <Ionicons name="time" size={14} color={COLORS.primary} /> {eta} min away
          </Text>
        )}
        {etaLoading && (
          <Text style={styles.etaText}>Calculating ETA...</Text>
        )}
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptRide(item)}
        >
          <Text style={styles.acceptButtonText}>Accept Ride</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Driver Dashboard</Text>
          <Text style={styles.subtitle}>{driverInfo?.name || 'Driver'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={[styles.statusValue, isOnline ? styles.online : styles.offline]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggleButton, isOnline && styles.toggleButtonActive]}
            onPress={toggleOnline}
          >
            <Text style={[styles.toggleText, isOnline && styles.toggleTextActive]}>
              {isOnline ? 'Go Offline' : 'Go Online'}
            </Text>
          </TouchableOpacity>
        </View>

        {location && (
          <Text style={styles.locationText}>
            <Ionicons name="location" size={16} color={COLORS.primary} /> {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </Text>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Current Ride */}
        {currentRide && (
          <View style={styles.currentRideCard}>
            <Text style={styles.sectionTitle}>Current Ride</Text>
            <View style={styles.rideInfo}>
              <Text style={styles.rideInfoText}>
                Passenger: {currentRide.passenger_email}
              </Text>
              <Text style={styles.rideInfoText}>
                Status: {currentRide.status}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleCompleteRide}
            >
              <Text style={styles.completeButtonText}>Complete Ride</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pending Rides */}
        {isOnline && (
          <View style={styles.pendingSection}>
            <View style={styles.pendingHeader}>
              <Text style={styles.sectionTitle}>Available Rides</Text>
              <TouchableOpacity onPress={fetchPendingRides}>
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>
            
            {loading ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : pendingRides.length > 0 ? (
              pendingRides.map((ride) => (
                <View key={ride.id} style={styles.rideCard}>
                  <View style={styles.rideHeader}>
                    <Text style={styles.rideId}>Ride #{ride.id}</Text>
                  </View>
                  <Text style={styles.rideRoute}>
                    Pickup: {ride.pickup_location?.substring(0, 30)}...
                  </Text>
                  <Text style={styles.rideRoute}>
                    Dropoff: {ride.dropoff_location?.substring(0, 30)}...
                  </Text>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptRide(ride)}
                  >
                    <Text style={styles.acceptButtonText}>Accept Ride</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No rides available</Text>
                <Text style={styles.emptySubtext}>
                  {loading ? 'Loading...' : 'Pull down to refresh'}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  online: {
    color: COLORS.success,
  },
  offline: {
    color: COLORS.textSecondary,
  },
  toggleButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: COLORS.white,
  },
  locationText: {
    marginTop: 16,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  currentRideCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  rideInfo: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  rideInfoText: {
    color: COLORS.white,
    fontSize: 14,
    marginBottom: 4,
  },
  completeButton: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  completeButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  pendingSection: {
    marginBottom: 24,
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  rideCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rideId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  rideStatus: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  rideRoute: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  etaText: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  acceptButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});
