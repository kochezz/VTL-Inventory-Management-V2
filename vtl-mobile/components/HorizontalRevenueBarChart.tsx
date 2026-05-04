import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, formatCurrency } from '../constants/theme';
import type { HomeRevenueBySku } from '../services/api';

interface HorizontalRevenueBarChartProps {
  data: any[];
  maxItems?: number;
  currencyPrefix?: string;
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

export function HorizontalRevenueBarChart({
  data,
  maxItems = 8,
  currencyPrefix = '$',
}: HorizontalRevenueBarChartProps) {
  const rows = (Array.isArray(data) ? data : [])
    .slice()
    .sort((a: HomeRevenueBySku, b: HomeRevenueBySku) => getNumber(b.revenue) - getNumber(a.revenue))
    .slice(0, maxItems);
  const maxRevenue = Math.max(1, ...rows.map((row) => getNumber(row.revenue)));

  return (
    <View>
      {rows.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>No SKU revenue data available.</Text>
        </View>
      ) : (
        rows.map((item, index) => {
          const revenue = getNumber(item.revenue);
          const widthPct = Math.max(6, Math.round((revenue / maxRevenue) * 100));
          const sku = item.sku ?? '';
          const productName = item.product_name ?? 'Product';
          const label = sku || productName;
          const colors = Array.isArray(COLORS.chart) && COLORS.chart.length > 0 ? COLORS.chart : [COLORS.sky];

          return (
            <View key={`sku-revenue-${sku || productName}-${index}`} style={s.row}>
              <View style={s.labelBlock}>
                <Text style={s.skuText} numberOfLines={1} ellipsizeMode="tail">{label}</Text>
                <Text style={s.productText} numberOfLines={1} ellipsizeMode="tail">{productName}</Text>
              </View>
              <View style={s.barBlock}>
                <View style={s.track}>
                  <View
                    style={[
                      s.bar,
                      {
                        width: `${widthPct}%`,
                        backgroundColor: colors[index % colors.length],
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={s.valueBlock}>
                <Text style={s.revenueText} numberOfLines={1}>
                  {compactCurrency(revenue).replace('$', currencyPrefix)}
                </Text>
                <Text style={s.unitsText} numberOfLines={1}>{getNumber(item.units_sold)} units</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 13 },
  labelBlock: { width: 86 },
  skuText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '900' },
  productText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700', marginTop: 2 },
  barBlock: { flex: 1 },
  valueBlock: { width: 72, alignItems: 'flex-end' },
  revenueText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '900' },
  unitsText: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', marginTop: 2 },
  track: {
    height: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 6,
    overflow: 'hidden',
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
