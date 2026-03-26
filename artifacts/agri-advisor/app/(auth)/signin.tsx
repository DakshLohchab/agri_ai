import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

export default function SigninScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSignIn = async () => {
    if (!phone.trim() || !name.trim()) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const userId = Date.now().toString() + Math.random().toString(36).substr(2, 6);
      await signIn({
        id: userId,
        name: name.trim(),
        phone: phone.trim(),
        location: "India",
        cropTypes: ["Wheat"],
        language: "English",
      });
      router.replace("/(tabs)");
    } catch (e) {
      setError("Sign in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue farming smarter</Text>

          <View style={styles.fields}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Your Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={(t) => { setName(t); setError(""); }}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 XXXXX XXXXX"
                placeholderTextColor={Colors.textMuted}
                value={phone}
                onChangeText={(t) => { setPhone(t); setError(""); }}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {error !== "" && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.signinBtn, { opacity: pressed || isLoading ? 0.8 : 1 }]}
            onPress={handleSignIn}
            disabled={isLoading}
          >
            <Text style={styles.signinBtnText}>{isLoading ? "Signing In..." : "Sign In"}</Text>
            <Feather name="arrow-right" size={18} color={Colors.white} />
          </Pressable>

          <Pressable
            style={styles.switchBtn}
            onPress={() => router.replace("/(auth)/signup")}
          >
            <Text style={styles.switchText}>
              New to AgriAdvisor?{" "}
              <Text style={styles.switchLink}>Create Account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  content: { paddingHorizontal: 24, paddingTop: 16, gap: 24 },
  title: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.8 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  fields: { gap: 20 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.error + "22",
    borderRadius: 10,
    padding: 12,
  },
  errorText: { fontSize: 13, color: Colors.error, fontFamily: "Inter_400Regular" },
  signinBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  signinBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.white },
  switchBtn: { alignItems: "center" },
  switchText: { fontSize: 14, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  switchLink: { color: Colors.primary, fontFamily: "Inter_600SemiBold" },
});
