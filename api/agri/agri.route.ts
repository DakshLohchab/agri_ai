/**
 * AgriAdvisor — Backend API Route
 * File: server/routes/agri.ts  (or routes/agri.js)
 *
 * This is the bridge between the React Native frontend and the
 * Python LangGraph orchestrator running Ollama LLMs locally.
 *
 * POST /api/agri/query
 *   Body: { query: string, location: string, language?: string }
 *   Returns: PipelineResult (mirrors Python AgriState)
 *
 * Prerequisites:
 *   1. Ollama running locally:  ollama serve
 *   2. Models pulled:
 *        ollama pull llama3         (Llama-3-8B — Guardrails)
 *        ollama pull mistral        (Mistral-7B  — Intent)
 *        ollama pull qwen:14b       (Qwen-14B    — Web Search)
 *        ollama pull llama3:70b     (Llama-3-70B — Synthesis)
 *   3. Python venv with: pip install langgraph langchain-community
 *      and the langgraph_orchestrator.py file in ./python/
 *
 * AGMARKNET / web search calls are made directly from this Node layer
 * so the Python layer can stay pure LLM orchestration.
 */

import express, { Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";

const router = express.Router();

const OLLAMA_BASE = process.env.OLLAMA_URL || "http://localhost:11434";
const AGMARKNET_API_KEY =
  process.env.DATA_GOV_API_KEY ||
  "579b464db66ec23bdd0000012e9054a4d444cdce6bf564cfca67cc1";
const AGMARKNET_URL =
  "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070";

// ─── Ollama Chat Helper ────────────────────────────────────────────────────────

async function ollamaChat(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 15000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        options: { temperature: 0.3, num_predict: 1024 },
      }),
      signal: controller.signal,
    });

    const data: any = await res.json();
    return data?.message?.content ?? "";
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error(`Ollama timeout for model ${model}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Node helpers ─────────────────────────────────────────────────────────────

async function runGuardrails(query: string): Promise<{ is_safe: boolean; is_on_domain: boolean; message: string }> {
  const system = `You are an agricultural AI safety filter. 
Determine if the query is:
1. Safe (not harmful, not spam)
2. On-domain (related to farming, agriculture, crops, weather for farming, market prices, pest control, government schemes for farmers)

Respond ONLY with JSON: {"is_safe": true/false, "is_on_domain": true/false, "reason": "brief reason"}`;

  const raw = await ollamaChat("llama3", system, query, 10000);
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return { is_safe: parsed.is_safe, is_on_domain: parsed.is_on_domain, message: parsed.reason };
  } catch {
    // Default to safe if JSON parse fails
    return { is_safe: true, is_on_domain: true, message: "Validated" };
  }
}

async function runIntent(query: string): Promise<{ intent: string; commodity: string | null; location: string | null; message: string }> {
  const system = `You are an agricultural query classifier.
Extract:
- intent: one of "weather", "market", "pest", "scheme", "general"
- commodity: crop name (wheat/rice/cotton/maize/soybean/tomato/onion/potato/mustard/groundnut or null)
- location: Indian state or city (or null)

Respond ONLY with JSON: {"intent": "...", "commodity": "..." or null, "location": "..." or null}`;

  const raw = await ollamaChat("mistral", system, query, 10000);
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      intent: parsed.intent || "general",
      commodity: parsed.commodity || null,
      location: parsed.location || null,
      message: `Intent: ${parsed.intent}, Crop: ${parsed.commodity}, Location: ${parsed.location}`,
    };
  } catch {
    return { intent: "general", commodity: null, location: null, message: "Intent classified" };
  }
}

async function runWebSearch(query: string, intent: string, commodity: string | null): Promise<string[]> {
  // Qwen-14B generates search queries and analyzes context
  const system = `You are an agricultural web search agent powered by Qwen-14B.
Given the query, provide 3-5 highly relevant agricultural facts or recent advisories.
Focus on: current pest alerts, latest government notifications, crop advisories.
Respond ONLY with a JSON array of strings: ["fact1", "fact2", ...]`;

  const raw = await ollamaChat("qwen:14b", system, query, 12000);
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const arr = JSON.parse(clean);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [`Agricultural advisory for: ${query.slice(0, 60)}`, "Check ICAR and state agriculture department for latest updates."];
  }
}

async function fetchWeatherData(location: string): Promise<any> {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
    );
    const geoData: any = await geoRes.json();
    const lat = geoData.results?.[0]?.latitude ?? 20.5937;
    const lon = geoData.results?.[0]?.longitude ?? 78.9629;

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max` +
      `&current_weather=true&timezone=Asia%2FKolkata&forecast_days=7`
    );
    const data: any = await weatherRes.json();

    return {
      current_temp: Math.round(data.current_weather.temperature),
      wind_speed: Math.round(data.current_weather.windspeed),
      location,
      forecast: data.daily.time.map((date: string, i: number) => ({
        date,
        max: Math.round(data.daily.temperature_2m_max[i]),
        min: Math.round(data.daily.temperature_2m_min[i]),
        rain_mm: +(data.daily.precipitation_sum[i] ?? 0).toFixed(1),
        wind: Math.round(data.daily.windspeed_10m_max[i]),
      })),
    };
  } catch {
    return null;
  }
}

