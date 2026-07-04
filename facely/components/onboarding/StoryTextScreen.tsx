import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import OrangeOnboardingLayout, {
  OrangePrimaryButton,
  ORANGE_ONBOARDING,
} from "@/components/onboarding/OrangeOnboardingLayout";
import { hapticSelection } from "@/lib/haptics";
import { SP } from "@/lib/tokens";
import { ms, sh } from "@/lib/responsive";

const FONT = ORANGE_ONBOARDING.fontBold;
const CHAR_INTERVAL_MS = 26;
const LINE_PAUSE_MS = 180;
const CTA_REVEAL_MS = 220;
const HAPTIC_EVERY_CHARS = 3;

type StoryTextScreenProps = {
  lines: string[];
  accentLineIndex?: number;
  ctaLabel?: string;
  onNext: () => void;
  accessibilityLabel?: string;
};

export default function StoryTextScreen({
  lines,
  accentLineIndex = lines.length - 1,
  ctaLabel = "Continue",
  onNext,
  accessibilityLabel,
}: StoryTextScreenProps) {
  const [activeLine, setActiveLine] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [done, setDone] = useState(lines.length === 0);
  const currentLine = lines[activeLine] ?? "";

  useEffect(() => {
    setActiveLine(0);
    setCharCount(0);
    setDone(lines.length === 0);
  }, [lines]);

  useEffect(() => {
    if (done || !currentLine) return;

    if (charCount < currentLine.length) {
      const timer = setTimeout(() => {
        const nextCount = charCount + 1;
        const nextChar = currentLine[charCount];
        if (nextChar?.trim() && nextCount % HAPTIC_EVERY_CHARS === 0) {
          hapticSelection();
        }
        setCharCount(nextCount);
      }, CHAR_INTERVAL_MS);
      return () => clearTimeout(timer);
    }

    if (activeLine < lines.length - 1) {
      const timer = setTimeout(() => {
        setActiveLine((line) => line + 1);
        setCharCount(0);
      }, LINE_PAUSE_MS);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => setDone(true), CTA_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [activeLine, charCount, currentLine, done, lines.length]);

  const visibleLines = useMemo(
    () =>
      lines.map((line, index) => {
        if (index < activeLine) return line;
        if (index === activeLine) return line.slice(0, charCount);
        return "";
      }),
    [activeLine, charCount, lines]
  );

  return (
    <OrangeOnboardingLayout
      showHeader={false}
      showBack={false}
      scrollable={false}
      footer={
        done ? (
          <Animated.View entering={FadeInDown.duration(240)}>
            <OrangePrimaryButton label={ctaLabel} onPress={onNext} tone="ink" uppercase={false} />
          </Animated.View>
        ) : undefined
      }
      sheetContentStyle={styles.content}
    >
      <View
        accessibilityLabel={accessibilityLabel}
        style={styles.copyWrap}
      >
        <View style={styles.lineStack}>
          {visibleLines.map((line, index) => (
            <T
              key={`${index}-${lines[index]}`}
              style={index === accentLineIndex ? styles.lineAccent : styles.line}
            >
              {line}
              {index === activeLine && !done ? <T style={styles.cursor}>|</T> : null}
            </T>
          ))}
        </View>
      </View>
    </OrangeOnboardingLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  copyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[1],
    paddingVertical: SP[7],
  },
  lineStack: {
    width: "100%",
    gap: sh(8),
  },
  line: {
    fontFamily: FONT,
    fontSize: ms(29, 0.18),
    lineHeight: ms(35, 0.18),
    color: ORANGE_ONBOARDING.text,
    letterSpacing: 0,
    textAlign: "center",
  },
  lineAccent: {
    fontFamily: FONT,
    fontSize: ms(29, 0.18),
    lineHeight: ms(35, 0.18),
    color: ORANGE_ONBOARDING.orangeDark,
    letterSpacing: 0,
    textAlign: "center",
  },
  cursor: {
    color: ORANGE_ONBOARDING.orange,
  },
});
