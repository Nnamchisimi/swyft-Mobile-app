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
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';
import { authService } from '../../src/services/auth';
import { driverAPI } from '../../src/services/api';
import { uploadDriverImage, uploadBase64AsDataUri, uploadVehicleImage } from '../../src/services/supabaseStorage';

export default function DriverIdDocumentScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    document_type: 'drivers_license',
    document_number: '',
    expiry_date: '',
    front_image_url: '',
    back_image_url: '',
    vehicle_image_url: '',
  });

  const documentTypes = [
    { label: "Driver's License", value: 'drivers_license' },
    { label: 'National ID', value: 'national_id' },
    { label: 'Passport', value: 'passport' },
    { label: 'Residence Permit', value: 'residence_permit' },
  ];

  const handlePickImage = async (type) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow photo access to continue.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        let url;
        if (asset.base64) {
          try {
            const path = `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
            url = await uploadDriverImage(asset.base64, path);
          } catch (e) {
            console.warn('Image upload failed, using base64 fallback:', e.message);
            url = uploadBase64AsDataUri(asset.base64);
          }
        } else {
          url = asset.uri;
        }
        setFormData({ ...formData, [`${type}_image_url`]: url });
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not access image. Please try again.');
    }
  };

  const handleTakePhoto = async (type) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow camera access to take photos.');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        let url;
        if (asset.base64) {
          try {
            const path = `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
            url = await uploadDriverImage(asset.base64, path);
          } catch (e) {
            console.warn('Image upload failed, using base64 fallback:', e.message);
            url = uploadBase64AsDataUri(asset.base64);
          }
        } else {
          url = asset.uri;
        }
        setFormData({ ...formData, [`${type}_image_url`]: url });
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Could not access camera. Please try again.');
    }
  };

  const handleImageUpload = (type) => {
    Alert.alert(
      `Upload ${type === 'front' ? 'Front' : 'Back'} Image`,
      'Choose how to upload:',
      [
        { text: 'Take Photo', onPress: () => handleTakePhoto(type) },
        { text: 'Choose from Gallery', onPress: () => handlePickImage(type) },
        { text: 'Skip for now', style: 'cancel', onPress: () => {} },
      ]
    );
  };

  const handlePickVehicleImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow photo access to continue.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        let url;
        if (asset.base64) {
          try {
            const email = await authService.getUserEmail();
            url = await uploadVehicleImage(asset.base64, email);
          } catch (e) {
            console.warn('Vehicle image upload failed, using base64 fallback:', e.message);
            url = uploadBase64AsDataUri(asset.base64);
          }
        } else {
          url = asset.uri;
        }
        setFormData({ ...formData, vehicle_image_url: url });
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not access image. Please try again.');
    }
  };

  const handleTakeVehiclePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow camera access to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        let url;
        if (asset.base64) {
          try {
            const email = await authService.getUserEmail();
            url = await uploadVehicleImage(asset.base64, email);
          } catch (e) {
            console.warn('Vehicle image upload failed, using base64 fallback:', e.message);
            url = uploadBase64AsDataUri(asset.base64);
          }
        } else {
          url = asset.uri;
        }
        setFormData({ ...formData, vehicle_image_url: url });
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Could not access camera. Please try again.');
    }
  };

  const handleVehicleImageUpload = () => {
    Alert.alert(
      'Upload Vehicle Photo',
      'Choose how to upload:',
      [
        { text: 'Take Photo', onPress: handleTakeVehiclePhoto },
        { text: 'Choose from Gallery', onPress: handlePickVehicleImage },
        { text: 'Skip for now', style: 'cancel', onPress: () => {} },
      ]
    );
  };

  const formatExpiryDate = (value) => {
    if (!value || value.trim() === '') return '';
    const m = value.trim().match(/^(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const month = String(parseInt(m[1], 10)).padStart(2, '0');
      let year = parseInt(m[2], 10);
      if (year < 100) year += 2000; // 2-digit year -> 20xx
      return `${year}-${month}-01`;
    }
    return value; // assume already ISO
  };

  const handleSubmit = async () => {
    if (!formData.document_number) {
      Alert.alert('Error', 'Please enter your document number');
      return;
    }

    if (!formData.front_image_url) {
      Alert.alert('Error', 'Please upload the front side of your ID document');
      return;
    }

    setLoading(true);
    try {
      const email = await authService.getUserEmail();
      if (!email) {
        Alert.alert('Error', 'User email not found. Please log in again.');
        return;
      }
      const payload = { ...formData, expiry_date: formatExpiryDate(formData.expiry_date) };
      const response = await driverAPI.submitIdDocument(email, payload);

      if (formData.vehicle_image_url) {
        try {
          await driverAPI.updateVehicleImage(email, { image_url: formData.vehicle_image_url });
        } catch (vehicleError) {
          console.warn('Vehicle image save failed:', vehicleError);
        }
      }

      router.push('/(driver)/verify-selfie');
    } catch (error) {
      console.log('ID submission error:', error.response?.data);
      const errorDetails = error.response?.data?.details || error.message;
      const errorCode = error.response?.data?.code;
      const detailMsg = error.response?.data?.details
        ? `${error.response.data.error}\n\n${error.response.data.details}`
        : (error.response?.data?.error || 'Failed to submit ID document');
      Alert.alert('Error', detailMsg);
      if (errorCode === '42P01') {
        console.error('Table id_documents does not exist. Please run database migrations.');
      }
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
        <Text style={styles.headerTitle}>ID Document Verification</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepIndicator}>
          <View style={styles.stepActive} />
          <View style={styles.stepLine} />
          <View style={styles.step} />
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
          <Text style={styles.title}>Government-Issued ID</Text>
          <Text style={styles.subtitle}>Please provide a valid government-issued ID</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Document Type *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.typeButtons}>
                {documentTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeButton,
                      formData.document_type === type.value && styles.typeButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, document_type: type.value })}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      formData.document_type === type.value && styles.typeButtonTextActive,
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Document Number *</Text>
            <TextInput
              style={styles.input}
              value={formData.document_number}
              onChangeText={(v) => setFormData({ ...formData, document_number: v })}
              placeholder="Enter document number"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Expiry Date (optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.expiry_date}
              onChangeText={(v) => setFormData({ ...formData, expiry_date: v })}
              placeholder="MM/YYYY"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.imageUploadSection}>
            <Text style={styles.label}>Front Side Image *</Text>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={() => handleImageUpload('front')}
            >
              <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
              <Text style={styles.imageButtonText}>Upload Front</Text>
            </TouchableOpacity>
            {formData.front_image_url && (
              <Image source={{ uri: formData.front_image_url }} style={styles.previewImage} />
            )}
          </View>

          <View style={styles.imageUploadSection}>
            <Text style={styles.label}>Back Side Image (optional)</Text>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={() => handleImageUpload('back')}
            >
              <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
              <Text style={styles.imageButtonText}>Upload Back</Text>
            </TouchableOpacity>
            {formData.back_image_url && (
              <Image source={{ uri: formData.back_image_url }} style={styles.previewImage} />
            )}
          </View>

          <View style={styles.imageUploadSection}>
            <Text style={styles.label}>Vehicle Photo (optional)</Text>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={handleVehicleImageUpload}
            >
              <Ionicons name="car-outline" size={32} color={COLORS.primary} />
              <Text style={styles.imageButtonText}>Upload Vehicle Photo</Text>
            </TouchableOpacity>
            {formData.vehicle_image_url && (
              <Image source={{ uri: formData.vehicle_image_url }} style={styles.previewImage} />
            )}
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
            <Text style={styles.buttonText}>Continue to Selfie</Text>
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
  typeButtons: { flexDirection: 'row' },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: COLORS.surface,
  },
  typeButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeButtonText: { fontSize: 12, color: COLORS.text },
  typeButtonTextActive: { color: COLORS.white },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  imageUploadSection: { alignItems: 'center' },
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