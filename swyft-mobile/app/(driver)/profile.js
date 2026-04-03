import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/auth';
import { driverAPI, ridesAPI } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';

export default function DriverProfileScreen() {
  const router = useRouter();
  const [driverInfo, setDriverInfo] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [earnings, setEarnings] = useState({
    today_earnings: 0,
    total_earnings: 0,
    total_trips: 0,
    recent_rides: [],
  });
  const [loading, setLoading] = useState(true);
  const [completedRides, setCompletedRides] = useState([]);

  useEffect(() => {
    loadDriverData();
  }, []);

  const loadDriverData = async () => {
    try {
      const email = await authService.getUserEmail();
      setUserEmail(email || '');

      // Fetch fresh driver info from API (includes car details from cars table)
      if (email) {
        try {
          console.log('[Profile] Fetching driver info for:', email);
          const response = await driverAPI.getDriverInfo(email);
          console.log('[Profile] Driver API response:', response.data);
          if (response.data) {
            const driver = response.data;
            setDriverInfo({
              firstName: driver.first_name,
              lastName: driver.last_name,
              phone: driver.phone,
              email: driver.email,
              rating: driver.rating,
              isOnline: driver.is_online,
              // Vehicle info from cars table
              vehicleMake: driver.make,
              vehicleModel: driver.model,
              vehicleYear: driver.year,
              vehicleColor: driver.color,
              vehiclePlate: driver.plate_number,
            });
            console.log('[Profile] Vehicle data:', {
              make: driver.make,
              model: driver.model,
              year: driver.year,
              color: driver.color,
              plate: driver.plate_number
            });
          }
        } catch (apiError) {
          console.error('[Profile] Error fetching driver info:', apiError);
          // Fallback to cached info
          const info = await authService.getDriverInfo();
          console.log('[Profile] Using cached driver info:', info);
          setDriverInfo(info);
        }

        // Fetch earnings
        try {
          const response = await driverAPI.getEarnings(email);
          const data = response?.data;
          if (data && typeof data === 'object') {
            setEarnings({
              today_earnings: Number(data.today_earnings) || 0,
              total_earnings: Number(data.total_earnings) || 0,
              total_trips: Number(data.total_trips) || 0,
              recent_rides: Array.isArray(data.recent_rides) ? data.recent_rides : [],
            });
          }
        } catch (earningsError) {
          console.error('Error loading earnings:', earningsError);
          setEarnings({
            today_earnings: 0,
            total_earnings: 0,
            total_trips: 0,
            recent_rides: [],
          });
        }

        // Fetch ride history
        try {
          const ridesResponse = await ridesAPI.getRides({ driver_email: email });
          const allRides = ridesResponse.data || [];
          const completed = allRides.filter(r => 
            r.status === 'completed' || r.status === 'confirmed' || r.status === 'active'
          );
          setCompletedRides(completed);
        } catch (ridesError) {
          console.error('Error loading ride history:', ridesError);
        }
      }
    } catch (error) {
      console.error('Error loading driver data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle Add Vehicle button
  const handleAddVehicle = () => {
    Alert.alert(
      'Add Vehicle',
      'Vehicle registration is handled during signup. Please contact support to update your vehicle information.',
      [{ text: 'OK' }]
    );
  };

  // Handle menu item presses
  const handleEarningsReport = () => {
    router.push('/(driver)/dashboard');
  };

  const handleRideHistory = async () => {
    try {
      let email = userEmail;
      if (!email) {
        email = await authService.getUserEmail();
      }
      if (!email) {
        Alert.alert('Error', 'Unable to get driver email');
        return;
      }
      
      const response = await ridesAPI.getRides({ driver_email: email });
      const allRides = response.data || [];
      const completed = allRides.filter(r => 
        r.status === 'completed' || r.status === 'confirmed' || r.status === 'active'
      );
      setCompletedRides(completed);
    } catch (error) {
      console.error('Error fetching ride history:', error);
    }
  };

  const handlePaymentSettings = () => {
    Alert.alert('Payment Settings', 'Payment settings will be available in a future update.');
  };

  const handleNotifications = () => {
    Alert.alert('Notifications', 'Notification settings will be available in a future update.');
  };

  const handleHelpSupport = () => {
    Alert.alert('Help & Support', 'Contact us at support@swyft.com for assistance.');
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
          onPress: () => {
            authService.logout().then(() => {
              router.replace('/(auth)/signin');
            }).catch((err) => {
              console.error('Logout error:', err);
              router.replace('/(auth)/signin');
            });
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const iconMap = { car: 'car-outline', MONEY: 'cash-outline', star: 'star' };
  const StatCard = ({ label, value, icon }) => (
    <View style={styles.statCard}>
      <Ionicons name={iconMap[icon] || icon} size={28} color={COLORS.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.brandName}>SWYFTinc</Text>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(driverInfo?.firstName || 'D').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.onlineBadge}>
              <Text style={styles.onlineBadgeText}>✓</Text>
            </View>
          </View>
          <Text style={styles.driverName}>
            {driverInfo?.firstName ? `${driverInfo.firstName} ${driverInfo.lastName || ''}`.trim() : 'Driver'}
          </Text>
          <Text style={styles.driverEmail}>{userEmail}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingStar}>⭐</Text>
            <Text style={styles.ratingText}>{driverInfo?.rating ? Number(driverInfo.rating).toFixed(1) : '5.0'}</Text>
            <Text style={styles.ratingCount}>({earnings.total_trips || 0} trips)</Text>
          </View>
        </View>

        {}
        <View style={styles.earningsSection}>
          <Text style={styles.earningsTitle}>Today's Earnings</Text>
          <Text style={styles.earningsValue}>₺{earnings.today_earnings?.toFixed(2) || '0.00'}</Text>
        </View>

        {}
        <View style={styles.statsRow}>
          <StatCard 
            label="Total Trips" 
            value={earnings.total_trips || 0} 
            icon="car" 
          />
          <StatCard 
            label="Total Earnings" 
            value={`${earnings.total_earnings?.toFixed(0) || '0'}`} 
            icon="MONEY" 
          />
          <StatCard 
            label="Rating" 
            value={driverInfo?.rating ? Number(driverInfo.rating).toFixed(1) : '5.0'} 
            icon="star" 
          />
        </View>

        {}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ride History</Text>
          {completedRides.length > 0 ? (
            <View style={styles.ridesList}>
              {completedRides.map((ride, index) => (
                <View key={ride.id || index} style={styles.rideItem}>
                  <View style={styles.rideInfo}>
                    <Text style={styles.rideName}>{ride.passenger_name || 'Passenger'}</Text>
                    <Text style={styles.rideDate}>{formatDate(ride.created_at)}</Text>
                  </View>
                  <View style={styles.rideRight}>
                    <Text style={styles.ridePrice}>₺{Number(ride.price || 0).toFixed(2)}</Text>
                    <Text style={styles.rideStatus}>{ride.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyRides}>
              <Text style={styles.emptyRidesText}>No completed rides yet</Text>
            </View>
          )}
        </View>

        {}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Vehicle</Text>
          <View style={styles.vehicleCard}>
            {(driverInfo?.vehicleMake || driverInfo?.vehicleModel || driverInfo?.vehiclePlate) ? (
              <>
                <View style={styles.vehicleHeader}>
                  <Text style={styles.vehicleName}>
                    {driverInfo.vehicleYear} {driverInfo.vehicleMake} {driverInfo.vehicleModel}
                  </Text>
                  <View style={styles.vehicleColorBadge}>
                    <View style={[styles.colorDot, { 
                      backgroundColor: driverInfo.vehicleColor?.toLowerCase() === 'white' ? '#E0E0E0' : 
                                      driverInfo.vehicleColor?.toLowerCase() === 'black' ? '#333' : 
                                      driverInfo.vehicleColor?.toLowerCase() === 'red' ? '#F44336' : 
                                      driverInfo.vehicleColor?.toLowerCase() === 'blue' ? '#2196F3' : '#888' 
                    }]} />
                    <Text style={styles.vehicleColorText}>{driverInfo.vehicleColor || 'N/A'}</Text>
                  </View>
                </View>
                
                <View style={styles.vehicleDetails}>
                  <View style={styles.vehicleDetailRow}>
                    <Text style={styles.vehicleDetailLabel}>License Plate</Text>
                    <Text style={styles.vehicleDetailValue}>{driverInfo.vehiclePlate || 'N/A'}</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.noVehicle}>
                <Ionicons name="car" size={40} color={COLORS.gray} />
                <Text style={styles.noVehicleText}>No vehicle registered</Text>
                <TouchableOpacity style={styles.addVehicleButton} onPress={handleAddVehicle}>
                  <Text style={styles.addVehicleButtonText}>Add Vehicle</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>
                {driverInfo?.firstName ? `${driverInfo.firstName} ${driverInfo.lastName || ''}`.trim() : 'N/A'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{userEmail}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{driverInfo?.phone || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEarningsReport}>
              <Ionicons name="stats-chart" size={24} color={COLORS.primary} />
              <Text style={styles.menuText}>Earnings Report</Text>
              <Text style={styles.menuArrow}>{'>'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleRideHistory}>
              <Ionicons name="list" size={24} color={COLORS.primary} />
              <Text style={styles.menuText}>Ride History</Text>
              <Text style={styles.menuArrow}>{'>'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handlePaymentSettings}>
              <Ionicons name="card" size={24} color={COLORS.primary} />
              <Text style={styles.menuText}>Payment Settings</Text>
              <Text style={styles.menuArrow}>{'>'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleNotifications}>
              <Ionicons name="notifications" size={24} color={COLORS.primary} />
              <Text style={styles.menuText}>Notifications</Text>
              <Text style={styles.menuArrow}>{'>'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleHelpSupport}>
              <Ionicons name="help-circle" size={24} color={COLORS.primary} />
              <Text style={styles.menuText}>Help & Support</Text>
              <Text style={styles.menuArrow}>{'>'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color={COLORS.white} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Swyft Driver v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
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
    fontWeight: '500',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  brandName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  onlineBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  driverName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  driverEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStar: {
    fontSize: 16,
    marginRight: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 4,
  },
  ratingCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  earningsSection: {
    backgroundColor: COLORS.success,
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  earningsTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  earningsValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  ridesList: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rideItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rideInfo: {
    flex: 1,
  },
  rideName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  rideDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rideRight: {
    alignItems: 'flex-end',
  },
  ridePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
  },
  rideStatus: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  emptyRides: {
    backgroundColor: COLORS.white,
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyRidesText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  vehicleCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  vehicleColorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vehicleColorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  vehicleDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  vehicleDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  vehicleDetailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  vehicleDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  noVehicle: {
    alignItems: 'center',
    padding: 20,
  },
  noVehicleIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  noVehicleText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  addVehicleButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addVehicleButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  menuCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  menuArrow: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  logoutButton: {
    margin: 16,
    backgroundColor: COLORS.error,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 32,
  },
});
