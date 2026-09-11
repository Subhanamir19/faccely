import React from "react";
import { View, Image } from "react-native";
import { UserRound } from "lucide-react-native";

import { useProfile } from "@/store/profile";

import { COACH, COACH_AVATAR } from "./theme";

/* ============================================================================
 * Message avatars.
 *
 * Coach gets the same illustrated face the analysis screens use, so the two
 * places the app speaks in a voice are visibly the same character. The user
 * gets the photo they set on their profile.
 *
 * Both sit in a fixed-width column beside the message. A missing image never
 * changes the layout, so a reply does not reflow when an avatar fails to load.
 * ========================================================================== */

const COACH_FACE = require("@/assets/advanced-analysis-coach.png");

export function CoachAvatar() {
  return (
    <View
      style={{
        width: COACH_AVATAR.size,
        height: COACH_AVATAR.size,
        borderRadius: COACH_AVATAR.size / 2,
        backgroundColor: COACH.accentSoft,
        borderWidth: 1,
        borderColor: COACH.border,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityRole="image"
      accessibilityLabel="Coach"
    >
      <Image
        source={COACH_FACE}
        // The artwork is a head on a transparent ground that fills its frame.
        // Scaled slightly past the circle so the crop lands on the hair and
        // jaw rather than leaving a ring of empty space around the face.
        style={{
          width: COACH_AVATAR.size * 1.18,
          height: COACH_AVATAR.size * 1.18,
          marginTop: COACH_AVATAR.size * 0.06,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

export function UserAvatar() {
  const avatarUri = useProfile((state) => state.avatarUri);

  return (
    <View
      style={{
        width: COACH_AVATAR.size,
        height: COACH_AVATAR.size,
        borderRadius: COACH_AVATAR.size / 2,
        backgroundColor: COACH.surfaceMuted,
        borderWidth: 1,
        borderColor: COACH.border,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityRole="image"
      accessibilityLabel="You"
    >
      {avatarUri ? (
        <Image
          source={{ uri: avatarUri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : (
        <UserRound size={15} color={COACH.inkFaint} strokeWidth={2} />
      )}
    </View>
  );
}
