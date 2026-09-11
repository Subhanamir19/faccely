// app/(tabs)/_layout.tsx
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps, BottomTabNavigationOptions } from "expo-router/js-tabs";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Scan, CircleCheckBig, UserRound, TrendingUp, MessageCircle } from "lucide-react-native";
import { APP_SCREEN_BG } from "@/components/layout/AppGradientBackground";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";

const LIGHT_TAB_THEME = {
  tint: "systemChromeMaterialLight" as const,
  blurIntensity: 78,
  shell: "rgba(255,250,241,0.38)",
  border: "rgba(255,255,255,0.76)",
  innerBorder: "rgba(255,255,255,0.32)",
  activeBg: "rgba(255,255,255,0.82)",
  activeBorder: "rgba(255,255,255,0.96)",
  activeIcon: "#151310",
  inactiveIcon: "rgba(21,19,16,0.50)",
  shadow: "#6B3919",
  activeShadow: "#6B3919",
  sheenColors: ["rgba(255,255,255,0.44)", "rgba(255,255,255,0.10)", "rgba(255,255,255,0)"] as const,
  fadeColors: ["rgba(254,245,228,0)", "rgba(254,245,228,0.20)", "rgba(254,245,228,0.52)"] as const,
};

const DARK_TAB_THEME = {
  tint: "systemChromeMaterialDark" as const,
  blurIntensity: 72,
  shell: "rgba(18,18,18,0.40)",
  border: "rgba(255,255,255,0.18)",
  innerBorder: "rgba(255,255,255,0.08)",
  activeBg: "rgba(255,255,255,0.22)",
  activeBorder: "rgba(255,255,255,0.32)",
  activeIcon: "#FAF8F4",
  inactiveIcon: "rgba(250,248,244,0.52)",
  shadow: "#000000",
  activeShadow: "#000000",
  sheenColors: ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0)"] as const,
  fadeColors: ["rgba(0,0,0,0)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.46)"] as const,
};

const DARK_SURFACE_ROUTES = new Set(["dev"]);

const PILL_HEIGHT = FLOATING_TAB_BAR.pillHeight;
const PILL_MARGIN_H = FLOATING_TAB_BAR.marginHorizontal;
const PILL_GAP_BOTTOM = FLOATING_TAB_BAR.gapBottom;
const TAB_MOVE_DURATION = 220;
const TAB_FADE_DURATION = 160;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

type TabIconRenderer = NonNullable<BottomTabNavigationOptions["tabBarIcon"]>;

function TabIconTransition({
  focused,
  icon,
  activeColor,
  inactiveColor,
  reduceMotion,
}: {
  focused: boolean;
  icon: TabIconRenderer;
  activeColor: string;
  inactiveColor: string;
  reduceMotion: boolean;
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    progress.set(
      withTiming(focused ? 1 : 0, {
        duration: reduceMotion ? 80 : TAB_FADE_DURATION,
        easing: EASE_OUT,
      }),
    );
  }, [focused, progress, reduceMotion]);

  const activeStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [
      {
        scale: reduceMotion ? 1 : interpolate(progress.get(), [0, 1], [0.92, 1]),
      },
    ],
  }));
  const inactiveStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
  }));

  return (
    <View style={styles.iconStack}>
      <Animated.View style={[styles.iconLayer, inactiveStyle]}>
        {icon({ color: inactiveColor, size: 24, focused: false })}
      </Animated.View>
      <Animated.View style={[styles.iconLayer, activeStyle]}>
        {icon({ color: activeColor, size: 24, focused: true })}
      </Animated.View>
    </View>
  );
}

