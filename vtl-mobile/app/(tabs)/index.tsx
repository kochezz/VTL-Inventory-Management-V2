import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api, { Alert, DashboardSummary } from '../../services/api';
import { COLORS, RADIUS, SHADOW, timeAgo, zebraRow } from '../../constants/theme';
import { KpiCard } from '../../components/KpiCard';
import { SectionHeader } from '../../components/SectionHeader';
import { SkeletonCard, SkeletonKpi, SkeletonRow } from '../../components/SkeletonLoader';
import VTLAppHeader from '../../components/VTLAppHeader';

type ExecutiveStatus = {
  label: 'Critical' | 'Attention Required' | 'Stable';
  color: string;
  glow: string;
};

const ACTIONS = [
  { icon: 'DOC', label: 'Documents', bg: COLORS.skyGlow, route: '/(tabs)/quality' },
  { icon: 'NCR', label: 'NCRs', bg: COLORS.amberGlow, route: '/(tabs)/quality' },
  { icon: 'BCH', label: 'Batches', bg: COLORS.tealGlow, route: '/(tabs)/operations' },
  { icon: 'REV', label: 'Sales', bg: COLORS.greenGlow, route: '/(tabs)/commercial' },
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

function getUpdatedLabel(alerts: Alert[]): string {
  const latest = alerts.find((a) => a.created_at)?.created_at;
  return latest ? `Updated ${timeAgo(latest)}` : 'Updated just now';
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
  loading,
}: {
  dashboard?: DashboardSummary;
  alerts: Alert[];
  loading: boolean;
}) {
  if (loading) return <SkeletonCard style={s.heroSkeleton} />;

  const status = getExecutiveStatus(dashboard, alerts);
  const qmsPct = getNumber(dashboard?.qms_completion_pct);
  const activeBatches = getNumber(dashboard?.active_batches);
  const fpLowStock = getFinishedProductLowStock(dashboard);

  return (
    <View style={[s.heroCard, { borderLeftColor: status.color }]}>
      <View style={[s.heroGlow, { backgroundColor: status.glow }]} pointerEvents="none" />
      <View style={s.heroTop}>
        <View style={s.statusBlock}>
          <Text style={[s.statusLabel, { color: status.color }]}>{status.label}</Text>
          <Text style={s.heroTitle}>Executive Snapshot</Text>
          <Text style={s.updatedText}>{getUpdatedLabel(alerts)}</Text>
        </View>
        <View style={s.qmsDial}>
          <Text style={s.qmsValue}>{qmsPct}%</Text>
          <Text style={s.qmsLabel}>QMS Ready</Text>
        </View>
      </View>
      <View style={s.heroMetrics}>
        <MiniMetric label="Active Batches" value={activeBatches} color={COLORS.sky} />
        <MiniMetric label="FP Low Stock" value={fpLowStock} color={COLORS.amber} />
      </View>
    </View>
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

function RiskCard({ alert }: { alert: Alert }) {
  const color = getSeverityColor(alert.severity);
  return (
    <View style={[s.riskCard, { borderLeftColor: color }]}>
      <View style={s.riskTop}>
        <View style={[s.severityPill, { backgroundColor: getSeverityGlow(alert.severity), borderColor: color }]}>
          <Text style={[s.severityPillText, { color }]}>{alert.severity}</Text>
        </View>
        <Text style={s.riskTime}>{timeAgo(alert.created_at)}</Text>
      </View>
      <Text style={s.riskTitle} numberOfLines={1}>{alert.title}</Text>
      <Text style={s.riskDesc} numberOfLines={2}>{alert.description}</Text>
    </View>
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

function TimelineItem({ alert, isLast, index }: { alert: Alert; isLast: boolean; index: number }) {
  const dotColor = getSeverityColor(alert.severity);
  return (
    <View style={[s.timelineRow, zebraRow(index)]}>
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
    </View>
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

  const alerts = alertFeed?.alerts ?? [];
  const priorityAlerts = alerts.filter((a) => a.severity === 'HIGH' || a.severity === 'MEDIUM').slice(0, 5);
  const activityAlerts = alerts.slice(0, 8);
  const hasHighAlert = alerts.some((a) => a.severity === 'HIGH');
  const isRefreshing = fetchingDash || fetchingAlerts;
  const onRefresh = () => {
    refetchDash();
    refetchAlerts();
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
          <SnapshotHero dashboard={dashboard} alerts={alerts} loading={dashLoading} />
        </View>

        <View style={s.section}>
          <View style={s.kpiGrid}>
            {dashLoading ? (
              <>
                <SkeletonKpi style={s.kpiSkeleton} />
                <SkeletonKpi style={s.kpiSkeleton} />
                <SkeletonKpi style={s.kpiSkeleton} />
                <SkeletonKpi style={s.kpiSkeleton} />
                <SkeletonKpi style={s.kpiSkeleton} />
                <SkeletonKpi style={s.kpiSkeleton} />
              </>
            ) : (
              <>
                <View style={s.kpiCell}>
                  <KpiCard
                    title="Active Batches"
                    subtitle="Production pulse"
                    value={getNumber(dashboard?.active_batches)}
                    color={COLORS.sky}
                    colorGlow={COLORS.skyGlow}
                    icon="BCH"
                    onPress={() => router.push('/(tabs)/operations')}
                  />
                </View>
                <View style={s.kpiCell}>
                  <KpiCard
                    title="Open NCRs"
                    subtitle="Quality attention"
                    value={getNumber(dashboard?.open_ncrs)}
                    color={COLORS.amber}
                    colorGlow={COLORS.amberGlow}
                    icon="NCR"
                    onPress={() => router.push('/(tabs)/quality')}
                  />
                </View>
                <View style={s.kpiCell}>
                  <KpiCard
                    title="Overdue CAPAs"
                    subtitle="Action required"
                    value={getNumber(dashboard?.overdue_capas)}
                    color={COLORS.red}
                    colorGlow={COLORS.redGlow}
                    icon="CAP"
                    onPress={() => router.push('/(tabs)/quality')}
                  />
                </View>
                <View style={s.kpiCell}>
                  <KpiCard
                    title="FP Low Stock"
                    subtitle="Finished products only"
                    value={getFinishedProductLowStock(dashboard)}
                    color={COLORS.amber}
                    colorGlow={COLORS.amberGlow}
                    icon="FP"
                    onPress={() => router.push('/(tabs)/operations')}
                  />
                </View>
                <View style={s.kpiCell}>
                  <KpiCard
                    title="Docs in Review"
                    subtitle="QMS workflow"
                    value={getNumber(dashboard?.pending_docs_review)}
                    color={COLORS.sky}
                    colorGlow={COLORS.skyGlow}
                    icon="DOC"
                    onPress={() => router.push('/(tabs)/quality')}
                  />
                </View>
                <View style={s.kpiCell}>
                  <KpiCard
                    title="QMS Ready"
                    subtitle="Released document coverage"
                    value={`${getNumber(dashboard?.qms_completion_pct)}%`}
                    color={COLORS.green}
                    colorGlow={COLORS.greenGlow}
                    icon="QMS"
                    onPress={() => router.push('/(tabs)/quality')}
                  />
                </View>
              </>
            )}
          </View>
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
                <RiskCard key={`risk-${alert.id ?? alert.title}-${index}`} alert={alert} />
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actionsContent}>
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
          </ScrollView>
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
  qmsDial: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 7,
    borderColor: COLORS.green,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qmsValue: { color: COLORS.textPrimary, fontSize: 23, fontWeight: '900' },
  qmsLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', marginTop: 2 },
  heroMetrics: { flexDirection: 'row', gap: 10, marginTop: 18 },
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

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCell: { width: '47.5%' },
  kpiSkeleton: { margin: 0, width: '47.5%', height: 126 },

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
  actionsContent: { paddingHorizontal: 16, gap: 12 },
  actionTile: {
    width: 86,
    height: 78,
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
