import React from "react";
import { View, StyleSheet } from "react-native";
import Text from "@/components/ui/T";
import PillNavButton from "@/components/ui/PillNavButton";
import { COLORS } from "@/lib/tokens";
import { sw, sh, ms } from "@/lib/responsive";

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

const DOT_SIZE = ms(5);
const DOT_ACTIVE_W = sw(22);
const DOT_GAP = sw(6);
const FOOTER_GAP = sh(8);
const NAV_GAP = sw(12);
const FOOTER_PAD_B = sh(8);

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
        <View style={[styles.dots, { gap: DOT_GAP }]}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
                i === index && [styles.dotActive, { width: DOT_ACTIVE_W }],
              ]}
            />
          ))}
        </View>
        {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      </View>

      <View style={[styles.navRow, { gap: NAV_GAP }]}>
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
    gap: FOOTER_GAP,
    paddingBottom: FOOTER_PAD_B,
  },
  pagerBlock: {
    alignItems: "center",
    gap: sh(2),
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
  },
  dot: {
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  dotActive: {
    backgroundColor: COLORS.accent,
  },
  helper: {
    color: COLORS.sub,
    fontSize: ms(11),
    opacity: 0.85,
    textAlign: "center",
  },
  navRow: {
    flexDirection: "row",
    width: "100%",
  },
});
