import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import api, {
  CommercialTodayStats, CommercialVoidStats, CommercialOpenPos,
} from '../../services/api';
import { COLORS, RADIUS, SHADOW, formatCurrency } from '../../constants/theme';
import { SkeletonCard, SkeletonKpi, SkeletonRow } from '../../components/SkeletonLoader';

// ── Helpers ──────────────────────────────────────────────────────────────────

function n(val: unknown): number {
  return Number(val) || 0;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

function KpiCard({ label, value, color = COLORS.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={[s.kpiCard, SHADOW.card]}>
      <Text style={[s.kpiValue, { color }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialScreen() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['commercial'],
    queryFn: api.getCommercial,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.loadContent}>
          <SkeletonCard />
          <View style={s.kpiRow}>
            <SkeletonKpi />
            <SkeletonKpi />
          </View>
          <SkeletonCard />
          <SkeletonRow style={{ marginTop: 8 }} />
          <SkeletonRow style={{ marginTop: 8 }} />
          <SkeletonRow style={{ marginTop: 8 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}>
          <Text style={s.errorText}>Failed to load commercial data.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const {
    today_stats = {} as CommercialTodayStats,
    weekly_revenue = [],
    monthly_stats = {},
    top_products = [],
    void_stats = {} as CommercialVoidStats,
    zero_stock = [],
    open_pos = {} as CommercialOpenPos,
  } = data ?? {};

  const weekMax = Math.max(...(weekly_revenue ?? []).map(d => n(d.revenue)), 1);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={COLORS.sky} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.screenTitle}>Commercial</Text>

        {/* ── Today ──────────────────────────────────────────────────────────── */}
        <SectionHeader title="Today" />
        <View style={s.kpiRow}>
          <KpiCard
            label="Revenue"
            value={formatCurrency(n(today_stats?.today_revenue))}
            color={COLORS.green}
          />
          <KpiCard
            label="Transactions"
            value={String(n(today_stats?.today_transactions))}
            color={COLORS.sky}
          />
        </View>
        <View style={[s.kpiRow, { marginTop: 10 }]}>
          <KpiCard
            label="Avg Order"
            value={formatCurrency(n(today_stats?.avg_order_value))}
          />
          <KpiCard
            label="Walk-ins"
            value={String(n(today_stats?.walkin_count))}
          />
        </View>

        {/* ── This Month ─────────────────────────────────────────────────────── */}
        <SectionHeader title="This Month" />
        <View style={s.kpiRow}>
          <KpiCard
            label="Revenue"
            value={formatCurrency(n((monthly_stats as any)?.month_revenue))}
            color={COLORS.teal}
          />
          <KpiCard
            label="Transactions"
            value={String(n((monthly_stats as any)?.month_transactions))}
            color={COLORS.sky}
          />
        </View>

        {/* ── Weekly Revenue ─────────────────────────────────────────────────── */}
        <SectionHeader title="Last 7 Days" />
        {(weekly_revenue ?? []).length === 0 ? (
          <Text style={s.emptyText}>No sales in the last 7 days.</Text>
        ) : (
          <View style={[s.card, SHADOW.card]}>
            {(weekly_revenue ?? []).map((day, i) => (
              <View
                key={day.sale_date}
                style={[s.weekRow, i < (weekly_revenue ?? []).length - 1 && s.rowDivider]}
              >
                <Text style={s.weekDate}>{fmtDate(day.sale_date)}</Text>
                <View style={s.weekBarTrack}>
                  <View
                    style={[
                      s.weekBarFill,
                      { width: `${Math.round((n(day.revenue) / weekMax) * 100)}%` as any },
                    ]}
                  />
                </View>
                <Text style={s.weekRev}>{formatCurrency(n(day.revenue))}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Top Products ───────────────────────────────────────────────────── */}
        <SectionHeader title="Top Products This Month" />
        {(top_products ?? []).length === 0 ? (
          <Text style={s.emptyText}>No product sales recorded this month.</Text>
        ) : (
          <View style={[s.card, SHADOW.card]}>
            {(top_products ?? []).map((p, i) => (
              <View
                key={(p.sku ?? '') + i}
                style={[s.productRow, i < (top_products ?? []).length - 1 && s.rowDivider]}
              >
                <View style={s.productLeft}>
                  <Text style={s.productName}>{p.product_name ?? ''}</Text>
                  <Text style={s.productSku}>
                    {(p.sku ?? '') || 'No SKU'} · {n(p.units_sold)} units
                  </Text>
                </View>
                <Text style={[s.productRev, { color: COLORS.green }]}>
                  {formatCurrency(n(p.revenue))}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Void Rate ──────────────────────────────────────────────────────── */}
        <SectionHeader title="Void Rate (This Month)" />
        <View style={[s.card, s.voidCard, SHADOW.card]}>
          <View style={s.voidStat}>
            <Text
              style={[
                s.voidNum,
                { color: n(void_stats?.void_rate_pct) > 5 ? COLORS.red : COLORS.green },
              ]}
            >
              {n(void_stats?.void_rate_pct).toFixed(1)}%
            </Text>
            <Text style={s.voidLabel}>Void Rate</Text>
          </View>
          <View style={s.voidDivider} />
          <View style={s.voidStat}>
            <Text style={s.voidNum}>{n(void_stats?.voided)}</Text>
            <Text style={s.voidLabel}>Voided</Text>
          </View>
          <View style={s.voidDivider} />
          <View style={s.voidStat}>
            <Text style={s.voidNum}>{n(void_stats?.total)}</Text>
            <Text style={s.voidLabel}>Total</Text>
          </View>
        </View>

        {/* ── Zero Stock ─────────────────────────────────────────────────────── */}
        <SectionHeader title={`Zero Stock (${(zero_stock ?? []).length})`} />
        {(zero_stock ?? []).length === 0 ? (
          <Text style={s.emptyText}>All products have stock.</Text>
        ) : (
          <View style={[s.card, SHADOW.card]}>
            {(zero_stock ?? []).map((p, i) => (
              <View
                key={(p.sku ?? '') + i}
                style={[s.zeroRow, i < (zero_stock ?? []).length - 1 && s.rowDivider]}
              >
                <View style={s.productLeft}>
                  <Text style={s.productName}>{p.product_name ?? ''}</Text>
                  <Text style={s.productSku}>{(p.sku ?? '') || 'No SKU'}</Text>
                </View>
                <View style={s.outPill}>
                  <Text style={s.outPillText}>OUT</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Open POs ───────────────────────────────────────────────────────── */}
        <SectionHeader title="Open Purchase Orders" />
        <View style={s.kpiRow}>
          <KpiCard
            label="Open POs"
            value={String(n(open_pos?.open_pos))}
            color={COLORS.amber}
          />
          <KpiCard
            label="PO Value"
            value={formatCurrency(n(open_pos?.po_value))}
            color={COLORS.amber}
          />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.bg },
  scroll:      { flex: 1 },
  content:     { paddingHorizontal: 16, paddingTop: 16 },
  loadContent: { padding: 16, gap: 12 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  screenTitle: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  sectionTitle:{ color: COLORS.text, fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 10 },
  emptyText:   { color: COLORS.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  rowDivider:  { borderBottomWidth: 1, borderBottomColor: COLORS.border },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  kpiRow:   { flexDirection: 'row', gap: 10 },
  kpiCard:  {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  kpiValue: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  kpiLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  weekRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  weekDate:    { color: COLORS.muted, fontSize: 12, width: 60 },
  weekBarTrack:{ flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  weekBarFill: { height: '100%' as any, backgroundColor: COLORS.sky, borderRadius: 3 },
  weekRev:     { color: COLORS.text, fontSize: 12, fontWeight: '600', width: 80, textAlign: 'right' },

  productRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  productLeft: { flex: 1, marginRight: 12 },
  productName: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  productSku:  { color: COLORS.muted, fontSize: 12 },
  productRev:  { fontSize: 14, fontWeight: '700' },

  voidCard:    { flexDirection: 'row', padding: 16 },
  voidStat:    { flex: 1, alignItems: 'center' },
  voidNum:     { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  voidLabel:   { color: COLORS.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  voidDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  zeroRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  outPill:     { backgroundColor: COLORS.red + '22', borderWidth: 1, borderColor: COLORS.red, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  outPillText: { color: COLORS.red, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
