import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { STORAGE_KEYS, COLORS } from '../../src/constants/config';

export default function VerifyLinkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, email } = params;

  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    handleVerify();
  }, []);

  const handleVerify = async () => {
    if (!token || !email) {
      setStatus('error');
      setError('Invalid verification link - missing token or email');
      return;
    }

    try {
      const decoded = jwtDecode(token);

      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        setStatus('error');
        setError('Verification link has expired. Please request a new one.');
        return;
      }

      await AsyncStorage.multiSet([
        [STORAGE_KEYS.AUTH_TOKEN, token],
        [STORAGE_KEYS.USER_EMAIL, email],
        [STORAGE_KEYS.USER_ROLE, (decoded.role || 'passenger').toLowerCase()],
        [STORAGE_KEYS.DRIVER_INFO, JSON.stringify({
          email: email,
          name: `${decoded.first_name || ''} ${decoded.last_name || ''}`.trim(),
        })],
      ]);

      setStatus('success');

      const role = (decoded.role || 'passenger').toLowerCase();
      setTimeout(() => {
        if (role === 'admin') {
          router.replace('/(admin)/review');
        } else if (role === 'driver') {
          router.replace('/(driver)/dashboard');
        } else {
          router.replace('/(passenger)/home');
        }
      }, 1500);
    } catch (err) {
      setStatus('error');
      setError('Verification failed. Please try again.');
    }
  };

  const handleGoToLogin = () => {
    router.replace('/(auth)/signin');
  };

  return (
    <View style={styles.container}>
      {status === 'verifying' && (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.statusText}>Verifying your account...</Text>
        </View>
      )}

      {status === 'success' && (
        <View style={styles.centerContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
          </View>
          <Text style={styles.successTitle}>Email Verified!</Text>
          <Text style={styles.successText}>
            Your account has been verified successfully. Redirecting...
          </Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centerContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="close-circle" size={64} color={COLORS.error} />
          </View>
          <Text style={styles.errorTitle}>Verification Failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={handleGoToLogin}>
            <Text style={styles.buttonText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centerContent: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.success,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
