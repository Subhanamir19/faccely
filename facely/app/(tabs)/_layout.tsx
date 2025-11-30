// app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Camera, ListChecks, MessageSquare, User } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/lib/tokens";

const ACTIVE = COLORS.accent;
const INACTIVE = "rgba(255,255,255,0.55)";
const BG = "#0B0B0B";
const BORDER = "rgba(255,255,255,0.08)";

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
      {/* Visible tab #1: Analysis → starts at take-picture */}
      <Tabs.Screen
        name="take-picture"
        options={{
          title: "Analysis",
          tabBarIcon: ({ color, size }) => <Camera color={color} size={size ?? 22} />,
        }}
      />

      {/* Visible tab #2: Routine */}
      <Tabs.Screen
        name="routine"
        options={{
          title: "Routine",
          tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size ?? 22} />,
        }}
      />

      {/* Visible tab #3: Sigma (chatbot) */}
      <Tabs.Screen
        name="sigma"
        options={{
          title: "Sigma",
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size ?? 22} />,
        }}
      />

      {/* Visible tab #4: Protocols */}
      <Tabs.Screen
        name="protocols"
        options={{
          title: "Protocols",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size ?? 22} color={color} />
          ),
        }}
      />

      {/* Keep routes but hide them from the tab bar */}
      <Tabs.Screen name="score" options={{ href: null }} />
      <Tabs.Screen name="analysis" options={{ href: null }} />

      {/* Visible tab: Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size ?? 22} />,
        }}
      />
    </Tabs>
  );
}
