import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { paymentAPI } from '../../src/services/api';
import { authService } from '../../src/services/auth';
import { COLORS } from '../../src/constants/config';
import { setPaymentInProgress } from '../../src/book-ride/hooks';

WebBrowser.mayCompleteAuthSession();

export default function PaymentWebViewScreen() {
  const router = useRouter();
  const { rideId, amount } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [paymentId, setPaymentId] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [checking, setChecking] = useState(false);
  const [browserVisible, setBrowserVisible] = useState(true);

  useEffect(() => {
    initializePayment();
    return () => setPaymentInProgress(false);
  }, []);

  useEffect(() => {
    if (!paymentId || !browserVisible) return;

    const interval = setInterval(async () => {
      try {
        const response = await paymentAPI.getPaymentStatus(paymentId);
        if (response.data && ['succeeded', 'failed', 'captured'].includes(response.data.status)) {
          clearInterval(interval);
          setBrowserVisible(false);
          handlePaymentResult(response.data.status);
        }
      } catch (error) {
        console.error('Payment status check error:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [paymentId, browserVisible]);

  const initializePayment = async () => {
    try {
      const email = await authService.getUserEmail();
      const response = await paymentAPI.createPayment({
        ride_id: rideId,
        passenger_email: email,
        amount: amount,
        currency: 'TRY',
      });

      if (response.data) {
        setPaymentId(response.data.paymentId);
        if (response.data.paymentPageUrl) {
          setPaymentUrl(response.data.paymentPageUrl);
          openBrowser(response.data.paymentPageUrl);
        } else if (response.data.threeDSHtmlContent) {
          setPaymentUrl('html');
        }
      }
    } catch (error) {
      console.error('Payment init error:', error);
      Alert.alert('Error', 'Failed to initialize payment. Please try again.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const openBrowser = async (url) => {
    try {
      const result = await WebBrowser.openBrowserAsync(url, {
        showTitle: false,
        enableBarCollapsing: true,
      });
      setBrowserVisible(false);
      checkPaymentStatus();
    } catch (error) {
      console.error('Browser error:', error);
      setBrowserVisible(false);
      checkPaymentStatus();
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentId) return;
    setChecking(true);
    try {
      const response = await paymentAPI.getPaymentStatus(paymentId);
      if (response.data) {
        handlePaymentResult(response.data.status);
      }
    } catch (error) {
      console.error('Status check error:', error);
      Alert.alert('Error', 'Could not verify payment status.');
      router.back();
    } finally {
      setChecking(false);
    }
  };

  const handlePaymentResult = (status) => {
    setPaymentInProgress(false);
    if (status === 'succeeded' || status === 'captured' || status === 'success') {
      Alert.alert('Payment Successful', 'Your payment has been processed.', [
        {
          text: 'OK',
          onPress: () => router.replace({
            pathname: '/(passenger)/track-ride',
            params: { rideId },
          }),
        },
      ]);
    } else {
      Alert.alert('Payment Failed', 'Your payment could not be processed. Please try again.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Initializing secure payment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>
          {browserVisible ? 'Opening secure payment page...' : 'Verifying payment...'}
        </Text>
        {checking && <Text style={styles.subText}>Please wait while we confirm your payment</Text>}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  subText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
