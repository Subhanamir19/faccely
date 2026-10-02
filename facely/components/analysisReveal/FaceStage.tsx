// components/analysisReveal/FaceStage.tsx
// The user's photo as a graded, full-bleed stage, with everything drawn in
// image pixel coordinates inside one Svg. Because photo and overlays share a
// coordinate system, a traced jaw stays on the jaw while the camera zooms.
//
// Two drawing modes per region:
//   traced    — geometry came from on-device detection: real lines.
//   spotlight — no trustworthy geometry: a soft light and a dashed ring.
// Both modes dim the rest of the face, so the eye always lands on the region.

import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  FeColorMatrix,
  Filter,
  G,
  Image as SvgImage,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import type { FaceGeometry, Point } from "@/lib/faceLandmarks";
import type { Shape } from "@/lib/analysisHighlights";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);

export const REVEAL_ORANGE = "#FF7A1A";
export const REVEAL_MINT = "#6FE3A1";

const EASE_CAMERA = Easing.bezier(0.22, 1, 0.36, 1);

/* ── Region maths ──────────────────────────────────────────────────── */

export type Region = { center: Point; radius: number; zoom: number };

const mean = (pts: Point[]): Point => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

/** Where a shape lives on this face, and how far the camera leans in. */
export function regionFor(shape: Shape, g: FaceGeometry): Region {
  const b = g.faceBox;
  const at = (fx: number, fy: number): Point => ({ x: b.x + b.w * fx, y: b.y + b.h * fy });
  const eyes = g.leftEye && g.rightEye ? mean([...g.leftEye, ...g.rightEye]) : at(0.5, 0.4);
  switch (shape) {
    case "jawTrace":
    case "jawCorners":
    case "lowerFace":
      return { center: g.jaw ? mean(g.jaw) : at(0.5, 0.8), radius: b.w * 0.62, zoom: 1.55 };
    case "eyeTilt":
    case "eyes":
      return { center: eyes, radius: b.w * 0.5, zoom: 1.95 };
    case "brows": {
      const brows = g.leftBrow && g.rightBrow ? mean([...g.leftBrow, ...g.rightBrow]) : at(0.5, 0.3);
      return { center: brows, radius: b.w * 0.5, zoom: 1.9 };
    }
    case "cheekWidth":
      return { center: g.cheekbones ? mean(g.cheekbones) : at(0.5, 0.52), radius: b.w * 0.68, zoom: 1.4 };
    case "faceRatio":
      return { center: at(0.5, 0.5), radius: b.w * 0.72, zoom: 1.3 };
    case "midface":
      return {
        center: g.noseBottom && g.cheekbones ? mean([g.noseBottom, ...g.cheekbones]) : at(0.5, 0.58),
        radius: b.w * 0.45,
        zoom: 1.7,
      };
    case "skin":
      return { center: at(0.5, 0.45), radius: b.w * 0.66, zoom: 1.35 };
    case "hairline":
      return { center: g.hairline ? mean(g.hairline) : at(0.5, 0.02), radius: b.w * 0.62, zoom: 1.45 };
    case "profile":
      // Side photos get no detection; the lower face sits low and central.
      return { center: { x: g.imageW * 0.5, y: g.imageH * 0.64 }, radius: g.imageW * 0.34, zoom: 1.4 };
  }
}

/* ── Drawing helpers ───────────────────────────────────────────────── */

const polyline = (pts: Point[], close = false) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + (close ? " Z" : "");

const lengthOf = (pts: Point[], close = false) => {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  if (close && pts.length > 1) len += Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
  return len;
};

