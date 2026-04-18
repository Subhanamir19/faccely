// components/ui/UpdateModal.tsx
import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
} from "react-native";

const APP_STORE_URL = "https://apps.apple.com/app/id6758242257";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.sigmamax.app";

type Props = {
  visible: boolean;
  latestVersion: string;
  message: string;
  forced: boolean;
  onDismiss: () => void;
};

export default function UpdateModal({
  visible,
  latestVersion,
  message,
  forced,
  onDismiss,
}: Props) {
  const handleUpdate = () => {
    const url = Platform.OS === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={forced ? undefined : onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.badge}>NEW UPDATE</Text>
          <Text style={styles.title}>v{latestVersion} is here</Text>
          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate} activeOpacity={0.85}>
            <Text style={styles.updateBtnText}>Update Now</Text>
          </TouchableOpacity>

          {!forced && (
            <TouchableOpacity style={styles.laterBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={styles.laterBtnText}>Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  badge: {
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    color: "#FFD700",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    color: "#999999",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  updateBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  updateBtnText: {
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
    color: "#000000",
  },
  laterBtn: {
    paddingVertical: 8,
  },
  laterBtnText: {
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    color: "#555555",
  },
});
