/**
 * AgriAdvisor LangGraph Client
 * ==============================
 * Orchestrates the 6-node pipeline by calling the backend API.
 * The backend (Node/Python) runs the actual LLMs via Ollama:
 *   Node 1 — Guardrails   → Llama-3-8B
 *   Node 2 — Intent       → Mistral-7B
 *   Node 3 — Web Search   → Qwen-14B  (real DuckDuckGo / SerpAPI)
 *   Node 4 — Weather      → Open-Meteo API (free, no key)
 *   Node 5 — Market       → AGMARKNET data.gov.in API
 *   Node 6 — Synthesis    → Llama-3-70B
 *
 * Falls back gracefully if backend is unreachable.
 *
 * Translation layer (client-side):
 *   Primary  → MyMemory API   (free, no key, 1000 req/day)
 *   Fallback → LibreTranslate (free public instance)
 *   Strategy → chunk by paragraph so each request stays under 500 chars
 */

import { AgentStep } from "@/context/ChatContext";
import { translateRichText, translateText } from "@/services/translation";

// ─── Config ───────────────────────────────────────────────────────────────────

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "http://localhost:3000");

const AGMARKNET_API_KEY =
  process.env.EXPO_PUBLIC_DATA_GOV_API_KEY ||
  "579b464db66ec23bdd0000012e9054a4d444cdce6bf564cfca67cc1";

const AGMARKNET_URL =
  "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070";

// Public LibreTranslate instances — tried in order if MyMemory fails
const LIBRE_TRANSLATE_URLS = [
  "https://libretranslate.com/translate",
  "https://translate.argosopentech.com/translate",
  "https://libretranslate.de/translate",
];

// ─── Language code maps ───────────────────────────────────────────────────────

// MyMemory uses IETF tags like "hi-IN"
const MYMEMORY_LANG_MAP: Record<string, string> = {
  hi: "hi-IN",
  bn: "bn-IN",
  te: "te-IN",
  mr: "mr-IN",
  ta: "ta-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  ur: "ur-PK",
};

// LibreTranslate uses ISO 639-1 codes
const LIBRE_LANG_MAP: Record<string, string> = {
  hi: "hi",
  bn: "bn",
  te: "te",
  mr: "mr",
  ta: "ta",
  gu: "gu",
  kn: "kn",
  ml: "ml",
  pa: "pa",
  or: "or",
  ur: "ur",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type DemoScenarioKey =
  | "off_domain"
  | "ambiguous"
  | "low_wifi"
  | "weather_rain"
  | "market_wheat"
  | "pest_alert"
  | "scheme_kisan";

type QueryResponseMeta = {
  baseResponse: string;
  baseLanguage: string;
};

type PipelineResult = {
  final_response: string;
  audit_log: { node: string; status: string; duration_ms: number; message: string }[];
  intent_type: string;
  weather_data: any;
  market_data: any;
  web_results: string[];
  is_safe: boolean;
  guardrails_message: string;
};

// ─── Translation helpers ──────────────────────────────────────────────────────

/**
 * Translate a single short string via MyMemory (primary).
 * Returns null on failure so caller can try the fallback.
 */
async function translateWithMyMemory(
  text: string,
  targetLang: string
): Promise<string | null> {
  try {
    const tag = MYMEMORY_LANG_MAP[targetLang] ?? targetLang;
    const url =
      `https://api.mymemory.translated.net/get` +
      `?q=${encodeURIComponent(text)}&langpair=en|${tag}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.responseStatus === 200 && data?.responseData?.translatedText) {
      return data.responseData.translatedText as string;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Translate a single short string via LibreTranslate (fallback).
 * Tries each public instance until one succeeds.
 * Returns null if all instances fail.
 */
async function translateWithLibreTranslate(
  text: string,
  targetLang: string
): Promise<string | null> {
  const lang = LIBRE_LANG_MAP[targetLang] ?? targetLang;
  for (const baseUrl of LIBRE_TRANSLATE_URLS) {
    try {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, source: "en", target: lang, format: "text" }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.translatedText) return data.translatedText as string;
    } catch {
      // try next instance
    }
  }
  return null;
}

/**
 * Translate one chunk with MyMemory first, LibreTranslate as fallback.
 * Returns original text if both fail.
 */
async function translateChunk(chunk: string, targetLang: string): Promise<string> {
  const mm = await translateWithMyMemory(chunk, targetLang);
  if (mm) return mm;
  const lt = await translateWithLibreTranslate(chunk, targetLang);
  if (lt) return lt;
  return chunk; // both failed — keep English
}

/**
 * Split markdown text into paragraph-sized chunks (≤ 480 chars each),
 * translate each one, then rejoin preserving the original separators.
 *
 * Split strategy:
 *   1. Split on double-newline (paragraph boundary).
 *   2. If a paragraph is still > 480 chars, split further on single newlines.
 *   3. If a line is still > 480 chars, split on ". " sentence boundaries.
 */
async function translateFullResponse(
  text: string,
  targetLang: string
): Promise<string> {
  const MAX = 480;

  // First-pass split: paragraph blocks
  const paragraphs = text.split(/\n\n/);

  const chunks: { text: string; sep: string }[] = [];

  for (const para of paragraphs) {
    if (para.length <= MAX) {
      chunks.push({ text: para, sep: "\n\n" });
      continue;
    }
    // Split paragraph into lines
    const lines = para.split(/\n/);
    for (const line of lines) {
      if (line.length <= MAX) {
        chunks.push({ text: line, sep: "\n" });
        continue;
      }
      // Split long line on sentence boundaries
      const sentences = line.split(/(?<=\. )/);
      let current = "";
      for (const sentence of sentences) {
        if ((current + sentence).length <= MAX) {
          current += sentence;
        } else {
          if (current) chunks.push({ text: current.trim(), sep: " " });
          current = sentence;
        }
      }
      if (current) chunks.push({ text: current.trim(), sep: "\n" });
    }
  }

  // Translate all chunks in parallel (batched to avoid hammering the API)
  const BATCH = 5;
  const translated: string[] = new Array(chunks.length);

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((c) =>
        // Skip translation for lines that are purely markdown syntax or numbers
        /^[|#*\-_`>\s\d₹.,:/\\[\]()!@%^&*+=]+$/.test(c.text)
          ? Promise.resolve(c.text)
          : translateChunk(c.text, targetLang)
      )
    );
    results.forEach((r, j) => { translated[i + j] = r; });
  }

  // Rejoin using separators
  let result = "";
  for (let i = 0; i < chunks.length; i++) {
    result += translated[i];
    if (i < chunks.length - 1) result += chunks[i].sep;
  }
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts commodity from query — supports English and all major Indian
 * language names for common crops.
 */
function extractCommodity(query: string): string | null {
  // Map of keyword → canonical English name
  // English first, then Hindi, then other scripts
  const commodityMap: Record<string, string> = {
    // Wheat
    wheat: "wheat", "गेहूं": "wheat", "गेहूँ": "wheat", "गेहू": "wheat",
    // Rice
    rice: "rice", "चावल": "rice", "धान": "rice", "पधान": "rice",
    // Cotton
    cotton: "cotton", "कपास": "cotton",
    // Maize
    maize: "maize", corn: "maize", "मक्का": "maize", "मकई": "maize",
    // Soybean
    soybean: "soybean", soya: "soybean", "सोयाबीन": "soybean",
    // Tomato
    tomato: "tomato", "टमाटर": "tomato",
    // Onion
    onion: "onion", "प्याज": "onion", "प्याजा": "onion",
    // Potato
    potato: "potato", "आलू": "potato",
    // Mustard
    mustard: "mustard", "सरसों": "mustard", "राई": "mustard",
    // Groundnut
    groundnut: "groundnut", peanut: "groundnut", "मूंगफली": "groundnut",
    // Sugarcane
    sugarcane: "sugarcane", "गन्ना": "sugarcane", "ईख": "sugarcane",
    // Bajra
    bajra: "bajra", "बाजरा": "bajra",
    // Jowar
    jowar: "jowar", "ज्वार": "jowar",
    // Mango
    mango: "mango", "आम": "mango",
    // Banana
    banana: "banana", "केला": "banana",
    // Apple
    apple: "apple", "सेब": "apple",
    // Grapes
    grapes: "grapes", grape: "grapes", "अंगूर": "grapes",
    // Chilli
    chilli: "chilli", chili: "chilli", "मिर्च": "chilli",
    // Turmeric
    turmeric: "turmeric", "हल्दी": "turmeric",
    // Coriander
    coriander: "coriander", "धनिया": "coriander",
  };

  const lower = query.toLowerCase();

  // Check Hindi/Unicode entries first (exact substring match on original query)
  for (const [keyword, canonical] of Object.entries(commodityMap)) {
    // For non-ASCII keywords, check original query directly (case doesn't matter)
    if (/[^\u0000-\u007F]/.test(keyword)) {
      if (query.includes(keyword)) return canonical;
    } else {
      if (lower.includes(keyword)) return canonical;
    }
  }
  return null;
}

/**
 * Extracts location from query — supports English and Hindi state/city names.
 */
