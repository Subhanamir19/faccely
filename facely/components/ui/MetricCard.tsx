import React from "react";
import {Text,Pressable} from "react-native";
import Animated,{useSharedValue,withSpring,useAnimatedStyle} from "react-native-reanimated";
import {GlassCard} from "./Glass";

type Props={label:string;value?:number};

export const MetricCard=({label,value}:Props)=>{
  const s=useSharedValue(1);
  const style=useAnimatedStyle(()=>({transform:[{scale:s.value}]}),[]);
  const onIn=()=>{s.value=withSpring(0.98,{stiffness:300,damping:22,mass:0.7});};
  const onOut=()=>{s.value=withSpring(1,{stiffness:300,damping:22,mass:0.7});};
  return(
    <Animated.View style={style}>
      <Pressable onPressIn={onIn} onPressOut={onOut}>
        <GlassCard>
          <Text className="text-sm text-[#111111] opacity-80">{label.replaceAll("_"," ")}</Text>
          <Text className="text-2xl mt-1">{value!==undefined?Math.round(value):"—"}</Text>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
};
