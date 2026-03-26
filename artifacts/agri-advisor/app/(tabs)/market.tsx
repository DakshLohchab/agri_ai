import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

type Commodity = {
  name: string;
  msp: number;
  mandiAvg: number;
  unit: string;
  trend: "up" | "down" | "stable";
  trendPct: number;
  icon: string;
  color: string;
};

const COMMODITIES: Commodity[] = [
  { name: "Wheat", msp: 2275, mandiAvg: 2390, unit: "quintal", trend: "up", trendPct: 2.1, icon: "package", color: Colors.warning },
  { name: "Rice (Common)", msp: 2183, mandiAvg: 2280, unit: "quintal", trend: "stable", trendPct: 0.3, icon: "archive", color: Colors.info },
  { name: "Cotton (Long)", msp: 7121, mandiAvg: 7350, unit: "quintal", trend: "down", trendPct: -1.4, icon: "cloud", color: Colors.webSearch },
  { name: "Soybean", msp: 4892, mandiAvg: 5100, unit: "quintal", trend: "up", trendPct: 3.8, icon: "circle", color: Colors.synthesis },
  { name: "Maize", msp: 2090, mandiAvg: 2150, unit: "quintal", trend: "up", trendPct: 1.2, icon: "triangle", color: Colors.secondary },
  { name: "Tomato", msp: 0, mandiAvg: 1200, unit: "quintal", trend: "down", trendPct: -8.5, icon: "disc", color: Colors.guardrails },
  { name: "Onion", msp: 0, mandiAvg: 800, unit: "quintal", trend: "up", trendPct: 12.4, icon: "circle", color: Colors.market },
  { name: "Potato", msp: 0, mandiAvg: 600, unit: "quintal", trend: "stable", trendPct: -0.2, icon: "box", color: Colors.secondary },
];

const SCHEMES = [
  {
    name: "PM-KISAN",
    benefit: "₹6,000/year",
    desc: "Direct income support in 3 installments of ₹2,000",
    icon: "dollar-sign",
    color: Colors.synthesis,
    active: true,
  },
  {
    name: "Pradhan Mantri Fasal Bima",
    benefit: "Crop Insurance",
    desc: "Comprehensive risk coverage for crop failure",
    icon: "shield",
    color: Colors.info,
    active: true,
  },
  {
    name: "Kisan Credit Card",
    benefit: "Credit @ 4%",
    desc: "Short-term credit for agriculture at subsidized interest",
    icon: "credit-card",
    color: Colors.market,
    active: true,
  },
  {
    name: "eNAM",
    benefit: "Online Markets",
    desc: "Transparent price discovery at national level",
    icon: "globe",
    color: Colors.webSearch,
    active: true,
  },
];

