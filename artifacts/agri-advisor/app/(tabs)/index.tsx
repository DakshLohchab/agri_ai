import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";

const QUICK_ACTIONS = [
  {
    icon: "cloud-rain",
    title: "Rain this week",
    subtitle: "See rainfall timing and field actions",
    color: Colors.weather,
    query: "Will it rain this week in my area and what should I do on the farm?",
  },
  {
    icon: "trending-up",
    title: "Mandi prices",
    subtitle: "Check live rates and selling guidance",
    color: Colors.market,
    query: "What is the wheat mandi price today and should I sell now?",
  },
  {
    icon: "alert-triangle",
    title: "Pest diagnosis",
    subtitle: "Turn symptoms into crop advice",
    color: Colors.guardrails,
    query: "My crop leaves have spots and the plant is weakening. What should I do?",
  },
  {
    icon: "file-text",
    title: "Govt schemes",
    subtitle: "Understand eligibility and apply steps",
    color: Colors.intent,
    query: "Which farmer schemes can I apply for and what documents do I need?",
  },
  {
    icon: "droplet",
    title: "Irrigation plan",
    subtitle: "Match watering to forecast conditions",
    color: Colors.synthesis,
    query: "Help me plan irrigation for this week based on expected rain.",
  },
  {
    icon: "package",
    title: "Fertilizer help",
    subtitle: "Get crop-wise nutrient guidance",
    color: Colors.secondary,
    query: "What fertilizer dose should I use for my crop at this stage?",
  },
] as const;

const DASHBOARD_CARDS = [
  {
    title: "Weather-aware",
    body: "Local forecasts are turned into practical spray, irrigation, and harvest timing advice.",
    icon: "cloud",
    color: Colors.weather,
  },
  {
    title: "Market-ready",
    body: "Live mandi records and MSP context help explain whether to sell, hold, or compare markets.",
    icon: "bar-chart-2",
    color: Colors.market,
  },
  {
    title: "Low-WiFi safe",
    body: "The app can degrade gracefully with local fallback behavior when connectivity is weak.",
    icon: "wifi-off",
    color: Colors.info,
  },
] as const;

