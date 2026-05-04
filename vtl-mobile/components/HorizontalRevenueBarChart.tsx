import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SHADOW, formatCurrency } from '../constants/theme';
import type { HomeRevenueBySku } from '../services/api';

interface HorizontalRevenueBarChartProps {
  data: HomeRevenueBySku[];
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

export function HorizontalRevenueBarChart({ data }: HorizontalRevenueBarChartProps) {
  const rows = Array.isArray(data) ? data.slice(0, 8) : [];
  const maxRevenue = Math.max(1, ...rows.map((row) => getNumber(row.revenue)));

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View>
          <Text style={s.eyebrow}>Revenue by SKU</Text>
          <Text style={s.title}>Top Products by Sales Value</Text>
        </View>
        <Text style={s.rangeLabel}>Top {rows.length || 0}</Text>
      </View>

      {rows.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>No SKU revenue data available.</Text>
        </View>
      ) : (
        rows.map((item, index) => {
          const revenue = getNumber(item.revenue);
          const widthPct = Math.max(6, Math.round((revenue / maxRevenue) * 100));
          const sku = item.sku ?? 'SKU';
          const productName = item.product_name ?? 'Product';

          return (
            <View key={`sku-revenue-${sku}-${index}`} style={s.row}>
              <View style={s.rowTop}>
                <View style={s.productBlock}>
                  <Text style={s.skuText} numberOfLines={1}>{sku}</Text>
                  <Text style={s.productText} numberOfLines={1}>{productName}</Text>
                </View>
                <View style={s.valueBlock}>
                  <Text style={s.revenueText}>{compactCurrency(revenue)}</Text>
                  <Text style={s.unitsText}>{getNumber(item.units_sold)} units</Text>
                </View>
              </View>
              <View style={s.track}>
                <View
                  style={[
                    s.bar,
                    {
                      width: `${widthPct}%`,
                      backgroundColor: COLORS.chart[index % COLORS.chart.length],
                    },
                  ]}
                />
              </View>
            </View>
          );
        })
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
    ...SHADOW.card,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  eyebrow: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '900', marginTop: 4 },
  rangeLabel: { color: COLORS.green, fontSize: 11, fontWeight: '900' },
  row: { marginBottom: 13 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  productBlock: { flex: 1 },
  skuText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '900' },
  productText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', marginTop: 2 },
  valueBlock: { alignItems: 'flex-end' },
  revenueText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '900' },
  unitsText: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', marginTop: 2 },
  track: {
    height: 9,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 8,
  },
  bar: { height: '100%', borderRadius: 6 },
  emptyState: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
});
