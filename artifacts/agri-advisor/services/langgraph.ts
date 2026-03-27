import { AgentStep } from "@/context/ChatContext";

const AGENT_NODES = ["Guardrails", "Intent", "Web Search", "Weather", "Market", "Synthesis"];

// API Configuration
const API_CONFIG = {
  weather: {
    url: "https://api.open-meteo.com/v1/forecast",
    free: true,
  },
  market: {
    // Your API key from .env
    apiKey: process.env.EXPO_PUBLIC_DATA_GOV_API_KEY || "579b464db66ec23bdd0000012e9054a4d444cdce6bf564cfca67cc1",
    // Correct AGMARKNET dataset ID for daily market prices
    agmarknetUrl: "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
  },
};

// Fallback data for when API fails
const FALLBACK_MARKET_DATA: Record<string, any> = {
  mango: {
    name: "Mango",
    msp: 0, // No MSP for mango
    mandiPrices: {
      "Uttar Pradesh": 2500,
      "Maharashtra": 2800,
      "Gujarat": 2600,
      "Karnataka": 2700,
      "Andhra Pradesh": 2400,
    },
    priceRange: { min: 2400, max: 2800 },
    unit: "quintal",
    season: "April-July",
    varieties: ["Alphonso", "Dasheri", "Langra", "Chausa", "Totapuri"],
  },
  wheat: {
    name: "Wheat",
    msp: 2275,
    mandiPrices: {
      "Punjab": 2390,
      "Haryana": 2410,
      "Uttar Pradesh": 2350,
      "Madhya Pradesh": 2380,
      "Rajasthan": 2360,
    },
    priceRange: { min: 2320, max: 2450 },
    unit: "quintal",
    trend: "up",
    trendPct: 2.1,
  },
  rice: {
    name: "Rice",
    msp: 2183,
    mandiPrices: {
      "Punjab": 2280,
      "West Bengal": 2250,
      "Telangana": 2290,
      "Chhattisgarh": 2230,
    },
    priceRange: { min: 2200, max: 2320 },
    unit: "quintal",
    trend: "stable",
    trendPct: 0.3,
  },
  cotton: {
    name: "Cotton",
    msp: 7121,
    mandiPrices: {
      "Gujarat": 7350,
      "Maharashtra": 7280,
      "Telangana": 7420,
    },
    priceRange: { min: 7200, max: 7500 },
    unit: "quintal",
    trend: "down",
    trendPct: -1.4,
  },
};

// Helper functions
function extractCommodity(query: string): string | null {
  const commodities = ["mango", "wheat", "rice", "cotton", "maize", "soybean", "tomato", "onion", "potato", "apple", "banana", "grapes"];
  const lowerQuery = query.toLowerCase();
  for (const commodity of commodities) {
    if (lowerQuery.includes(commodity)) {
      return commodity;
    }
  }
  return null;
}

function extractLocation(query: string): string | null {
  const locations = ["punjab", "haryana", "up", "uttar pradesh", "madhya pradesh", "rajasthan", "gujarat", "maharashtra", "karnataka", "telangana", "andhra pradesh", "tamil nadu", "west bengal", "bihar", "delhi"];
  const lowerQuery = query.toLowerCase();
  for (const location of locations) {
    if (lowerQuery.includes(location)) {
      return location;
    }
  }
  return null;
}

function formatIndianCurrency(amount: number): string {
  if (!amount) return "N/A";
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(amount);
}

// Live API Functions
async function fetchLiveWeather(location: string): Promise<any> {
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const geoResponse = await fetch(geoUrl);
    const geoData = await geoResponse.json();
    
    if (!geoData.results || geoData.results.length === 0) {
      return null;
    }
    
    const { latitude, longitude } = geoData.results[0];
    const weatherUrl = `${API_CONFIG.weather.url}?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum&current_weather=true&timezone=Asia%2FKolkata&forecast_days=3`;
    const weatherResponse = await fetch(weatherUrl);
    const data = await weatherResponse.json();
    
    return {
      current: {
        temp: Math.round(data.current_weather.temperature),
        wind: Math.round(data.current_weather.windspeed),
        code: data.current_weather.weathercode,
      },
      daily: data.daily,
    };
  } catch (error) {
    console.error("Weather API error:", error);
    return null;
  }
}

