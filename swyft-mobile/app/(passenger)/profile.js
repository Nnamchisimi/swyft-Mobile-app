import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../src/services/auth';
import { ridesAPI } from '../../src/services/api';
import { COLORS } from '../../src/constants/config';

export default function ProfileScreen() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [verificationRide, setVerificationRide] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (userEmail) {
      loadVerificationData();
    }
  }, [userEmail]);

  const loadUserData = async () => {
    const email = await authService.getUserEmail();
    const role = await authService.getUserRole();
    const userData = await authService.getDriverInfo();
    setUserEmail(email || '');
    setUserRole(role || 'passenger');
    setUserName(userData?.name || email?.split('@')[0] || 'User');
  };

  const loadVerificationData = async () => {
    try {
      setVerificationLoading(true);
      const response = await ridesAPI.getRides({ passenger_email: userEmail });
      const rides = response.data || [];
      const active = rides.find(r => ['pending', 'accepted', 'picked_up', 'active', 'arriving', 'arrived_pickup'].includes(r.status));
      setVerificationRide(active || null);
    } catch (error) {
      console.error('Error loading verification data:', error);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleLogout = () => {
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
            }).catch(() => {
              router.replace('/(auth)/signin');
            });
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'accepted':
        return COLORS.primary;
      case 'picked_up':
        return COLORS.success;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Awaiting Courier';
      case 'accepted':
        return 'Courier Assigned';
      case 'picked_up':
        return 'In Transit';
      case 'active':
        return 'Active';
      case 'arriving':
        return 'Arriving';
      case 'arrived_pickup':
        return 'At Pickup';
      default:
        return status;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.brandName}>SWYFTinc</Text>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userEmail}>{userEmail}</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="mail" size={18} color={COLORS.primary} />
              <Text style={styles.infoLabel}>Email</Text>
            </View>
            <Text style={styles.infoValue}>{userEmail}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="person" size={18} color={COLORS.primary} />
              <Text style={styles.infoLabel}>Role</Text>
            </View>
            <View style={[styles.roleBadge, userRole === 'passenger' && styles.roleActive]}>
              <Text style={[styles.roleText, userRole === 'passenger' && styles.roleTextActive]}>
                {userRole}
              </Text>
            </View>
          </View>
        </View>

        {verificationLoading ? (
          <View style={styles.verificationCard}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.verificationLoadingText}>Loading verification info...</Text>
          </View>
        ) : verificationRide && verificationRide.delivery_id ? (
          <View style={styles.verificationCard}>
            <View style={styles.verificationHeader}>
              <View style={styles.verificationIconContainer}>
                <Ionicons name="cube" size={22} color={COLORS.white} />
              </View>
              <View style={styles.verificationHeaderText}>
                <Text style={styles.verificationTitle}>Package Verification</Text>
                <Text style={styles.verificationSubtitle}>Active delivery tracking</Text>
              </View>
            </View>

            <View style={styles.verificationContent}>
              <View style={styles.verificationRow}>
                <View style={styles.verificationLabelContainer}>
                  <Ionicons name="barcode" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.verificationLabel}>Delivery ID</Text>
                </View>
                <Text style={styles.verificationValue}>{verificationRide.delivery_id}</Text>
              </View>

              <View style={styles.verificationDivider} />

              <View style={styles.verificationRow}>
                <View style={styles.verificationLabelContainer}>
                  <Ionicons name="time" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.verificationLabel}>Status</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(verificationRide.status) + '20' }]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(verificationRide.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(verificationRide.status) }]}>
                    {getStatusLabel(verificationRide.status)}
                  </Text>
                </View>
              </View>

              {verificationRide.pickup_location && (
                <>
                  <View style={styles.verificationDivider} />
                  <View style={styles.verificationRow}>
                    <View style={styles.verificationLabelContainer}>
                      <Ionicons name="location" size={16} color={COLORS.textSecondary} />
                      <Text style={styles.verificationLabel}>Pickup</Text>
                    </View>
                    <Text style={styles.verificationValueText} numberOfLines={2}>
                      {verificationRide.pickup_location}
                    </Text>
                  </View>
                </>
              )}

              {verificationRide.dropoff_location && (
                <>
                  <View style={styles.verificationDivider} />
                  <View style={styles.verificationRow}>
                    <View style={styles.verificationLabelContainer}>
                      <Ionicons name="flag" size={16} color={COLORS.textSecondary} />
                      <Text style={styles.verificationLabel}>Dropoff</Text>
                    </View>
                    <Text style={styles.verificationValueText} numberOfLines={2}>
                      {verificationRide.dropoff_location}
                    </Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.verificationNote}>
              <Ionicons name="information-circle" size={18} color={COLORS.primary} />
              <Text style={styles.verificationNoteText}>
                The 6-digit OTP was sent to {verificationRide.receiver_email || userEmail}. Share it with your driver when they arrive to confirm delivery.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.verificationCard}>
            <View style={styles.verificationHeader}>
              <View style={styles.verificationIconContainerEmpty}>
                <Ionicons name="cube-outline" size={22} color={COLORS.textSecondary} />
              </View>
              <View style={styles.verificationHeaderText}>
                <Text style={styles.verificationTitle}>Package Verification</Text>
                <Text style={styles.verificationSubtitle}>No active delivery</Text>
              </View>
            </View>
            <Text style={styles.verificationEmptyText}>You don't have any active delivery to verify.</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(passenger)/history')}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="time" size={24} color={COLORS.white} />
              </View>
              <Text style={styles.actionTitle}>History</Text>
              <Text style={styles.actionSubtitle}>View past deliveries</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(passenger)/book-ride')}
            >
              <View style={[styles.actionIconContainer, styles.actionIconSecondary]}>
                <Ionicons name="car" size={24} color={COLORS.white} />
              </View>
              <Text style={styles.actionTitle}>Book</Text>
              <Text style={styles.actionSubtitle}>New delivery</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color={COLORS.white} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(passenger)/home')}>
            <Ionicons name="home" size={24} color={COLORS.gray} />
            <Text style={styles.navText}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(passenger)/book-ride')}>
            <Ionicons name="car" size={24} color={COLORS.gray} />
            <Text style={styles.navText}>Book</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(passenger)/history')}>
            <Ionicons name="list" size={24} color={COLORS.gray} />
            <Text style={styles.navText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(passenger)/profile')}>
            <Ionicons name="person" size={24} color={COLORS.primary} />
            <Text style={[styles.navText, styles.navTextActive]}>Profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
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
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  backButtonText: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
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
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: COLORS.white,
    marginBottom: 12,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '700',
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  roleTextActive: {
    color: COLORS.white,
  },
  verificationCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    backgroundColor: COLORS.primary,
  },
  verificationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationIconContainerEmpty: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationHeaderText: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 2,
  },
  verificationSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  verificationContent: {
    padding: 18,
  },
  verificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  verificationLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verificationLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  verificationValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  verificationValueText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },
  verificationDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  verificationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 18,
    marginBottom: 18,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  verificationNoteText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    fontWeight: '500',
  },
  verificationLoadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 10,
    textAlign: 'center',
  },
  verificationEmptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
    paddingHorizontal: 18,
    paddingBottom: 18,
    lineHeight: 20,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  actionIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionIconSecondary: {
    backgroundColor: COLORS.success,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: COLORS.error,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 8,
    elevation: 2,
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  logoutButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
    marginTop: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 24,
  },
  navText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  navTextActive: {
    color: COLORS.primary,
  },
});
