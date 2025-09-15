import React from "react";
import {View} from "react-native";
import {LinearGradient} from "expo-linear-gradient";

type Props = { value: number; scheme?: "green"|"orange" };

export default function ProgressBar({value, scheme="green"}: Props){
  const pct = Math.max(0, Math.min(100, value || 0));
  const colors: [string, string] = scheme === "green"
    ? ["#9BE15D", "#00C853"]
    : ["#FFA351", "#FF7A00"];

  return (
    <View
      style={{
        height: 10,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.6)",
        overflow: "hidden"
      }}
    >
      <LinearGradient
        colors={colors}
        start={{x: 0, y: 0}} end={{x: 1, y: 0}}
        style={{width: `${pct}%`, height: "100%"}}
      />
    </View>
  );
}
