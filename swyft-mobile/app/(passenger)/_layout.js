import { Stack, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { authService } from '../../src/services/auth';
import { COLORS } from '../../src/constants/config';

export default function PassengerLayout() {
  const [checking, setChecking] = useState(true);
  const [redirect, setRedirect] = useState(null);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        if (!authenticated) {
          setRedirect('/(auth)/signin');
          return;
        }

        const role = await authService.getUserRole();
        if (role === 'driver') {
          setRedirect('/(driver)/dashboard');
          return;
        }
      } catch (error) {
        console.error('Passenger layout role check error:', error);
      } finally {
        setChecking(false);
      }
    };

    checkRole();
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (redirect) {
    return <Redirect href={redirect} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="book-ride" />
      <Stack.Screen name="track-ride" />
      <Stack.Screen name="rate-ride" />
      <Stack.Screen name="history" />
      <Stack.Screen name="ride-details" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="payment-webview" />
    </Stack>
  );
}
