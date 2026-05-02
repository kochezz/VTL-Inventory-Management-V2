import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api, { BatchDetail, BatchComponent, QAGate } from '../../services/api';
import { COLORS } from '../../constants/theme';
import VTLAppHeader from '../../components/VTLAppHeader';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const DISPLAY_STATUS: Record<string, { label: string; color: string }> = {
  in_progress:  { label: 'IN PROGRESS',  color: COLORS.sky   },
  awaiting_qa:  { label: 'AWAITING QA',  color: COLORS.amber },
  completed:    { label: 'COMPLETED',    color: COLORS.green },
  planned:      { label: 'PLANNED',      color: COLORS.teal  },
  rejected:     { label: 'REJECTED',     color: COLORS.red   },
  cancelled:    { label: 'CANCELLED',    color: COLORS.muted },
};

const GATE_STATUS: Record<string, { icon: string; color: string }> = {
  APPROVED:  { icon: '✓', color: COLORS.green },
  REJECTED:  { icon: '✗', color: COLORS.red   },
  PENDING:   { icon: '◷', color: COLORS.amber },
};

const MAT_STATUS: Record<string, string> = {
  APPROVED:  COLORS.green,
  REJECTED:  COLORS.red,
  PENDING:   COLORS.amber,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string | number | null; mono?: boolean }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, mono && s.monoText]}>{value ?? '—'}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

function ComponentRow({ item }: { item: BatchComponent }) {
  const statusColor = MAT_STATUS[item.material_status] ?? COLORS.muted;
  return (
    <View style={s.compRow}>
      <View style={s.compLeft}>
        <Text style={s.compName}>{item.component_name}</Text>
        <Text style={s.compMeta}>
          {item.sku} · {item.location_name ?? item.location_code ?? 'No location'}
        </Text>
        {item.supplier_batch_lot ? (
          <Text style={s.compLot}>Lot: {item.supplier_batch_lot}</Text>
        ) : null}
      </View>
      <View style={s.compRight}>
        <Text style={[s.compStatus, { color: statusColor }]}>{item.material_status}</Text>
        <Text style={s.compQty}>
          {item.quantity_assigned ?? 0} / {item.quantity_required}
        </Text>
      </View>
    </View>
  );
}

