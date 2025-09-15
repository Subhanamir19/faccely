import React from "react";
import {View,ViewProps} from "react-native";
import {BlurView} from "expo-blur";

type Props=ViewProps&{intensity?:number};

export const GlassCard=({children,style,intensity=25,...rest}:Props)=>(
  <View style={[{borderRadius:20,overflow:"hidden"},style]} {...rest}>
    <BlurView intensity={intensity} tint="light" style={{padding:14}}>
      <View style={{backgroundColor:"#FFFFFF22",borderColor:"#FFFFFF33",borderWidth:1,borderRadius:16,padding:14,shadowColor:"#000",shadowOpacity:0.12,shadowRadius:12,shadowOffset:{width:0,height:8}}}>
        {children}
      </View>
    </BlurView>
  </View>
);
