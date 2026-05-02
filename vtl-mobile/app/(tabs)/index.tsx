import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api, { Alert } from '../../services/api';
import { COLORS, RADIUS, SHADOW, timeAgo, zebraRow } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { KpiCard } from '../../components/KpiCard';
import { SectionHeader } from '../../components/SectionHeader';
import { SkeletonKpi, SkeletonRow } from '../../components/SkeletonLoader';
import VTLAppHeader from '../../components/VTLAppHeader';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEV_CHIP: Record<string, { bg: string; border: string; text: string; prefix: string }> = {
  HIGH:   { bg: COLORS.redGlow,   border: COLORS.red,   text: COLORS.red,   prefix: '🚨' },
  MEDIUM: { bg: COLORS.amberGlow, border: COLORS.amber, text: COLORS.amber, prefix: '⚠️' },
  LOW:    { bg: COLORS.skyGlow,   border: COLORS.sky,   text: COLORS.sky,   prefix: 'ℹ️' },
};

const DOT_COLOR: Record<string, string> = {
  HIGH:   COLORS.red,
  MEDIUM: COLORS.amber,
  LOW:    COLORS.sky,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function AlertChip({ alert }: { alert: Alert }) {
  const chip = SEV_CHIP[alert.severity] ?? SEV_CHIP.LOW;
  return (
    <View style={[s.chip, { backgroundColor: chip.bg, borderColor: chip.border }]}>
      <Text style={[s.chipText, { color: chip.text }]}>
        {chip.prefix} {alert.title.substring(0, 28)}
      </Text>
    </View>
  );
}

function TimelineItem({ alert, isLast, index }: { alert: Alert; isLast: boolean; index: number }) {
  const dotColor = DOT_COLOR[alert.severity] ?? COLORS.sky;
  return (
    <View style={[s.timelineRow, zebraRow(index), { borderRadius: 8, paddingHorizontal: 6 }]}>
      <View style={s.timelineLeft}>
        <View style={[s.timelineDot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={s.timelineLine} />}
      </View>
      <View style={s.timelineRight}>
        <View style={s.timelineTopRow}>
          <Text style={s.timelineTitle} numberOfLines={1}>{alert.title}</Text>
          <Text style={s.timelineTime}>{timeAgo(alert.created_at)}</Text>
        </View>
        <Text style={s.timelineDesc} numberOfLines={2}>
          {alert.description.substring(0, 60)}
        </Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const user   = useAuthStore((s) => s.user);

  const {
    data: dashboard, isLoading: dashLoading,
    refetch: refetchDash, isFetching: fetchingDash,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  api.getDashboard,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const {
    data: alertFeed, isLoading: alertsLoading,
    refetch: refetchAlerts, isFetching: fetchingAlerts,
  } = useQuery({
    queryKey: ['alerts'],
    queryFn:  () => api.getAlerts(50),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const alerts       = alertFeed?.alerts ?? [];
  const bannerAlerts = alerts.filter((a) => a.severity === 'HIGH' || a.severity === 'MEDIUM');
  const hasHighAlert = alerts.some((a) => a.severity === 'HIGH');
  const isRefreshing = fetchingDash || fetchingAlerts;
  const onRefresh    = () => { refetchDash(); refetchAlerts(); };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <VTLAppHeader
        rightElement={
          <TouchableOpacity
            style={{ position: 'relative', padding: 4 }}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 22 }}>🔔</Text>
            {hasHighAlert && (
              <View style={{
                position: 'absolute', top: -2, right: -2,
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: COLORS.red,
              }} />
            )}
          </TouchableOpacity>
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
        {/* ── Alert Banner ── */}
        {bannerAlerts.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.bannerContent}
            style={s.bannerScroll}
          >
            {bannerAlerts.map((a) => (
              <AlertChip key={a.id} alert={a} />
            ))}
          </ScrollView>
        )}

        {/* ── KPI Grid ── */}
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
                    value={dashboard?.active_batches ?? 0}
                    color={COLORS.sky}
                    colorGlow={COLORS.skyGlow}
                    icon="🏭"
                    onPress={() => router.push('/(tabs)/operations')}
                  />
                </View>
                <View style={s.kpiCell}>
                  <KpiCard
                    title="Open NCRs"
                    value={dashboard?.open_ncrs ?? 0}
                    color={COLORS.amber}
                    colorGlow={COLORS.amberGlow}
                    icon="⚠️"
                    onPress={() => router.push('/(tabs)/quality')}
                  />
                </View>
                <View style={s.kpiCell}>
                  <KpiCard
                    title="Overdue CAPAs"
                    value={dashboard?.overdue_capas ?? 0}
                    color={COLORS.red}
                    colorGlow={COLORS.redGlow}
                    icon="🔴"
                    onPress={() => router.push('/(tabs)/quality')}
                  />
                </View>
                <View style={s.kpiCell}>
                  <KpiCard
                    title="Low Stock"
                    value={dashboard?.low_stock_items ?? 0}
                    color={COLORS.amber}
                    colorGlow={COLORS.amberGlow}
                    icon="📦"
                    onPress={() => router.push('/(tabs)/operations')}
                  />
                </View>
                <View style={s.kpiCell}>
                  <KpiCard
                    title="Docs In Review"
                    value={dashboard?.pending_docs_review ?? 0}
                    color={COLORS.sky}
                    colorGlow={COLORS.skyGlow}
                    icon="📋"
                    onPress={() => router.push('/(tabs)/quality')}
                  />
                </View>
                <View style={s.kpiCell}>
                  <KpiCard
                    title="QMS Ready"
                    value={`${dashboard?.qms_completion_pct ?? 0}%`}
                    color={COLORS.green}
                    colorGlow={COLORS.greenGlow}
                    icon="✅"
                    onPress={() => router.push('/(tabs)/quality')}
                  />
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={{
          marginHorizontal: -16,
          paddingHorizontal: 16,
          paddingVertical: 16,
          backgroundColor: COLORS.surfaceAlt,
          borderTopWidth: 1, borderBottomWidth: 1,
          borderColor: COLORS.border,
          marginBottom: 20,
        }}>
          <Text style={{
            color: COLORS.textMuted, fontSize: 10,
            fontWeight: '700', letterSpacing: 2,
            textTransform: 'uppercase', marginBottom: 12,
          }}>Quick Actions</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.actionsContent}
            style={s.actionsScroll}
          >
            {[
              { emoji: '📋', label: 'Documents', bg: COLORS.skyGlow,   route: '/(tabs)/quality'     },
              { emoji: '⚠️', label: 'NCRs',       bg: COLORS.amberGlow, route: '/(tabs)/quality'     },
              { emoji: '🏭', label: 'Batches',    bg: COLORS.tealGlow,  route: '/(tabs)/operations'  },
              { emoji: '📊', label: 'Sales',      bg: COLORS.greenGlow, route: '/(tabs)/commercial'  },
            ].map(({ emoji, label, bg, route }) => (
              <TouchableOpacity
                key={label}
                style={[s.actionTile, { backgroundColor: bg }]}
                onPress={() => router.push(route as any)}
                activeOpacity={0.75}
              >
                <Text style={s.actionEmoji}>{emoji}</Text>
                <Text style={s.actionLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Recent Activity ── */}
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
          ) : (
            alerts.slice(0, 8).map((alert, i) => (
              <TimelineItem
                key={alert.id}
                alert={alert}
                isLast={i === Math.min(alerts.length, 8) - 1}
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

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  scroll:  { flex: 1 },
  content: { paddingBottom: 16 },
  section: { paddingHorizontal: 16, marginBottom: 8 },

  // Alert Banner
  bannerScroll:   { marginBottom: 8 },
  bannerContent:  { paddingHorizontal: 16, gap: 8 },
  chip:           { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginRight: 0 },
  chipText:       { fontSize: 11, fontWeight: '600' },

  // KPI Grid
  kpiGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCell:     { width: '47.5%' },
  kpiSkeleton: { margin: 0, width: '47.5%' },

  // Quick Actions
  actionsScroll:   { marginBottom: 8 },
  actionsContent:  { paddingHorizontal: 16, gap: 12 },
  actionTile:      { width: 80, height: 80, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', ...SHADOW.card },
  actionEmoji:     { fontSize: 28 },
  actionLabel:     { fontSize: 10, color: COLORS.textSecondary, marginTop: 6 },

  // Timeline
  skeletonRow:   { marginBottom: 10 },
  timelineRow:   { flexDirection: 'row', marginBottom: 16 },
  timelineLeft:  { width: 20, alignItems: 'center' },
  timelineDot:   { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  timelineLine:  { flex: 1, width: 1, backgroundColor: COLORS.border, marginTop: 4 },
  timelineRight: { flex: 1, paddingLeft: 10 },
  timelineTopRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  timelineTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },
  timelineTime:  { color: COLORS.textMuted,   fontSize: 10 },
  timelineDesc:  { color: COLORS.textMuted,   fontSize: 11, lineHeight: 16 },
});
