import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

export default function IndexScreen() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/welcome");
      }
    }
  }, [user, isLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