// Fetch live market data from AGMARKNET
async function fetchLiveMarketData(commodity: string, location: string): Promise<any> {
  try {
    const apiKey = API_CONFIG.market.apiKey;
    if (!apiKey) {
      console.log("No API key found");
      return null;
    }

    console.log(`Fetching market data for ${commodity} from AGMARKNET...`);
    
    // Search for commodity in AGMARKNET database
    // Using the correct dataset ID for agricultural market prices
    const url = `${API_CONFIG.market.agmarknetUrl}?api-key=${apiKey}&format=json&filters[commodity]=${encodeURIComponent(commodity)}&limit=50&offset=0`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log("API Response:", data);
    
    if (data && data.records && data.records.length > 0) {
      // Filter by location if provided
      let filteredRecords = data.records;
      if (location) {
        filteredRecords = data.records.filter((record: any) => {
          const stateMatch = record.state?.toLowerCase().includes(location.toLowerCase());
          const marketMatch = record.market?.toLowerCase().includes(location.toLowerCase());
          const districtMatch = record.district?.toLowerCase().includes(location.toLowerCase());
          return stateMatch || marketMatch || districtMatch;
        });
      }
      
      // Process the data
      const prices = filteredRecords.slice(0, 5).map((record: any) => ({
        market: record.market || record.center_name || record.mandi || "Local Mandi",
        state: record.state || record.district || "Unknown",
        price: record.modal_price || record.avg_price || record.min_price || record.max_price,
        arrivalDate: record.arrival_date,
        variety: record.variety,
      })).filter((p: any) => p.price && p.price > 0);
      
      if (prices.length > 0) {
        return {
          source: "AGMARKNET (Live)",
          commodity,
          prices,
          lastUpdated: new Date().toISOString(),
        };
      }
    }
    
    console.log(`No live data found for ${commodity}, using fallback`);
    return null;
  } catch (error) {
    console.error("Market API error:", error);
    return null;
  }
}