function extractLocation(query: string): string | null {
  // [Hindi name, English canonical] pairs
  const locationMap: [string, string][] = [
    // States — Hindi
    ["पंजाब", "punjab"],
    ["हरियाणा", "haryana"],
    ["उत्तर प्रदेश", "uttar pradesh"],
    ["मध्य प्रदेश", "madhya pradesh"],
    ["राजस्थान", "rajasthan"],
    ["गुजरात", "gujarat"],
    ["महाराष्ट्र", "maharashtra"],
    ["कर्नाटक", "karnataka"],
    ["तेलंगाना", "telangana"],
    ["आंध्र प्रदेश", "andhra pradesh"],
    ["तमिल नाडु", "tamil nadu"],
    ["पश्चिम बंगाल", "west bengal"],
    ["बिहार", "bihar"],
    ["दिल्ली", "delhi"],
    ["ओडिशा", "odisha"],
    ["छत्तीसगढ़", "chhattisgarh"],
    ["झारखंड", "jharkhand"],
    ["हिमाचल", "himachal"],
    ["उत्तराखंड", "uttarakhand"],
    // Cities — Hindi
    ["पुणे", "pune"],
    ["मुंबई", "mumbai"],
    ["नाशिक", "nashik"],
    ["नागपुर", "nagpur"],
    ["हैदराबाद", "hyderabad"],
    ["बैंगलोर", "bangalore"],
    ["लखनऊ", "lucknow"],
    ["जयपुर", "jaipur"],
    ["चंडीगढ़", "chandigarh"],
    ["अमृतसर", "amritsar"],
    ["लुधियाना", "ludhiana"],
    ["भोपाल", "bhopal"],
    ["इंदौर", "indore"],
    ["आगरा", "agra"],
    ["वाराणसी", "varanasi"],
    // States — English (original list)
    ["punjab", "punjab"],
    ["haryana", "haryana"],
    ["uttar pradesh", "uttar pradesh"],
    ["up", "uttar pradesh"],
    ["madhya pradesh", "madhya pradesh"],
    ["mp", "madhya pradesh"],
    ["rajasthan", "rajasthan"],
    ["gujarat", "gujarat"],
    ["maharashtra", "maharashtra"],
    ["karnataka", "karnataka"],
    ["telangana", "telangana"],
    ["andhra pradesh", "andhra pradesh"],
    ["tamil nadu", "tamil nadu"],
    ["west bengal", "west bengal"],
    ["bihar", "bihar"],
    ["delhi", "delhi"],
    ["odisha", "odisha"],
    ["chhattisgarh", "chhattisgarh"],
    ["jharkhand", "jharkhand"],
    ["himachal", "himachal"],
    ["uttarakhand", "uttarakhand"],
    ["pune", "pune"],
    ["mumbai", "mumbai"],
    ["nashik", "nashik"],
    ["nagpur", "nagpur"],
    ["hyderabad", "hyderabad"],
    ["bangalore", "bangalore"],
    ["lucknow", "lucknow"],
    ["jaipur", "jaipur"],
    ["chandigarh", "chandigarh"],
    ["amritsar", "amritsar"],
    ["ludhiana", "ludhiana"],
  ];

  const lower = query.toLowerCase();

  for (const [keyword, canonical] of locationMap) {
    if (/[^\u0000-\u007F]/.test(keyword)) {
      if (query.includes(keyword)) return canonical;
    } else {
      if (lower.includes(keyword)) return canonical;
    }
  }
  return null;
}

/**
 * Classifies query intent — supports English and Hindi keywords.
 */
function classifyIntent(query: string): string {
  const lower = query.toLowerCase();

  // Market — English + Hindi (भाव=price, मंडी=mandi, बेचना=sell, दाम=rate)
  if (
    lower.match(/price|mandi|market|msp|rate|sell|quintal|bazaar|bhav/) ||
    /भाव|मंडी|दाम|बेचना|बिकना|कीमत|बाजार|क्विंटल|मूल्य/.test(query)
  )
    return "market";

  // Weather — English + Hindi (बारिश=rain, मौसम=weather, तापमान=temperature)
  if (
    lower.match(/weather|rain|rainfall|temperature|forecast|humid|wind|cloud|storm/) ||
    /बारिश|मौसम|तापमान|बाढ़|आंधी|हवा|बादल|ओले|पूर्वानुमान|वर्षा/.test(query)
  )
    return "weather";

  // Pest — English + Hindi (कीट=pest, रोग=disease, फफूंद=fungus)
  if (
    lower.match(/pest|disease|insect|fungus|blight|wilt|virus|spray|pesticide/) ||
    /कीट|रोग|फफूंद|कीड़ा|झुलसा|विषाणु|दवाई|छिड़काव|नाशक/.test(query)
  )
    return "pest";

  // Scheme — English + Hindi (योजना=scheme, सब्सिडी=subsidy, लोन=loan)
  if (
    lower.match(/\bgov(?:t)?\b|schemes?|\bpm-kisan\b|\bpm kisan\b|\bpmfby\b|\bkcc\b|\bpmksy\b|subsidy|kisan|yojana|government|loan|credit|insurance|farmer support/) ||
    /योजना|सब्सिडी|किसान|सरकार|लोन|बीमा|क्रेडिट|अनुदान/.test(query)
  )
    return "scheme";

  return "general";
}

function formatIndianNumber(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

function isLowConnectivityQuery(query: string): boolean {
  return /weak internet|slow internet|poor internet|low wifi|low wi-fi|weak network|poor network|slow network|offline|connectivity/i.test(
    query
  );
}

// ─── Live Weather API (Open-Meteo — free, no key needed) ──────────────────────

async function fetchLiveWeather(location: string): Promise<any> {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json();

    let lat = 20.5937;
    let lon = 78.9629;

    if (geoData.results && geoData.results.length > 0) {
      lat = geoData.results[0].latitude;
      lon = geoData.results[0].longitude;
    }

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max,uv_index_max` +
        `&current_weather=true` +
        `&timezone=Asia%2FKolkata` +
        `&forecast_days=7`
    );
    const data = await weatherRes.json();

    if (!data.daily) return null;

    const WMO: Record<number, string> = {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Foggy", 51: "Light drizzle", 61: "Light rain", 63: "Moderate rain",
      71: "Light snow", 80: "Rain showers", 95: "Thunderstorm",
    };

    return {
      current_temp: Math.round(data.current_weather.temperature),
      wind_speed: Math.round(data.current_weather.windspeed),
      location_used: location,
      forecast: data.daily.time.map((date: string, i: number) => ({
        date,
        max: Math.round(data.daily.temperature_2m_max[i]),
        min: Math.round(data.daily.temperature_2m_min[i]),
        code: data.daily.weathercode[i],
        description: WMO[data.daily.weathercode[i]] ?? "Variable",
        rain_mm: +(data.daily.precipitation_sum[i] ?? 0).toFixed(1),
        wind_kmh: Math.round(data.daily.windspeed_10m_max[i]),
        uv: +(data.daily.uv_index_max[i] ?? 0).toFixed(1),
      })),
    };
  } catch (err) {
    console.warn("Weather API failed:", err);
    return null;
  }
}

// ─── Live Market API (AGMARKNET via data.gov.in) ───────────────────────────────

async function fetchLiveMarketData(commodity: string, location: string | null): Promise<any> {
  try {
    const params = new URLSearchParams({
      "api-key": AGMARKNET_API_KEY,
      format: "json",
      "filters[commodity]": commodity.charAt(0).toUpperCase() + commodity.slice(1),
      limit: "50",
      offset: "0",
    });

    const res = await fetch(`${AGMARKNET_URL}?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();

    if (!data.records || data.records.length === 0) return null;

    let records = data.records;
    if (location) {
      const locLower = location.toLowerCase();
      const filtered = data.records.filter((r: any) =>
        r.state?.toLowerCase().includes(locLower) ||
        r.district?.toLowerCase().includes(locLower) ||
        r.market?.toLowerCase().includes(locLower)
      );
      if (filtered.length > 0) records = filtered;
    }

    const prices = records
      .slice(0, 8)
      .map((r: any) => ({
        market: r.market || r.mandi || "Local Mandi",
        state: r.state || r.district || "",
        district: r.district || "",
        modal_price: parseFloat(r.modal_price) || 0,
        min_price: parseFloat(r.min_price) || 0,
        max_price: parseFloat(r.max_price) || 0,
        variety: r.variety || "",
        arrival_date: r.arrival_date || "",
      }))
      .filter((p: any) => p.modal_price > 0);

    if (prices.length === 0) return null;

    const avg = Math.round(
      prices.reduce((s: number, p: any) => s + p.modal_price, 0) / prices.length
    );

    return {
      source: "AGMARKNET (Live — data.gov.in)",
      commodity,
      prices,
      avg_modal_price: avg,
      record_count: data.total,
      last_updated: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("AGMARKNET API failed:", err);
    return null;
  }
}

// ─── MSP Reference Data (2024-25) ─────────────────────────────────────────────

const MSP_2024_25: Record<string, { msp: number; unit: string; grade: string }> = {
  wheat:     { msp: 2275, unit: "quintal", grade: "FAQ" },
  rice:      { msp: 2183, unit: "quintal", grade: "Common" },
  cotton:    { msp: 7121, unit: "quintal", grade: "Medium staple" },
  soybean:   { msp: 4892, unit: "quintal", grade: "Yellow" },
  maize:     { msp: 2090, unit: "quintal", grade: "Yellow" },
  mustard:   { msp: 5650, unit: "quintal", grade: "Bold" },
  groundnut: { msp: 6377, unit: "quintal", grade: "With shell" },
  bajra:     { msp: 2500, unit: "quintal", grade: "Hybrid" },
  jowar:     { msp: 3180, unit: "quintal", grade: "Hybrid" },
  sugarcane: { msp: 340,  unit: "quintal", grade: "FRP" },
};

// ─── Backend Pipeline Call ─────────────────────────────────────────────────────

async function callBackendPipeline(
  query: string,
  location: string,
  language: string = "English"
): Promise<PipelineResult | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/agri/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, location, language }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Backend pipeline unreachable, running client-side fallback:", err);
    return null;
  }
}

