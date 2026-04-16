import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import SplashScreen from "@/components/splash-screen";
import { AppReadyProvider, useAppReady } from "@/src/context/AppReadyContext";
import { COLORS } from "@/src/constants/config";

function RootLayoutContent() {
  const { isAppReady } = useAppReady();
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <>
      <StatusBar style={showSplash ? "light" : "auto"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(passenger)" />
        <Stack.Screen name="(driver)" />
      </Stack>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </>
  );
}

export default function RootLayout() {
  return (
    <AppReadyProvider>
      <RootLayoutContent />
    </AppReadyProvider>
  );
}