import React, { useState, useEffect, useRef } from "react";
import { View, Image, Text, StyleSheet, Animated } from "react-native";
import { COLORS } from "../src/constants/config";
import swyftLogo from "@/assets/images/swyftmobilelogo.png";
import { useAppReady } from "@/src/context/AppReadyContext";

type Phase = "logo" | "text" | "fadeout" | "exit";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const { isAppReady } = useAppReady();
  const [phase, setPhase] = useState<Phase>("logo");
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const startFadeOut = (delay: number = 0): void => {
    setTimeout(() => {
      setPhase("fadeout");
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setPhase("exit");
        onCompleteRef.current();
      });
    }, delay);
  };

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("text"), 0);
    const t2 = setTimeout(() => startFadeOut(0), 5000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const getLogoStyle = () => {
    return [
      styles.logo,
      {
        opacity: phase === "logo" || phase === "text" || phase === "exit" ? 1 : 0,
        transform: [{ scale: phase !== "logo" ? 1 : 0.8 }],
      },
    ];
  };

  const getTextStyle = () => {
    return [
      styles.brandText,
      {
        opacity: phase === "text" || phase === "exit" ? 1 : 0,
        transform: [
          {
            translateY: phase === "text" || phase === "exit" ? 0 : 8,
          },
        ],
      },
    ];
  };

  if (phase === "exit") {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        <Image
          source={swyftLogo}
          style={getLogoStyle()}
          resizeMode="contain"
        />
        <Text style={getTextStyle()}>SWYFT</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    gap: 20,
  },
  logo: {
    width: 100,
    height: 100,
  },
  brandText: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 8,
    color: COLORS.white,
  },
});