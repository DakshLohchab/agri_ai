import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

type WeatherDay = {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  precipitationSum: number;
  windSpeed: number;
  uvIndex: number;
};

const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "sun" },
  1: { label: "Mainly clear", icon: "sun" },
  2: { label: "Partly cloudy", icon: "cloud" },
  3: { label: "Overcast", icon: "cloud" },
  45: { label: "Foggy", icon: "wind" },
  51: { label: "Light drizzle", icon: "cloud-drizzle" },
  61: { label: "Light rain", icon: "cloud-rain" },
  63: { label: "Moderate rain", icon: "cloud-rain" },
  80: { label: "Rain showers", icon: "cloud-rain" },
  95: { label: "Thunderstorm", icon: "cloud-lightning" },
};

function getWeather(code: number) {
  return WMO_CODES[code] ?? { label: "Unknown", icon: "cloud" };
}

export default function WeatherScreen() {
  const { user } = useAuth();
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [currentTemp, setCurrentTemp] = useState<number | null>(null);

  const LOCATIONS: Record<string, { lat: number; lon: number }> = {
    default: { lat: 18.9667, lon: 72.8333 },
    pune: { lat: 18.5204, lon: 73.8567 },
    delhi: { lat: 28.6139, lon: 77.209 },
    mumbai: { lat: 18.9667, lon: 72.8333 },
    hyderabad: { lat: 17.385, lon: 78.4867 },
  };

  const getCoords = () => {
    const loc = user?.location?.toLowerCase() ?? "";
    for (const key of Object.keys(LOCATIONS)) {
      if (loc.includes(key)) return LOCATIONS[key];
    }
    return LOCATIONS.default;
  };

  const fetchWeather = async () => {
    setError("");
    try {
      const { lat, lon } = getCoords();
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max,uv_index_max&current_weather=true&timezone=Asia%2FKolkata&forecast_days=7`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.daily) {
        const days: WeatherDay[] = data.daily.time.map((date: string, i: number) => ({
          date,
          maxTemp: Math.round(data.daily.temperature_2m_max[i]),
          minTemp: Math.round(data.daily.temperature_2m_min[i]),
          weatherCode: data.daily.weathercode[i],
          precipitationSum: data.daily.precipitation_sum[i] ?? 0,
          windSpeed: Math.round(data.daily.windspeed_10m_max[i]),
          uvIndex: data.daily.uv_index_max[i] ?? 0,
        }));
        setWeather(days);
        setCurrentTemp(Math.round(data.current_weather?.temperature ?? data.daily.temperature_2m_max[0]));
      }
    } catch (e) {
      setError("Weather data unavailable. Check your connection.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchWeather(); }, []);

  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date().toDateString();
    if (d.toDateString() === today) return "Today";
    return d.toLocaleDateString([], { weekday: "short" });
  };

  const today = weather[0];
  const todayWeather = today ? getWeather(today.weatherCode) : null;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: 16, paddingBottom: 90 }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => { setIsRefreshing(true); fetchWeather(); }}
            tintColor={Colors.weather}
          />
        }
      >
        <View style={styles.headerCard}>
          <View style={[styles.headerCardIcon, { backgroundColor: Colors.weather + "22" }]}>
            <Feather name="cloud" size={24} color={Colors.weather} />
          </View>
          <View style={styles.headerCardContent}>
            <Text style={styles.headerCardTitle}>7-Day Forecast</Text>
            <Text style={styles.headerCardDesc}>Live weather data for better planning</Text>
          </View>
        </View>

        <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Weather</Text>
        <Text style={styles.pageLocation}>
          <Feather name="map-pin" size={12} color={Colors.textMuted} />
          {" "}{user?.location ?? "India"}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.weather} />
          <Text style={styles.loadingText}>Fetching live weather...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={20} color={Colors.warning} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchWeather}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {today && (
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.tempBig}>{currentTemp ?? today.maxTemp}°C</Text>
                  <Text style={styles.weatherLabel}>{todayWeather?.label}</Text>
                  <Text style={styles.tempRange}>
                    H:{today.maxTemp}° L:{today.minTemp}°
                  </Text>
                </View>
                <View style={styles.heroIconContainer}>
                  <Feather name={todayWeather?.icon as any ?? "sun"} size={52} color={Colors.weather} />
                </View>
              </View>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Feather name="cloud-rain" size={14} color={Colors.info} />
                  <Text style={styles.heroStatValue}>{today.precipitationSum}mm</Text>
                  <Text style={styles.heroStatLabel}>Rain</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Feather name="wind" size={14} color={Colors.textSecondary} />
                  <Text style={styles.heroStatValue}>{today.windSpeed} km/h</Text>
                  <Text style={styles.heroStatLabel}>Wind</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Feather name="sun" size={14} color={Colors.warning} />
                  <Text style={styles.heroStatValue}>{today.uvIndex.toFixed(0)}</Text>
                  <Text style={styles.heroStatLabel}>UV Index</Text>
                </View>
              </View>
              <View style={styles.sourceBadge}>
                <Feather name="check-circle" size={11} color={Colors.success} />
                <Text style={styles.sourceText}>Live data — Open-Meteo API</Text>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>7-Day Forecast</Text>
          <View style={styles.forecastList}>
            {weather.map((day, i) => {
              const w = getWeather(day.weatherCode);
              return (
                <View key={day.date} style={[styles.forecastItem, i === 0 && styles.forecastItemFirst]}>
                  <Text style={styles.forecastDay}>{formatDay(day.date)}</Text>
                  <Feather name={w.icon as any} size={18} color={i === 0 ? Colors.weather : Colors.textSecondary} />
                  <Text style={styles.forecastDesc}>{w.label}</Text>
                  <View style={styles.forecastRain}>
                    <Feather name="droplet" size={10} color={Colors.info} />
                    <Text style={styles.forecastRainText}>{day.precipitationSum}mm</Text>
                  </View>
                  <Text style={styles.forecastTemp}>{day.maxTemp}° / {day.minTemp}°</Text>
                </View>
              );
            })}
          </View>

          {today && today.precipitationSum > 5 && (
            <View style={styles.alertCard}>
              <Feather name="alert-triangle" size={18} color={Colors.warning} />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>Rainfall Advisory</Text>
                <Text style={styles.alertDesc}>
                  Expected {today.precipitationSum}mm rain today. Consider delaying spraying operations and protecting sensitive crops.
                </Text>
              </View>
            </View>
          )}
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, gap: 20 },
  pageHeader: { gap: 4 },
  pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5 },
  pageLocation: { fontSize: 13, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  loading: { alignItems: "center", paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  errorBox: {
    backgroundColor: Colors.warning + "22",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.warning + "44",
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  errorText: { fontSize: 14, color: Colors.text, textAlign: "center", fontFamily: "Inter_400Regular" },
  retryBtn: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.white },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.weather + "44",
    padding: 24,
    gap: 20,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tempBig: { fontSize: 56, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -2 },
  weatherLabel: { fontSize: 18, color: Colors.weather, fontFamily: "Inter_500Medium", marginTop: 4 },
  tempRange: { fontSize: 14, color: Colors.textSecondary, fontFamily: "Inter_400Regular", marginTop: 4 },
  heroIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.weather + "22",
    borderWidth: 1,
    borderColor: Colors.weather + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  heroStats: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  heroStat: { flex: 1, alignItems: "center", gap: 4 },
  heroStatValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  heroStatLabel: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  heroStatDivider: { width: 1, height: 36, backgroundColor: Colors.surfaceBorder },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.success + "11",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  sourceText: { fontSize: 11, color: Colors.success, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  forecastList: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: "hidden",
  },
  forecastItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    gap: 12,
  },
  forecastItemFirst: { borderTopWidth: 0 },
  forecastDay: { width: 44, fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  forecastDesc: { flex: 1, fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  forecastRain: { flexDirection: "row", alignItems: "center", gap: 3 },
  forecastRainText: { fontSize: 12, color: Colors.info, fontFamily: "Inter_400Regular" },
  forecastTemp: { fontSize: 13, color: Colors.text, fontFamily: "Inter_500Medium" },
  alertCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: Colors.warning + "11",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.warning + "33",
    padding: 16,
    alignItems: "flex-start",
  },
  alertContent: { flex: 1, gap: 4 },
  alertTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.warning },
  alertDesc: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 20 },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  headerCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCardContent: { flex: 1, gap: 2 },
  headerCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  headerCardDesc: { fontSize: 12, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
});
