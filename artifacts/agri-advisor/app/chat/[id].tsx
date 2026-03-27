import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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

const PIPELINE_COLORS = [
  Colors.guardrails,
  Colors.intent,
  Colors.webSearch,
  Colors.weather,
  Colors.market,
  Colors.synthesis,
];

const SUGGESTIONS = [
  { q: "Rain this week in Punjab?", icon: "cloud-rain" },
  { q: "Wheat mandi price today", icon: "trending-up" },
  { q: "Pest alert for cotton", icon: "alert-triangle" },
  { q: "PM-KISAN eligibility", icon: "file-text" },
  { q: "Soybean price in MP", icon: "package" },
  { q: "Fertilizer dosage for rice", icon: "droplet" },
];

export default function ChatScreen() {
  const { id, preQuery } = useLocalSearchParams<{ id: string; preQuery?: string }>();
  const { getConversation, addMessage, updateMessage } = useChat();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isWide = width >= 768;

  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const conversation = getConversation(id);
  const messages = conversation?.messages ?? [];

  const botPad = isWeb ? 24 : insets.bottom;
  const topPad = isWeb ? 0 : insets.top;

  useEffect(() => {
    if (preQuery && messages.length === 0) {
      sendMessage(preQuery);
    }
  }, []);

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

      const aiMsgId = (Date.now() + 1).toString() + Math.random().toString(36).substr(2, 5);
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
      } catch (err) {
        updateMessage(id, aiMsgId, {
          content: "Sorry, something went wrong processing your query. Please try again.",
          agentSteps: [],
        });
        setIsTyping(false);
      }
    },
    [id, isTyping, addMessage, updateMessage]
  );

  const reversedMessages = [...messages].reverse();
  const maxContentWidth = isWeb && isWide ? 800 : undefined;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={[styles.header, isWeb && isWide && styles.headerWide]}>
        <View style={[styles.headerInner, maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: "center", width: "100%" } : null]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={Colors.text} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {conversation?.title ?? "New Query"}
            </Text>
            <View style={styles.headerBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.headerSubtitle}>6-agent LangGraph pipeline</Text>
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
            contentContainerStyle={[styles.emptyScroll, isWeb && isWide && { paddingHorizontal: 40 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.emptyContent, maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: "center", width: "100%" } : null]}>
              <View style={styles.emptyChatIcon}>
                <Feather name="cpu" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyChatTitle}>AgriAdvisor AI</Text>
              <Text style={styles.emptyChatDesc}>
                Powered by 6 specialized AI agents — Llama-3-8B, Mistral-7B, Qwen-14B, and Llama-3-70B — with live weather and market data
              </Text>

              {/* Pipeline nodes */}
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

              {/* Suggestion chips — wrap on wide screens */}
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

              {/* Feature pills */}
              <View style={styles.featureRow}>
                {[
                  { label: "Live weather", icon: "cloud" },
                  { label: "AGMARKNET prices", icon: "trending-up" },
                  { label: "Pest diagnosis", icon: "alert-triangle" },
                  { label: "Gov schemes", icon: "shield" },
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
                <View style={maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: "center", width: "100%" } : undefined}>
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
            ListHeaderComponent={isTyping ? (
              <View style={maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: "center", width: "100%" } : undefined}>
                <TypingIndicator />
              </View>
            ) : null}
          />
        )}

        {/* ── Input bar ── */}
        <View style={[styles.inputBarWrap, { paddingBottom: botPad + 8 }]}>
          <View style={[
            styles.inputBar,
            isWeb && isWide && { maxWidth: maxContentWidth, alignSelf: "center", width: "100%" },
          ]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, isWeb && { outlineWidth: 0 } as any]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about crops, weather, mandi prices..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
              onSubmitEditing={Platform.OS === "web" ? undefined : () => sendMessage(inputText)}
              returnKeyType={Platform.OS === "web" ? "default" : "send"}
              editable={!isTyping}
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
            <Pressable
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor:
                    inputText.trim() && !isTyping ? Colors.primary : Colors.surfaceElevated,
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
          {isWeb && (
            <Text style={styles.webHint}>Press Enter to send · Shift+Enter for new line</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + "22",
    backgroundColor: Colors.primary + "08",
  },
  headerWide: {
    paddingHorizontal: 24,
  },
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
  pipelineStep: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
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

  inputBarWrap: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
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
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  webHint: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});