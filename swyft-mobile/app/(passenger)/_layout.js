import { Stack } from 'expo-router';

export default function PassengerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="book-ride" />
      <Stack.Screen name="track-ride" />
      <Stack.Screen name="rate-ride" />
      <Stack.Screen name="history" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
