import React, { useCallback, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Plus, Send } from "lucide-react-native";

import { COLORS } from "../../lib/tokens";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onNewChat: () => void;
  sending?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

const AnimatedContainer = Animated.createAnimatedComponent(View);
const AnimatedSendWrapper = Animated.createAnimatedComponent(View);

export default function InputBar({
  value,
  onChange,
  onSend,
  onNewChat,
  sending = false,
  disabled = false,
  placeholder = "Ask anything…",
}: Props) {
  const glow = useRef(new Animated.Value(0)).current;
  const sendScale = useRef(new Animated.Value(1)).current;
  const sendRipple = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const sendDisabled = disabled || sending || value.trim().length === 0;

  const animateGlow = useCallback(
    (toValue: number) => {
      Animated.timing(glow, {
        toValue,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    },
    [glow]
  );

  const handleFocus = useCallback(() => {
    animateGlow(1);
  }, [animateGlow]);

  const handleBlur = useCallback(() => {
    animateGlow(0);
  }, [animateGlow]);

  const glowStyle = useMemo(
    () => ({
      shadowOpacity: glow.interpolate({
        inputRange: [0, 1],
        outputRange: [0.25, 0.5],
      }),
    }),
    [glow]
  );

  const handleSendPressIn = useCallback(() => {
    if (sendDisabled) return;

    Animated.parallel([
      Animated.timing(sendScale, {
        toValue: 0.9,
        duration: 120,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(sendRipple, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();
  }, [sendDisabled, sendRipple, sendScale]);

  const handleSendPressOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(sendScale, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(sendRipple, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();
  }, [sendRipple, sendScale]);

  const sendStyle = useMemo(
    () => ({
      transform: [{ scale: sendScale }],
    }),
    [sendScale]
  );

  const rippleStyle = useMemo(
    () => ({
      opacity: sendRipple.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.55],
      }),
    }),
    [sendRipple]
  );

  const handleChange = useCallback((text: string) => {
    onChange(text);
  }, [onChange]);

  const handleSubmit = useCallback(() => {
    if (sendDisabled) return;
    onSend();
  }, [onSend, sendDisabled]);

  const handleSendPress = useCallback(() => {
    if (sendDisabled) return;
    onSend();
  }, [onSend, sendDisabled]);

  const handleNewChat = useCallback(() => {
    onNewChat();
  }, [onNewChat]);

  return (
    <AnimatedContainer style={[styles.container, glowStyle]}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.inner}>
        <Pressable
          onPress={() => inputRef.current?.focus()}
          onLongPress={handleNewChat}
          delayLongPress={250}
          style={styles.plusButton}
          accessibilityRole="button"
          accessibilityLabel="New chat"
        >
          <Plus size={20} color={COLORS.sigmaLime} />
        </Pressable>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmit}
          placeholder={placeholder}
          placeholderTextColor={COLORS.sigmaMuted}
          style={styles.input}
          multiline
          maxLength={500}
          blurOnSubmit={false}
          returnKeyType="send"
          accessibilityLabel="Sigma message input"
        />
        <Pressable
          onPressIn={handleSendPressIn}
          onPressOut={handleSendPressOut}
          onPress={handleSendPress}
          disabled={sendDisabled}
          hitSlop={4}
          style={styles.sendPressable}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <AnimatedSendWrapper
            style={[styles.sendButton, sendStyle, sendDisabled && styles.sendDisabled]}
          >
            <Animated.View style={[styles.sendRipple, rippleStyle]} />
            <Send size={18} color={COLORS.sigmaBg} />
          </AnimatedSendWrapper>
        </Pressable>
      </View>
    </AnimatedContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.sigmaBorder,
    backgroundColor: COLORS.sigmaGlass,
    overflow: "hidden",
    shadowColor: COLORS.sigmaLime,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    shadowOpacity: 0.25,
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 8,
  },
  plusButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontFamily: "Poppins-Medium",
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.sigmaWhite,
    paddingVertical: 0,
    minHeight: 36,
    maxHeight: 80,
  },
  sendPressable: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.sigmaLime,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.sigmaLime,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    shadowOpacity: 0.45,
    elevation: 6,
    overflow: "hidden",
  },
  sendRipple: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.sigmaGlow,
  },
  sendDisabled: {
    opacity: 0.45,
    shadowOpacity: 0.2,
  },
});
