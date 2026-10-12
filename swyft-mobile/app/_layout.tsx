import { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Modal } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import SplashScreenComponent from "@/components/splash-screen";
import { AppReadyProvider, useAppReady } from "@/src/context/AppReadyContext";
import { COLORS } from "@/src/constants/config";

function RootLayoutContent() {
  const { isAppReady } = useAppReady();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [maxTimeElapsed, setMaxTimeElapsed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const minTimer = setTimeout(() => setMinTimeElapsed(true), 2200);
    const maxTimer = setTimeout(() => setMaxTimeElapsed(true), 8000);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  const showSplash = !((isAppReady && minTimeElapsed) || maxTimeElapsed);

  useEffect(() => {
    const handleDeepLink = (url) => {
      const parsed = Linking.parse(url);
      if (parsed.scheme === "swyftmobile") {
        const token = parsed.queryParams?.token;
        const email = parsed.queryParams?.email;

        if (parsed.hostname === "verify" && token && email) {
          router.replace({
            pathname: "/(auth)/verify-link",
            params: { token, email }
          });
        } else if (parsed.hostname === "reset-password" && token && email) {
          router.replace({
            pathname: "/(auth)/reset-password",
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
        <Stack.Screen name="(admin)" />
      </Stack>
      <Modal visible={showSplash} animationType="none">
        <SplashScreenComponent />
      </Modal>
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
