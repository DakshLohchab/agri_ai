import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { getTranslations } from "@/constants/translations";
import { useLanguage } from "@/context/LanguageContext";

function NativeTabLayout() {
  const { language } = useLanguage();
  const t = getTranslations(language.code);

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>{t.tabHome}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <Icon sf={{ default: "message", selected: "message.fill" }} />
        <Label>{t.tabAskAI}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="weather">
        <Icon sf={{ default: "cloud.sun", selected: "cloud.sun.fill" }} />
        <Label>{t.tabWeather}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="market">
        <Icon sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }} />
        <Label>{t.tabMarket}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="agents">
        <Icon sf={{ default: "cpu", selected: "cpu.fill" }} />
        <Label>{t.tabAgents}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const { language } = useLanguage();
  const t = getTranslations(language.code);
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { width } = useWindowDimensions();
  const isDesktopWeb = isWeb && width >= 1024;
  const mobileRailWidth = Math.min(width - 20, 560);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primaryLight,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        tabBarStyle: {
          position: isDesktopWeb ? "relative" : "absolute",
          backgroundColor: isIOS ? "transparent" : Colors.tabBar,
          borderTopWidth: isDesktopWeb ? 0 : isWeb ? 1 : 0,
          borderRightWidth: isDesktopWeb ? 1 : 0,
          borderTopColor: Colors.tabBarBorder,
          borderRightColor: Colors.tabBarBorder,
          elevation: 0,
          ...(isDesktopWeb
            ? {
                width: 308,
                height: "100%",
                paddingTop: 28,
                paddingHorizontal: 16,
                paddingBottom: 28,
                marginVertical: 16,
                marginLeft: 16,
                borderRadius: 32,
                overflow: "hidden",
              }
            : {
                height: 82,
                width: mobileRailWidth,
                left: "50%",
                marginLeft: -mobileRailWidth / 2,
                bottom: isWeb ? 20 : 14,
                borderRadius: 28,
                paddingHorizontal: 12,
                paddingTop: 10,
                paddingBottom: 10,
                borderTopWidth: 1,
                shadowColor: Colors.black,
                shadowOpacity: 0.36,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 14 },
              }),
        },
        tabBarItemStyle: isDesktopWeb
          ? {
              minHeight: 66,
              marginBottom: 10,
              borderRadius: 22,
            }
          : {
              borderRadius: 20,
              marginHorizontal: 3,
              paddingTop: 2,
            },
        tabBarLabelStyle: isDesktopWeb
          ? {
              fontSize: 14,
              fontFamily: "Inter_600SemiBold",
              marginLeft: 2,
            }
          : {
              fontSize: 11,
              fontFamily: "Inter_500Medium",
            },
        tabBarIconStyle: isDesktopWeb ? { marginBottom: 0 } : undefined,
        tabBarLabelPosition: isDesktopWeb ? "beside-icon" : "below-icon",
        tabBarShowLabel: true,
        tabBarPosition: isDesktopWeb ? "left" : "bottom",
        tabBarActiveBackgroundColor: isDesktopWeb ? Colors.primary + "20" : Colors.primary + "1C",
        sceneStyle: {
          backgroundColor: Colors.background,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <LinearGradient
              colors={
                isDesktopWeb
                  ? [Colors.tabBar + "FA", "#122017", "#0C140F"]
                  : [Colors.tabBar + "FA", "#132117", "#0F1712"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: isDesktopWeb ? 32 : 28,
                  borderRightWidth: isDesktopWeb ? 1 : 0,
                  borderRightColor: Colors.tabBarBorder,
                  borderWidth: isDesktopWeb ? 1 : 1,
                  borderColor: Colors.tabBarBorder,
                },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabHome,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t.tabAskAI,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="message" tintColor={color} size={24} />
            ) : (
              <Feather name="message-circle" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="weather"
        options={{
          title: t.tabWeather,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="cloud.sun" tintColor={color} size={24} />
            ) : (
              <Feather name="cloud" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: t.tabMarket,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.line.uptrend.xyaxis" tintColor={color} size={24} />
            ) : (
              <Feather name="trending-up" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="agents"
        options={{
          title: t.tabAgents,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="cpu" tintColor={color} size={24} />
            ) : (
              <Feather name="cpu" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
