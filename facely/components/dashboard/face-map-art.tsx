import React from "react";
import { Pressable, View, type DimensionValue } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { FACE_MAP, EXAMPLE_FACE_STATES, type FaceArea, type FaceStatus } from "./face-map-theme";

type Props = {
  width?: DimensionValue;
  height?: DimensionValue;
  colored?: boolean;
  selected?: FaceArea;
  // Each region can be painted independently without changing its geometry.
  statuses?: Partial<Record<FaceArea, FaceStatus>>;
  onSelect?: (area: FaceArea) => void;
};

// All artwork uses solid fills. The two paths in each region are its base and side plane.
export const FACE_REGION_PATHS: Record<FaceArea, { base: string; shade: string }> = {
  forehead: {
    base: "M126 91 Q126 83 136 83 H224 Q234 83 234 94 V117 Q234 126 224 126 H136 Q126 126 126 117 Z",
    shade: "M219 83 H224 Q234 83 234 94 V117 Q234 126 224 126 H209 Q219 121 219 111 Z",
  },
  eyes: {
    base: "M112 141 Q112 132 122 132 H151 Q161 132 161 143 V164 Q161 175 151 175 H122 Q112 175 112 164 Z M199 143 Q199 132 209 132 H238 Q248 132 248 143 V164 Q248 175 238 175 H209 Q199 175 199 164 Z",
    shade: "M112 158 Q136 168 161 158 V164 Q161 175 151 175 H122 Q112 175 112 164 Z M199 158 Q223 168 248 158 V164 Q248 175 238 175 H209 Q199 175 199 164 Z",
  },
  nose: {
    base: "M169 169 Q169 158 180 158 Q191 158 191 169 V196 Q201 212 190 216 H170 Q159 212 169 196 Z",
    shade: "M180 159 Q191 158 191 169 V196 Q201 212 190 216 H175 Q186 211 182 202 Z",
  },
  cheeks: {
    base: "M113 189 Q105 189 105 199 V219 Q105 234 120 234 H140 Q153 234 153 221 V209 Q153 199 143 196 Z M247 189 Q255 189 255 199 V219 Q255 234 240 234 H220 Q207 234 207 221 V209 Q207 199 217 196 Z",
    shade: "M105 216 Q123 226 153 217 V221 Q153 234 140 234 H120 Q105 234 105 219 Z M207 217 Q232 226 255 216 V219 Q255 234 240 234 H220 Q207 234 207 221 Z",
  },
  jaw: {
    base: "M105 243 Q103 236 111 236 H118 Q125 236 128 244 Q134 258 148 268 Q155 274 151 284 Q147 292 138 287 Q113 273 105 243 Z M255 243 Q257 236 249 236 H242 Q235 236 232 244 Q226 258 212 268 Q205 274 209 284 Q213 292 222 287 Q247 273 255 243 Z",
    shade: "M108 240 Q120 267 151 276 Q155 284 148 288 Q144 290 138 287 Q113 273 105 243 Q103 237 108 240 Z M252 240 Q240 267 209 276 Q205 284 212 288 Q216 290 222 287 Q247 273 255 243 Q257 237 252 240 Z",
  },
  chin: {
    base: "M164 279 H196 Q207 279 207 289 Q207 304 180 304 Q153 304 153 289 Q153 279 164 279 Z",
    shade: "M154 288 Q180 300 206 288 Q211 304 180 304 Q149 304 154 288 Z",
  },
};

const FACE_HIT_TARGETS: Record<FaceArea, { x: number; y: number; w: number; h: number }[]> = {
  forehead: [{ x: 126, y: 83, w: 108, h: 44 }],
  eyes: [{ x: 112, y: 132, w: 49, h: 44 }, { x: 199, y: 132, w: 49, h: 44 }],
  nose: [{ x: 159, y: 173, w: 42, h: 44 }],
  cheeks: [{ x: 105, y: 189, w: 48, h: 45 }, { x: 207, y: 189, w: 48, h: 45 }],
  jaw: [{ x: 105, y: 237, w: 44, h: 47 }, { x: 211, y: 237, w: 44, h: 47 }],
  chin: [{ x: 153, y: 279, w: 54, h: 44 }],
};