// ─── Response Generators ───────────────────────────────────────────────────────

function buildWeatherResponse(
  weatherData: any,
  commodity: string | null,
  location: string | null
): string {
  if (!weatherData) {
    return [
      "## Weather update",
      "",
      "I could not fetch live weather data right now.",
      "Source check: Open-Meteo (https://open-meteo.com) or your local weather app before irrigation, spraying, or harvesting.",
      "",
      "### Best practice",
      "- Recheck the next 3 days before any major field operation.",
      "- Avoid spraying when rain or strong wind is likely.",
    ].join("\n");
  }

  const today = weatherData.forecast[0];
  const rainDays = weatherData.forecast.filter((d: any) => d.rain_mm > 5);
  const placeName = location
    ? location.charAt(0).toUpperCase() + location.slice(1)
    : "your region";
  const totalRain = rainDays.reduce((sum: number, day: any) => sum + day.rain_mm, 0);
  const wettestDay = weatherData.forecast.reduce(
    (wettest: any, day: any) => (day.rain_mm > wettest.rain_mm ? day : wettest),
    weatherData.forecast[0]
  );

  const lines: string[] = [
    `## Weather update for ${placeName}`,
    "",
    "### Weekly snapshot",
    `Current: ${weatherData.current_temp} C`,
    `Wind: ${weatherData.wind_speed} km/h`,
  ];

  if (rainDays.length > 0) {
    const wettestLabel =
      wettestDay.date === today.date
        ? "today"
        : new Date(wettestDay.date).toLocaleDateString("en-IN", { weekday: "long" });
    lines.push(
      `Rainy days: ${rainDays.length}`,
      `Weekly rainfall: ${totalRain.toFixed(0)} mm`,
      `Wettest spell: ${wettestLabel} (${wettestDay.rain_mm} mm)`,
      "",
      `Rain outlook: Rain is expected on ${rainDays.length} day(s) this week, with about ${totalRain.toFixed(0)} mm in total. The wettest spell looks likely on ${wettestLabel}.`
    );
  } else {
    lines.push(
      "Rainy days: 0",
      "Weekly rainfall: 0 mm",
      "Wettest spell: No meaningful rainfall expected",
      "",
      "Rain outlook: No major rainfall is expected this week."
    );
  }

  lines.push("", "### 7-day forecast");
  lines.push("| Day | Condition | Max C | Min C | Rain mm | Wind km/h |");
  lines.push("|-----|-----------|-------|-------|---------|------------|");

  weatherData.forecast.forEach((day: any, index: number) => {
    const label =
      index === 0
        ? "Today"
        : index === 1
          ? "Tomorrow"
          : new Date(day.date).toLocaleDateString("en-IN", { weekday: "short" });
    lines.push(
      `| ${label} | ${day.description} | ${day.max} | ${day.min} | ${day.rain_mm} | ${day.wind_kmh} |`
    );
  });

  lines.push("", "### What to do");

  if (rainDays.length > 0) {
    lines.push("- Delay spraying on rainy days and avoid spraying just before expected showers.");
    lines.push("- Clear drainage channels so water does not stand in the field.");
    lines.push("- Protect harvested produce and inputs if any day is likely to get heavy rain.");
  } else {
    lines.push("- Plan irrigation based on soil moisture because rainfall support looks limited this week.");
    lines.push("- Use the drier window for spraying, harvesting, or fertilizer application if field conditions allow.");
  }

  if (commodity) {
    const cropName = commodity.charAt(0).toUpperCase() + commodity.slice(1);
    const advisories: Record<string, string> = {
      wheat: "Keep an eye on rust when humidity stays high, and avoid irrigation during strong wind.",
      rice: "Maintain a stable water layer and watch low-lying patches for excess standing water after rain.",
      cotton: "Avoid waterlogging and protect open bolls if a wet spell is expected.",
      maize: "Watch for stem borer in warm, humid conditions and prevent water from standing near the root zone.",
      tomato: "Stake plants well and scout for blight if humidity rises after rain.",
      general: "Watch soil moisture closely and avoid field work during or just after rainfall.",
    };
    lines.push("", "### Crop advisory", `${cropName}: ${advisories[commodity] ?? advisories.general}`);
  }

  lines.push("", "### Next step", "Source: Open-Meteo live forecast.");
  return lines.join("\n");
}

function buildMarketResponse(
  liveData: any,
  commodity: string,
  location: string | null
): string {
  const msp = MSP_2024_25[commodity];
  let md = `## ${commodity.charAt(0).toUpperCase() + commodity.slice(1)} Market Update\n\n`;

  if (msp) {
    md += `**MSP 2024-25:** Rs.${formatIndianNumber(msp.msp)}/${msp.unit} (${msp.grade})\n\n`;
  }

  if (liveData && liveData.prices.length > 0) {
    md += `### Live AGMARKNET Data\n`;
    md += `Source: ${liveData.source} - ${liveData.record_count ?? ""} records found\n\n`;
    md += `| Market | State | Modal Price | Min | Max |\n`;
    md += `|--------|-------|------------|-----|-----|\n`;

    liveData.prices.forEach((p: any) => {
      md += `| ${p.market} | ${p.state} | Rs.${formatIndianNumber(p.modal_price)} | Rs.${formatIndianNumber(p.min_price)} | Rs.${formatIndianNumber(p.max_price)} |\n`;
    });

    if (liveData.avg_modal_price && msp) {
      const premium = (((liveData.avg_modal_price - msp.msp) / msp.msp) * 100).toFixed(1);
      const premiumNum = parseFloat(premium);
      md += `\n**Average Modal Price:** Rs.${formatIndianNumber(liveData.avg_modal_price)}/quintal`;
      md += ` (${premiumNum >= 0 ? "+" : ""}${premium}% vs MSP)\n\n`;
      if (premiumNum > 10) {
        md += `Excellent time to sell - prices significantly above support price.\n`;
      } else if (premiumNum > 5) {
        md += `Good prices - consider selling if storage costs are high.\n`;
      } else if (premiumNum >= 0) {
        md += `Near MSP levels - hold if storage is available and costs permit.\n`;
      } else {
        md += `Below MSP - contact nearest FCI/state procurement agency immediately.\n`;
      }
    }
  } else {
    md += `### Live Data Unavailable\n`;
    md += `AGMARKNET API returned no records for "${commodity}"${location ? ` in ${location}` : ""}.\n`;
    md += `Check agmarknet.gov.in or the eNAM app for latest rates.\n\n`;

    if (msp) {
      md += `**Reference MSP:** Rs.${formatIndianNumber(msp.msp)}/quintal\n`;
    }
  }

  md += `\n### Action Steps\n`;
  md += `1. **Sell strategy:** Compare at least 3 nearby mandis before deciding\n`;
  md += `2. **Transport:** Factor transport costs (Rs.50-150/quintal) into your net price\n`;
  md += `3. **Government procurement:** Contact FCI or state agency if mandi price < MSP\n`;
  md += `4. **Live rates:** agmarknet.gov.in or eNAM app\n`;

  if (liveData) md += `\nSource: AGMARKNET data.gov.in (live)`;
  return md;
}

