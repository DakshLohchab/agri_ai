import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AgentNode } from "@/components/AgentNode";
import { FormattedAIContent } from "@/components/FormattedAIContent";
import { Colors } from "@/constants/colors";
import { AgentStep } from "@/context/ChatContext";
import { useLocalizedStrings } from "@/hooks/useLocalizedStrings";
import { useTabBarSpacing } from "@/hooks/useTabBarSpacing";
import {
  DemoScenarioKey,
  getDemoScenarios,
  runDemoScenario,
  runAgentQuery,
} from "@/services/langgraph";

const PIPELINE_NODES = [
  ["Guardrails", "Safety, off-domain blocking, ambiguity checks", Colors.guardrails, "shield"],
  ["Intent", "Routing, entity extraction, clarification-first behavior", Colors.intent, "zap"],
  ["Web Search", "Live enrichment when network quality allows", Colors.webSearch, "globe"],
  ["Weather", "Forecast and rainfall advisories", Colors.weather, "cloud"],
  ["Market", "AGMARKNET + fallback logic", Colors.market, "trending-up"],
  ["Synthesis", "Final farmer-facing answer formatting", Colors.synthesis, "cpu"],
] as const;

const CAPABILITIES = [
  ["Resilient", "Handles weak connectivity and fallback paths.", Colors.info, "wifi-off"],
  ["Safe", "Blocks off-domain requests early.", Colors.guardrails, "shield"],
  ["Explainable", "Shows each pipeline step as it runs.", Colors.intent, "git-branch"],
  ["Readable", "Formats long AI output for mobile.", Colors.synthesis, "message-square"],
] as const;

const HERO_STATS = [
  ["6", "Pipeline nodes"],
  ["7", "Interactive demos"],
  ["Low-WiFi", "Graceful fallback"],
] as const;

const SCENARIO_META: Record<
  DemoScenarioKey,
  {
    title: string;
    subtitle: string;
    color: string;
    icon: keyof typeof Feather.glyphMap;
    focus: string;
    handles: string[];
    outcome: string;
    playbook: string;
  }
> = {
  off_domain: {
    title: "Off-domain block",
    subtitle: "Stops unrelated questions before the rest of the graph runs.",
    color: Colors.guardrails,
    icon: "shield-off",
    focus: "Domain safety",
    handles: [
      "Guardrails classifies the request as non-agricultural.",
      "Downstream models and tools are skipped immediately.",
      "The user is redirected toward supported farming topics.",
    ],
    outcome: "A safe refusal plus a redirect to crop, weather, mandi, pest, or scheme queries.",
    playbook: "Off-domain requests are intercepted at the first node, which protects trust, reduces hallucinations, and keeps compute focused on farmer workflows.",
  },
  ambiguous: {
    title: "Ambiguous query",
    subtitle: "Asks for missing crop/location context instead of guessing.",
    color: Colors.intent,
    icon: "help-circle",
    focus: "Clarification-first",
    handles: [
      "Intent detects missing crop, location, or user goal.",
      "The pipeline avoids overconfident recommendations.",
      "A short follow-up question keeps the chat moving.",
    ],
    outcome: "A concise clarification prompt instead of a risky generic answer.",
    playbook: "Ambiguity is treated as a product moment, not an error. The system narrows the task with one focused follow-up so the next answer can be specific and reliable.",
  },
  low_wifi: {
    title: "Low-WiFi resilience",
    subtitle: "Shows how the stack degrades gracefully under weak connectivity.",
    color: Colors.info,
    icon: "wifi-off",
    focus: "Offline-safe",
    handles: [
      "Non-critical live enrichment can be skipped under high latency.",
      "The market layer can use cached or reference-safe context.",
      "The final answer clearly signals fallback behavior.",
    ],
    outcome: "A useful response even when full live enrichment is not available.",
    playbook: "When the network is weak, the stack prioritizes lightweight fetches, cached context, and practical guidance first, then upgrades with live data when connectivity improves.",
  },
  weather_rain: {
    title: "Rain forecast",
    subtitle: "Turns raw weather data into clear farm actions.",
    color: Colors.weather,
    icon: "cloud-rain",
    focus: "Weather advisory",
    handles: [
      "Fetches forecast first.",
      "Highlights rainy windows and the wettest period.",
      "Converts forecast into field actions.",
    ],
    outcome: "A weekly forecast with action-oriented rainfall guidance.",
    playbook: "Weather responses are tuned for field decisions, so the user sees timing, intensity, and concrete actions instead of a raw forecast dump.",
  },
  market_wheat: {
    title: "Live mandi prices",
    subtitle: "Combines AGMARKNET context with a decision layer.",
    color: Colors.market,
    icon: "bar-chart-2",
    focus: "Market intelligence",
    handles: [
      "Fetches mandi records when available.",
      "Compares live pricing with MSP where possible.",
      "Adds sell/hold guidance instead of raw numbers only.",
    ],
    outcome: "A readable market answer with next-step selling advice.",
    playbook: "The market path tries live records first, then shifts to fallback reference context so the user still gets a decision-oriented answer when live data is sparse.",
  },
  pest_alert: {
    title: "Pest diagnosis",
    subtitle: "Turns symptoms into practical crop protection steps.",
    color: Colors.webSearch,
    icon: "alert-triangle",
    focus: "Crop protection",
    handles: [
      "Matches symptoms with crop-specific risk patterns.",
      "Returns treatment and escalation guidance.",
      "Keeps the answer operational.",
    ],
    outcome: "A structured pest or disease advisory with next actions.",
    playbook: "The model converts symptom descriptions into likely risks, then packages the answer into treatment, escalation, and expert-help guidance.",
  },
  scheme_kisan: {
    title: "Government schemes",
    subtitle: "Packages scheme information into an easy farmer workflow.",
    color: Colors.synthesis,
    icon: "file-text",
    focus: "Public support",
    handles: [
      "Identifies relevant schemes.",
      "Summarizes benefit, eligibility, and apply path.",
      "Keeps the answer practical and short.",
    ],
    outcome: "A compact scheme overview with clear application steps.",
    playbook: "Scheme responses are organized around what farmers need most: benefit, eligibility, application path, and what documents to carry.",
  },
};

