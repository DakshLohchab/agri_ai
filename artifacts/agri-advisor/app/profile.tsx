import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ExpoLocation from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { LANGUAGES } from "@/constants/languages";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useLanguage } from "@/context/LanguageContext";

const LOCATION_SUGGESTIONS = ["Punjab", "Haryana", "Delhi", "Maharashtra", "Karnataka", "Tamil Nadu"];
const LANGUAGE_CODES = ["en", "hi", "mr", "te", "pa", "bn"];

function getInitials(name?: string, email?: string) {
  const source = (name || email || "Farmer").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatLastActive(timestamp?: number) {
  if (!timestamp) return "No chats yet";
  const hours = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
  if (hours < 1) return "Active this hour";
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Active ${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function ProfileScreen() {
  const { user, logout, updateProfile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { conversations } = useChat();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [location, setLocation] = useState(user?.location || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastSaveMode, setLastSaveMode] = useState<"remote" | "local" | null>(null);

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setLocation(user?.location || "");
  }, [user?.name, user?.email, user?.location]);

  const trimmedName = name.trim();
  const trimmedLocation = location.trim();
  const initials = useMemo(() => getInitials(trimmedName || user?.name, email), [trimmedName, user?.name, email]);
  const hasChanges = trimmedName !== (user?.name?.trim() || "") || trimmedLocation !== (user?.location?.trim() || "");
  const completionCount = [trimmedName, email, trimmedLocation].filter(Boolean).length;
  const completionPercent = Math.round((completionCount / 3) * 100);
  const canSave = !!trimmedName && hasChanges && !isLoading && !isLocating && !isChangingLanguage;
  const totalMessages = conversations.reduce((sum, item) => sum + item.messages.length, 0);
  const lastActiveAt = conversations.reduce<number | undefined>(
    (latest, item) => (!latest || item.updatedAt > latest ? item.updatedAt : latest),
    undefined
  );
  const languageChoices = useMemo(
    () => LANGUAGE_CODES.map((code) => LANGUAGES.find((item) => item.code === code)).filter(Boolean),
    []
  );

  const syncLabel =
    lastSaveMode === "remote"
      ? "Cloud sync healthy"
      : lastSaveMode === "local"
        ? "Offline-safe local save"
        : "Ready to sync";

  const showSuccess = (message: string, mode?: "remote" | "local") => {
    if (mode) setLastSaveMode(mode);
    setSuccess(message);
    setTimeout(() => setSuccess(""), 3000);
  };

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

  const handleSave = async () => {
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    clearFeedback();
    setIsLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await updateProfile(trimmedName, trimmedLocation);
      showSuccess(
        result.savedRemotely
          ? "Profile updated successfully and synced to your account."
          : "Profile saved locally. Server sync is pending.",
        result.savedRemotely ? "remote" : "local"
      );
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      setError(e.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    clearFeedback();
    setIsLocating(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const permission = await ExpoLocation.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission was not granted.");
      const coords = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      const places = await ExpoLocation.reverseGeocodeAsync(coords.coords);
      const place = places[0];
      const nextLocation = [place?.city, place?.region, place?.country].filter(Boolean).slice(0, 2).join(", ");
      if (!nextLocation) throw new Error("Could not detect a readable location.");
      setLocation(nextLocation);
      showSuccess("Current location detected. Review it and save when ready.");
    } catch (e: any) {
      setError(e.message || "Unable to detect current location.");
    } finally {
      setIsLocating(false);
    }
  };

  const handleLanguageChange = async (code: string) => {
    const nextLanguage = LANGUAGES.find((item) => item.code === code);
    if (!nextLanguage || nextLanguage.code === language.code) return;

    clearFeedback();
    setIsChangingLanguage(true);
    try {
      await setLanguage(nextLanguage);
      showSuccess(`App language switched to ${nextLanguage.name}.`);
      if (Platform.OS !== "web") await Haptics.selectionAsync();
    } catch {
      setError("Could not change language right now.");
    } finally {
      setIsChangingLanguage(false);
    }
  };

  const handleLogout = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await logout();
      router.replace("/(auth)/signin");
    } catch (e: any) {
      setError(e.message || "Failed to logout");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "right", "bottom", "left"]}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{completionPercent}% complete</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>Farmer identity</Text>
                <Text style={styles.heroTitle}>{trimmedName || user?.name || "Your profile"}</Text>
                <Text style={styles.heroSubtitle}>{email || "No email available"}</Text>
                <View style={styles.pillRow}>
                  <View style={styles.pill}>
                    <Feather name="map-pin" size={12} color={Colors.primaryLight} />
                    <Text style={styles.pillText}>{trimmedLocation || "Add location"}</Text>
                  </View>
                  <View style={styles.pill}>
                    <Feather name={lastSaveMode === "local" ? "wifi-off" : "cloud"} size={12} color={Colors.info} />
                    <Text style={styles.pillText}>{syncLabel}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.progressMeta}>
              <Text style={styles.sectionTitle}>Profile strength</Text>
              <Text style={styles.sectionHint}>{completionCount}/3 core fields</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completionPercent}%` }]} />
            </View>
            <Text style={styles.helper}>
              Saved name, location, and language make weather, mandi, and advisory replies more personalized.
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{conversations.length}</Text>
              <Text style={styles.statLabel}>Chats</Text>
              <Text style={styles.statHint}>{formatLastActive(lastActiveAt)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalMessages}</Text>
              <Text style={styles.statLabel}>Messages</Text>
              <Text style={styles.statHint}>Saved on device</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personalization readiness</Text>
            <Text style={styles.sectionHint}>This shows what the assistant can already use before your next query.</Text>
            {[
              [
                "cloud-rain",
                "Weather precision",
                trimmedLocation ? "Localized forecasts available." : "Add location for better local forecasts.",
              ],
              [
                "shopping-bag",
                "Market relevance",
                trimmedLocation ? "Nearby mandi context is stronger." : "Saved location helps rank closer mandis.",
              ],
              [
                "message-circle",
                "Chat continuity",
                conversations.length ? "Recent threads are ready to continue." : "Start chats to build reusable context.",
              ],
            ].map(([icon, title, description]) => (
              <View key={title} style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Feather name={icon as never} size={16} color={Colors.primary} />
                </View>
                <View style={styles.infoCopy}>
                  <Text style={styles.infoTitle}>{title}</Text>
                  <Text style={styles.infoDesc}>{description}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal details</Text>
            <Text style={styles.sectionHint}>Keep this updated so the app can tailor advice better.</Text>

            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputWrap}>
              <Feather name="user" size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  clearFeedback();
                }}
                editable={!isLoading && !isLocating && !isChangingLanguage}
              />
            </View>

            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputWrap, styles.disabledWrap]}>
              <Feather name="mail" size={18} color={Colors.textSecondary} />
              <TextInput style={[styles.input, styles.disabledText]} value={email} editable={false} />
            </View>
            <Text style={styles.helper}>Email is managed by authentication and cannot be changed here.</Text>

            <View style={styles.labelRow}>
              <Text style={styles.label}>Location</Text>
              <Pressable style={styles.inlineChip} onPress={handleUseCurrentLocation} disabled={isLoading || isLocating || isChangingLanguage}>
                <Feather name={isLocating ? "loader" : "crosshair"} size={13} color={Colors.primary} />
                <Text style={styles.inlineChipText}>{isLocating ? "Detecting..." : "Use current"}</Text>
              </Pressable>
            </View>
            <View style={styles.inputWrap}>
              <Feather name="map-pin" size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Enter your district or state"
                placeholderTextColor={Colors.textMuted}
                value={location}
                onChangeText={(text) => {
                  setLocation(text);
                  clearFeedback();
                }}
                editable={!isLoading && !isLocating && !isChangingLanguage}
              />
            </View>
            <Text style={styles.helper}>Used for local weather, mandi prices, and region-aware guidance.</Text>

            <View style={styles.chipRow}>
              {LOCATION_SUGGESTIONS.map((item) => {
                const active = trimmedLocation.toLowerCase() === item.toLowerCase();
                return (
                  <Pressable
                    key={item}
                    style={[styles.choiceChip, active && styles.choiceChipActive]}
                    onPress={() => {
                      setLocation(item);
                      clearFeedback();
                    }}
                  >
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Language & delivery</Text>
            <Text style={styles.sectionHint}>Choose the app language you prefer. You can still chat in mixed or local language.</Text>
            <View style={styles.languageGrid}>
              {languageChoices.map((item) => {
                if (!item) return null;
                const active = item.code === language.code;
                return (
                  <Pressable
                    key={item.code}
                    style={[styles.languageChip, active && styles.languageChipActive]}
                    onPress={() => handleLanguageChange(item.code)}
                    disabled={isLoading || isLocating || isChangingLanguage}
                  >
                    <Text style={[styles.languageName, active && styles.languageNameActive]}>{item.name}</Text>
                    <Text style={[styles.languageNative, active && styles.languageNameActive]}>{item.nativeName}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {error ? (
            <View style={[styles.feedbackBox, styles.errorBox]}>
              <Feather name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.feedbackText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={[styles.feedbackBox, styles.successBox]}>
              <Feather name={lastSaveMode === "local" ? "wifi-off" : "check-circle"} size={16} color={lastSaveMode === "local" ? Colors.info : Colors.success} />
              <Text style={styles.feedbackText}>{success}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Account & resilience</Text>
            <Text style={styles.sectionHint}>Your profile keeps helping the app even when connectivity is weak.</Text>

            <Pressable style={styles.actionRow} onPress={() => router.push("/change-password")} disabled={isLoading || isLocating || isChangingLanguage}>
              <View style={styles.infoIcon}>
                <Feather name="lock" size={16} color={Colors.primary} />
              </View>
              <View style={styles.infoCopy}>
                <Text style={styles.infoTitle}>Change password</Text>
                <Text style={styles.infoDesc}>Review your account security and update credentials.</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
            </Pressable>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Feather name={lastSaveMode === "local" ? "hard-drive" : "cloud"} size={16} color={Colors.info} />
              </View>
              <View style={styles.infoCopy}>
                <Text style={styles.infoTitle}>Offline-safe profile sync</Text>
                <Text style={styles.infoDesc}>
                  If the server is slow, the latest profile still remains on the device so weather, market, and advisory screens can use it.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable style={[styles.primaryButton, !canSave && styles.buttonMuted]} onPress={handleSave} disabled={!canSave}>
              <Feather name={isLoading ? "loader" : "save"} size={18} color={Colors.white} />
              <Text style={styles.primaryButtonText}>{isLoading ? "Saving..." : hasChanges ? "Save Changes" : "No Changes Yet"}</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={handleLogout} disabled={isLoading || isLocating || isChangingLanguage}>
              <Feather name="log-out" size={18} color={Colors.error} />
              <Text style={styles.secondaryButtonText}>Sign Out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  headerTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: Colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.primary + "18" },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.primaryLight },
  content: { padding: 20, paddingBottom: 36, gap: 14 },
  heroCard: { backgroundColor: Colors.surface, borderRadius: 24, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 18, gap: 14 },
  heroRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  avatarWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary + "20",
    borderWidth: 1,
    borderColor: Colors.primary + "44",
  },
  avatarText: { color: Colors.primaryLight, fontSize: 28, fontFamily: "Inter_700Bold" },
  heroCopy: { flex: 1, gap: 6 },
  heroEyebrow: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  heroTitle: { color: Colors.text, fontSize: 22, fontFamily: "Inter_700Bold" },
  heroSubtitle: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  pillText: { color: Colors.textSecondary, fontSize: 11, fontFamily: "Inter_500Medium" },
  progressMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTrack: { height: 10, borderRadius: 999, overflow: "hidden", backgroundColor: Colors.surfaceElevated },
  progressFill: { height: "100%", backgroundColor: Colors.primary, borderRadius: 999 },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 16, gap: 6 },
  statValue: { color: Colors.text, fontSize: 24, fontFamily: "Inter_700Bold" },
  statLabel: { color: Colors.text, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statHint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  card: { backgroundColor: Colors.surface, borderRadius: 24, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 18, gap: 12 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionHint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  label: { color: Colors.text, fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  disabledWrap: { opacity: 0.7 },
  input: { flex: 1, color: Colors.text, fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 14 },
  disabledText: { color: Colors.textMuted },
  helper: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  inlineChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.primary + "12" },
  inlineChipText: { color: Colors.primary, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surfaceElevated },
  choiceChipActive: { backgroundColor: Colors.primary + "18", borderColor: Colors.primary + "44" },
  choiceText: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium" },
  choiceTextActive: { color: Colors.primaryLight },
  languageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  languageChip: { width: "31%", paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surfaceElevated, gap: 4 },
  languageChipActive: { backgroundColor: Colors.primary + "18", borderColor: Colors.primary + "44" },
  languageName: { color: Colors.text, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  languageNameActive: { color: Colors.primaryLight },
  languageNative: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Inter_400Regular" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 16, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder },
  infoIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primary + "18" },
  infoCopy: { flex: 1, gap: 3 },
  infoTitle: { color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  infoDesc: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  feedbackBox: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  errorBox: { backgroundColor: "rgba(239, 68, 68, 0.12)", borderColor: "rgba(239, 68, 68, 0.24)" },
  successBox: { backgroundColor: "rgba(34, 197, 94, 0.12)", borderColor: "rgba(34, 197, 94, 0.24)" },
  feedbackText: { flex: 1, color: Colors.text, fontSize: 13, lineHeight: 18, fontFamily: "Inter_500Medium" },
  actions: { gap: 12, marginTop: 4 },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 16, backgroundColor: Colors.primary },
  buttonMuted: { opacity: 0.7 },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  secondaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.error },
  secondaryButtonText: { color: Colors.error, fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