function getTabTheme(routeName?: string) {
  return routeName && DARK_SURFACE_ROUTES.has(routeName) ? DARK_TAB_THEME : LIGHT_TAB_THEME;
}

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const safeBottom = Math.max(insets.bottom, 8);
  const activeRoute = state.routes[state.index];
  const theme = getTabTheme(activeRoute?.name);
  const visibleRoutes = state.routes.filter((route) => {
    const options = descriptors[route.key].options;
    return !!options.tabBarIcon;
  });
  const [tabLayouts, setTabLayouts] = React.useState<
    Record<string, { x: number; width: number }>
  >({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);
  const indicatorPositioned = React.useRef(false);

  React.useEffect(() => {
    const preloadSchedule = [
      { name: "program", delay: 3600 },
      { name: "profile", delay: 5200 },
      { name: "dashboard", delay: 8000 },
    ];
    const timers = preloadSchedule.map(({ name, delay }) =>
      setTimeout(() => navigation.preload(name), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [navigation]);

  React.useEffect(() => {
    const layout = activeRoute ? tabLayouts[activeRoute.key] : undefined;
    if (!layout) return;

    if (!indicatorPositioned.current || reduceMotion) {
      indicatorX.set(layout.x);
      indicatorWidth.set(layout.width);
      indicatorOpacity.set(withTiming(1, { duration: 80, easing: EASE_OUT }));
      indicatorPositioned.current = true;
      return;
    }

    indicatorX.set(
      withTiming(layout.x, { duration: TAB_MOVE_DURATION, easing: EASE_IN_OUT }),
    );
    indicatorWidth.set(
      withTiming(layout.width, { duration: TAB_MOVE_DURATION, easing: EASE_IN_OUT }),
    );
    indicatorOpacity.set(withTiming(1, { duration: TAB_FADE_DURATION, easing: EASE_OUT }));
  }, [activeRoute, indicatorOpacity, indicatorWidth, indicatorX, reduceMotion, tabLayouts]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.get(),
    width: indicatorWidth.get(),
    transform: [{ translateX: indicatorX.get() }],
  }));

  // No screen hides this bar: navigation stays reachable on every tab.
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
          <BlurView
            intensity={theme.blurIntensity}
            tint={theme.tint}
            blurMethod="dimezisBlurView"
            blurReductionFactor={3}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={theme.sheenColors}
            locations={[0, 0.34, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.glassSheen}
          />
          <View pointerEvents="none" style={[styles.innerRim, { borderColor: theme.innerBorder }]} />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeIndicator,
              {
                backgroundColor: theme.activeBg,
                borderColor: theme.activeBorder,
                shadowColor: theme.activeShadow,
              },
              indicatorStyle,
            ]}
          />

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
                Haptics.selectionAsync();
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  setTabLayouts((current) => {
                    const previous = current[route.key];
                    if (previous?.x === x && previous.width === width) return current;
                    return { ...current, [route.key]: { x, width } };
                  });
                }}
                style={({ pressed }) => [
                  styles.tab,
                  pressed && styles.tabPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.title}
                hitSlop={4}
                pressRetentionOffset={16}
              >
                {options.tabBarIcon ? (
                  <TabIconTransition
                    focused={isFocused}
                    icon={options.tabBarIcon}
                    activeColor={theme.activeIcon}
                    inactiveColor={theme.inactiveIcon}
                    reduceMotion={reduceMotion}
                  />
                ) : null}
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
    ...StyleSheet.absoluteFill,
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
    paddingVertical: 7,
    paddingHorizontal: 7,
    gap: 3,
    overflow: "hidden",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  glassSheen: {
    ...StyleSheet.absoluteFill,
  },
  innerRim: {
    ...StyleSheet.absoluteFill,
    borderRadius: 43,
    borderWidth: StyleSheet.hairlineWidth,
  },
  activeIndicator: {
    position: "absolute",
    top: 7,
    height: 58,
    borderRadius: 30,
    borderWidth: 1,
    shadowOpacity: 0.13,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 58,
    borderRadius: 30,
    zIndex: 1,
  },
  tabPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.94 }],
  },
  iconStack: {
    width: 28,
    height: 28,
  },
  iconLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="take-picture"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: "none",
        lazy: true,
        freezeOnBlur: true,
        tabBarStyle: { position: "absolute", backgroundColor: "transparent", borderTopWidth: 0, elevation: 0 },
        sceneStyle: { backgroundColor: APP_SCREEN_BG },
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

      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size ?? 24} />,
        }}
      />

      <Tabs.Screen
        name="coach"
        options={{
          title: "Coach",
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size ?? 24} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size ?? 24} />,
        }}
      />

      {/* Dev tools: hidden everywhere for now, debug builds included.
          `href: null` blocks deep links to it and dropping tabBarIcon keeps it
          out of the tab bar. To bring it back in development, restore
          `href: __DEV__ ? undefined : null` and the matching tabBarIcon. */}
      <Tabs.Screen
        name="dev"
        options={{
          title: "Dev",
          href: null,
        }}
      />

    </Tabs>
  );
}
