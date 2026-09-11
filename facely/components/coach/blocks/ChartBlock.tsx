import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { COLORS, TYPE, SP } from "@/lib/tokens";
import { METRIC_LABELS, type MetricKey } from "@/lib/types";
import type { CoachChartBlock } from "@/lib/coach/blocks";

import { BlockSurface } from "./BlockRenderer";

/* ============================================================================
 * A trend from the user's own scans.
 *
 * Hand-drawn with react-native-svg, already a dependency, rather than a chart
 * library. The shapes Coach needs are a polyline, a few dots and two axis
 * labels; a charting package would add weight and a second visual language to
 * an app that already draws its own graphs.
 *
 * Radar and bar fall back to the line rendering for now. A wrong-looking chart
 * of real data beats a missing one, and the shape is the model's suggestion
 * rather than a promise.
 * ========================================================================== */

const CHART_HEIGHT = 140;
const PADDING_X = 8;
const PADDING_Y = 14;

/** Accent first; the rest are drawn from the verdict palette for contrast. */
const SERIES_COLORS = [
  COLORS.accent,
  COLORS.verdictGreat,
  COLORS.verdictAverage,
  COLORS.verdictPoor,
];

export function ChartBlock({ block }: { block: CoachChartBlock }) {
  const [width, setWidth] = React.useState(0);

  const bounds = useMemo(() => {
    const values = block.series.flatMap((series) => series.points.map((point) => point.y));
    if (values.length === 0) return { min: 0, max: 100 };

    const min = block.yMin ?? Math.min(...values);
    const max = block.yMax ?? Math.max(...values);
    // A flat series would divide by zero; give it a band to sit in.
    return max - min < 1 ? { min: min - 5, max: max + 5 } : { min, max };
  }, [block.series, block.yMin, block.yMax]);

  const labels = useMemo(() => {
    const first = block.series[0]?.points ?? [];
    return { start: first[0]?.x ?? "", end: first[first.length - 1]?.x ?? "" };
  }, [block.series]);

  const plotWidth = Math.max(0, width - PADDING_X * 2);
  const plotHeight = CHART_HEIGHT - PADDING_Y * 2;

  const toX = (index: number, count: number) =>
    PADDING_X + (count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth);

  const toY = (value: number) =>
    PADDING_Y +
    plotHeight -
    ((value - bounds.min) / Math.max(1, bounds.max - bounds.min)) * plotHeight;

  return (
    <BlockSurface>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT}>
            {/* Baseline, so a rising line is visibly rising from something. */}
            <Line
              x1={PADDING_X}
              y1={PADDING_Y + plotHeight}
              x2={width - PADDING_X}
              y2={PADDING_Y + plotHeight}
              stroke={COLORS.divider}
              strokeWidth={1}
            />

            {block.series.map((series, seriesIndex) => {
              const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length];
              const count = series.points.length;

              const path = series.points
                .map((point, index) => {
                  const command = index === 0 ? "M" : "L";
                  return `${command}${toX(index, count)} ${toY(point.y)}`;
                })
                .join(" ");

              return (
                <React.Fragment key={series.label}>
                  <Path
                    d={path}
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  {series.points.map((point, index) => (
                    <Circle
                      key={index}
                      cx={toX(index, count)}
                      cy={toY(point.y)}
                      r={3}
                      fill={color}
                    />
                  ))}
                  {/* Value of the most recent point, the one being asked about. */}
                  <SvgText
                    x={toX(count - 1, count)}
                    y={toY(series.points[count - 1]?.y ?? 0) - 8}
                    fill={color}
                    fontSize={11}
                    textAnchor="end"
                  >
                    {series.points[count - 1]?.y ?? ""}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        ) : (
          <View style={{ height: CHART_HEIGHT }} />
        )}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: SP[1],
          }}
        >
          <Text style={{ ...TYPE.caption, color: COLORS.sub }}>{labels.start}</Text>
          <Text style={{ ...TYPE.caption, color: COLORS.sub }}>{labels.end}</Text>
        </View>

        {block.series.length > 1 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SP[3], marginTop: SP[2] }}>
            {block.series.map((series, index) => (
              <View
                key={series.label}
                style={{ flexDirection: "row", alignItems: "center", gap: SP[1] }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length],
                  }}
                />
                <Text style={{ ...TYPE.caption, color: COLORS.sub }}>
                  {METRIC_LABELS[series.label as MetricKey] ??
                    series.label.replace(/_/g, " ")}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {block.caption ? (
          <Text style={{ ...TYPE.caption, color: COLORS.muted, marginTop: SP[2] }}>
            {block.caption}
          </Text>
        ) : null}
      </View>
    </BlockSurface>
  );
}
