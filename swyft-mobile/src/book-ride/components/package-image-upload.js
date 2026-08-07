import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import { uploadDriverImage, uploadBase64AsDataUri } from '../../services/supabaseStorage';

const styles = StyleSheet.create({
  uploadBox: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderStyle: 'dashed',
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  uploadContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 10,
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  uploadSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  preview: {
    width: '100%',
    height: 220,
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.error,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function PackageImageUpload({ imageUrl, onImageUploaded, onImageRemoved }) {
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      base64: true,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) {
      Alert.alert('Error', 'Could not read selected image.');
      return;
    }

    setUploading(true);
    try {
      const timestamp = Date.now();
      const path = `package-images/ride-${timestamp}.jpg`;
      const publicUrl = await uploadDriverImage(asset.base64, path);
      onImageUploaded?.(publicUrl);
    } catch (e) {
      Alert.alert('Upload failed', e.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (imageUrl) {
    return (
      <View style={styles.uploadBox}>
        <Image source={{ uri: imageUrl }} style={styles.preview} resizeMode="contain" />
        <TouchableOpacity style={styles.removeButton} onPress={onImageRemoved}>
          <Ionicons name="close" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.uploadBox} onPress={pickImage} disabled={uploading}>
      <View style={styles.uploadContent}>
        <View style={styles.uploadIcon}>
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="camera-outline" size={26} color={COLORS.primary} />
          )}
        </View>
        <Text style={styles.uploadTitle}>
          {uploading ? 'Uploading package photo...' : 'Add package photo'}
        </Text>
        <Text style={styles.uploadSubtitle}>
          Required for transparency. Take a clear photo of the item to be delivered.
        </Text>
      </View>
    </TouchableOpacity>
  );
}
