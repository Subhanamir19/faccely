import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Check, Info, X } from "lucide-react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import {
  getDietProtocolImage,
  getDietProtocolPrimaryTarget,
  getDietProtocolTargetText,
  getDietProtocolWhyText,
} from "@/lib/dietProtocolCatalog";
import { COLORS, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import type { ProtocolTask } from "@/store/tasks";

const FONT_DIN = "DINNextRounded-Regular";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ProtocolCheck({
  name,
  done,
  onToggle,
}: {
  name: string;
  done: boolean;
  onToggle: () => void;
}) {
  const progress = useSharedValue(done ? 1 : 0);
  const scale = useSharedValue(1);
  const checkScale = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(done ? 1 : 0, { duration: 180 });
    checkScale.value = done
      ? withSpring(1, { damping: 10, stiffness: 320 })
      : withTiming(0, { duration: 110 });
  }, [checkScale, done, progress]);

  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ["#FFFDF8", "#B4F34D"]),
    borderColor: interpolateColor(progress.value, [0, 1], ["#D5D5DA", "#B4F34D"]),
    transform: [{ scale: scale.value }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onToggle}
      onPressIn={() => {
        scale.value = withTiming(0.9, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 300 });
      }}
      accessibilityRole="checkbox"
      accessibilityLabel={`Mark ${name} done`}
      accessibilityState={{ checked: done }}
      hitSlop={10}
      style={[s.checkCircle, circleStyle]}
    >
      <Animated.View style={checkStyle}>
        <Check size={ms(15)} color="#0B0B0B" strokeWidth={3} />
      </Animated.View>
    </AnimatedPressable>
  );
}

