// app/chat/[id].tsx

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { useChat, Message, AgentStep } from "@/context/ChatContext";
import { runAgentQuery } from "@/services/langgraph";
import { useLanguage } from "@/context/LanguageContext";
import { getTranslations } from "@/constants/translations";
import {
  cancelRecording,
  requestMicrophonePermission,
  startRecording,
  stopRecordingAndTranscribe,
} from "@/services/voiceService";

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_COLORS = [
  Colors.guardrails,
  Colors.intent,
  Colors.webSearch,
  Colors.weather,
  Colors.market,
  Colors.synthesis,
];

// Voice state machine
type VoiceState = "idle" | "recording" | "transcribing" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { id, preQuery } = useLocalSearchParams<{
    id: string;
    preQuery?: string;
  }>();
  const { getConversation, addMessage, updateMessage } = useChat();
  const { language } = useLanguage();
  const t = getTranslations(language.code);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isWide = width >= 768;

  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState("");

  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pulsing animation for the recording mic button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const conversation = getConversation(id);
  const messages = conversation?.messages ?? [];

  const botPad = isWeb ? 24 : insets.bottom;
  const topPad = isWeb ? 0 : insets.top;
  const maxContentWidth = isWeb && isWide ? 800 : undefined;

  // Suggestions built from translations
  const SUGGESTIONS = [
    { q: t.suggestionRain,       icon: "cloud-rain" },
    { q: t.suggestionWheat,      icon: "trending-up" },
    { q: t.suggestionPest,       icon: "alert-triangle" },
    { q: t.suggestionPmKisan,    icon: "file-text" },
    { q: t.suggestionSoybean,    icon: "package" },
    { q: t.suggestionFertilizer, icon: "droplet" },
  ];

  // ── Pulse animation lifecycle ──────────────────────────────────────────────

  useEffect(() => {
    if (voiceState === "recording") {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [voiceState]);

  // ── Auto-clear error strip after 4 s ──────────────────────────────────────

  const showVoiceError = useCallback((msg: string) => {
    setVoiceError(msg);
    setVoiceState("error");
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setVoiceState("idle");
      setVoiceError("");
    }, 4000);
  }, []);

  // Cleanup timer on unmount
  useEffect(
    () => () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      cancelRecording().catch(() => {});
    },
    []
  );

  // ── Pre-filled query from home screen ─────────────────────────────────────

  useEffect(() => {
    if (preQuery && messages.length === 0) {
      sendMessage(preQuery);
    }
  }, []);

  // ── Chat send ──────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      setInputText("");
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const userMsg: Message = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      addMessage(id, userMsg);
      setIsTyping(true);

      const aiMsgId =
        (Date.now() + 1).toString() + Math.random().toString(36).substr(2, 5);
      const aiMsg: Message = {
        id: aiMsgId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        agentSteps: [],
      };
      addMessage(id, aiMsg);

      try {
        await runAgentQuery(
          trimmed,
          (steps: AgentStep[]) => {
            updateMessage(id, aiMsgId, { agentSteps: steps });
          },
          (response: string, steps: AgentStep[]) => {
            updateMessage(id, aiMsgId, { content: response, agentSteps: steps });
            setIsTyping(false);
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        );
      } catch {
        updateMessage(id, aiMsgId, {
          content: t.chatErrorMessage,
          agentSteps: [],
        });
        setIsTyping(false);
      }
    },
    [id, isTyping, addMessage, updateMessage, t]
  );

  // ── Voice button handler ───────────────────────────────────────────────────

  const handleMicPress = useCallback(async () => {
    if (voiceState === "transcribing") return;

    if (voiceState === "recording") {
      setVoiceState("transcribing");
      try {
        const text = await stopRecordingAndTranscribe(language.whisperCode);
        if (text) {
          setInputText((prev) => (prev ? `${prev} ${text}` : text));
        }
        setVoiceState("idle");
      } catch (err: any) {
        showVoiceError(err?.message ?? "Transcription failed. Please try again.");
      }
      return;
    }

    if (voiceState === "idle" || voiceState === "error") {
      const granted = await requestMicrophonePermission();
      if (!granted) {
        showVoiceError("Microphone permission denied.");
        return;
      }
      try {
        await startRecording();
        setVoiceState("recording");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (err: any) {
        showVoiceError(err?.message ?? "Could not start recording.");
      }
    }
  }, [voiceState, language.whisperCode, showVoiceError]);

  const handleCancelRecording = useCallback(async () => {
    await cancelRecording();
    setVoiceState("idle");
    setVoiceError("");
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  const reversedMessages = [...messages].reverse();

  const micIcon =
    voiceState === "recording"
      ? "mic-off"
      : voiceState === "transcribing"
      ? "loader"
      : "mic";

  const micBgColor =
    voiceState === "recording"
      ? "#FF3B3022"
      : Colors.surfaceElevated;

  const micIconColor =
    voiceState === "recording"
      ? "#FF3B30"
      : voiceState === "transcribing"
      ? Colors.textMuted
      : Colors.textSecondary;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={[styles.header, isWeb && isWide && styles.headerWide]}>
        <View
          style={[
            styles.headerInner,
            maxContentWidth
              ? { maxWidth: maxContentWidth, alignSelf: "center", width: "100%" }
              : null,
          ]}
        >
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={Colors.text} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {conversation?.title ?? "New Query"}
            </Text>
            <View style={styles.headerBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.headerSubtitle}>{t.chatHeaderSubtitle}</Text>
            </View>
          </View>
          <Pressable
            style={styles.agentsBtn}
            onPress={() => router.push("/(tabs)/agents")}
          >
            <Feather name="cpu" size={18} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={topPad + 60}
      >
        {messages.length === 0 ? (
          /* ── Empty state ── */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.emptyScroll,
              isWeb && isWide && { paddingHorizontal: 40 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.emptyContent,
                maxContentWidth
                  ? { maxWidth: maxContentWidth, alignSelf: "center", width: "100%" }
                  : null,
              ]}
            >
              <View style={styles.emptyChatIcon}>
                <Feather name="cpu" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyChatTitle}>{t.chatEmptyTitle}</Text>
              <Text style={styles.emptyChatDesc}>{t.chatEmptyDesc}</Text>

              {/* Pipeline steps */}
              <View style={styles.pipelineRow}>
                {PIPELINE_COLORS.map((color, i) => (
                  <React.Fragment key={i}>
                    <View style={[styles.pipelineStep, { backgroundColor: color }]}>
                      <Text style={styles.pipelineNumber}>{i + 1}</Text>
                    </View>
                    {i < PIPELINE_COLORS.length - 1 && (
                      <View style={styles.pipelineConnector} />
                    )}
                  </React.Fragment>
                ))}
              </View>

              {/* Suggestion chips */}
              <View style={[styles.suggestionGrid, isWide && styles.suggestionGridWide]}>
                {SUGGESTIONS.map(({ q, icon }) => (
                  <Pressable
                    key={q}
                    style={[styles.suggestionChip, isWide && styles.suggestionChipWide]}
                    onPress={() => sendMessage(q)}
                  >
                    <Feather name={icon as any} size={15} color={Colors.primary} />
                    <Text style={styles.suggestionText}>{q}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Feature pills — kept in English as they are brand/product terms */}
              <View style={styles.featureRow}>
                {[
                  { label: "Live weather",     icon: "cloud" },
                  { label: "AGMARKNET prices", icon: "trending-up" },
                  { label: "Pest diagnosis",   icon: "alert-triangle" },
                  { label: "Gov schemes",      icon: "shield" },
                ].map((f) => (
                  <View key={f.label} style={styles.featurePill}>
                    <Feather name={f.icon as any} size={11} color={Colors.textMuted} />
                    <Text style={styles.featurePillText}>{f.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        ) : (
          /* ── Message list ── */
          <FlatList
            ref={flatRef}
            data={reversedMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              if (item.role === "assistant" && item.content === "" && isTyping) {
                return <TypingIndicator />;
              }
              if (item.content === "" && item.role === "assistant") return null;
              return (
                <View
                  style={
                    maxContentWidth
                      ? { maxWidth: maxContentWidth, alignSelf: "center", width: "100%" }
                      : undefined
                  }
                >
                  <MessageBubble message={item} />
                </View>
              );
            }}
            inverted
            contentContainerStyle={[
              styles.messageList,
              isWeb && isWide && { paddingHorizontal: 40 },
            ]}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              isTyping ? (
                <View
                  style={
                    maxContentWidth
                      ? { maxWidth: maxContentWidth, alignSelf: "center", width: "100%" }
                      : undefined
                  }
                >
                  <TypingIndicator />
                </View>
              ) : null
            }
          />
        )}

        {/* ── Voice status strip ── */}
        {voiceState !== "idle" && (
          <View
            style={[
              styles.voiceStrip,
              voiceState === "recording" && styles.voiceStripRecording,
              voiceState === "error"     && styles.voiceStripError,
            ]}
          >
            {voiceState === "recording" && (
              <>
                <View style={styles.voiceRedDot} />
                <Text style={styles.voiceStripText} numberOfLines={1}>
                  {t.voiceRecording} ({language.nativeName})
                </Text>
                <Pressable style={styles.voiceCancelBtn} onPress={handleCancelRecording}>
                  <Text style={styles.voiceCancelText}>{t.voiceCancel}</Text>
                </Pressable>
              </>
            )}
            {voiceState === "transcribing" && (
              <>
                <Feather name="loader" size={14} color={Colors.primary} />
                <Text style={styles.voiceStripText}>{t.voiceTranscribing}</Text>
              </>
            )}
            {voiceState === "error" && (
              <>
                <Feather name="alert-circle" size={14} color={Colors.error} />
                <Text style={[styles.voiceStripText, { color: Colors.error }]} numberOfLines={2}>
                  {voiceError}
                </Text>
              </>
            )}
          </View>
        )}

        {/* ── Input bar ── */}
        <View style={[styles.inputBarWrap, { paddingBottom: botPad + 8 }]}>
          <View
            style={[
              styles.inputBar,
              isWeb && isWide && {
                maxWidth: maxContentWidth,
                alignSelf: "center",
                width: "100%",
              },
            ]}
          >
            {/* Mic button — mobile only */}
            {!isWeb && (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Pressable
                  style={[styles.micBtn, { backgroundColor: micBgColor }]}
                  onPress={handleMicPress}
                  disabled={isTyping}
                >
                  <Feather name={micIcon as any} size={18} color={micIconColor} />
                </Pressable>
              </Animated.View>
            )}

            <TextInput
              ref={inputRef}
              style={[styles.input, isWeb && ({ outlineWidth: 0 } as any)]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t.inputPlaceholder}
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
              onSubmitEditing={
                Platform.OS === "web" ? undefined : () => sendMessage(inputText)
              }
              returnKeyType={Platform.OS === "web" ? "default" : "send"}
              editable={!isTyping && voiceState !== "transcribing"}
              onKeyPress={
                Platform.OS === "web"
                  ? (e: any) => {
                      if (e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
                        e.preventDefault?.();
                        sendMessage(inputText);
                      }
                    }
                  : undefined
              }
            />

            {/* Send button */}
            <Pressable
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor:
                    inputText.trim() && !isTyping
                      ? Colors.primary
                      : Colors.surfaceElevated,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isTyping}
            >
              <Feather
                name={isTyping ? "loader" : "send"}
                size={18}
                color={inputText.trim() && !isTyping ? Colors.white : Colors.textMuted}
              />
            </Pressable>
          </View>

          {/* Web: keyboard hint / Mobile: voice language hint */}
          {isWeb ? (
            <Text style={styles.webHint}>{t.webHint}</Text>
          ) : (
            <Text style={styles.voiceHint}>
              {t.voiceInputHint}: {language.nativeName} ({language.name})
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + "22",
    backgroundColor: Colors.primary + "08",
  },
  headerWide: { paddingHorizontal: 24 },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  headerInfo: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  headerSubtitle: { fontSize: 12, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  agentsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + "22",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.primary + "44",
  },
  emptyScroll: { flexGrow: 1, justifyContent: "center", paddingVertical: 32, paddingHorizontal: 24 },
  emptyContent: { alignItems: "center", gap: 20 },
  emptyChatIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + "22",
    borderWidth: 2,
    borderColor: Colors.primary + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyChatTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  emptyChatDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
    maxWidth: 360,
  },
  pipelineRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  pipelineStep: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  pipelineNumber: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.white },
  pipelineConnector: { width: 20, height: 2, backgroundColor: Colors.surfaceBorder },
  suggestionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  suggestionGridWide: { maxWidth: 680 },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.primary + "44",
  },
  suggestionChipWide: { paddingHorizontal: 18 },
  suggestionText: { fontSize: 13, color: Colors.primary, fontFamily: "Inter_600SemiBold" },
  featureRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  featurePillText: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  messageList: { paddingTop: 12, paddingBottom: 12, paddingHorizontal: 16 },
  voiceStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  voiceStripRecording: { backgroundColor: "#FF3B3011", borderTopColor: "#FF3B3033" },
  voiceStripError: { backgroundColor: Colors.error + "11", borderTopColor: Colors.error + "33" },
  voiceRedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF3B30" },
  voiceStripText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  voiceCancelBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: Colors.surfaceBorder },
  voiceCancelText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.text },
  inputBarWrap: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6,
  },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  micBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    maxHeight: 120,
    minHeight: 48,
  },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  webHint: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },
  voiceHint: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },
});