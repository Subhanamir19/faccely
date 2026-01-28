// components/onboarding/OptionsList.tsx
// Reusable radio option list for onboarding screens
import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  AccessibilityState,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  Easing,
  FadeInDown,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, RADII, SP, SHADOWS } from "@/lib/tokens";
import { hapticSelection } from "@/lib/haptics";

export type Option = {
  key: string;
  label: string;
  description?: string;
};

type OptionsListProps = {
  options: Option[];
  selected: string | null | undefined;
  onSelect: (key: string) => void;
  multiSelect?: boolean;
  selectedMulti?: string[];
  onSelectMulti?: (keys: string[]) => void;
  scrollEnabled?: boolean;
  maxHeight?: number;
  /** Whether to allow deselecting (for single select) */
  allowDeselect?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function OptionItem({
  item,
  isActive,
  onPress,
  index,
}: {
  item: Option;
  isActive: boolean;
  onPress: () => void;
  index: number;
}) {
  const scale = useSharedValue(1);
  const borderProgress = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
    borderProgress.value = withTiming(isActive ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [isActive, borderProgress]);

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: isActive ? COLORS.accent : COLORS.optionBorder,
    backgroundColor: isActive ? COLORS.optionBgActive : COLORS.optionBg,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: borderProgress.value * 0.16,
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300).easing(Easing.out(Easing.cubic))}
    >
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="radio"
        accessibilityState={{ selected: isActive } as AccessibilityState}
        style={[styles.option, animatedStyle]}
      >
        {/* Inner bevel effect */}
        <View style={styles.optionInner} pointerEvents="none" />

        {/* Radio dot (only when selected) */}
        {isActive && (
          <View style={styles.dotWrap}>
            <View style={styles.dotOuter}>
              <View style={styles.dotInner} />
            </View>
          </View>
        )}

        {/* Content */}
        <View style={styles.optionContent}>
          <T
            variant="captionSemiBold"
            color={isActive ? "optionTextActive" : "optionText"}
            numberOfLines={2}
          >
            {item.label}
          </T>
          {item.description && (
            <T variant="small" color="sub" style={styles.optionDescription}>
              {item.description}
            </T>
          )}
        </View>

        {/* Glow effect on iOS */}
        {Platform.OS === "ios" && (
          <Animated.View style={[styles.optionGlow, glowStyle]} pointerEvents="none" />
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function OptionsList({
  options,
  selected,
  onSelect,
  multiSelect = false,
  selectedMulti = [],
  onSelectMulti,
  scrollEnabled = false,
  maxHeight,
  allowDeselect = false,
}: OptionsListProps) {
  const handleSelect = (key: string) => {
    hapticSelection();

    if (multiSelect && onSelectMulti) {
      if (selectedMulti.includes(key)) {
        onSelectMulti(selectedMulti.filter((k) => k !== key));
      } else {
        onSelectMulti([...selectedMulti, key]);
      }
    } else {
      if (allowDeselect && selected === key) {
        onSelect("");
      } else {
        onSelect(key);
      }
    }
  };

  const isSelected = (key: string) => {
    if (multiSelect) {
      return selectedMulti.includes(key);
    }
    return selected === key;
  };

  const renderItems = () =>
    options.map((item, index) => (
      <React.Fragment key={item.key}>
        {index > 0 && <View style={styles.separator} />}
        <OptionItem
          item={item}
          isActive={isSelected(item.key)}
          onPress={() => handleSelect(item.key)}
          index={index}
        />
      </React.Fragment>
    ));

  // Use ScrollView only when scrollEnabled is true and maxHeight is set
  if (scrollEnabled && maxHeight) {
    return (
      <ScrollView
        style={{ maxHeight }}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {renderItems()}
      </ScrollView>
    );
  }

  // Default: plain View (no virtualization issues)
  return <View style={styles.listContainer}>{renderItems()}</View>;
}

const styles = StyleSheet.create({
  listContainer: {
    paddingTop: SP[2],
  },
  separator: {
    height: SP[3],
  },
  option: {
    position: "relative",
    width: "100%",
    minHeight: 56,
    borderRadius: RADII.lg,
    borderWidth: 1.5,
    justifyContent: "center",
    paddingLeft: 52,
    paddingRight: SP[5],
    paddingVertical: SP[3],
    overflow: "hidden",
  },
  optionInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.35)",
  },
  optionContent: {
    flex: 1,
  },
  optionDescription: {
    marginTop: SP[1],
  },
  optionGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADII.lg,
    ...SHADOWS.glowAccent,
  },
  dotWrap: {
    position: "absolute",
    left: SP[5],
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  dotOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
});

export { OptionsList };