export default function ProtocolPlanCard({
  protocols,
  onToggle,
  onShuffle,
  startDelay = 0,
}: {
  protocols: ProtocolTask[];
  onToggle: (id: string, done: boolean) => void;
  onShuffle?: () => void;
  startDelay?: number;
}) {
  const [selected, setSelected] = useState<ProtocolTask | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!shuffling) {
      pulse.value = withTiming(1, { duration: 140 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.56, { duration: 420 }),
        withTiming(1, { duration: 420 }),
      ),
      -1,
      true,
    );
  }, [pulse, shuffling]);

  const rowsAnim = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ translateY: shuffling ? (1 - pulse.value) * 8 : 0 }],
  }));

  if (protocols.length === 0) return null;

  const selectedImage = selected ? getDietProtocolImage(selected.id) : undefined;

  return (
    <Animated.View
      entering={FadeInDown.delay(startDelay).duration(360)}
      style={s.card}
    >
      <Animated.View style={rowsAnim}>
        {shuffling ? (
          <Animated.View entering={FadeInDown.duration(180)} style={s.shuffleOverlay}>
            <ActivityIndicator size="small" color="#0B0B0B" />
            <View style={s.shuffleLines}>
              <View style={[s.shuffleLine, { width: "78%" }]} />
              <View style={[s.shuffleLine, { width: "58%" }]} />
            </View>
          </Animated.View>
        ) : null}

        {protocols.map((protocol, index) => {
          const done = protocol.status === "done";
          const image = getDietProtocolImage(protocol.id);

          return (
            <Animated.View
              key={protocol.id}
              entering={FadeInDown.delay(index * 35).duration(240)}
              style={[s.row, index === protocols.length - 1 && s.rowLast]}
            >
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelected(protocol);
                }}
                accessibilityRole="button"
                accessibilityLabel={`View ${protocol.name} details`}
                style={({ pressed }) => [s.rowMain, pressed && s.rowPressed]}
              >
                <View style={[s.imageFrame, done && s.imageFrameDone]}>
                  {image ? (
                    <Image source={image} style={s.image} />
                  ) : (
                    <View style={s.imageFallback} />
                  )}
                </View>

                <View style={s.copy}>
                  <Text style={[s.name, done && s.doneText]} numberOfLines={2}>
                    {protocol.name}
                  </Text>
                  <Text style={s.target} numberOfLines={1}>
                    {getDietProtocolTargetText(protocol.id)}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelected(protocol);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Open ${protocol.name} explanation`}
                hitSlop={10}
                style={s.infoBtn}
              >
                <Info size={ms(16)} color="#A5A5AC" strokeWidth={2.3} />
              </Pressable>

              <ProtocolCheck
                name={protocol.name}
                done={done}
                onToggle={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onToggle(protocol.id, !done);
                }}
              />
            </Animated.View>
          );
        })}
      </Animated.View>

      {onShuffle ? (
        <Pressable
          onPress={() => {
            if (shuffling) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShuffling(true);
            setTimeout(() => {
              onShuffle();
              setTimeout(() => setShuffling(false), 340);
            }, 520);
          }}
          disabled={shuffling}
          accessibilityRole="button"
          accessibilityLabel="Shuffle diet"
          style={({ pressed }) => [
            s.shuffleBtn,
            shuffling && s.shuffleBtnDisabled,
            pressed && !shuffling && s.shuffleBtnPressed,
          ]}
        >
          <Text style={s.shuffleText}>{shuffling ? "SHUFFLING..." : "SHUFFLE DIET?"}</Text>
        </Pressable>
      ) : null}

      <Modal
        transparent
        visible={selected !== null}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setSelected(null)}>
          <Animated.View
            entering={FadeInDown.duration(240).springify().damping(20).stiffness(180)}
            exiting={FadeOut.duration(120)}
            style={s.detailCard}
          >
            <Pressable onPress={() => {}} style={s.detailInner}>
              <Pressable
                onPress={() => setSelected(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close diet details"
                style={s.closeBtn}
              >
                <X size={ms(16)} color="#8F8F96" strokeWidth={2.4} />
              </Pressable>

              <View style={s.detailTop}>
                <View style={s.detailImageFrame}>
                  {selectedImage ? (
                    <Image source={selectedImage} style={s.detailImage} />
                  ) : (
                    <View style={s.imageFallback} />
                  )}
                </View>
                <View style={s.detailTitleWrap}>
                  <Text style={s.detailName} numberOfLines={2}>
                    {selected?.name}
                  </Text>
                  <Text style={s.detailTarget} numberOfLines={1}>
                    Targets {selected ? getDietProtocolPrimaryTarget(selected.id) : "daily protocol"}
                  </Text>
                </View>
              </View>

              <Text style={s.detailBody}>
                {selected?.reason ?? (selected ? getDietProtocolWhyText(selected.id) : "")}
              </Text>
              <Text style={s.detailBodyMuted}>
                {selected ? getDietProtocolWhyText(selected.id) : ""}
              </Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: SP[4],
    backgroundColor: "#FFFDF8",
    borderRadius: sw(24),
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
    paddingTop: sh(20),
    paddingBottom: sh(16),
    paddingHorizontal: sw(18),
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: sw(14),
    shadowOffset: { width: 0, height: sh(5) },
    elevation: 2,
  },
  row: {
    minHeight: sh(82),
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(17,17,17,0.06)",
    paddingVertical: sh(9),
  },
  rowMain: {
    flex: 1,
    minHeight: sh(58),
    flexDirection: "row",
    alignItems: "center",
    gap: sw(14),
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    opacity: 0.68,
  },
  shuffleOverlay: {
    position: "absolute",
    top: sh(6),
    left: 0,
    right: 0,
    bottom: sh(6),
    zIndex: 4,
    borderRadius: sw(24),
    backgroundColor: "rgba(255,255,255,0.76)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(12),
  },
  shuffleLines: {
    width: sw(96),
    gap: sh(7),
  },
  shuffleLine: {
    height: sh(7),
    borderRadius: sw(4),
    backgroundColor: "#E7E7EA",
  },
  imageFrame: {
    width: ms(54),
    height: ms(54),
    borderRadius: ms(27),
    overflow: "hidden",
    backgroundColor: "#F4F4F5",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E2E5",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: sw(4),
    shadowOffset: { width: 0, height: sh(2) },
    elevation: 2,
  },
  imageFrameDone: {
    opacity: 0.55,
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imageFallback: {
    flex: 1,
    backgroundColor: "#F1F1F3",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  name: {
    fontFamily: FONT_DIN,
    fontSize: ms(18),
    lineHeight: ms(23),
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  doneText: {
    color: "#9A9AA1",
    textDecorationLine: "line-through",
  },
  target: {
    marginTop: sh(4),
    fontFamily: FONT_DIN,
    fontSize: ms(14),
    lineHeight: ms(18),
    color: "#74747A",
    letterSpacing: 0,
  },
  checkCircle: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    borderWidth: 1.8,
    borderColor: "#D5D5DA",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    alignItems: "center",
    justifyContent: "center",
    marginRight: sw(8),
  },
  checkCircleDone: {
    backgroundColor: "#B4F34D",
    borderColor: "#B4F34D",
  },
  shuffleBtn: {
    marginTop: sh(14),
    minHeight: sh(52),
    borderRadius: sw(26),
    backgroundColor: "#0B0B0B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sw(18),
  },
  shuffleBtnPressed: {
    backgroundColor: "#262626",
    transform: [{ translateY: 1 }],
  },
  shuffleBtnDisabled: {
    backgroundColor: "#161616",
    opacity: 0.82,
  },
  shuffleText: {
    fontFamily: FONT_DIN,
    fontSize: ms(16),
    lineHeight: ms(20),
    color: "#FFFFFF",
    letterSpacing: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11,11,11,0.42)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sw(24),
  },
  detailCard: {
    width: "100%",
    maxWidth: sw(360),
    borderRadius: sw(30),
    backgroundColor: "#FFFFFF",
    padding: sw(20),
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: sw(26),
    shadowOffset: { width: 0, height: sh(12) },
    elevation: 8,
  },
  detailInner: {
    width: "100%",
  },
  closeBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  detailTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(14),
    paddingRight: sw(38),
  },
  detailImageFrame: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    overflow: "hidden",
    backgroundColor: "#F4F4F5",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E2E5",
  },
  detailImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  detailTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  detailName: {
    fontFamily: FONT_DIN,
    fontSize: ms(22),
    lineHeight: ms(27),
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  detailTarget: {
    marginTop: sh(4),
    fontFamily: FONT_DIN,
    fontSize: ms(15),
    lineHeight: ms(19),
    color: "#9A9AA1",
  },
  detailBody: {
    marginTop: sh(18),
    fontFamily: FONT_DIN,
    fontSize: ms(16),
    lineHeight: ms(22),
    color: COLORS.lightText,
  },
  detailBodyMuted: {
    marginTop: sh(10),
    fontFamily: FONT_DIN,
    fontSize: ms(14),
    lineHeight: ms(20),
    color: "#8F8F96",
  },
});
