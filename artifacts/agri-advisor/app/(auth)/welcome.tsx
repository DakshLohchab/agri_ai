import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

const { width, height } = Dimensions.get("window");

const FEATURES = [
  { icon: "cpu", label: "6-Agent AI Pipeline" },
  { icon: "cloud", label: "Live Weather Data" },
  { icon: "trending-up", label: "Mandi Prices" },
  { icon: "shield", label: "Guardrails & Safety" },
];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("@/assets/images/farmer-field.png")}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["rgba(10,15,13,0.3)", "rgba(10,15,13,0.6)", "rgba(10,15,13,0.97)"]}
        style={StyleSheet.absoluteFillObject}
        locations={[0, 0.4, 1]}
      />

      <View style={[styles.content, { paddingTop: topPad + 20, paddingBottom: botPad + 20 }]}>
        <Animated.View
          style={[styles.header, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
        >
          <View style={styles.logoContainer}>
            <Feather name="cpu" size={32} color={Colors.primary} />
            <View style={styles.logoLeaf}>
              <Feather name="feather" size={18} color={Colors.secondary} />
            </View>
          </View>
          <Text style={styles.appName}>AgriAdvisor</Text>
          <Text style={styles.tagline}>AI-Powered Farming Intelligence</Text>
          <Text style={styles.subtitle}>
            LangGraph multi-agent system with real-time web search, weather, and market data
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.features,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureChip}>
              <Feather name={f.icon as any} size={14} color={Colors.primary} />
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View
          style={[
            styles.buttons,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push("/(auth)/signup")}
          >
            <Text style={styles.primaryBtnText}>Get Started</Text>
            <Feather name="arrow-right" size={18} color={Colors.white} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.75 : 1 }]}
            onPress={() => router.push("/(auth)/signin")}
          >
            <Text style={styles.secondaryBtnText}>Sign In</Text>
          </Pressable>
        </Animated.View>

        <Animated.Text style={[styles.disclaimer, { opacity: fadeAnim }]}>
          Domain-specialized AI with compliance guardrails
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    gap: 24,
  },
  header: {
    gap: 12,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.primary + "22",
    borderWidth: 1.5,
    borderColor: Colors.primary + "55",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoLeaf: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.secondary + "22",
    borderWidth: 1,
    borderColor: Colors.secondary + "55",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  features: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  featureChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  featureText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  buttons: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface + "88",
  },
  secondaryBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
});
