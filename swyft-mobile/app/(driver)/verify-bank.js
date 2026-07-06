import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';
import { authService } from '../../src/services/auth';
import { driverAPI } from '../../src/services/api';

export default function DriverBankScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    account_holder_name: '',
    routing_number: '',
    iban: '',
    swift_code: '',
  });

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async () => {
    if (!formData.bank_name || !formData.account_number || !formData.account_holder_name) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const email = await authService.getUserEmail();
      const response = await driverAPI.submitBankAccount(email, formData);
      
      router.push('/(driver)/verify-summary');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to submit bank account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bank Account Verification</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepIndicator}>
          <View style={styles.stepCompleted} />
          <View style={styles.stepLine} />
          <View style={styles.stepCompleted} />
          <View style={styles.stepLine} />
          <View style={styles.stepCompleted} />
          <View style={styles.stepLine} />
          <View style={styles.stepActive} />
        </View>
        
        <View style={styles.stepLabels}>
          <Text style={styles.stepLabel}>ID</Text>
          <Text style={styles.stepLabel}>Selfie</Text>
          <Text style={styles.stepLabel}>Phone</Text>
          <Text style={styles.stepLabel}>Bank</Text>
          <Text style={styles.stepLabel}>Review</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Bank Account Details</Text>
          <Text style={styles.subtitle}>Enter your bank account information for payouts</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Bank Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.bank_name}
              onChangeText={(v) => handleInputChange('bank_name', v)}
              placeholder="e.g., Bank of America"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Account Holder Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.account_holder_name}
              onChangeText={(v) => handleInputChange('account_holder_name', v)}
              placeholder="Name as it appears on bank account"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Account Number *</Text>
            <TextInput
              style={styles.input}
              value={formData.account_number}
              onChangeText={(v) => handleInputChange('account_number', v)}
              placeholder="Account number"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Routing Number (optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.routing_number}
              onChangeText={(v) => handleInputChange('routing_number', v)}
              placeholder="ABA routing number"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>IBAN (optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.iban}
              onChangeText={(v) => handleInputChange('iban', v)}
              placeholder="International Bank Account Number"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>SWIFT/BIC Code (optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.swift_code}
              onChangeText={(v) => handleInputChange('swift_code', v)}
              placeholder="Bank's SWIFT/BIC code"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Your bank details are encrypted and stored securely. 
              They are used only for processing your ride earnings.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.buttonText}>Save Bank Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.push('/(driver)/verify-summary')}
        >
          <Text style={styles.skipText}>Skip for now (can add later)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginLeft: 12 },
  content: { flex: 1, padding: 16 },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  stepCompleted: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.success },
  stepActive: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  step: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.border },
  stepLine: { width: 30, height: 2, backgroundColor: COLORS.border },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, paddingHorizontal: 8 },
  stepLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  section: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: { fontSize: 12, color: COLORS.textSecondary, marginLeft: 8, flex: 1, lineHeight: 16 },
  footer: { padding: 16, backgroundColor: COLORS.background },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  skipButton: {
    alignItems: 'center',
    marginTop: 8,
  },
  skipText: { color: COLORS.textSecondary, fontSize: 14 },
});