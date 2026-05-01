import {
  View, Text, StyleSheet, ScrollView, SectionList,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api, { Alert } from '../services/api';
import { COLORS } from '../constants/theme';

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupByDate(alerts: Alert[]): { title: string; data: Alert[] }[] {
  const today    = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const fmt = (d: Date) => d.toDateString();

  const map: Record<string, Alert[]> = {};
  for (const a of alerts) {
    const d = new Date(a.created_at);
    let label: string;
    if (fmt(d) === fmt(today))     label = 'Today';
    else if (fmt(d) === fmt(yesterday)) label = 'Yesterday';
    else label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    if (!map[label]) map[label] = [];
    map[label].push(a);
  }
  return Object.entries(map).map(([title, data]) => ({ title, data }));
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_META: Record<string, { icon: string; color: string }> = {
  NCR:          { icon: '⚠️',  color: COLORS.red   },
  CAPA_OVERDUE: { icon: '🕐',  color: COLORS.amber },
  ZERO_STOCK:   { icon: '📦',  color: COLORS.amber },
  DOC_REVIEW:   { icon: '📄',  color: COLORS.sky   },
};

const SEV_COLOR: Record<string, string> = {
  HIGH:   COLORS.red,
  MEDIUM: COLORS.amber,
  LOW:    COLORS.teal,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: Alert }) {
  const meta = TYPE_META[alert.type] ?? { icon: '🔔', color: COLORS.muted };
  const sevColor = SEV_COLOR[alert.severity] ?? COLORS.muted;

  return (
    <View style={[s.alertCard, { borderLeftColor: meta.color }]}>
      <View style={s.alertTop}>
        <Text style={s.alertIcon}>{meta.icon}</Text>
        <View style={s.alertCenter}>
          <Text style={s.alertTitle} numberOfLines={1}>{alert.title}</Text>
          <Text style={s.alertDesc} numberOfLines={2}>{alert.description}</Text>
        </View>
        <View style={[s.sevPill, { borderColor: sevColor }]}>
          <Text style={[s.sevText, { color: sevColor }]}>{alert.severity}</Text>
        </View>
      </View>
      <View style={s.alertBottom}>
        <Text style={s.alertMeta}>
          {alert.actor_name ?? 'System'} · {timeAgo(alert.created_at)}
        </Text>
        <View style={[s.typePill, { backgroundColor: meta.color + '22' }]}>
          <Text style={[s.typeText, { color: meta.color }]}>
            {alert.type.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.getAlerts(50),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Alerts</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={s.center}>
          <ActivityIndicator color={COLORS.sky} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Alerts</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={s.center}>
          <Text style={s.errorText}>Failed to load alerts.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sections = groupByDate(data);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Alerts</Text>
        <View style={s.headerCount}>
          <Text style={s.headerCountText}>{data.length}</Text>
        </View>
      </View>

      {data.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🎉</Text>
          <Text style={s.emptyTitle}>All clear</Text>
          <Text style={s.emptyText}>No active alerts.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AlertCard alert={item} />}
          renderSectionHeader={({ section }) => (
            <Text style={s.dateHeader}>{section.title}</Text>
          )}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={COLORS.sky} />
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:      { width: 60 },
  backText:     { color: COLORS.sky, fontSize: 17, fontWeight: '600' },
  headerTitle:  { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  headerCount:  { width: 60, alignItems: 'flex-end' },
  headerCountText: { color: COLORS.muted, fontSize: 14 },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  dateHeader: { color: COLORS.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },

  alertCard:   { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3, padding: 14, marginBottom: 10 },
  alertTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  alertIcon:   { fontSize: 20, lineHeight: 24 },
  alertCenter: { flex: 1 },
  alertTitle:  { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  alertDesc:   { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  alertBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertMeta:   { color: COLORS.muted, fontSize: 11 },

  sevPill: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  sevText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  typePill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  typeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText:  { color: COLORS.muted, fontSize: 14 },

  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
