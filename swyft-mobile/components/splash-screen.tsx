import React, { useState, useEffect, useRef } from "react";
import { View, Image, Text, StyleSheet, Animated } from "react-native";
import { COLORS } from "../src/constants/config";
import swyftLogo from "@/assets/images/swyftmobilelogo.png";

export default function SplashScreen() {
  const [showText, setShowText] = useState(false);
  const logoScale = useRef(new Animated.Value(0.96)).current;
  const logoTranslateY = useRef(new Animated.Value(10)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(8)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(logoTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      setShowText(true);
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.timing(progressWidth, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        })
      ).start();
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  const progressTranslate = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 200],
  });

  return (
    <View style={styles.container}>
      {/* Ambient glow */}
      <View style={styles.glow} />

      {/* Logo lockup */}
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoWrapper,
            {
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

        {showText && (
          <Animated.View
            style={[
              styles.textWrapper,
              {
                opacity: textOpacity,
                transform: [{ translateY: textTranslateY }],
              },
            ]}
          >
            <Text style={styles.brandText}>SWYFT</Text>
          </Animated.View>
        )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 20,
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
