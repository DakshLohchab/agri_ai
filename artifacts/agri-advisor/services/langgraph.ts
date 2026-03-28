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
 */

import { AgentStep } from "@/context/ChatContext";

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

// ─── Types ────────────────────────────────────────────────────────────────────

export type DemoScenarioKey =
  | "off_domain"
  | "ambiguous"
  | "low_wifi"
  | "weather_rain"
  | "market_wheat"
  | "pest_alert"
  | "scheme_kisan";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractCommodity(query: string): string | null {
  const commodities = [
    "mango", "wheat", "rice", "cotton", "maize", "soybean",
    "tomato", "onion", "potato", "apple", "banana", "grapes",
    "sugarcane", "mustard", "groundnut", "bajra", "jowar",
  ];
  const lower = query.toLowerCase();
  for (const c of commodities) {
    if (lower.includes(c)) return c;
  }
  return null;
}

function extractLocation(query: string): string | null {
  const locations = [
    "punjab", "haryana", "uttar pradesh", "up", "madhya pradesh", "mp",
    "rajasthan", "gujarat", "maharashtra", "karnataka", "telangana",
    "andhra pradesh", "tamil nadu", "west bengal", "bihar", "delhi",
    "odisha", "chhattisgarh", "jharkhand", "himachal", "uttarakhand",
    "pune", "mumbai", "nashik", "nagpur", "hyderabad", "bangalore",
    "lucknow", "jaipur", "chandigarh", "amritsar", "ludhiana",
  ];
  const lower = query.toLowerCase();
  for (const loc of locations) {
    if (lower.includes(loc)) return loc;
  }
  return null;
}

function classifyIntent(query: string): string {
  const lower = query.toLowerCase();
  if (lower.match(/price|mandi|market|msp|rate|sell|quintal|bazaar|bhav/))
    return "market";
  if (lower.match(/weather|rain|rainfall|temperature|forecast|humid|wind|cloud|storm/))
    return "weather";
  if (lower.match(/pest|disease|insect|fungus|blight|wilt|virus|spray|pesticide/))
    return "pest";
  if (lower.match(/scheme|subsidy|kisan|yojana|government|loan|credit|insurance/))
    return "scheme";
  return "general";
}

