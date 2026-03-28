import { Feather } from "@expo/vector-icons";
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
import * as Haptics from "expo-haptics";
import { LANGUAGES } from "@/constants/languages";
import { useLocalizedStrings } from "@/hooks/useLocalizedStrings";

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedLangCode, setSelectedLangCode] = useState("en");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const ui = useLocalizedStrings({
    fillAllFields: "Please fill in all fields",
    invalidEmail: "Please enter a valid email",
    passwordMin: "Password must be at least 6 characters",
    passwordsMismatch: "Passwords don't match",
    enterName: "Please enter your name",
    signupFailed: "Sign up failed. Please try again.",
    stepLabel: "Step",
    ofLabel: "of",
    createAccount: "Create Account",
    signUpEmail: "Sign up with your email",
    emailAddress: "Email Address",
    emailPlaceholder: "you@example.com",
    password: "Password",
    confirmPassword: "Confirm Password",
    yourProfile: "Your Profile",
    tellUsMore: "Tell us more about yourself",
    fullName: "Full Name",
    fullNamePlaceholder: "e.g. Rajesh Kumar",
    preferredLanguage: "Preferred Language",
    allSet: "All Set!",
    ready: "Your account is ready. Let's get started!",
    email: "Email",
    name: "Name",
    language: "Language",
    almostThere: "Almost There",
    next: "Next",
    creatingAccount: "Creating Account...",
    alreadyHaveAccount: "Already have an account?",
    signIn: "Sign In",
  });
  const selectedLanguage = LANGUAGES.find((lang) => lang.code === selectedLangCode) ?? LANGUAGES[0];

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleNext = () => {
    if (step === 1) {
      // Validate email and password
      if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
        setError(ui.fillAllFields);
        return;
      }
      if (!email.includes("@")) {
        setError(ui.invalidEmail);
        return;
      }
      if (password.length < 6) {
        setError(ui.passwordMin);
        return;
      }
      if (password !== confirmPassword) {
        setError(ui.passwordsMismatch);
        return;
      }
    }
    if (step === 2 && !name.trim()) {
      setError(ui.enterName);
      return;
    }
    setError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => s + 1);
  };

  const handleSignup = async () => {
    setError("");
    setIsLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await signup(email.trim().toLowerCase(), password, name.trim());
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || ui.signupFailed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => (step > 1 ? setStep((s) => s - 1) : router.back())}
          disabled={isLoading}
        >
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <View style={styles.steps}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[styles.stepDot, { backgroundColor: s <= step ? Colors.primary : Colors.surfaceBorder }]}
            />
          ))}
        </View>
        <Text style={styles.stepLabel}>{ui.stepLabel} {step} {ui.ofLabel} 3</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{ui.createAccount}</Text>
              <Text style={styles.stepDesc}>{ui.signUpEmail}</Text>
              <View style={styles.fields}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{ui.emailAddress}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={ui.emailPlaceholder}
                    placeholderTextColor={Colors.textMuted}
                    value={email}
                    onChangeText={(t) => { setEmail(t); setError(""); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{ui.password}</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[styles.input, { flex: 1, paddingRight: 0 }]}
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
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{ui.confirmPassword}</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[styles.input, { flex: 1, paddingRight: 0 }]}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textMuted}
                      value={confirmPassword}
                      onChangeText={(t) => { setConfirmPassword(t); setError(""); }}
                      secureTextEntry={!showConfirmPassword}
                      editable={!isLoading}
                    />
                    <Pressable
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeIcon}
                    >
                      <Feather
                        name={showConfirmPassword ? "eye" : "eye-off"}
                        size={18}
                        color={Colors.textSecondary}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{ui.yourProfile}</Text>
              <Text style={styles.stepDesc}>{ui.tellUsMore}</Text>
              <View style={styles.fields}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{ui.fullName}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={ui.fullNamePlaceholder}
                    placeholderTextColor={Colors.textMuted}
                    value={name}
                    onChangeText={(t) => { setName(t); setError(""); }}
                    autoCapitalize="words"
                    editable={!isLoading}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{ui.preferredLanguage}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {LANGUAGES.map((lang) => (
                        <Pressable
                          key={lang.code}
                          style={[
                            styles.chip,
                            selectedLangCode === lang.code && styles.chipSelected,
                          ]}
                          onPress={() => { setSelectedLangCode(lang.code); Haptics.selectionAsync(); }}
                          disabled={isLoading}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              selectedLangCode === lang.code && styles.chipTextSelected,
                            ]}
                          >
                            {lang.nativeName}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{ui.allSet}</Text>
              <Text style={styles.stepDesc}>{ui.ready}</Text>
              <View style={styles.summaryBox}>
                <View style={styles.summaryItem}>
                  <Feather name="mail" size={20} color={Colors.primary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.summaryLabel}>{ui.email}</Text>
                    <Text style={styles.summaryValue}>{email}</Text>
                  </View>
                </View>
                <View style={styles.summaryItem}>
                  <Feather name="user" size={20} color={Colors.primary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.summaryLabel}>{ui.name}</Text>
                    <Text style={styles.summaryValue}>{name}</Text>
                  </View>
                </View>
                <View style={styles.summaryItem}>
                  <Feather name="globe" size={20} color={Colors.primary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.summaryLabel}>{ui.language}</Text>
                    <Text style={styles.summaryValue}>{selectedLanguage.nativeName}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {error !== "" && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: botPad + 16 }]}>
        {step < 3 ? (
          <Pressable
            style={({ pressed }) => [styles.nextBtn, { opacity: pressed || isLoading ? 0.8 : 1 }]}
            onPress={handleNext}
            disabled={isLoading}
          >
            <Text style={styles.nextBtnText}>
              {step === 2 ? ui.almostThere : ui.next}
            </Text>
            <Feather name="arrow-right" size={18} color={Colors.white} />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.nextBtn, { opacity: pressed || isLoading ? 0.8 : 1 }]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            <Text style={styles.nextBtnText}>
              {isLoading ? ui.creatingAccount : ui.createAccount}
            </Text>
            <Feather name="arrow-right" size={18} color={Colors.white} />
          </Pressable>
        )}

        <Pressable
          style={styles.signinLink}
          onPress={() => router.replace("/(auth)/signin")}
          disabled={isLoading}
        >
          <Text style={styles.signinLinkText}>
            {ui.alreadyHaveAccount}{" "}
            <Text style={styles.signinLinkHighlight}>{ui.signIn}</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
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
  steps: { flex: 1, flexDirection: "row", gap: 6 },
  stepDot: { flex: 1, height: 4, borderRadius: 2 },
  stepLabel: { fontSize: 12, color: Colors.textSecondary, fontFamily: "Inter_500Medium" },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  stepContent: { gap: 20 },
  stepTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: -0.6,
  },
  stepDesc: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  fields: { gap: 20 },
  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
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
  eyeIcon: { padding: 8 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.text,
  },
  chipTextSelected: { color: Colors.white },
  summaryBox: { gap: 12 },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  summaryValue: {
    fontSize: 15,
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
  },
  errorText: {
    color: Colors.error,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  nextBtn: {
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
  nextBtnText: {
    color: Colors.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  signinLink: { 
    alignItems: "center", 
    paddingVertical: 12,
    marginTop: 4,
  },
  signinLinkText: {
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    fontSize: 14,
  },
  signinLinkHighlight: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
});
