import { AgentStep, Message } from "@/context/ChatContext";

const AGENT_NODES = ["Guardrails", "Intent", "Web Search", "Weather", "Market", "Synthesis"];

const DEMO_SCENARIOS = {
  off_domain: {
    label: "Off-Domain Block",
    query: "How do I invest in stocks?",
    steps: [
      { node: "Guardrails", status: "completed" as const, message: "BLOCKED: Query is outside agriculture domain. Refusing to process.", duration: 45 },
    ],
    response: "I'm specialized for agricultural advice only. I can help you with crop management, weather forecasting, market prices, pest control, and farming schemes. Please ask me something related to farming.",
  },
  ambiguity: {
    label: "Ambiguity Detection",
    query: "What should I do with my plants?",
    steps: [
      { node: "Guardrails", status: "completed" as const, message: "Passed: Agriculture domain confirmed.", duration: 38 },
      { node: "Intent", status: "completed" as const, message: "AMBIGUOUS: Could not determine crop type, location, or specific concern. Requesting clarification.", duration: 120 },
    ],
    response: "Could you please clarify: Which crop are you asking about? What is your location? Are you concerned about pest, disease, irrigation, or harvest timing? This will help me give you precise advice.",
  },
  weather_failure: {
    label: "Weather API Fallback",
    query: "Will it rain tomorrow in Pune?",
    steps: [
      { node: "Guardrails", status: "completed" as const, message: "Passed: Agriculture domain query.", duration: 35 },
      { node: "Intent", status: "completed" as const, message: "Route: weather | Location: Pune, Maharashtra | Timeframe: tomorrow", duration: 98 },
      { node: "Weather", status: "error" as const, message: "ERROR: Open-Meteo API timeout (5s). Using cached 3-day forecast data.", duration: 5000 },
      { node: "Synthesis", status: "completed" as const, message: "Synthesizing with cached weather data. Confidence: Medium.", duration: 340 },
    ],
    response: "⚠️ Live weather data unavailable. Based on recent patterns for Pune: 60% chance of rain tomorrow afternoon (14:00–18:00 IST). Temperature 24–31°C. If you have crops in the field, consider protective measures. Check IMD for live updates.",
  },
  market_fallback: {
    label: "Market Price Fallback",
    query: "What is the mandi price for wheat today?",
    steps: [
      { node: "Guardrails", status: "completed" as const, message: "Passed: Agriculture domain confirmed.", duration: 40 },
      { node: "Intent", status: "completed" as const, message: "Route: market | Commodity: wheat | Type: mandi price", duration: 115 },
      { node: "Market", status: "error" as const, message: "AgMarkNet API unavailable. Using MSP data + historical averages.", duration: 2000 },
      { node: "Synthesis", status: "completed" as const, message: "Synthesizing with MSP and historical data.", duration: 280 },
    ],
    response: "Live mandi data unavailable. Current MSP for wheat: ₹2,275/quintal (2024-25). Historical mandi premium: 5-15% above MSP. Estimated range: ₹2,390–₹2,615/quintal. Check AGMARKNET app for live prices in your district.",
  },
  low_confidence: {
    label: "Low Confidence Escalation",
    query: "My tomatoes have strange yellow spots and leaves curling. What disease is this?",
    steps: [
      { node: "Guardrails", status: "completed" as const, message: "Passed: Agriculture domain - crop disease inquiry.", duration: 42 },
      { node: "Intent", status: "completed" as const, message: "Route: diagnosis | Crop: tomato | Symptom: yellow spots + leaf curl", duration: 130 },
      { node: "Web Search", status: "completed" as const, message: "Found: Tomato Yellow Leaf Curl Virus (TYLCV), Fusarium wilt, Nutritional deficiency - 3 possible matches.", duration: 890 },
      { node: "Synthesis", status: "completed" as const, message: "Confidence: 62% - Multiple possibilities. Escalating with top candidates.", duration: 410 },
    ],
    response: "Your tomato symptoms match 3 possible conditions (confidence 62%). Most likely: **Tomato Yellow Leaf Curl Virus (TYLCV)** - spread by whiteflies. Also possible: Magnesium deficiency or early Fusarium wilt. Recommended: Upload a photo for visual diagnosis, or consult your local KVK. Immediate action: Apply yellow sticky traps to control whiteflies.",
  },
};

export type DemoScenarioKey = keyof typeof DEMO_SCENARIOS;

export function getDemoScenarios(): { key: DemoScenarioKey; label: string }[] {
  return Object.entries(DEMO_SCENARIOS).map(([key, val]) => ({
    key: key as DemoScenarioKey,
    label: val.label,
  }));
}

export async function runDemoScenario(
  key: DemoScenarioKey,
  onStepUpdate: (steps: AgentStep[]) => void,
  onComplete: (response: string, steps: AgentStep[]) => void
) {
  const scenario = DEMO_SCENARIOS[key];
  const steps: AgentStep[] = scenario.steps.map((s) => ({
    ...s,
    status: "pending" as const,
  }));

  onStepUpdate([...steps]);

  for (let i = 0; i < scenario.steps.length; i++) {
    steps[i] = { ...steps[i], status: "running" };
    onStepUpdate([...steps]);
    await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));
    steps[i] = { ...scenario.steps[i] };
    onStepUpdate([...steps]);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  onComplete(scenario.response, steps);
}

export async function runAgentQuery(
  query: string,
  onStepUpdate: (steps: AgentStep[]) => void,
  onComplete: (response: string, steps: AgentStep[]) => void
) {
  const steps: AgentStep[] = AGENT_NODES.map((node) => ({
    node,
    status: "pending" as const,
    message: "Waiting...",
  }));

  onStepUpdate([...steps]);

  const nodeDurations = [50, 150, 900, 600, 500, 400];
  const nodeMessages = [
    "Checking domain validity and safety...",
    "Extracting intent and routing query...",
    "Searching latest agricultural data...",
    "Fetching live weather from Open-Meteo...",
    "Querying mandi and MSP prices...",
    "Synthesizing multilingual response...",
  ];

  for (let i = 0; i < AGENT_NODES.length; i++) {
    steps[i] = {
      node: AGENT_NODES[i],
      status: "running",
      message: nodeMessages[i],
    };
    onStepUpdate([...steps]);

    await new Promise((resolve) =>
      setTimeout(resolve, nodeDurations[i] + Math.random() * 200)
    );

    steps[i] = {
      node: AGENT_NODES[i],
      status: "completed",
      message: nodeMessages[i].replace("...", " ✓"),
      duration: nodeDurations[i],
    };
    onStepUpdate([...steps]);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const responses = [
    `Based on my analysis of your query about "${query.slice(0, 50)}": \n\nI've gathered real-time data from multiple sources. Current weather conditions, market prices, and agricultural best practices have been analyzed. Here are my recommendations specific to your farming needs.\n\nFor detailed guidance, I've considered seasonal patterns, local mandi prices, and government scheme eligibility in your region.`,
    `Regarding "${query.slice(0, 50)}":\n\n🌱 Agricultural Advisory:\nAfter analyzing weather patterns, market data, and pest alerts, here is your personalized action plan:\n\n1. Optimal timing: Next 5 days are suitable\n2. Market: Current prices are favorable  \n3. Weather: 70% chance of clear skies\n\nShould I provide more specific guidance on any aspect?`,
  ];

  onComplete(responses[Math.floor(Math.random() * responses.length)], steps);
}
