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

export default function DriverPhoneScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleSave = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      const email = await authService.getUserEmail();
      // Save the phone number to the database. No SMS code is sent;
      // the admin reviews and approves manually from the database.
      await driverAPI.requestPhoneVerification(email, { phone_number: phoneNumber });
      router.push('/(driver)/verify-bank');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save phone number');
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
        <Text style={styles.headerTitle}>Phone Verification</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepIndicator}>
          <View style={styles.stepCompleted} />
          <View style={styles.stepLine} />
          <View style={styles.stepCompleted} />
          <View style={styles.stepLine} />
          <View style={styles.stepCompleted} />
          <View style={styles.stepLine} />
          <View style={styles.step} />
          <View style={styles.stepLine} />
          <View style={styles.step} />
        </View>

        <View style={styles.stepLabels}>
          <Text style={styles.stepLabel}>ID</Text>
          <Text style={styles.stepLabel}>Selfie</Text>
          <Text style={styles.stepLabel}>Phone</Text>
          <Text style={styles.stepLabel}>Bank</Text>
          <Text style={styles.stepLabel}>Review</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Phone Number</Text>
          <Text style={styles.subtitle}>Add your phone number for account verification and payouts</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="phone-pad"
            />
            <Text style={styles.hint}>Your number is saved securely and reviewed manually by our team.</Text>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Your phone number is kept secure and is used only for account verification
              and important notifications.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.buttonText}>Save Phone Number</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.push('/(driver)/verify-bank')}
        >
          <Text style={styles.skipText}>Skip for now</Text>
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
  codeInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    backgroundColor: COLORS.surface,
  },
  codeInputField: { fontSize: 18, fontWeight: '600', letterSpacing: 4, textAlign: 'center', color: COLORS.text },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: { fontSize: 12, color: COLORS.textSecondary, marginLeft: 8, flex: 1 },
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
  resendButton: {
    alignItems: 'center',
    marginBottom: 12,
  },
  resendText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  skipButton: {
    alignItems: 'center',
    marginTop: 8,
  },
  skipText: { color: COLORS.textSecondary, fontSize: 14 },
});
