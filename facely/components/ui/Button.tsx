import React from "react";
import {Pressable, Text, ViewStyle} from "react-native";

type Props={title:string;onPress:()=>void;style?:ViewStyle;variant?:"primary"|"ghost"};
export default function Button({title,onPress,style,variant="primary"}:Props){
  const base:ViewStyle={paddingVertical:12,paddingHorizontal:16,borderRadius:14,alignItems:"center",justifyContent:"center"};
  const styles:Record<string,ViewStyle>={
    primary:{backgroundColor:"#111111",shadowColor:"#000",shadowOpacity:0.12,shadowRadius:12,shadowOffset:{width:0,height:8}},
    ghost:{backgroundColor:"#FFFFFF22",borderColor:"#FFFFFF33",borderWidth:1}
  };
  return(
    <Pressable onPress={onPress} style={[base,styles[variant],style]}>
      <Text style={{color:variant==="primary"?"#fff":"#111",fontSize:16}}>{title}</Text>
    </Pressable>
  );
}
