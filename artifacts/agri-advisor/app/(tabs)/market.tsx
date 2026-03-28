import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useLocalizedStrings } from "@/hooks/useLocalizedStrings";
import { useTabBarSpacing } from "@/hooks/useTabBarSpacing";

type MandiRecord = {
  market: string;
  state: string;
  district: string;
  commodity: string;
  modal_price: number;
  min_price: number;
  max_price: number;
  variety: string;
  arrival_date: string;
};

type LiveMarketData = {
  commodity: string;
  records: MandiRecord[];
  avg_modal: number;
  msp?: number;
  msp_grade?: string;
  source: "live" | "cached" | "offline";
  last_fetched: string;
};

type SchemeInfo = {
  name: string;
  benefit: string;
  desc: string;
  icon: string;
  color: string;
  url?: string;
};

const AGMARKNET_API_KEY =
  process.env.EXPO_PUBLIC_DATA_GOV_API_KEY ||
  "579b464db66ec23bdd0000012e9054ad4d444cdc6ebf564cfca67cc1";

const AGMARKNET_URL =
  "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "http://localhost:3000");

const MARKET_CACHE_PREFIX = "agri_market_cache_v1";

const MSP_2024_25: Record<string, { msp: number; grade: string; trend: "up" | "down" | "stable"; trendPct: number }> = {
  Wheat:     { msp: 2275, grade: "FAQ",            trend: "up",     trendPct: 2.1 },
  Rice:      { msp: 2183, grade: "Common",          trend: "stable", trendPct: 0.3 },
  Cotton:    { msp: 7121, grade: "Medium staple",   trend: "down",   trendPct: -1.4 },
  Soybean:   { msp: 4892, grade: "Yellow",          trend: "up",     trendPct: 3.8 },
  Maize:     { msp: 2090, grade: "Yellow",          trend: "up",     trendPct: 1.2 },
  Mustard:   { msp: 5650, grade: "Bold",            trend: "stable", trendPct: 0.8 },
  Groundnut: { msp: 6377, grade: "With shell",      trend: "up",     trendPct: 1.9 },
  Tomato:    { msp: 0,    grade: "—",               trend: "down",   trendPct: -8.5 },
  Onion:     { msp: 0,    grade: "—",               trend: "up",     trendPct: 12.4 },
  Potato:    { msp: 0,    grade: "—",               trend: "stable", trendPct: -0.2 },
};

const COMMODITY_COLORS: Record<string, string> = {
  Wheat: Colors.warning,
  Rice: Colors.info,
  Cotton: Colors.webSearch,
  Soybean: Colors.synthesis,
  Maize: Colors.secondary,
  Mustard: "#f59e0b",
  Groundnut: "#d97706",
  Tomato: Colors.guardrails,
  Onion: Colors.market,
  Potato: Colors.secondary,
};

const COMMODITY_ICONS: Record<string, string> = {
  Wheat: "package", Rice: "archive", Cotton: "cloud", Soybean: "circle",
  Maize: "triangle", Mustard: "disc", Groundnut: "box", Tomato: "disc",
  Onion: "circle", Potato: "box",
};

const SCHEMES: SchemeInfo[] = [
  {
    name: "PM-KISAN",
    benefit: "₹6,000/year",
    desc: "Direct income support in 3 installments of ₹2,000 each",
    icon: "dollar-sign",
    color: Colors.synthesis,
    url: "https://pmkisan.gov.in",
  },
  {
    name: "PMFBY — Crop Insurance",
    benefit: "From 1.5% premium",
    desc: "Comprehensive risk coverage for crop failure, weather damage",
    icon: "shield",
    color: Colors.info,
    url: "https://pmfby.gov.in",
  },
  {
    name: "Kisan Credit Card",
    benefit: "Credit @ 4%",
    desc: "Short-term credit up to ₹3 lakh at 4% effective interest",
    icon: "credit-card",
    color: Colors.market,
  },
  {
    name: "eNAM",
    benefit: "Online Markets",
    desc: "Pan-India transparent price discovery across 1000+ mandis",
    icon: "globe",
    color: Colors.webSearch,
    url: "https://enam.gov.in",
  },
  {
    name: "PM Krishi Sinchai",
    benefit: "Up to 70% subsidy",
    desc: "Drip & sprinkler irrigation subsidy — 'More Crop Per Drop'",
    icon: "droplet",
    color: Colors.weather,
  },
  {
    name: "Soil Health Card",
    benefit: "Free soil testing",
    desc: "Free soil nutrient testing + crop-specific fertilizer advisory",
    icon: "activity",
    color: Colors.guardrails,
  },
];