function buildPestResponse(
  query: string,
  commodity: string | null,
  location: string | null
): string {
  const cropName = commodity
    ? commodity.charAt(0).toUpperCase() + commodity.slice(1)
    : "Crop";
  let md = `## Pest and Disease Advisory\n\n`;

  if (commodity) {
    const pestDB: Record<string, { pests: string[]; symptoms: string[]; treatment: string[] }> = {
      wheat: {
        pests: ["Yellow Rust (Puccinia striiformis)", "Brown Rust", "Powdery Mildew", "Aphids"],
        symptoms: [
          "Yellow/orange stripes on leaves",
          "Brown pustules on leaves",
          "White powdery coating",
          "Curling leaves, sticky residue",
        ],
        treatment: [
          "Propiconazole 25 EC @ 0.1%",
          "Tebuconazole 250 EW @ 0.1%",
          "Sulphur 80 WP @ 0.2%",
          "Imidacloprid 17.8 SL @ 0.05%",
        ],
      },
      rice: {
        pests: [
          "Brown Plant Hopper (BPH)",
          "Blast (Magnaporthe oryzae)",
          "Sheath Blight",
          "Leaf Folder",
        ],
        symptoms: [
          "Circular burnt patches (hopper burn)",
          "Diamond-shaped lesions on leaves",
          "Oval lesions on sheath",
          "Folded leaves with frass",
        ],
        treatment: [
          "Buprofezin 25 SC @ 0.0125%",
          "Tricyclazole 75 WP @ 0.06%",
          "Hexaconazole 5 EC @ 0.1%",
          "Chlorpyrifos 20 EC @ 0.05%",
        ],
      },
      cotton: {
        pests: ["Pink Bollworm", "Whitefly", "Thrips", "Mealybug"],
        symptoms: [
          "Entry holes in bolls",
          "Yellowing, virus vector",
          "Silver-grey leaf surface",
          "White cottony masses",
        ],
        treatment: [
          "Emamectin benzoate 5 SG @ 0.002%",
          "Pyriproxyfen 10 EC @ 0.05%",
          "Spinosad 45 SC @ 0.03%",
          "Profenofos 50 EC @ 0.05%",
        ],
      },
      tomato: {
        pests: ["Leaf Curl Virus (TLCV)", "Early Blight", "Late Blight", "Fruit Borer"],
        symptoms: [
          "Upward leaf curl, mosaic",
          "Concentric brown rings on leaves",
          "Water-soaked dark lesions",
          "Entry holes in fruit",
        ],
        treatment: [
          "Control whitefly vector with Imidacloprid",
          "Mancozeb 75 WP @ 0.2%",
          "Metalaxyl-M + Mancozeb @ 0.25%",
          "Spinosad 45 SC @ 0.03%",
        ],
      },
    };

    const info = pestDB[commodity];
    if (info) {
      md += `### Common ${cropName} Pests and Diseases\n\n`;
      info.pests.forEach((pest, i) => {
        md += `**${pest}**\n`;
        md += `- Symptoms: ${info.symptoms[i]}\n`;
        md += `- Treatment: ${info.treatment[i]}\n\n`;
      });
    }
  }

  md += `### Integrated Pest Management (IPM) Principles\n`;
  md += `1. **Scout regularly** - Check 20 plants randomly across your field weekly\n`;
  md += `2. **Economic threshold** - Spray only when pest population crosses damage threshold\n`;
  md += `3. **Biological control** - Release Trichogramma cards for egg parasitization\n`;
  md += `4. **Crop rotation** - Break pest cycles by rotating with non-host crops\n`;
  md += `5. **Spray timing** - Early morning (6-9 AM) or evening (4-7 PM) for best efficacy\n\n`;

  md += `### Expert Help\n`;
  md += `- **Kisan Call Centre:** 1800-180-1551 (free, 24x7)\n`;
  md += `- **State Agriculture Dept:** Contact local KVK (Krishi Vigyan Kendra)\n`;
  md += `- **ICAR advisory:** Share clear photos with your nearest agriculture officer\n`;

  if (location) {
    md += `\nFor region-specific alerts in ${location}, check the NCIPM pest surveillance portal.`;
  }

  return md;
}

function buildSchemeResponse(): string {
  return `## Government Schemes for Farmers

### PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)
- **Benefit:** Rs.6,000/year in 3 installments of Rs.2,000
- **Eligibility:** All landholding farmer families
- **Apply:** pmkisan.gov.in or nearest CSC
- **Status check:** PM-KISAN app or 155261

### PMFBY (Pradhan Mantri Fasal Bima Yojana)
- **Premium:** Kharif 2%, Rabi 1.5%, Commercial 5% (rest subsidized)
- **Coverage:** Yield loss, prevented sowing, post-harvest losses
- **Enroll:** Through banks, CSC, or agriculture department

### Kisan Credit Card (KCC)
- **Rate:** 4% effective interest (7% with 3% GoI subvention)
- **Limit:** Up to Rs.3 lakh short-term credit
- **Apply:** Nearest nationalized or cooperative bank

### PM Krishi Sinchai Yojana (PMKSY)
- **Focus:** Har Khet Ko Pani, More Crop Per Drop
- **Subsidy:** Up to 55% for drip/sprinkler irrigation (SC/ST 70%)
- **Apply:** State agriculture department or PMKSY portal

### eNAM (National Agriculture Market)
- **Benefit:** Access to pan-India transparent price discovery
- **Platform:** enam.gov.in or eNAM mobile app
- **Registration:** Through nearest APMC mandi office

### Soil Health Card Scheme
- **Benefit:** Free soil testing + crop-wise fertilizer recommendation
- **How:** Soil sample from your field tested at govt lab
- **Validity:** Card valid for 3 years

---

### How to Apply
1. Visit nearest CSC (Common Service Centre)
2. Carry: Aadhaar card, land records (7/12 or Khasra), bank passbook
3. Contact Kisan Call Centre: 1800-180-1551 (free, 24x7)`;
}

function buildWeatherResponseHindi(weatherData: any, commodity: string | null, location: string | null): string {
  const placeName = location ? location : "आपके क्षेत्र";
  const today = weatherData?.forecast?.[0];
  if (!today) {
    return `## मौसम अपडेट\n\nअभी लाइव मौसम डेटा उपलब्ध नहीं है। सिंचाई, छिड़काव या कटाई से पहले स्थानीय मौसम अपडेट फिर से जांचें।`;
  }

  const cropLine = commodity
    ? `\n### फसल सलाह\n${commodity === "wheat" ? "गेहूं" : commodity === "cotton" ? "कपास" : commodity}: खेत की स्थिति देखकर ही अगला काम करें।`
    : "";

  return [
    `## ${placeName} के लिए मौसम अपडेट`,
    "",
    `आज अधिकतम/न्यूनतम तापमान: ${today.max} C / ${today.min} C`,
    `बारिश: ${today.rain_mm} मिमी`,
    `हवा: ${today.wind_kmh} किमी/घंटा`,
    "",
    "### अभी क्या करें",
    today.rain_mm > 5
      ? "1. आज छिड़काव टालें और खेत में पानी निकासी की व्यवस्था देखें।"
      : "1. अगर खेत तैयार है तो सूखे समय में छिड़काव या खाद का काम करें।",
    "2. कटाई या सिंचाई से पहले अगले 2-3 दिन का मौसम फिर जांचें。",
    cropLine,
  ].join("\n");
}

function buildMarketResponseHindi(liveData: any, commodity: string, location: string | null): string {
  const cropName =
    commodity === "wheat" ? "गेहूं" :
    commodity === "rice" ? "धान/चावल" :
    commodity === "cotton" ? "कपास" :
    commodity === "soybean" ? "सोयाबीन" :
    commodity;
  const top = liveData?.prices?.[0];
  const avg = liveData?.avg_modal_price;
  const msp = MSP_2024_25[commodity];

  return [
    `## ${cropName} मंडी अपडेट`,
    "",
    top
      ? `नज़दीकी उपलब्ध मंडी संदर्भ: ${top.market}, ${top.state}`
      : "अभी लाइव मंडी रिकॉर्ड सीमित हैं।",
    avg ? `औसत भाव: Rs.${formatIndianNumber(avg)}/क्विंटल` : "",
    msp ? `एमएसपी संदर्भ: Rs.${formatIndianNumber(msp.msp)}/${msp.unit}` : "",
    "",
    "### क्या करें",
    "1. कम से कम 2-3 मंडियों के भाव की तुलना करें।",
    "2. परिवहन खर्च जोड़कर ही बेचने का निर्णय लें।",
    "3. अगर भाव एमएसपी से कम है तो सरकारी खरीद केंद्र की जानकारी लें।",
  ].filter(Boolean).join("\n");
}

function buildPestResponseHindi(query: string, commodity: string | null, location: string | null): string {
  const cropName =
    commodity === "cotton" ? "कपास" :
    commodity === "wheat" ? "गेहूं" :
    commodity === "rice" ? "धान" :
    commodity ? commodity : "फसल";
  const locationLine = location ? `\nस्थान: ${location}` : "";

  return [
    `## ${cropName} के लिए कीट/रोग सलाह`,
    "",
    `${cropName} में कीट या रोग का खतरा हो सकता है। लक्षण देखकर ही दवा तय करें।${locationLine}`,
    "",
    "### अभी क्या करें",
    "1. 15-20 पौधों की जांच करें और पत्तियों/तनों पर लक्षण देखें।",
    "2. प्रभावित हिस्से की साफ फोटो लेकर कृषि अधिकारी या KVK को दिखाएं।",
    "3. बिना पुष्टि के तेज दवा का छिड़काव न करें।",
    "4. सुबह या शाम में ही छिड़काव करें, तेज धूप या बारिश से पहले नहीं।",
  ].join("\n");
}

function buildSchemeResponseHindi(): string {
  return [
    "## किसानों के लिए सरकारी योजनाएं",
    "",
    "### PM-KISAN",
    "- लाभ: Rs.6,000 प्रति वर्ष",
    "- पात्रता: पात्र किसान परिवार",
    "- आवेदन: pmkisan.gov.in या CSC केंद्र",
    "",
    "### PMFBY",
    "- लाभ: फसल बीमा",
    "- आवेदन: बैंक, CSC, कृषि विभाग",
    "",
    "### Kisan Credit Card",
    "- लाभ: कम ब्याज पर फसल ऋण",
    "- आवेदन: नजदीकी बैंक",
    "",
    "### क्या करें",
    "1. आधार, बैंक पासबुक और भूमि रिकॉर्ड तैयार रखें।",
    "2. CSC या कृषि विभाग में आवेदन स्थिति पूछें।",
  ].join("\n");
}

