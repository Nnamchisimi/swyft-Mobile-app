import React, { useState, useEffect, useRef } from "react";
import { View, Image, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../src/constants/config";
import swyftLogo from "@/assets/images/swyftmobilelogo.png";
import { useAppReady } from "@/src/context/AppReadyContext";

type Phase = "enter" | "hold" | "exit";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const router = useRouter();
  const { isAppReady } = useAppReady();
  const [phase, setPhase] = useState<Phase>("enter");
  const [exited, setExited] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.96)).current;
  const logoTranslateY = useRef(new Animated.Value(10)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(8)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const checkAutoLogin = async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        const role = await AsyncStorage.getItem('userRole');
        if (role === 'admin') {
          router.replace('/(admin)/review');
        } else if (role === 'driver') {
          router.replace('/(driver)/dashboard');
        } else {
          router.replace('/(passenger)/home');
        }
      }
    };
    
    checkAutoLogin();
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 800);
    const t2 = setTimeout(() => setPhase("exit"), 3000);
    const t3 = setTimeout(() => {
      onCompleteRef.current();
    }, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    if (phase === "enter") {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    }

    if (phase === "hold") {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.timing(progressWidth, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: false,
        })
      ).start();
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "exit") {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        setExited(true);
        onCompleteRef.current();
      });
    }
  }, [phase]);

  if (phase === "exit" && exited) {
    return null;
  }

  const progressTranslate = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 200],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      {/* Ambient glow */}
      <View style={styles.glow} />

      {/* Logo lockup */}
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: phase !== "enter" ? 1 : fadeAnim,
              transform: [
                { scale: logoScale },
                { translateY: logoTranslateY },
              ],
            },
          ]}
        >
          <Image
            source={swyftLogo}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.textWrapper,
            {
              opacity: phase === "hold" || phase === "exit" ? textOpacity : 0,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.brandText}>SWYFT</Text>
        </Animated.View>
      </View>

      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: "33%",
                transform: [{ translateX: progressTranslate }],
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  glow: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -112,
    marginTop: -112,
    width: 224,
    height: 224,
    borderRadius: 112,
    backgroundColor: "#2196F3",
    opacity: 0.25,
  },
  content: {
    alignItems: "center",
    gap: 0,
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 120,
    height: 120,
  },
  textWrapper: {
    alignItems: "center",
  },
  brandText: {
    fontSize:20,
    fontWeight: "600",
    letterSpacing: 10,
    color: COLORS.white,
    textAlign: "center",
  },
  progressContainer: {
    position: "absolute",
    bottom: 96,
    width: 128,
    height: 2,
    overflow: "hidden",
    borderRadius: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  progressTrack: {
    flex: 1,
    justifyContent: "center",
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
    backgroundColor: "#2196F3",
  },
});
