import React from "react";
import { View, StyleSheet } from "react-native";
import Text from "@/components/ui/T";
import PillNavButton from "@/components/ui/PillNavButton";
import { COLORS, SP } from "@/lib/tokens";

type Props = {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
  nextLabel?: string;
  helperText?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  padX?: number;
};

const DOT_SIZE = 6;
const DOT_ACTIVE_W = 24;

export default function MetricPagerFooter({
  index,
  total,
  onPrev,
  onNext,
  isFirst,
  isLast,
  nextLabel = "Next",
  helperText,
  nextDisabled,
  nextLoading,
  padX = 0,
}: Props) {
  return (
    <View style={[styles.footer, { paddingHorizontal: padX }]}>
      <View style={styles.pagerBlock}>
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      </View>

      <View style={styles.navRow}>
        <PillNavButton
          kind="ghost"
          label="Previous"
          icon="chevron-back"
          onPress={onPrev}
          disabled={isFirst}
        />
        <PillNavButton
          kind="solid"
          label={nextLabel}
          icon="chevron-forward"
          onPress={onNext}
          disabled={total === 0 || nextDisabled}
          loading={nextLoading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    width: "100%",
    alignItems: "center",
    gap: SP[3],
    paddingBottom: SP[3],
  },
  pagerBlock: {
    alignItems: "center",
    gap: SP[1],
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SP[2],
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  dotActive: {
    backgroundColor: COLORS.accent,
    width: DOT_ACTIVE_W,
  },
  helper: {
    color: COLORS.sub,
    fontSize: 12,
    opacity: 0.85,
    textAlign: "center",
  },
  navRow: {
    flexDirection: "row",
    gap: SP[3],
    width: "100%",
  },
});
