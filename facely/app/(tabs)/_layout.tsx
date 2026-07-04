// app/(tabs)/_layout.tsx
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Scan, CircleCheckBig, UserRound, TrendingUp, Wrench } from "lucide-react-native";
import { APP_SCREEN_BG } from "@/components/layout/AppGradientBackground";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";

const LIGHT_TAB_THEME = {
  tint: "light" as const,
  blurIntensity: 42,
  shell: "rgba(255,248,236,0.82)",
  border: "rgba(255,255,255,0.72)",
  activeBg: "#0B0B0B",
  activeIcon: APP_SCREEN_BG,
  inactiveIcon: "rgba(11,11,11,0.46)",
  shadow: "#7A3A10",
  fadeColors: ["rgba(254,245,228,0)", "rgba(254,245,228,0.20)", "rgba(254,245,228,0.52)"] as const,
};

const DARK_TAB_THEME = {
  tint: "dark" as const,
  blurIntensity: 36,
  shell: "rgba(18,18,18,0.78)",
  border: "rgba(255,255,255,0.10)",
  activeBg: APP_SCREEN_BG,
  activeIcon: "#0B0B0B",
  inactiveIcon: "rgba(255,255,255,0.56)",
  shadow: "#000000",
  fadeColors: ["rgba(0,0,0,0)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.46)"] as const,
};

const DARK_SURFACE_ROUTES = new Set(["dev"]);

const PILL_HEIGHT = FLOATING_TAB_BAR.pillHeight;
const PILL_MARGIN_H = FLOATING_TAB_BAR.marginHorizontal;
const PILL_GAP_BOTTOM = FLOATING_TAB_BAR.gapBottom;

function getTabTheme(routeName?: string) {
  return routeName && DARK_SURFACE_ROUTES.has(routeName) ? DARK_TAB_THEME : LIGHT_TAB_THEME;
}

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 8);
  const activeRoute = state.routes[state.index];
  const activeParams = activeRoute?.params as
    | { onboardingFlow?: string }
    | undefined;

  if (activeParams?.onboardingFlow === "1") {
    return null;
  }

  const theme = getTabTheme(activeRoute?.name);
  const visibleRoutes = state.routes.filter(
    (route) => !!descriptors[route.key].options.tabBarIcon,
  );

  const floatingHeight = FLOATING_TAB_BAR.backdropFadeHeight + safeBottom;

  return (
    <View pointerEvents="box-none" style={[styles.floatingRoot, { height: floatingHeight }]}>
      <LinearGradient
        pointerEvents="none"
        colors={theme.fadeColors}
        locations={[0, 0.48, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backdropFade}
      />

      <View
        pointerEvents="box-none"
        style={[
          styles.wrapper,
          {
            bottom: safeBottom + PILL_GAP_BOTTOM,
            left: PILL_MARGIN_H,
            right: PILL_MARGIN_H,
          },
        ]}
      >
        <View
          style={[
            styles.pill,
            {
              backgroundColor: theme.shell,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <BlurView intensity={theme.blurIntensity} tint={theme.tint} style={StyleSheet.absoluteFill} />
          <View style={styles.pillTint} />

          {visibleRoutes.map((route) => {
            const { options } = descriptors[route.key];
            const isFocused = activeRoute?.key === route.key;

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
                style={({ pressed }) => [
                  styles.tab,
                  isFocused && { backgroundColor: theme.activeBg },
                  pressed && styles.tabPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.title}
                hitSlop={4}
              >
                {options.tabBarIcon?.({
                  color: isFocused ? theme.activeIcon : theme.inactiveIcon,
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
  floatingRoot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  backdropFade: {
    ...StyleSheet.absoluteFillObject,
  },
  wrapper: {
    position: "absolute",
  },
  pill: {
    height: PILL_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 44,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
    overflow: "hidden",
    shadowOpacity: 0.16,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  pillTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 32,
  },
  tabPressed: {
    opacity: 0.76,
  },
});

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="take-picture"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: "absolute", backgroundColor: "transparent", borderTopWidth: 0, elevation: 0 },
        // @ts-expect-error sceneContainerStyle exists at runtime; types lag.
        sceneContainerStyle: { backgroundColor: APP_SCREEN_BG },
      }}
    >
      <Tabs.Screen
        name="take-picture"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size }) => <Scan color={color} size={size ?? 24} />,
        }}
      />

      <Tabs.Screen
        name="program"
        options={{
          title: "Daily",
          tabBarIcon: ({ color, size }) => <CircleCheckBig color={color} size={size ?? 24} />,
        }}
      />

      <Tabs.Screen name="ten-by-ten" options={{ href: null }} />
      <Tabs.Screen name="new-exercises-preview" options={{ href: null }} />

      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size ?? 24} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size ?? 24} />,
        }}
      />

      <Tabs.Screen
        name="dev"
        options={{
          title: "Dev",
          tabBarIcon: ({ color, size }) => <Wrench color={color} size={size ?? 24} />,
          tabBarButton: () => null,
        }}
      />

      <Tabs.Screen name="sigma" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="protocols" options={{ href: null }} />
      <Tabs.Screen name="_protocols" options={{ href: null }} />
      <Tabs.Screen name="routine" options={{ href: null }} />
      <Tabs.Screen name="score" options={{ href: null }} />
      <Tabs.Screen name="next-focus" options={{ href: null }} />
      <Tabs.Screen name="analysis" options={{ href: null }} />
    </Tabs>
  );
}