export default function MarketScreen() {
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"prices" | "schemes">("prices");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16 }]}
      contentInsetAdjustmentBehavior="automatic"
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
        <Text style={styles.pageTitle}>Market</Text>
        <View style={styles.sourceBadge}>
          <Feather name="alert-circle" size={11} color={Colors.warning} />
          <Text style={styles.sourceText}>AgMarkNet offline — MSP rates</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === "prices" && styles.tabActive]}
          onPress={() => setActiveTab("prices")}
        >
          <Text style={[styles.tabText, activeTab === "prices" && styles.tabTextActive]}>
            Prices
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "schemes" && styles.tabActive]}
          onPress={() => setActiveTab("schemes")}
        >
          <Text style={[styles.tabText, activeTab === "schemes" && styles.tabTextActive]}>
            Gov Schemes
          </Text>
        </Pressable>
      </View>

      {activeTab === "prices" && (
        <>
          <View style={styles.summaryRow}>
            {[
              { label: "Rising", count: COMMODITIES.filter((c) => c.trend === "up").length, color: Colors.success },
              { label: "Stable", count: COMMODITIES.filter((c) => c.trend === "stable").length, color: Colors.warning },
              { label: "Falling", count: COMMODITIES.filter((c) => c.trend === "down").length, color: Colors.error },
            ].map((s) => (
              <View key={s.label} style={[styles.summaryCard, { borderColor: s.color + "44" }]}>
                <Text style={[styles.summaryCount, { color: s.color }]}>{s.count}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {COMMODITIES.map((item) => (
            <View key={item.name} style={styles.commodityCard}>
              <View style={[styles.commodityIcon, { backgroundColor: item.color + "22" }]}>
                <Feather name={item.icon as any} size={20} color={item.color} />
              </View>
              <View style={styles.commodityContent}>
                <View style={styles.commodityHeader}>
                  <Text style={styles.commodityName}>{item.name}</Text>
                  <View
                    style={[
                      styles.trendBadge,
                      {
                        backgroundColor:
                          item.trend === "up"
                            ? Colors.success + "22"
                            : item.trend === "down"
                            ? Colors.error + "22"
                            : Colors.warning + "22",
                      },
                    ]}
                  >
                    <Feather
                      name={item.trend === "up" ? "trending-up" : item.trend === "down" ? "trending-down" : "minus"}
                      size={12}
                      color={item.trend === "up" ? Colors.success : item.trend === "down" ? Colors.error : Colors.warning}
                    />
                    <Text
                      style={[
                        styles.trendText,
                        {
                          color:
                            item.trend === "up"
                              ? Colors.success
                              : item.trend === "down"
                              ? Colors.error
                              : Colors.warning,
                        },
                      ]}
                    >
                      {item.trendPct > 0 ? "+" : ""}
                      {item.trendPct}%
                    </Text>
                  </View>
                </View>
                <View style={styles.priceRow}>
                  <View style={styles.priceItem}>
                    <Text style={styles.priceLabel}>Mandi</Text>
                    <Text style={styles.priceValue}>₹{item.mandiAvg.toLocaleString()}</Text>
                  </View>
                  {item.msp > 0 && (
                    <View style={styles.priceItem}>
                      <Text style={styles.priceLabel}>MSP</Text>
                      <Text style={[styles.priceValue, { color: Colors.textSecondary }]}>
                        ₹{item.msp.toLocaleString()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.priceUnit}>/{item.unit}</Text>
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      {activeTab === "schemes" && (
        <View style={styles.schemeList}>
          {SCHEMES.map((scheme) => (
            <View key={scheme.name} style={[styles.schemeCard, { borderColor: scheme.color + "44" }]}>
              <View style={[styles.schemeIcon, { backgroundColor: scheme.color + "22" }]}>
                <Feather name={scheme.icon as any} size={22} color={scheme.color} />
              </View>
              <View style={styles.schemeContent}>
                <View style={styles.schemeHeader}>
                  <Text style={styles.schemeName}>{scheme.name}</Text>
                  <View style={[styles.schemeBenefit, { backgroundColor: scheme.color + "22" }]}>
                    <Text style={[styles.schemeBenefitText, { color: scheme.color }]}>
                      {scheme.benefit}
                    </Text>
                  </View>
                </View>
                <Text style={styles.schemeDesc}>{scheme.desc}</Text>
                <Pressable style={styles.learnMore}>
                  <Text style={[styles.learnMoreText, { color: scheme.color }]}>Learn more</Text>
                  <Feather name="arrow-right" size={12} color={scheme.color} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, gap: 16 },
  pageHeader: { gap: 6 },
  pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5 },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.warning + "11",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: Colors.warning + "33",
  },
  sourceText: { fontSize: 11, color: Colors.warning, fontFamily: "Inter_500Medium" },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  tabTextActive: { color: Colors.white, fontFamily: "Inter_600SemiBold" },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  summaryCount: { fontSize: 24, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  commodityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 14,
  },
  commodityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  commodityContent: { flex: 1, gap: 8 },
  commodityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commodityName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  trendText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  priceItem: { gap: 2 },
  priceLabel: { fontSize: 10, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  priceValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  priceUnit: { fontSize: 12, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  schemeList: { gap: 12 },
  schemeCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    alignItems: "flex-start",
  },
  schemeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  schemeContent: { flex: 1, gap: 8 },
  schemeHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  schemeName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text, flex: 1 },
  schemeBenefit: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  schemeBenefitText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  schemeDesc: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 20 },
  learnMore: { flexDirection: "row", alignItems: "center", gap: 4 },
  learnMoreText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
