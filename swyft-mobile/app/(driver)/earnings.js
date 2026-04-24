import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/auth';
import { driverAPI, ridesAPI } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';

export default function DriverEarningsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState({
    today_earnings: 0,
    total_earnings: 0,
    total_trips: 0,
    week_earnings: 0,
    month_earnings: 0,
    withdrawn: 0,
  });
  const [recentRides, setRecentRides] = useState([]);

  useEffect(() => {
    loadEarningsData();
  }, []);

  const loadEarningsData = async () => {
    try {
      const email = await authService.getUserEmail();
      if (!email) {
        setLoading(false);
        return;
      }

      const response = await driverAPI.getEarnings(email);
      const data = response?.data;
      
      if (data && typeof data === 'object') {
        setEarnings({
          today_earnings: parseFloat(data.today_earnings) || 0,
          total_earnings: parseFloat(data.total_earnings) || 0,
          total_trips: parseInt(data.total_trips) || 0,
          week_earnings: parseFloat(data.week_earnings) || 0,
          month_earnings: parseFloat(data.month_earnings) || 0,
          withdrawn: parseFloat(data.withdrawn) || 0,
        });
      }

      const ridesResponse = await ridesAPI.getRides({ driver_email: email });
      const allRides = ridesResponse.data || [];
      const completed = allRides.filter(r => 
        r.status === 'completed' || r.status === 'confirmed' || r.status === 'active'
      );
      setRecentRides(completed.slice(0, 10));
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentBalance = earnings.total_earnings - earnings.withdrawn;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Earnings Report</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Current Balance</Text>
            <Text style={styles.balanceValue}>₺{currentBalance.toFixed(2)}</Text>
            <Text style={styles.balanceSubtext}>Available for withdrawal</Text>
          </View>

          {}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="today" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.statLabel}>Today</Text>
              <Text style={styles.statValue}>₺{earnings.today_earnings.toFixed(2)}</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="calendar" size={20} color="#FF9500" />
              </View>
              <Text style={styles.statLabel}>This Week</Text>
              <Text style={styles.statValue}>₺{earnings.week_earnings.toFixed(2)}</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.success} />
              </View>
              <Text style={styles.statLabel}>This Month</Text>
              <Text style={styles.statValue}>₺{earnings.month_earnings.toFixed(2)}</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FCE4EC' }]}>
                <Ionicons name="wallet" size={20} color="#E91E63" />
              </View>
              <Text style={styles.statLabel}>Total Earnings</Text>
              <Text style={styles.statValue}>₺{earnings.total_earnings.toFixed(2)}</Text>
            </View>
          </View>

          {}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Trips</Text>
              <Text style={styles.summaryValue}>{earnings.total_trips}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Withdrawn</Text>
              <Text style={styles.summaryValue}>₺{earnings.withdrawn.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Available Balance</Text>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                ₺{currentBalance.toFixed(2)}
              </Text>
            </View>
          </View>

          {}
          <View style={styles.ridesSection}>
            <Text style={styles.sectionTitle}>Recent Completed Rides</Text>
            {recentRides.length > 0 ? (
              <View style={styles.ridesList}>
                {recentRides.map((ride, index) => (
                  <View key={ride.id || index} style={styles.rideItem}>
                    <View style={styles.rideInfo}>
                      <Text style={styles.rideLocation}>
                        {ride.pickup_location ? `${ride.pickup_location.substring(0, 30)}...` : 'N/A'}
                      </Text>
                      <Text style={styles.rideDate}>{formatDate(ride.created_at)}</Text>
                    </View>
                    <Text style={styles.ridePrice}>₺{Number(ride.price || 0).toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyRides}>
                <Text style={styles.emptyText}>No completed rides yet</Text>
              </View>
            )}
          </View>
        </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  balanceCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  balanceSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    width: '47%',
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  ridesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
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
  rideLocation: {
    fontSize: 14,
    color: COLORS.text,
  },
  rideDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  ridePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
  },
  emptyRides: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});