const POPULAR_COMMODITIES = ["Wheat", "Rice", "Maize", "Soybean", "Cotton", "Onion", "Tomato", "Potato", "Mustard", "Groundnut"];

function formatINR(n: number): string {
  if (!n || n === 0) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

function normalizeAgmarknetRecords(payload: any, commodity: string): MandiRecord[] {
  const rawRecords = Array.isArray(payload?.records) ? payload.records : [];

  return rawRecords
    .map((r: any) => ({
      market: r.market || r.mandi || "Local Mandi",
      state: r.state || "",
      district: r.district || "",
      commodity: r.commodity || commodity,
      modal_price: parseFloat(r.modal_price) || 0,
      min_price: parseFloat(r.min_price) || 0,
      max_price: parseFloat(r.max_price) || 0,
      variety: r.variety || "",
      arrival_date: r.arrival_date || "",
    }))
    .filter((r: MandiRecord) => r.modal_price > 0);
}

async function fetchAgmarknetDirect(
  commodity: string,
  state?: string
): Promise<{ records: MandiRecord[]; message?: string }> {
  const params = new URLSearchParams({
    "api-key": AGMARKNET_API_KEY,
    format: "json",
    "filters[commodity]": commodity,
    limit: "30",
    offset: "0",
  });
  if (state) params.set("filters[state]", state);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${AGMARKNET_URL}?${params}`, {
      signal: controller.signal as any,
    });
    clearTimeout(timeoutId);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || data?.message || `AGMARKNET request failed (${res.status})`);
    }

    if (
      !Array.isArray(data?.records) &&
      (data?.error || data?.message || data?.status === "error")
    ) {
      throw new Error(data?.error || data?.message || "AGMARKNET returned an unexpected response");
    }

    return {
      records: normalizeAgmarknetRecords(data, commodity),
      message: typeof data?.message === "string" ? data.message : undefined,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchAgmarknet(
  commodity: string,
  state?: string
): Promise<{ records: MandiRecord[]; message?: string }> {
  const params = new URLSearchParams({
    commodity,
    limit: "30",
  });
  if (state) params.set("state", state);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${BACKEND_URL}/api/market/agmarknet?${params}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal as any,
    });
    clearTimeout(timeoutId);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || data?.message || `Market proxy failed (${res.status})`);
    }

    return {
      records: normalizeAgmarknetRecords(data, commodity),
      message: typeof data?.message === "string" ? data.message : undefined,
    };
  } catch {
    return await fetchAgmarknetDirect(commodity, state);
  }
}

function getMarketCacheKey(commodity: string, state?: string) {
  return `${MARKET_CACHE_PREFIX}:${commodity}:${(state || "all").trim().toLowerCase()}`;
}

async function loadCachedMarketData(
  commodity: string,
  state?: string
): Promise<LiveMarketData | null> {
  try {
    const cached = await AsyncStorage.getItem(getMarketCacheKey(commodity, state));
    if (!cached) return null;

    const parsed = JSON.parse(cached) as LiveMarketData;
    if (!Array.isArray(parsed.records) || parsed.records.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveCachedMarketData(
  commodity: string,
  state: string | undefined,
  data: LiveMarketData
) {
  try {
    await AsyncStorage.setItem(getMarketCacheKey(commodity, state), JSON.stringify(data));
  } catch {
  }
}

export default function MarketScreen() {
  const ui = useLocalizedStrings({
    market: "Market",
    prices: "Prices",
    govSchemes: "Gov Schemes",
    apply: "Apply",
    searchMarkets: "Search markets...",
    filterByState: "Filter by state (e.g. Punjab)",
    retry: "Retry",
    liveDataUnavailable: "Live data unavailable",
  });
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isWide = width >= 768;
  const isDesktop = width >= 1180;
  const tabBarSpacing = useTabBarSpacing();

  const [activeTab, setActiveTab] = useState<"prices" | "schemes">("prices");
  const [selectedCommodity, setSelectedCommodity] = useState("Wheat");
  const [liveData, setLiveData] = useState<LiveMarketData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [allCommoditiesSummary, setAllCommoditiesSummary] = useState<
    { name: string; avg: number; count: number; trend: "up" | "down" | "stable"; trendPct: number }[]
  >([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fetchCommodityDetail = async (commodity: string, state?: string, silent = false) => {
    if (!silent) setIsLoading(true);
    setError("");

    try {
      const { records, message } = await fetchAgmarknet(commodity, state || undefined);
      const mspInfo = MSP_2024_25[commodity];
      const avg = records.length
        ? Math.round(records.reduce((s, r) => s + r.modal_price, 0) / records.length)
        : 0;

      const nextLiveData: LiveMarketData = {
        commodity,
        records,
        avg_modal: avg,
        msp: mspInfo?.msp,
        msp_grade: mspInfo?.grade,
        source: "live",
        last_fetched: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      };

      if (records.length === 0) {
        setError(
          message ||
            `No current AGMARKNET records found for ${commodity}${state ? ` in ${state}` : ""}. Try another commodity or clear the state filter.`
        );
      }

      setLiveData(nextLiveData);
      if (records.length > 0) {
        await saveCachedMarketData(commodity, state, nextLiveData);
      }
    } catch (e: any) {
      const cached = await loadCachedMarketData(commodity, state);
      if (cached) {
        setError("Live AGMARKNET is unavailable right now. Showing recently saved market data.");
        setLiveData({
          ...cached,
          commodity,
          msp: MSP_2024_25[commodity]?.msp,
          msp_grade: MSP_2024_25[commodity]?.grade,
          source: "cached",
        });
        return;
      }

      setError(e?.message || "Could not load live market data. Showing MSP reference rates.");
      const mspInfo = MSP_2024_25[commodity];
      setLiveData({
        commodity,
        records: [],
        avg_modal: mspInfo?.msp ?? 0,
        msp: mspInfo?.msp,
        msp_grade: mspInfo?.grade,
        source: "offline",
        last_fetched: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchSummary = async () => {
    setSummaryLoading(true);
    const summaries: typeof allCommoditiesSummary = [];
    const topCommodities = ["Wheat", "Rice", "Soybean", "Maize", "Cotton"];

    for (const c of topCommodities) {
      try {
        const { records } = await fetchAgmarknet(c);
        const avg = records.length
          ? Math.round(records.reduce((s, r) => s + r.modal_price, 0) / records.length)
          : 0;
        const msp = MSP_2024_25[c];
        summaries.push({
          name: c,
          avg,
          count: records.length,
          trend: msp?.trend ?? "stable",
          trendPct: msp?.trendPct ?? 0,
        });
      } catch {
        const msp = MSP_2024_25[c];
        summaries.push({ name: c, avg: msp?.msp ?? 0, count: 0, trend: msp?.trend ?? "stable", trendPct: msp?.trendPct ?? 0 });
      }
    }

    setAllCommoditiesSummary(summaries.sort((a, b) => topCommodities.indexOf(a.name) - topCommodities.indexOf(b.name)));
    setSummaryLoading(false);
  };

  useEffect(() => {
    fetchCommodityDetail(selectedCommodity);
    fetchSummary();
  }, []);

  const handleCommoditySelect = (c: string) => {
    setSelectedCommodity(c);
    setStateFilter("");
    fetchCommodityDetail(c);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchCommodityDetail(selectedCommodity, stateFilter || undefined, true);
  };

  const handleStateFilter = () => {
    fetchCommodityDetail(selectedCommodity, stateFilter || undefined);
  };

  const filteredRecords = liveData?.records.filter(
    (r) =>
      r.market.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.district.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const mspInfo = MSP_2024_25[selectedCommodity];
  const commodityColor = COMMODITY_COLORS[selectedCommodity] ?? Colors.primary;

  const contentPad = isWeb && isWide ? 40 : 20;
  const maxW = isWeb && isDesktop ? 1180 : isWeb && isWide ? 960 : undefined;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: contentPad, paddingBottom: isWeb ? 40 : tabBarSpacing },
          maxW ? { alignSelf: "center", width: "100%", maxWidth: maxW } : null,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.market}
          />
        }
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>{ui.market}</Text>
          <View style={[styles.sourceBadge, {
            backgroundColor:
              liveData?.source === "live"
                ? Colors.success + "15"
                : liveData?.source === "cached"
                  ? Colors.info + "15"
                  : Colors.warning + "15",
          }]}>
            <Feather
              name={
                liveData?.source === "live"
                  ? "check-circle"
                  : liveData?.source === "cached"
                    ? "clock"
                    : "alert-circle"
              }
              size={11}
              color={
                liveData?.source === "live"
                  ? Colors.success
                  : liveData?.source === "cached"
                    ? Colors.info
                    : Colors.warning
              }
            />
            <Text style={[styles.sourceText, {
              color:
                liveData?.source === "live"
                  ? Colors.success
                  : liveData?.source === "cached"
                    ? Colors.info
                    : Colors.warning,
            }]}>
              {liveData?.source === "live"
                ? `Live AGMARKNET · ${liveData.last_fetched}`
                : "AGMARKNET offline — MSP rates"}
            </Text>
          </View>
        </View>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === "prices" && styles.tabActive]}
            onPress={() => setActiveTab("prices")}
          >
            <Feather name="trending-up" size={14} color={activeTab === "prices" ? Colors.white : Colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === "prices" && styles.tabTextActive]}>{ui.prices}</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "schemes" && styles.tabActive]}
            onPress={() => setActiveTab("schemes")}
          >
            <Feather name="shield" size={14} color={activeTab === "schemes" ? Colors.white : Colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === "schemes" && styles.tabTextActive]}>{ui.govSchemes}</Text>
          </Pressable>
        </View>

        {activeTab === "prices" && (
          <>
            <View style={[styles.summaryRow, isWide && styles.summaryRowWide]}>
              {summaryLoading
                ? [0, 1, 2].map((i) => (
                    <View key={i} style={[styles.summaryCard, { flex: 1, minWidth: 80 }]}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                    </View>
                  ))
                : allCommoditiesSummary.map((s) => (
                    <Pressable
                      key={s.name}
                      style={[
                        styles.summaryCard,
                        { flex: 1, minWidth: 80, borderColor: (COMMODITY_COLORS[s.name] ?? Colors.primary) + "44" },
                        selectedCommodity === s.name && { backgroundColor: (COMMODITY_COLORS[s.name] ?? Colors.primary) + "15" },
                      ]}
                      onPress={() => handleCommoditySelect(s.name)}
                    >
                      <Text style={[styles.summaryName, { color: COMMODITY_COLORS[s.name] ?? Colors.primary }]}>
                        {s.name}
                      </Text>
                      <Text style={[styles.summaryPrice, { color: COMMODITY_COLORS[s.name] ?? Colors.text }]}>
                        {s.avg > 0 ? `₹${formatINR(s.avg)}` : "—"}
                      </Text>
                      <View style={[styles.trendBadge, {
                        backgroundColor: s.trend === "up" ? Colors.success + "22" : s.trend === "down" ? Colors.error + "22" : Colors.warning + "22",
                      }]}>
                        <Feather
                          name={s.trend === "up" ? "trending-up" : s.trend === "down" ? "trending-down" : "minus"}
                          size={10}
                          color={s.trend === "up" ? Colors.success : s.trend === "down" ? Colors.error : Colors.warning}
                        />
                        <Text style={[styles.trendText, {
                          color: s.trend === "up" ? Colors.success : s.trend === "down" ? Colors.error : Colors.warning,
                        }]}>
                          {s.trendPct > 0 ? "+" : ""}{s.trendPct}%
                        </Text>
                      </View>
                    </Pressable>
                  ))}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              {POPULAR_COMMODITIES.map((c) => (
                <Pressable
                  key={c}
                  style={[
                    styles.commodityChip,
                    selectedCommodity === c && {
                      backgroundColor: (COMMODITY_COLORS[c] ?? Colors.primary) + "22",
                      borderColor: COMMODITY_COLORS[c] ?? Colors.primary,
                    },
                  ]}
                  onPress={() => handleCommoditySelect(c)}
                >
                  <Feather
                    name={(COMMODITY_ICONS[c] ?? "package") as any}
                    size={12}
                    color={selectedCommodity === c ? (COMMODITY_COLORS[c] ?? Colors.primary) : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.commodityChipText,
                      selectedCommodity === c && { color: COMMODITY_COLORS[c] ?? Colors.primary, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={[styles.filterRow, isWide && { flexDirection: "row", gap: 12 }]}>
              <View style={[styles.searchBox, isWide && { flex: 1 }]}>
                <Feather name="map-pin" size={14} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={ui.filterByState}
                  placeholderTextColor={Colors.textMuted}
                  value={stateFilter}
                  onChangeText={setStateFilter}
                  onSubmitEditing={handleStateFilter}
                  returnKeyType="search"
                />
                {stateFilter.length > 0 && (
                  <Pressable onPress={() => { setStateFilter(""); fetchCommodityDetail(selectedCommodity); }}>
                    <Feather name="x" size={14} color={Colors.textMuted} />
                  </Pressable>
                )}
              </View>
              <View style={[styles.searchBox, isWide && { flex: 1 }]}>
                <Feather name="search" size={14} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={ui.searchMarkets}
                  placeholderTextColor={Colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <Pressable
                style={styles.filterBtn}
                onPress={handleStateFilter}
              >
                <Feather name="filter" size={14} color={Colors.white} />
                <Text style={styles.filterBtnText}>{ui.apply}</Text>
              </Pressable>
            </View>

            <View style={[styles.detailCard, { borderColor: commodityColor + "44" }]}>
              <View style={styles.detailHeader}>
                <View style={[styles.detailIcon, { backgroundColor: commodityColor + "22" }]}>
                  <Feather name={(COMMODITY_ICONS[selectedCommodity] ?? "package") as any} size={22} color={commodityColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailTitle, { color: commodityColor }]}>{selectedCommodity}</Text>
                  {mspInfo?.grade && <Text style={styles.detailGrade}>{mspInfo.grade}</Text>}
                </View>
                {mspInfo?.trend && (
                  <View style={[styles.trendBadge, {
                    backgroundColor: mspInfo.trend === "up" ? Colors.success + "22" : mspInfo.trend === "down" ? Colors.error + "22" : Colors.warning + "22",
                  }]}>
                    <Feather
                      name={mspInfo.trend === "up" ? "trending-up" : mspInfo.trend === "down" ? "trending-down" : "minus"}
                      size={12}
                      color={mspInfo.trend === "up" ? Colors.success : mspInfo.trend === "down" ? Colors.error : Colors.warning}
                    />
                    <Text style={[styles.trendText, {
                      color: mspInfo.trend === "up" ? Colors.success : mspInfo.trend === "down" ? Colors.error : Colors.warning,
                    }]}>
                      {mspInfo.trendPct > 0 ? "+" : ""}{mspInfo.trendPct}%
                    </Text>
                  </View>
                )}
              </View>

              <View style={[styles.priceCompareRow, isWide && styles.priceCompareRowWide]}>
                {mspInfo && mspInfo.msp > 0 && (
                  <View style={[styles.priceBox, { borderColor: Colors.info + "44", backgroundColor: Colors.info + "08" }]}>
                    <Text style={styles.priceBoxLabel}>MSP 2024-25</Text>
                    <Text style={[styles.priceBoxValue, { color: Colors.info }]}>₹{formatINR(mspInfo.msp)}</Text>
                    <Text style={styles.priceBoxUnit}>/quintal</Text>
                  </View>
                )}
                {liveData && liveData.avg_modal > 0 && (
                  <View style={[styles.priceBox, { borderColor: commodityColor + "44", backgroundColor: commodityColor + "08" }]}>
                    <Text style={styles.priceBoxLabel}>
                      {liveData.source === "live" ? "Live Avg Modal" : "Reference Avg"}
                    </Text>
                    <Text style={[styles.priceBoxValue, { color: commodityColor }]}>₹{formatINR(liveData.avg_modal)}</Text>
                    <Text style={styles.priceBoxUnit}>/quintal</Text>
                  </View>
                )}
                {liveData && mspInfo && mspInfo.msp > 0 && liveData.avg_modal > 0 && (
                  <View style={[styles.priceBox, {
                    borderColor: (liveData.avg_modal >= mspInfo.msp ? Colors.success : Colors.error) + "44",
                    backgroundColor: (liveData.avg_modal >= mspInfo.msp ? Colors.success : Colors.error) + "08",
                  }]}>
                    <Text style={styles.priceBoxLabel}>vs MSP</Text>
                    <Text style={[styles.priceBoxValue, {
                      color: liveData.avg_modal >= mspInfo.msp ? Colors.success : Colors.error,
                    }]}>
                      {liveData.avg_modal >= mspInfo.msp ? "+" : ""}
                      {(((liveData.avg_modal - mspInfo.msp) / mspInfo.msp) * 100).toFixed(1)}%
                    </Text>
                    <Text style={styles.priceBoxUnit}>premium</Text>
                  </View>
                )}
              </View>

              {liveData && mspInfo && mspInfo.msp > 0 && liveData.avg_modal > 0 && (
                <View style={[styles.signalBanner, {
                  backgroundColor: liveData.avg_modal >= mspInfo.msp * 1.1
                    ? Colors.success + "15"
                    : liveData.avg_modal >= mspInfo.msp
                    ? Colors.info + "15"
                    : Colors.error + "15",
                  borderColor: liveData.avg_modal >= mspInfo.msp * 1.1
                    ? Colors.success + "44"
                    : liveData.avg_modal >= mspInfo.msp
                    ? Colors.info + "44"
                    : Colors.error + "44",
                }]}>
                  <Feather
                    name={liveData.avg_modal >= mspInfo.msp * 1.1 ? "check-circle" : liveData.avg_modal >= mspInfo.msp ? "info" : "alert-triangle"}
                    size={15}
                    color={liveData.avg_modal >= mspInfo.msp * 1.1 ? Colors.success : liveData.avg_modal >= mspInfo.msp ? Colors.info : Colors.error}
                  />
                  <Text style={[styles.signalText, {
                    color: liveData.avg_modal >= mspInfo.msp * 1.1 ? Colors.success : liveData.avg_modal >= mspInfo.msp ? Colors.info : Colors.error,
                  }]}>
                    {liveData.avg_modal >= mspInfo.msp * 1.1
                      ? "Excellent — Sell now, prices significantly above MSP"
                      : liveData.avg_modal >= mspInfo.msp
                      ? "Good — Prices above MSP, fair to sell"
                      : "Caution — Prices below MSP, contact FCI/state procurement"}
                  </Text>
                </View>
              )}
            </View>

            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={commodityColor} />
                <Text style={styles.loadingText}>Fetching live AGMARKNET data...</Text>
              </View>
            ) : filteredRecords.length > 0 ? (
              <View style={styles.tableCard}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeader, { flex: 2 }]}>Market / State</Text>
                  <Text style={[styles.tableHeader, { flex: 1, textAlign: "right" }]}>Modal</Text>
                  <Text style={[styles.tableHeader, { flex: 1, textAlign: "right" }]}>Min</Text>
                  <Text style={[styles.tableHeader, { flex: 1, textAlign: "right" }]}>Max</Text>
                </View>
                {filteredRecords.map((record, i) => (
                  <View
                    key={i}
                    style={[styles.tableRow, i % 2 === 0 && { backgroundColor: Colors.surfaceElevated + "55" }]}
                  >
                    <View style={{ flex: 2 }}>
                      <Text style={styles.tableMarket} numberOfLines={1}>{record.market}</Text>
                      <Text style={styles.tableState}>{record.state}{record.district ? ` · ${record.district}` : ""}</Text>
                      {record.variety ? <Text style={styles.tableVariety}>{record.variety}</Text> : null}
                    </View>
                    <Text style={[styles.tablePrice, { flex: 1, textAlign: "right", color: commodityColor }]}>
                      ₹{formatINR(record.modal_price)}
                    </Text>
                    <Text style={[styles.tablePriceSm, { flex: 1, textAlign: "right" }]}>
                      ₹{formatINR(record.min_price)}
                    </Text>
                    <Text style={[styles.tablePriceSm, { flex: 1, textAlign: "right" }]}>
                      ₹{formatINR(record.max_price)}
                    </Text>
                  </View>
                ))}
                <View style={styles.tableFooter}>
                  <Feather name="database" size={11} color={Colors.textMuted} />
                  <Text style={styles.tableFooterText}>
                    {filteredRecords.length} records · AGMARKNET data.gov.in
                    {liveData?.last_fetched ? ` · ${liveData.last_fetched}` : ""}
                  </Text>
                </View>
              </View>
            ) : liveData && liveData.source === "offline" ? (
              <View style={styles.offlineCard}>
                <Feather name="wifi-off" size={32} color={Colors.warning} />
                <Text style={styles.offlineTitle}>{ui.liveDataUnavailable}</Text>
                <Text style={styles.offlineDesc}>
                  We could not reach AGMARKNET for "{selectedCommodity}"{stateFilter ? ` in ${stateFilter}` : ""}.
                  Showing MSP reference rates above while live data is unavailable.
                </Text>
                <Pressable style={styles.retryBtn} onPress={handleRefresh}>
                  <Feather name="refresh-cw" size={14} color={Colors.white} />
                  <Text style={styles.retryText}>{ui.retry}</Text>
                </Pressable>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Feather
                  name={liveData?.source === "live" ? "info" : "alert-circle"}
                  size={18}
                  color={liveData?.source === "live" ? Colors.info : Colors.warning}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </>
        )}

        {activeTab === "schemes" && (
          <View style={[styles.schemeGrid, isWide && styles.schemeGridWide]}>
            {SCHEMES.map((scheme) => (
              <View
                key={scheme.name}
                style={[
                  styles.schemeCard,
                  { borderColor: scheme.color + "44" },
                  isWide && { width: "48%", minWidth: 280 },
                ]}
              >
                <View style={[styles.schemeIcon, { backgroundColor: scheme.color + "22" }]}>
                  <Feather name={scheme.icon as any} size={22} color={scheme.color} />
                </View>
                <View style={styles.schemeContent}>
                  <View style={styles.schemeHeader}>
                    <Text style={styles.schemeName}>{scheme.name}</Text>
                    <View style={[styles.schemeBenefit, { backgroundColor: scheme.color + "22" }]}>
                      <Text style={[styles.schemeBenefitText, { color: scheme.color }]}>{scheme.benefit}</Text>
                    </View>
                  </View>
                  <Text style={styles.schemeDesc}>{scheme.desc}</Text>
                  {scheme.url && (
                    <Text style={[styles.schemeUrl, { color: scheme.color }]}>🔗 {scheme.url}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { gap: 16, paddingTop: 16 },
  pageHeader: { gap: 6 },
  pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5 },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "transparent",
  },
  sourceText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  tabTextActive: { color: Colors.white, fontFamily: "Inter_600SemiBold" },

  summaryRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  summaryRowWide: { flexWrap: "nowrap" },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 12,
    alignItems: "center",
    gap: 4,
    minWidth: 80,
  },
  summaryName: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  summaryPrice: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  trendBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 20 },
  trendText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  chipScroll: { marginHorizontal: -4 },
  commodityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  commodityChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },

  filterRow: { gap: 8 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, fontFamily: "Inter_400Regular" },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.white },

  detailCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  detailTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  detailGrade: { fontSize: 12, color: Colors.textMuted, fontFamily: "Inter_400Regular" },

  priceCompareRow: { flexDirection: "row", gap: 10 },
  priceCompareRowWide: { gap: 12 },
  priceBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 2,
  },
  priceBoxLabel: { fontSize: 10, color: Colors.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },
  priceBoxValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  priceBoxUnit: { fontSize: 10, color: Colors.textMuted, fontFamily: "Inter_400Regular" },

  signalBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  signalText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },

  loadingBox: { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.warning + "15",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.warning + "33",
    padding: 14,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.text, fontFamily: "Inter_400Regular" },

  tableCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  tableHeader: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder + "66", alignItems: "center" },
  tableMarket: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  tableState: { fontSize: 11, color: Colors.textSecondary, fontFamily: "Inter_400Regular", marginTop: 1 },
  tableVariety: { fontSize: 10, color: Colors.textMuted, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 1 },
  tablePrice: { fontSize: 14, fontFamily: "Inter_700Bold" },
  tablePriceSm: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  tableFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceElevated + "55",
  },
  tableFooterText: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular" },

  offlineCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.warning + "33",
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  offlineTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  offlineDesc: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, fontFamily: "Inter_400Regular" },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.warning, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.white },

  schemeGrid: { gap: 12 },
  schemeGridWide: { flexDirection: "row", flexWrap: "wrap" },
  schemeCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    alignItems: "flex-start",
  },
  schemeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 2 },
  schemeContent: { flex: 1, gap: 8 },
  schemeHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  schemeName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text, flex: 1 },
  schemeBenefit: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  schemeBenefitText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  schemeDesc: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 20 },
  schemeUrl: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
});
