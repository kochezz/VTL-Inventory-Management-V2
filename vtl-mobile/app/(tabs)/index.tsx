import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { COLORS } from '../../constants/theme';

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  label, value, color, sub,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  return (
    <View style={s.metricCard}>
      <Text style={[s.metricValue, color ? { color } : null]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
      {sub ? <Text style={s.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function ComplianceBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? COLORS.green : pct >= 50 ? COLORS.amber : COLORS.red;
  return (
    <View style={s.complianceCard}>
      <View style={s.complianceTop}>
        <Text style={s.complianceLabel}>QMS Completion</Text>
        <Text style={[s.compliancePct, { color }]}>{pct.toFixed(1)}%</Text>
      </View>
      <View style={s.complianceBarBg}>
        <View style={[s.complianceBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.getDashboard,
    staleTime: 30_000,
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Custom header with bell */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>VTL Executive</Text>
          <Text style={s.headerSub}>Command Centre</Text>
        </View>
        <TouchableOpacity
          style={s.bellBtn}
          onPress={() => router.push('/notifications' as any)}
          activeOpacity={0.7}
        >
          <Text style={s.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.sky} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={s.center}>
          <Text style={s.errorText}>Failed to load dashboard.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={COLORS.sky} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* QMS Completion Bar */}
          <ComplianceBar pct={data.qms_completion_pct ?? 0} />

          {/* Metrics grid */}
          <Text style={s.sectionLabel}>PRODUCTION</Text>
          <View style={s.metricsGrid}>
            <MetricCard
              label="Active Batches"
              value={data.active_batches}
              color={data.active_batches > 0 ? COLORS.sky : COLORS.muted}
            />
            <MetricCard
              label="Recent Transactions"
              value={data.recent_transactions_count}
            />
          </View>

          <Text style={s.sectionLabel}>QUALITY</Text>
          <View style={s.metricsGrid}>
            <MetricCard
              label="Open NCRs"
              value={data.open_ncrs}
              color={data.open_ncrs > 0 ? COLORS.red : COLORS.green}
            />
            <MetricCard
              label="Overdue CAPAs"
              value={data.overdue_capas}
              color={data.overdue_capas > 0 ? COLORS.red : COLORS.green}
            />
          </View>

          <Text style={s.sectionLabel}>INVENTORY</Text>
          <View style={s.metricsGrid}>
            <MetricCard
              label="Low Stock"
              value={data.low_stock_items}
              color={data.low_stock_items > 0 ? COLORS.amber : COLORS.green}
            />
            <MetricCard
              label="Zero Stock"
              value={data.zero_stock_items}
              color={data.zero_stock_items > 0 ? COLORS.red : COLORS.green}
            />
          </View>

          <Text style={s.sectionLabel}>DOCUMENTS</Text>
          <View style={s.metricsGrid}>
            <MetricCard
              label="Pending Review"
              value={data.pending_docs_review}
              color={data.pending_docs_review > 0 ? COLORS.amber : COLORS.green}
            />
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content:{ paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  headerSub:   { color: COLORS.sky, fontSize: 13, fontWeight: '600', marginTop: 1 },
  bellBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bellIcon:    { fontSize: 24 },

  sectionLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 20, marginBottom: 8 },

  metricsGrid: { flexDirection: 'row', gap: 12 },
  metricCard:  { flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16, alignItems: 'center' },
  metricValue: { color: COLORS.text, fontSize: 32, fontWeight: '800' },
  metricLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  metricSub:   { color: COLORS.muted, fontSize: 11, marginTop: 2 },

  complianceCard:   { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginTop: 8 },
  complianceTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  complianceLabel:  { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  compliancePct:    { fontSize: 22, fontWeight: '800' },
  complianceBarBg:  { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  complianceBarFill:{ height: 6, borderRadius: 3 },

  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
