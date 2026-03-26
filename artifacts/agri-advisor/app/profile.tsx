import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import AuthService from "@/services/auth";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setError("");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await AuthService.updateProfile(name, location);
      setSuccess("Profile updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to update profile");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
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

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
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
          {/* Profile Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Feather name="user" size={48} color={Colors.primary} />
              </View>
              <Pressable style={styles.editAvatarBtn}>
                <Feather name="camera" size={16} color={Colors.white} />
              </Pressable>
            </View>
            <Text style={styles.avatarLabel}>Add Profile Photo</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Feather
                  name="user"
                  size={18}
                  color={Colors.textSecondary}
                  style={styles.inputIcon}
                />
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
                  editable={!isLoading}
                  maxLength={100}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputContainer, styles.inputDisabled]}>
                <Feather
                  name="mail"
                  size={18}
                  color={Colors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.inputText]}
                  value={email}
                  editable={false}
                />
              </View>
              <Text style={styles.helpText}>Email cannot be changed</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Location</Text>
              <View style={styles.inputContainer}>
                <Feather
                  name="map-pin"
                  size={18}
                  color={Colors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your location"
                  placeholderTextColor={Colors.textMuted}
                  value={location}
                  onChangeText={(text) => {
                    setLocation(text);
                    setError("");
                    setSuccess("");
                  }}
                  editable={!isLoading}
                  maxLength={100}
                />
              </View>
            </View>
          </View>

          {/* Status Messages */}
          {error && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.successBox}>
              <Feather name="check-circle" size={16} color={Colors.success} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          {/* Account Section */}
          <View style={styles.sectionSpacer} />
          <Text style={styles.sectionTitle}>Account</Text>

          <Pressable
            style={({ pressed }) => [
              styles.changePasswordBtn,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/change-password");
            }}
            disabled={isLoading}
          >
            <View style={styles.btnContent}>
              <Feather name="lock" size={18} color={Colors.primary} />
              <Text style={styles.btnText}>Change Password</Text>
            </View>
            <Feather name="arrow-right" size={18} color={Colors.textSecondary} />
          </Pressable>

          {/* Actions */}
          <View style={styles.actionButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { opacity: pressed || isLoading ? 0.8 : 1 },
              ]}
              onPress={handleSave}
              disabled={isLoading}
            >
              <Text style={styles.saveBtnText}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.logoutBtn,
                { opacity: pressed || isLoading ? 0.8 : 1 },
              ]}
              onPress={handleLogout}
              disabled={isLoading}
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
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
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 32,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatarBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.background,
  },
  avatarLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  formSection: {
    gap: 20,
    marginBottom: 24,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  inputDisabled: {
    backgroundColor: Colors.surfaceElevated,
    opacity: 0.6,
  },
  inputIcon: {
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  inputText: {
    color: Colors.textMuted,
  },
  helpText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginLeft: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
    marginBottom: 16,
  },
  errorText: {
    color: Colors.error,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    flex: 1,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#dcfce7",
    marginBottom: 16,
  },
  successText: {
    color: Colors.success,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    flex: 1,
  },
  sectionSpacer: {
    height: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 12,
    marginLeft: 4,
  },
  changePasswordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 16,
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  actionButtons: {
    gap: 12,
    marginTop: 24,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: {
    color: Colors.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
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
