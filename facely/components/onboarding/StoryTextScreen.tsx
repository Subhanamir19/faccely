import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";

const FONT = "ProximaNova-Bold";
const CHAR_INTERVAL_MS = 26;
const LINE_PAUSE_MS = 180;
const CTA_REVEAL_MS = 220;

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
  ctaLabel = "NEXT",
  onNext,
  accessibilityLabel,
}: StoryTextScreenProps) {
  const insets = useSafeAreaInsets();
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
      const timer = setTimeout(() => setCharCount((count) => count + 1), CHAR_INTERVAL_MS);
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
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + SP[6],
            paddingBottom: insets.bottom + SP[6],
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={styles.copyWrap}>
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

        {done ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.footer}>
            <Pressable
              onPress={onNext}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel ?? ctaLabel}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            >
              <T style={styles.ctaText}>{ctaLabel.toUpperCase()}</T>
              <ChevronRight size={ms(16)} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SP[5],
  },
  copyWrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SP[8],
  },
  lineStack: {
    width: "100%",
    gap: sh(8),
  },
  line: {
    fontFamily: FONT,
    fontSize: ms(31, 0.22),
    lineHeight: ms(37, 0.22),
    color: COLORS.lightText,
    letterSpacing: 0,
    textAlign: "center",
  },
  lineAccent: {
    fontFamily: FONT,
    fontSize: ms(31, 0.22),
    lineHeight: ms(37, 0.22),
    color: COLORS.accentDepth,
    letterSpacing: 0,
    textAlign: "center",
  },
  cursor: {
    color: COLORS.accentDepth,
  },
  footer: {
    paddingTop: SP[4],
  },
  cta: {
    minHeight: sh(56),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: sw(6),
    paddingHorizontal: SP[5],
  },
  ctaText: {
    fontFamily: FONT,
    fontSize: ms(14, 0.3),
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
});
