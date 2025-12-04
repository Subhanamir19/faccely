import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { SP, COLORS } from "@/lib/tokens";

export type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  keyboardAware?: boolean;
  footer?: React.ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
};

const Screen: React.FC<ScreenProps> = ({
  children,
  scroll = false,
  keyboardAware = false,
  footer,
  contentContainerStyle,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const paddingBottom = SP[4] + insets.bottom;

  const content = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, { paddingBottom }, contentContainerStyle]}>{children}</View>
  );

  const body = keyboardAware ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {content}
      {footer ? <View style={[styles.footer, { paddingBottom }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  ) : (
    <>
      {content}
      {footer ? <View style={[styles.footer, { paddingBottom }]}>{footer}</View> : null}
    </>
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={[styles.safeArea, { paddingHorizontal: SP[4] }, style]}>
        {body}
      </SafeAreaView>
    </View>
  );
};

export default Screen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bgBottom,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  footer: {
    paddingTop: SP[3],
  },
});
