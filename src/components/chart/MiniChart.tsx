import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { colors, radii } from '../../theme/tokens';
import { fonts } from '../../theme/fonts';

interface MiniChartProps {
  /** Array of price data points (most recent last) */
  data: number[];
  /** Chart width in pixels */
  width: number;
  /** Chart height in pixels */
  height: number;
  /** Whether data is still loading */
  loading?: boolean;
  /** Optional color override — defaults to green if price up, red if down */
  color?: string;
}

/** Minimum chart dimensions to ensure readability on high-DPI screens (e.g. Seeker ~480dpi) */
const MIN_CHART_HEIGHT = 80;
const MIN_CHART_WIDTH = 120;

/**
 * Lightweight SVG line chart for price data.
 * Uses react-native-svg (already in deps) — no heavy chart library needed.
 */
export function MiniChart({
  data,
  width: rawWidth,
  height: rawHeight,
  loading = false,
  color,
}: MiniChartProps) {
  const width = Math.max(rawWidth, MIN_CHART_WIDTH);
  const height = Math.max(rawHeight, MIN_CHART_HEIGHT);
  const chartData = useMemo(() => {
    if (!data || data.length < 2) return null;

    const padding = { top: 8, bottom: 8, left: 0, right: 0 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1; // Avoid division by zero for flat data

    // Build SVG path
    const points = data.map((price, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + (1 - (price - min) / range) * chartH;
      return { x, y };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    // Closed path for gradient fill
    const fillPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

    const isUp = data[data.length - 1] >= data[0];
    const lineColor = color ?? (isUp ? colors.long : colors.short);

    // Gridlines (3 horizontal)
    const gridYs = [0.25, 0.5, 0.75].map(
      (frac) => padding.top + frac * chartH,
    );

    // Price labels
    const lastPrice = data[data.length - 1];
    const change = ((lastPrice - data[0]) / data[0]) * 100;

    return {
      linePath,
      fillPath,
      lineColor,
      isUp,
      gridYs,
      lastPrice,
      change,
      high: max,
      low: min,
    };
  }, [data, width, height, color]);

  if (loading || !chartData) {
    return (
      <View style={[styles.container, { width, height: Math.max(height, MIN_CHART_HEIGHT) }]}>
        <ActivityIndicator color={colors.accent} size="small" />
        <Text style={styles.loadingText}>Loading chart…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0%"
              stopColor={chartData.lineColor}
              stopOpacity={0.3}
            />
            <Stop
              offset="100%"
              stopColor={chartData.lineColor}
              stopOpacity={0}
            />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {chartData.gridYs.map((y, i) => (
          <Line
            key={i}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            stroke={colors.border}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}

        {/* Fill area */}
        <Path d={chartData.fillPath} fill="url(#chartGrad)" />

        {/* Price line */}
        <Path
          d={chartData.linePath}
          fill="none"
          stroke={chartData.lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>

      {/* Overlay labels */}
      <View style={styles.overlay}>
        <View style={styles.priceRow}>
          <Text style={styles.highLow}>
            H: ${chartData.high.toFixed(chartData.high < 1 ? 6 : 2)}
          </Text>
          <Text style={styles.highLow}>
            L: ${chartData.low.toFixed(chartData.low < 1 ? 6 : 2)}
          </Text>
        </View>
        <View style={styles.changeRow}>
          <Text
            style={[
              styles.changeBadge,
              {
                color: chartData.isUp ? colors.long : colors.short,
                backgroundColor: chartData.isUp
                  ? colors.longSubtle
                  : colors.shortSubtle,
              },
            ]}
          >
            {chartData.isUp ? '▲' : '▼'} {Math.abs(chartData.change).toFixed(2)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgInset,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  overlay: {
    position: 'absolute',
    top: 4,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  highLow: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  changeRow: {
    alignItems: 'flex-end',
  },
  changeBadge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
});
