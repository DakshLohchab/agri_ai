import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { AgentStep } from "@/context/ChatContext";

type Props = {
  step: AgentStep;
  index: number;
};

const NODE_COLORS: Record<string, string> = {
  Guardrails: Colors.guardrails,
  Intent: Colors.intent,
  "Web Search": Colors.webSearch,
  Weather: Colors.weather,
  Market: Colors.market,
  Synthesis: Colors.synthesis,
};

const NODE_ICONS: Record<string, string> = {
  Guardrails: "shield",
  Intent: "zap",
  "Web Search": "globe",
  Weather: "cloud",
  Market: "trending-up",
  Synthesis: "cpu",
};

export function AgentNode({ step, index }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (step.status === "running") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [step.status]);

  const color = NODE_COLORS[step.node] || Colors.primary;
  const icon = (NODE_ICONS[step.node] || "circle") as keyof typeof Feather.glyphMap;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.iconContainer,
          {
            backgroundColor: color + "22",
            borderColor: step.status === "running" ? color : color + "55",
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {step.status === "completed" ? (
          <Feather name="check-circle" size={20} color={color} />
        ) : step.status === "error" ? (
          <Feather name="x-circle" size={20} color={Colors.error} />
        ) : step.status === "running" ? (
          <Feather name={icon} size={20} color={color} />
        ) : (
          <Feather name={icon} size={20} color={Colors.textMuted} />
        )}
      </Animated.View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.nodeName, { color: step.status === "pending" ? Colors.textMuted : color }]}>
            {step.node}
          </Text>
          {step.duration !== undefined && (
            <Text style={styles.duration}>{step.duration}ms</Text>
          )}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  step.status === "completed"
                    ? Colors.success + "22"
                    : step.status === "error"
                    ? Colors.error + "22"
                    : step.status === "running"
                    ? color + "22"
                    : Colors.surfaceElevated,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    step.status === "completed"
                      ? Colors.success
                      : step.status === "error"
                      ? Colors.error
                      : step.status === "running"
                      ? color
                      : Colors.textMuted,
                },
              ]}
            >
              {step.status}
            </Text>
          </View>
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {step.message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  nodeName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  duration: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    marginLeft: "auto",
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
  message: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