export function FaceMapArt({ width = "100%", height = "100%", colored = true, selected, statuses = EXAMPLE_FACE_STATES, onSelect }: Props) {
  return (
    <View style={{ width, height }}>
    <Svg width="100%" height="100%" viewBox="0 0 360 380">
      <Rect x={151} y={276} width={58} height={67} rx={24} fill="#EDB795" />
      <Path d="M151 290 H209 V310 Q180 321 151 310 Z" fill="#D99878" />
      <Rect x={78} y={153} width={37} height={65} rx={18.5} fill="#EDB795" />
      <Rect x={87} y={168} width={15} height={30} rx={7.5} fill="#D99878" />
      <Rect x={245} y={153} width={37} height={65} rx={18.5} fill="#EDB795" />
      <Rect x={258} y={168} width={15} height={30} rx={7.5} fill="#D99878" />
      <Path d="M96 126 Q96 56 180 56 Q264 56 264 126 V222 Q264 261 229 289 Q207 309 180 311 Q153 309 131 289 Q96 261 96 222 Z" fill="#F6CCAA" />
      <Path d="M241 90 Q264 109 264 137 V222 Q264 261 229 289 Q207 309 180 311 Q222 291 237 253 Q248 225 248 177 Z" fill="#EDB795" />
      {(Object.keys(FACE_REGION_PATHS) as FaceArea[]).map(id => {
        const palette = colored && statuses[id] ? FACE_MAP.states[statuses[id]] : { fill: "#F6CCAA", shade: "#EDB795" };
        return (
          <G key={id}>
            <Path d={FACE_REGION_PATHS[id].base} fill={palette.fill} />
            <Path d={FACE_REGION_PATHS[id].shade} fill={palette.shade} />
          </G>
        );
      })}
      {/* Defining features stay on top when regions are recolored. */}
      <G pointerEvents="none">
        <Rect x={123} y={141} width={24} height={7} rx={3.5} fill="#554738" />
        <Rect x={213} y={141} width={24} height={7} rx={3.5} fill="#554738" />
        <Circle cx={136} cy={158} r={6.5} fill="#3D403C" />
        <Circle cx={224} cy={158} r={6.5} fill="#3D403C" />
        <Path d="M162 245 Q158 242 162 240 Q180 244 198 240 Q202 242 198 245 Q180 263 162 245 Z" fill="#BB765D" />
        <Path d="M165 242 Q180 245 195 242 Q180 251 165 242 Z" fill="#FFFCF5" />
        <Path d="M93 134 Q80 119 87 84 Q91 56 116 48 Q112 28 141 27 Q155 14 179 26 Q204 16 221 34 Q251 32 261 57 Q280 74 267 112 Q263 125 251 134 V104 Q251 84 238 77 Q215 87 197 76 Q175 91 156 77 Q133 88 112 95 V122 Q112 137 103 138 Q97 138 93 134 Z" fill="#635D80" />
        <Path d="M238 49 Q264 51 267 73 Q274 94 263 120 Q258 132 251 134 V104 Q251 84 238 77 Q228 80 218 79 Q238 68 238 49 Z" fill="#4D4769" />
        {selected && colored ? <Circle cx={selected === "eyes" ? 246 : selected === "cheeks" ? 146 : selected === "jaw" ? 247 : selected === "forehead" ? 228 : selected === "nose" ? 193 : 202} cy={selected === "forehead" ? 93 : selected === "eyes" ? 137 : selected === "nose" ? 205 : selected === "cheeks" ? 201 : selected === "jaw" ? 246 : 286} r={4} fill="#FFFFFF" /> : null}
      </G>
    </Svg>
    {/* RN press targets avoid SVG responder warnings on web and provide native touch feedback. */}
    {onSelect && (Object.keys(FACE_HIT_TARGETS) as FaceArea[]).flatMap(id =>
      FACE_HIT_TARGETS[id].map((target, index) => (
        <Pressable
          key={id + index}
          testID={"face-region-" + id + "-" + index}
          accessible={false}
          onPress={() => onSelect(id)}
          style={{
            position: "absolute",
            left: (target.x / 360 * 100) + "%" as DimensionValue,
            top: (target.y / 380 * 100) + "%" as DimensionValue,
            width: (target.w / 360 * 100) + "%" as DimensionValue,
            height: (target.h / 380 * 100) + "%" as DimensionValue,
            minWidth: 44,
            minHeight: 44,
            borderRadius: 16,
          }}
        />
      ))
    )}
    </View>
  );
}

