import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function DriverLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="profile" />
      </Stack>
    </>
  );
}