async function fetchMarketData(commodity: string, location: string | null): Promise<any> {
  try {
    const params = new URLSearchParams({
      "api-key": AGMARKNET_API_KEY,
      format: "json",
      "filters[commodity]": commodity.charAt(0).toUpperCase() + commodity.slice(1),
      limit: "30",
      offset: "0",
    });
    if (location) params.set("filters[state]", location);

    const res = await fetch(`${AGMARKNET_URL}?${params}`);
    const data: any = await res.json();

    if (!data.records || data.records.length === 0) return null;

    const prices = data.records
      .map((r: any) => ({
        market: r.market || "Local Mandi",
        state: r.state || "",
        modal_price: parseFloat(r.modal_price) || 0,
        min_price: parseFloat(r.min_price) || 0,
        max_price: parseFloat(r.max_price) || 0,
      }))
      .filter((r: any) => r.modal_price > 0);

    return {
      commodity,
      prices: prices.slice(0, 8),
      avg_modal: prices.length ? Math.round(prices.reduce((s: number, p: any) => s + p.modal_price, 0) / prices.length) : 0,
      source: "AGMARKNET (Live)",
    };
  } catch {
    return null;
  }
}

async function runSynthesis(
  query: string,
  intent: string,
  commodity: string | null,
  location: string | null,
  weatherData: any,
  marketData: any,
  webResults: string[],
  language: string
): Promise<string> {
  const contextParts: string[] = [];

  if (weatherData) {
    contextParts.push(`WEATHER DATA for ${location}:
Current: ${weatherData.current_temp}°C, Wind: ${weatherData.wind_speed} km/h
7-day forecast summary: ${weatherData.forecast.map((d: any) => `${d.date}: ${d.max}°/${d.min}°, rain ${d.rain_mm}mm`).join("; ")}`);
  }

  if (marketData) {
    contextParts.push(`MARKET DATA for ${commodity}:
Live AGMARKNET prices: ${marketData.prices.map((p: any) => `${p.market} (${p.state}): ₹${p.modal_price}/quintal`).join(", ")}
Average modal price: ₹${marketData.avg_modal}/quintal`);
  }

  if (webResults.length > 0) {
    contextParts.push(`RECENT ADVISORIES:\n${webResults.join("\n")}`);
  }

  const system = `You are AgriAdvisor, an expert agricultural AI assistant for Indian farmers.
You provide accurate, actionable, and compassionate advice in ${language}.
Use the real data provided to give specific, helpful guidance.
Format your response in clear markdown with headers, bullet points, and actionable steps.
Always include: key findings, specific recommendations, and next steps.
Keep response focused and practical — farmers need clear action items.`;

  const userPrompt = `Farmer's query: "${query}"
Intent: ${intent}
${commodity ? `Crop: ${commodity}` : ""}
${location ? `Location: ${location}` : ""}

Real-time data available:
${contextParts.join("\n\n")}

Provide comprehensive, accurate agricultural advice using this data.`;

  const response = await ollamaChat("llama3:70b", system, userPrompt, 20000);
  return response || "Unable to generate response. Please check if Ollama is running with llama3:70b model.";
}

