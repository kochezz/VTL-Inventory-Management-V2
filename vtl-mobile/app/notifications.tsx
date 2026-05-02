import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import api, { Alert } from '../services/api';
import { COLORS, RADIUS, SHADOW, timeAgo } from '../constants/theme';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonCard } from '../components/SkeletonLoader';
import VTLAppHeader from '../components/VTLAppHeader';

// ── Types ─────────────────────────────────────────────────────────────────────

type Filter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { icon: string; color: string }> = {
  NCR:          { icon: '⚠️',  color: COLORS.red   },
  CAPA_OVERDUE: { icon: '🕐',  color: COLORS.amber },
  ZERO_STOCK:   { icon: '📦',  color: COLORS.amber },
  DOC_REVIEW:   { icon: '📄',  color: COLORS.sky   },
};

const SEV_BORDER: Record<string, string> = {
  HIGH:   COLORS.red,
  MEDIUM: COLORS.amber,
  LOW:    COLORS.teal,
};

function groupByDate(alerts: Alert[]): { title: string; data: Alert[] }[] {
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const fmt = (d: Date) => d.toDateString();

  const map: Record<string, Alert[]> = {};
  for (const a of alerts) {
    const d = new Date(a.created_at);
    let label: string;
    if (fmt(d) === fmt(today))         label = 'TODAY';
    else if (fmt(d) === fmt(yesterday)) label = 'YESTERDAY';
    else label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
    if (!map[label]) map[label] = [];
    map[label].push(a);
  }
  return Object.entries(map).map(([title, data]) => ({ title, data }));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: Alert }) {
  const meta     = TYPE_META[(alert.type ?? '')] ?? { icon: '🔔', color: COLORS.sky };
  const sevColor = SEV_BORDER[(alert.severity ?? '').toUpperCase()] ?? COLORS.sky;

  return (
    <View style={[s.alertCard, { borderLeftColor: sevColor }, SHADOW.card]}>
      {/* Row 1: icon + title + badge */}
      <View style={s.row1}>
        <Text style={s.typeIcon}>{meta.icon}</Text>
        <Text style={s.alertTitle} numberOfLines={1}>{alert.title}</Text>
        <StatusBadge status={alert.severity} small />
      </View>
      {/* Row 2: description */}
      <Text style={s.alertDesc} numberOfLines={3}>{alert.description}</Text>
      {/* Row 3: actor + time */}
      <Text style={s.alertMeta}>
        {alert.actor_name ?? 'System'} · {timeAgo(alert.created_at)}
      </Text>
    </View>
  );
}

const FILTER_PILLS: { key: Filter; label: string }[] = [
  { key: 'ALL',    label: 'All'       },
  { key: 'HIGH',   label: '🚨 High'   },
  { key: 'MEDIUM', label: '⚠ Medium'  },
  { key: 'LOW',    label: 'ℹ Low'     },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const [filter, setFilter] = useState<Filter>('ALL');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['alerts'],
    queryFn:  () => api.getAlerts(200),
    staleTime: 30_000,
  });

  const allAlerts  = data?.alerts ?? [];
  const monthLabel = data?.month_label ?? '';
  const totalCount = data?.total_this_month ?? 0;

  const filtered = filter === 'ALL'
    ? allAlerts
    : allAlerts.filter((a) => (a.severity ?? '').toUpperCase() === filter);

  const sections = groupByDate(filtered);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <VTLAppHeader
        title="Notifications"
        subtitle={monthLabel || 'This Month'}
        showBack
      />

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterContent}
        style={s.filterScroll}
      >
        {FILTER_PILLS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[s.filterPill, filter === key && s.filterPillActive]}
            onPress={() => setFilter(key)}
            activeOpacity={0.75}
          >
            <Text style={[s.filterText, filter === key && s.filterTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {isLoading ? (
        <ScrollView contentContainerStyle={s.listContent}>
          <SkeletonCard style={s.skeletonCard} />
          <SkeletonCard style={s.skeletonCard} />
          <SkeletonCard style={s.skeletonCard} />
          <SkeletonCard style={s.skeletonCard} />
        </ScrollView>
      ) : isError ? (
        <View style={s.center}>
          <Text style={s.errorText}>Failed to load alerts.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🎉</Text>
          <Text style={s.emptyTitle}>All clear this month</Text>
          <Text style={s.emptyText}>
            {monthLabel ? `No alerts in ${monthLabel}` : 'No alerts found'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={COLORS.sky} />
          }
        >
          {sections.map(({ title, data: sectionAlerts }) => (
            <View key={title}>
              <Text style={s.dateHeader}>{title}</Text>
              {sectionAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  // Filter pills
  filterScroll:  { maxHeight: 48, marginBottom: 4 },
  filterContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterPill:    { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 6 },
  filterPillActive: { backgroundColor: COLORS.sky },
  filterText:    { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  filterTextActive: { color: '#fff' },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  skeletonCard: { marginBottom: 10 },

  // Date group header
  dateHeader: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingVertical: 8,
  },

  // Alert card
  alertCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 8,
  },
  row1:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  typeIcon:   { fontSize: 16 },
  alertTitle: { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  alertDesc:  { color: COLORS.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  alertMeta:  { color: COLORS.textMuted, fontSize: 11 },

  // Empty / error
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText:  { color: COLORS.textMuted,   fontSize: 13 },
  errorText:  { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
