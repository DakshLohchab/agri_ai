import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
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

const CROPS = ["Wheat", "Rice", "Maize", "Cotton", "Sugarcane", "Soybean", "Tomato", "Potato", "Onion", "Pulses"];
const LANGUAGES = ["English", "Hindi", "Marathi", "Punjabi", "Gujarati", "Telugu", "Tamil"];

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [selectedLang, setSelectedLang] = useState("English");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const toggleCrop = (crop: string) => {
    Haptics.selectionAsync();
    setSelectedCrops((prev) =>
      prev.includes(crop) ? prev.filter((c) => c !== crop) : [...prev, crop]
    );
  };

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim() || !phone.trim()) {
        setError("Please fill in all fields");
        return;
      }
      if (phone.length < 10) {
        setError("Enter a valid phone number");
        return;
      }
    }
    if (step === 2 && !location.trim()) {
      setError("Please enter your location");
      return;
    }
    setError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => s + 1);
  };

  const handleSignup = async () => {
    if (selectedCrops.length === 0) {
      setError("Select at least one crop");
      return;
    }
    setError("");
    setIsLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const userId = Date.now().toString() + Math.random().toString(36).substr(2, 6);
      await signIn({
        id: userId,
        name: name.trim(),
        phone: phone.trim(),
        location: location.trim(),
        cropTypes: selectedCrops,
        language: selectedLang,
      });
      router.replace("/(tabs)");
    } catch (e) {
      setError("Sign up failed. Please try again.");
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
        <Text style={styles.stepLabel}>Step {step} of 3</Text>
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
              <Text style={styles.stepTitle}>Create Account</Text>
              <Text style={styles.stepDesc}>Tell us about yourself</Text>
              <View style={styles.fields}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Rajesh Kumar"
                    placeholderTextColor={Colors.textMuted}
                    value={name}
                    onChangeText={(t) => { setName(t); setError(""); }}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+91 XXXXX XXXXX"
                    placeholderTextColor={Colors.textMuted}
                    value={phone}
                    onChangeText={(t) => { setPhone(t); setError(""); }}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Preferred Language</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {LANGUAGES.map((lang) => (
                        <Pressable
                          key={lang}
                          style={[
                            styles.chip,
                            selectedLang === lang && styles.chipSelected,
                          ]}
                          onPress={() => { setSelectedLang(lang); Haptics.selectionAsync(); }}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              selectedLang === lang && styles.chipTextSelected,
                            ]}
                          >
                            {lang}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Your Location</Text>
              <Text style={styles.stepDesc}>So we can get local weather and mandi prices</Text>
              <View style={styles.fields}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Village / District</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Nashik, Maharashtra"
                    placeholderTextColor={Colors.textMuted}
                    value={location}
                    onChangeText={(t) => { setLocation(t); setError(""); }}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Your Crops</Text>
              <Text style={styles.stepDesc}>Select all crops you grow</Text>
              <View style={styles.cropGrid}>
                {CROPS.map((crop) => (
                  <Pressable
                    key={crop}
                    style={[
                      styles.cropChip,
                      selectedCrops.includes(crop) && styles.cropChipSelected,
                    ]}
                    onPress={() => toggleCrop(crop)}
                  >
                    <Feather
                      name="check-circle"
                      size={14}
                      color={selectedCrops.includes(crop) ? Colors.primary : Colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.cropChipText,
                        selectedCrops.includes(crop) && styles.cropChipTextSelected,
                      ]}
                    >
                      {crop}
                    </Text>
                  </Pressable>
                ))}
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
        <Pressable
          style={({ pressed }) => [
            styles.nextBtn,
            { opacity: pressed || isLoading ? 0.8 : 1 },
          ]}
          onPress={step < 3 ? handleNext : handleSignup}
          disabled={isLoading}
        >
          <Text style={styles.nextBtnText}>
            {step === 3 ? (isLoading ? "Creating Account..." : "Create Account") : "Continue"}
          </Text>
          <Feather name={step === 3 ? "check" : "arrow-right"} size={18} color={Colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  steps: { flexDirection: "row", gap: 6, flex: 1, justifyContent: "center" },
  stepDot: { width: 32, height: 4, borderRadius: 2 },
  stepLabel: { fontSize: 13, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8 },
  stepContent: { gap: 8, marginBottom: 24 },
  stepTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5 },
  stepDesc: { fontSize: 15, color: Colors.textSecondary, fontFamily: "Inter_400Regular", marginBottom: 16 },
  fields: { gap: 20 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
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
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  chipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + "22" },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_500Medium" },
  chipTextSelected: { color: Colors.primary },
  cropGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cropChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  cropChipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + "22" },
  cropChipText: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_500Medium" },
  cropChipTextSelected: { color: Colors.primary },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.error + "22",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  errorText: { fontSize: 13, color: Colors.error, fontFamily: "Inter_400Regular" },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  nextBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  nextBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.white },
});
