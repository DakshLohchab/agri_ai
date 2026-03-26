import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
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
import { AuthService } from "@/services/auth";

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");

    if (!currentPassword.trim()) {
      setError("Current password is required");
      return;
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setError("Please fill in all fields");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from current password");
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await AuthService.changePassword(currentPassword, newPassword);
      setSuccess("Password changed successfully!");
      setTimeout(() => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        router.back();
      }, 2000);
    } catch (e: any) {
      setError(e.message || "Failed to change password");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordField = ({
    label,
    value,
    onChangeText,
    show,
    onToggleShow,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    show: boolean;
    onToggleShow: () => void;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <Feather
          name="lock"
          size={18}
          color={Colors.textSecondary}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            setError("");
            setSuccess("");
          }}
          secureTextEntry={!show}
          editable={!isLoading}
          maxLength={128}
        />
        <Pressable onPress={onToggleShow} disabled={isLoading}>
          <Feather
            name={show ? "eye" : "eye-off"}
            size={18}
            color={Colors.textSecondary}
            style={{ paddingHorizontal: 8 }}
          />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Change Password</Text>
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
          <Text style={styles.description}>
            Enter your current password and choose a new password. Make sure your password is at least 6 characters long and contains a mix of letters and numbers.
          </Text>

          <View style={styles.formSection}>
            <PasswordField
              label="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              show={showCurrentPassword}
              onToggleShow={() => setShowCurrentPassword(!showCurrentPassword)}
            />

            <PasswordField
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              show={showNewPassword}
              onToggleShow={() => setShowNewPassword(!showNewPassword)}
            />

            <PasswordField
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              show={showConfirmPassword}
              onToggleShow={() => setShowConfirmPassword(!showConfirmPassword)}
            />
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

          {/* Password Requirements */}
          <View style={styles.requirementsBox}>
            <Text style={styles.requirementsTitle}>Password Requirements</Text>
            <View style={styles.requirementItem}>
              <Feather name="check-circle" size={14} color={Colors.success} />
              <Text style={styles.requirementText}>At least 6 characters</Text>
            </View>
            <View style={styles.requirementItem}>
              <Feather name="check-circle" size={14} color={Colors.success} />
              <Text style={styles.requirementText}>Mix of letters and numbers</Text>
            </View>
            <View style={styles.requirementItem}>
              <Feather name="check-circle" size={14} color={Colors.success} />
              <Text style={styles.requirementText}>
                Different from your current password
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            { opacity: pressed || isLoading ? 0.8 : 1 },
          ]}
          onPress={handleChangePassword}
          disabled={isLoading}
        >
          <Text style={styles.submitBtnText}>
            {isLoading ? "Changing..." : "Change Password"}
          </Text>
        </Pressable>
      </View>
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
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
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
  inputIcon: {
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
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
  requirementsBox: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  requirementsTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    flex: 1,
    paddingTop: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  submitBtn: {
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
  submitBtnText: {
    color: Colors.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
