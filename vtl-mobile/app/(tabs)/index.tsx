import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api, { Alert, DashboardSummary, HomeSalesIntelligence } from '../../services/api';
import { COLORS, RADIUS, SHADOW, timeAgo, zebraRow } from '../../constants/theme';
import { SectionHeader } from '../../components/SectionHeader';
import { SkeletonCard, SkeletonRow } from '../../components/SkeletonLoader';
import VTLAppHeader from '../../components/VTLAppHeader';
import { useHomeSalesIntelligence } from '../../hooks/useHomeSalesIntelligence';
import { MobileLineChart } from '../../components/MobileLineChart';
import { HorizontalRevenueBarChart } from '../../components/HorizontalRevenueBarChart';

type ExecutiveStatus = {
  label: 'Critical' | 'Attention Required' | 'Stable';
  color: string;
  glow: string;
};

const ACTIONS = [
  { icon: 'BCH', label: 'Operations', bg: COLORS.tealGlow, route: '/(tabs)/operations' },
  { icon: 'QMS', label: 'Quality', bg: COLORS.skyGlow, route: '/(tabs)/quality' },
  { icon: 'REV', label: 'Commercial', bg: COLORS.greenGlow, route: '/(tabs)/commercial' },
  { icon: 'PPL', label: 'People', bg: COLORS.purpleGlow, route: '/(tabs)/people' },
];

function getNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getSeverityColor(severity?: string | null): string {
  const sev = (severity ?? '').toUpperCase();
  if (sev === 'HIGH') return COLORS.red;
  if (sev === 'MEDIUM') return COLORS.amber;
  return COLORS.sky;
}

function getSeverityGlow(severity?: string | null): string {
  const sev = (severity ?? '').toUpperCase();
  if (sev === 'HIGH') return COLORS.redGlow;
  if (sev === 'MEDIUM') return COLORS.amberGlow;
  return COLORS.skyGlow;
}

function getExecutiveStatus(dashboard?: DashboardSummary, alerts: Alert[] = []): ExecutiveStatus {
  const hasHigh = alerts.some((a) => a.severity === 'HIGH');
  const hasMedium = alerts.some((a) => a.severity === 'MEDIUM');
  const overdueCapas = getNumber(dashboard?.overdue_capas);
  const openNcrs = getNumber(dashboard?.open_ncrs);
  const lowStock = getNumber(dashboard?.low_stock_items);

  if (hasHigh || overdueCapas > 0) {
    return { label: 'Critical', color: COLORS.red, glow: COLORS.redGlow };
  }
  if (hasMedium || openNcrs > 0 || lowStock > 0) {
    return { label: 'Attention Required', color: COLORS.amber, glow: COLORS.amberGlow };
  }
  return { label: 'Stable', color: COLORS.green, glow: COLORS.greenGlow };
}

function getFinishedProductLowStock(dashboard?: DashboardSummary): number {
  const extended = dashboard as (DashboardSummary & { finished_product_low_stock_items?: number }) | undefined;
  return getNumber(extended?.finished_product_low_stock_items ?? dashboard?.low_stock_items);
}

function normaliseDateKey(value: unknown): string {
  if (!value) return '';
  const d = new Date(value as any);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function getDailyRevenue(sales?: HomeSalesIntelligence): number {
  const salesData = sales as (HomeSalesIntelligence & {
    today_stats?: { today_revenue?: number | string };
    todayRevenue?: number | string;
    today_revenue?: number | string;
  }) | undefined;
  const commercialTodayRevenue = Number(
    salesData?.today_stats?.today_revenue
      ?? salesData?.todayRevenue
      ?? salesData?.today_revenue
      ?? NaN,
  );

  if (Number.isFinite(commercialTodayRevenue)) {
    return Math.ceil(commercialTodayRevenue);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  // Do not use latest dailyTrend point because it may be a previous transaction date.
  const todayTrendPoint = Array.isArray(salesData?.dailyTrend)
    ? salesData.dailyTrend.find((row: any) => normaliseDateKey(row.sale_date) === todayKey)
    : null;
  const calculatedTodayRevenue = todayTrendPoint
    ? Number(
      todayTrendPoint.revenue
        ?? getNumber(todayTrendPoint.b2b_revenue) + getNumber(todayTrendPoint.walkin_revenue),
    )
    : 0;

  return Math.ceil(getNumber(calculatedTodayRevenue));
}

function getUpdatedLabel(alerts: Alert[]): string {
  const latest = alerts.find((a) => a.created_at)?.created_at;
  return latest ? `Updated ${timeAgo(latest)}` : 'Updated just now';
}

function getAlertTarget(item: any): string {
  const type = String(item?.type ?? item?.title ?? '').toLowerCase();

  if (type.includes('batch')) return '/(tabs)/operations';
  if (type.includes('ncr')) return '/(tabs)/quality';
  if (type.includes('capa')) return '/(tabs)/quality';
  if (type.includes('stock')) return '/(tabs)/operations';
  if (type.includes('inventory')) return '/(tabs)/operations';
  if (type.includes('doc')) return '/(tabs)/quality';
  if (type.includes('qms')) return '/(tabs)/quality';
  if (type.includes('sales') || type.includes('revenue') || type.includes('commercial')) return '/(tabs)/commercial';
  if (type.includes('people') || type.includes('user') || type.includes('activity')) return '/(tabs)/people';

  return '/notifications';
}

function BellButton({ hasHighAlert, onPress }: { hasHighAlert: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.bellButton} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.bellText}>!</Text>
      {hasHighAlert && <View style={s.bellDot} />}
    </TouchableOpacity>
  );
}

