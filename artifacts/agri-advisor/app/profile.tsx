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
import { useAuth } from "@/context/AuthContext";

const LOCATION_SUGGESTIONS = [
  "Punjab",
  "Haryana",
  "Delhi",
  "Maharashtra",
  "Karnataka",
  "Tamil Nadu",
] as const;

function getInitials(name?: string, email?: string) {
  const source = (name || email || "Farmer").trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export default function ProfileScreen() {
  const { user, logout, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [location, setLocation] = useState(user?.location || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
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
  const userName = user?.name?.trim() || "";
  const userLocation = user?.location?.trim() || "";
  const initials = useMemo(
    () => getInitials(trimmedName || user?.name, email),
    [trimmedName, user?.name, email]
  );
  const profileCompletion = [trimmedName, email, trimmedLocation].filter(Boolean).length;
  const completionPercent = Math.round((profileCompletion / 3) * 100);
  const hasChanges = trimmedName !== userName || trimmedLocation !== userLocation;
  const canSave = !!trimmedName && hasChanges && !isLoading && !isLocating;

  const saveSuccessMessage = (savedRemotely: boolean) => {
    setLastSaveMode(savedRemotely ? "remote" : "local");
    setSuccess(
      savedRemotely
        ? "Profile updated successfully and synced to your account."
        : "Profile saved locally. Server sync is pending."
    );
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleSave = async () => {
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    setError("");
    setSuccess("");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await updateProfile(trimmedName, trimmedLocation);
      saveSuccessMessage(result.savedRemotely);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      setError(e.message || "Failed to update profile");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setError("");
    setSuccess("");
    setIsLocating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const permission = await ExpoLocation.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Location permission was not granted.");
      }

      const coords = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      const places = await ExpoLocation.reverseGeocodeAsync(coords.coords);
      const bestPlace = places[0];
      const nextLocation = [bestPlace?.city, bestPlace?.region, bestPlace?.country]
        .filter(Boolean)
        .slice(0, 2)
        .join(", ");

      if (!nextLocation) {
        throw new Error("Could not detect a readable location.");
      }

      setLocation(nextLocation);
      setSuccess("Current location detected. Review it and save when ready.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.message || "Unable to detect current location.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLocating(false);
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await logout();
      router.replace("/(auth)/signin");
    } catch (e: any) {
      setError(e.message || "Failed to logout");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const syncLabel =
    lastSaveMode === "remote"
      ? "Cloud sync healthy"
      : lastSaveMode === "local"
        ? "Offline-safe local save"
        : "Ready to sync";

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>{completionPercent}% complete</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.avatarShell}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroTitle}>{trimmedName || user?.name || "Your profile"}</Text>
                <Text style={styles.heroSubtitle}>{email || "No email available"}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaPill}>
                    <Feather name="map-pin" size={12} color={Colors.primaryLight} />
                    <Text style={styles.metaPillText}>{trimmedLocation || "Add location"}</Text>
                  </View>
                  <View style={styles.metaPill}>
                    <Feather
                      name={lastSaveMode === "local" ? "wifi-off" : "cloud"}
                      size={12}
                      color={Colors.info}
                    />
                    <Text style={styles.metaPillText}>{syncLabel}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Profile strength</Text>
                <Text style={styles.progressValue}>{profileCompletion}/3 fields</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${completionPercent}%` }]} />
              </View>
              <Text style={styles.progressHint}>
                A saved name and location help personalize weather, mandi, and advisory responses.
              </Text>
            </View>
          </View>

          <View style={styles.quickStatsRow}>
            <View style={styles.quickCard}>
              <Feather name="cpu" size={16} color={Colors.intent} />
              <Text style={styles.quickValue}>{trimmedLocation ? "Personalized" : "Generic"}</Text>
              <Text style={styles.quickLabel}>AI context</Text>
            </View>
            <View style={styles.quickCard}>
              <Feather name="save" size={16} color={Colors.synthesis} />
              <Text style={styles.quickValue}>{hasChanges ? "Unsaved" : "Saved"}</Text>
              <Text style={styles.quickLabel}>Changes</Text>
            </View>
            <View style={styles.quickCard}>
              <Feather name="shield" size={16} color={Colors.market} />
              <Text style={styles.quickValue}>{lastSaveMode === "local" ? "Protected" : "Ready"}</Text>
              <Text style={styles.quickLabel}>Fallback</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Personal details</Text>
              <Text style={styles.sectionDesc}>
                Keep this updated so the app can tailor advice better.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Feather name="user" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setError("");
                    setSuccess("");
                  }}
                  editable={!isLoading && !isLocating}
                  maxLength={100}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputContainer, styles.inputDisabled]}>
                <Feather name="mail" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput style={[styles.input, styles.inputText]} value={email} editable={false} />
              </View>
              <Text style={styles.helpText}>
                Email is managed by authentication and cannot be changed here.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Location</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.inlineAction,
                    { opacity: pressed || isLocating ? 0.8 : 1 },
                  ]}
                  onPress={handleUseCurrentLocation}
                  disabled={isLoading || isLocating}
                >
                  <Feather
                    name={isLocating ? "loader" : "crosshair"}
                    size={13}
                    color={Colors.primary}
                  />
                  <Text style={styles.inlineActionText}>
                    {isLocating ? "Detecting..." : "Use current"}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.inputContainer}>
                <Feather name="map-pin" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your district or state"
                  placeholderTextColor={Colors.textMuted}
                  value={location}
                  onChangeText={(text) => {
                    setLocation(text);
                    setError("");
                    setSuccess("");
                  }}
                  editable={!isLoading && !isLocating}
                  maxLength={100}
                />
              </View>
              <Text style={styles.helpText}>
                Your saved location is used for local weather, mandi prices, and region-aware guidance.
              </Text>
              <View style={styles.suggestionRow}>
                {LOCATION_SUGGESTIONS.map((item) => {
                  const active = trimmedLocation.toLowerCase() === item.toLowerCase();
                  return (
                    <Pressable
                      key={item}
                      style={[styles.suggestionChip, active && styles.suggestionChipActive]}
                      onPress={() => {
                        setLocation(item);
                        setError("");
                        setSuccess("");
                      }}
                      disabled={isLoading || isLocating}
                    >
                      <Text style={[styles.suggestionChipText, active && styles.suggestionChipTextActive]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={styles.successBox}>
              <Feather
                name={lastSaveMode === "local" ? "wifi-off" : "check-circle"}
                size={16}
                color={lastSaveMode === "local" ? Colors.info : Colors.success}
              />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          <View style={styles.accountCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Account & security</Text>
              <Text style={styles.sectionDesc}>
                Review core account controls and keep your login secure.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.secondaryAction, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/change-password");
              }}
              disabled={isLoading || isLocating}
            >
              <View style={styles.secondaryActionLeft}>
                <View style={[styles.iconBadge, { backgroundColor: Colors.primary + "18" }]}>
                  <Feather name="lock" size={18} color={Colors.primary} />
                </View>
                <View style={styles.secondaryActionTextWrap}>
                  <Text style={styles.secondaryActionTitle}>Change password</Text>
                  <Text style={styles.secondaryActionDesc}>
                    Update your password and keep your account protected.
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
            </Pressable>

            <View style={styles.syncCard}>
              <View style={[styles.iconBadge, { backgroundColor: Colors.info + "18" }]}>
                <Feather
                  name={lastSaveMode === "local" ? "hard-drive" : "cloud"}
                  size={18}
                  color={Colors.info}
                />
              </View>
              <View style={styles.secondaryActionTextWrap}>
                <Text style={styles.secondaryActionTitle}>Sync behavior</Text>
                <Text style={styles.secondaryActionDesc}>
                  Profile updates are saved to the server when available and fall back to local storage if connectivity is weak.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                (!canSave || pressed) && styles.saveBtnMuted,
              ]}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Feather name={isLoading ? "loader" : "save"} size={18} color={Colors.white} />
              <Text style={styles.saveBtnText}>
                {isLoading ? "Saving..." : hasChanges ? "Save Changes" : "No Changes Yet"}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.logoutBtn,
                { opacity: pressed || isLoading || isLocating ? 0.8 : 1 },
              ]}
              onPress={handleLogout}
              disabled={isLoading || isLocating}
            >
              <Feather name="log-out" size={18} color={Colors.error} />
              <Text style={styles.logoutBtnText}>Sign Out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  headerTitle: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.primary + "18",
    minWidth: 86,
    alignItems: "center",
  },
  headerPillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primaryLight,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 36,
    gap: 14,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 18,
    gap: 18,
  },
  heroTop: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  avatarShell: {
    padding: 3,
    borderRadius: 999,
    backgroundColor: Colors.primary + "18",
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primary + "20",
    borderWidth: 1,
    borderColor: Colors.primary + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: Colors.primaryLight,
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  heroTextWrap: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontSize: 21,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  metaPill: {
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
  metaPillText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  progressSection: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  progressValue: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.surfaceElevated,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  progressHint: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  quickStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 6,
  },
  quickValue: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  quickLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 18,
    gap: 18,
  },
  accountCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 18,
    gap: 16,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  sectionDesc: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  fieldGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginLeft: 2,
  },
  inlineAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.primary + "12",
  },
  inlineActionText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 14,
    minHeight: 52,
    gap: 10,
  },
  inputDisabled: {
    opacity: 0.7,
  },
  inputIcon: {
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    paddingVertical: 14,
  },
  inputText: {
    color: Colors.textMuted,
  },
  helpText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginLeft: 2,
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  suggestionChipActive: {
    backgroundColor: Colors.primary + "18",
    borderColor: Colors.primary + "44",
  },
  suggestionChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  suggestionChipTextActive: {
    color: Colors.primaryLight,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.24)",
  },
  errorText: {
    color: "#FCA5A5",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.24)",
  },
  successText: {
    color: "#BBF7D0",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  secondaryActionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  secondaryActionTextWrap: {
    flex: 1,
    gap: 3,
  },
  secondaryActionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  secondaryActionDesc: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  syncCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  actionButtons: {
    gap: 12,
    marginTop: 4,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  saveBtnMuted: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: Colors.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  logoutBtnText: {
    color: Colors.error,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
