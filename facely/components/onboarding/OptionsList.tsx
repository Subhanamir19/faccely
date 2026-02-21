// components/onboarding/OptionsList.tsx
import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  AccessibilityState,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
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
  allowDeselect?: boolean;
};

// Identical constants to GlassBtn
const R = RADII.lg;
const DEPTH = 5;
const ACTIVE_BASE  = "#2D4A09";
const INACTIVE_BASE = "#0A0A0A";

function OptionItem({
  item,
  isActive,
  onPress,
  index,
  multiSelect = false,
}: {
  item: Option;
  isActive: boolean;
  onPress: () => void;
  index: number;
  multiSelect?: boolean;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)
        .duration(300)
        .easing(Easing.out(Easing.cubic))}
    >
      {/*
        Structure is identical to GlassBtn:
          outer View  → base colour + paddingBottom pocket
          Pressable   → touch handler, render-prop gives `pressed`
          inner View  → plain static styles, translateY on pressed
        No Reanimated on the face → RN's own borderRadius clipping works correctly
      */}
      <View
        style={[
          styles.base,
          { backgroundColor: isActive ? ACTIVE_BASE : INACTIVE_BASE },
        ]}
      >
        <Pressable
          onPress={onPress}
          accessibilityRole={multiSelect ? "checkbox" : "radio"}
          accessibilityState={{ selected: isActive } as AccessibilityState}
        >
          {({ pressed }) => (
            <View
              style={[
                styles.face,
                isActive ? styles.faceActive : styles.faceInactive,
                { transform: [{ translateY: pressed ? DEPTH - 1 : 0 }] },
              ]}
            >
              {/* Indicator — always rendered so left padding is justified */}
              <View style={styles.dotWrap}>
                <View style={[styles.dotOuter, !isActive && styles.dotOuterInactive]}>
                  {isActive && <View style={styles.dotInner} />}
                </View>
              </View>

              {/* Text */}
              <View style={styles.content}>
                <T
                  variant="captionSemiBold"
                  color={isActive ? "optionTextActive" : "optionText"}
                  numberOfLines={2}
                >
                  {item.label}
                </T>
                {item.description && (
                  <T variant="small" color="sub" style={styles.description}>
                    {item.description}
                  </T>
                )}
              </View>
            </View>
          )}
        </Pressable>
      </View>
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

  const isSelected = (key: string) =>
    multiSelect ? selectedMulti.includes(key) : selected === key;

  const renderItems = () =>
    options.map((item, index) => (
      <React.Fragment key={item.key}>
        {index > 0 && <View style={styles.separator} />}
        <OptionItem
          item={item}
          isActive={isSelected(item.key)}
          onPress={() => handleSelect(item.key)}
          index={index}
          multiSelect={multiSelect}
        />
      </React.Fragment>
    ));

  if (scrollEnabled && maxHeight) {
    return (
      <ScrollView
        style={{ maxHeight }}
        contentContainerStyle={styles.listScrollable}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {renderItems()}
      </ScrollView>
    );
  }

  return <View style={styles.list}>{renderItems()}</View>;
}

const styles = StyleSheet.create({
  list: { paddingTop: SP[2] },
  listScrollable: { paddingTop: SP[2], paddingBottom: DEPTH },

  separator: { height: SP[3] },

  // 3D base — same role as the outer View in GlassBtn
  base: {
    borderRadius: R,
    paddingBottom: DEPTH,
  },

  // Button face — plain View, no Reanimated on colours.
  // overflow:"hidden" is required on Android: without it a View's borderColor
  // does NOT clip to borderRadius, causing the border to bleed past the corners
  // as a hard rectangle. Static colours (not Reanimated) are safe with this.
  face: {
    width: "100%",
    minHeight: 56,
    borderRadius: R,
    borderWidth: 1.5,
    justifyContent: "center",
    paddingLeft: 52,
    paddingRight: SP[5],
    paddingVertical: SP[3],
    overflow: "hidden",
  },
  faceActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.optionBgActive,
  },
  faceInactive: {
    borderColor: COLORS.optionBorder,
    backgroundColor: COLORS.optionBg,
  },

  content: { flex: 1 },
  description: { marginTop: SP[1] },

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
  dotOuterInactive: {
    borderColor: COLORS.optionBorder,
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
});

export { OptionsList };
