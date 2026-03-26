import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { AgentNode } from "@/components/AgentNode";
import {
  AgentStep,
  getDemoScenarios,
  DemoScenarioKey,
  runDemoScenario,
  runAgentQuery,
} from "@/services/langgraph";

const PIPELINE_NODES = [
  {
    name: "Guardrails",
    model: "Llama-3-8B",
    role: "Safety, off-domain blocking, ambiguity detection",
    color: Colors.guardrails,
    icon: "shield",
  },
  {
    name: "Intent",
    model: "Mistral-7B",
    role: "Query routing + entity extraction",
    color: Colors.intent,
    icon: "zap",
  },
  {
    name: "Web Search",
    model: "Qwen-14B",
    role: "Live pest alerts, scheme updates via web search",
    color: Colors.webSearch,
    icon: "globe",
  },
  {
    name: "Weather",
    model: "Open-Meteo API",
    role: "Free live weather, no API key needed",
    color: Colors.weather,
    icon: "cloud",
  },
  {
    name: "Market",
    model: "AgMarkNet stub",
    role: "MSP + mandi prices with graceful fallback",
    color: Colors.market,
    icon: "trending-up",
  },
  {
    name: "Synthesis",
    model: "Llama-3-70B",
    role: "Final multilingual advice with action steps",
    color: Colors.synthesis,
    icon: "cpu",
  },
];