/** A path that draws itself as `progress` runs 0 → 1. */
function DrawnPath({
  d,
  length,
  progress,
  stroke,
  width,
  dash,
}: {
  d: string;
  length: number;
  progress: SharedValue<number>;
  stroke: string;
  width: number;
  dash?: number;
}) {
  const props = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - progress.value),
  }));
  const fade = useAnimatedProps(() => ({ opacity: progress.value }));
  if (dash) {
    // Dashed guides fade in rather than draw; dash offsets would fight.
    return (
      <AnimatedG animatedProps={fade}>
        <Path d={d} stroke={stroke} strokeWidth={width} strokeDasharray={[dash, dash]} fill="none" strokeLinecap="round" />
      </AnimatedG>
    );
  }
  return (
    <AnimatedPath
      d={d}
      stroke={stroke}
      strokeWidth={width}
      strokeDasharray={[length, length]}
      animatedProps={props}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

const extend = (a: Point, b: Point, by: number): [Point, Point] => {
  const dx = (b.x - a.x) * by;
  const dy = (b.y - a.y) * by;
  return [{ x: a.x - dx, y: a.y - dy }, { x: b.x + dx, y: b.y + dy }];
};

/** Traced lines for a shape, or null when this face lacks the geometry. */
function tracedPaths(shape: Shape, g: FaceGeometry): { d: string; len: number; dashed?: boolean }[] | null {
  if (g.source !== "landmarks") return null;
  const path = (pts: Point[], close = false, dashed = false) => ({ d: polyline(pts, close), len: lengthOf(pts, close), dashed });
  switch (shape) {
    case "jawTrace":
      return g.jaw ? [path(g.jaw)] : null;
    case "jawCorners": {
      if (!g.jaw || !g.jawCorners) return null;
      // The jaw line, plus a short angle bracket at each corner.
      const ticks = g.jawCorners.map((c) => {
        const r = g.faceBox.w * 0.07;
        const toChin = g.chin ? Math.atan2(g.chin.y - c.y, g.chin.x - c.x) : Math.PI / 2;
        const up = -Math.PI / 2;
        return path([
          { x: c.x + Math.cos(up) * r, y: c.y + Math.sin(up) * r },
          c,
          { x: c.x + Math.cos(toChin) * r, y: c.y + Math.sin(toChin) * r },
        ]);
      });
      return [path(g.jaw), ...ticks];
    }
    case "lowerFace":
      return g.jaw ? [path(g.jaw, false, true)] : null;
    case "eyeTilt": {
      if (!g.leftEyeCorners || !g.rightEyeCorners) return null;
      return [g.leftEyeCorners, g.rightEyeCorners].flatMap(([inner, outer]) => {
        const [a, b] = extend(inner, outer, 0.35);
        const flat: Point[] = [{ x: a.x, y: inner.y }, { x: b.x, y: inner.y }];
        return [path([a, b]), path(flat, false, true)];
      });
    }
    case "eyes":
      return g.leftEye && g.rightEye ? [path(g.leftEye, true), path(g.rightEye, true)] : null;
    case "brows":
      return g.leftBrow && g.rightBrow ? [path(g.leftBrow), path(g.rightBrow)] : null;
    case "cheekWidth": {
      if (!g.cheekbones) return null;
      const [l, r] = g.cheekbones;
      const tick = g.faceBox.h * 0.05;
      return [
        path([l, r]),
        path([{ x: l.x, y: l.y - tick }, { x: l.x, y: l.y + tick }]),
        path([{ x: r.x, y: r.y - tick }, { x: r.x, y: r.y + tick }]),
      ];
    }
    case "faceRatio": {
      if (!g.cheekbones || !g.leftBrow || !g.rightBrow || !g.upperLip) return null;
      const top = Math.min(...[...g.leftBrow, ...g.rightBrow].map((p) => p.y));
      const [l, r] = g.cheekbones;
      const bottom = g.upperLip.y;
      return [path([{ x: l.x, y: top }, { x: r.x, y: top }, { x: r.x, y: bottom }, { x: l.x, y: bottom }], true)];
    }
    case "hairline": {
      if (!g.hairline) return null;
      const lift = g.faceBox.h * 0.03;
      return [path(g.hairline.map((p) => ({ x: p.x, y: p.y - lift })), false, true)];
    }
    default:
      // midface, skin and profile are areas: the spotlight is the drawing.
      return null;
  }
}

/* ── Stage ─────────────────────────────────────────────────────────── */

export type StageFocus = { shape: Shape; tone: "problem" | "strength" } | null;

export default function FaceStage({
  uri,
  geometry,
  width,
  height,
  focus,
  playToken,
  hideFace = false,
  camera = true,
  grade = true,
  children,
}: {
  uri: string;
  geometry: FaceGeometry;
  width: number;
  height: number;
  /** Region to light and zoom into; null shows the whole face. */
  focus: StageFocus;
  /** Change to replay the draw-in for the same focus. */
  playToken: number;
  /** Swap the photo for a stylised outline (share card). */
  hideFace?: boolean;
  /** Zoom and pan into the focused region. Off = fixed framing. */
  camera?: boolean;
  /** Near-monochrome grade. Off = the photo's own colour. */
  grade?: boolean;
  /** Extra Svg content in image coordinates. */
  children?: React.ReactNode;
}) {
  const { imageW, imageH } = geometry;
  // "slice" fit: the image covers the stage; this is its screen scale.
  const k = Math.max(width / imageW, height / imageH);
  const region = focus ? regionFor(focus.shape, geometry) : null;
  const zoom = camera ? region?.zoom ?? 1 : 1;

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const draw = useSharedValue(0);
  const dim = useSharedValue(0);

  useEffect(() => {
    // Screen position of the region centre at zoom 1.
    const cx = region ? region.center.x * k - (imageW * k - width) / 2 : width / 2;
    const cy = region ? region.center.y * k - (imageH * k - height) / 2 : height / 2;
    // Centre it (a little above middle, leaving room for the copy below),
    // without letting the photo's edge into frame.
    const maxX = ((zoom - 1) * width) / 2;
    const maxY = ((zoom - 1) * height) / 2;
    const targetX = Math.max(-maxX, Math.min(maxX, -zoom * (cx - width / 2)));
    const targetY = Math.max(-maxY, Math.min(maxY, -zoom * (cy - height * 0.4)));

    const move = { duration: 1100, easing: EASE_CAMERA };
    tx.value = withTiming(targetX, move);
    ty.value = withTiming(targetY, move);
    // Arrive, then keep drifting in slightly: the frame never sits still.
    scale.value = camera
      ? withSequence(
          withTiming(zoom, move),
          withTiming(zoom * 1.035, { duration: 5200, easing: Easing.inOut(Easing.quad) }),
        )
      : withTiming(1, move);
    draw.value = 0;
    draw.value = withDelay(650, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    dim.value = withTiming(region ? 1 : 0, { duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.shape, playToken, width, height]);

  const cameraStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const dimProps = useAnimatedProps(() => ({ opacity: dim.value * 0.5 }));
  const glowProps = useAnimatedProps(() => ({ opacity: draw.value }));

  // One screen pixel in image units at the target zoom.
  const px = 1 / (k * zoom);
  const color = focus?.tone === "strength" ? REVEAL_MINT : REVEAL_ORANGE;
  const traced = focus ? tracedPaths(focus.shape, geometry) : null;

  const silhouette = useMemo(() => {
    if (!hideFace) return null;
    const b = geometry.faceBox;
    return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w * 0.5, ry: b.h * 0.58 };
  }, [hideFace, geometry.faceBox]);

  return (
    <View style={[styles.clip, { width, height }]}>
      <Animated.View style={[{ width, height }, cameraStyle]}>
        <Svg width={width} height={height} viewBox={`0 0 ${imageW} ${imageH}`} preserveAspectRatio="xMidYMid slice">
          <Defs>
            {/* Near-monochrome grade: any selfie reads editorial, and the
                orange overlays become the only colour on screen. */}
            <Filter id="grade">
              <FeColorMatrix type="saturate" values="0.12" />
            </Filter>
            {region ? (
              <>
                <RadialGradient
                  id="spot"
                  cx={region.center.x}
                  cy={region.center.y}
                  r={region.radius * 1.25}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor="#000" />
                  <Stop offset="0.55" stopColor="#000" />
                  <Stop offset="1" stopColor="#fff" />
                </RadialGradient>
                <Mask id="spotMask">
                  <Rect x={0} y={0} width={imageW} height={imageH} fill="url(#spot)" />
                </Mask>
                <RadialGradient
                  id="glow"
                  cx={region.center.x}
                  cy={region.center.y}
                  r={region.radius}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={color} stopOpacity="0.22" />
                  <Stop offset="1" stopColor={color} stopOpacity="0" />
                </RadialGradient>
              </>
            ) : null}
          </Defs>

          <Rect x={0} y={0} width={imageW} height={imageH} fill="#0B0B0C" />
          {silhouette ? (
            <Ellipse
              cx={silhouette.cx}
              cy={silhouette.cy}
              rx={silhouette.rx}
              ry={silhouette.ry}
              fill="#1A1A1C"
              stroke={REVEAL_ORANGE}
              strokeOpacity={0.55}
              strokeWidth={2 / k}
            />
          ) : (
            <SvgImage
              href={{ uri }}
              x={0}
              y={0}
              width={imageW}
              height={imageH}
              preserveAspectRatio="xMidYMid slice"
              filter={grade ? "url(#grade)" : undefined}
            />
          )}

          {region ? (
            <>
              <AnimatedRect
                x={0}
                y={0}
                width={imageW}
                height={imageH}
                fill="#000"
                mask="url(#spotMask)"
                animatedProps={dimProps}
              />
              <AnimatedG animatedProps={glowProps}>
                <Circle cx={region.center.x} cy={region.center.y} r={region.radius} fill="url(#glow)" />
              </AnimatedG>
            </>
          ) : null}

          {focus && region ? (
            traced ? (
              traced.map((t, i) => (
                <DrawnPath
                  key={`${focus.shape}-${i}-${playToken}`}
                  d={t.d}
                  length={t.len}
                  progress={draw}
                  stroke={color}
                  width={2.2 * px}
                  dash={t.dashed ? 6 * px : undefined}
                />
              ))
            ) : (
              <DrawnPath
                key={`${focus.shape}-ring-${playToken}`}
                d={`M ${region.center.x - region.radius * 0.72} ${region.center.y} a ${region.radius * 0.72} ${region.radius * 0.72} 0 1 0 ${region.radius * 1.44} 0 a ${region.radius * 0.72} ${region.radius * 0.72} 0 1 0 ${-region.radius * 1.44} 0`}
                length={2 * Math.PI * region.radius * 0.72}
                progress={draw}
                stroke={color}
                width={1.6 * px}
                dash={5 * px}
              />
            )
          ) : null}

          {children}
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Image point → stage point at zoom 1, for pinning RN views to the face. */
export function toStagePoint(p: Point, g: FaceGeometry, width: number, height: number): Point {
  const k = Math.max(width / g.imageW, height / g.imageH);
  return {
    x: p.x * k - (g.imageW * k - width) / 2,
    y: p.y * k - (g.imageH * k - height) / 2,
  };
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden", backgroundColor: "#0B0B0C" },
});
