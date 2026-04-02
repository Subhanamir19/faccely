// app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Scan, CircleCheckBig, UserRound, TrendingUp } from "lucide-react-native";

const ACTIVE = "#FFFFFF";
const INACTIVE = "rgba(255,255,255,0.40)";
const BG = "#0B0B0B";
const BORDER = "rgba(255,255,255,0.06)";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="program"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: BG,
          borderTopColor: BORDER,
          height: 64,
          paddingTop: 8,
          paddingBottom: Platform.select({ ios: 10, android: 8 }),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: Platform.select({
            ios: "Poppins-SemiBold",
            android: "Poppins-SemiBold",
            default: "Poppins-SemiBold",
          }),
        },
      }}
    >
      {/* Tab 1: daily — primary daily action */}
      <Tabs.Screen
        name="program"
        options={{
          title: "Daily",
          tabBarIcon: ({ color, size }) => <CircleCheckBig color={color} size={size ?? 22} />,
        }}
      />

      {/* Tab 2: scan — periodic, not daily */}
      <Tabs.Screen
        name="take-picture"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size }) => <Scan color={color} size={size ?? 22} />,
        }}
      />

      {/* 10/10 — accessible as a screen but not shown in the tab bar */}
      <Tabs.Screen name="ten-by-ten" options={{ href: null }} />

      {/* Tab 3: progress dashboard */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size ?? 22} />,
        }}
      />

      {/* Tab 4: profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size ?? 22} />,
        }}
      />

      {/* coach — hidden from tab bar */}
      <Tabs.Screen name="sigma" options={{ href: null }} />

      {/* dev — hidden from tab bar in all builds */}
      <Tabs.Screen name="dev" options={{ href: null }} />

      {/* Keep routes but hide them from the tab bar */}
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="protocols" options={{ href: null }} />
      <Tabs.Screen name="_protocols" options={{ href: null }} />
      <Tabs.Screen name="routine" options={{ href: null }} />
      <Tabs.Screen name="score" options={{ href: null }} />
      <Tabs.Screen name="analysis" options={{ href: null }} />
    </Tabs>
  );
}
