import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { COLORS, RADIUS, SHADOW, formatCurrency } from '../constants/theme';
import type { HomeSalesTrendDay } from '../services/api';

interface MobileSalesTrendChartProps {
  data: HomeSalesTrendDay[];
}

function getNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function compactCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return formatCurrency(value);
}

function formatDay(value?: string): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function MobileSalesTrendChart({ data }: MobileSalesTrendChartProps) {
  const [width, setWidth] = useState(0);
  const chartWidth = Math.max(width - 28, 280);
  const chartHeight = 180;
  const padX = 12;
  const padY = 18;
  const innerW = chartWidth - padX * 2;
  const innerH = chartHeight - padY * 2;

  const rows = useMemo(() => (Array.isArray(data) ? data.slice(-30) : []), [data]);
  const totals = rows.reduce(
    (acc, row) => ({
      b2b: acc.b2b + getNumber(row.b2b_revenue),
      walkin: acc.walkin + getNumber(row.walkin_revenue),
    }),
    { b2b: 0, walkin: 0 },
  );
  const maxValue = Math.max(
    1,
    ...rows.map((row) => getNumber(row.b2b_revenue)),
    ...rows.map((row) => getNumber(row.walkin_revenue)),
  );

  const toPoints = (key: 'b2b_revenue' | 'walkin_revenue') => rows.map((row, index) => {
    const x = padX + (rows.length <= 1 ? 0 : (index / (rows.length - 1)) * innerW);
    const y = padY + (1 - getNumber(row[key]) / maxValue) * innerH;
    return { x, y };
  });

  const b2bPoints = toPoints('b2b_revenue');
  const walkinPoints = toPoints('walkin_revenue');
  const b2bLine = b2bPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const walkinLine = walkinPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const latest = rows[rows.length - 1];

  return (
    <View style={s.card} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      <View style={s.headerRow}>
        <View>
          <Text style={s.eyebrow}>Daily Revenue Trend</Text>
          <Text style={s.title}>B2B Accounts vs Walk-in Clients</Text>
        </View>
        <Text style={s.rangeLabel}>{rows.length || 0} days</Text>
      </View>

      {rows.length < 2 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>Not enough revenue trend data yet.</Text>
        </View>
      ) : (
        <>
          <View style={s.chartWrap}>
            <Svg width={chartWidth} height={chartHeight}>
              {[0, 1, 2].map((line) => {
                const y = padY + (line / 2) * innerH;
                return (
                  <Line
                    key={`grid-${line}`}
                    x1={padX}
                    x2={chartWidth - padX}
                    y1={y}
                    y2={y}
                    stroke={COLORS.border}
                    strokeWidth={1}
                  />
                );
              })}
              <Polyline
                points={b2bLine}
                fill="none"
                stroke={COLORS.sky}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Polyline
                points={walkinLine}
                fill="none"
                stroke={COLORS.green}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {b2bPoints.length > 0 && (
                <Circle
                  cx={b2bPoints[b2bPoints.length - 1].x}
                  cy={b2bPoints[b2bPoints.length - 1].y}
                  r={4}
                  fill={COLORS.sky}
                />
              )}
              {walkinPoints.length > 0 && (
                <Circle
                  cx={walkinPoints[walkinPoints.length - 1].x}
                  cy={walkinPoints[walkinPoints.length - 1].y}
                  r={4}
                  fill={COLORS.green}
                />
              )}
            </Svg>
          </View>
          <View style={s.axisRow}>
            <Text style={s.axisText}>{formatDay(rows[0]?.sale_date)}</Text>
            <Text style={s.axisText}>{formatDay(latest?.sale_date)}</Text>
          </View>
          <View style={s.legendRow}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: COLORS.sky }]} />
              <Text style={s.legendLabel}>B2B</Text>
              <Text style={s.legendValue}>{compactCurrency(totals.b2b)}</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: COLORS.green }]} />
              <Text style={s.legendLabel}>Walk-in</Text>
              <Text style={s.legendValue}>{compactCurrency(totals.walkin)}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: 14,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  eyebrow: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '900', marginTop: 4 },
  rangeLabel: { color: COLORS.sky, fontSize: 11, fontWeight: '900' },
  chartWrap: { alignItems: 'center', backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.lg, paddingTop: 6 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 8 },
  axisText: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800' },
  legendRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  legendItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  legendLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', flex: 1 },
  legendValue: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '900' },
  emptyState: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
});
