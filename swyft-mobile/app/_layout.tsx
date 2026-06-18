import { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import SplashScreen from "@/components/splash-screen";
import { AppReadyProvider, useAppReady } from "@/src/context/AppReadyContext";
import { COLORS } from "@/src/constants/config";

function RootLayoutContent() {
  const { isAppReady } = useAppReady();
  const [showSplash, setShowSplash] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const handleDeepLink = (url) => {
      const parsed = Linking.parse(url);
      if (parsed.scheme === "swyftmobile" && parsed.hostname === "verify") {
        const token = parsed.queryParams?.token;
        const email = parsed.queryParams?.email;
        if (token && email) {
          router.replace({
            pathname: "/(auth)/verify-link",
            params: { token, email }
          });
        }
      }
    };

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [router]);

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