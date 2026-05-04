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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useGoogleSignIn } from '../../src/services/googleAuth';
import { authService } from '../../src/services/auth';
import { COLORS, API_URL } from '../../src/constants/config';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState(API_URL);
  const [loading, setLoading] = useState(false);

  const { request, response, promptAsync, redirectUri } = useGoogleSignIn();

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      handleGoogleCallback(code);
    }
  }, [response]);

  const handleGoogleCallback = async (code) => {
    try {
      setLoading(true);
      setError('');

      const result = await fetch(`${API_URL}/api/auth/google/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await result.json();

      if (data.token) {
        await authService.setToken(data.token);
        const role = (data.user.role || 'passenger').toLowerCase();
        router.replace(role === 'driver' ? '/(driver)/dashboard' : '/(passenger)/home');
      } else {
        throw new Error(data.error || 'Google sign-in failed');
      }
    } catch (err) {
      console.log('Google callback error:', err);
      Alert.alert('Google Sign-In', 'Please try manual sign-in or register your Google account first.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await promptAsync({ useProxy: true });
    } catch (err) {
      console.log('Google prompt error:', err);
      setLoading(false);
      Alert.alert('Google Sign-In', 'Please try again or sign in manually.');
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    setError('');
    setLoading(true);

    console.log('=== LOGIN DEBUG START ===');
    console.log('Email:', email.trim());
    console.log('Attempting login at:', new Date().toISOString());

    try {
      const result = await authService.login(email.trim(), password);

      console.log('Login result:', JSON.stringify(result, null, 2));
      setDebugInfo(`URL: ${API_URL}\nResult: ${JSON.stringify(result, null, 2)}`);

      if (result.success) {
        console.log('Login successful, user role:', result.user.role);

        const role = (result.user.role || 'passenger').toLowerCase();
        if (role === 'driver') {
          router.replace('/(driver)/dashboard');
        } else {
          router.replace('/(passenger)/home');
        }
      } else {
        console.log('Login failed with error:', result.error);

        if (result.requiresVerification) {
          router.replace({
            pathname: '/(auth)/verify',
            params: { email: result.email }
          });
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      console.log('Login exception caught:', err);
      console.log('Exception message:', err.message);
      console.log('Exception code:', err.code);
      const detailedError = `URL: ${API_URL}\nError: ${err.message}\nCode: ${err.code || 'N/A'}\nType: ${err.constructor.name}`;
      setDebugInfo(detailedError);
      setError(`Error: ${err.message || 'Unknown error occurred'}`);
    } finally {
      console.log('=== LOGIN DEBUG END ===');
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
          <Text style={styles.title}>Swyft</Text>
          <Text style={styles.subtitle}>Your ride, on demand</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            placeholderTextColor={COLORS.textSecondary}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={24} color={COLORS.white} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.link}>Sign Up</Text>
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
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 3,
    marginBottom: 4,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  error: {
    color: COLORS.error,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
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
  googleButton: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  googleButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
});