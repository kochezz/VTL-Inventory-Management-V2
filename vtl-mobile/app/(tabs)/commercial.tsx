import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import api, {
  CommercialSummary, CommercialTodayStats,
  CommercialVoidStats, CommercialOpenPos, CommercialTopProduct,
  CommercialPaymentMethod, CommercialCustomerSplit,
} from '../../services/api';
import { COLORS, RADIUS, SHADOW, formatCurrency } from '../../constants/theme';
import { SkeletonCard, SkeletonKpi, SkeletonRow } from '../../components/SkeletonLoader';
import { MonthComparisonChart } from '../../components/MonthComparisonChart';
import { MiniBarChart } from '../../components/MiniBarChart';

// ── Helpers ──────────────────────────────────────────────────────────────────

function n(val: unknown): number { return Number(val) || 0; }

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeaderWrap}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function KpiCard({
  label, value, color = COLORS.text, width, trend,
}: {
  label: string;
  value: string;
  color?: string;
  width?: string | number;
  trend?: number | null;
}) {
  const trendColor = trend == null ? COLORS.muted
    : trend > 0 ? COLORS.green
    : trend < 0 ? COLORS.red
    : COLORS.muted;
  return (
    <View style={[
      s.kpiCard, SHADOW.card,
      width != null ? { width: width as any } : { flex: 1 },
    ]}>
      <Text style={[s.kpiValue, { color }]}>{value}</Text>
      {trend != null && (
        <Text style={[s.kpiTrend, { color: trendColor }]}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
        </Text>
      )}
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

function ProductRankList({
  products, barColor, emptyText, formatRevenue = formatCurrency,
}: {
  products: CommercialTopProduct[];
  barColor: string;
  emptyText: string;
  formatRevenue?: (v: number) => string;
}) {
  if ((products ?? []).length === 0) {
    return <Text style={s.emptyText}>{emptyText}</Text>;
  }
  const maxRev = Math.max(...(products ?? []).map(p => n(p.revenue)), 1);
  return (
    <View style={[s.card, SHADOW.card]}>
      {(products ?? []).map((p, i) => (
        <View
          key={(p.sku ?? '') + i}
          style={[s.productRow, i < (products ?? []).length - 1 && s.rowDivider]}
        >
          <View style={s.productLeft}>
            <View style={s.productNameRow}>
              <Text style={[s.rankNum, { color: barColor }]}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.productName}>{p.product_name ?? ''}</Text>
                <Text style={s.productSku}>
                  {(p.sku ?? '') || 'No SKU'} · {n(p.units_sold)} units
                </Text>
              </View>
            </View>
            <View style={s.prodBarTrack}>
              <View
                style={[
                  s.prodBarFill,
                  { width: `${Math.round((n(p.revenue) / maxRev) * 100)}%` as any, backgroundColor: barColor },
                ]}
              />
            </View>
          </View>
          <Text style={[s.productRev, { color: barColor }]}>
            {formatRevenue(n(p.revenue))}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialScreen() {
  const [activeTab, setActiveTab] = useState<'revenue' | 'products'>('revenue');
  const [currency, setCurrency] = useState<'USD' | 'ZMW'>('USD');

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
    prev_monthly_stats = {},
    monthly_comparison = [],
    weekly_comparison = [],
    top_products = [],
    prev_top_products = [],
    void_stats = {} as CommercialVoidStats,
    zero_stock = [],
    open_pos = {} as CommercialOpenPos,
    payment_breakdown = [] as CommercialPaymentMethod[],
    customer_split = {} as CommercialCustomerSplit,
    mom_revenue_change_pct = null,
    mom_txn_change_pct = null,
    exchange_rate: rawExchangeRate = 27,
  } = (data ?? {}) as Partial<CommercialSummary>;

  const exchangeRate = Number(rawExchangeRate) || 27;

  const formatAmount = (usdValue: number): string => {
    const val = Number(usdValue) || 0;
    if (currency === 'ZMW') {
      return 'K ' + (val * exchangeRate).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    }
    return '$' + val.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  };

  // Month labels derived from comparison data (fallback to JS date)
  const currentMonthLabel =
    (monthly_comparison ?? [])[1]?.month_label ??
    new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
  const prevMonthLabel =
    (monthly_comparison ?? [])[0]?.month_label ??
    new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toLocaleString('en-US', { month: 'short', year: 'numeric' });

  // Weekly bar chart data for MiniBarChart
  const weeklyBarData = (weekly_revenue ?? []).map(d => ({
    label: fmtDate(d.sale_date),
    value: n(d.revenue),
  }));

  // Hero card MoM colours
  const momColor =
    mom_revenue_change_pct == null ? COLORS.muted
    : mom_revenue_change_pct > 0  ? COLORS.green
    : mom_revenue_change_pct < 0  ? COLORS.red
    : COLORS.muted;

  // SKU comparison — union of both months' SKUs, capped at 6
  const allSkus = [
    ...new Set([
      ...(top_products ?? []).map(p => p.sku).filter(Boolean),
      ...(prev_top_products ?? []).map(p => p.sku).filter(Boolean),
    ]),
  ].slice(0, 6) as string[];

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

        {/* ── Currency toggle ──────────────────────────────────────────────── */}
        <View style={s.currencyRow}>
          <Text style={s.currencyLabel}>Currency:</Text>
          {(['USD', 'ZMW'] as const).map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => setCurrency(c)}
              style={[
                s.currencyBtn,
                currency === c && { backgroundColor: c === 'USD' ? COLORS.sky : COLORS.teal, borderColor: c === 'USD' ? COLORS.sky : COLORS.teal },
              ]}
            >
              <Text style={[s.currencyBtnText, currency === c && s.currencyBtnTextActive]}>
                {c === 'USD' ? '$ USD' : 'K ZMW'}
              </Text>
            </TouchableOpacity>
          ))}
          {currency === 'ZMW' && (
            <Text style={s.exchangeRateText}>@{exchangeRate.toFixed(2)}</Text>
          )}
        </View>

        {/* ── Tab switcher ─────────────────────────────────────────────────── */}
        <View style={s.tabRow}>
          {(['revenue', 'products'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {tab === 'revenue' ? 'Revenue' : 'Products'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ════════════════════════════════════════════════════════════════════
            REVENUE TAB
            ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'revenue' && (
          <>
            {/* ── Today hero card ─────────────────────────────────────────── */}
            <SectionHeader title="Today" />
            <View style={[s.heroCard, SHADOW.card]}>
              <Text style={s.heroRevenue}>
                {formatAmount(n(today_stats?.today_revenue))}
              </Text>
              {/* MoM change */}
              {mom_revenue_change_pct !== null ? (
                <View style={s.momRow}>
                  <Text style={[s.momText, { color: momColor }]}>
                    {mom_revenue_change_pct > 0 ? '↑' : mom_revenue_change_pct < 0 ? '↓' : '→'}{' '}
                    {Math.abs(mom_revenue_change_pct)}% vs {prevMonthLabel}
                  </Text>
                  <View style={[s.momPill, { backgroundColor: momColor + '26', borderColor: momColor }]}>
                    <Text style={[s.momPillText, { color: momColor }]}>MoM</Text>
                  </View>
                </View>
              ) : (
                <Text style={s.momFirstData}>— First month of data</Text>
              )}
              {/* Stat pills row */}
              <View style={s.statPillsRow}>
                {[
                  `Txns: ${n(today_stats?.today_transactions)}`,
                  `Avg: ${formatAmount(n(today_stats?.avg_order_value))}`,
                  `Walk-in: ${n(today_stats?.walkin_count)}`,
                  `B2B: ${n(today_stats?.b2b_count)}`,
                ].map(label => (
                  <View key={label} style={s.statPill}>
                    <Text style={s.statPillText}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Month vs Month comparison chart ─────────────────────────── */}
            <SectionHeader
              title="Month vs Month"
              subtitle={`${prevMonthLabel} → ${currentMonthLabel}`}
            />
            <View style={[s.card, SHADOW.card, { padding: 16, marginBottom: 4 }]}>
              <MonthComparisonChart
                currentMonth={{
                  label: currentMonthLabel,
                  revenue: parseFloat(String((monthly_stats as any)?.month_revenue)) || 0,
                }}
                previousMonth={{
                  label: prevMonthLabel,
                  revenue: parseFloat(String((prev_monthly_stats as any)?.month_revenue)) || 0,
                }}
                weeklyData={weekly_comparison ?? []}
                currentColor={COLORS.sky}
                previousColor={COLORS.teal}
                currency={currency}
                exchangeRate={exchangeRate}
              />
            </View>

            {/* ── Last 7 Days (MiniBarChart) ───────────────────────────────── */}
            <SectionHeader title="Last 7 Days" subtitle="daily rolling revenue" />
            {weeklyBarData.length === 0 ? (
              <Text style={s.emptyText}>No sales in the last 7 days.</Text>
            ) : (
              <View style={[s.card, SHADOW.card, { padding: 12, paddingBottom: 6 }]}>
                <MiniBarChart data={weeklyBarData} color={COLORS.sky} height={100} />
              </View>
            )}

            {/* ── Monthly 2×2 KPI grid ─────────────────────────────────────── */}
            <SectionHeader title="Monthly Comparison" />
            <View style={s.kpiGrid}>
              <KpiCard
                label={`${currentMonthLabel} Revenue`}
                value={formatAmount(n((monthly_stats as any)?.month_revenue))}
                color={COLORS.sky}
                width="48%"
                trend={mom_revenue_change_pct}
              />
              <KpiCard
                label={`${currentMonthLabel} Txns`}
                value={String(n((monthly_stats as any)?.month_transactions))}
                color={COLORS.green}
                width="48%"
                trend={mom_txn_change_pct}
              />
              <KpiCard
                label={`${prevMonthLabel} Revenue`}
                value={formatAmount(n((prev_monthly_stats as any)?.month_revenue))}
                color={COLORS.teal}
                width="48%"
              />
              <KpiCard
                label={`${prevMonthLabel} Txns`}
                value={String(n((prev_monthly_stats as any)?.month_transactions))}
                color={COLORS.purple}
                width="48%"
              />
            </View>

            {/* ── Payment Methods ──────────────────────────────────────────── */}
            <SectionHeader title="Payment Methods" subtitle="this month" />
            {(payment_breakdown ?? []).length === 0 ? (
              <Text style={s.emptyText}>No payment data this month.</Text>
            ) : (
              <View style={[s.card, SHADOW.card]}>
                {(payment_breakdown ?? []).map((pm, i) => {
                  const label = {
                    CASH_USD: '💵 Cash (USD)',
                    CASH_ZMW: '💴 Cash (ZMW)',
                    MOBILE_MONEY: '📱 Mobile Money',
                    BANK_TRANSFER: '🏦 Bank Transfer',
                  }[(pm.payment_method ?? '') as string] ?? pm.payment_method;
                  return (
                    <View
                      key={pm.payment_method}
                      style={[s.pmRow, i < (payment_breakdown ?? []).length - 1 && s.rowDivider]}
                    >
                      <Text style={s.pmLabel}>{label}</Text>
                      <Text style={s.pmTxns}>{n(pm.transaction_count)} txns</Text>
                      <Text style={s.pmRevUsd}>{formatAmount(n(pm.revenue_usd))}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Customer Split ────────────────────────────────────────────── */}
            <SectionHeader title="Customer Split" subtitle="B2B vs Walk-in this month" />
            <View style={s.kpiRow}>
              <View style={[s.splitCard, SHADOW.card, { borderColor: COLORS.purple + '66' }]}>
                <Text style={[s.splitValue, { color: COLORS.purple }]}>
                  {formatAmount(n(customer_split?.b2b_revenue))}
                </Text>
                <Text style={s.splitOrders}>{n(customer_split?.b2b_count)} orders</Text>
                <Text style={s.splitLabel}>B2B Revenue</Text>
              </View>
              <View style={[s.splitCard, SHADOW.card, { borderColor: COLORS.sky + '66' }]}>
                <Text style={[s.splitValue, { color: COLORS.sky }]}>
                  {formatAmount(n(customer_split?.walkin_revenue))}
                </Text>
                <Text style={s.splitOrders}>{n(customer_split?.walkin_count)} orders</Text>
                <Text style={s.splitLabel}>Walk-in Revenue</Text>
              </View>
            </View>

            {/* ── Void Rate ────────────────────────────────────────────────── */}
            <SectionHeader title="Void Rate (This Month)" />
            <View style={[s.card, s.voidCard, SHADOW.card]}>
              <View style={s.voidStat}>
                <Text style={[s.voidNum, { color: n(void_stats?.void_rate_pct) > 5 ? COLORS.red : COLORS.green }]}>
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

            {/* ── Zero Stock ───────────────────────────────────────────────── */}
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

            {/* ── Open POs ─────────────────────────────────────────────────── */}
            <SectionHeader title="Open Purchase Orders" />
            <View style={s.kpiRow}>
              <KpiCard label="Open POs" value={String(n(open_pos?.open_pos))} color={COLORS.amber} />
              <KpiCard label="PO Value" value={formatAmount(n(open_pos?.po_value))} color={COLORS.amber} />
            </View>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PRODUCTS TAB
            ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'products' && (
          <>
            {/* ── Current month ────────────────────────────────────────────── */}
            <SectionHeader title="Top Products This Month" subtitle={currentMonthLabel} />
            <ProductRankList
              products={top_products ?? []}
              barColor={COLORS.sky}
              emptyText="No product sales recorded this month."
              formatRevenue={formatAmount}
            />

            {/* ── Previous month ───────────────────────────────────────────── */}
            <SectionHeader
              title={`Previous Month — ${prevMonthLabel}`}
              subtitle="top products by revenue"
            />
            <ProductRankList
              products={prev_top_products ?? []}
              barColor={COLORS.teal}
              emptyText={`📊 No product data for ${prevMonthLabel}`}
              formatRevenue={formatAmount}
            />

            {/* ── SKU comparison ───────────────────────────────────────────── */}
            <SectionHeader title="SKU Comparison" subtitle="current vs previous month" />
            {allSkus.length === 0 ? (
              <Text style={s.emptyText}>No product data to compare.</Text>
            ) : (
              <View style={[s.card, SHADOW.card]}>
                {allSkus.map((sku, i) => {
                  const curr = (top_products ?? []).find(p => p.sku === sku);
                  const prev = (prev_top_products ?? []).find(p => p.sku === sku);
                  const currRev = n(curr?.revenue);
                  const prevRev = n(prev?.revenue);
                  const diff = currRev - prevRev;
                  const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
                  const arrowColor = diff > 0 ? COLORS.green : diff < 0 ? COLORS.red : COLORS.muted;
                  const name = curr?.product_name ?? prev?.product_name ?? sku;
                  return (
                    <View key={sku} style={[s.skuRow, i < allSkus.length - 1 && s.rowDivider]}>
                      <Text style={s.skuName} numberOfLines={1}>{name}</Text>
                      <Text style={s.skuCurr}>{formatAmount(currRev)}</Text>
                      <Text style={s.skuVs}>vs</Text>
                      <Text style={s.skuPrev}>{formatAmount(prevRev)}</Text>
                      <Text style={[s.skuArrow, { color: arrowColor }]}>{arrow}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

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
  screenTitle: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 8 },

  // Currency toggle
  currencyRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingVertical: 8, gap: 8, marginBottom: 4 },
  currencyLabel:       { color: COLORS.muted, fontSize: 12 },
  currencyBtn:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },
  currencyBtnText:     { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  currencyBtnTextActive: { color: '#fff' },
  exchangeRateText:    { color: COLORS.muted, fontSize: 10 },

  // Tabs
  tabRow:        { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tab:           { flex: 1, paddingVertical: 9, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.surface },
  tabActive:     { backgroundColor: COLORS.sky, borderColor: COLORS.sky },
  tabText:       { color: COLORS.muted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#fff', fontWeight: '700' },

  // Section header
  sectionHeaderWrap: { marginTop: 24, marginBottom: 10 },
  sectionTitle:      { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  sectionSubtitle:   { color: COLORS.muted, fontSize: 12, marginTop: 2 },

  emptyText:  { color: COLORS.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.border },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  // KPI
  kpiRow:  { flexDirection: 'row', gap: 10 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  kpiValue: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  kpiTrend: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  kpiLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Hero card
  heroCard:     {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  heroRevenue:  { fontSize: 32, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 2 },
  heroRevZmw:   { fontSize: 14, color: COLORS.muted, marginBottom: 8 },
  statPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  statPill:     { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 },
  statPillText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },

  // MoM hero indicator
  momRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  momText:     { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  momPill:     { borderWidth: 1, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  momPillText: { fontSize: 10, fontWeight: '700' },
  momFirstData:{ color: COLORS.muted, fontSize: 12, fontStyle: 'italic', marginBottom: 4 },

  // Products
  productRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  productNameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  productLeft:    { flex: 1, marginRight: 12 },
  productName:    { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  productSku:     { color: COLORS.muted, fontSize: 12 },
  productRev:     { fontSize: 14, fontWeight: '700' },
  rankNum:        { fontSize: 13, fontWeight: '800', width: 18 },
  prodBarTrack:   { height: 3, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  prodBarFill:    { height: '100%' as any, borderRadius: 2 },

  // Void Rate
  voidCard:    { flexDirection: 'row', padding: 16 },
  voidStat:    { flex: 1, alignItems: 'center' },
  voidNum:     { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  voidLabel:   { color: COLORS.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  voidDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  // Zero Stock
  zeroRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  outPill:     { backgroundColor: COLORS.red + '22', borderWidth: 1, borderColor: COLORS.red, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  outPillText: { color: COLORS.red, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  // SKU comparison
  skuRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  skuName:  { flex: 1, color: COLORS.text, fontSize: 12 },
  skuCurr:  { color: COLORS.sky, fontSize: 12, fontWeight: '700', width: 70, textAlign: 'right' },
  skuVs:    { color: COLORS.muted, fontSize: 10, width: 20, textAlign: 'center' },
  skuPrev:  { color: COLORS.teal, fontSize: 12, fontWeight: '700', width: 70, textAlign: 'right' },
  skuArrow: { fontSize: 14, fontWeight: '700', width: 16, textAlign: 'center' },

  // Payment methods
  pmRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  pmLabel:   { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: '600' },
  pmTxns:    { color: COLORS.muted, fontSize: 12, marginRight: 10 },
  pmRight:   { alignItems: 'flex-end' },
  pmRevUsd:  { color: COLORS.sky, fontSize: 13, fontWeight: '700' },
  pmRevZmw:  { color: COLORS.muted, fontSize: 11 },

  // Customer split
  splitCard:   {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 14,
  },
  splitValue:  { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  splitOrders: { color: COLORS.muted, fontSize: 12, marginBottom: 6 },
  splitLabel:  { color: COLORS.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Error / retry
  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