export default function AgentsScreen() {
  const ui = useLocalizedStrings({
    aiAgents: "AI Agents",
    liveDemo: "Live Demo",
    pipeline: "Pipeline",
    nodeArchitecture: "Node Architecture",
    runStandardQuery: "Run Standard Query",
    detailedDemoScenarios: "Detailed Demo Scenarios",
    pipelineExecution: "Pipeline Execution",
    formattedDemoOutput: "Formatted Demo Output",
  });
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isDesktop = width >= 1180;
  const tabBarSpacing = useTabBarSpacing();
  const [view, setView] = useState<"pipeline" | "demo">("pipeline");
  const [activeSteps, setActiveSteps] = useState<AgentStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<DemoScenarioKey | null>(null);
  const scenarios = getDemoScenarios();

  const enrichedScenarios = useMemo(
    () => scenarios.map((scenario) => ({ ...scenario, ...SCENARIO_META[scenario.key] })),
    [scenarios]
  );

  const activeMeta = activeScenario ? SCENARIO_META[activeScenario] : null;

  const startRun = () => {
    setResult(null);
    setActiveSteps([]);
    setView("demo");
  };

  const runScenario = async (key: DemoScenarioKey) => {
    if (isRunning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunning(true);
    setActiveScenario(key);
    startRun();

    await runDemoScenario(
      key,
      (steps) => setActiveSteps([...steps]),
      (response, steps) => {
        setActiveSteps([...steps]);
        setResult(response);
        setIsRunning(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    );
  };

  const runSample = async () => {
    if (isRunning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunning(true);
    setActiveScenario(null);
    startRun();

    await runAgentQuery(
      "What is the best time to sow wheat in Punjab this season?",
      (steps) => setActiveSteps([...steps]),
      (response, steps) => {
        setActiveSteps([...steps]);
        setResult(response);
        setIsRunning(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    );
  };

  const reset = () => {
    setActiveSteps([]);
    setResult(null);
    setActiveScenario(null);
    setIsRunning(false);
    setView("pipeline");
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          isDesktop && styles.contentDesktop,
          { paddingBottom: isWeb ? 40 : tabBarSpacing },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Feather name="cpu" size={26} color={Colors.synthesis} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>{ui.aiAgents}</Text>
              <Text style={styles.pageSubtitle}>
                Safety, resilience, and readable AI output built into one explainable pipeline.
              </Text>
            </View>
          </View>
          <View style={[styles.capabilityStrip, isDesktop && styles.capabilityStripDesktop]}>
            {CAPABILITIES.map(([title, body, color, icon]) => (
              <View key={title} style={[styles.capabilityCard, { borderColor: color + "44" }]}>
                <Feather name={icon as any} size={16} color={color} />
                <Text style={styles.capabilityTitle}>{title}</Text>
                <Text style={styles.capabilityBody}>{body}</Text>
              </View>
            ))}
          </View>
          <View style={styles.statsRow}>
            {HERO_STATS.map(([value, label]) => (
              <View key={label} style={styles.statCard}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.tabSwitcher}>
          {[
            ["pipeline", ui.pipeline, "git-branch"],
            ["demo", ui.liveDemo, "play-circle"],
          ].map(([key, label, icon]) => (
            <Pressable
              key={key}
              style={[styles.tabBtn, view === key && styles.tabBtnActive]}
              onPress={() => setView(key as "pipeline" | "demo")}
            >
              <Feather name={icon as any} size={14} color={view === key ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.tabText, view === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {view === "pipeline" ? (
          <>
            <Text style={styles.sectionTitle}>{ui.nodeArchitecture}</Text>
            {PIPELINE_NODES.map(([name, role, color, icon], index) => (
              <View key={name} style={styles.nodeWrap}>
                <View style={[styles.nodeCard, { borderColor: color + "55" }]}>
                  <View style={[styles.nodeIcon, { backgroundColor: color + "18" }]}>
                    <Feather name={icon as any} size={20} color={color} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.nodeHeader}>
                      <Text style={[styles.nodeName, { color }]}>{name}</Text>
                      <Text style={styles.nodeIndex}>0{index + 1}</Text>
                    </View>
                    <Text style={styles.nodeRole}>{role}</Text>
                  </View>
                </View>
                {index < PIPELINE_NODES.length - 1 ? <View style={styles.connector} /> : null}
              </View>
            ))}

            <Pressable style={styles.primaryBtn} onPress={runSample} disabled={isRunning}>
              <Feather name="play" size={18} color={Colors.white} />
              <Text style={styles.primaryBtnText}>{ui.runStandardQuery}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{ui.detailedDemoScenarios}</Text>
              <Text style={styles.sectionDesc}>
                Tap any scenario to see what the pipeline does, why it matters, and how the final answer is formatted.
              </Text>
            </View>

            <View style={[styles.scenarioGrid, isDesktop && styles.scenarioGridDesktop]}>
              {enrichedScenarios.map((scenario) => {
                const isActive = scenario.key === activeScenario;
                return (
                  <Pressable
                    key={scenario.key}
                    style={[
                      styles.scenarioCard,
                      {
                        borderColor: isActive ? scenario.color : Colors.surfaceBorder,
                        backgroundColor: isActive ? scenario.color + "12" : Colors.surface,
                      },
                    ]}
                    onPress={() => runScenario(scenario.key)}
                    disabled={isRunning}
                  >
                    <View style={styles.scenarioHeader}>
                      <View style={[styles.scenarioIcon, { backgroundColor: scenario.color + "18" }]}>
                        <Feather name={scenario.icon} size={18} color={scenario.color} />
                      </View>
                      <View style={[styles.focusPill, { backgroundColor: scenario.color + "18" }]}>
                        <Text style={[styles.focusPillText, { color: scenario.color }]}>{scenario.focus}</Text>
                      </View>
                    </View>
                    <Text style={styles.scenarioTitle}>{scenario.title}</Text>
                    <Text style={styles.scenarioSubtitle}>{scenario.subtitle}</Text>
                    <Text style={styles.scenarioQuery}>{scenario.query}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.detailGrid, isDesktop && styles.detailGridDesktop]}>
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>
                  {activeMeta ? "How the pipeline handles it" : "Choose a scenario"}
                </Text>
                {activeMeta ? (
                  activeMeta.handles.map((item) => (
                    <View key={item} style={styles.detailRow}>
                      <View style={[styles.detailDot, { backgroundColor: activeMeta.color }]} />
                      <Text style={styles.detailText}>{item}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.detailText}>
                    The new scenarios show blocked requests, clarification-first behavior, and Low-WiFi resilience in a more explainable way.
                  </Text>
                )}
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>Expected user experience</Text>
                <Text style={styles.detailText}>
                  {activeMeta
                    ? activeMeta.outcome
                    : "Select a card to see the intended user-facing behavior and then run the demo."}
                </Text>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>Design playbook</Text>
                <Text style={styles.detailText}>
                  {activeMeta
                    ? activeMeta.playbook
                    : "The demos are designed to show safety, clarification-first behavior, live-data fallbacks, and mobile-friendly AI presentation in one place."}
                </Text>
              </View>
            </View>

            {result ? (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>{ui.formattedDemoOutput}</Text>
                  <View style={styles.resultPill}>
                    <Text style={styles.resultPillText}>{activeMeta?.focus || "Standard flow"}</Text>
                  </View>
                </View>
                <FormattedAIContent
                  content={result}
                  variant="panel"
                  accentColor={activeMeta?.color || Colors.primary}
                />
              </View>
            ) : (
              <Pressable style={styles.primaryBtn} onPress={runSample} disabled={isRunning}>
                <Feather name="play" size={18} color={Colors.white} />
                <Text style={styles.primaryBtnText}>{ui.runStandardQuery}</Text>
              </Pressable>
            )}

            {activeSteps.length > 0 ? (
              <View style={styles.executionPanel}>
                <View style={styles.executionHeader}>
                  <Text style={styles.executionTitle}>{ui.pipelineExecution}</Text>
                  {isRunning ? (
                    <View style={styles.runningBadge}>
                      <View style={styles.runningDot} />
                      <Text style={styles.runningText}>Running</Text>
                    </View>
                  ) : result ? (
                    <Pressable onPress={reset} style={styles.resetBtn}>
                      <Feather name="refresh-cw" size={14} color={Colors.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
                {activeSteps.map((step, index) => (
                  <AgentNode key={`${step.node}-${index}`} step={step} index={index} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 96, gap: 18 },
  contentDesktop: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: 28 },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 18,
    gap: 16,
  },
  heroTop: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.synthesis + "18",
    borderWidth: 1,
    borderColor: Colors.synthesis + "44",
  },
  pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 21 },
  capabilityStrip: { gap: 10 },
  capabilityStripDesktop: { flexDirection: "row", flexWrap: "wrap" },
  capabilityCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    flex: 1,
    minWidth: 220,
  },
  capabilityTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  capabilityBody: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 18 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 4,
  },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary, lineHeight: 18 },
  tabSwitcher: { flexDirection: "row", gap: 4, backgroundColor: Colors.surface, borderRadius: 16, padding: 4 },
  tabBtn: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 11, borderRadius: 12 },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  tabTextActive: { color: Colors.white, fontFamily: "Inter_600SemiBold" },
  sectionHeader: { gap: 4 },
  sectionTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: Colors.text },
  sectionDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 20 },
  nodeWrap: { gap: 4 },
  nodeCard: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, padding: 16 },
  nodeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  nodeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nodeName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  nodeIndex: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_600SemiBold" },
  nodeRole: { fontSize: 12, color: Colors.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18 },
  connector: { width: 2, height: 14, backgroundColor: Colors.surfaceBorder, alignSelf: "center" },
  primaryBtn: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primary, borderRadius: 18, paddingVertical: 16 },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
  scenarioGrid: { gap: 10 },
  scenarioGridDesktop: { flexDirection: "row", flexWrap: "wrap" },
  scenarioCard: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, padding: 16, gap: 10, minWidth: 240, flex: 1 },
  scenarioHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scenarioIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  focusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  focusPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  scenarioTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  scenarioSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 20 },
  scenarioQuery: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.text, lineHeight: 19 },
  detailGrid: { gap: 10 },
  detailGridDesktop: { flexDirection: "row", flexWrap: "wrap" },
  detailCard: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 16, gap: 10, minWidth: 240, flex: 1 },
  detailTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  detailRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  detailDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  detailText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 20 },
  executionPanel: { backgroundColor: Colors.surface, borderRadius: 22, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 16, gap: 4 },
  executionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  executionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  runningBadge: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: Colors.primary + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  runningDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.primary },
  runningText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.primary },
  resetBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  resultCard: { backgroundColor: Colors.surface, borderRadius: 24, borderWidth: 1, borderColor: Colors.synthesis + "44", padding: 18, gap: 14 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  resultTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  resultPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: Colors.synthesis + "18" },
  resultPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.synthesis },
});