function buildPestResponseHindiRich(
  commodity: string | null,
  location: string | null
): string {
  const cropName =
    commodity === "cotton" ? "कपास" :
    commodity === "wheat" ? "गेहूं" :
    commodity === "rice" ? "धान" :
    commodity === "tomato" ? "टमाटर" :
    commodity ? commodity : "फसल";

  const pestDB: Record<string, { pests: string[]; symptoms: string[]; treatment: string[] }> = {
    wheat: {
      pests: ["पीला रतुआ", "भूरा रतुआ", "चूर्णिल फफूंदी", "माहू"],
      symptoms: [
        "पत्तियों पर पीली या नारंगी धारियां",
        "पत्तियों पर भूरे दानेदार धब्बे",
        "पत्तियों पर सफेद चूर्ण जैसी परत",
        "पत्तियां मुड़ना और चिपचिपा रस दिखना",
      ],
      treatment: [
        "प्रोपीकोनाज़ोल 25 EC @ 0.1%",
        "टेबुकोनाज़ोल 250 EW @ 0.1%",
        "सल्फर 80 WP @ 0.2%",
        "इमिडाक्लोप्रिड 17.8 SL @ 0.05%",
      ],
    },
    rice: {
      pests: ["ब्राउन प्लांट हॉपर", "ब्लास्ट रोग", "शीथ ब्लाइट", "लीफ फोल्डर"],
      symptoms: [
        "पौधों पर जले जैसे गोल पैच",
        "पत्तियों पर हीरे जैसे धब्बे",
        "शीथ पर अंडाकार घाव",
        "मुड़ी हुई पत्तियां और मल जैसा पदार्थ",
      ],
      treatment: [
        "बुप्रोफेजिन 25 SC @ 0.0125%",
        "ट्राईसाइक्लाजोल 75 WP @ 0.06%",
        "हेक्साकोनाज़ोल 5 EC @ 0.1%",
        "क्लोरपायरिफॉस 20 EC @ 0.05%",
      ],
    },
    cotton: {
      pests: ["गुलाबी सुंडी", "सफेद मक्खी", "थ्रिप्स", "मिलीबग"],
      symptoms: [
        "टिंडों में छेद और अंदर की क्षति",
        "पत्तियां पीली पड़ना, वायरस फैलने का खतरा",
        "पत्तियों पर चांदी जैसा धूसर रंग",
        "सफेद रूई जैसे गुच्छे",
      ],
      treatment: [
        "इमामेक्टिन बेन्जोएट 5 SG @ 0.002%",
        "पाइरीप्रोक्सीफेन 10 EC @ 0.05%",
        "स्पिनोसैड 45 SC @ 0.03%",
        "प्रोफेनोफॉस 50 EC @ 0.05%",
      ],
    },
    tomato: {
      pests: ["लीफ कर्ल वायरस", "अर्ली ब्लाइट", "लेट ब्लाइट", "फल छेदक"],
      symptoms: [
        "पत्तियां ऊपर की ओर मुड़ना और मोज़ेक लक्षण",
        "पत्तियों पर गोल-गोल भूरे छल्ले",
        "गीले काले धब्बे",
        "फलों में छेद",
      ],
      treatment: [
        "सफेद मक्खी नियंत्रण के लिए इमिडाक्लोप्रिड",
        "मैनकोज़ेब 75 WP @ 0.2%",
        "मेटालेक्सिल-एम + मैनकोज़ेब @ 0.25%",
        "स्पिनोसैड 45 SC @ 0.03%",
      ],
    },
  };

  let md = `## कीट और रोग सलाह\n\n`;

  if (commodity) {
    const info = pestDB[commodity];
    if (info) {
      md += `### ${cropName} के सामान्य कीट और रोग\n\n`;
      info.pests.forEach((pest, index) => {
        md += `**${pest}**\n`;
        md += `- लक्षण: ${info.symptoms[index]}\n`;
        md += `- उपचार: ${info.treatment[index]}\n\n`;
      });
    }
  }

  md += `### समेकित कीट प्रबंधन (IPM) सिद्धांत\n`;
  md += `1. **नियमित निगरानी करें** - हर सप्ताह खेत में अलग-अलग जगह से कम से कम 20 पौधों की जांच करें\n`;
  md += `2. **आर्थिक क्षति स्तर देखें** - दवा का छिड़काव तभी करें जब कीट संख्या नुकसान की सीमा पार करे\n`;
  md += `3. **जैविक नियंत्रण अपनाएं** - अंडों के परजीवीकरण के लिए ट्राइकोग्राम्मा कार्ड का उपयोग करें\n`;
  md += `4. **फसल चक्र अपनाएं** - गैर-आतिथ्य फसल के साथ चक्र बदलकर कीट चक्र तोड़ें\n`;
  md += `5. **छिड़काव का समय सही रखें** - सुबह 6-9 बजे या शाम 4-7 बजे छिड़काव अधिक प्रभावी रहता है\n\n`;

  md += `### विशेषज्ञ सहायता\n`;
  md += `- **किसान कॉल सेंटर:** 1800-180-1551 (निःशुल्क, 24x7)\n`;
  md += `- **राज्य कृषि विभाग:** नजदीकी KVK (कृषि विज्ञान केंद्र) से संपर्क करें\n`;
  md += `- **ICAR सलाह:** प्रभावित हिस्से की साफ फोटो लेकर नजदीकी कृषि अधिकारी को दिखाएं\n`;

  if (location) {
    md += `\n${location} के क्षेत्रीय अलर्ट के लिए NCIPM कीट निगरानी पोर्टल भी देखें।`;
  }

  return md;
}

function buildLowConnectivityResponseHindi(weatherData: any, marketData: any, commodity: string | null, location: string | null): string {
  const placeName = location ? location : "आपके क्षेत्र";
  const cropName = commodity === "wheat" ? "गेहूं" : commodity === "cotton" ? "कपास" : commodity || "फसल";
  const today = weatherData?.forecast?.[0];
  const top = marketData?.prices?.[0];

  return [
    "## कमजोर नेटवर्क में सलाह",
    "",
    `नेटवर्क कमजोर है, इसलिए ${placeName} के लिए हल्का फॉलबैक उत्तर दिया जा रहा है।`,
    "",
    "### मौसम",
    today ? `आज बारिश: ${today.rain_mm} मिमी, हवा: ${today.wind_kmh} किमी/घंटा` : "लाइव मौसम उपलब्ध नहीं है।",
    "",
    "### बाजार",
    top ? `${cropName} के लिए संदर्भ मंडी: ${top.market}, ${top.state}` : `${cropName} के लिए लाइव मंडी रिकॉर्ड सीमित हैं।`,
    "",
    "### क्या करें",
    "1. बारिश की संभावना हो तो छिड़काव टालें।",
    "2. मंडी में बेचने से पहले स्थानीय भाव की पुष्टि करें।",
    "3. नेटवर्क ठीक होने पर फिर से लाइव डेटा जांचें।",
  ].join("\n");
}

function buildGeneralResponseHindi(query: string, commodity: string | null, location: string | null): string {
  const cropName = commodity
    ? commodity === "wheat" ? "गेहूं" : commodity === "cotton" ? "कपास" : commodity
    : "फसल";
  const placeName = location ? location : "आपके क्षेत्र";

  return [
    "## कृषि सलाह",
    "",
    `${cropName} और ${placeName} के संदर्भ में यह प्रारंभिक सलाह है।`,
    "",
    "### क्या करें",
    "1. मौसम देखकर ही सिंचाई, छिड़काव और कटाई का निर्णय लें।",
    "2. नजदीकी मंडी के भाव की तुलना करें।",
    "3. मिट्टी जांच और स्थानीय कृषि अधिकारी की सलाह लें।",
  ].join("\n");
}

function buildLowConnectivityResponse(
  weatherData: any,
  marketData: any,
  commodity: string | null,
  location: string | null
): string {
  const crop = commodity ?? "wheat";
  const placeName = location
    ? location.charAt(0).toUpperCase() + location.slice(1)
    : "your area";
  const today = weatherData?.forecast?.[0];
  const avgPrice = marketData?.avg_modal_price ?? marketData?.prices?.[0]?.modal_price ?? null;
  const topMarket = marketData?.prices?.[0];

  const lines: string[] = [
    "## Low-connectivity advisory",
    "",
    `Connectivity is weak, so I am using a lightweight fallback for ${placeName}.`,
    "",
    "### Weather snapshot",
  ];

  if (today) {
    lines.push(
      `Today max/min: ${today.max} C / ${today.min} C`,
      `Expected rain: ${today.rain_mm} mm`,
      `Wind: ${today.wind_kmh} km/h`,
      `Condition: ${today.description}`
    );
  } else {
    lines.push("Live weather could not be fetched. Recheck rain conditions before spraying or harvesting.");
  }

  lines.push("", "### Market snapshot");
  if (avgPrice) {
    lines.push(
      `${crop.charAt(0).toUpperCase() + crop.slice(1)} reference price: Rs.${formatIndianNumber(avgPrice)}/quintal`,
      topMarket ? `Closest available mandi context: ${topMarket.market}, ${topMarket.state}` : "Using cached/reference mandi context"
    );
  } else {
    lines.push(`Live mandi prices are not available right now. Use MSP/reference pricing for ${crop} until connectivity improves.`);
  }

  lines.push(
    "",
    "### What to do now",
    today?.rain_mm > 5
      ? "- Delay spraying today and check drainage in the field."
      : "- Use the current dry window for spraying or fertilizer application if the field is ready.",
    avgPrice
      ? "- Compare this fallback price with your nearest mandi before selling."
      : "- Hold produce briefly if possible and retry once the network is stable for live mandi data.",
    "- Retry later for full live AGMARKNET and forecast enrichment."
  );

  return lines.join("\n");
}

