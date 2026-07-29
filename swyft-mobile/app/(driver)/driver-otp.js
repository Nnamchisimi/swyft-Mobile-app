import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ridesAPI } from '../../src/services/api';
import { authService } from '../../src/services/auth';
import { COLORS } from '../../src/constants/config';

export default function DriverOtpScreen() {
  const router = useRouter();
  const { rideId } = useLocalSearchParams();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rideId) {
      router.back();
    }
  }, [rideId]);

  const handleVerify = async () => {
    Keyboard.dismiss();

    if (!otp || otp.length !== 6) {
      Alert.alert('Required', 'Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await ridesAPI.verifyOtp(rideId, otp);
      if (response.data?.message) {
        Alert.alert('Verified', 'Delivery completed. Payment has been released.', [
          { text: 'OK', onPress: () => router.replace('/(driver)/dashboard') },
        ]);
      } else {
        Alert.alert('Error', response.data?.error || 'Failed to verify OTP');
      }
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Failed to verify OTP';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Delivery</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.otpHint}>
          <Text style={styles.otpHintText}>Ask the receiver for the 6-digit code or check the receiver’s email/SMS.</Text>
        </View>

        <View style={styles.otpInputContainer}>
          <View style={styles.inputRow}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <View key={index} style={styles.box}>
                <Text style={styles.boxText}>{otp[index] || ''}</Text>
              </View>
            ))}
          </View>

          <TextInput
            style={styles.hiddenInput}
            value={otp}
            onChangeText={setOtp}
            maxLength={6}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoFocus
            selectTextOnFocus
          />
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, (loading || otp.length !== 6) && styles.verifyButtonDisabled]}
          onPress={handleVerify}
          disabled={loading || otp.length !== 6}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.verifyButtonText}>Verify</Text>
          )}
        </TouchableOpacity>
      </View>
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
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  otpHint: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  otpHintText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  otpInputContainer: {
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  box: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  verifyButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
