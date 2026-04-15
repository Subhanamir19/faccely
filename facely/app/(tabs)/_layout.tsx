// app/(tabs)/_layout.tsx
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Scan, CircleCheckBig, UserRound, TrendingUp, Wrench } from "lucide-react-native";

const ACTIVE_ICON   = "#FFFFFF";
const INACTIVE_ICON = "rgba(255,255,255,0.38)";
const BAR_BG        = "#161616";
const ACTIVE_BG     = "#2C2C2C";

// ---------------------------------------------------------------------------
// Custom floating tab bar
// ---------------------------------------------------------------------------

// Pill metrics — keep in sync with styles below
const PILL_HEIGHT    = 72; // tab 56 + paddingVertical 8×2
const PILL_MARGIN_H  = 20; // left/right inset
const PILL_GAP_BOTTOM = 10; // gap between pill bottom and safe area top

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 8);

  // This View participates in normal layout flow — React Navigation measures
  // its height and pushes ALL screen content up by exactly this amount.
  // The pill then floats absolutely inside this reserved space.
  const reservedHeight = PILL_HEIGHT + PILL_GAP_BOTTOM + safeBottom;

  const visibleRoutes = state.routes.filter(
    (route) => !!descriptors[route.key].options.tabBarIcon
  );

  return (
    <View style={{ height: reservedHeight, backgroundColor: "#0B0B0B" }}>
      {/* Absolutely positioned pill floats on top of the reserved space */}
      <View style={[styles.wrapper, { bottom: safeBottom + PILL_GAP_BOTTOM }]}>
        <View style={styles.pill}>
          {visibleRoutes.map((route) => {
            const { options } = descriptors[route.key];
            const isFocused = state.routes[state.index]?.key === route.key;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={[styles.tab, isFocused && styles.tabActive]}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.title}
              >
                {options.tabBarIcon?.({
                  color: isFocused ? ACTIVE_ICON : INACTIVE_ICON,
                  size: 24,
                  focused: isFocused,
                })}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: PILL_MARGIN_H,
    right: PILL_MARGIN_H,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BAR_BG,
    borderRadius: 44,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.50,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 18,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 32,
  },
  tabActive: {
    backgroundColor: ACTIVE_BG,
  },
});

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="program"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#0B0B0B", borderTopWidth: 0, elevation: 0 },
        sceneContainerStyle: { backgroundColor: "#0B0B0B" },
      }}
    >
      {/* Tab 1: daily */}
      <Tabs.Screen
        name="program"
        options={{
          title: "Daily",
          tabBarIcon: ({ color, size }) => <CircleCheckBig color={color} size={size ?? 24} />,
        }}
      />

      {/* Tab 2: scan */}
      <Tabs.Screen
        name="take-picture"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size }) => <Scan color={color} size={size ?? 24} />,
        }}
      />

      {/* hidden screens */}
      <Tabs.Screen name="ten-by-ten" options={{ href: null }} />

      {/* Tab 3: progress */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size ?? 24} />,
        }}
      />

      {/* Tab 4: profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size ?? 24} />,
        }}
      />

      {/* hidden */}
      <Tabs.Screen name="sigma" options={{ href: null }} />

      {/* Dev — visible in __DEV__ builds only */}
      <Tabs.Screen
        name="dev"
        options={{
          title: "Dev",
          href: __DEV__ ? undefined : null,
          tabBarIcon: __DEV__
            ? ({ color, size }) => <Wrench color={color} size={size ?? 24} />
            : undefined,
        }}
      />

      {/* Keep routes, hide from bar */}
      <Tabs.Screen name="history"    options={{ href: null }} />
      <Tabs.Screen name="protocols"  options={{ href: null }} />
      <Tabs.Screen name="_protocols" options={{ href: null }} />
      <Tabs.Screen name="routine"    options={{ href: null }} />
      <Tabs.Screen name="score"      options={{ href: null }} />
      <Tabs.Screen name="analysis"   options={{ href: null }} />
    </Tabs>
  );
}
