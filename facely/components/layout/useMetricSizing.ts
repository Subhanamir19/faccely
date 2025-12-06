import { useWindowDimensions } from "react-native";
import { SP } from "@/lib/tokens";

// Derives consistent card and gutter sizes across screens.
// Clamp card width so layouts stay readable on small and large devices.
export type MetricSizing = {
  width: number;
  innerWidth: number;
  cardWidth: number;
  usableWidth: number;
  gutter: number;
  pad: number;
  snap: number;
};

export function useMetricSizing(): MetricSizing {
  const { width } = useWindowDimensions();

  const GUTTER_X = SP[4];
  const CARD_MIN_W = 320;
  const CARD_MAX_W = 760;
  const innerWidth = Math.max(0, width - GUTTER_X * 2);
  const cardWidth = Math.min(CARD_MAX_W, Math.max(CARD_MIN_W, innerWidth));
  const usableWidth = cardWidth - SP[3] * 2; // inner width after padding
  const gutter = SP[3];
  const snap = cardWidth + gutter;
  const pad = Math.max(0, (innerWidth - cardWidth) / 2);

  return { width, innerWidth, cardWidth, usableWidth, gutter, pad, snap };
}

export default useMetricSizing;
