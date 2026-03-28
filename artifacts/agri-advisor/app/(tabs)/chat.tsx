import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBackdrop } from "@/components/AppBackdrop";
import { ScreenReveal } from "@/components/ScreenReveal";
import { Colors } from "@/constants/colors";
import { useChat } from "@/context/ChatContext";
import { Swipeable } from "react-native-gesture-handler";
import { useLocalizedStrings } from "@/hooks/useLocalizedStrings";
import { useTabBarSpacing } from "@/hooks/useTabBarSpacing";

export default function ChatListScreen() {
  const { conversations, createConversation, deleteConversation } = useChat();
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isWide = width >= 900;
  const tabBarSpacing = useTabBarSpacing();
  const ui = useLocalizedStrings({
    conversations: "Conversations",
    askAgriAdvisor: "Ask AgriAdvisor",
    headerDesc: "Get expert advice on farming, weather & markets",
    noConversations: "No conversations yet",
    emptyDesc: "Ask about crop diseases, weather, mandi prices or government schemes",
    startQuery: "Start Query",
    messages: "messages",
    deleteTitle: "Delete this chat?",
    deleteDesc: "This removes the conversation and its messages from this device.",
    cancel: "Cancel",
    delete: "Delete",
  });

  const handleNewChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = createConversation();
    router.push(`/chat/${id}`);
  };

  const handleOpenChat = (id: string) => {
    Haptics.selectionAsync();
    router.push(`/chat/${id}`);
  };

  const handleDeleteRequest = (id: string) => {
    setPendingDeleteId(id);
  };

  const handleDelete = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteConversation(id);
    setPendingDeleteId(null);
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
      <AppBackdrop variant="cool" />
      <View style={[styles.header, isWide && styles.headerWide]}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>Advisory threads</Text>
          <Text style={styles.headerTitle}>{ui.conversations}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.newBtn, { opacity: pressed ? 0.8 : 1 }]}
          onPress={handleNewChat}
        >
          <Feather name="plus" size={20} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          isWide && styles.listWide,
          { paddingTop: 16, paddingBottom: isWeb ? 36 : tabBarSpacing },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenReveal delay={40}>
        <LinearGradient
          colors={[Colors.surface, "#16221A", "#122019"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          <View style={[styles.headerCardIcon, { backgroundColor: Colors.intent + "22" }]}>
            <Feather name="message-circle" size={24} color={Colors.intent} />
          </View>
          <View style={styles.headerCardContent}>
            <Text style={styles.headerCardTitle}>{ui.askAgriAdvisor}</Text>
            <Text style={styles.headerCardDesc}>{ui.headerDesc}</Text>
          </View>
        </LinearGradient>
        </ScreenReveal>
        {conversations.length === 0 ? (
          <ScreenReveal delay={120}>
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="message-circle" size={40} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>{ui.noConversations}</Text>
            <Text style={styles.emptyDesc}>{ui.emptyDesc}</Text>
            <Pressable style={styles.emptyBtn} onPress={handleNewChat}>
              <Feather name="plus" size={16} color={Colors.white} />
              <Text style={styles.emptyBtnText}>{ui.startQuery}</Text>
            </Pressable>
          </View>
          </ScreenReveal>
        ) : (
          conversations.map((conv) => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const renderRightActions = () => (
              <Pressable
                style={styles.deleteAction}
                onPress={() => handleDeleteRequest(conv.id)}
              >
                <Feather name="trash-2" size={20} color={Colors.white} />
              </Pressable>
            );
            return (
              <Swipeable key={conv.id} renderRightActions={renderRightActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.convItem,
                    isWide && styles.convItemWide,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
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
                      <View style={styles.convHeaderMeta}>
                        <Text style={styles.convTime}>{formatDate(conv.updatedAt)}</Text>
                        <Pressable
                          style={styles.inlineDeleteBtn}
                          onPress={(event) => {
                            event.stopPropagation?.();
                            handleDeleteRequest(conv.id);
                          }}
                        >
                          <Feather name="trash-2" size={14} color={Colors.error} />
                        </Pressable>
                      </View>
                    </View>
                    {lastMsg && (
                      <Text style={styles.convPreview} numberOfLines={1}>
                        {lastMsg.role === "user" ? "You: " : "AI: "}
                        {lastMsg.content}
                      </Text>
                    )}
                    <View style={styles.convMeta}>
                      <Text style={styles.convCount}>
                        {conv.messages.length} {ui.messages}
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

      <Modal
        transparent
        visible={!!pendingDeleteId}
        animationType="fade"
        onRequestClose={() => setPendingDeleteId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Feather name="trash-2" size={18} color={Colors.error} />
            </View>
            <Text style={styles.modalTitle}>{ui.deleteTitle}</Text>
            <Text style={styles.modalDesc}>{ui.deleteDesc}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryBtn} onPress={() => setPendingDeleteId(null)}>
                <Text style={styles.modalSecondaryText}>{ui.cancel}</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimaryBtn}
                onPress={() => pendingDeleteId && handleDelete(pendingDeleteId)}
              >
                <Text style={styles.modalPrimaryText}>{ui.delete}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder + "88",
  },
  headerCopy: { gap: 2 },
  headerEyebrow: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primaryLight,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  headerWide: {
    maxWidth: 1120,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
  },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5 },
  newBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface + "F2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.primary + "33",
    shadowColor: Colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  list: { paddingHorizontal: 16, gap: 8 },
  listWide: {
    maxWidth: 1120,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
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
    backgroundColor: Colors.surface + "F4",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 15,
    shadowColor: Colors.black,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  convItemWide: {
    paddingHorizontal: 18,
    paddingVertical: 16,
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
  convHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  convHeaderMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  convTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text, flex: 1 },
  convTime: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  inlineDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.error + "14",
    borderWidth: 1,
    borderColor: Colors.error + "2A",
  },
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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
    shadowColor: Colors.black,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 20,
    gap: 14,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.error + "14",
    borderWidth: 1,
    borderColor: Colors.error + "2A",
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  modalDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  modalActions: { flexDirection: "row", gap: 10 },
  modalSecondaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  modalSecondaryText: { color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalPrimaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.error,
  },
  modalPrimaryText: { color: Colors.white, fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
