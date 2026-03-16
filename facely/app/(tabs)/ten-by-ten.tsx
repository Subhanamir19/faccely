// app/(tabs)/ten-by-ten.tsx
// "You as a 10/10" — AI face enhancement powered by gpt-image-1.
// Shows the user what they could look like with a chiseled jawline,
// hunter eyes, fixed maxilla, and clear skin.

import React, { useCallback, useRef, useState } from "react";
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing as REasing,
} from "react-native-reanimated";
import { Sparkles, RefreshCw, Camera, Images, X, Maximize2, Lock, ChevronLeft, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { useScores } from "@/store/scores";
import { useOnboarding } from "@/store/onboarding";
import { useSubscriptionStore } from "@/store/subscription";
import { useTenByTen } from "@/store/tenByTen";
import { useTenByTenConsent } from "@/hooks/useTenByTenConsent";

// ---------------------------------------------------------------------------
// Loading pulse animation
// ---------------------------------------------------------------------------

function PulsingOrb() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  React.useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 900, easing: REasing.inOut(REasing.sin) }),
        withTiming(1, { duration: 900, easing: REasing.inOut(REasing.sin) })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: REasing.inOut(REasing.sin) }),
        withTiming(0.5, { duration: 900, easing: REasing.inOut(REasing.sin) })
      ),
      -1,
      false
    );
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.orb, orbStyle]}>
      <Sparkles size={36} color={COLORS.accent} strokeWidth={1.5} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Shimmer skeleton for the "After" frame while generating
// ---------------------------------------------------------------------------

