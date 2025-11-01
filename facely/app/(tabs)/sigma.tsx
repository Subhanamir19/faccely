// facely/app/(tabs)/sigma.tsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import T from "../../components/ui/T";
import GlassCard from "../../components/ui/GlassCard";

import { useSigmaStore } from "../../store/sigma";
import { type SigmaMessage } from "../../lib/types/sigma";

function MessageBubble({ msg }: { msg: SigmaMessage }) {
  const isUser = msg.role === "user";
  return (
    <View className={`w-full mb-3 ${isUser ? "items-end" : "items-start"}`}>
      <View
        className={[
          "max-w-[88%] rounded-2xl px-4 py-3",
          "border",
          isUser
            ? "bg-black/40 border-white/10"
            : "bg-white/10 border-white/15",
        ].join(" ")}
      >
        <Text className="text-white leading-6">{msg.content}</Text>
      </View>
    </View>
  );
}

function TypingBubble() {
  return (
    <View className="w-full items-start mb-3">
      <View className="max-w-[60%] rounded-2xl px-4 py-3 bg-white/10 border border-white/15">
        <View className="flex-row gap-1">
          <View className="w-2 h-2 rounded-full bg-white/60" />
          <View className="w-2 h-2 rounded-full bg-white/50" />
          <View className="w-2 h-2 rounded-full bg-white/40" />
        </View>
      </View>
    </View>
  );
}

export default function SigmaScreen() {
  const {
    thread,
    loading,
    error,
    sendInProgress,
    initThread,
    reloadThread,
    sendMessage,
    resetThread,
  } = useSigmaStore();

  const [text, setText] = useState("");
  const flatRef = useRef<FlatList<SigmaMessage>>(null);

  // Start a thread on mount
  useEffect(() => {
    if (!thread && !loading) initThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    const id = setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [thread?.messages?.length, sendInProgress]);

  const onSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sendInProgress) return;
    setText("");
    await sendMessage(trimmed);
  };

  const onNewChat = async () => {
    // clear local thread then start a new one
    resetThread();
    await initThread();
    setText("");
  };

  const renderItem = ({ item }: { item: SigmaMessage }) => <MessageBubble msg={item} />;

  // Show typing bubble like ChatGPT while waiting
  const dataWithTyping = useMemo(() => {
    const msgs = thread?.messages ?? [];
    return sendInProgress ? [...msgs] : msgs;
  }, [thread?.messages, sendInProgress]);

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header */}
      <View className="px-5 pt-2">
        <GlassCard style={{ padding: 16 }}>
          <View className="flex-row items-center justify-between">
            <View>
              <T className="text-xl text-white font-semibold">Sigma</T>
              <T className="text-white/60 mt-1">
                Your facial aesthetics coach. Evidence first. No nonsense.
              </T>
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={reloadThread}
                className="px-3 py-2 rounded-xl bg-white/8"
              >
                <Text className="text-white/70">Reload</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onNewChat}
                className="px-3 py-2 rounded-xl"
                style={{ backgroundColor: "rgba(180,243,77,0.18)", borderWidth: 1, borderColor: "rgba(180,243,77,0.45)" }}
              >
                <Text className="text-[#B4F34D]">New chat</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mt-3 flex-row gap-3 items-center">
            {loading ? <ActivityIndicator /> : null}
            {error ? <Text className="text-red-400">{String(error)}</Text> : null}
          </View>
        </GlassCard>
      </View>

      {/* Chat list */}
      <FlatList
        ref={flatRef}
        data={dataWithTyping}
        renderItem={renderItem}
        keyExtractor={(m) => m.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 108 }}
        ListFooterComponent={sendInProgress ? <TypingBubble /> : null}
        keyboardShouldPersistTaps="handled"
      />

      {/* Composer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
        className="absolute bottom-0 w-full px-4 pb-5 bg-black"
      >
        <View className="flex-row items-end bg-white/8 border border-white/15 rounded-2xl px-3 py-2">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ask Sigma…"
            placeholderTextColor="rgba(255,255,255,0.45)"
            className="flex-1 text-white min-h-[40px] max-h-[120px] px-1 py-1"
            multiline
            autoCapitalize="sentences"
            autoCorrect
            returnKeyType="send"
            onSubmitEditing={onSend}
            blurOnSubmit={false}
            editable={!sendInProgress}
          />
          <TouchableOpacity
            onPress={onSend}
            disabled={sendInProgress || !text.trim()}
            className={`ml-2 rounded-xl px-3 py-2 ${
              sendInProgress || !text.trim()
                ? "bg-white/10 border border-white/15"
                : "bg-white/20 border border-white/30"
            }`}
          >
            {sendInProgress ? <ActivityIndicator /> : <Text className="text-white">Send</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
