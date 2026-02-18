// app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Scan, CircleCheckBig, MessageCircle, UserRound } from "lucide-react-native";

const ACTIVE = "#FFFFFF";
const INACTIVE = "rgba(255,255,255,0.40)";
const BG = "#0B0B0B";
const BORDER = "rgba(255,255,255,0.06)";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="take-picture"
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
      {/* Tab 1: scan */}
      <Tabs.Screen
        name="take-picture"
        options={{
          title: "scan",
          tabBarIcon: ({ color, size }) => <Scan color={color} size={size ?? 22} />,
        }}
      />

      {/* Tab 2: daily */}
      <Tabs.Screen
        name="program"
        options={{
          title: "daily",
          tabBarIcon: ({ color, size }) => <CircleCheckBig color={color} size={size ?? 22} />,
        }}
      />

      {/* Tab 3: coach */}
      <Tabs.Screen
        name="sigma"
        options={{
          title: "coach",
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size ?? 22} />,
        }}
      />

      {/* Tab 4: profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "profile",
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size ?? 22} />,
        }}
      />

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
