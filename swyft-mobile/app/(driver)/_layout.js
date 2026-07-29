import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function DriverLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="deliveries" />
        <Stack.Screen name="earnings" />
        <Stack.Screen name="account" />
        <Stack.Screen name="profile" />
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
