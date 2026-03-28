import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { AgentNode } from "@/components/AgentNode";
import { FormattedAIContent } from "@/components/FormattedAIContent";
import { AgentStep, Message } from "@/context/ChatContext";
import { useLanguage } from "@/context/LanguageContext";
import { useLocalizedStrings } from "@/hooks/useLocalizedStrings";
import {
  isSpeechPlaybackAvailable,
  speakText,
  stopSpeaking,
} from "@/services/voiceService";

type Props = {
  message: Message;
};

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const [showSteps, setShowSteps] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const { language } = useLanguage();
  const ui = useLocalizedStrings({
    listen: "Listen",
    stop: "Stop",
    agents: "agents",
    agriAdvisor: "AgriAdvisor",
  });
  const hasSteps = !!(message.agentSteps && message.agentSteps.length > 0);
  const completedSteps = message.agentSteps?.filter((s) => s.status === "completed").length ?? 0;
  const totalSteps = message.agentSteps?.length ?? 0;
  const canSpeak = !isUser && !!message.content.trim() && isSpeechPlaybackAvailable();

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (isUser) {
    return (
      <View style={styles.userContainer}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
          <Text style={styles.userTime}>{formatTime(message.timestamp)}</Text>
        </View>
      </View>
    );
  }

  const handleSpeakPress = async () => {
    if (!canSpeak) return;

    try {
      if (isSpeaking) {
        await stopSpeaking();
        setIsSpeaking(false);
        setSpeechError("");
        return;
      }

      setSpeechError("");
      setIsSpeaking(true);
      await speakText(message.content, language.code);
    } catch (error: any) {
      setSpeechError(error?.message || "Speech playback failed on this device.");
    } finally {
      setIsSpeaking(false);
    }
  };

  return (
    <View style={styles.assistantContainer}>
      <View style={styles.agentIcon}>
        <Feather name="cpu" size={16} color={Colors.primary} />
      </View>
      <View style={styles.assistantContent}>
        {hasSteps && (
          <Pressable
            style={styles.stepsToggle}
            onPress={() => setShowSteps((v) => !v)}
          >
            <View style={styles.stepsToggleInner}>
              <View style={styles.stepsProgress}>
                {message.agentSteps?.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.progressDot,
                      {
                        backgroundColor:
                          i < completedSteps ? Colors.primary : Colors.surfaceElevated,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.stepsLabel}>
                {completedSteps}/{totalSteps} {ui.agents}
              </Text>
              <Feather
                name={showSteps ? "chevron-up" : "chevron-down"}
                size={14}
                color={Colors.textSecondary}
              />
            </View>
          </Pressable>
        )}
        {showSteps && hasSteps && (
          <View style={styles.stepsContainer}>
            {message.agentSteps?.map((step: AgentStep, i: number) => (
              <AgentNode key={i} step={step} index={i} />
            ))}
          </View>
        )}
        <View style={styles.assistantBubble}>
          <View style={styles.assistantBubbleHeader}>
            <Text style={styles.assistantLabel}>{ui.agriAdvisor}</Text>
            {canSpeak ? (
              <Pressable style={styles.speakButton} onPress={handleSpeakPress}>
                <Feather
                  name={isSpeaking ? "square" : "volume-2"}
                  size={14}
                  color={isSpeaking ? Colors.primaryLight : Colors.textSecondary}
                />
                <Text style={[styles.speakButtonText, isSpeaking && styles.speakButtonTextActive]}>
                  {isSpeaking ? ui.stop : ui.listen}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <FormattedAIContent content={message.content} variant="bubble" />
          {speechError ? <Text style={styles.speechError}>{speechError}</Text> : null}
          <Text style={styles.assistantTime}>{formatTime(message.timestamp)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userContainer: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: "80%",
  },
  userText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  userTime: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    textAlign: "right",
  },
  assistantContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginVertical: 4,
    alignItems: "flex-start",
    gap: 8,
  },
  agentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + "22",
    borderWidth: 1,
    borderColor: Colors.primary + "44",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  assistantContent: {
    flex: 1,
    gap: 6,
  },
  stepsToggle: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 10,
  },
  stepsToggleInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepsProgress: {
    flexDirection: "row",
    gap: 4,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stepsLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  stepsContainer: {
    gap: 0,
  },
  assistantBubble: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: "92%",
  },
  assistantBubbleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  assistantLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  speakButton: {
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
  speakButtonText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  speakButtonTextActive: {
    color: Colors.primaryLight,
  },
  speechError: {
    color: Colors.error,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_500Medium",
    marginTop: 8,
  },
  assistantTime: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
});
