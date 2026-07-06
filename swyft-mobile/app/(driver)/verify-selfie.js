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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';
import { authService } from '../../src/services/auth';
import { driverAPI } from '../../src/services/api';

export default function DriverSelfieScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selfieImage, setSelfieImage] = useState('');

  const handleTakeSelfie = () => {
    Alert.alert(
      'Take Selfie',
      'Please take a clear selfie with your face fully visible. Make sure your eyes are open and you are looking directly at the camera.',
      [
        { text: 'Use Camera', onPress: () => {/* Camera logic - would integrate with expo-camera */ } },
        { text: 'Choose from Gallery', onPress: () => {/* Gallery logic */ } },
        { text: 'Skip for now', onPress: () => router.push('/(driver)/verify-phone') },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!selfieImage) {
      Alert.alert('Error', 'Please take a selfie first');
      return;
    }

    setLoading(true);
    try {
      const email = await authService.getUserEmail();
      const response = await driverAPI.submitSelfie(email, {
        selfie_image_url: selfieImage,
        id_document_image_url: '', // Would be passed from previous screen
      });
      
      router.push('/(driver)/verify-phone');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to submit selfie');
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
        <Text style={styles.headerTitle}>Live Selfie Verification</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepIndicator}>
          <View style={styles.stepCompleted} />
          <View style={styles.stepLine} />
          <View style={styles.stepActive} />
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
          <Text style={styles.title}>Live Selfie Verification</Text>
          <Text style={styles.subtitle}>We need to verify your identity with a live selfie</Text>

          <View style={styles.instructions}>
            <View style={styles.instructionItem}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              <Text style={styles.instructionText}>Hold your ID document in front of the camera</Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              <Text style={styles.instructionText}>Take a selfie showing your face clearly</Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              <Text style={styles.instructionText}>Make sure your eyes are open and looking at the camera</Text>
            </View>
          </View>

          <View style={styles.imageUploadSection}>
            <Text style={styles.label}>Your Selfie *</Text>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={handleTakeSelfie}
            >
              <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
              <Text style={styles.imageButtonText}>Take Selfie</Text>
            </TouchableOpacity>
            {selfieImage && (
              <Image source={{ uri: selfieImage }} style={styles.previewImage} />
            )}
          </View>

          <View style={styles.tipBox}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.tipText}>
              Your selfie is used to match with your ID document photo. 
              Both images must show the same person.
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
            <Text style={styles.buttonText}>Continue to Phone Verification</Text>
          )}
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
  instructions: { marginBottom: 24 },
  instructionItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  instructionText: { fontSize: 14, color: COLORS.text, marginLeft: 12, flex: 1 },
  imageUploadSection: { alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  imageButton: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  imageButtonText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8 },
  previewImage: { width: 120, height: 120, borderRadius: 8, marginTop: 8 },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  tipText: { fontSize: 12, color: COLORS.textSecondary, marginLeft: 8, flex: 1 },
  footer: { padding: 16, backgroundColor: COLORS.background },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
});