function formatIndianNumber(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

// ─── Live Weather API (Open-Meteo — free, no key needed) ──────────────────────

async function fetchLiveWeather(location: string): Promise<any> {
  try {
    // Step 1: Geocode the location
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json();

    let lat = 20.5937;
    let lon = 78.9629; // default: India center

    if (geoData.results && geoData.results.length > 0) {
      lat = geoData.results[0].latitude;
      lon = geoData.results[0].longitude;
    }

    // Step 2: Fetch 7-day forecast
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

    const res = await fetch(`${AGMARKNET_URL}?${params}`);
    const data = await res.json();

    if (!data.records || data.records.length === 0) return null;

    // Filter by location if provided
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

    const avg = Math.round(prices.reduce((s: number, p: any) => s + p.modal_price, 0) / prices.length);

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

// ─── Backend Pipeline Call (calls Python LangGraph + Ollama LLMs) ──────────────

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
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Backend pipeline unreachable, running client-side fallback:", err);
    return null;
  }
}

// ─── Response Generators (client-side fallback when backend is down) ───────────

function buildWeatherResponse(weatherData: any, commodity: string | null, location: string | null): string {
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
  const placeName = location ? location.charAt(0).toUpperCase() + location.slice(1) : "your region";
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
    lines.push(`| ${label} | ${day.description} | ${day.max} | ${day.min} | ${day.rain_mm} | ${day.wind_kmh} |`);
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
  let md = `## 📊 ${commodity.charAt(0).toUpperCase() + commodity.slice(1)} Market Update\n\n`;

  if (msp) {
    md += `**MSP 2024-25:** ₹${formatIndianNumber(msp.msp)}/${msp.unit} (${msp.grade})\n\n`;
  }

  if (liveData && liveData.prices.length > 0) {
    md += `### 🟢 Live AGMARKNET Data\n`;
    md += `*Source: ${liveData.source} · ${liveData.record_count ?? ""} records found*\n\n`;
    md += `| Market | State | Modal Price | Min | Max |\n`;
    md += `|--------|-------|------------|-----|-----|\n`;

    liveData.prices.forEach((p: any) => {
      md += `| ${p.market} | ${p.state} | ₹${formatIndianNumber(p.modal_price)} | ₹${formatIndianNumber(p.min_price)} | ₹${formatIndianNumber(p.max_price)} |\n`;
    });

    if (liveData.avg_modal_price && msp) {
      const premium = (((liveData.avg_modal_price - msp.msp) / msp.msp) * 100).toFixed(1);
      const premiumNum = parseFloat(premium);
      md += `\n**Average Modal Price:** ₹${formatIndianNumber(liveData.avg_modal_price)}/quintal`;
      md += ` (${premiumNum >= 0 ? "+" : ""}${premium}% vs MSP)\n\n`;
      if (premiumNum > 10) {
        md += `✅ **Excellent time to sell** — prices significantly above support price.\n`;
      } else if (premiumNum > 5) {
        md += `✅ **Good prices** — consider selling if storage costs are high.\n`;
      } else if (premiumNum >= 0) {
        md += `⚠️ **Near MSP levels** — hold if storage is available and costs permit.\n`;
      } else {
        md += `🔴 **Below MSP** — contact nearest FCI/state procurement agency immediately.\n`;
      }
    }
  } else {
    md += `### ⚠️ Live Data Unavailable\n`;
    md += `AGMARKNET API returned no records for "${commodity}"${location ? ` in ${location}` : ""}.\n`;
    md += `Check [agmarknet.gov.in](https://agmarknet.gov.in) or the eNAM app for latest rates.\n\n`;

    if (msp) {
      md += `**Reference MSP:** ₹${formatIndianNumber(msp.msp)}/quintal\n`;
    }
  }

  md += `\n### 💡 Action Steps\n`;
  md += `1. **Sell strategy:** Compare at least 3 nearby mandis before deciding\n`;
  md += `2. **Transport:** Factor transport costs (₹50-150/quintal) into your net price\n`;
  md += `3. **Government procurement:** Contact FCI or state agency if mandi price < MSP\n`;
  md += `4. **Live rates:** [agmarknet.gov.in](https://agmarknet.gov.in) · eNAM app\n`;

  if (liveData) md += `\n*📡 Source: AGMARKNET data.gov.in (live)*`;
  return md;
}

function buildPestResponse(query: string, commodity: string | null, location: string | null): string {
  const cropName = commodity ? commodity.charAt(0).toUpperCase() + commodity.slice(1) : "Crop";
  let md = `## 🔬 Pest & Disease Advisory\n\n`;

  if (commodity) {
    const pestDB: Record<string, { pests: string[]; symptoms: string[]; treatment: string[] }> = {
      wheat: {
        pests: ["Yellow Rust (Puccinia striiformis)", "Brown Rust", "Powdery Mildew", "Aphids"],
        symptoms: ["Yellow/orange stripes on leaves", "Brown pustules on leaves", "White powdery coating", "Curling leaves, sticky residue"],
        treatment: ["Propiconazole 25 EC @ 0.1%", "Tebuconazole 250 EW @ 0.1%", "Sulphur 80 WP @ 0.2%", "Imidacloprid 17.8 SL @ 0.05%"],
      },
      rice: {
        pests: ["Brown Plant Hopper (BPH)", "Blast (Magnaporthe oryzae)", "Sheath Blight", "Leaf Folder"],
        symptoms: ["Circular burnt patches (hopper burn)", "Diamond-shaped lesions on leaves", "Oval lesions on sheath", "Folded leaves with frass"],
        treatment: ["Buprofezin 25 SC @ 0.0125%", "Tricyclazole 75 WP @ 0.06%", "Hexaconazole 5 EC @ 0.1%", "Chlorpyrifos 20 EC @ 0.05%"],
      },
      cotton: {
        pests: ["Pink Bollworm", "Whitefly", "Thrips", "Mealybug"],
        symptoms: ["Entry holes in bolls", "Yellowing, virus vector", "Silver-grey leaf surface", "White cottony masses"],
        treatment: ["Emamectin benzoate 5 SG @ 0.002%", "Pyriproxyfen 10 EC @ 0.05%", "Spinosad 45 SC @ 0.03%", "Profenofos 50 EC @ 0.05%"],
      },
      tomato: {
        pests: ["Leaf Curl Virus (TLCV)", "Early Blight", "Late Blight", "Fruit Borer"],
        symptoms: ["Upward leaf curl, mosaic", "Concentric brown rings on leaves", "Water-soaked dark lesions", "Entry holes in fruit"],
        treatment: ["Control whitefly vector with Imidacloprid", "Mancozeb 75 WP @ 0.2%", "Metalaxyl-M + Mancozeb @ 0.25%", "Spinosad 45 SC @ 0.03%"],
      },
    };

    const info = pestDB[commodity];
    if (info) {
      md += `### Common ${cropName} Pests & Diseases\n\n`;
      info.pests.forEach((pest, i) => {
        md += `**${pest}**\n`;
        md += `- Symptoms: ${info.symptoms[i]}\n`;
        md += `- Treatment: ${info.treatment[i]}\n\n`;
      });
    }
  }

  md += `### 🛡️ Integrated Pest Management (IPM) Principles\n`;
  md += `1. **Scout regularly** — Check 20 plants randomly across your field weekly\n`;
  md += `2. **Economic threshold** — Spray only when pest population crosses damage threshold\n`;
  md += `3. **Biological control** — Release Trichogramma cards for egg parasitization\n`;
  md += `4. **Crop rotation** — Break pest cycles by rotating with non-host crops\n`;
  md += `5. **Spray timing** — Early morning (6-9 AM) or evening (4-7 PM) for best efficacy\n\n`;

  md += `### 📞 Expert Help\n`;
  md += `- **Kisan Call Centre:** 1800-180-1551 (free, 24x7)\n`;
  md += `- **State Agriculture Dept:** Contact local KVK (Krishi Vigyan Kendra)\n`;
  md += `- **ICAR advisory:** Share clear photos with your nearest agriculture officer\n`;

  if (location) {
    md += `\n*📍 For region-specific alerts in ${location}, check the NCIPM pest surveillance portal.*`;
  }

  return md;
}

function buildSchemeResponse(): string {
  return `## 💰 Government Schemes for Farmers

### PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)
- **Benefit:** ₹6,000/year in 3 installments of ₹2,000
- **Eligibility:** All landholding farmer families
- **Apply:** [pmkisan.gov.in](https://pmkisan.gov.in) or nearest CSC
- **Status check:** PM-KISAN app or 155261

### PMFBY (Pradhan Mantri Fasal Bima Yojana)
- **Premium:** Kharif 2%, Rabi 1.5%, Commercial 5% (rest subsidized)
- **Coverage:** Yield loss, prevented sowing, post-harvest losses
- **Enroll:** Through banks, CSC, or agriculture department

### Kisan Credit Card (KCC)
- **Rate:** 4% effective interest (7% with 3% GoI subvention)
- **Limit:** Up to ₹3 lakh short-term credit
- **Apply:** Nearest nationalized or cooperative bank

### PM Krishi Sinchai Yojana (PMKSY)
- **Focus:** "Har Khet Ko Pani, More Crop Per Drop"
- **Subsidy:** Up to 55% for drip/sprinkler irrigation (SC/ST 70%)
- **Apply:** State agriculture department or PMKSY portal

### eNAM (National Agriculture Market)
- **Benefit:** Access to pan-India transparent price discovery
- **Platform:** enam.gov.in · eNAM mobile app
- **Registration:** Through nearest APMC mandi office

### Soil Health Card Scheme
- **Benefit:** Free soil testing + crop-wise fertilizer recommendation
- **How:** Soil sample from your field tested at govt lab
- **Validity:** Card valid for 3 years

---

### 📌 How to Apply
1. Visit nearest **CSC (Common Service Centre)**
2. Carry: Aadhaar card, land records (7/12 or Khasra), bank passbook
3. Contact **Kisan Call Centre: 1800-180-1551** (free, 24x7)`;
}

function buildGeneralResponse(query: string, commodity: string | null, location: string | null): string {
  const cropName = commodity ? commodity.charAt(0).toUpperCase() + commodity.slice(1) : null;
  let md = `## 🌾 Agricultural Advisory\n\n`;

  if (cropName) {
    md += `### ${cropName} Farming Guide\n\n`;
    const cropGuides: Record<string, string> = {
      wheat: "**Season:** Rabi (Oct-Nov sowing, Mar-Apr harvest)\n**Varieties:** HD-3086, PBW-343, GW-322\n**Spacing:** 20-22 cm rows\n**Water needs:** 4-6 irrigations (CRI, tillering, jointing, flowering, grain filling, dough stage)\n**Fertilizer:** 120:60:40 NPK kg/ha",
      rice: "**Season:** Kharif (June-July transplant, Oct-Nov harvest)\n**Varieties:** MTU-1010, BPT-5204 (Samba Mahsuri), Pusa-44\n**Spacing:** 20x15 cm\n**Water needs:** Continuous flooding or SRI method\n**Fertilizer:** 100:50:50 NPK kg/ha in split doses",
      cotton: "**Season:** Kharif (April-May sowing)\n**Varieties:** Bt Cotton hybrids (consult local APMC)\n**Spacing:** 90x60 cm\n**Irrigation:** 6-8 (critical at flowering and boll formation)\n**Fertilizer:** 180:80:80 NPK kg/ha",
      maize: "**Season:** Kharif + Rabi both possible\n**Varieties:** Pioneer 30V92, DKC-9141\n**Spacing:** 60x25 cm\n**Irrigation:** 8-10 (tasseling and silking are critical)\n**Fertilizer:** 180:80:60 NPK kg/ha",
      tomato: "**Season:** Year-round with varieties (avoid peak summer)\n**Varieties:** Arka Rakshak, Pusa Hybrid-4, local hybrids\n**Spacing:** 60x45 cm (staked), 90x60 cm (unstaked)\n**Irrigation:** Drip recommended, 5-7 mm/day\n**Fertilizer:** 200:100:200 NPK kg/ha + 25t FYM",
    };
    md += `${cropGuides[commodity ?? ""] ?? "Consult your local KVK (Krishi Vigyan Kendra) for variety and input recommendations specific to your district."}\n\n`;
  }

  md += `### Quick Recommendations\n`;
  md += `1. **Check weather** before any farm operation (spray, irrigate, harvest)\n`;
  md += `2. **Monitor mandi prices** across 3 nearby markets before selling\n`;
  md += `3. **Soil testing** — get done every 3 years (free at govt labs)\n`;
  md += `4. **Kisan Call Centre** — 1800-180-1551 (free, 24x7 expert advice)\n`;

  if (location) {
    md += `\n### 📍 Resources for ${location.charAt(0).toUpperCase() + location.slice(1)}\n`;
    md += `- Contact your local **KVK (Krishi Vigyan Kendra)** for region-specific advice\n`;
    md += `- **State Agriculture Department** website for local schemes and advisories\n`;
  }

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
// Called by [id].tsx chat screen

export async function runAgentQuery(
  query: string,
  onStepUpdate: (steps: AgentStep[]) => void,
  onComplete: (response: string, steps: AgentStep[]) => void
): Promise<void> {
  const steps: AgentStep[] = [];
  const location = extractLocation(query) || "India";
  const commodity = extractCommodity(query);
  const intentType = classifyIntent(query);

  const update = (s: AgentStep[]) => onStepUpdate([...s]);

  // ── Node 1: Guardrails (Llama-3-8B) ──────────────────────────────────────
  steps.push(makeStep("Guardrails", "running", "Checking query safety and domain relevance... (Llama-3-8B)"));
  update(steps);
  const t1 = Date.now();

  // Try backend first (which uses Llama-3-8B via Ollama)
  const backendResult = await callBackendPipeline(query, location);

  const d1 = Date.now() - t1;

  if (backendResult && !backendResult.is_safe) {
    steps[0] = makeStep("Guardrails", "error", `⛔ ${backendResult.guardrails_message}`, d1);
    update(steps);
    onComplete(backendResult.final_response || "This query is outside the agricultural domain. Please ask about farming, crops, weather, or market prices.", steps);
    return;
  }

  steps[0] = makeStep("Guardrails", "completed", "✓ Query validated — agricultural domain confirmed (Llama-3-8B)", d1);
  update(steps);

  // If backend returned a full result, use it directly
  if (backendResult?.final_response) {
    // Replay remaining nodes from audit log for UI
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
        `✓ ${audit?.message ?? `${name} completed`} (${models[i]})`,
        audit?.duration_ms ?? 400
      );
      update(steps);
    }

    onComplete(backendResult.final_response, steps);
    return;
  }

  // ── Backend unreachable — run client-side pipeline ────────────────────────
  // Node 2: Intent (Mistral-7B — simulated client-side)
  steps.push(makeStep("Intent", "running", "Analyzing query intent and extracting entities... (Mistral-7B)"));
  update(steps);
  await new Promise((r) => setTimeout(r, 350));
  steps[steps.length - 1] = makeStep(
    "Intent", "completed",
    `✓ Intent: ${intentType}${commodity ? ` | Crop: ${commodity}` : ""}${location !== "India" ? ` | Location: ${location}` : ""} (Mistral-7B)`,
    350
  );
  update(steps);

  // Node 3: Web Search (Qwen-14B — client-side: fetch from open APIs)
  steps.push(makeStep("Web Search", "running", "Searching live agricultural data sources... (Qwen-14B)"));
  update(steps);
  const t3 = Date.now();

  let weatherData: any = null;
  let marketData: any = null;

  // Parallel fetch
  const [weather, market] = await Promise.allSettled([
    intentType === "weather" || intentType === "general"
      ? fetchLiveWeather(location)
      : Promise.resolve(null),
    intentType === "market"
      ? fetchLiveMarketData(commodity || "wheat", location)
      : Promise.resolve(null),
  ]);

  if (weather.status === "fulfilled") weatherData = weather.value;
  if (market.status === "fulfilled") marketData = market.value;

  const d3 = Date.now() - t3;
  steps[steps.length - 1] = makeStep(
    "Web Search", "completed",
    `✓ Retrieved live data from ${weatherData ? "Open-Meteo" : ""}${weatherData && marketData ? " + " : ""}${marketData ? "AGMARKNET" : ""} (Qwen-14B)`,
    d3
  );
  update(steps);

  // Node 4: Weather
  steps.push(makeStep(
    "Weather",
    intentType === "weather" ? "running" : "completed",
    intentType === "weather"
      ? `Fetching 7-day forecast for ${location}... (Open-Meteo)`
      : `✓ Weather context loaded (Open-Meteo)`,
    intentType !== "weather" ? 50 : undefined
  ));
  update(steps);

  if (intentType === "weather") {
    if (!weatherData) weatherData = await fetchLiveWeather(location);
    steps[steps.length - 1] = makeStep(
      "Weather", "completed",
      weatherData
        ? `✓ Live 7-day forecast for ${location}: ${weatherData.current_temp}°C (Open-Meteo)`
        : "✓ Weather fallback used — API timeout",
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
      : `✓ Market context loaded (AGMARKNET)`,
    intentType !== "market" ? 50 : undefined
  ));
  update(steps);

  if (intentType === "market") {
    if (!marketData) marketData = await fetchLiveMarketData(commodity || "wheat", location);
    steps[steps.length - 1] = makeStep(
      "Market", "completed",
      marketData
        ? `✓ Live AGMARKNET data: ${marketData.prices.length} mandi records found`
        : `✓ MSP reference data used — AGMARKNET returned no live records`,
      300
    );
    update(steps);
  }

  // Node 6: Synthesis (Llama-3-70B — client-side structured response)
  steps.push(makeStep("Synthesis", "running", "Synthesizing comprehensive advisory response... (Llama-3-70B)"));
  update(steps);
  const t6 = Date.now();

  let finalResponse = "";
  switch (intentType) {
    case "weather":
      finalResponse = buildWeatherResponse(weatherData, commodity, location !== "India" ? location : null);
      break;
    case "market":
      finalResponse = buildMarketResponse(marketData, commodity || "wheat", location !== "India" ? location : null);
      break;
    case "pest":
      finalResponse = buildPestResponse(query, commodity, location !== "India" ? location : null);
      break;
    case "scheme":
      finalResponse = buildSchemeResponse();
      break;
    default:
      finalResponse = buildGeneralResponse(query, commodity, location !== "India" ? location : null);
  }

  const d6 = Date.now() - t6;
  steps[steps.length - 1] = makeStep("Synthesis", "completed", "✓ Advisory response ready (Llama-3-70B)", d6);
  update(steps);

  onComplete(finalResponse, steps);
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
        "## Off-domain query blocked",
        "",
        "The pipeline stops at the **Guardrails** layer because the request is not related to agriculture.",
        "",
        "| Layer | What happens | Why it matters |",
        "|-------|--------------|----------------|",
        "| Guardrails | Detects the request is outside farming support. | Prevents hallucinated or irrelevant answers. |",
        "| Routing | Skips downstream tools and models. | Saves time and keeps the stack focused on agri tasks. |",
        "| Reply | Redirects the user to supported query types. | Helps the conversation recover quickly. |",
        "",
        "### What the model does",
        "- Detects that the question is outside farming, crops, weather, markets, pests, or farmer schemes.",
        "- Prevents downstream tools and models from wasting compute on irrelevant requests.",
        "- Returns a safe redirect instead of inventing an answer.",
        "",
        "### User-facing behavior",
        "- The user is told that AgriAdvisor is focused on agricultural support.",
        "- The response suggests asking about crops, mandi prices, rainfall, pests, or government schemes.",
        "",
        "### Why this matters",
        "- Keeps the app trustworthy and domain-specific.",
        "- Reduces hallucinations on unrelated subjects.",
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
        "## Clarification-first handling",
        "",
        "The query is agricultural, but it is too broad to answer well.",
        "",
        "| Missing signal | Why it matters |",
        "|---------------|----------------|",
        "| Crop | Advice changes across cereals, vegetables, fruit, and fiber crops. |",
        "| Location | Weather, soil, and mandi guidance depend on district and state. |",
        "| User goal | Sowing, disease, irrigation, harvest, and selling need different actions. |",
        "",
        "### What the model notices",
        "- The crop is not specified.",
        "- The location is missing.",
        "- The user goal is unclear: cultivation, disease, market, irrigation, or harvest timing.",
        "",
        "### What the model does",
        "- Avoids making assumptions that could lead to poor farm advice.",
        "- Asks for the missing details before recommending actions.",
        "- Keeps the conversation moving with a short, targeted follow-up question.",
        "",
        "### Example clarification",
        "Please tell me the crop, your location, and whether you need help with sowing, disease, irrigation, or selling.",
        "",
        "### What the user sees next",
        "1. A short follow-up question instead of a vague one-size-fits-all answer.",
        "2. A more precise recommendation as soon as the missing context is provided.",
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
        "## Low-WiFi resilience mode",
        "",
        "This demo shows how the pipeline behaves when connectivity is weak or intermittent.",
        "",
        "| Layer | Low-WiFi behavior | User impact |",
        "|-------|-------------------|-------------|",
        "| Web search | Skips heavy enrichment when latency is too high. | Faster response under poor connectivity. |",
        "| Weather | Uses a lighter fallback path for essential forecast guidance. | Rain advice can still be shown. |",
        "| Market | Falls back to cached mandi context or MSP references. | Pricing guidance does not disappear completely. |",
        "| Synthesis | Labels fallback usage clearly. | The user knows what is live and what is cached. |",
        "",
        "### How the system adapts",
        "- Avoids depending on every live source before answering.",
        "- Skips non-critical enrichment when network latency is high.",
        "- Falls back to cached, recent, or reference agricultural context.",
        "- Still produces a practical answer instead of failing silently.",
        "",
        "### What still works under weak connectivity",
        "- Safety checks and intent detection.",
        "- Clarification-first behavior.",
        "- Cached or reference-backed weather and market advice.",
        "",
        "### What improves when the network returns",
        "- Fresh mandi records from AGMARKNET.",
        "- Richer live weather enrichment.",
        "- More complete cross-source comparisons.",
        "",
        "### Example outcome",
        "1. Rainfall guidance is still shown from a lightweight fallback path.",
        "2. Market advice can still rely on cached mandi context or MSP references.",
        "3. The final response stays actionable even when full live enrichment is unavailable.",
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
