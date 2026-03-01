// app/(tabs)/ten-by-ten.tsx
// "You as a 10/10" — AI face enhancement powered by gpt-image-1.
// Shows the user what they could look like with a chiseled jawline,
// hunter eyes, fixed maxilla, and clear skin.

import React, { useCallback, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
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
import { Sparkles, RefreshCw, Share2, Camera, Images, X, Maximize2 } from "lucide-react-native";
import { router } from "expo-router";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { useScores } from "@/store/scores";
import { useOnboarding } from "@/store/onboarding";
import { useSubscriptionStore } from "@/store/subscription";
import { useTenByTen } from "@/store/tenByTen";

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

  const { generatedUri, generatedAt, loading, error, generate, clear } = useTenByTen();

  // User-selected photo (overrides scan photo if set)
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  // Full-screen viewer
  const [fullscreenVisible, setFullscreenVisible] = useState(false);

  // Effective source: user pick → scan photo → null
  const sourceUri = selectedImageUri ?? scanImageUri ?? null;

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
    await generate(sourceUri, {
      gender: onboardingData?.gender ?? null,
      ethnicity: onboardingData?.ethnicity ?? null,
      age: typeof onboardingData?.age === "number" ? onboardingData.age : null,
    });
  }, [sourceUri, onboardingData, generate]);

  // Opens the native share sheet — includes "Save Image" on iOS/Android
  const handleShare = useCallback(async () => {
    if (!generatedUri) return;
    try {
      await Share.share({ url: generatedUri, title: "My 10/10 Self" });
    } catch {
      // user cancelled
    }
  }, [generatedUri]);

  // Determine if the saved generated image file still exists
  const [fileValid, setFileValid] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    if (!generatedUri) { setFileValid(null); return; }
    FileSystem.getInfoAsync(generatedUri).then((info) => setFileValid(info.exists));
  }, [generatedUri]);

  const effectiveGeneratedUri = generatedUri && fileValid ? generatedUri : null;

  // Pro gate
  if (!hasAccess) return (
    <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" /><ProGate /></SafeAreaView>
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
            See your face with a chiseled jawline, hunter eyes,{"\n"}
            forward maxilla, and flawless skin.
          </Text>
        </Animated.View>

        {/* Loading state */}
        {loading && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.loadingWrap}>
            <PulsingOrb />
            <Text style={styles.loadingTitle}>Generating your 10/10...</Text>
            <Text style={styles.loadingSub}>
              Our AI is sculpting your ideal self.{"\n"}This takes 15–30 seconds.
            </Text>
          </Animated.View>
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
          <Animated.View
            entering={FadeInDown.duration(400).delay(100)}
            style={styles.comparisonWrap}
          >
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
                  // No photo yet — show pick options inside the frame
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

              {/* Change photo buttons below frame */}
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

            {/* After */}
            <View style={styles.photoCol}>
              <Text style={styles.photoLabel}>After</Text>
              <Pressable
                onPress={() => effectiveGeneratedUri && setFullscreenVisible(true)}
                style={styles.photoFrame}
              >
                {effectiveGeneratedUri ? (
                  <Image
                    source={{ uri: effectiveGeneratedUri }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Sparkles size={28} color="rgba(180,243,77,0.3)" strokeWidth={1.5} />
                    <Text style={styles.placeholderText}>
                      {loading ? "Generating..." : "Your 10/10 self"}
                    </Text>
                  </View>
                )}
                {effectiveGeneratedUri && (
                  <View style={[styles.photoOverlay, styles.photoOverlayAccent]}>
                    <Maximize2 size={10} color="#0B0B0B" strokeWidth={2.5} style={{ marginRight: 4 }} />
                    <Text style={[styles.photoOverlayText, { color: "#0B0B0B" }]}>
                      Tap to expand
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Generate / Regenerate CTA */}
        {!loading && (
          <Animated.View entering={FadeInDown.duration(400).delay(180)} style={styles.ctaWrap}>
            {sourceUri ? (
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
            ) : (
              // No photo selected yet
              <View style={styles.noPhotoHint}>
                <Text style={styles.noPhotoHintText}>
                  Select or take a photo to get started
                </Text>
              </View>
            )}

            {/* Share / Save button */}
            {effectiveGeneratedUri && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.actionRow}>
                <Pressable
                  onPress={handleShare}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                >
                  <Share2 size={16} color={COLORS.text} strokeWidth={2} />
                  <Text style={styles.actionBtnText}>Save / Share</Text>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        )}

        {/* Fine print */}
        <Animated.Text
          entering={FadeInDown.duration(300).delay(300)}
          style={styles.finePrint}
        >
          AI-generated visualization for motivational purposes only.
          Results are approximate and not medically accurate.
        </Animated.Text>
      </ScrollView>

      {/* Full-screen image viewer */}
      <Modal
        visible={fullscreenVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFullscreenVisible(false)}
      >
        <View style={styles.fsBackdrop}>
          {effectiveGeneratedUri && (
            <Image
              source={{ uri: effectiveGeneratedUri }}
              style={styles.fsImage}
              resizeMode="contain"
            />
          )}

          {/* Close button */}
          <Pressable
            onPress={() => setFullscreenVisible(false)}
            style={({ pressed }) => [styles.fsClose, pressed && { opacity: 0.7 }]}
          >
            <X size={20} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>

          {/* Share / Save button */}
          <Pressable
            onPress={async () => {
              if (!effectiveGeneratedUri) return;
              try { await Share.share({ url: effectiveGeneratedUri, title: "My 10/10 Self" }); }
              catch { /* cancelled */ }
            }}
            style={({ pressed }) => [styles.fsShare, pressed && { opacity: 0.7 }]}
          >
            <Share2 size={18} color="#0B0B0B" strokeWidth={2} />
            <Text style={styles.fsShareText}>Save / Share</Text>
          </Pressable>
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
    paddingVertical: SP[8],
    gap: SP[4],
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

  // Action row
  actionRow: {
    flexDirection: "row",
    gap: SP[3],
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    paddingVertical: SP[3],
    borderRadius: RADII.lg,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  actionBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
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
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  fsImage: {
    width: "100%",
    height: "100%",
  },
  fsClose: {
    position: "absolute",
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  fsShare: {
    position: "absolute",
    bottom: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    paddingVertical: SP[3],
    paddingHorizontal: SP[6],
    borderRadius: 26,
    backgroundColor: COLORS.accent,
  },
  fsShareText: {
    color: "#0B0B0B",
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
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