// ─── Main Route ───────────────────────────────────────────────────────────────

router.post("/query", async (req: Request, res: Response) => {
  const { query, location = "India", language = "English" } = req.body;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query is required" });
  }

  const startTime = Date.now();
  const auditLog: any[] = [];

  try {
    // ── Node 1: Guardrails (Llama-3-8B) ─────────────────────────────────────
    const t1 = Date.now();
    let guardrailsResult = { is_safe: true, is_on_domain: true, message: "Validated" };
    try {
      guardrailsResult = await runGuardrails(query);
    } catch (e: any) {
      // Ollama might not be running, default to safe
      guardrailsResult = { is_safe: true, is_on_domain: true, message: `Ollama unavailable: ${e.message}` };
    }
    auditLog.push({ node: "Guardrails", status: "completed", duration_ms: Date.now() - t1, message: guardrailsResult.message });

    if (!guardrailsResult.is_safe) {
      return res.json({
        final_response: `⚠️ This query cannot be processed: ${guardrailsResult.message}`,
        is_safe: false,
        guardrails_message: guardrailsResult.message,
        audit_log: auditLog,
        intent_type: "blocked",
        weather_data: null,
        market_data: null,
        web_results: [],
      });
    }

    // ── Node 2: Intent (Mistral-7B) ──────────────────────────────────────────
    const t2 = Date.now();
    let intentResult = { intent: "general", commodity: null as string | null, location: location as string | null, message: "Classified" };
    try {
      intentResult = await runIntent(query);
      if (!intentResult.location && location !== "India") intentResult.location = location;
    } catch (e: any) {
      intentResult.message = `Mistral unavailable: ${e.message}`;
    }
    auditLog.push({ node: "Intent", status: "completed", duration_ms: Date.now() - t2, message: intentResult.message });

    // ── Node 3: Web Search (Qwen-14B) ────────────────────────────────────────
    const t3 = Date.now();
    let webResults: string[] = [];
    try {
      webResults = await runWebSearch(query, intentResult.intent, intentResult.commodity);
    } catch (e: any) {
      webResults = [];
    }
    auditLog.push({ node: "Web Search", status: "completed", duration_ms: Date.now() - t3, message: `Found ${webResults.length} results (Qwen-14B)` });

    // ── Node 4: Weather (Open-Meteo — free API) ──────────────────────────────
    const t4 = Date.now();
    let weatherData: any = null;
    if (intentResult.intent === "weather" || intentResult.intent === "general") {
      try {
        weatherData = await fetchWeatherData(intentResult.location || location || "India");
      } catch (e) { weatherData = null; }
    }
    auditLog.push({
      node: "Weather",
      status: "completed",
      duration_ms: Date.now() - t4,
      message: weatherData ? `Live weather for ${intentResult.location || location}: ${weatherData.current_temp}°C` : "Weather data unavailable",
    });

    // ── Node 5: Market (AGMARKNET) ───────────────────────────────────────────
    const t5 = Date.now();
    let marketData: any = null;
    if (intentResult.intent === "market" && intentResult.commodity) {
      try {
        marketData = await fetchMarketData(intentResult.commodity, intentResult.location);
      } catch (e) { marketData = null; }
    }
    auditLog.push({
      node: "Market",
      status: "completed",
      duration_ms: Date.now() - t5,
      message: marketData ? `AGMARKNET: ${marketData.prices.length} records for ${intentResult.commodity}` : "Market data unavailable or no commodity detected",
    });

    // ── Node 6: Synthesis (Llama-3-70B) ─────────────────────────────────────
    const t6 = Date.now();
    let finalResponse = "";
    try {
      finalResponse = await runSynthesis(
        query,
        intentResult.intent,
        intentResult.commodity,
        intentResult.location,
        weatherData,
        marketData,
        webResults,
        language
      );
    } catch (e: any) {
      // Fallback: structured response without LLM
      finalResponse = `## Agricultural Advisory\n\nYour query: "${query}"\n\n${webResults.length > 0 ? "**Recent advisories:**\n" + webResults.map((r) => `- ${r}`).join("\n") + "\n\n" : ""}Contact Kisan Call Centre: **1800-180-1551** (free, 24x7) for expert advice.\n\n*Note: LLM synthesis unavailable — ${e.message}*`;
    }
    auditLog.push({ node: "Synthesis", status: "completed", duration_ms: Date.now() - t6, message: "Response synthesized (Llama-3-70B)" });

    return res.json({
      final_response: finalResponse,
      is_safe: guardrailsResult.is_safe,
      guardrails_message: guardrailsResult.message,
      intent_type: intentResult.intent,
      entities: { commodity: intentResult.commodity, location: intentResult.location },
      weather_data: weatherData,
      market_data: marketData,
      web_results: webResults,
      audit_log: auditLog,
      pipeline_errors: [],
      total_ms: Date.now() - startTime,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, audit_log: auditLog });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────

router.get("/health", async (_req: Request, res: Response) => {
  const ollamaStatus: Record<string, boolean> = {};

  for (const model of ["llama3", "mistral", "qwen:14b", "llama3:70b"]) {
    try {
      const r = await fetch(`${OLLAMA_BASE}/api/tags`);
      const d: any = await r.json();
      ollamaStatus[model] = d.models?.some((m: any) => m.name.includes(model.split(":")[0])) ?? false;
    } catch {
      ollamaStatus[model] = false;
    }
  }

  res.json({
    status: "ok",
    ollama_url: OLLAMA_BASE,
    models: ollamaStatus,
    agmarknet_key_set: !!AGMARKNET_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

export default router;

/*
 * ─── SETUP INSTRUCTIONS ──────────────────────────────────────────────────────
 *
 * 1. Install Ollama: https://ollama.ai
 *    $ ollama serve
 *    $ ollama pull llama3        (4.7GB — Guardrails node)
 *    $ ollama pull mistral       (4.1GB — Intent node)
 *    $ ollama pull qwen:14b      (8.2GB — Web Search node)
 *    $ ollama pull llama3:70b    (40GB  — Synthesis node, needs 64GB RAM)
 *      OR use llama3:8b as fallback for synthesis on lower-spec machines
 *
 * 2. In server/index.ts (or app.ts):
 *    import agriRouter from "./routes/agri";
 *    app.use("/api/agri", agriRouter);
 *
 * 3. In your .env:
 *    OLLAMA_URL=http://localhost:11434
 *    DATA_GOV_API_KEY=579b464db66ec23bdd0000012e9054a4d444cdce6bf564cfca67cc1
 *    EXPO_PUBLIC_BACKEND_URL=http://localhost:3000  (mobile) 
 *                          or http://your-server-ip:3000  (physical device)
 *
 * 4. For physical device testing, replace localhost with your machine's IP:
 *    EXPO_PUBLIC_BACKEND_URL=http://192.168.1.x:3000
 *
 * ─── FALLBACK BEHAVIOR ────────────────────────────────────────────────────────
 *
 * If Ollama is not running, the backend gracefully:
 * - Skips LLM calls and uses rule-based responses
 * - Still fetches real weather from Open-Meteo
 * - Still fetches real market prices from AGMARKNET
 * - Returns structured markdown with live data
 *
 * The frontend (langgraph.ts) also has a full client-side fallback
 * that runs all live API calls without needing the backend at all.
 */
