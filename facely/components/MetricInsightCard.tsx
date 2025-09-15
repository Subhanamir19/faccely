import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Pressable,
  Animated,
} from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

type Props = {
  title: string;
  line1: string;
  line2?: string;
  score: number; // 0-100
  overlayUri?: string | null; // your annotated image goes here (right column)
};

const C = {
  card: "#FFFFFF",
  ink: "#0E1111",
  inkDim: "rgba(14,17,17,0.65)",
  divider: "rgba(14,17,17,0.12)",
  ringBg: "#E9ECEF",
  ringFg: "#1FC47A", // green from your reference badge
};

/** Gumroad-ish heavy card with press-in effect + stacked image + gauge */
export default function MetricInsightCard({
  title,
  line1,
  line2,
  score,
  overlayUri,
}: Props) {
  const clamped = useMemo(() => Math.max(0, Math.min(100, Math.round(score))), [score]);

  // press-in “button” feel (shadow off + card sinks)
  const [pressed, setPressed] = useState(false);
  const translate = useMemo(() => new Animated.Value(0), []);
  const onIn = () => {
    setPressed(true);
    Animated.spring(translate, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 0 }).start();
  };
  const onOut = () => {
    Animated.spring(translate, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 0 }).start(() =>
      setPressed(false)
    );
  };

  // 0 -> at rest, 1 -> pressed (down-right ~8px)
  const tx = translate.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });
  const ty = translate.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });

  return (
    <View style={styles.wrapper}>
      {/* black “slug” behind to mimic chunky gumroad drop shadow */}
      {!pressed && <View style={styles.shadowShim} />}

      <Pressable onPressIn={onIn} onPressOut={onOut} android_ripple={{ color: "#00000010", borderless: false }}>
        <Animated.View style={[styles.card, { transform: [{ translateX: tx }, { translateY: ty }] }]}>
          {/* Title row */}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          <View style={styles.bodyRow}>
            {/* Left: two lines with dividers */}
            <View style={styles.leftCol}>
              <View>
                <View style={styles.divider} />
                <Text style={styles.bulletText}>{line1}</Text>
              </View>

              {!!line2 && (
                <View style={{ marginTop: 12 }}>
                  <View style={styles.divider} />
                  <Text style={styles.bulletText}>{line2}</Text>
                </View>
              )}
            </View>

            {/* Right: image (slightly higher) + gauge below */}
            <View style={styles.rightCol}>
              <View style={styles.overlayFrame}>
                {overlayUri ? (
                  <Image source={{ uri: overlayUri }} style={styles.overlayImg} resizeMode="cover" />
                ) : (
                  <View style={styles.overlayPlaceholder}>
                    <Text style={styles.overlayPhText}>image</Text>
                  </View>
                )}
              </View>

              <View style={styles.gaugeWrap}>
                <CircularGauge value={clamped} />
              </View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** Circular percentage ring with center number (SVG, crisp & fast) */
function CircularGauge({ value }: { value: number }) {
  const size = 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;

  return (
    <Svg width={size} height={size}>
      {/* bg ring */}
      <Circle cx={cx} cy={cy} r={r} stroke={C.ringBg} strokeWidth={stroke} fill="none" />
      {/* fg ring */}
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={C.ringFg}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash}, ${circ - dash}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <SvgText
        x={cx}
        y={cy + 6}
        fontSize="22"
        fontWeight="700"
        fill={C.ink}
        textAnchor="middle"
      >
        {value}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginTop: 14,
  },

  // behind-card black slab to mimic the reference “3D lifted” look
  shadowShim: {
    position: "absolute",
    left: 8,
    top: 8,
    right: -8,
    bottom: -8,
    backgroundColor: "#0A0A0A",
    borderRadius: 22,
  },

  card: {
    backgroundColor: C.card,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.ink,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 8 },
    }),
  },

  title: {
    color: C.ink,
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 10,
  },

  bodyRow: {
    flexDirection: "row",
    gap: 12,
  },

  leftCol: {
    flex: 1,
    paddingRight: 4,
  },

  divider: {
    height: 3,
    width: 180,
    backgroundColor: C.ink,
    borderRadius: 3,
    marginBottom: 8,
  },

  bulletText: {
    color: C.inkDim,
    fontSize: 15.5,
    lineHeight: 22,
    fontWeight: "600",
  },

  rightCol: {
    width: 140,
    alignItems: "center",
  },

  overlayFrame: {
    width: 120,
    height: 120,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: C.ink,
    overflow: "hidden",
    // nudge image slightly higher like your blue mark
    marginTop: -6,
    backgroundColor: "#F3F4F6",
  },
  overlayImg: { width: "100%", height: "100%" },
  overlayPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlayPhText: { color: C.inkDim, fontSize: 12 },

  gaugeWrap: {
    marginTop: 10, // sits *below* the image (no overlap)
    alignItems: "center",
    justifyContent: "center",
  },
});
