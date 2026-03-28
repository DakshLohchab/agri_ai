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
import { useLocalizedStrings } from "@/hooks/useLocalizedStrings";

export default function SigninScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const ui = useLocalizedStrings({
    fillAllFields: "Please fill in all fields",
    invalidEmail: "Please enter a valid email",
    signinFailed: "Sign in failed. Please try again.",
    title: "Welcome Back",
    subtitle: "Sign in to continue farming smarter",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    signingIn: "Signing In...",
    signIn: "Sign In",
    noAccountPrefix: "Don't have an account?",
    createAccount: "Create Account",
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError(ui.fillAllFields);
      return;
    }

    if (!email.includes("@")) {
      setError(ui.invalidEmail);
      return;
    }

    setError("");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || ui.signinFailed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
          <Text style={styles.title}>{ui.title}</Text>
          <Text style={styles.subtitle}>{ui.subtitle}</Text>

          <View style={styles.fields}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{ui.email}</Text>
              <TextInput
                style={styles.input}
                placeholder={ui.emailPlaceholder}
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(""); }}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{ui.password}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(""); }}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Feather
                    name={showPassword ? "eye" : "eye-off"}
                    size={18}
                    color={Colors.textSecondary}
                  />
                </Pressable>
              </View>
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
            <Text style={styles.signinBtnText}>{isLoading ? ui.signingIn : ui.signIn}</Text>
            <Feather name="arrow-right" size={18} color={Colors.white} />
          </Pressable>

          <Pressable
            style={styles.switchBtn}
            onPress={() => router.replace("/(auth)/signup")}
            disabled={isLoading}
          >
            <Text style={styles.switchText}>
              {ui.noAccountPrefix}{" "}
              <Text style={styles.switchLink}>{ui.createAccount}</Text>
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
    paddingRight: 12,
  },
  eyeIcon: {
    padding: 8,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
  },
  errorText: { color: Colors.error, fontFamily: "Inter_500Medium", fontSize: 14 },
  signinBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  signinBtnText: { 
    color: Colors.white, 
    fontFamily: "Inter_600SemiBold", 
    fontSize: 16,
    letterSpacing: 0.5,
  },
  switchBtn: { 
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  switchText: { fontFamily: "Inter_400Regular", color: Colors.textSecondary, fontSize: 14 },
  switchLink: { color: Colors.primary, fontFamily: "Inter_600SemiBold" },
});
