// lib/responsive.ts
// Global responsive scaling system.
// All UI values flow through these helpers so every screen adapts
// to the device without hard-coded pixel values.

import { Dimensions, PixelRatio } from "react-native";

// Design baseline: iPhone 14 Pro (393 × 852 logical points).
// Every value authored in the codebase assumes this canvas.
const BASE_W = 393;
const BASE_H = 852;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Scale factors
const scaleW = SCREEN_W / BASE_W;
const scaleH = SCREEN_H / BASE_H;

/**
 * Horizontal scale – use for widths, horizontal padding/margins,
 * horizontal gaps, and border-radius.
 */
export function sw(size: number): number {
  return PixelRatio.roundToNearestPixel(size * scaleW);
}

/**
 * Vertical scale – use for heights, vertical padding/margins,
 * vertical gaps, and any dimension tied to screen height.
 */
export function sh(size: number): number {
  return PixelRatio.roundToNearestPixel(size * scaleH);
}

/**
 * Moderate scale – blends horizontal and vertical scaling.
 * Great for font sizes, icon sizes, and dimensions that shouldn't
 * stretch too aggressively in one axis.
 * @param size  design-time value (px at 393 × 852)
 * @param factor  blend factor (0 = pure width, 1 = pure height, default 0.5)
 */
export function ms(size: number, factor = 0.5): number {
  return PixelRatio.roundToNearestPixel(
    size * (scaleW + (scaleH - scaleW) * factor)
  );
}

/**
 * Screen-aware clamp.
 * Scales `size` moderately then clamps between `min` and `max`.
 */
export function clamp(size: number, min: number, max: number, factor = 0.5): number {
  return Math.min(max, Math.max(min, ms(size, factor)));
}

// Re-export raw dimensions for one-off calculations
export const SCREEN_WIDTH = SCREEN_W;
export const SCREEN_HEIGHT = SCREEN_H;