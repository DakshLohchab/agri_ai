import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { Colors } from "@/constants/colors";

type Props = {
  variant?: "default" | "warm" | "cool";
};

export function AppBackdrop({ variant = "default" }: Props) {
  const palette =
    variant === "warm"
      ? {
          primary: Colors.secondary + "16",
          secondary: Colors.primary + "12",
          accent: Colors.warning + "10",
        }
      : variant === "cool"
        ? {
            primary: Colors.info + "18",
            secondary: Colors.webSearch + "14",
            accent: Colors.primary + "10",
          }
        : {
            primary: Colors.primary + "16",
            secondary: Colors.weather + "14",
            accent: Colors.secondary + "10",
          };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.baseGlow} />
      <View style={[styles.orb, styles.orbTop, { backgroundColor: palette.primary }]} />
      <View style={[styles.orb, styles.orbMid, { backgroundColor: palette.secondary }]} />
      <View style={[styles.orb, styles.orbBottom, { backgroundColor: palette.accent }]} />
      <View style={styles.grid} />
      <View style={styles.noiseBand} />
    </View>
  );
}

const styles = StyleSheet.create({
  baseGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
  },
  orbTop: {
    top: -120,
    right: -30,
    width: 320,
    height: 320,
  },
  orbMid: {
    top: "28%",
    left: -110,
    width: 260,
    height: 260,
  },
  orbBottom: {
    right: "10%",
    bottom: -120,
    width: 300,
    height: 300,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: Platform.OS === "web" ? 0.18 : 0.1,
    backgroundColor: "transparent",
    borderColor: Colors.surfaceBorder,
    borderWidth: 0,
  },
  noiseBand: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 96,
    height: 1,
    backgroundColor: Colors.surfaceBorder + "55",
  },
});