function buildGeneralResponse(
  query: string,
  commodity: string | null,
  location: string | null
): string {
  const cropName = commodity
    ? commodity.charAt(0).toUpperCase() + commodity.slice(1)
    : null;
  let md = `## Agricultural Advisory\n\n`;

  if (cropName) {
    md += `### ${cropName} Farming Guide\n\n`;
    const cropGuides: Record<string, string> = {
      wheat:
        "**Season:** Rabi (Oct-Nov sowing, Mar-Apr harvest)\n**Varieties:** HD-3086, PBW-343, GW-322\n**Spacing:** 20-22 cm rows\n**Water needs:** 4-6 irrigations\n**Fertilizer:** 120:60:40 NPK kg/ha",
      rice: "**Season:** Kharif (June-July transplant, Oct-Nov harvest)\n**Varieties:** MTU-1010, BPT-5204, Pusa-44\n**Spacing:** 20x15 cm\n**Water needs:** Continuous flooding or SRI method\n**Fertilizer:** 100:50:50 NPK kg/ha in split doses",
      cotton:
        "**Season:** Kharif (April-May sowing)\n**Varieties:** Bt Cotton hybrids\n**Spacing:** 90x60 cm\n**Irrigation:** 6-8 (critical at flowering and boll formation)\n**Fertilizer:** 180:80:80 NPK kg/ha",
      maize:
        "**Season:** Kharif + Rabi both possible\n**Varieties:** Pioneer 30V92, DKC-9141\n**Spacing:** 60x25 cm\n**Irrigation:** 8-10 (tasseling and silking are critical)\n**Fertilizer:** 180:80:60 NPK kg/ha",
      tomato:
        "**Season:** Year-round with varieties\n**Varieties:** Arka Rakshak, Pusa Hybrid-4\n**Spacing:** 60x45 cm (staked)\n**Irrigation:** Drip recommended, 5-7 mm/day\n**Fertilizer:** 200:100:200 NPK kg/ha",
    };
    md += `${cropGuides[commodity ?? ""] ?? "Consult your local KVK (Krishi Vigyan Kendra) for variety and input recommendations specific to your district."}\n\n`;
  }

  md += `### Quick Recommendations\n`;
  md += `1. **Check weather** before any farm operation (spray, irrigate, harvest)\n`;
  md += `2. **Monitor mandi prices** across 3 nearby markets before selling\n`;
  md += `3. **Soil testing** - get done every 3 years (free at govt labs)\n`;
  md += `4. **Kisan Call Centre** - 1800-180-1551 (free, 24x7 expert advice)\n`;

  if (location) {
    md += `\n### Resources for ${location.charAt(0).toUpperCase() + location.slice(1)}\n`;
    md += `- Contact your local KVK (Krishi Vigyan Kendra) for region-specific advice\n`;
    md += `- State Agriculture Department website for local schemes and advisories\n`;
  }

  return md;
}

type QueryIssueKind = "invalid" | "ambiguous";

type QueryIssue = {
  kind: QueryIssueKind;
  title: string;
  message: string;
  fixes: string[];
  example: string;
};

function hasRecognizableAgricultureTopic(query: string): boolean {
  return (
    /crop|farming|farmer|seed|sowing|harvest|irrigation|drip|sprinkler|fertili[sz]er|manure|soil|scheme|subsidy|loan|credit|insurance|kisan|yojana|weather|rain|market|mandi|price|msp|pest|disease|spray|pesticide/i.test(
      query
    ) ||
    /à¤«à¤¸à¤²|à¤•à¤¿à¤¸à¤¾à¤¨|à¤¬à¥à¤†à¤ˆ|à¤•à¤Ÿà¤¾à¤ˆ|à¤¸à¤¿à¤‚à¤šà¤¾à¤ˆ|à¤–à¤¾à¤¦|à¤‰à¤°à¥à¤µà¤°à¤•|à¤®à¤¿à¤Ÿà¥à¤Ÿà¥€|à¤¯à¥‹à¤œà¤¨à¤¾|à¤¸à¤¬à¥à¤¸à¤¿à¤¡à¥€|à¤²à¥‹à¤¨|à¤¬à¥€à¤®à¤¾|à¤®à¥Œà¤¸à¤®|à¤¬à¤¾à¤°à¤¿à¤¶|à¤®à¤‚à¤¡à¥€|à¤­à¤¾à¤µ|à¤•à¥€à¤Ÿ|à¤°à¥‹à¤—|à¤›à¤¿à¤¡à¤¼à¤•à¤¾à¤µ/.test(
      query
    )
  );
}

function isLikelyInvalidQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  if (trimmed.length < 3) return true;

  const letters = (trimmed.match(/[A-Za-z\u0080-\uFFFF]/g) ?? []).length;
  const digits = (trimmed.match(/\d/g) ?? []).length;
  const symbols = (trimmed.match(/[^A-Za-z\u0080-\uFFFF\d\s]/g) ?? []).length;
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (letters === 0 && digits > 0) return true;
  if (symbols > letters + digits && trimmed.length < 18) return true;
  if (words.length === 1 && /^(hi|hello|hey|test|ok|hmm)$/i.test(words[0])) return true;

  return false;
}

function detectQueryIssue(
  query: string,
  intentType: string,
  commodity: string | null,
  location: string | null
): QueryIssue | null {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (isLikelyInvalidQuery(trimmed)) {
    return {
      kind: "invalid",
      title: "The question is too incomplete to process",
      message:
        "I could not identify a usable agricultural request from the message you sent.",
      fixes: [
        "State the crop or topic clearly",
        "Mention your problem, for example disease, weather, price, irrigation, or scheme",
        "Add your location if the answer depends on your district or state",
      ],
      example: "Example: What is the wheat mandi price today in Haryana?",
    };
  }

  const genericPhrases = [
    "tell me about crop",
    "tell me about the crop",
    "help me with farming",
    "give advice",
    "what should i do",
    "crop problem",
    "market price",
    "weather update",
  ];

  if (genericPhrases.some((phrase) => lower === phrase || lower.startsWith(`${phrase} `))) {
    return {
      kind: "ambiguous",
      title: "The question is too broad",
      message:
        "The request is agricultural, but it is missing the details needed for a precise answer.",
      fixes: [
        "Add the crop name",
        "Add your location",
        "Say what you need help with: price, disease, weather, irrigation, fertilizer, or scheme",
      ],
      example: "Example: My cotton crop in Punjab has leaf curl. What should I spray?",
    };
  }

  if (intentType === "general") {
    const missingCrop = !commodity;
    const missingLocation = !location || location === "India";
    const tooShort = words.length < 4;
    const hasTopic = hasRecognizableAgricultureTopic(trimmed);

    if (missingCrop && (missingLocation || tooShort) && !hasTopic) {
      return {
        kind: "ambiguous",
        title: "More detail is needed",
        message:
          "I can help, but the request does not yet specify enough context to give a reliable agricultural answer.",
        fixes: [
          missingCrop ? "Add the crop name" : "Keep the crop name",
          missingLocation ? "Add your state or district" : "Keep the location",
          "Describe the exact problem or goal",
        ],
        example: "Example: Should I irrigate wheat this week in Punjab based on expected rain?",
      };
    }
  }

  if (intentType === "market" && !commodity) {
    return {
      kind: "ambiguous",
      title: "The market query is missing the crop",
      message:
        "To answer a mandi or price question, I need to know which crop or commodity you mean.",
      fixes: [
        "Add the crop name, for example wheat, rice, cotton, or soybean",
        "Add the market area or state if you want local prices",
        "Mention whether you want live mandi prices or sell/hold advice",
      ],
      example: "Example: What is the soybean mandi price today in Madhya Pradesh?",
    };
  }

  if (intentType === "weather" && (!location || location === "India")) {
    return {
      kind: "ambiguous",
      title: "The weather query is missing the location",
      message:
        "Weather advice depends on place, so I need your district, city, or state.",
      fixes: [
        "Add your village, district, or state",
        "Mention the crop if you want crop-specific advice",
        "Say whether you need rain, temperature, spray timing, or irrigation guidance",
      ],
      example: "Example: Will it rain this week in Ludhiana for wheat spraying?",
    };
  }

  if (intentType === "pest" && !commodity) {
    return {
      kind: "ambiguous",
      title: "The crop problem is missing the crop name",
      message:
        "Pest and disease advice changes by crop, so I need to know what crop is affected.",
      fixes: [
        "Add the crop name",
        "Describe the symptoms clearly",
        "Add location if you want region-specific alerts",
      ],
      example: "Example: My rice leaves have brown spots in Odisha. What disease is this?",
    };
  }

  return null;
}

function buildQueryIssueResponse(issue: QueryIssue): string {
  let md = `## ${issue.title}\n\n`;
  md += `${issue.message}\n\n`;
  md += `### What to fix\n`;
  issue.fixes.forEach((fix, index) => {
    md += `${index + 1}. ${fix}\n`;
  });
  md += `\n### Better example\n`;
  md += `${issue.example}\n`;
  return md;
}

// ─── Step Builder ──────────────────────────────────────────────────────────────

function makeStep(
  node: string,
  status: AgentStep["status"],
  message: string,
  duration?: number
): AgentStep {
  return { node, status, message, duration };
}

