import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../constants/theme';

interface LineSeries {
  key: string;
  label: string;
  color: string;
}

interface MobileLineChartProps {
  data: any[];
  xKey: string;
  series: LineSeries[];
  height?: number;
  currencyPrefix?: string;
}

interface ChartPoint {
  x: number;
  y: number;
}

function getNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatShortDate(value: unknown): string {
  const raw = String(value ?? '');
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 6);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatAxisValue(value: number, prefix: string): string {
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(0)}K`;
  return `${prefix}${Math.round(value)}`;
}

function getLabelIndexes(length: number): number[] {
  if (length <= 1) return length === 1 ? [0] : [];
  const steps = Math.min(4, length - 1);
  return Array.from({ length: steps + 1 }, (_, index) => Math.round((index / steps) * (length - 1)))
    .filter((value, index, list) => list.indexOf(value) === index);
}

function createSmoothPath(points: ChartPoint[]): string {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;

    path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

function createAreaPath(points: ChartPoint[], baselineY: number): string {
  if (!points.length) return '';

  const linePath = createSmoothPath(points);
  const last = points[points.length - 1];
  const first = points[0];

  return `${linePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

export function MobileLineChart({
  data,
  xKey,
  series,
  height = 220,
  currencyPrefix = '$',
}: MobileLineChartProps) {
  const rows = Array.isArray(data) ? data : [];
  const chartWidth = Math.max(Dimensions.get('window').width - 64, 280);
  const padLeft = 42;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 42;
  const innerW = chartWidth - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  if (rows.length === 0 || series.length === 0) {
    return (
      <View style={[s.emptyState, { height }]}>
        <Text style={s.emptyText}>No revenue trend data available.</Text>
      </View>
    );
  }

  const maxY = Math.max(
    1,
    ...rows.flatMap((row) => series.map((item) => getNumber(row[item.key]))),
  );
  const labelIndexes = getLabelIndexes(rows.length);

  const getPoint = (row: any, index: number, key: string) => {
    const x = padLeft + (rows.length <= 1 ? 0 : (index / (rows.length - 1)) * innerW);
    const y = padTop + (1 - getNumber(row[key]) / maxY) * innerH;
    return { x, y };
  };

  return (
    <View>
      <Svg width={chartWidth} height={height}>
        <G>
          {[0, 0.5, 1].map((ratio) => {
            const y = padTop + ratio * innerH;
            const value = maxY * (1 - ratio);
            return (
              <G key={`grid-${ratio}`}>
                <Line
                  x1={padLeft}
                  x2={chartWidth - padRight}
                  y1={y}
                  y2={y}
                  stroke={COLORS.border}
                  strokeWidth={1}
                />
                <SvgText
                  x={padLeft - 8}
                  y={y + 4}
                  fill={COLORS.textMuted}
                  fontSize={10}
                  fontWeight="700"
                  textAnchor="end"
                >
                  {formatAxisValue(value, currencyPrefix)}
                </SvgText>
              </G>
            );
          })}

          <Path
            d={`M ${padLeft} ${padTop} L ${padLeft} ${padTop + innerH} L ${chartWidth - padRight} ${padTop + innerH}`}
            fill="none"
            stroke={COLORS.border}
            strokeWidth={1}
          />

          {series.map((item) => {
            const points = rows.map((row, index) => getPoint(row, index, item.key));
            const linePath = createSmoothPath(points);
            const areaPath = createAreaPath(points, padTop + innerH);

            return (
              <G key={`line-${item.key}`}>
                <Path
                  d={areaPath}
                  fill={item.color}
                  fillOpacity={0.16}
                />
                <Path
                  d={linePath}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={2.75}
                  strokeOpacity={1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {rows.map((row, index) => {
                  const point = getPoint(row, index, item.key);
                  return (
                    <G key={`point-${item.key}-${String(row[xKey] ?? index)}-${index}`}>
                      <Circle
                        cx={point.x}
                        cy={point.y}
                        r={7}
                        fill={item.color}
                        opacity={0.2}
                      />
                      <Circle
                        cx={point.x}
                        cy={point.y}
                        r={3}
                        fill={item.color}
                      />
                    </G>
                  );
                })}
              </G>
            );
          })}

          {labelIndexes.map((index) => {
            const x = padLeft + (rows.length <= 1 ? 0 : (index / (rows.length - 1)) * innerW);
            return (
              <SvgText
                key={`x-label-${String(rows[index]?.[xKey] ?? index)}-${index}`}
                x={x}
                y={height - 13}
                fill={COLORS.textMuted}
                fontSize={10}
                fontWeight="700"
                textAnchor="middle"
              >
                {formatShortDate(rows[index]?.[xKey])}
              </SvgText>
            );
          })}
        </G>
      </Svg>

      <View style={s.legend}>
        {series.map((item) => (
          <View key={`legend-${item.key}`} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: item.color }]} />
            <Text style={s.legendText} numberOfLines={1}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  emptyState: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4, paddingTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', maxWidth: '48%' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  legendText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800' },
});
