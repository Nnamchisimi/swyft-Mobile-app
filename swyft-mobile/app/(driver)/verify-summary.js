import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';
import { authService } from '../../src/services/auth';
import { driverAPI } from '../../src/services/api';

export default function DriverVerifySummaryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const verifications = verificationStatus?.verifications || {};

  const getState = (key) => {
    const v = verifications[key];
    if (!v) return 'not_submitted';
    if (key === 'phone') {
      if (v.is_verified) return 'verified';
      if (v.status && v.status !== 'not_submitted') return 'submitted';
      return 'not_submitted';
    }
    const s = v.status;
    if (s === 'verified') return 'verified';
    if (s === 'rejected') return 'rejected';
    if (s && s !== 'not_submitted') return 'submitted';
    return 'not_submitted';
  };

  const requiredKeys = ['id_document', 'selfie', 'phone'];

  const allRequiredSubmitted = requiredKeys.every((k) => {
    const st = getState(k);
    return st === 'verified' || st === 'submitted';
  });

  useEffect(() => {
    loadVerificationStatus();
  }, []);

  const loadVerificationStatus = async () => {
    try {
      const email = await authService.getUserEmail();
      const response = await driverAPI.getVerificationStatus(email);
      setVerificationStatus(response.data);
    } catch (error) {
      console.error('Error loading verification status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleSubmitForReview = async () => {
    setLoading(true);
    try {
      const email = await authService.getUserEmail();

      // Check if all required verifications have been submitted
      const missing = requiredKeys.filter((k) => {
        const st = getState(k);
        return st === 'not_submitted' || st === 'rejected';
      });

      if (missing.length > 0) {
        Alert.alert('Incomplete', 'Please complete ID document, selfie, and phone verification.');
        return;
      }

      // Submit for manual review (in production, this would trigger admin review)
      Alert.alert(
        'Submit for Review',
        'Your documents will be reviewed by our team. This typically takes 24-48 hours.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Submit',
            onPress: async () => {
              const email = await authService.getUserEmail();
              const response = await driverAPI.submitForReview(email);
              
              Alert.alert(
                'Submitted!',
                'Your application is under review. You will receive an email once approved.',
                [{ text: 'OK', onPress: () => router.replace('/(driver)/dashboard') }]
              );
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to submit for review');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (state) => {
    if (state === 'verified' || state === 'submitted') return 'checkmark-circle';
    return 'close-circle';
  };

  const getStatusColor = (state) => {
    if (state === 'verified') return COLORS.success;
    if (state === 'submitted') return COLORS.primary;
    return COLORS.error;
  };

  const getStatusLabel = (state) => {
    if (state === 'verified') return 'Verified';
    if (state === 'submitted') return 'Submitted';
    if (state === 'rejected') return 'Rejected';
    return 'Not done';
  };

  if (loadingStatus) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Verification Summary</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isApproved = verificationStatus?.is_approved || false;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Verification Summary</Text>
        <View style={{ width: 50 }} />
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Verification Summary</Text>
          <Text style={styles.subtitle}>Review your verification status</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Requirements</Text>
          
          {[
            { label: 'Government-Issued ID', key: 'id_document' },
            { label: 'Live Selfie', key: 'selfie' },
            { label: 'Phone Number', key: 'phone' },
            { label: 'Bank Account', key: 'bank_account' },
          ].map((item) => {
            const state = getState(item.key);
            const done = state === 'verified' || state === 'submitted';
            return (
              <View key={item.key} style={styles.verificationItem}>
                <View style={styles.verificationInfo}>
                  <Ionicons
                    name={getStatusIcon(state)}
                    size={24}
                    color={getStatusColor(state)}
                  />
                  <Text style={styles.verificationLabel}>{item.label}</Text>
                </View>
                <View style={styles.verificationStatus}>
                  {done ? (
                    <Text style={[styles.verifiedText, { color: getStatusColor(state) }]}>
                      {getStatusLabel(state)}
                    </Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.verifyButton}
                      onPress={() => {
                        switch (item.key) {
                          case 'id_document':
                            router.push('/(driver)/verify-id');
                            break;
                          case 'selfie':
                            router.push('/(driver)/verify-selfie');
                            break;
                          case 'phone':
                            router.push('/(driver)/verify-phone');
                            break;
                          case 'bank_account':
                            router.push('/(driver)/verify-bank');
                            break;
                        }
                      }}
                    >
                      <Text style={styles.verifyButtonText}>
                        {state === 'rejected' ? 'Redo' : 'Verify'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {!isApproved && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Approval Status</Text>
            <View style={styles.approvalCard}>
              <View style={styles.approvalInfo}>
                <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
                <View style={styles.approvalText}>
                  <Text style={styles.approvalTitle}>
                    {allRequiredSubmitted
                      ? 'Ready for Review' 
                      : 'Complete All Verifications'}
                  </Text>
                  <Text style={styles.approvalDesc}>
                    {allRequiredSubmitted
                      ? 'Your documents are ready for manual review by our team.'
                      : 'Complete all verification steps to submit for review.'}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={[styles.reviewButton, loading && styles.buttonDisabled]}
                onPress={handleSubmitForReview}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.reviewButtonText}>Submit for Review</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isApproved && (
          <View style={styles.section}>
            <View style={styles.approvedCard}>
              <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
              <Text style={styles.approvedTitle}>Account Approved!</Text>
              <Text style={styles.approvedDesc}>
                Your driver account has been approved. You can now start accepting rides.
              </Text>
              <TouchableOpacity
                style={styles.goOnlineButton}
                onPress={() => router.replace('/(driver)/dashboard')}
              >
                <Text style={styles.goOnlineButtonText}>Go to Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What Happens Next</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />
              <Text style={styles.infoText}>Review takes 24-48 hours</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
              <Text style={styles.infoText}>You'll receive an email when approved</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="car-outline" size={20} color={COLORS.primary} />
              <Text style={styles.infoText}>Go online when approved</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.completeButton}
          onPress={() => router.replace('/(driver)/dashboard')}
        >
          <Text style={styles.completeButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  navTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: { padding: 24, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 16 },
  
  verificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 12,
  },
  verificationInfo: { flexDirection: 'row', alignItems: 'center' },
  verificationLabel: { fontSize: 16, color: COLORS.text, marginLeft: 12 },
  verificationStatus: { alignItems: 'flex-end' },
  verifiedText: { fontSize: 14, color: COLORS.success, fontWeight: '600' },
  verifyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  verifyButtonText: { fontSize: 14, color: COLORS.white, fontWeight: '600' },
  
  approvalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
  },
  approvalInfo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  approvalText: { marginLeft: 12, flex: 1 },
  approvalTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  approvalDesc: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  reviewButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  reviewButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  
  approvedCard: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  approvedTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white, marginTop: 12 },
  approvedDesc: { fontSize: 14, color: COLORS.white, textAlign: 'center', marginTop: 8, opacity: 0.9 },
  goOnlineButton: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  goOnlineButtonText: { color: COLORS.success, fontSize: 16, fontWeight: '600' },
  
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
  },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoText: { fontSize: 14, color: COLORS.text, marginLeft: 12 },
  
  footer: { padding: 16, backgroundColor: COLORS.background },
  completeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  
  buttonDisabled: { opacity: 0.7 },
});