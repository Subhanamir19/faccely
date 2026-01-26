import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import Chip from "../../components/sigma/Chip";
import InputBar from "../../components/sigma/InputBar";
import { COLORS } from "../../lib/tokens";
import { type SigmaMessage } from "../../lib/types/sigma";
import { useSigmaStore } from "../../store/sigma";

const SUGGESTIONS = [
  "Do chin tucks work?",
  "What should I do to improve my jawline?",
  "How can I get a better physique?",
];

const AnimatedFlatList = Animated.FlatList<SigmaMessage>;

function MessageBubble({ message }: { message: SigmaMessage }) {
  const isUser = message.role === "user";
  return (
    <View
      style={[
        styles.messageRow,
        isUser ? styles.messageRowUser : styles.messageRowAssistant,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userText : styles.assistantText,
          ]}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function BouncingDot({ delay }: { delay: number }) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -6,
          duration: 300,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [translateY, delay]);

  return (
    <Animated.View
      style={[
        styles.typingDot,
        { transform: [{ translateY }] },
      ]}
    />
  );
}

function TypingBubble() {
  return (
    <View style={[styles.messageRow, styles.messageRowAssistant]}>
      <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}>
        <View style={styles.typingDotsRow}>
          <BouncingDot delay={0} />
          <BouncingDot delay={150} />
          <BouncingDot delay={300} />
        </View>
      </View>
    </View>
  );
}

export default function SigmaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    thread,
    loading,
    error,
    sendInProgress,
    ensureThread,
    sendMessage,
    newChat,
  } = useSigmaStore();

  const [inputValue, setInputValue] = useState("");
  const listRef = useRef<FlatList<SigmaMessage>>(null);
  const revealAnim = useRef(new Animated.Value(0)).current;
  const prevCount = useRef(0);
  const lastChipRef = useRef<string | null>(null);

  const messages = thread?.messages ?? [];
  const bottomPadding = 60 + 24 + insets.bottom;

  useEffect(() => {
    ensureThread().catch(() => {
      /* handled in store */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const count = messages.length;
    if (prevCount.current === 0 && count > 0) {
      revealAnim.setValue(0);
      Animated.timing(revealAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    if (count === 0) {
      revealAnim.setValue(0);
    }
    prevCount.current = count;
  }, [messages.length, revealAnim]);

  useEffect(() => {
    if (!messages.length) return;
    const timeout = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(timeout);
  }, [messages.length, sendInProgress]);

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setInputValue("");
    lastChipRef.current = null;
    await sendMessage(trimmed);
  }, [inputValue, sendMessage]);

  const handleChange = useCallback((text: string) => {
    setInputValue(text);
    if (text !== lastChipRef.current) {
      lastChipRef.current = null;
    }
  }, []);

  const handleChipPress = useCallback(
    (label: string) => {
      if (inputValue.trim() === label && lastChipRef.current === label) {
        handleSend();
        return;
      }
      setInputValue(label);
      lastChipRef.current = label;
    },
    [handleSend, inputValue]
  );

  const handleNewChat = useCallback(async () => {
    await newChat();
    setInputValue("");
    lastChipRef.current = null;
  }, [newChat]);

  const renderItem = useCallback(
    ({ item }: { item: SigmaMessage }) => <MessageBubble message={item} />,
    []
  );

  const chatAnimatedStyle = useMemo(
    () => ({
      opacity: revealAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.15, 1],
      }),
      transform: [
        {
          translateY: revealAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [8, 0],
          }),
        },
      ],
    }),
    [revealAnim]
  );

  const listEmpty = useMemo(
    () => (
      <View style={styles.emptyState}>
        {loading ? (
          <Text style={styles.statusText}>Warming up Sigma…</Text>
        ) : error ? (
          <Text style={[styles.statusText, styles.errorText]}>{error}</Text>
        ) : (
          <Text style={styles.statusText}>Ask anything to get started.</Text>
        )}
      </View>
    ),
    [error, loading]
  );

  const footer = useMemo(
    () => (sendInProgress ? <TypingBubble /> : <View style={styles.footerSpacer} />),
    [sendInProgress]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={router.back}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backIcon}>←</Text>
            </Pressable>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>SIGMA</Text>
              <Text style={styles.headerSubtitle}>online</Text>
            </View>
          </View>

          <View style={styles.chipRow}>
            {SUGGESTIONS.map((label) => (
              <Chip key={label} label={label} onPress={handleChipPress} />
            ))}
          </View>

          <View style={styles.chatWrapper}>
            <LinearGradient
              colors={[COLORS.sigmaBg, "#00000000"]}
              locations={[0, 0.8]}
              style={styles.topFade}
              pointerEvents="none"
            />
            <AnimatedFlatList
              ref={listRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={(item: SigmaMessage) => item.id}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: bottomPadding + 12 },
              ]}
              contentInset={{ bottom: bottomPadding + 12 }}
              scrollIndicatorInsets={{ bottom: bottomPadding + 12 }}
              ListEmptyComponent={listEmpty}
              ListFooterComponent={footer}
              style={[styles.chatList, chatAnimatedStyle]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>

        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 24 }]}>
          <InputBar
            value={inputValue}
            onChange={handleChange}
            onSend={handleSend}
            onNewChat={handleNewChat}
            sending={sendInProgress}
            disabled={loading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.sigmaBg,
  },
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    position: "absolute",
    left: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 20,
    color: COLORS.sigmaWhite,
    fontFamily: "Poppins-SemiBold",
  },
  headerContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0.25,
    color: COLORS.sigmaWhite,
  },
  headerSubtitle: {
    fontFamily: "Poppins-Medium",
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.sigmaLime,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 8,
    marginBottom: 16,
  },
  chatWrapper: {
    flex: 1,
    position: "relative",
  },
  chatList: {
    flex: 1,
  },
  topFade: {
    position: "absolute",
    top: 0,
    left: -16,
    right: -16,
    height: 72,
    zIndex: 1,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 0,
  },
  messageRow: {
    width: "100%",
    marginBottom: 12,
  },
  messageRowUser: {
    alignItems: "flex-end",
  },
  messageRowAssistant: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "84%",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: COLORS.sigmaLime,
    borderColor: COLORS.sigmaLime,
    shadowColor: COLORS.sigmaGlow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  assistantBubble: {
    backgroundColor: COLORS.sigmaGlass,
    borderColor: COLORS.cardBorder,
  },
  messageText: {
    fontFamily: "Poppins-Medium",
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: COLORS.sigmaBg,
  },
  assistantText: {
    color: COLORS.sigmaWhite,
  },
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  typingDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    height: 16,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.sigmaLime,
  },
  emptyState: {
    height: 200,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontFamily: "Poppins-Medium",
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.sigmaMuted,
    textAlign: "center",
  },
  errorText: {
    color: "#FF6B6B",
  },
  footerSpacer: {
    height: 24,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: COLORS.sigmaBg,
  },
});
