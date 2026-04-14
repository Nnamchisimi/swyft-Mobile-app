import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { signInWithGoogle } from '../../src/services/googleAuth';
import { authService } from '../../src/services/auth';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/config';

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'passenger',
    
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    vehiclePlate: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      
      const result = await signInWithGoogle();
      
      if (!result.success) {
        if (result.error === 'cancelled') {
          setLoading(false);
          return;
        }
        throw new Error(result.error);
      }
      
      const googleEmail = result.user.email;
      const googleFirstName = result.user.given_name || '';
      const googleLastName = result.user.family_name || '';
      
      setFormData(prev => ({
        ...prev,
        email: googleEmail,
        firstName: googleFirstName,
        lastName: googleLastName,
      }));
      
      try {
        const loginResult = await authService.login(googleEmail, 'google-oauth');
        if (loginResult.success) {
          if (loginResult.user?.role?.toLowerCase() === 'driver') {
            router.replace('/(driver)/dashboard');
          } else {
            router.replace('/(passenger)/home');
          }
          return;
        }
      } catch (e) {}
      
      Alert.alert('Info', 'Please complete your registration by filling in the remaining details.');
      
    } catch (error) {
      console.log('Google Sign-In error:', error);
      if (error.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Google Sign-In Error', 'Please try again or register manually.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRegister = async () => {
    const { firstName, lastName, email, phone, password, confirmPassword, role,
            vehicleMake, vehicleModel, vehicleYear, vehicleColor, vehiclePlate } = formData;

    if (!firstName || !lastName || !email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    
    if (role === 'driver') {
      if (!vehicleMake || !vehicleModel || !vehicleYear || !vehicleColor || !vehiclePlate) {
        setError('Please fill in all vehicle details');
        return;
      }
    }

    setError('');
    setLoading(true);

    try {
      const userData = {
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || 'N/A',
        password,
        role,
        ...(role === 'driver' && {
          vehicle: `${vehicleYear} ${vehicleMake} ${vehicleModel}`,
          vehicle_color: vehicleColor,
          vehicle_plate: vehiclePlate,
          vehicle_make: vehicleMake,
          vehicle_model: vehicleModel,
          vehicle_year: vehicleYear,
        }),
      };

      const result = await authService.register(userData);

      if (result.success) {
        // Check if verification is required
        if (result.requiresVerification) {
          // Navigate to verification screen with email
          router.replace({
            pathname: '/(auth)/verify',
            params: { email: result.email }
          });
        } else {
          // Direct login (shouldn't happen with email verification enabled)
          if (role === 'driver') {
            router.replace('/(driver)/dashboard');
          } else {
            router.replace('/(passenger)/home');
          }
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.brandName}>SWYFTinc</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Swyft today</Text>
        </View>

        <View style={styles.form}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={24} color={COLORS.white} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.firstName}
                onChangeText={(value) => handleChange('firstName', value)}
                placeholder="First name"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.lastName}
                onChangeText={(value) => handleChange('lastName', value)}
                placeholder="Last name"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
          </View>

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={(value) => handleChange('email', value)}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(value) => handleChange('phone', value)}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Password *</Text>
          <TextInput
            style={styles.input}
            value={formData.password}
            onChangeText={(value) => handleChange('password', value)}
            placeholder="Create a password"
            secureTextEntry
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Confirm Password *</Text>
          <TextInput
            style={styles.input}
            value={formData.confirmPassword}
            onChangeText={(value) => handleChange('confirmPassword', value)}
            placeholder="Confirm your password"
            secureTextEntry
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>I am a:</Text>
          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                formData.role === 'passenger' && styles.roleButtonActive,
              ]}
              onPress={() => handleChange('role', 'passenger')}
            >
              <Ionicons name="person" size={40} color={COLORS.primary} />
              <Text
                style={[
                  styles.roleText,
                  formData.role === 'passenger' && styles.roleTextActive,
                ]}
              >
                Passenger
              </Text>
              <Text style={styles.roleDesc}>I need rides</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleButton,
                formData.role === 'driver' && styles.roleButtonActive,
              ]}
              onPress={() => handleChange('role', 'driver')}
            >
              <Ionicons name="car" size={40} color={COLORS.primary} />
              <Text
                style={[
                  styles.roleText,
                  formData.role === 'driver' && styles.roleTextActive,
                ]}
              >
                Driver
              </Text>
              <Text style={styles.roleDesc}>I provide rides</Text>
            </TouchableOpacity>
          </View>

          {formData.role === 'driver' && (
            <View style={styles.vehicleSection}>
              <Text style={styles.sectionTitle}>Vehicle Details</Text>
              <Text style={styles.sectionSubtitle}>Enter your vehicle information</Text>
              
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Make *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.vehicleMake}
                    onChangeText={(value) => handleChange('vehicleMake', value)}
                    placeholder="e.g., Toyota"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Model *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.vehicleModel}
                    onChangeText={(value) => handleChange('vehicleModel', value)}
                    placeholder="e.g., Camry"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Year *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.vehicleYear}
                    onChangeText={(value) => handleChange('vehicleYear', value)}
                    placeholder="e.g., 2020"
                    keyboardType="numeric"
                    maxLength={4}
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Color *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.vehicleColor}
                    onChangeText={(value) => handleChange('vehicleColor', value)}
                    placeholder="e.g., White"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <Text style={styles.label}>License Plate *</Text>
              <TextInput
                style={styles.input}
                value={formData.vehiclePlate}
                onChangeText={(value) => handleChange('vehiclePlate', value)}
                placeholder="e.g., ABC 123"
                autoCapitalize="characters"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.link}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 3,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  form: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  roleButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  roleButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  roleIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  roleText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  roleTextActive: {
    color: COLORS.white,
  },
  roleDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  vehicleSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  error: {
    color: COLORS.error,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  googleButton: {
    backgroundColor: '#4285F4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  googleButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginHorizontal: 16,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  link: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
