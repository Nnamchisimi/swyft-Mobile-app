import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { driverAPI } from '../../src/services/api';
import { authService } from '../../src/services/auth';
import { COLORS } from '../../src/constants/config';
import DriverBottomTabBar from './components/BottomTabBar';

const STATUS_COLORS = {
  PENDING: '#FF9500',
  PROCESSING: '#007AFF',
  PAID: '#34C759',
  REJECTED: '#FF3B30',
};

const STATUS_BG = {
  PENDING: '#FFF3E0',
  PROCESSING: '#E3F2FD',
  PAID: '#E8F5E9',
  REJECTED: '#FFEBEE',
};

export default function WithdrawalHistoryScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const userEmail = await authService.getUserEmail();
      setEmail(userEmail || '');
      if (!userEmail) return;

      const response = await driverAPI.getWithdrawals(userEmail);
      setWithdrawals(response || []);
    } catch (error) {
      console.error('Error loading withdrawal history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Withdrawal History</Text>
        <View style={{ width: 80 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {withdrawals.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No withdrawals yet</Text>
              <Text style={styles.emptySubtitle}>Your payout requests will appear here.</Text>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => router.push('/(driver)/withdraw')}
              >
                <Text style={styles.ctaButtonText}>Request a Withdrawal</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.list}>
              {withdrawals.map(item => (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.amount}>₺{Number(item.amount).toFixed(2)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[item.status] || '#F2F2F7' }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || COLORS.textSecondary }]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.row}>
                      <Text style={styles.label}>Bank</Text>
                      <Text style={styles.value}>{item.bank_name || '-'}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>IBAN</Text>
                      <Text style={styles.value}>{item.iban || '-'}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Account Holder</Text>
                      <Text style={styles.value}>{item.account_holder_name || '-'}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.label}>Requested</Text>
                      <Text style={styles.value}>{formatDate(item.created_at)}</Text>
                    </View>
                    {item.processed_at && (
                      <View style={styles.row}>
                        <Text style={styles.label}>Processed</Text>
                        <Text style={styles.value}>{formatDate(item.processed_at)}</Text>
                      </View>
                    )}
                    {item.admin_notes ? (
                      <View style={styles.row}>
                        <Text style={styles.label}>Notes</Text>
                        <Text style={styles.value}>{item.admin_notes}</Text>
                      </View>
                    ) : null}
                    {item.transfer_reference ? (
                      <View style={styles.row}>
                        <Text style={styles.label}>Reference</Text>
                        <Text style={styles.value}>{item.transfer_reference}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backText: {
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
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  ctaButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ctaButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  cardBody: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
});