function SnapshotHero({
  dashboard,
  alerts,
  sales,
  loading,
  onNavigate,
}: {
  dashboard?: DashboardSummary;
  alerts: Alert[];
  sales?: HomeSalesIntelligence;
  loading: boolean;
  onNavigate: (route: string) => void;
}) {
  if (loading) return <SkeletonCard style={s.heroSkeleton} />;

  const status = getExecutiveStatus(dashboard, alerts);
  const activeBatches = getNumber(dashboard?.active_batches);
  const fpLowStock = getFinishedProductLowStock(dashboard);
  const openNcrs = getNumber(dashboard?.open_ncrs);
  const overdueCapas = getNumber(dashboard?.overdue_capas);
  const docsInReview = getNumber(dashboard?.pending_docs_review);
  const dailyRevenue = getDailyRevenue(sales);
  const executiveSnapshotItems = [
    {
      key: 'active_batches',
      label: 'Active Batches',
      value: activeBatches,
      route: '/(tabs)/operations',
      color: COLORS.sky,
    },
    {
      key: 'open_ncrs',
      label: 'Open NCRs',
      value: openNcrs,
      route: '/(tabs)/quality',
      color: COLORS.amber,
    },
    {
      key: 'overdue_capas',
      label: 'Overdue CAPAs',
      value: overdueCapas,
      route: '/(tabs)/quality',
      color: COLORS.red,
    },
    {
      key: 'low_stock_items',
      label: 'Low Stock',
      value: fpLowStock,
      route: '/(tabs)/operations',
      color: COLORS.amber,
    },
    {
      key: 'pending_docs_review',
      label: 'Docs in Review',
      value: docsInReview,
      route: '/(tabs)/quality',
      color: COLORS.sky,
    },
  ].filter((item) => Number(item.value ?? 0) > 0);

  return (
    <View style={[s.heroCard, { borderLeftColor: status.color }]}>
      <View style={[s.heroGlow, { backgroundColor: status.glow }]} pointerEvents="none" />
      <View style={s.heroTop}>
        <View style={s.statusBlock}>
          <Text style={[s.statusLabel, { color: status.color }]}>{status.label}</Text>
          <Text style={s.heroTitle}>Executive Snapshot</Text>
          <Text style={s.updatedText}>{getUpdatedLabel(alerts)}</Text>
        </View>
        <View style={s.revenueDial}>
          <Text style={s.revenueValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
            {`$${dailyRevenue.toLocaleString()}`}
          </Text>
          <Text style={s.revenueLabel}>Daily Revenue</Text>
        </View>
      </View>
      {executiveSnapshotItems.length === 0 ? (
        <View style={s.calmState}>
          <Text style={s.calmText}>No operational alerts requiring attention right now.</Text>
        </View>
      ) : (
        <View style={s.commandRows}>
          {executiveSnapshotItems.map((item) => (
            <CommandRow
              key={item.key}
              label={item.label}
              value={item.value}
              color={item.color}
              onPress={() => onNavigate(item.route)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function CommandRow({
  label,
  value,
  color,
  onPress,
}: {
  label: string;
  value: number | string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.commandRow} onPress={onPress} activeOpacity={0.78}>
      <View style={[s.commandDot, { backgroundColor: color }]} />
      <Text style={s.commandLabel} numberOfLines={1}>{label}</Text>
      <Text style={[s.commandValue, { color }]} numberOfLines={1}>{value}</Text>
    </TouchableOpacity>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.miniMetric}>
      <Text style={[s.miniMetricValue, { color }]}>{value}</Text>
      <Text style={s.miniMetricLabel}>{label}</Text>
    </View>
  );
}

function RiskCard({ alert, onPress }: { alert: Alert; onPress: () => void }) {
  const color = getSeverityColor(alert.severity);
  return (
    <TouchableOpacity style={[s.riskCard, { borderLeftColor: color }]} onPress={onPress} activeOpacity={0.82}>
      <View style={s.riskTop}>
        <View style={[s.severityPill, { backgroundColor: getSeverityGlow(alert.severity), borderColor: color }]}>
          <Text style={[s.severityPillText, { color }]}>{alert.severity}</Text>
        </View>
        <Text style={s.riskTime}>{timeAgo(alert.created_at)}</Text>
      </View>
      <Text style={s.riskTitle} numberOfLines={1}>{alert.title}</Text>
      <Text style={s.riskDesc} numberOfLines={2}>{alert.description}</Text>
    </TouchableOpacity>
  );
}

function OperationsPulse({
  dashboard,
  loading,
  onPress,
}: {
  dashboard?: DashboardSummary;
  loading: boolean;
  onPress: () => void;
}) {
  if (loading) return <SkeletonCard style={s.pulseSkeleton} />;

  const activeBatches = getNumber(dashboard?.active_batches);
  const recentTransactions = getNumber(dashboard?.recent_transactions_count);
  const fpLowStock = getFinishedProductLowStock(dashboard);
  const nextAction = getNumber(dashboard?.overdue_capas) > 0
    ? 'Close overdue CAPAs'
    : fpLowStock > 0
      ? 'Review finished-product stock'
      : activeBatches > 0
        ? 'Monitor production flow'
        : 'Maintain operating rhythm';

  return (
    <TouchableOpacity style={s.pulseCard} onPress={onPress} activeOpacity={0.82}>
      <View style={s.pulseRow}>
        <MiniMetric label="Active" value={activeBatches} color={COLORS.sky} />
        <MiniMetric label="24h Txns" value={recentTransactions} color={COLORS.teal} />
        <MiniMetric label="FP Low" value={fpLowStock} color={COLORS.amber} />
      </View>
      <View style={s.nextActionBox}>
        <Text style={s.nextActionLabel}>Next Action</Text>
        <Text style={s.nextActionText}>{nextAction}</Text>
      </View>
    </TouchableOpacity>
  );
}

function TimelineItem({
  alert,
  isLast,
  index,
  onPress,
}: {
  alert: Alert;
  isLast: boolean;
  index: number;
  onPress: () => void;
}) {
  const dotColor = getSeverityColor(alert.severity);
  return (
    <TouchableOpacity style={[s.timelineRow, zebraRow(index)]} onPress={onPress} activeOpacity={0.78}>
      <View style={s.timelineLeft}>
        <View style={[s.timelineDot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={s.timelineLine} />}
      </View>
      <View style={s.timelineRight}>
        <View style={s.timelineTopRow}>
          <Text style={s.timelineTitle} numberOfLines={1}>{alert.title}</Text>
          <Text style={s.timelineTime}>{timeAgo(alert.created_at)}</Text>
        </View>
        <Text style={s.timelineDesc} numberOfLines={2}>{alert.description}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  const {
    data: dashboard,
    isLoading: dashLoading,
    isError: dashError,
    refetch: refetchDash,
    isFetching: fetchingDash,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.getDashboard,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const {
    data: alertFeed,
    isLoading: alertsLoading,
    refetch: refetchAlerts,
    isFetching: fetchingAlerts,
  } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.getAlerts(50),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const {
    data: salesIntelligence,
    isLoading: salesLoading,
    isError: salesError,
    refetch: refetchSales,
    isFetching: fetchingSales,
  } = useHomeSalesIntelligence('30d');

  const alerts = alertFeed?.alerts ?? [];
  const priorityAlerts = alerts.filter((a) => a.severity === 'HIGH' || a.severity === 'MEDIUM').slice(0, 5);
  const activityAlerts = alerts.slice(0, 8);
  const hasHighAlert = alerts.some((a) => a.severity === 'HIGH');
  const isRefreshing = fetchingDash || fetchingAlerts || fetchingSales;
  const onRefresh = () => {
    refetchDash();
    refetchAlerts();
    refetchSales();
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <VTLAppHeader
        rightElement={
          <BellButton hasHighAlert={hasHighAlert} onPress={() => router.push('/notifications')} />
        }
      />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={COLORS.sky} />
        }
      >
        {dashError ? (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Dashboard unavailable</Text>
            <Text style={s.errorSub}>Pull to refresh or retry the executive summary.</Text>
            <TouchableOpacity style={s.retryButton} onPress={() => refetchDash()} activeOpacity={0.8}>
              <Text style={s.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={s.section}>
          <SnapshotHero
            dashboard={dashboard}
            alerts={alerts}
            sales={salesIntelligence}
            loading={dashLoading}
            onNavigate={(route) => router.push(route as any)}
          />
        </View>

        <View style={s.section}>
          {salesLoading ? (
            <SkeletonCard style={s.chartSkeleton} />
          ) : salesError ? (
            <View style={s.salesErrorCard}>
              <Text style={s.errorTitle}>Sales intelligence unavailable</Text>
              <Text style={s.errorSub}>Pull to refresh or check backend connection.</Text>
            </View>
          ) : (
            <View style={s.chartCard}>
              <View style={s.chartHeader}>
                <View style={s.chartTitleBlock}>
                  <Text style={s.chartTitle}>Daily Revenue Trend</Text>
                  <Text style={s.chartSubtitle}>B2B accounts vs walk-in split</Text>
                </View>
                <View style={s.chartPill}>
                  <Text style={s.chartPillText}>30D</Text>
                </View>
              </View>
              <MobileLineChart
                data={salesIntelligence?.dailyTrend ?? []}
                xKey="sale_date"
                series={[
                  { key: 'b2b_revenue', label: 'B2B Revenue', color: COLORS.sky },
                  { key: 'walkin_revenue', label: 'Walk-in Revenue', color: COLORS.green },
                ]}
                currencyPrefix="$"
              />
            </View>
          )}
        </View>

        <View style={s.section}>
          {salesLoading ? (
            <SkeletonCard style={s.barSkeleton} />
          ) : salesError ? (
            <View style={s.salesErrorCard}>
              <Text style={s.errorTitle}>Sales intelligence unavailable</Text>
              <Text style={s.errorSub}>Pull to refresh or check backend connection.</Text>
            </View>
          ) : (
            <View style={s.chartCard}>
              <View style={s.chartHeader}>
                <View style={s.chartTitleBlock}>
                  <Text style={s.chartTitle}>Revenue by SKU</Text>
                  <Text style={s.chartSubtitle}>Completed sales - revenue and units sold</Text>
                </View>
                <View style={s.chartPill}>
                  <Text style={s.chartPillText}>TOP 8</Text>
                </View>
              </View>
              <HorizontalRevenueBarChart
                data={salesIntelligence?.revenueBySku ?? []}
                maxItems={8}
                currencyPrefix="$"
              />
            </View>
          )}
        </View>

        <View style={s.section}>
          <SectionHeader title="Risk Radar" subtitle="Items requiring leadership attention" />
          {alertsLoading ? (
            <>
              <SkeletonCard style={s.riskSkeleton} />
              <SkeletonCard style={s.riskSkeleton} />
            </>
          ) : priorityAlerts.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>No critical risks right now.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.riskScroll}>
              {priorityAlerts.map((alert, index) => (
                <RiskCard
                  key={`risk-${alert.id ?? alert.title}-${index}`}
                  alert={alert}
                  onPress={() => router.push(getAlertTarget(alert) as any)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={s.section}>
          <SectionHeader title="Operations Pulse" subtitle="Production and inventory signal" />
          <OperationsPulse
            dashboard={dashboard}
            loading={dashLoading}
            onPress={() => router.push('/(tabs)/operations')}
          />
        </View>

        <View style={s.quickBand}>
          <Text style={s.quickTitle}>Quick Actions</Text>
          <View style={s.quickActionsGrid}>
            {ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[s.actionTile, { backgroundColor: action.bg }]}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.75}
              >
                <Text style={s.actionIcon}>{action.icon}</Text>
                <Text style={s.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <SectionHeader
            title="Recent Activity"
            subtitle="Last 24 hours"
            action={{ label: 'View All', onPress: () => router.push('/notifications') }}
          />
          {alertsLoading ? (
            <>
              <SkeletonRow style={s.skeletonRow} />
              <SkeletonRow style={s.skeletonRow} />
              <SkeletonRow style={s.skeletonRow} />
              <SkeletonRow style={s.skeletonRow} />
              <SkeletonRow style={s.skeletonRow} />
              <SkeletonRow style={s.skeletonRow} />
            </>
          ) : activityAlerts.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>No recent activity.</Text>
            </View>
          ) : (
            activityAlerts.map((alert, i) => (
              <TimelineItem
                key={`activity-${alert.id ?? alert.title}-${i}`}
                alert={alert}
                isLast={i === activityAlerts.length - 1}
                index={i}
                onPress={() => router.push(getAlertTarget(alert) as any)}
              />
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 16 },
  section: { paddingHorizontal: 16, marginBottom: 18 },

  bellButton: { position: 'relative', padding: 4 },
  bellText: { color: COLORS.sky, fontSize: 18, fontWeight: '900' },
  bellDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.red,
  },

  heroSkeleton: { height: 190, marginBottom: 0 },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderBright,
    borderLeftWidth: 4,
    padding: 18,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  heroGlow: {
    position: 'absolute',
    top: -36,
    right: -28,
    width: 130,
    height: 130,
    borderRadius: 65,
    opacity: 0.55,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  statusBlock: { flex: 1 },
  statusLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  heroTitle: { color: COLORS.textPrimary, fontSize: 23, fontWeight: '900', marginBottom: 6 },
  updatedText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  revenueDial: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 7,
    borderColor: COLORS.green,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  revenueValue: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  revenueLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '800', marginTop: 3, textAlign: 'center' },
  calmState: {
    marginTop: 14,
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 13,
  },
  calmText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', lineHeight: 17 },
  commandRows: {
    marginTop: 14,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  commandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  commandDot: { width: 8, height: 8, borderRadius: 4, marginRight: 9 },
  commandLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', flex: 1, marginRight: 8 },
  commandValue: { fontSize: 12, fontWeight: '900', maxWidth: 104, textAlign: 'right' },
  miniMetric: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  miniMetricValue: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  miniMetricLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },

  errorCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.red,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 14,
  },
  errorTitle: { color: COLORS.red, fontSize: 15, fontWeight: '900', marginBottom: 4 },
  errorSub: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 12 },
  retryButton: {
    backgroundColor: COLORS.redGlow,
    borderColor: COLORS.red,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  retryButtonText: { color: COLORS.red, fontSize: 12, fontWeight: '900' },

  chartSkeleton: { height: 300 },
  barSkeleton: { height: 340 },
  chartCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: 14,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  chartTitleBlock: { flex: 1 },
  chartTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '900' },
  chartSubtitle: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', marginTop: 3 },
  chartPill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.skyGlow,
    borderColor: COLORS.sky,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chartPillText: { color: COLORS.sky, fontSize: 10, fontWeight: '900' },
  salesErrorCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.amber,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 14,
  },

  riskScroll: { gap: 12, paddingRight: 16 },
  riskSkeleton: { width: '100%', height: 104, marginBottom: 10 },
  riskCard: {
    width: 260,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 13,
  },
  riskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  severityPill: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3 },
  severityPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  riskTime: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  riskTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 5 },
  riskDesc: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 16,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },

  pulseSkeleton: { height: 142 },
  pulseCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: 14,
    ...SHADOW.card,
  },
  pulseRow: { flexDirection: 'row', gap: 8 },
  nextActionBox: {
    marginTop: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 12,
  },
  nextActionLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  nextActionText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },

  quickBand: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    paddingVertical: 16,
    ...SHADOW.card,
  },
  quickTitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
  },
  actionTile: {
    width: '48%',
    minHeight: 68,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '900', marginBottom: 7 },
  actionLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '700' },

  skeletonRow: { marginBottom: 10 },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 10,
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timelineLeft: { width: 20, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  timelineLine: { flex: 1, width: 1, backgroundColor: COLORS.border, marginTop: 4 },
  timelineRight: { flex: 1, paddingLeft: 10 },
  timelineTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  timelineTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800', flex: 1, marginRight: 8 },
  timelineTime: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  timelineDesc: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16 },
});
