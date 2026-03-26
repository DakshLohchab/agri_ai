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
            <View style={styles.emptyChatIcon}>
              <Feather name="feather" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.emptyChatTitle}>Ask anything about farming</Text>
            <Text style={styles.emptyChatDesc}>
              Weather forecasts, mandi prices, pest control, government schemes — powered by 6 AI agents
            </Text>
            <View style={styles.suggestionRow}>
              {["Rain this week?", "Wheat price today", "Pest alerts"].map((q) => (
                <Pressable
                  key={q}
                  style={styles.suggestionChip}
                  onPress={() => sendMessage(q)}
                >
                  <Text style={styles.suggestionText}>{q}</Text>
                </Pressable>
              ))}
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
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
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyChatIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary + "22",
    borderWidth: 1.5,
    borderColor: Colors.primary + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyChatTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", color: Colors.text, textAlign: "center" },
  emptyChatDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary + "55",
  },
  suggestionText: { fontSize: 13, color: Colors.primary, fontFamily: "Inter_500Medium" },
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