export default function AgentsScreen() {
  const insets = useSafeAreaInsets();
  const [activeSteps, setActiveSteps] = useState<AgentStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeScenario, setActiveScenario] = useState<DemoScenarioKey | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [view, setView] = useState<"pipeline" | "demo">("pipeline");
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const scenarios = getDemoScenarios();

  const runScenario = async (key: DemoScenarioKey) => {
    if (isRunning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunning(true);
    setActiveScenario(key);
    setResult(null);
    setActiveSteps([]);
    setView("demo");

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
    setResult(null);
    setActiveSteps([]);
    setView("demo");

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16 }]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>AI Agents</Text>
        <Text style={styles.pageSubtitle}>LangGraph 6-node pipeline</Text>
      </View>

      <View style={styles.tabSwitcher}>
        <Pressable
          style={[styles.tabBtn, view === "pipeline" && styles.tabBtnActive]}
          onPress={() => setView("pipeline")}
        >
          <Feather
            name="git-branch"
            size={14}
            color={view === "pipeline" ? Colors.white : Colors.textSecondary}
          />
          <Text style={[styles.tabBtnText, view === "pipeline" && styles.tabBtnTextActive]}>
            Pipeline
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, view === "demo" && styles.tabBtnActive]}
          onPress={() => setView("demo")}
        >
          <Feather
            name="play-circle"
            size={14}
            color={view === "demo" ? Colors.white : Colors.textSecondary}
          />
          <Text style={[styles.tabBtnText, view === "demo" && styles.tabBtnTextActive]}>
            Live Demo
          </Text>
        </Pressable>
      </View>

      {view === "pipeline" && (
        <>
          <Text style={styles.sectionTitle}>Node Architecture</Text>
          {PIPELINE_NODES.map((node, i) => (
            <View key={node.name} style={styles.pipelineNodeWrap}>
              <View style={[styles.pipelineNode, { borderColor: node.color + "55" }]}>
                <View style={[styles.nodeIconBig, { backgroundColor: node.color + "22" }]}>
                  <Feather name={node.icon as any} size={22} color={node.color} />
                </View>
                <View style={styles.nodeInfo}>
                  <Text style={[styles.nodeName, { color: node.color }]}>{node.name}</Text>
                  <View style={styles.modelBadge}>
                    <Feather name="cpu" size={10} color={Colors.textMuted} />
                    <Text style={styles.modelText}>{node.model}</Text>
                  </View>
                  <Text style={styles.nodeRole}>{node.role}</Text>
                </View>
                <View style={[styles.nodeIndex, { backgroundColor: node.color + "22" }]}>
                  <Text style={[styles.nodeIndexText, { color: node.color }]}>{i + 1}</Text>
                </View>
              </View>
              {i < PIPELINE_NODES.length - 1 && (
                <View style={styles.connectorWrap}>
                  <View style={[styles.connectorLine, { backgroundColor: node.color + "55" }]} />
                  <Feather name="chevron-down" size={14} color={node.color + "88"} style={styles.connectorArrow} />
                </View>
              )}
            </View>
          ))}

          <Pressable
            style={({ pressed }) => [styles.runBtn, { opacity: pressed || isRunning ? 0.8 : 1 }]}
            onPress={runSample}
            disabled={isRunning}
          >
            <Feather name="play" size={18} color={Colors.white} />
            <Text style={styles.runBtnText}>Run Sample Query</Text>
          </Pressable>
        </>
      )}

      {view === "demo" && (
        <>
          <Text style={styles.sectionTitle}>Edge Case Demos</Text>
          <Text style={styles.sectionDesc}>
            Tap a scenario to see how the pipeline handles failure modes in real-time
          </Text>
          <View style={styles.scenarioGrid}>
            {scenarios.map((s) => (
              <Pressable
                key={s.key}
                style={({ pressed }) => [
                  styles.scenarioChip,
                  activeScenario === s.key && styles.scenarioChipActive,
                  { opacity: pressed || isRunning ? 0.75 : 1 },
                ]}
                onPress={() => runScenario(s.key)}
                disabled={isRunning}
              >
                <Feather
                  name="play-circle"
                  size={13}
                  color={activeScenario === s.key ? Colors.white : Colors.primary}
                />
                <Text
                  style={[
                    styles.scenarioText,
                    activeScenario === s.key && styles.scenarioTextActive,
                  ]}
                >
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeSteps.length > 0 && (
            <View style={styles.executionPanel}>
              <View style={styles.executionHeader}>
                <Text style={styles.executionTitle}>Pipeline Execution</Text>
                {isRunning && (
                  <View style={styles.runningBadge}>
                    <View style={styles.runningDot} />
                    <Text style={styles.runningText}>Running</Text>
                  </View>
                )}
                {!isRunning && result && (
                  <Pressable onPress={reset} style={styles.resetBtn}>
                    <Feather name="refresh-cw" size={14} color={Colors.textSecondary} />
                  </Pressable>
                )}
              </View>
              {activeSteps.map((step, i) => (
                <AgentNode key={i} step={step} index={i} />
              ))}
            </View>
          )}

          {result && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Feather name="check-circle" size={18} color={Colors.synthesis} />
                <Text style={styles.resultTitle}>Synthesis Output</Text>
              </View>
              <Text style={styles.resultText}>{result}</Text>
            </View>
          )}

          {activeSteps.length === 0 && !isRunning && (
            <Pressable
              style={({ pressed }) => [styles.sampleRunBtn, { opacity: pressed ? 0.8 : 1 }]}
              onPress={runSample}
            >
              <Feather name="play" size={16} color={Colors.white} />
              <Text style={styles.sampleRunText}>Run Standard Query</Text>
            </Pressable>
          )}
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, gap: 16 },
  pageHeader: { gap: 4 },
  pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, color: Colors.primary, fontFamily: "Inter_500Medium" },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  tabBtnTextActive: { color: Colors.white, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  sectionDesc: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: -8 },
  pipelineNodeWrap: { gap: 0 },
  pipelineNode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  nodeIconBig: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeInfo: { flex: 1, gap: 4 },
  nodeName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  modelText: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_500Medium" },
  nodeRole: { fontSize: 12, color: Colors.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18 },
  nodeIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeIndexText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  connectorWrap: { alignItems: "center", paddingVertical: 2 },
  connectorLine: { width: 2, height: 16 },
  connectorArrow: { marginTop: -8 },
  runBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  runBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
  scenarioGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scenarioChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary + "66",
    backgroundColor: Colors.surface,
  },
  scenarioChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  scenarioText: { fontSize: 13, color: Colors.primary, fontFamily: "Inter_500Medium" },
  scenarioTextActive: { color: Colors.white },
  executionPanel: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    gap: 4,
  },
  executionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  executionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  runningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary + "22",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  runningDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.primary,
  },
  runningText: { fontSize: 12, color: Colors.primary, fontFamily: "Inter_500Medium" },
  resetBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  resultCard: {
    backgroundColor: Colors.synthesis + "11",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.synthesis + "44",
    padding: 16,
    gap: 10,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.synthesis },
  resultText: { fontSize: 14, color: Colors.text, fontFamily: "Inter_400Regular", lineHeight: 22 },
  sampleRunBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sampleRunText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
});