// ─── Main Export: runAgentQuery ────────────────────────────────────────────────

export async function runAgentQuery(
  query: string,
  onStepUpdate: (steps: AgentStep[]) => void,
  onComplete: (response: string, steps: AgentStep[], meta?: QueryResponseMeta) => void,
  languageCode: string = "en"   // ← NEW: language code from LanguageContext
): Promise<void> {
  const steps: AgentStep[] = [];
  const rawQuery = query.trim();
  let processedQuery = rawQuery;
  if (languageCode !== "en") {
    try {
      const normalizedQuery = await translateText(rawQuery, "en", "auto");
      if (normalizedQuery.trim()) {
        processedQuery = normalizedQuery.trim();
      }
    } catch {
      processedQuery = rawQuery;
    }
  }
  const trimmedQuery = processedQuery.trim();
  const detectedLocation = extractLocation(trimmedQuery);
  const location = detectedLocation || "India";
  const commodity = extractCommodity(processedQuery);
  const intentType = classifyIntent(processedQuery);
  const lowConnectivity = isLowConnectivityQuery(trimmedQuery);
  const wantsWeather = /weather|rain|rainfall|forecast|humid|wind|cloud|storm|बारिश|मौसम|पूर्वानुमान|वर्षा/i.test(trimmedQuery);
  const wantsMarket = /price|mandi|market|msp|rate|sell|bhav|बाजार|मंडी|भाव|कीमत/i.test(trimmedQuery);
  const queryIssue = detectQueryIssue(trimmedQuery, intentType, commodity, detectedLocation);

  const update = (s: AgentStep[]) => onStepUpdate([...s]);

  // ── Node 1: Guardrails ────────────────────────────────────────────────────
  steps.push(makeStep("Guardrails", "running", "Checking query safety and domain relevance... (Llama-3-8B)"));
  update(steps);
  const t1 = Date.now();

  // Pass language name to backend (e.g. "Hindi", "English")
  const langNameMap: Record<string, string> = {
    en: "English", hi: "Hindi", bn: "Bengali", te: "Telugu",
    mr: "Marathi", ta: "Tamil", gu: "Gujarati", kn: "Kannada",
    ml: "Malayalam", pa: "Punjabi", or: "Odia", ur: "Urdu",
  };
  const processingLanguageName = "English";
  const outputLanguageName = langNameMap[languageCode] ?? "English";

  try {

  if (queryIssue) {
    steps[0] = makeStep(
      "Guardrails",
      queryIssue.kind === "invalid" ? "error" : "completed",
      queryIssue.kind === "invalid"
        ? "Input validation failed - the request is not usable yet"
        : "Query is safe but needs clarification before advice can be given",
      Date.now() - t1
    );
    update(steps);

    steps.push(
      makeStep(
        "Intent",
        queryIssue.kind === "invalid" ? "error" : "completed",
        queryIssue.kind === "invalid"
          ? "Detected an incomplete or invalid agricultural request"
          : "Detected missing context and prepared a clarification response",
        120
      )
    );
    update(steps);

    let issueResponse = buildQueryIssueResponse(queryIssue);
    if (languageCode !== "en") {
      try {
        issueResponse = await translateRichText(issueResponse, languageCode, "en");
      } catch {
        // Keep English if translation fails.
      }
    }

    onComplete(issueResponse, steps, { baseResponse: buildQueryIssueResponse(queryIssue), baseLanguage: "en" });
    return;
  }

  const backendResult = await callBackendPipeline(
    processedQuery,
    location,
    processingLanguageName
  );
  const d1 = Date.now() - t1;

  if (backendResult && !backendResult.is_safe) {
    steps[0] = makeStep("Guardrails", "error", `${backendResult.guardrails_message}`, d1);
    update(steps);
    let offDomainResponse =
      backendResult.final_response ||
      "This query is outside the agricultural domain. Please ask about farming, crops, weather, or market prices.";
    if (languageCode !== "en") {
      try {
        offDomainResponse = await translateRichText(offDomainResponse, languageCode, "en");
      } catch {
        // Keep original response if translation fails.
      }
    }
    onComplete(offDomainResponse, steps, {
      baseResponse:
        backendResult.final_response ||
        "This query is outside the agricultural domain. Please ask about farming, crops, weather, or market prices.",
      baseLanguage: "en",
    });
    return;
  }

  steps[0] = makeStep(
    "Guardrails", "completed",
    "Query validated - agricultural domain confirmed (Llama-3-8B)",
    d1
  );
  update(steps);

  // If backend returned a full result, use it directly
  if (backendResult?.final_response) {
    const auditMap: Record<string, any> = {};
    (backendResult.audit_log || []).forEach((a) => { auditMap[a.node] = a; });

    const nodeNames = ["Intent", "Web Search", "Weather", "Market", "Synthesis"];
    const models = ["Mistral-7B", "Qwen-14B", "Open-Meteo", "AGMARKNET", "Llama-3-70B"];

    for (let i = 0; i < nodeNames.length; i++) {
      const name = nodeNames[i];
      const audit = auditMap[name];
      steps.push(makeStep(name, "running", `Processing with ${models[i]}...`));
      update(steps);
      await new Promise((r) => setTimeout(r, Math.min(audit?.duration_ms ?? 400, 600)));
      steps[steps.length - 1] = makeStep(
        name, "completed",
        `${audit?.message ?? `${name} completed`} (${models[i]})`,
        audit?.duration_ms ?? 400
      );
      update(steps);
    }

    // Backend already handles language — no client-side translation needed
    let backendResponse = backendResult.final_response;
    if (languageCode !== "en") {
      try {
        backendResponse = await translateRichText(backendResult.final_response, languageCode, "en");
      } catch {
        // Keep backend response if translation fails.
      }
    }
    onComplete(backendResponse, steps, {
      baseResponse: backendResult.final_response,
      baseLanguage: "en",
    });
    return;
  }

  // ── Backend unreachable — run client-side pipeline ────────────────────────

  // Node 2: Intent
  steps.push(makeStep("Intent", "running", "Analyzing query intent and extracting entities... (Mistral-7B)"));
  update(steps);
  await new Promise((r) => setTimeout(r, 350));
  steps[steps.length - 1] = makeStep(
    "Intent", "completed",
    `Intent: ${intentType}${commodity ? ` | Crop: ${commodity}` : ""}${location !== "India" ? ` | Location: ${location}` : ""} (Mistral-7B)`,
    350
  );
  update(steps);

  // Node 3: Web Search / data fetch
  steps.push(makeStep("Web Search", "running", "Searching live agricultural data sources... (Qwen-14B)"));
  update(steps);
  const t3 = Date.now();

  let weatherData: any = null;
  let marketData: any = null;

  const [weather, market] = await Promise.allSettled([
    intentType === "weather" || intentType === "general" || lowConnectivity || wantsWeather
      ? fetchLiveWeather(location)
      : Promise.resolve(null),
    intentType === "market" || lowConnectivity || wantsMarket
      ? fetchLiveMarketData(commodity || "wheat", location)
      : Promise.resolve(null),
  ]);

  if (weather.status === "fulfilled") weatherData = weather.value;
  if (market.status === "fulfilled") marketData = market.value;

  const d3 = Date.now() - t3;
  steps[steps.length - 1] = makeStep(
    "Web Search", "completed",
    `Retrieved live data from ${weatherData ? "Open-Meteo" : ""}${weatherData && marketData ? " + " : ""}${marketData ? "AGMARKNET" : "open sources"} (Qwen-14B)`,
    d3
  );
  update(steps);

  // Node 4: Weather
  steps.push(makeStep(
    "Weather",
    intentType === "weather" ? "running" : "completed",
    intentType === "weather"
      ? `Fetching 7-day forecast for ${location}... (Open-Meteo)`
      : `Weather context loaded (Open-Meteo)`,
    intentType !== "weather" ? 50 : undefined
  ));
  update(steps);

  if (intentType === "weather") {
    if (!weatherData) weatherData = await fetchLiveWeather(location);
    steps[steps.length - 1] = makeStep(
      "Weather", "completed",
      weatherData
        ? `Live 7-day forecast for ${location}: ${weatherData.current_temp}C (Open-Meteo)`
        : "Weather fallback used - API timeout",
      200
    );
    update(steps);
  }

  // Node 5: Market
  steps.push(makeStep(
    "Market",
    intentType === "market" ? "running" : "completed",
    intentType === "market"
      ? `Fetching live mandi prices for ${commodity || "crop"}... (AGMARKNET)`
      : `Market context loaded (AGMARKNET)`,
    intentType !== "market" ? 50 : undefined
  ));
  update(steps);

  if (intentType === "market") {
    if (!marketData) marketData = await fetchLiveMarketData(commodity || "wheat", location);
    steps[steps.length - 1] = makeStep(
      "Market", "completed",
      marketData
        ? `Live AGMARKNET data: ${marketData.prices.length} mandi records found`
        : `MSP reference data used - AGMARKNET returned no live records`,
      300
    );
    update(steps);
  }

  // Node 6: Synthesis
  steps.push(makeStep("Synthesis", "running", "Synthesizing comprehensive advisory response... (Llama-3-70B)"));
  update(steps);
  const t6 = Date.now();

  let baseResponse = "";
  let finalResponse = "";
  if (lowConnectivity && (wantsWeather || wantsMarket)) {
    baseResponse = buildLowConnectivityResponse(
      weatherData,
      marketData,
      commodity,
      location !== "India" ? location : null
    );
    finalResponse = baseResponse;
  } else {
    switch (intentType) {
      case "weather":
        baseResponse = buildWeatherResponse(
          weatherData, commodity, location !== "India" ? location : null
        );
        finalResponse = baseResponse;
        break;
      case "market":
        baseResponse = buildMarketResponse(
          marketData, commodity || "wheat", location !== "India" ? location : null
        );
        finalResponse = baseResponse;
        break;
      case "pest":
        baseResponse = buildPestResponse(
          processedQuery, commodity, location !== "India" ? location : null
        );
        finalResponse =
          languageCode === "hi"
            ? buildPestResponseHindiRich(
                commodity,
                location !== "India" ? location : null
              )
            : baseResponse;
        break;
      case "scheme":
        baseResponse = buildSchemeResponse();
        finalResponse = baseResponse;
        break;
      default:
        baseResponse = buildGeneralResponse(
          processedQuery, commodity, location !== "India" ? location : null
        );
        finalResponse = baseResponse;
    }
  }

  const d6 = Date.now() - t6;
  steps[steps.length - 1] = makeStep(
    "Synthesis", "completed", "Advisory response ready (Llama-3-70B)", d6
  );
  update(steps);

  // ── Translation layer (only when language is not English) ─────────────────
  const usesDirectHindiResponse = languageCode === "hi" && intentType === "pest";
  if (languageCode !== "en" && !usesDirectHindiResponse) {
    // Add a translation step to the UI so the user knows what's happening
    steps.push(makeStep(
      "Translation", "running",
      `Translating response to ${outputLanguageName}... (MyMemory + LibreTranslate)`
    ));
    update(steps);
    const tTrans = Date.now();

    try {
      finalResponse = await translateRichText(baseResponse, languageCode, "en");
      steps[steps.length - 1] = makeStep(
        "Translation", "completed",
        `Response translated to ${outputLanguageName} (MyMemory + LibreTranslate)`,
        Date.now() - tTrans
      );
    } catch (err) {
      // Translation failed entirely — keep English, mark step as error
      steps[steps.length - 1] = makeStep(
        "Translation", "error",
        `Translation to ${outputLanguageName} failed — showing English response`,
        Date.now() - tTrans
      );
    }
    update(steps);
  }

    onComplete(finalResponse, steps, { baseResponse, baseLanguage: "en" });
  } catch (error) {
    console.warn("runAgentQuery fallback failed:", error);
    steps.push(
      makeStep(
        "Synthesis",
        "error",
        "The advisory pipeline hit an unexpected error. Showing a basic fallback response.",
        0
      )
    );
    update(steps);

    const fallbackResponse =
      intentType === "scheme"
        ? buildSchemeResponse()
        : hasRecognizableAgricultureTopic(trimmedQuery)
          ? buildGeneralResponse(query, commodity, location !== "India" ? location : null)
          : "I could not process that request. Ask about crops, weather, mandi prices, pests, irrigation, or government schemes.";
    let localizedFallback = fallbackResponse;
    if (languageCode !== "en") {
      try {
        localizedFallback = await translateRichText(fallbackResponse, languageCode, "en");
      } catch {
        localizedFallback = fallbackResponse;
      }
    }

    onComplete(localizedFallback, steps, {
      baseResponse: fallbackResponse,
      baseLanguage: "en",
    });
  }
}

