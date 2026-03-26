import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";

const QUICK_QUERIES = [
  { icon: "cloud-rain", label: "Rain forecast\nthis week", color: Colors.weather },
  { icon: "trending-up", label: "Wheat mandi\nprice today", color: Colors.market },
  { icon: "alert-triangle", label: "Pest alerts\nnear me", color: Colors.guardrails },
  { icon: "file-text", label: "PM-KISAN\neligibility", color: Colors.intent },
  { icon: "droplets", label: "Irrigation\nschedule", color: Colors.synthesis },
  { icon: "package", label: "Fertilizer\ndosage", color: Colors.secondary },
];

const AGENT_PIPELINE = [
  { name: "Guardrails", color: Colors.guardrails, icon: "shield" },
  { name: "Intent", color: Colors.intent, icon: "zap" },
  { name: "Web Search", color: Colors.webSearch, icon: "globe" },
  { name: "Weather", color: Colors.weather, icon: "cloud" },
  { name: "Market", color: Colors.market, icon: "trending-up" },
  { name: "Synthesis", color: Colors.synthesis, icon: "cpu" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { createConversation } = useChat();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleQuickQuery = (label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const id = createConversation();
    router.push(`/chat/${id}?preQuery=${encodeURIComponent(label.replace(/\n/, " "))}`);
  };

  const handleNewChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = createConversation();
    router.push(`/chat/${id}`);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16 }]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.name}>{user?.name?.split(" ")[0] ?? "Farmer"}</Text>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={12} color={Colors.textMuted} />
            <Text style={styles.location}>{user?.location ?? "India"}</Text>
          </View>
        </View>
        <Pressable style={styles.avatarBtn} onPress={() => router.push("/(tabs)/agents")}>
          <View style={styles.avatar}>
            <Feather name="user" size={20} color={Colors.primary} />
          </View>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.askCard, { opacity: pressed ? 0.9 : 1 }]}
        onPress={handleNewChat}
      >
        <View style={styles.askCardInner}>
          <View style={styles.askIconContainer}>
            <Feather name="cpu" size={22} color={Colors.primary} />
          </View>
          <View style={styles.askTextContainer}>
            <Text style={styles.askTitle}>Ask AgriAdvisor AI</Text>
            <Text style={styles.askSubtitle}>Weather, market prices, pest control...</Text>
          </View>
          <Feather name="arrow-right" size={18} color={Colors.textSecondary} />
        </View>
        <View style={styles.pipelineMini}>
          {AGENT_PIPELINE.map((node, i) => (
            <React.Fragment key={node.name}>
              <View style={[styles.miniNode, { backgroundColor: node.color + "33", borderColor: node.color + "66" }]}>
                <Feather name={node.icon as any} size={10} color={node.color} />
              </View>
              {i < AGENT_PIPELINE.length - 1 && (
                <View style={styles.miniArrow} />
              )}
            </React.Fragment>
          ))}
        </View>
      </Pressable>

      <Text style={styles.sectionTitle}>Quick Queries</Text>
      <View style={styles.quickGrid}>
        {QUICK_QUERIES.map((q, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [
              styles.quickCard,
              {
                borderColor: q.color + "44",
                backgroundColor: q.color + "11",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => handleQuickQuery(q.label)}
          >
            <View style={[styles.quickIconContainer, { backgroundColor: q.color + "22" }]}>
              <Feather name={q.icon as any} size={20} color={q.color} />
            </View>
            <Text style={[styles.quickLabel, { color: q.color }]}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>About AgriAdvisor</Text>
      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>LangGraph 6-Agent Pipeline</Text>
        <Text style={styles.aboutDesc}>
          Every query flows through 6 specialized AI agents — Guardrails, Intent, Web Search, Weather, Market, and Synthesis — powered by open-source LLMs for cost-efficient, accurate agricultural advice.
        </Text>
        <Pressable
          style={styles.learnBtn}
          onPress={() => router.push("/(tabs)/agents")}
        >
          <Text style={styles.learnBtnText}>View Agent Pipeline</Text>
          <Feather name="arrow-right" size={14} color={Colors.primary} />
        </Pressable>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, gap: 20 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  greetingBlock: { gap: 2 },
  greeting: { fontSize: 15, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  name: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  location: { fontSize: 12, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  avatarBtn: {},
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + "22",
    borderWidth: 1.5,
    borderColor: Colors.primary + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  askCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary + "33",
    padding: 16,
    gap: 14,
  },
  askCardInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  askIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + "22",
    borderWidth: 1,
    borderColor: Colors.primary + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  askTextContainer: { flex: 1 },
  askTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  askSubtitle: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  pipelineMini: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  miniNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  miniArrow: { width: 8, height: 1, backgroundColor: Colors.surfaceBorder },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: {
    width: "30%",
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    minWidth: 100,
  },
  quickIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 18 },
  aboutCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 20,
    gap: 10,
  },
  aboutTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  aboutDesc: { fontSize: 14, color: Colors.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 22 },
  learnBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  learnBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.primary },
});
