import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { authService } from '../../src/services/auth';
import { driverAPI, ridesAPI } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';
import { uploadDriverImage } from '../../src/services/supabaseStorage';
import DriverBottomTabBar from './components/BottomTabBar';

export default function DriverProfileScreen() {
  const router = useRouter();
  const [driverInfo, setDriverInfo] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');
  const [earnings, setEarnings] = useState({
    today_earnings: 0,
    total_earnings: 0,
    total_trips: 0,
    recent_rides: [],
  });
  const [loading, setLoading] = useState(true);
  const [completedRides, setCompletedRides] = useState([]);
  const [uploading, setUploading] = useState(false);

  const pickAndUploadProfilePicture = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Error', 'Could not read selected image.');
      return;
    }

    setUploading(true);
    try {
      const path = `profile-pictures/${userEmail || 'driver'}-${Date.now()}.jpg`;
      const url = await uploadDriverImage(asset.base64, path);
      await driverAPI.updateProfilePicture(userEmail, { profile_picture: url });
      setDriverInfo(prev => ({ ...prev, profilePicture: url }));
      await authService.saveProfilePicture(url);
    } catch (error) {
      console.error('Profile picture upload error:', error);
      Alert.alert('Upload failed', 'Could not update profile picture. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    loadDriverData();
  }, []);

  const loadDriverData = async () => {
    try {
      const email = await authService.getUserEmail();
      setUserEmail(email || '');
      const role = await authService.getUserRole();
      setUserRole(role || '');

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
              profilePicture: driver.profile_picture,
              // Vehicle info from cars table
              vehicleMake: driver.make,
              vehicleModel: driver.model,
              vehicleYear: driver.year,
              vehicleColor: driver.color,
              vehiclePlate: driver.plate_number,
              vehicleImage: driver.vehicle?.image_url || driver.image_url,
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
              today_earnings: parseFloat(data.today_earnings) || 0,
              total_earnings: parseFloat(data.total_earnings) || 0,
              total_trips: parseInt(data.total_trips) || 0,
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
    router.push('/(driver)/earnings');
  };

  const handleWithdraw = () => {
    router.push('/(driver)/withdraw');
  };

  const handleWithdrawalHistory = () => {
    router.push('/(driver)/withdrawal-history');
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
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
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
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.brandName}>SWYFTinc</Text>
          <Text style={styles.headerTitle}>Account</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={pickAndUploadProfilePicture} disabled={uploading}>
            <View style={styles.avatarContainer}>
              {driverInfo?.profilePicture ? (
                <Image source={{ uri: driverInfo.profilePicture }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(driverInfo?.firstName || 'D').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.onlineBadge}>
                <Text style={styles.onlineBadgeText}>✓</Text>
              </View>
              <View style={styles.editIconContainer}>
                <Ionicons name="camera" size={14} color={COLORS.white} />
              </View>
            </View>
          </TouchableOpacity>
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Deliveries</Text>
            {completedRides.length > 3 && (
              <TouchableOpacity onPress={() => router.push('/(driver)/history')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>
          {completedRides.length > 0 ? (
            <View style={styles.ridesList}>
              {completedRides.slice(0, 3).map((ride, index) => (
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
            {driverInfo?.vehicleImage && (
              <Image source={{ uri: driverInfo.vehicleImage }} style={styles.vehicleImage} />
            )}
            <View style={styles.vehicleHeader}>
              <View style={styles.vehicleIconContainer}>
                <Ionicons name="car" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.vehicleTitleContainer}>
                <Text style={styles.vehicleTitle}>
                  {driverInfo?.vehicleMake && driverInfo?.vehicleModel ? (
                    <>{driverInfo.vehicleMake} {driverInfo.vehicleModel}</>
                  ) : (
                    'Not specified'
                  )}
                </Text>
                <Text style={styles.vehicleSubtitle}>
                  {driverInfo?.vehicleYear || ''} {driverInfo?.vehicleColor ? `• ${driverInfo.vehicleColor}` : ''}
                </Text>
              </View>
              {driverInfo?.vehiclePlate && (
                <View style={styles.plateBadge}>
                  <Text style={styles.plateText}>{driverInfo.vehiclePlate}</Text>
                </View>
              )}
            </View>
            <View style={styles.vehicleDivider} />
            <View style={styles.vehicleDetailsGrid}>
              <View style={styles.vehicleDetailItem}>
                <Ionicons name="car-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.vehicleDetailLabel}>Make</Text>
                <Text style={styles.vehicleDetailValue}>{driverInfo?.vehicleMake || 'N/A'}</Text>
              </View>
              <View style={styles.vehicleDetailItem}>
                <Ionicons name="settings-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.vehicleDetailLabel}>Model</Text>
                <Text style={styles.vehicleDetailValue}>{driverInfo?.vehicleModel || 'N/A'}</Text>
              </View>
              <View style={styles.vehicleDetailItem}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.vehicleDetailLabel}>Year</Text>
                <Text style={styles.vehicleDetailValue}>{driverInfo?.vehicleYear || 'N/A'}</Text>
              </View>
              <View style={styles.vehicleDetailItem}>
                <Ionicons name="color-palette-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.vehicleDetailLabel}>Color</Text>
                <Text style={styles.vehicleDetailValue}>{driverInfo?.vehicleColor || 'N/A'}</Text>
              </View>
            </View>
            {driverInfo?.vehiclePlate && (
              <View style={styles.plateContainer}>
                <Text style={styles.plateLabel}>License Plate</Text>
                <Text style={styles.plateValue}>{driverInfo.vehiclePlate}</Text>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wallet</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={handleWithdraw}>
              <Ionicons name="wallet" size={24} color={COLORS.primary} />
              <Text style={styles.menuText}>Withdraw Funds</Text>
              <Text style={styles.menuArrow}>{'>'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleWithdrawalHistory}>
              <Ionicons name="time" size={24} color={COLORS.primary} />
              <Text style={styles.menuText}>Withdrawal History</Text>
              <Text style={styles.menuArrow}>{'>'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEarningsReport}>
              <Ionicons name="stats-chart" size={24} color={COLORS.primary} />
              <Text style={styles.menuText}>Earnings Report</Text>
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

        {userRole === 'admin' && (
          <TouchableOpacity
            style={styles.moderatorButton}
            onPress={() => router.push('/(admin)/review')}
          >
            <Ionicons name="shield-checkmark" size={20} color={COLORS.white} />
            <Text style={styles.moderatorButtonText}>Moderator Review</Text>
          </TouchableOpacity>
        )}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color={COLORS.white} />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Swyft Driver v1.0.0</Text>
        </ScrollView>

        <DriverBottomTabBar />
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
 brandName:{
    fontSize:12,
    fontWeight:"900",
    letterSpacing:3,
    color:COLORS.primary,
},
  headerTitle:{
    fontSize:24,
    fontWeight:"800",
    color:"#111827",
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
  editIconContainer: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
  sectionTitle:{
    fontSize:22,
    fontWeight:"800",
    color:"#111827",
},
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
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
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vehicleImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight || '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleTitleContainer: {
    flex: 1,
  },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  vehicleSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  plateBadge:{
    backgroundColor:"#EEF4FF",

    borderRadius:18,

    paddingHorizontal:14,

    paddingVertical:8,

    borderWidth:0,
},
  plateText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  vehicleDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 16,
  },
  vehicleDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
 vehicleDetailItem:{
    flex:1,
    minWidth:"46%",
    backgroundColor:"#F9FAFB",
    borderRadius:18,
    paddingVertical:18,
    alignItems:"center",
},
  vehicleDetailLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    fontWeight: '600',
  },
  vehicleDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  plateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  plateLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  plateValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.5,
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
  menuCard:{
    backgroundColor:"#FFF",

    borderRadius:24,

    overflow:"hidden",

    elevation:5,
},
  menuItem:{
    flexDirection:"row",

    alignItems:"center",

    paddingVertical:20,

    paddingHorizontal:20,

    borderBottomWidth:1,

    borderBottomColor:"#F3F4F6",
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
  moderatorButton: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moderatorButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
logoutButton:{
    marginHorizontal:18,

    marginVertical:24,

    height:58,

    borderRadius:20,

    backgroundColor:"#DC2626",

    justifyContent:"center",

    alignItems:"center",

    elevation:5,
},
  logoutButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  moderatorButton:{
    marginHorizontal:18,

    height:58,

    borderRadius:20,

    backgroundColor:COLORS.primary,

    elevation:5,
},
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 32,
  },
});
