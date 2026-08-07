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
  StatusBar,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../../src/services/auth';
import { driverAPI, ridesAPI } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';
import DriverBottomTabBar from './components/BottomTabBar';

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
  const [ridesExpanded, setRidesExpanded] = useState(false);
  const [recentWithdrawals, setRecentWithdrawals] = useState([]);
  const [withdrawalModalVisible, setWithdrawalModalVisible] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalBankName, setWithdrawalBankName] = useState('');
  const [withdrawalIban, setWithdrawalIban] = useState('');
  const [withdrawalAccountHolder, setWithdrawalAccountHolder] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

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
        setRecentWithdrawals(data.recent_withdrawals || []);
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

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawalAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (amount > currentBalance) {
      Alert.alert('Error', 'Amount exceeds available balance');
      return;
    }
    if (!withdrawalBankName.trim() || !withdrawalIban.trim() || !withdrawalAccountHolder.trim()) {
      Alert.alert('Error', 'Please fill in all bank details');
      return;
    }

    setWithdrawing(true);
    try {
      const email = await authService.getUserEmail();
      await driverAPI.requestWithdrawal({
        email,
        amount,
        bank_name: withdrawalBankName.trim(),
        iban: withdrawalIban.trim(),
        account_holder_name: withdrawalAccountHolder.trim(),
      });
      Alert.alert('Success', 'Withdrawal request submitted successfully');
      setWithdrawalModalVisible(false);
      setWithdrawalAmount('');
      setWithdrawalBankName('');
      setWithdrawalIban('');
      setWithdrawalAccountHolder('');
      await loadEarningsData();
    } catch (error) {
      const message = error?.response?.data?.error || error.message || 'Failed to request withdrawal';
      Alert.alert('Error', message);
    } finally {
      setWithdrawing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const displayedRides = ridesExpanded ? recentRides : recentRides.slice(0, 8);
  const hasMoreRides = recentRides.length > 8;

  const activities = [
    ...recentRides.map((ride) => ({
      id: `ride-${ride.id}`,
      type: 'ride',
      title: ride.pickup_location ? `Delivery: ${ride.pickup_location.substring(0, 28)}${ride.pickup_location.length > 28 ? '...' : ''}` : 'Delivery',
      subtitle: ride.dropoff_location ? `To: ${ride.dropoff_location.substring(0, 30)}${ride.dropoff_location.length > 30 ? '...' : ''}` : '',
      amount: Number(ride.price || 0),
      date: ride.created_at,
      status: ride.status,
      icon: 'cube',
      color: COLORS.success,
    })),
    ...recentWithdrawals.map((w) => ({
      id: `withdrawal-${w.id}`,
      type: 'withdrawal',
      title: `Withdrawal ${w.status}`,
      subtitle: w.bank_name || 'Bank transfer',
      amount: -Number(w.amount),
      date: w.created_at,
      status: w.status,
      icon: 'cash-outline',
      color: w.status === 'PAID' ? COLORS.success : w.status === 'REJECTED' ? COLORS.error : '#FF9800',
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Earnings</Text>
        <View style={{ width: 50 }} />
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
            {currentBalance > 0 && (
              <TouchableOpacity style={styles.withdrawButton} onPress={() => setWithdrawalModalVisible(true)}>
                <Ionicons name="cash-outline" size={18} color={COLORS.white} />
                <Text style={styles.withdrawButtonText}>Request Withdrawal</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.activitySection}>
            <Text style={styles.sectionTitle}>Activity</Text>
            {activities.length > 0 ? (
              <View style={styles.activitiesList}>
                {activities.slice(0, ridesExpanded ? 20 : 8).map((item) => (
                  <View key={item.id} style={styles.activityItem}>
                    <View style={[styles.activityIcon, { backgroundColor: item.color + '18' }]}>
                      <Ionicons name={item.icon} size={18} color={item.color} />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitle}>{item.title}</Text>
                      {item.subtitle ? <Text style={styles.activitySubtitle}>{item.subtitle}</Text> : null}
                      <Text style={styles.activityDate}>{formatDateTime(item.date)}</Text>
                    </View>
                    <Text style={[styles.activityAmount, { color: item.amount >= 0 ? COLORS.success : COLORS.error }]}>
                      {item.amount >= 0 ? '+' : ''}{item.amount < 0 ? '-' : ''}₺{Math.abs(item.amount).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyActivities}>
                <Text style={styles.emptyText}>No activity yet</Text>
              </View>
            )}
            {hasMoreRides && (
              <TouchableOpacity style={styles.toggleButton} onPress={() => setRidesExpanded(!ridesExpanded)}>
                <Text style={styles.toggleText}>
                  {ridesExpanded ? 'Show Less' : `Show All (${recentRides.length + recentWithdrawals.length})`}
                </Text>
                <Ionicons name={ridesExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      <DriverBottomTabBar />

      <Modal visible={withdrawalModalVisible} transparent animationType="slide" onRequestClose={() => { Keyboard.dismiss(); setWithdrawalModalVisible(false); }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
              <TouchableWithoutFeedback>
                <View style={styles.modalCard}>
                  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
                    <Text style={styles.modalTitle}>Request Withdrawal</Text>
                    <Text style={styles.modalHint}>Available: ₺{currentBalance.toFixed(2)}</Text>

                    <Text style={styles.fieldLabel}>AMOUNT (₺)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textSecondary}
                      value={withdrawalAmount}
                      onChangeText={setWithdrawalAmount}
                      keyboardType="decimal-pad"
                    />

                    <Text style={styles.fieldLabel}>BANK NAME</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Garanti, İş Bankası"
                      placeholderTextColor={COLORS.textSecondary}
                      value={withdrawalBankName}
                      onChangeText={setWithdrawalBankName}
                    />

                    <Text style={styles.fieldLabel}>IBAN</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="TR00 0000 0000 0000 0000 0000 00"
                      placeholderTextColor={COLORS.textSecondary}
                      value={withdrawalIban}
                      onChangeText={setWithdrawalIban}
                      autoCapitalize="characters"
                    />

                    <Text style={styles.fieldLabel}>ACCOUNT HOLDER NAME</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Full name on account"
                      placeholderTextColor={COLORS.textSecondary}
                      value={withdrawalAccountHolder}
                      onChangeText={setWithdrawalAccountHolder}
                    />

                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.modalCancel} onPress={() => { Keyboard.dismiss(); setWithdrawalModalVisible(false); }}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.modalConfirm} onPress={handleWithdraw} disabled={withdrawing}>
                        {withdrawing ? (
                          <ActivityIndicator size="small" color={COLORS.white} />
                        ) : (
                          <Text style={styles.modalConfirmText}>Submit Request</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  activitySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  activitiesList: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  activitySubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  activityDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyActivities: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  toggleText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  withdrawButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  modalConfirmText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});