function ShimmerPlaceholder() {
  const tx = useSharedValue(-160);

  React.useEffect(() => {
    tx.value = withRepeat(
      withTiming(350, { duration: 1200, easing: REasing.linear }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: "#111", overflow: "hidden" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 100,
            backgroundColor: "rgba(180,243,77,0.07)",
          },
          shimmerStyle,
        ]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pro gate
// ---------------------------------------------------------------------------

function ProGate() {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.gateWrap}>
      <View style={styles.gateIconWrap}>
        <Sparkles size={32} color={COLORS.accent} strokeWidth={1.5} />
      </View>
      <Text style={styles.gateTitle}>Pro Feature</Text>
      <Text style={styles.gateSub}>
        Unlock "You as a 10/10" with a Sigma Max Pro subscription.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
        onPress={() => router.push("/(paywall)")}
      >
        <Text style={styles.ctaBtnText}>Upgrade to Pro</Text>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function TenByTenScreen() {
  const scanImageUri = useScores((s) => s.imageUri);
  const onboardingData = useOnboarding((s) => s.data);
  const revenueCatEntitlement = useSubscriptionStore((s) => s.revenueCatEntitlement);
  const promoActivated = useSubscriptionStore((s) => s.promoActivated);
  const hasAccess = revenueCatEntitlement || promoActivated;

  const { generatedUri, generatedAt, loading, error, generate, clear, canGenerate } = useTenByTen();
  const { checkAndPromptConsent, ConsentModal } = useTenByTenConsent();

  // User-selected photo (overrides scan photo if set)
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  // Full-screen viewer
  const [fullscreenVisible, setFullscreenVisible] = useState(false);

  // Drag slider
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const SLIDER_W = winWidth - SP[5] * 2;
  const SLIDER_H = Math.round(SLIDER_W * 1.25);
  const HANDLE_R = 20;
  const initX = SLIDER_W / 2;
  const sliderXRef    = useRef(initX);
  const gestureStartX = useRef(initX);
  const [sliderX, setSliderX] = useState(initX);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        gestureStartX.current = sliderXRef.current;
      },
      onPanResponderMove: (_, { dx }) => {
        const next = Math.max(0, Math.min(SLIDER_W, gestureStartX.current + dx));
        sliderXRef.current = next;
        setSliderX(next);
      },
    })
  ).current;

  // Fullscreen comparison slider (separate PanResponder — uses full screen width)
  // Fullscreen card dimensions — constrained, not truly fullscreen
  const fsCardW = winWidth - 48;
  const fsCardH = Math.min(Math.round(fsCardW * (4 / 3)), winHeight * 0.72);

  const fsInitX = fsCardW / 2;
  const fsSliderXRef    = useRef(fsInitX);
  const fsGestureStartX = useRef(fsInitX);
  const [fsSliderX, setFsSliderX] = useState(fsInitX);
  const fsPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        fsGestureStartX.current = fsSliderXRef.current;
      },
      onPanResponderMove: (_, { dx }) => {
        const next = Math.max(0, Math.min(fsCardW, fsGestureStartX.current + dx));
        fsSliderXRef.current = next;
        setFsSliderX(next);
      },
    })
  ).current;

  // Effective source: user pick → scan photo → null
  const sourceUri = selectedImageUri ?? scanImageUri ?? null;

  // Quota: same photo, both attempts used this month
  const quotaBlocked = !canGenerate();

  // Pick from camera roll
  const pickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImageUri(result.assets[0].uri);
      clear(); // clear previous generation since source photo changed
    }
  }, [clear]);

  // Take a new photo
  const takePhoto = useCallback(async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImageUri(result.assets[0].uri);
      clear();
    }
  }, [clear]);

  const handleGenerate = useCallback(async () => {
    if (!sourceUri) return;
    const agreed = await checkAndPromptConsent();
    if (!agreed) return;
    await generate(sourceUri, {
      gender: onboardingData?.gender ?? null,
      ethnicity: onboardingData?.ethnicity ?? null,
      age: typeof onboardingData?.age === "number" ? onboardingData.age : null,
    });
  }, [sourceUri, onboardingData, generate, checkAndPromptConsent]);

  // Determine if the saved generated image file still exists
  const [fileValid, setFileValid] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    if (!generatedUri) { setFileValid(null); return; }
    FileSystem.getInfoAsync(generatedUri).then((info) => setFileValid(info.exists));
  }, [generatedUri]);

  const effectiveGeneratedUri = generatedUri && fileValid ? generatedUri : null;

  // Haptic feedback when generation lands
  const prevGeneratedRef = useRef<string | null>(null);
  React.useEffect(() => {
    if (effectiveGeneratedUri && effectiveGeneratedUri !== prevGeneratedRef.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      prevGeneratedRef.current = effectiveGeneratedUri;
      // Auto-open fullscreen comparison so user immediately sees before/after
      setFullscreenVisible(true);
    }
  }, [effectiveGeneratedUri]);

  // Pro gate — always provide a back escape so user is never stranded
  if (!hasAccess) return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <Pressable
        onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/program")}
        style={{ padding: 16, alignSelf: "flex-start" }}
        hitSlop={8}
      >
        <ChevronLeft size={24} color="rgba(255,255,255,0.70)" strokeWidth={2} />
      </Pressable>
      <ProGate />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(350).delay(50)} style={styles.header}>
          <View style={styles.sparkleRow}>
            <Sparkles size={18} color={COLORS.accent} strokeWidth={2} />
            <Text style={styles.headerEyebrow}>AI Enhancement</Text>
          </View>
          <Text style={styles.headerTitle}>You as a 10/10</Text>
          <Text style={styles.headerSub}>
            See the version of yourself that this program is built to help you become.
          </Text>
        </Animated.View>

        {/* Loading state */}
        {loading && (
          sourceUri ? (
            /* Shimmer side-by-side — user sees their photo + animated After frame */
            <Animated.View entering={FadeIn.duration(300)} style={{ gap: SP[4] }}>
              <View style={styles.comparisonWrap}>
                {/* Before */}
                <View style={styles.photoCol}>
                  <Text style={styles.photoLabel}>Before</Text>
                  <View style={styles.photoFrame}>
                    <Image source={{ uri: sourceUri }} style={styles.photo} resizeMode="cover" />
                    <View style={styles.photoOverlay}>
                      <Text style={styles.photoOverlayText}>You now</Text>
                    </View>
                  </View>
                </View>
                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <View style={styles.dividerBadge}>
                    <Sparkles size={12} color={COLORS.accent} strokeWidth={2} />
                  </View>
                  <View style={styles.dividerLine} />
                </View>
                {/* After — shimmer skeleton */}
                <View style={styles.photoCol}>
                  <Text style={styles.photoLabel}>After</Text>
                  <View style={styles.photoFrame}>
                    <ShimmerPlaceholder />
                  </View>
                </View>
              </View>
              <View style={styles.loadingWrap}>
                <PulsingOrb />
                <Text style={styles.loadingTitle}>Sculpting your 10/10...</Text>
                <Text style={styles.loadingSub}>This takes 15–30 seconds.</Text>
              </View>
            </Animated.View>
          ) : (
            /* No photo selected — centered orb */
            <Animated.View entering={FadeIn.duration(300)} style={styles.loadingWrap}>
              <PulsingOrb />
              <Text style={styles.loadingTitle}>Generating your 10/10...</Text>
              <Text style={styles.loadingSub}>
                Our AI is sculpting your ideal self.{"\n"}This takes 15–30 seconds.
              </Text>
            </Animated.View>
          )
        )}

        {/* Error state */}
        {error && !loading && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={handleGenerate}
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
            >
              <RefreshCw size={14} color={COLORS.accent} strokeWidth={2} />
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Before / After comparison */}
        {!loading && (
          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            {effectiveGeneratedUri && sourceUri ? (
              /* ── Drag slider (both images available) ────────────── */
              <View style={{ gap: SP[3] }}>
                <View
                  style={[styles.sliderContainer, { width: SLIDER_W, height: SLIDER_H }]}
                  {...pan.panHandlers}
                >
                  {/* After image — base layer */}
                  <Image
                    source={{ uri: effectiveGeneratedUri }}
                    style={{ width: SLIDER_W, height: SLIDER_H }}
                    resizeMode="cover"
                  />

                  {/* Before image — clipped overlay */}
                  <View style={[styles.sliderClip, { width: sliderX, height: SLIDER_H }]}>
                    <Image
                      source={{ uri: sourceUri }}
                      style={{ width: SLIDER_W, height: SLIDER_H }}
                      resizeMode="cover"
                    />
                  </View>

                  {/* BEFORE badge */}
                  <View style={styles.sliderBadgeLeft}>
                    <Text style={styles.sliderBadgeText}>BEFORE</Text>
                  </View>

                  {/* AFTER badge */}
                  <View style={styles.sliderBadgeRight}>
                    <Text style={[styles.sliderBadgeText, { color: COLORS.accent }]}>AFTER</Text>
                  </View>

                  {/* Divider line */}
                  <View style={[styles.sliderDivider, { left: sliderX - 1, height: SLIDER_H }]} />

                  {/* Drag handle */}
                  <View
                    style={[
                      styles.sliderHandle,
                      { left: sliderX - HANDLE_R, top: SLIDER_H / 2 - HANDLE_R },
                    ]}
                  >
                    <ChevronLeft size={13} color="#0B0B0B" strokeWidth={2.5} />
                    <ChevronRight size={13} color="#0B0B0B" strokeWidth={2.5} />
                  </View>

                  {/* Expand button */}
                  <Pressable
                    onPress={() => setFullscreenVisible(true)}
                    style={({ pressed }) => [styles.sliderExpandBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Maximize2 size={14} color="#FFFFFF" strokeWidth={2} />
                  </Pressable>
                </View>

                {/* Change photo row */}
                <View style={styles.changePhotoRow}>
                  <Pressable
                    onPress={pickFromLibrary}
                    style={({ pressed }) => [styles.changeBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Images size={12} color="rgba(255,255,255,0.55)" strokeWidth={2} />
                    <Text style={styles.changeBtnText}>Library</Text>
                  </Pressable>
                  <Pressable
                    onPress={takePhoto}
                    style={({ pressed }) => [styles.changeBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Camera size={12} color="rgba(255,255,255,0.55)" strokeWidth={2} />
                    <Text style={styles.changeBtnText}>Camera</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* ── No generated image: side-by-side picker layout ── */
              <View style={styles.comparisonWrap}>
                {/* Before */}
                <View style={styles.photoCol}>
                  <Text style={styles.photoLabel}>Before</Text>
                  <View style={styles.photoFrame}>
                    {sourceUri ? (
                      <>
                        <Image source={{ uri: sourceUri }} style={styles.photo} resizeMode="cover" />
                        <View style={styles.photoOverlay}>
                          <Text style={styles.photoOverlayText}>You now</Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.photoPickerPlaceholder}>
                        <Pressable
                          onPress={pickFromLibrary}
                          style={({ pressed }) => [styles.pickBtn, pressed && { opacity: 0.7 }]}
                        >
                          <Images size={22} color={COLORS.accent} strokeWidth={1.5} />
                          <Text style={styles.pickBtnText}>Library</Text>
                        </Pressable>
                        <View style={styles.pickSep} />
                        <Pressable
                          onPress={takePhoto}
                          style={({ pressed }) => [styles.pickBtn, pressed && { opacity: 0.7 }]}
                        >
                          <Camera size={22} color={COLORS.accent} strokeWidth={1.5} />
                          <Text style={styles.pickBtnText}>Camera</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                  {sourceUri && (
                    <View style={styles.changePhotoRow}>
                      <Pressable
                        onPress={pickFromLibrary}
                        style={({ pressed }) => [styles.changeBtn, pressed && { opacity: 0.7 }]}
                      >
                        <Images size={12} color="rgba(255,255,255,0.55)" strokeWidth={2} />
                        <Text style={styles.changeBtnText}>Library</Text>
                      </Pressable>
                      <Pressable
                        onPress={takePhoto}
                        style={({ pressed }) => [styles.changeBtn, pressed && { opacity: 0.7 }]}
                      >
                        <Camera size={12} color="rgba(255,255,255,0.55)" strokeWidth={2} />
                        <Text style={styles.changeBtnText}>Camera</Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <View style={styles.dividerBadge}>
                    <Sparkles size={12} color={COLORS.accent} strokeWidth={2} />
                  </View>
                  <View style={styles.dividerLine} />
                </View>

                {/* After placeholder */}
                <View style={styles.photoCol}>
                  <Text style={styles.photoLabel}>After</Text>
                  <View style={styles.photoFrame}>
                    <View style={styles.photoPlaceholder}>
                      <Sparkles size={28} color="rgba(180,243,77,0.3)" strokeWidth={1.5} />
                      <Text style={styles.placeholderText}>Your 10/10 self</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Saved to Profile hint — appears after generation */}
        {!loading && !!effectiveGeneratedUri && (
          <Animated.View entering={FadeIn.duration(300)}>
            <Pressable
              onPress={() => router.push("/(tabs)/profile")}
              style={({ pressed }) => [styles.savedHint, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.savedHintText}>Saved to your Profile →</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Generate / Regenerate CTA */}
        {!loading && (
          <Animated.View entering={FadeInDown.duration(400).delay(180)} style={styles.ctaWrap}>
            {sourceUri ? (
              quotaBlocked ? (
                // Quota hit for this photo this month
                <View style={styles.lockedBox}>
                  <Lock size={16} color={COLORS.sub} strokeWidth={2} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lockedText}>
                      Your 10/10 for this month is done. Follow your daily protocols and come back next month.
                    </Text>
                    <Pressable
                      onPress={() => router.push("/(tabs)/program")}
                      style={({ pressed }) => [styles.lockedProgramBtn, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={styles.lockedProgramBtnText}>Go to my program →</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  {/* Photo tips — shown when regenerating */}
                  {!!effectiveGeneratedUri && (
                    <View style={styles.regenTips}>
                      <Text style={styles.regenTipsTitle}>For best results:</Text>
                      <Text style={styles.regenTip}>• Face looking straight at camera</Text>
                      <Text style={styles.regenTip}>• Good lighting, no shadows</Text>
                      <Text style={styles.regenTip}>• Neutral expression, no glasses</Text>
                    </View>
                  )}
                <View style={styles.ctaDepth}>
                  <Pressable
                    onPress={effectiveGeneratedUri ? clear : handleGenerate}
                    style={({ pressed }) => [
                      styles.ctaInner,
                      pressed && { transform: [{ translateY: 4 }] },
                    ]}
                  >
                    <Sparkles size={18} color="#0B0B0B" strokeWidth={2} />
                    <Text style={styles.ctaBtnText}>
                      {effectiveGeneratedUri ? "Generate New Version" : "Generate My 10/10"}
                    </Text>
                  </Pressable>
                </View>
                </>
              )
            ) : (
              // No photo selected yet
              <View style={styles.noPhotoHint}>
                <Text style={styles.noPhotoHintText}>
                  Select or take a photo to get started
                </Text>
              </View>
            )}

          </Animated.View>
        )}

        {/* Fine print */}
        <Animated.Text
          entering={FadeInDown.duration(300).delay(300)}
          style={styles.finePrint}
        >
          Results are approximate and for motivational purposes only.
        </Animated.Text>
      </ScrollView>

      {/* One-time consent modal */}
      <ConsentModal />

      {/* Full-screen comparison viewer */}
      <Modal
        visible={fullscreenVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFullscreenVisible(false)}
      >
        <View style={styles.fsBackdrop}>
          <View style={[styles.fsCardWrap, { width: fsCardW }]}>
            {/* Comparison slider — before on left, after on right */}
            {effectiveGeneratedUri && sourceUri ? (
              <View
                style={[styles.fsCard, { width: fsCardW, height: fsCardH }]}
                {...fsPan.panHandlers}
              >
                {/* After image — base layer */}
                <Image
                  source={{ uri: effectiveGeneratedUri }}
                  style={{ width: fsCardW, height: fsCardH }}
                  resizeMode="cover"
                />

                {/* Before image — clipped overlay */}
                <View style={[styles.fsSliderClip, { width: fsSliderX, height: fsCardH }]}>
                  <Image
                    source={{ uri: sourceUri }}
                    style={{ width: fsCardW, height: fsCardH }}
                    resizeMode="cover"
                  />
                </View>

                {/* BEFORE badge */}
                <View style={styles.sliderBadgeLeft}>
                  <Text style={styles.sliderBadgeText}>BEFORE</Text>
                </View>

                {/* AFTER badge */}
                <View style={styles.sliderBadgeRight}>
                  <Text style={[styles.sliderBadgeText, { color: COLORS.accent }]}>AFTER</Text>
                </View>

                {/* Divider line */}
                <View style={[styles.fsDivider, { left: fsSliderX - 1 }]} />

                {/* Drag handle */}
                <View
                  style={[
                    styles.sliderHandle,
                    { left: fsSliderX - HANDLE_R, top: fsCardH / 2 - HANDLE_R },
                  ]}
                >
                  <ChevronLeft size={13} color="#0B0B0B" strokeWidth={2.5} />
                  <ChevronRight size={13} color="#0B0B0B" strokeWidth={2.5} />
                </View>
              </View>
            ) : effectiveGeneratedUri ? (
              <Image
                source={{ uri: effectiveGeneratedUri }}
                style={[styles.fsImage, { width: fsCardW, height: fsCardH }]}
                resizeMode="cover"
              />
            ) : null}

            {/* Close button — top-right corner of card */}
            <Pressable
              onPress={() => setFullscreenVisible(false)}
              style={({ pressed }) => [styles.fsClose, pressed && { opacity: 0.7 }]}
            >
              <X size={20} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>

            {/* Motivational CTA — below card */}
            <Pressable
              onPress={() => {
                setFullscreenVisible(false);
                router.push("/(tabs)/program");
              }}
              style={({ pressed }) => [styles.fsEarnBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.fsEarnText}>Let's earn it →</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scroll: {
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    paddingBottom: SP[10],
    gap: SP[6],
  },

  // Header
  header: { gap: SP[2] },
  sparkleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  headerEyebrow: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  headerSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    lineHeight: 20,
  },

  // Loading
  loadingWrap: {
    alignItems: "center",
    paddingVertical: SP[4],
    gap: SP[3],
  },
  orb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(180,243,77,0.08)",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
  },
  loadingSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    lineHeight: 20,
  },

  // Error
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.25)",
    borderWidth: 1,
    borderRadius: RADII.lg,
    padding: SP[4],
    gap: SP[3],
    alignItems: "flex-start",
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  retryText: {
    color: COLORS.accent,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
  },

  // Comparison
  comparisonWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SP[3],
  },
  photoCol: {
    flex: 1,
    gap: SP[2],
  },
  photoLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  photoFrame: {
    aspectRatio: 3 / 4,
    borderRadius: RADII.lg,
    overflow: "hidden",
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  photo: {
    width: "100%",
    height: "100%",
  },

  // Empty "before" picker inside frame
  photoPickerPlaceholder: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    backgroundColor: "rgba(180,243,77,0.03)",
  },
  pickBtn: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
  },
  pickBtnText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
  },
  pickSep: {
    width: "60%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  // Change photo buttons below frame
  changePhotoRow: {
    flexDirection: "row",
    gap: SP[2],
  },
  changeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: SP[2],
    borderRadius: RADII.md,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  changeBtnText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
  },

  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SP[3],
    backgroundColor: "rgba(180,243,77,0.04)",
  },
  placeholderText: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    paddingHorizontal: SP[3],
  },
  photoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: SP[2],
    backgroundColor: "rgba(0,0,0,0.5)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  photoOverlayAccent: {
    backgroundColor: COLORS.accent,
  },
  photoOverlayText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
  },

  // Divider
  divider: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    gap: SP[2],
    width: 20,
  },
  dividerLine: {
    flex: 1,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  dividerBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(180,243,77,0.12)",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  // CTA
  ctaWrap: {
    gap: SP[4],
  },
  ctaDepth: {
    borderRadius: 26,
    backgroundColor: "#6B9A1E",
    paddingBottom: 5,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  ctaInner: {
    borderRadius: 26,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    backgroundColor: COLORS.accent,
  },
  ctaBtn: {
    borderRadius: 26,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  ctaBtnText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 17,
    color: "#0B0B0B",
    letterSpacing: -0.2,
  },

  // Quota locked
  lockedBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SP[3],
    paddingVertical: SP[4],
    paddingHorizontal: SP[4],
    borderRadius: RADII.lg,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  lockedText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    lineHeight: 19,
  },
  lockedProgramBtn: {
    marginTop: SP[3],
  },
  lockedProgramBtnText: {
    color: COLORS.accent,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
  },

  // Saved to profile hint
  savedHint: {
    alignItems: "center",
    paddingVertical: SP[2],
  },
  savedHintText: {
    color: COLORS.accent,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
  },

  // Regeneration photo tips
  regenTips: {
    paddingVertical: SP[3],
    paddingHorizontal: SP[4],
    borderRadius: RADII.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: SP[1],
  },
  regenTipsTitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  regenTip: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    lineHeight: 18,
  },

  // No photo hint (replaces CTA when no photo selected)
  noPhotoHint: {
    paddingVertical: SP[5],
    alignItems: "center",
  },
  noPhotoHintText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
  },

  // Fine print
  finePrint: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 11,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    lineHeight: 16,
  },

  // Full-screen viewer
  fsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  fsCardWrap: {
    gap: SP[4],
    alignItems: "center",
  },
  fsCard: {
    borderRadius: RADII.xl,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  fsImage: {
    borderRadius: RADII.xl,
    overflow: "hidden",
  },
  fsClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  fsEarnBtn: {
    paddingVertical: SP[2],
  },
  fsEarnText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.2,
  },

  // Drag slider
  sliderContainer: {
    borderRadius: RADII.xl,
    overflow: "hidden",
    backgroundColor: "#111",
    alignSelf: "center",
  },
  sliderClip: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  },
  sliderBadgeLeft: {
    position: "absolute",
    top: 12,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sliderBadgeRight: {
    position: "absolute",
    top: 12,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.22)",
  },
  sliderBadgeText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 9,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.8,
  },
  sliderDivider: {
    position: "absolute",
    top: 0,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  sliderHandle: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  sliderExpandBtn: {
    position: "absolute",
    bottom: 12,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  fsSliderClip: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  },
  fsDivider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.88)",
  },

  // Gates
  gateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    gap: SP[4],
  },
  gateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(180,243,77,0.08)",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[2],
  },
  gateTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
  },
  gateSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
