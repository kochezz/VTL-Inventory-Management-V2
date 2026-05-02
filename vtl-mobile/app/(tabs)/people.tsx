import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import api, { TrainingUser, PendingAck, ActivityItem } from '../../services/api';
import { COLORS } from '../../constants/theme';
import VTLAppHeader from '../../components/VTLAppHeader';

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ACTIVITY_COLOR: Record<string, string> = {
  batch_created:   COLORS.sky,
  batch_completed: COLORS.green,
  ncr_created:     COLORS.red,
  capa_created:    COLORS.amber,
  document_released: COLORS.teal,
  user_login:      COLORS.muted,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {count !== undefined && (
        <View style={s.sectionBadge}>
          <Text style={s.sectionBadgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function RoleChip({ role, count }: { role: string; count: number }) {
  return (
    <View style={s.roleChip}>
      <Text style={s.roleChipCount}>{count}</Text>
      <Text style={s.roleChipLabel}>{role.replace(/_/g, ' ').toUpperCase()}</Text>
    </View>
  );
}

function LeaderRow({
  user, rank, variant,
}: {
  user: TrainingUser;
  rank: number;
  variant: 'top' | 'bottom';
}) {
  const color = variant === 'top' ? COLORS.green : COLORS.red;
  return (
    <View style={s.leaderRow}>
      <Text style={[s.leaderRank, { color: COLORS.muted }]}>#{rank}</Text>
      <View style={s.leaderMid}>
        <Text style={s.leaderName}>{user.full_name}</Text>
        <Text style={s.leaderRole}>{user.role}</Text>
      </View>
      <Text style={[s.leaderCount, { color }]}>{user.acknowledged_count}</Text>
    </View>
  );
}

function AckRow({ item, last }: { item: PendingAck; last: boolean }) {
  return (
    <View style={[s.ackRow, !last && s.rowDivider]}>
      <View style={s.ackLeft}>
        <Text style={s.ackName}>{item.full_name}</Text>
        <Text style={s.ackMeta}>{item.role} · {item.email}</Text>
      </View>
      <View style={s.ackBadge}>
        <Text style={s.ackBadgeText}>{item.pending_count}</Text>
      </View>
    </View>
  );
}

function ActivityRow({ item, last }: { item: ActivityItem; last: boolean }) {
  const dotColor = ACTIVITY_COLOR[item.activity_type] ?? COLORS.muted;
  const label = item.activity_type.replace(/_/g, ' ');
  return (
    <View style={[s.actRow, !last && s.rowDivider]}>
      <View style={[s.actDot, { backgroundColor: dotColor }]} />
      <View style={s.actMid}>
        <Text style={s.actLabel}>{label}</Text>
        <Text style={s.actMeta}>{item.actor_name ?? 'System'} · {item.table_name}</Text>
      </View>
      <Text style={s.actTime}>{timeAgo(item.created_at)}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PeopleScreen() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['people'],
    queryFn: api.getPeople,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator color={COLORS.sky} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}>
          <Text style={s.errorText}>Failed to load people data.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const top10 = data.training_leaderboard.top_10 ?? [];
  const bottom5 = data.training_leaderboard.bottom_5 ?? [];

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <VTLAppHeader title="People" subtitle="Team & Activity" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={COLORS.sky} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Team by Role */}
        <SectionHeader title="Team by Role" />
        <View style={s.chipRow}>
          {data.users_by_role.map((r) => (
            <RoleChip key={r.role} role={r.role} count={r.count} />
          ))}
        </View>

        {/* Training Leaderboard — Top */}
        <SectionHeader title="Training Leaders" count={top10.length} />
        {top10.length === 0 ? (
          <Text style={s.emptyText}>No training data.</Text>
        ) : (
          <View style={s.card}>
            {top10.map((u, i) => (
              <View key={u.user_id}>
                {i > 0 && <View style={s.rowDivider} />}
                <LeaderRow user={u} rank={i + 1} variant="top" />
              </View>
            ))}
          </View>
        )}

        {/* Training Leaderboard — Bottom */}
        {bottom5.length > 0 && (
          <>
            <SectionHeader title="Needs Attention" count={bottom5.length} />
            <View style={[s.card, s.bottomCard]}>
              {bottom5.map((u, i) => (
                <View key={u.user_id}>
                  {i > 0 && <View style={s.rowDivider} />}
                  <LeaderRow user={u} rank={top10.length + i + 1} variant="bottom" />
                </View>
              ))}
            </View>
          </>
        )}

        {/* Acknowledgements Due */}
        <SectionHeader title="Acknowledgements Due" count={data.pending_acknowledgements.length} />
        {data.pending_acknowledgements.length === 0 ? (
          <Text style={s.emptyText}>All documents acknowledged.</Text>
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

        {/* Recent Activity */}
        <SectionHeader title="Recent Activity" count={data.recent_activity.length} />
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
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  screenTitle: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 4 },

  sectionHeader:    { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  sectionTitle:     { color: COLORS.text, fontSize: 15, fontWeight: '700', flex: 1 },
  sectionBadge:     { backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionBadgeText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },

  card:       { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  bottomCard: { borderColor: COLORS.red + '55' },
  rowDivider: { height: 1, backgroundColor: COLORS.border },
  emptyText:  { color: COLORS.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 8 },

  chipRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  roleChip:      { backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 80 },
  roleChipCount: { color: COLORS.sky, fontSize: 20, fontWeight: '800' },
  roleChipLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 2, textAlign: 'center' },

  leaderRow:    { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  leaderRank:   { fontSize: 13, fontWeight: '700', minWidth: 28 },
  leaderMid:    { flex: 1 },
  leaderName:   { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  leaderRole:   { color: COLORS.muted, fontSize: 12, marginTop: 1 },
  leaderCount:  { fontSize: 20, fontWeight: '800', minWidth: 36, textAlign: 'right' },

  ackRow:    { flexDirection: 'row', alignItems: 'center', padding: 14 },
  ackLeft:   { flex: 1 },
  ackName:   { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  ackMeta:   { color: COLORS.muted, fontSize: 12 },
  ackBadge:  { backgroundColor: COLORS.amber + '22', borderWidth: 1, borderColor: COLORS.amber, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, minWidth: 32, alignItems: 'center' },
  ackBadgeText: { color: COLORS.amber, fontSize: 13, fontWeight: '800' },

  actRow:  { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  actDot:  { width: 8, height: 8, borderRadius: 4 },
  actMid:  { flex: 1 },
  actLabel:{ color: COLORS.text, fontSize: 13, fontWeight: '500', textTransform: 'capitalize' },
  actMeta: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  actTime: { color: COLORS.muted, fontSize: 12 },

  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
