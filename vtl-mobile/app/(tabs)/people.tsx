import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePeople } from '../../hooks/usePeople';
import { COLORS, RADIUS } from '../../constants/theme';
import VTLAppHeader from '../../components/VTLAppHeader';
import { SkeletonRow } from '../../components/SkeletonLoader';
import type { PendingAck, ActivityItem } from '../../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

const ACTIVITY_COLOR: Record<string, string> = {
  batch_created:     COLORS.sky,
  batch_completed:   COLORS.green,
  ncr_created:       COLORS.red,
  capa_created:      COLORS.amber,
  document_released: COLORS.teal,
  user_login:        COLORS.muted,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, count }: { title: string; subtitle?: string; count?: number }) {
  return (
    <View style={s.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
      </View>
      {count !== undefined && (
        <View style={s.sectionBadge}>
          <Text style={s.sectionBadgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarText, { fontSize: Math.round(size * 0.36) }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

function AckRow({ item, last }: { item: PendingAck; last: boolean }) {
  return (
    <View style={[s.ackRow, !last && s.rowBorder]}>
      <Avatar name={item.full_name} />
      <View style={s.ackMid}>
        <Text style={s.ackName}>{item.full_name}</Text>
        <Text style={s.ackRole}>{item.role}</Text>
      </View>
      <Text style={s.ackPending}>{item.pending_count} docs pending</Text>
    </View>
  );
}

function ActivityRow({ item, last }: { item: ActivityItem; last: boolean }) {
  const actorName = item.actor_name ?? 'System';
  const dotColor  = ACTIVITY_COLOR[item.activity_type] ?? COLORS.muted;
  const label     = item.activity_type.replace(/_/g, ' ');
  return (
    <View style={[s.actRow, !last && s.rowBorder]}>
      <Avatar name={actorName} />
      <View style={s.actMid}>
        <Text style={s.actActor}>{actorName}</Text>
        <Text style={s.actLabel}>{label}</Text>
        <View style={[s.tableChip, { backgroundColor: dotColor + '22', borderColor: dotColor }]}>
          <Text style={[s.tableChipText, { color: dotColor }]}>{item.table_name}</Text>
        </View>
      </View>
      <Text style={s.actTime}>{timeAgo(item.created_at)}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PeopleScreen() {
  const { data, isLoading, isError, refetch, isFetching } = usePeople();

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <VTLAppHeader title="People & Activity" subtitle="Team overview" />
        <View style={{ padding: 16 }}>
          {[...Array(8)].map((_, i) => <SkeletonRow key={i} style={{ marginBottom: 12 }} />)}
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <VTLAppHeader title="People & Activity" subtitle="Team overview" />
        <View style={s.center}>
          <Text style={s.errorText}>Failed to load people data.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <VTLAppHeader title="People & Activity" subtitle="Team overview" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={COLORS.sky} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Team Overview */}
        <SectionHeader title="Team by Role" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.roleRow}
        >
          {data.users_by_role.map((r) => (
            <View key={r.role} style={s.roleChip}>
              <Text style={s.roleChipCount}>{r.count}</Text>
              <Text style={s.roleChipLabel}>{r.role.replace(/_/g, ' ').toUpperCase()}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Activity Feed */}
        <SectionHeader
          title="System Activity"
          subtitle="Last 50 actions"
          count={data.recent_activity.length}
        />
        {data.recent_activity.length === 0 ? (
          <Text style={s.emptyText}>No recent activity.</Text>
        ) : (
          <View style={s.card}>
            {data.recent_activity.map((a, i) => (
              <ActivityRow
                key={a.activity_id}
                item={a}
                last={i === data.recent_activity.length - 1}
              />
            ))}
          </View>
        )}

        {/* Pending Acknowledgements */}
        <SectionHeader
          title="Acknowledgements Due"
          count={data.pending_acknowledgements.length}
        />
        {data.pending_acknowledgements.length === 0 ? (
          <View style={s.allGoodCard}>
            <Text style={s.allGoodText}>All team members are up to date ✓</Text>
          </View>
        ) : (
          <View style={s.card}>
            {data.pending_acknowledgements.map((a, i) => (
              <AckRow
                key={a.user_id}
                item={a}
                last={i === data.pending_acknowledgements.length - 1}
              />
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  sectionHeader:    { flexDirection: 'row', alignItems: 'flex-start', marginTop: 20, marginBottom: 10 },
  sectionTitle:     { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  sectionSub:       { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  sectionBadge:     { backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8, marginTop: 2 },
  sectionBadgeText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },

  card:      { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  emptyText: { color: COLORS.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 8 },

  roleRow:       { gap: 8, paddingBottom: 4 },
  roleChip:      { backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  roleChipCount: { color: COLORS.sky, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  roleChipLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },

  avatar:     { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.sky, fontWeight: '800' },

  ackRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  ackMid:    { flex: 1 },
  ackName:   { color: COLORS.text, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  ackRole:   { color: COLORS.muted, fontSize: 11 },
  ackPending:{ color: COLORS.amber, fontSize: 12, fontWeight: '700' },

  actRow:    { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: 12, gap: 10 },
  actMid:    { flex: 1, gap: 3 },
  actActor:  { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  actLabel:  { color: COLORS.textMuted, fontSize: 11, textTransform: 'capitalize' },
  tableChip: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, alignSelf: 'flex-start' },
  tableChipText:{ fontSize: 10, fontWeight: '600' },
  actTime:   { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },

  allGoodCard:{ backgroundColor: COLORS.green + '22', borderWidth: 1, borderColor: COLORS.green, borderRadius: RADIUS.lg, padding: 14 },
  allGoodText:{ color: COLORS.green, fontSize: 14, fontWeight: '600', textAlign: 'center' },

  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