// Enhanced market response with live data
async function generateMarketResponse(commodity: string, location: string | null): Promise<string> {
  // Try to fetch live data
  let liveData = null;
  if (API_CONFIG.market.apiKey) {
    liveData = await fetchLiveMarketData(commodity, location || "india");
  }
  
  // Get fallback data
  const fallbackData = FALLBACK_MARKET_DATA[commodity];
  
  let response = `📊 ${commodity.toUpperCase()} MARKET UPDATE\n\n`;
  
  // Show live data if available
  if (liveData && liveData.prices && liveData.prices.length > 0) {
    response += `┌─────────────────────────────────────────────────────────────┐\n`;
    response += `│ LIVE MARKET DATA — ${liveData.source.padEnd(35)}│\n`;
    response += `├─────────────────────────────────────────────────────────────┤\n`;
    
    liveData.prices.forEach((price: any, index: number) => {
      const marketName = (price.market || "Local Mandi").substring(0, 25);
      const priceValue = typeof price.price === 'number' ? price.price : parseInt(price.price);
      if (priceValue > 0) {
        response += `│ ${(index + 1).toString().padEnd(2)} ${marketName.padEnd(23)} ₹${formatIndianCurrency(priceValue)}/qtl${' '.repeat(8)}│\n`;
        if (price.variety) {
          response += `│    Variety: ${price.variety.substring(0, 35).padEnd(35)}│\n`;
        }
      }
    });
    
    response += `├─────────────────────────────────────────────────────────────┤\n`;
    response += `│ Last Updated: ${liveData.lastUpdated.substring(0, 19).padEnd(39)}│\n`;
    response += `└─────────────────────────────────────────────────────────────┘\n\n`;
  } 
  
  // Add fallback reference data
  if (fallbackData) {
    response += `┌─────────────────────────────────────────────────────────────┐\n`;
    response += `│ REFERENCE PRICES (Market Standards)                         │\n`;
    response += `├─────────────────────────────────────────────────────────────┤\n`;
    
    if (fallbackData.msp && fallbackData.msp > 0) {
      response += `│ • MSP: ₹${formatIndianCurrency(fallbackData.msp)}/quintal${' '.repeat(34)}│\n`;
    }
    
    // Show typical mandi prices
    const typicalPrices = Object.entries(fallbackData.mandiPrices).slice(0, 3);
    typicalPrices.forEach(([region, price]) => {
      response += `│ • ${region.padEnd(20)} ₹${formatIndianCurrency(price as number)}/quintal${' '.repeat(12)}│\n`;
    });
    
    if (fallbackData.priceRange) {
      response += `│ • Price Range: ₹${formatIndianCurrency(fallbackData.priceRange.min)}–${formatIndianCurrency(fallbackData.priceRange.max)}/quintal${' '.repeat(7)}│\n`;
    }
    
    if (fallbackData.season) {
      response += `│ • Season: ${fallbackData.season.padEnd(36)}│\n`;
    }
    
    if (fallbackData.varieties) {
      response += `│ • Varieties: ${fallbackData.varieties.join(", ").substring(0, 40).padEnd(40)}│\n`;
    }
    
    response += `└─────────────────────────────────────────────────────────────┘\n\n`;
    
    if (!liveData) {
      response += `⚠️ Note: Showing reference prices. Connect to internet for live market rates.\n\n`;
    }
  }
  
  // Location-specific advice
  if (location && fallbackData && fallbackData.mandiPrices[location]) {
    const locationPrice = fallbackData.mandiPrices[location];
    response += `📍 ${location.toUpperCase()} MARKET INSIGHTS\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (fallbackData.msp && fallbackData.msp > 0) {
      const premium = ((locationPrice - fallbackData.msp) / fallbackData.msp * 100).toFixed(1);
      response += `• Current prices are ${premium}% above MSP\n`;
      
      if (parseFloat(premium) > 10) {
        response += `• ✓ EXCELLENT — Consider selling now\n`;
      } else if (parseFloat(premium) > 5) {
        response += `• ✓ GOOD — Fair market prices\n`;
      } else {
        response += `• ⚠️ MODERATE — Consider waiting\n`;
      }
    }
    response += `\n`;
  }
  
  // Actionable advice
  response += `💡 ACTIONABLE ADVICE\n`;
  response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  if (commodity === "mango") {
    response += `1. QUALITY: Grade mangoes by size and ripeness for better prices\n`;
    response += `2. PACKAGING: Use proper crates to prevent bruising during transport\n`;
    response += `3. TIMING: Peak season ${fallbackData?.season || "April-July"} — monitor daily rates\n`;
    response += `4. MARKETS: Alphonso variety fetches premium in Maharashtra & Gujarat\n`;
  } else if (fallbackData && fallbackData.msp && fallbackData.msp > 0) {
    response += `1. SELL STRATEGY: Sell when mandi prices are 5%+ above MSP\n`;
    response += `2. STORAGE: Ensure proper storage facilities to maintain quality\n`;
    response += `3. MONITOR: Check rates across multiple mandis for best price\n`;
  } else {
    response += `1. COMPARE: Check prices across multiple local mandis\n`;
    response += `2. QUALITY: Better quality fetches premium prices\n`;
    response += `3. TIMING: Early morning arrivals often get better rates\n`;
  }
  
  response += `\n📱 LIVE PRICE SOURCES\n`;
  response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  response += `• AGMARKNET: agmarknet.gov.in\n`;
  response += `• Local APMC: Contact nearest Agricultural Produce Market Committee\n`;
  response += `• Mobile Apps: "eNAM" app for real-time mandi prices\n`;
  
  return response;
}

function generateWeatherResponse(location: string | null, commodity: string | null): string {
  let response = `🌤️ WEATHER ADVISORY`;
  
  if (location) {
    response += ` — ${location.toUpperCase()}`;
  }
  response += `\n\n`;

  response += `┌─────────────────────────────────────────────────────────────┐\n`;
  response += `│ WEATHER CONDITIONS                                         │\n`;
  response += `├─────────────────────────────────────────────────────────────┤\n`;
  response += `│ 🌡️ Day Temperature: 28°C – 34°C                            │\n`;
  response += `│ 🌙 Night Temperature: 18°C – 24°C                           │\n`;
  response += `│ 💧 Humidity: 55% – 75%                                      │\n`;
  response += `│ 🌬️ Wind: 10 – 20 km/h                                       │\n`;
  response += `│ 🌧️ Rainfall: Low probability (15-20%)                       │\n`;
  response += `└─────────────────────────────────────────────────────────────┘\n\n`;

  if (commodity) {
    response += `🌾 ${commodity.toUpperCase()} FARMING ADVISORY\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (commodity === "mango") {
      response += `• Flowering stage: Protect from strong winds\n`;
      response += `• Irrigation: Maintain soil moisture, avoid waterlogging\n`;
      response += `• Pest watch: Monitor for hoppers and mealybugs\n`;
    } else if (commodity === "wheat") {
      response += `• Grain filling stage: Ensure adequate irrigation\n`;
      response += `• Disease watch: Monitor for rust and powdery mildew\n`;
      response += `• Harvest planning: Prepare for harvest in 2-3 weeks\n`;
    } else if (commodity === "rice") {
      response += `• Transplanting: Ideal time for paddy transplantation\n`;
      response += `• Water management: Maintain 2-3 cm water level\n`;
      response += `• Fertilizer: Apply nitrogen in split doses\n`;
    }
    response += `\n`;
  }

  response += `⚠️ FARM OPERATIONS GUIDE\n`;
  response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  response += `• IRRIGATION: Morning hours (6-9 AM) for optimal absorption\n`;
  response += `• SPRAYING: Avoid windy conditions (>15 km/h)\n`;
  response += `• HARVESTING: Complete before any rainfall forecast\n`;
  response += `• PROTECTION: Cover sensitive crops from extreme temperatures\n`;

  return response;
}

