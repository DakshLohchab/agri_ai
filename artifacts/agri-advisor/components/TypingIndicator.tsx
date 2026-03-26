import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Colors } from "@/constants/colors";

export function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  const animateDot = (dot: Animated.Value, delay: number) =>
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(800 - delay),
      ])
    );

  useEffect(() => {
    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 200);
    const a3 = animateDot(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  const dotStyle = (dot: Animated.Value) => ({
    transform: [
      {
        translateY: dot.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        }),
      },
    ],
    opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
  });

  return (
    <View style={styles.container}>
      <View style={styles.agentIcon} />
      <View style={styles.bubble}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[styles.dot, dotStyle(dot)]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginVertical: 4,
    alignItems: "flex-end",
    gap: 8,
  },
  agentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + "22",
    borderWidth: 1,
    borderColor: Colors.primary + "44",
  },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
});
