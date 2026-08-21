import { Stack, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { authService } from '../../src/services/auth';
import { driverAPI, setVerificationRedirectHandler, setSignOutHandler } from '../../src/services/api';
import { COLORS } from '../../src/constants/config';

export default function DriverLayout() {
  const [checking, setChecking] = useState(true);
  const [redirect, setRedirect] = useState(null);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        if (!authenticated) {
          const email = await authService.getUserEmail();
          if (email) {
            setRedirect(null);
            setChecking(false);
            return;
          }
          setRedirect('/(auth)/signin');
          return;
        }

        const role = await authService.getUserRole();
        if (role !== 'driver') {
          setRedirect('/(passenger)/home');
          return;
        }

        const email = await authService.getUserEmail();
        if (email) {
          try {
            const response = await driverAPI.getVerificationStatus(email);
            if (response.data?.is_approved) {
              setRedirect(null);
            } else {
              setRedirect('/(driver)/verify-summary');
            }
          } catch (error) {
            console.error('Driver layout verification check error:', error);
            setRedirect('/(driver)/verify-summary');
          }
          setChecking(false);
          return;
        }
      } catch (error) {
        console.error('Driver layout role check error:', error);
      } finally {
        setChecking(false);
      }
    };

    checkRole();
  }, []);

  useEffect(() => {
    setVerificationRedirectHandler(() => () => {
      setRedirect('/(driver)/verify-summary');
    });
    setSignOutHandler(() => () => {
      setRedirect('/(auth)/signin');
    });
    return () => {
      setVerificationRedirectHandler(null);
      setSignOutHandler(null);
    };
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
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="deliveries" />
        <Stack.Screen name="earnings" />
        <Stack.Screen name="account" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="delivery-details" />
        <Stack.Screen name="driver-otp" />
        <Stack.Screen name="verify-id" />
        <Stack.Screen name="verify-selfie" />
        <Stack.Screen name="verify-phone" />
        <Stack.Screen name="verify-bank" />
        <Stack.Screen name="verify-summary" />
      </Stack>
    </>
  );
}