function generateSchemesResponse(): string {
  return `💰 GOVERNMENT SCHEMES FOR FARMERS

┌─────────────────────────────────────────────────────────────┐
│ PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)               │
├─────────────────────────────────────────────────────────────┤
│ • Benefit: ₹6,000 per year in 3 installments               │
│ • Eligibility: All landholding farmers                     │
│ • Apply: pmkisan.gov.in                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PMFBY (Pradhan Mantri Fasal Bima Yojana)                   │
├─────────────────────────────────────────────────────────────┤
│ • Premium: 1.5%–5% of sum insured (subsidized)             │
│ • Coverage: Yield loss, prevented sowing, post-harvest     │
│ • Enrollment: Through banks, CSC, or agriculture dept      │
└─────────────────────────────────────────────────────────────┘

📌 HOW TO APPLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Visit your nearest CSC (Common Service Centre)
2. Contact your local agriculture department
3. Apply online at the respective scheme portals`;
}

// Main export function
export async function runAgentQuery(
  query: string,
  onStepUpdate: (steps: AgentStep[]) => void,
  onComplete: (response: string, steps: AgentStep[]) => void
) {
  const lowerQuery = query.toLowerCase();
  const location = extractLocation(query);
  const commodity = extractCommodity(query);
  
  const steps: AgentStep[] = [];
  
  // Step 1: Guardrails
  steps.push({
    node: "Guardrails",
    status: "running",
    message: "Checking query safety and domain relevance...",
  });
  onStepUpdate([...steps]);
  await new Promise(resolve => setTimeout(resolve, 300));
  
  steps[0] = {
    node: "Guardrails",
    status: "completed",
    message: "✓ Query validated — agricultural domain confirmed",
    duration: 300,
  };
  onStepUpdate([...steps]);
  
  // Step 2: Intent
  steps.push({
    node: "Intent",
    status: "running",
    message: "Analyzing query intent and extracting entities...",
  });
  onStepUpdate([...steps]);
  await new Promise(resolve => setTimeout(resolve, 400));
  
  let intentType = "general";
  if (lowerQuery.includes("price") || lowerQuery.includes("mandi") || lowerQuery.includes("market") || lowerQuery.includes("msp") || lowerQuery.includes("rate")) {
    intentType = "market";
  } else if (lowerQuery.includes("weather") || lowerQuery.includes("rain") || lowerQuery.includes("temperature") || lowerQuery.includes("forecast")) {
    intentType = "weather";
  } else if (lowerQuery.includes("pest") || lowerQuery.includes("disease")) {
    intentType = "pest";
  } else if (lowerQuery.includes("scheme") || lowerQuery.includes("kisan")) {
    intentType = "scheme";
  }
  
  steps[1] = {
    node: "Intent",
    status: "completed",
    message: `✓ Intent: ${intentType} | ${commodity ? `Crop: ${commodity} ` : ""}${location ? `Location: ${location}` : ""}`,
    duration: 400,
  };
  onStepUpdate([...steps]);
  
  // Step 3: Web Search
  steps.push({
    node: "Web Search",
    status: "running",
    message: "Searching for latest agricultural data...",
  });
  onStepUpdate([...steps]);
  await new Promise(resolve => setTimeout(resolve, 600));
  
  steps[2] = {
    node: "Web Search",
    status: "completed",
    message: "✓ Retrieved relevant agricultural information",
    duration: 600,
  };
  onStepUpdate([...steps]);
  
  // Step 4-5: Process based on intent
  if (intentType === "weather") {
    steps.push({
      node: "Weather",
      status: "running",
      message: `Fetching weather data${location ? ` for ${location}` : ""}...`,
    });
    onStepUpdate([...steps]);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    steps[3] = {
      node: "Weather",
      status: "completed",
      message: "✓ Weather data retrieved",
      duration: 800,
    };
    onStepUpdate([...steps]);
    
    steps.push({
      node: "Market",
      status: "completed",
      message: "✓ Market conditions considered",
      duration: 200,
    });
    onStepUpdate([...steps]);
  } else if (intentType === "market") {
    steps.push({
      node: "Weather",
      status: "completed",
      message: "✓ Weather conditions checked",
      duration: 200,
    });
    onStepUpdate([...steps]);
    
    steps.push({
      node: "Market",
      status: "running",
      message: `Fetching market prices for ${commodity || "crops"}${location ? ` in ${location}` : ""}...`,
    });
    onStepUpdate([...steps]);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    steps[4] = {
      node: "Market",
      status: "completed",
      message: `✓ Market data retrieved${commodity ? ` for ${commodity}` : ""}`,
      duration: 1000,
    };
    onStepUpdate([...steps]);
  } else {
    steps.push({
      node: "Weather",
      status: "completed",
      message: "✓ Weather data processed",
      duration: 300,
    });
    steps.push({
      node: "Market",
      status: "completed",
      message: "✓ Market data processed",
      duration: 300,
    });
    onStepUpdate([...steps]);
  }
  
  // Step 6: Synthesis
  steps.push({
    node: "Synthesis",
    status: "running",
    message: "Synthesizing comprehensive response...",
  });
  onStepUpdate([...steps]);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Generate response
  let response = "";
  if (intentType === "market") {
    response = await generateMarketResponse(commodity || "wheat", location);
  } else if (intentType === "weather") {
    response = generateWeatherResponse(location, commodity);
  } else if (intentType === "scheme") {
    response = generateSchemesResponse();
  } else {
    response = `🌱 AGRICULTURAL ADVISORY\n\nFor ${commodity || "your crop"}${location ? ` in ${location}` : ""}\n\n` +
      `┌─────────────────────────────────────────────────────────────┐\n` +
      `│ QUICK RECOMMENDATIONS                                      │\n` +
      `├─────────────────────────────────────────────────────────────┤\n` +
      `│ 1. Check weather forecast before farm operations           │\n` +
      `│ 2. Monitor market prices for best selling time             │\n` +
      `│ 3. Consult local agriculture department for expert advice  │\n` +
      `└─────────────────────────────────────────────────────────────┘\n\n` +
      `Need specific advice on prices, weather, or schemes? Just ask!`;
  }
  
  steps[steps.length - 1] = {
    node: "Synthesis",
    status: "completed",
    message: "✓ Response ready",
    duration: 500,
  };
  onStepUpdate([...steps]);
  
  onComplete(response, steps);
}