import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { driverAPI } from '../../src/services/api';
import { authService } from '../../src/services/auth';
import { COLORS } from '../../src/constants/config';
import DriverBottomTabBar from './components/BottomTabBar';

export default function WithdrawScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [wallet, setWallet] = useState({ available_balance: 0, total_withdrawn: 0, pending_balance: 0 });

  const [form, setForm] = useState({
    amount: '',
    bank_name: '',
    iban: '',
    account_holder_name: '',
  });

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const userEmail = await authService.getUserEmail();
      setEmail(userEmail || '');
      if (!userEmail) return;

      const response = await driverAPI.getWallet(userEmail);
      setWallet({
        available_balance: parseFloat(response.available_balance) || 0,
        total_withdrawn: parseFloat(response.total_withdrawn) || 0,
        pending_balance: parseFloat(response.pending_balance) || 0,
      });
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(form.amount);

    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (amount > wallet.available_balance) {
      Alert.alert('Insufficient Balance', 'You do not have enough available balance');
      return;
    }

    if (!form.bank_name.trim() || !form.iban.trim() || !form.account_holder_name.trim()) {
      Alert.alert('Missing Info', 'Please fill in all banking details');
      return;
    }

    setSubmitting(true);
    try {
      const response = await driverAPI.requestWithdrawal({
        email,
        amount,
        bank_name: form.bank_name.trim(),
        iban: form.iban.trim(),
        account_holder_name: form.account_holder_name.trim(),
      });

      Alert.alert('Withdrawal Requested', 'Your withdrawal request has been submitted', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      const message = error?.response?.data?.error || 'Failed to request withdrawal';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
        <DriverBottomTabBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Withdraw Funds</Text>
            <View style={{ width: 50 }} />
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceValue}>₺{wallet.available_balance.toFixed(2)}</Text>
            <View style={styles.balanceRow}>
              <View style={styles.balancePill}>
                <Text style={styles.balancePillText}>Pending ₺{wallet.pending_balance.toFixed(2)}</Text>
              </View>
              <View style={styles.balancePillSecondary}>
                <Text style={styles.balancePillSecondaryText}>Withdrawn ₺{wallet.total_withdrawn.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Withdrawal Details</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Amount (₺)</Text>
              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={value => updateField('amount', value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Bank Name</Text>
              <TextInput
                style={styles.input}
                value={form.bank_name}
                onChangeText={value => updateField('bank_name', value)}
                placeholder="e.g. Kuveyt Turk"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>IBAN</Text>
              <TextInput
                style={styles.input}
                value={form.iban}
                onChangeText={value => updateField('iban', value.toUpperCase())}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Account Holder Name</Text>
              <TextInput
                style={styles.input}
                value={form.account_holder_name}
                onChangeText={value => updateField('account_holder_name', value.toUpperCase())}
                placeholder="NAME ON ACCOUNT"
                autoCapitalize="characters"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleWithdraw}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitButtonText}>Request Withdrawal</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/(driver)/withdrawal-history')}
          >
            <Text style={styles.historyButtonText}>View Withdrawal History</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <DriverBottomTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  balanceCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  balancePill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  balancePillText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  balancePillSecondary: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  balancePillSecondaryText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  submitButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  historyButton: {
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