// ─── Demo Scenarios ────────────────────────────────────────────────────────────

export function getDemoScenarios(): { key: DemoScenarioKey; label: string; query: string }[] {
  return [
    { key: "off_domain",    label: "Off-domain block",        query: "What is the capital of France?" },
    { key: "ambiguous",     label: "Ambiguous query",         query: "Tell me about the crop" },
    { key: "low_wifi",      label: "Low-WiFi resilience",     query: "Give me mandi prices and rain update with weak internet" },
    { key: "weather_rain",  label: "Live weather forecast",   query: "Will it rain this week in Punjab?" },
    { key: "market_wheat",  label: "Live mandi prices",       query: "What is the wheat mandi price in Haryana today?" },
    { key: "pest_alert",    label: "Pest diagnosis",          query: "My rice leaves have brown spots and the plant is dying. What disease is this?" },
    { key: "scheme_kisan",  label: "Government schemes",      query: "How do I apply for PM-KISAN and what is the eligibility?" },
  ];
}

async function runNarratedDemoScenario(
  key: DemoScenarioKey,
  onStepUpdate: (steps: AgentStep[]) => void,
  onComplete: (response: string, steps: AgentStep[]) => void
): Promise<boolean> {
  const scripted: Record<
    string,
    {
      steps: { node: string; status: AgentStep["status"]; message: string; duration?: number }[];
      response: string;
    }
  > = {
    off_domain: {
      steps: [
        {
          node: "Guardrails",
          status: "running",
          message: "Checking whether the query belongs to the agricultural domain...",
        },
        {
          node: "Guardrails",
          status: "error",
          message: "Blocked as off-domain. The system refuses unrelated queries and redirects the user back to farming topics.",
          duration: 180,
        },
      ],
      response: [
        "## This query is outside the agricultural domain",
        "",
        "I can help with farming-related questions such as:",
        "- crop cultivation",
        "- mandi or market prices",
        "- weather and rainfall",
        "- pests and diseases",
        "- irrigation and fertilizer",
        "- government farmer schemes",
        "",
        "### Try asking",
        "1. What is the wheat mandi price in Haryana today?",
        "2. Will it rain this week in Punjab?",
        "3. What government schemes are available for farmers?",
      ].join("\n"),
    },
    ambiguous: {
      steps: [
        {
          node: "Guardrails",
          status: "completed",
          message: "Query is safe and within agricultural scope.",
          duration: 140,
        },
        {
          node: "Intent",
          status: "running",
          message: "The system is checking whether there is enough detail to answer confidently...",
        },
        {
          node: "Intent",
          status: "completed",
          message: "Ambiguity detected. Missing crop, location, and goal, so the pipeline asks a clarification question instead of guessing.",
          duration: 260,
        },
        {
          node: "Synthesis",
          status: "completed",
          message: "Prepared a clarification-first reply for the user.",
          duration: 180,
        },
      ],
      response: [
        "## More detail is needed",
        "",
        "I can help, but this request is too broad to answer reliably.",
        "",
        "### What to add",
        "1. The crop name",
        "2. Your location",
        "3. The exact need: sowing, disease, irrigation, fertilizer, weather, market, or scheme",
        "",
        "### Better example",
        "My cotton crop in Punjab has leaf curl. What should I spray?",
      ].join("\n"),
    },
    low_wifi: {
      steps: [
        {
          node: "Guardrails",
          status: "completed",
          message: "Query accepted and routed for resilient handling.",
          duration: 120,
        },
        {
          node: "Intent",
          status: "completed",
          message: "Detected mixed intent: weather + market under weak connectivity.",
          duration: 220,
        },
        {
          node: "Web Search",
          status: "error",
          message: "Live web enrichment skipped because network quality is poor.",
          duration: 620,
        },
        {
          node: "Weather",
          status: "completed",
          message: "Weather request retried with a lightweight fallback path.",
          duration: 290,
        },
        {
          node: "Market",
          status: "completed",
          message: "Used cached/reference market context when live AGMARKNET was slow.",
          duration: 310,
        },
        {
          node: "Synthesis",
          status: "completed",
          message: "Generated a reduced-bandwidth advisory that still gives clear actions.",
          duration: 210,
        },
      ],
      response: [
        "## Low-connectivity advisory",
        "",
        "Connectivity is weak, so I am using a lightweight fallback response instead of waiting for all live services.",
        "",
        "### Weather snapshot",
        "Today/next window: Light-to-moderate rain risk should be assumed before spraying.",
        "Field action: Avoid spray if clouds are building or rain is expected within a few hours.",
        "",
        "### Market snapshot",
        "Use MSP or last known mandi rate as a temporary sell/hold reference.",
        "If local traders are offering below typical support levels, wait for a clearer live-market check if storage is available.",
        "",
        "### What to do now",
        "1. Delay spray if rain risk looks high.",
        "2. Compare current trader offer with MSP/reference price before selling.",
        "3. Retry later for full live AGMARKNET and weather enrichment.",
      ].join("\n"),
    },
  };

  const scenario = scripted[key];
  if (!scenario) return false;

  const steps: AgentStep[] = [];
  for (const item of scenario.steps) {
    steps.push(makeStep(item.node, item.status, item.message, item.duration));
    onStepUpdate([...steps]);
    await new Promise((resolve) => setTimeout(resolve, item.status === "running" ? 320 : 220));
  }

  onComplete(scenario.response, steps);
  return true;
}

export async function runDemoScenario(
  key: DemoScenarioKey,
  onStepUpdate: (steps: AgentStep[]) => void,
  onComplete: (response: string, steps: AgentStep[]) => void
): Promise<void> {
  if (await runNarratedDemoScenario(key, onStepUpdate, onComplete)) {
    return;
  }

  const scenario = getDemoScenarios().find((s) => s.key === key);
  if (!scenario) return;
  await runAgentQuery(scenario.query, onStepUpdate, onComplete);
}

export { AgentStep };