function GateRow({ gate, index }: { gate: QAGate; index: number }) {
  const cfg = GATE_STATUS[gate.status?.toUpperCase()] ?? { icon: '○', color: COLORS.muted };
  const isLast = index === 2;
  return (
    <View style={s.gateRow}>
      <View style={s.gateTrack}>
        <View style={[s.gateDot, { backgroundColor: cfg.color }]}>
          <Text style={s.gateDotIcon}>{cfg.icon}</Text>
        </View>
        {!isLast && <View style={[s.gateLine, { backgroundColor: cfg.color === COLORS.green ? COLORS.green : COLORS.border }]} />}
      </View>
      <View style={s.gateContent}>
        <View style={s.gateHeader}>
          <Text style={s.gateName}>Gate {gate.gate_number} — {gate.gate_name}</Text>
          <Text style={[s.gateStatusText, { color: cfg.color }]}>{gate.status}</Text>
        </View>
        {gate.approved_by_name && (
          <Text style={s.gateMeta}>
            {gate.approved_by_name} · {gate.approved_at ? formatDateTime(gate.approved_at) : ''}
          </Text>
        )}
        {gate.rejection_reason && (
          <Text style={s.gateReason}>{gate.rejection_reason}</Text>
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['batch', id],
    queryFn: () => api.getBatch(id),
    enabled: !!id,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.center}>
          <ActivityIndicator color={COLORS.sky} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.center}>
          <Text style={s.errorText}>Batch not found.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => router.back()}>
            <Text style={s.retryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const yieldColor = (data.yield_percentage ?? 0) >= 95 ? COLORS.green
    : (data.yield_percentage ?? 0) >= 85 ? COLORS.amber
    : COLORS.red;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <VTLAppHeader
        title={data.batch_number ?? 'Batch Detail'}
        subtitle={data.product_name ?? ''}
        showBack
      />
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Batch identity */}
        <Text style={s.batchNumber}>{data.batch_number}</Text>
        <Text style={s.productName}>{data.product_name}</Text>
        <Text style={s.skuText}>{data.sku}</Text>

        {/* Key metrics row */}
        <View style={s.metricsRow}>
          <View style={s.metricBox}>
            <Text style={s.metricValue}>{data.planned_quantity ?? '—'}</Text>
            <Text style={s.metricLabel}>Planned</Text>
          </View>
          <View style={[s.metricBox, s.metricBorder]}>
            <Text style={s.metricValue}>{data.actual_output ?? '—'}</Text>
            <Text style={s.metricLabel}>Output</Text>
          </View>
          <View style={[s.metricBox, s.metricBorder]}>
            <Text style={s.metricValue}>{data.rejected_bottles ?? 0}</Text>
            <Text style={s.metricLabel}>Rejected</Text>
          </View>
          <View style={[s.metricBox, s.metricBorder]}>
            <Text style={[s.metricValue, { color: yieldColor }]}>
              {data.yield_percentage != null ? `${data.yield_percentage}%` : '—'}
            </Text>
            <Text style={s.metricLabel}>Yield</Text>
          </View>
        </View>

        {/* Batch details */}
        <SectionHeader title="Batch Information" />
        <View style={s.card}>
          <InfoRow label="Record Code"      value={data.batch_record_code} mono />
          <InfoRow label="Production Date"  value={data.production_date ? formatDate(data.production_date) : null} />
          <InfoRow label="Production Line"  value={data.production_line} />
          <InfoRow label="Shift"            value={data.shift} />
          <InfoRow label="Supervisor"       value={data.line_supervisor_name} />
          <InfoRow label="Created By"       value={data.created_by_name} />
          <InfoRow label="Created"          value={data.created_at ? formatDateTime(data.created_at) : null} />
        </View>

        {/* Components */}
        <SectionHeader title={`Components (${data.components?.length ?? 0})`} />
        {(!data.components || data.components.length === 0) ? (
          <Text style={s.emptyText}>No components recorded.</Text>
        ) : (
          <View style={s.card}>
            {data.components.map((comp, i) => (
              <View key={comp.component_id ?? i}>
                {i > 0 && <View style={s.divider} />}
                <ComponentRow item={comp} />
              </View>
            ))}
          </View>
        )}

        {/* QA Gates */}
        <SectionHeader title={`QA Gates (${data.qa_gates?.length ?? 0})`} />
        {(!data.qa_gates || data.qa_gates.length === 0) ? (
          <Text style={s.emptyText}>No QA gates recorded.</Text>
        ) : (
          <View style={s.gatesCard}>
            {data.qa_gates.map((gate, i) => (
              <GateRow key={gate.gate_id} gate={gate} index={i} />
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
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  batchNumber:  { color: COLORS.sky, fontFamily: 'monospace', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  productName:  { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 2 },
  skuText:      { color: COLORS.muted, fontSize: 13, marginBottom: 20 },

  metricsRow:  { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  metricBox:   { flex: 1, alignItems: 'center', paddingVertical: 16 },
  metricBorder:{ borderLeftWidth: 1, borderLeftColor: COLORS.border },
  metricValue: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  metricLabel: { color: COLORS.muted, fontSize: 11 },

  sectionTitle: { color: COLORS.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 20 },

  card:    { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: COLORS.border },

  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  infoLabel: { color: COLORS.muted, fontSize: 13 },
  infoValue: { color: COLORS.text, fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  monoText:  { fontFamily: 'monospace', color: COLORS.sky },

  compRow:   { flexDirection: 'row', padding: 14 },
  compLeft:  { flex: 1, marginRight: 10 },
  compName:  { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 3 },
  compMeta:  { color: COLORS.muted, fontSize: 12, marginBottom: 2 },
  compLot:   { color: COLORS.muted, fontSize: 11, fontStyle: 'italic' },
  compRight: { alignItems: 'flex-end' },
  compStatus:{ fontSize: 11, fontWeight: '700', marginBottom: 4 },
  compQty:   { color: COLORS.text, fontSize: 13, fontWeight: '600' },

  gatesCard:    { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  gateRow:      { flexDirection: 'row', marginBottom: 4 },
  gateTrack:    { alignItems: 'center', width: 32, marginRight: 12 },
  gateDot:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gateDotIcon:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  gateLine:     { width: 2, flex: 1, minHeight: 16, marginVertical: 4 },
  gateContent:  { flex: 1, paddingBottom: 16 },
  gateHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  gateName:     { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  gateStatusText:{ fontSize: 11, fontWeight: '700' },
  gateMeta:     { color: COLORS.muted, fontSize: 12 },
  gateReason:   { color: COLORS.red, fontSize: 12, marginTop: 4, fontStyle: 'italic' },

  emptyText:   { color: COLORS.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
