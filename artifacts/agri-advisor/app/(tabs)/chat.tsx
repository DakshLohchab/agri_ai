import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";
import { useChat } from "@/context/ChatContext";
import { Swipeable } from "react-native-gesture-handler";

export default function ChatListScreen() {
  const { conversations, createConversation, deleteConversation } = useChat();

  const handleNewChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = createConversation();
    router.push(`/chat/${id}`);
  };

  const handleOpenChat = (id: string) => {
    Haptics.selectionAsync();
    router.push(`/chat/${id}`);
  };

  const handleDelete = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteConversation(id);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Conversations</Text>
        <Pressable
          style={({ pressed }) => [styles.newBtn, { opacity: pressed ? 0.8 : 1 }]}
          onPress={handleNewChat}
        >
          <Feather name="plus" size={20} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingTop: 16, paddingBottom: 90 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <View style={[styles.headerCardIcon, { backgroundColor: Colors.intent + "22" }]}>
            <Feather name="message-circle" size={24} color={Colors.intent} />
          </View>
          <View style={styles.headerCardContent}>
            <Text style={styles.headerCardTitle}>Ask AgriAdvisor</Text>
            <Text style={styles.headerCardDesc}>Get expert advice on farming, weather & markets</Text>
          </View>
        </View>
        {conversations.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="message-circle" size={40} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyDesc}>
              Ask about crop diseases, weather, mandi prices or government schemes
            </Text>
            <Pressable style={styles.emptyBtn} onPress={handleNewChat}>
              <Feather name="plus" size={16} color={Colors.white} />
              <Text style={styles.emptyBtnText}>Start Query</Text>
            </Pressable>
          </View>
        ) : (
          conversations.map((conv) => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const renderRightActions = () => (
              <Pressable
                style={styles.deleteAction}
                onPress={() => handleDelete(conv.id)}
              >
                <Feather name="trash-2" size={20} color={Colors.white} />
              </Pressable>
            );
            return (
              <Swipeable key={conv.id} renderRightActions={renderRightActions}>
                <Pressable
                  style={({ pressed }) => [styles.convItem, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => handleOpenChat(conv.id)}
                >
                  <View style={styles.convIcon}>
                    <Feather name="cpu" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.convContent}>
                    <View style={styles.convHeader}>
                      <Text style={styles.convTitle} numberOfLines={1}>
                        {conv.title}
                      </Text>
                      <Text style={styles.convTime}>{formatDate(conv.updatedAt)}</Text>
                    </View>
                    {lastMsg && (
                      <Text style={styles.convPreview} numberOfLines={1}>
                        {lastMsg.role === "user" ? "You: " : "AI: "}
                        {lastMsg.content}
                      </Text>
                    )}
                    <View style={styles.convMeta}>
                      <Text style={styles.convCount}>
                        {conv.messages.length} messages
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color={Colors.textMuted} />
                </Pressable>
              </Swipeable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5 },
  newBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  list: { paddingHorizontal: 16, gap: 8 },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 16,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.white },
  convItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 14,
  },
  convIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + "22",
    borderWidth: 1,
    borderColor: Colors.primary + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  convContent: { flex: 1, gap: 4 },
  convHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  convTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text, flex: 1 },
  convTime: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  convPreview: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  convMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  convCount: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  deleteAction: {
    backgroundColor: Colors.error,
    justifyContent: "center",
    alignItems: "center",
    width: 70,
    borderRadius: 16,
    marginLeft: 8,
  },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  headerCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCardContent: { flex: 1, gap: 2 },
  headerCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  headerCardDesc: { fontSize: 12, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
});
