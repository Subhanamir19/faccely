import React from "react";
import {Image, View, Text} from "react-native";

type Props = { uri?: string|null; size?: number };

export default function AvatarCutout({uri, size=164}: Props){
  return (
    <View
      style={{
        position: "absolute",
        top: -size/2,
        alignSelf: "center",
        width: size,
        height: size,
        borderRadius: size/2,
        backgroundColor: "#e6e6e6",
        borderWidth: 6,
        borderColor: "rgba(255,255,255,0.85)",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 18,
        shadowOffset: {width: 0, height: 10}
      }}
    >
      {uri ? (
        <Image source={{uri}} style={{width: "100%", height: "100%"}} resizeMode="cover"/>
      ) : (
        <View style={{flex:1, alignItems:"center", justifyContent:"center"}}>
          <Text style={{color:"#666"}}>No Photo</Text>
        </View>
      )}
    </View>
  );
}