const AGENT_PIPELINE = [
  { name: "Guardrails", color: Colors.guardrails, icon: "shield" },
  { name: "Intent", color: Colors.intent, icon: "zap" },
  { name: "Web Search", color: Colors.webSearch, icon: "globe" },
  { name: "Weather", color: Colors.weather, icon: "cloud" },
  { name: "Market", color: Colors.market, icon: "trending-up" },
  { name: "Synthesis", color: Colors.synthesis, icon: "cpu" },
] as const;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function getInitials(name?: string, email?: string) {
  const source = (name || email || "Farmer").trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { createConversation, conversations } = useChat();

  const firstName = user?.name?.split(" ")[0] ?? "Farmer";
  const initials = getInitials(user?.name, user?.email);
  const locationLabel = user?.location?.trim() || "India";
  const recentConversations = useMemo(() => conversations.slice(0, 3), [conversations]);
  const profileComplete = Boolean(user?.name?.trim() && user?.location?.trim());

  const startChat = (query?: string) => {
    Haptics.impactAsync(
      query ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    );
    const id = createConversation();
    router.push(
      query
        ? `/chat/${id}?preQuery=${encodeURIComponent(query)}`
        : `/chat/${id}`
    );
  };

  const openConversation = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chat/${id}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.name}>{firstName}</Text>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={12} color={Colors.textMuted} />
              <Text style={styles.location}>{locationLabel}</Text>
            </View>
          </View>

          <Pressable style={styles.avatarBtn} onPress={() => router.push("/profile")}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.heroTop}>
            <View style={styles.heroTextWrap}>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusPillText}>AI farm desk ready</Text>
              </View>
              <Text style={styles.heroTitle}>One place for weather, prices, pests, and next-step farm decisions.</Text>
              <Text style={styles.heroSubtitle}>
                Ask a question, continue a recent conversation, or jump straight into a focused agri workflow.
              </Text>
            </View>
            <View style={styles.heroBadge}>
              <Feather name="cpu" size={24} color={Colors.primary} />
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>6</Text>
              <Text style={styles.heroStatLabel}>AI agents</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{recentConversations.length}</Text>
              <Text style={styles.heroStatLabel}>Recent chats</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{profileComplete ? "Ready" : "Setup"}</Text>
              <Text style={styles.heroStatLabel}>Profile status</Text>
            </View>
          </View>

          <View style={styles.heroActionRow}>
            <Pressable
              style={({ pressed }) => [styles.primaryAction, { opacity: pressed ? 0.88 : 1 }]}
              onPress={() => startChat()}
            >
              <Feather name="message-square" size={18} color={Colors.white} />
              <Text style={styles.primaryActionText}>Start New Chat</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryAction, { opacity: pressed ? 0.88 : 1 }]}
              onPress={() => router.push("/(tabs)/agents")}
            >
              <Feather name="git-branch" size={18} color={Colors.text} />
              <Text style={styles.secondaryActionText}>See AI Pipeline</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today’s Dashboard</Text>
          <Text style={styles.sectionDesc}>A quick read of how the app can support you right now.</Text>
        </View>

        <View style={styles.dashboardGrid}>
          <View style={styles.focusCard}>
            <View style={styles.focusHeader}>
              <Text style={styles.focusTitle}>Personalization</Text>
              <View
                style={[
                  styles.focusPill,
                  { backgroundColor: profileComplete ? Colors.success + "18" : Colors.warning + "18" },
                ]}
              >
                <Text
                  style={[
                    styles.focusPillText,
                    { color: profileComplete ? Colors.success : Colors.warning },
                  ]}
                >
                  {profileComplete ? "Configured" : "Needs setup"}
                </Text>
              </View>
            </View>
            <Text style={styles.focusBody}>
              {profileComplete
                ? `Your saved location is ${locationLabel}, so weather and mandi answers can be more tailored.`
                : "Add your location in profile to improve weather, mandi, and region-specific recommendations."}
            </Text>
            <Pressable style={styles.inlineLink} onPress={() => router.push("/profile")}>
              <Text style={styles.inlineLinkText}>{profileComplete ? "Review profile" : "Complete profile"}</Text>
              <Feather name="arrow-right" size={14} color={Colors.primary} />
            </Pressable>
          </View>

          <View style={styles.miniInsightGrid}>
            {DASHBOARD_CARDS.map((item) => (
              <View key={item.title} style={styles.miniInsightCard}>
                <View style={[styles.miniInsightIcon, { backgroundColor: item.color + "16" }]}>
                  <Feather name={item.icon as any} size={18} color={item.color} />
                </View>
                <Text style={styles.miniInsightTitle}>{item.title}</Text>
                <Text style={styles.miniInsightBody}>{item.body}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Text style={styles.sectionDesc}>Tap a card to start with a focused prompt instead of typing from scratch.</Text>
        </View>

        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((item) => (
            <Pressable
              key={item.title}
              style={({ pressed }) => [
                styles.quickCard,
                {
                  borderColor: item.color + "44",
                  backgroundColor: item.color + "10",
                  opacity: pressed ? 0.84 : 1,
                },
              ]}
              onPress={() => startChat(item.query)}
            >
              <View style={styles.quickCardTop}>
                <View style={[styles.quickIconContainer, { backgroundColor: item.color + "18" }]}>
                  <Feather name={item.icon as any} size={20} color={item.color} />
                </View>
                <Feather name="arrow-up-right" size={14} color={item.color} />
              </View>
              <Text style={[styles.quickTitle, { color: item.color }]}>{item.title}</Text>
              <Text style={styles.quickSubtitle}>{item.subtitle}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Continue Chats</Text>
          <Text style={styles.sectionDesc}>Jump back into recent conversations without losing context.</Text>
        </View>

        {recentConversations.length > 0 ? (
          <View style={styles.conversationList}>
            {recentConversations.map((conversation) => {
              const latestMessage = conversation.messages[conversation.messages.length - 1];
              return (
                <Pressable
                  key={conversation.id}
                  style={({ pressed }) => [styles.conversationCard, { opacity: pressed ? 0.9 : 1 }]}
                  onPress={() => openConversation(conversation.id)}
                >
                  <View style={styles.conversationIcon}>
                    <Feather name="message-circle" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.conversationTextWrap}>
                    <Text style={styles.conversationTitle} numberOfLines={1}>
                      {conversation.title}
                    </Text>
                    <Text style={styles.conversationMeta}>
                      {latestMessage?.role === "assistant" ? "AI replied" : "Waiting for reply"} ·{" "}
                      {new Date(conversation.updatedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyConversationCard}>
            <View style={styles.emptyConversationIcon}>
              <Feather name="message-square" size={20} color={Colors.primary} />
            </View>
            <View style={styles.emptyConversationTextWrap}>
              <Text style={styles.emptyConversationTitle}>No chats yet</Text>
              <Text style={styles.emptyConversationBody}>
                Start with a quick action or open a fresh chat to begin your first advisory flow.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>How Answers Are Built</Text>
          <Text style={styles.sectionDesc}>Every answer passes through an explainable 6-node pipeline.</Text>
        </View>

        <View style={styles.pipelineCard}>
          <View style={styles.pipelineRow}>
            {AGENT_PIPELINE.map((node, index) => (
              <React.Fragment key={node.name}>
                <View style={styles.pipelineNodeWrap}>
                  <View
                    style={[
                      styles.pipelineNode,
                      {
                        backgroundColor: node.color + "14",
                        borderColor: node.color + "44",
                      },
                    ]}
                  >
                    <Feather name={node.icon as any} size={16} color={node.color} />
                  </View>
                  <Text style={styles.pipelineNodeLabel}>{node.name}</Text>
                </View>
                {index < AGENT_PIPELINE.length - 1 ? <View style={styles.pipelineConnector} /> : null}
              </React.Fragment>
            ))}
          </View>

          <Text style={styles.pipelineDesc}>
            Guardrails and intent analysis shape the query first, then live sources and synthesis turn it into farmer-friendly action.
          </Text>

          <Pressable style={styles.learnBtn} onPress={() => router.push("/(tabs)/agents")}>
            <Text style={styles.learnBtnText}>Explore Live Demo</Text>
            <Feather name="arrow-right" size={14} color={Colors.primary} />
          </Pressable>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, gap: 18, paddingTop: 16, paddingBottom: 32 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  greetingBlock: { gap: 2 },
  greeting: { fontSize: 15, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  name: { fontSize: 30, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.6 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  location: { fontSize: 12, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  avatarBtn: {},
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary + "1f",
    borderWidth: 1.5,
    borderColor: Colors.primary + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: Colors.primaryLight,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: Colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 20,
    gap: 18,
  },
  heroGlowOne: {
    position: "absolute",
    top: -30,
    right: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary + "12",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: -40,
    left: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.weather + "10",
  },
  heroTop: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  heroTextWrap: {
    flex: 1,
    gap: 8,
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.primary + "14",
    borderWidth: 1,
    borderColor: Colors.primary + "24",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.success,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primaryLight,
  },
  heroTitle: {
    fontSize: 25,
    lineHeight: 33,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  heroBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.primary + "12",
    borderWidth: 1,
    borderColor: Colors.primary + "2d",
    alignItems: "center",
    justifyContent: "center",
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  heroStatValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  heroStatLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  heroActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  primaryActionText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  secondaryActionText: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  dashboardGrid: {
    gap: 10,
  },
  focusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    gap: 10,
  },
  focusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  focusTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  focusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  focusPillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  focusBody: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  inlineLink: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineLinkText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  miniInsightGrid: {
    gap: 10,
  },
  miniInsightCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    gap: 8,
  },
  miniInsightIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  miniInsightTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  miniInsightBody: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickCard: {
    width: "47%",
    minWidth: 150,
    flexGrow: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  quickCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Inter_700Bold",
  },
  quickSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  conversationList: {
    gap: 10,
  },
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 14,
  },
  conversationIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  conversationTextWrap: {
    flex: 1,
    gap: 3,
  },
  conversationTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  conversationMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  emptyConversationCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 16,
  },
  emptyConversationIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyConversationTextWrap: {
    flex: 1,
    gap: 4,
  },
  emptyConversationTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  emptyConversationBody: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  pipelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 18,
    gap: 14,
  },
  pipelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 6,
  },
  pipelineNodeWrap: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  pipelineNode: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pipelineNodeLabel: {
    fontSize: 10,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  pipelineConnector: {
    width: 10,
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginTop: 18,
  },
  pipelineDesc: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  learnBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  learnBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
});
