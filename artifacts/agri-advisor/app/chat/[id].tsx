import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { useChat, Message, AgentStep } from "@/context/ChatContext";
import { runAgentQuery } from "@/services/langgraph";

export default function ChatScreen() {
  const { id, preQuery } = useLocalSearchParams<{ id: string; preQuery?: string }>();
  const { getConversation, addMessage, updateMessage } = useChat();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatRef = useRef<FlatList>(null);

  const conversation = getConversation(id);
  const messages = conversation?.messages ?? [];

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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

      await runAgentQuery(
        trimmed,
        (steps: AgentStep[]) => {
          updateMessage(id, aiMsgId, { agentSteps: steps });
        },
        (response: string, steps: AgentStep[]) => {
          updateMessage(id, aiMsgId, { content: response, agentSteps: steps });
          setIsTyping(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      );
    },
    [id, isTyping, addMessage, updateMessage]
  );

  const reversedMessages = [...messages].reverse();

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {conversation?.title ?? "New Query"}
          </Text>
          <View style={styles.headerBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.headerSubtitle}>6-agent pipeline</Text>
          </View>
        </View>
        <Pressable
          style={styles.agentsBtn}
          onPress={() => router.push("/(tabs)/agents")}
        >
          <Feather name="cpu" size={18} color={Colors.primary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={topPad + 56}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <View style={styles.emptyContent}>
              <View style={styles.emptyChatIcon}>
                <Feather name="cpu" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyChatTitle}>AgriAdvisor AI</Text>
              <Text style={styles.emptyChatDesc}>
                Powered by 6 specialized AI agents working together
              </Text>

              <View style={styles.pipelineIndicator}>
                <View style={[styles.pipelineStep, { backgroundColor: Colors.guardrails }]}>
                  <Text style={styles.pipelineNumber}>1</Text>
                </View>
                <View style={styles.pipelineConnector} />
                <View style={[styles.pipelineStep, { backgroundColor: Colors.intent }]}>
                  <Text style={styles.pipelineNumber}>2</Text>
                </View>
                <View style={styles.pipelineConnector} />
                <View style={[styles.pipelineStep, { backgroundColor: Colors.webSearch }]}>
                  <Text style={styles.pipelineNumber}>3</Text>
                </View>
                <View style={styles.pipelineConnector} />
                <View style={[styles.pipelineStep, { backgroundColor: Colors.weather }]}>
                  <Text style={styles.pipelineNumber}>4</Text>
                </View>
              </View>

              <View style={styles.pipelineIndicator}>
                <View style={[styles.pipelineStep, { backgroundColor: Colors.market }]}>
                  <Text style={styles.pipelineNumber}>5</Text>
                </View>
                <View style={styles.pipelineConnector} />
                <View style={[styles.pipelineStep, { backgroundColor: Colors.synthesis }]}>
                  <Text style={styles.pipelineNumber}>6</Text>
                </View>
                <View style={styles.pipelineConnectorEnd} />
              </View>

              <View style={styles.suggestionRow}>
                {[
                  { q: "Rain this week?", icon: "cloud-rain" },
                  { q: "Wheat price", icon: "trending-up" },
                  { q: "Pest alerts", icon: "alert-triangle" },
                ].map(({ q, icon }) => (
                  <Pressable
                    key={q}
                    style={styles.suggestionChip}
                    onPress={() => sendMessage(q)}
                  >
                    <Feather name={icon as any} size={16} color={Colors.primary} />
                    <Text style={styles.suggestionText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={reversedMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              if (item.role === "assistant" && item.content === "" && isTyping) {
                return <TypingIndicator />;
              }
              if (item.content === "" && item.role === "assistant") return null;
              return <MessageBubble message={item} />;
            }}
            inverted
            contentContainerStyle={[styles.messageList, { paddingBottom: 8 }]}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={isTyping ? <TypingIndicator /> : null}
          />
        )}

        <View style={[styles.inputBar, { paddingBottom: botPad + 8 }]}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about crops, weather, prices..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage(inputText)}
            returnKeyType="send"
            editable={!isTyping}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: inputText.trim() && !isTyping ? Colors.primary : Colors.surfaceElevated,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isTyping}
          >
            <Feather
              name="send"
              size={18}
              color={inputText.trim() && !isTyping ? Colors.white : Colors.textMuted}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + "22",
    gap: 12,
    backgroundColor: Colors.primary + "08",
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
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyContent: {
    alignItems: "center",
    gap: 20,
    maxWidth: 320,
  },
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
  },
  suggestionRow: { 
    flexDirection: "row", 
    gap: 10, 
    justifyContent: "center",
    marginTop: 12,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.primary + "55",
  },
  suggestionText: { 
    fontSize: 13, 
    color: Colors.primary, 
    fontFamily: "Inter_600SemiBold" 
  },
  pipelineIndicator: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center",
    gap: 0,
    marginBottom: 8,
  },
  pipelineStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pipelineNumber: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  pipelineConnector: {
    width: 18,
    height: 2,
    backgroundColor: Colors.surfaceBorder,
  },
  pipelineConnectorEnd: {
    width: 18,
    height: 2,
    backgroundColor: "transparent",
  },
  messageList: { paddingTop: 12, paddingBottom: 12 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
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
});
