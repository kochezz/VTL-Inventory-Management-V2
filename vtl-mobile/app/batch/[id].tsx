import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api, { BatchComponent, QAGate } from '../../services/api';
import { COLORS } from '../../constants/theme';
import VTLAppHeader from '../../components/VTLAppHeader';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function safeFormatDate(iso: string | null | undefined): string {
  return iso ? formatDate(iso) : '-';
}

function safeFormatDateTime(iso: string | null | undefined): string {
  return iso ? formatDateTime(iso) : '-';
}

const GATE_STATUS: Record<string, { icon: string; color: string }> = {
  APPROVED: { icon: 'OK', color: COLORS.green },
  REJECTED: { icon: 'X', color: COLORS.red },
  PENDING: { icon: '...', color: COLORS.amber },
};

const MAT_STATUS: Record<string, string> = {
  APPROVED: COLORS.green,
  REJECTED: COLORS.red,
  PENDING: COLORS.amber,
};

function InfoRow({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, mono && s.monoText]}>{value ?? '-'}</Text>
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
        <Text style={s.compName}>{item.component_name ?? '-'}</Text>
        <Text style={s.compMeta}>
          {item.sku ?? '-'} - {item.location_name ?? item.location_code ?? 'No location'}
        </Text>
        {item.supplier_batch_lot ? (
          <Text style={s.compLot}>Lot: {item.supplier_batch_lot}</Text>
        ) : null}
      </View>
      <View style={s.compRight}>
        <Text style={[s.compStatus, { color: statusColor }]}>{item.material_status ?? '-'}</Text>
        <Text style={s.compQty}>
          {item.quantity_assigned ?? 0} / {item.quantity_required ?? '-'}
        </Text>
      </View>
    </View>
  );
}

function GateRow({ gate, index, isLast }: { gate: QAGate; index: number; isLast: boolean }) {
  const cfg = GATE_STATUS[(gate.status ?? '').toUpperCase()] ?? { icon: '-', color: COLORS.muted };
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
          <Text style={s.gateName}>Gate {gate.gate_number ?? index + 1} - {gate.gate_name ?? '-'}</Text>
          <Text style={[s.gateStatusText, { color: cfg.color }]}>{gate.status ?? '-'}</Text>
        </View>
        {gate.approved_by_name && (
          <Text style={s.gateMeta}>
            {gate.approved_by_name} - {safeFormatDateTime(gate.approved_at)}
          </Text>
        )}
        {gate.rejection_reason && (
          <Text style={s.gateReason}>{gate.rejection_reason}</Text>
        )}
      </View>
    </View>
  );
}

export default function BatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: batch, isLoading, isError } = useQuery({
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

  if (isError || !batch) {
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

  const components = Array.isArray(batch?.components) ? batch.components : [];
  const qaGates = Array.isArray(batch?.qa_gates) ? batch.qa_gates : [];
  const ipqcChecks = Array.isArray(batch?.ipqc_checks) ? batch.ipqc_checks : [];
  void ipqcChecks;

  const title = batch.batch_number ?? batch.batch_record_code ?? 'Batch Detail';
  const productName = batch.product_name ?? '-';
  const sku = batch.sku ?? '-';
  const yieldValue = batch.yield_percentage;
  const yieldColor = (yieldValue ?? 0) >= 95 ? COLORS.green
    : (yieldValue ?? 0) >= 85 ? COLORS.amber
    : COLORS.red;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <VTLAppHeader
        title={title}
        subtitle={productName}
        showBack
      />
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.batchNumber}>{batch.batch_number ?? batch.batch_record_code ?? '-'}</Text>
        <Text style={s.productName}>{productName}</Text>
        <Text style={s.skuText}>{sku}</Text>

        <View style={s.metricsRow}>
          <View style={s.metricBox}>
            <Text style={s.metricValue}>{batch.planned_quantity ?? '-'}</Text>
            <Text style={s.metricLabel}>Planned</Text>
          </View>
          <View style={[s.metricBox, s.metricBorder]}>
            <Text style={s.metricValue}>{batch.actual_output ?? '-'}</Text>
            <Text style={s.metricLabel}>Output</Text>
          </View>
          <View style={[s.metricBox, s.metricBorder]}>
            <Text style={s.metricValue}>{batch.rejected_bottles ?? 0}</Text>
            <Text style={s.metricLabel}>Rejected</Text>
          </View>
          <View style={[s.metricBox, s.metricBorder]}>
            <Text style={[s.metricValue, { color: yieldColor }]}>
              {yieldValue != null ? `${yieldValue}%` : '-'}
            </Text>
            <Text style={s.metricLabel}>Yield</Text>
          </View>
        </View>

        <SectionHeader title="Batch Information" />
        <View style={s.card}>
          <InfoRow label="Record Code" value={batch.batch_record_code ?? batch.batch_number ?? '-'} mono />
          <InfoRow label="Production Date" value={safeFormatDate(batch.production_date)} />
          <InfoRow label="Production Line" value={batch.production_line ?? '-'} />
          <InfoRow label="Shift" value={batch.shift ?? '-'} />
          <InfoRow label="Supervisor" value={batch.line_supervisor_name ?? '-'} />
          <InfoRow label="Created By" value={batch.created_by_name ?? '-'} />
          <InfoRow label="Created" value={safeFormatDateTime(batch.created_at)} />
        </View>

        <SectionHeader title={`Components (${components.length})`} />
        {components.length === 0 ? (
          <Text style={s.emptyText}>No components recorded.</Text>
        ) : (
          <View style={s.card}>
            {components.map((item, index) => (
              <View key={`component-${item.component_id ?? item.product_id ?? item.sku ?? index}-${index}`}>
                {index > 0 && <View style={s.divider} />}
                <ComponentRow item={item} />
              </View>
            ))}
          </View>
        )}

        <SectionHeader title={`QA Gates (${qaGates.length})`} />
        {qaGates.length === 0 ? (
          <Text style={s.emptyText}>No QA gates recorded.</Text>
        ) : (
          <View style={s.gatesCard}>
            {qaGates.map((item, index) => (
              <GateRow
                key={`qa-gate-${item.gate_id ?? item.qa_gate_id ?? item.gate_name ?? index}-${index}`}
                gate={item}
                index={index}
                isLast={index === qaGates.length - 1}
              />
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  batchNumber: { color: COLORS.sky, fontFamily: 'monospace', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  productName: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 2 },
  skuText: { color: COLORS.muted, fontSize: 13, marginBottom: 20 },

  metricsRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  metricBox: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  metricBorder: { borderLeftWidth: 1, borderLeftColor: COLORS.border },
  metricValue: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  metricLabel: { color: COLORS.muted, fontSize: 11 },

  sectionTitle: { color: COLORS.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 20 },

  card: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: COLORS.border },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  infoLabel: { color: COLORS.muted, fontSize: 13 },
  infoValue: { color: COLORS.text, fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  monoText: { fontFamily: 'monospace', color: COLORS.sky },

  compRow: { flexDirection: 'row', padding: 14 },
  compLeft: { flex: 1, marginRight: 10 },
  compName: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 3 },
  compMeta: { color: COLORS.muted, fontSize: 12, marginBottom: 2 },
  compLot: { color: COLORS.muted, fontSize: 11, fontStyle: 'italic' },
  compRight: { alignItems: 'flex-end' },
  compStatus: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  compQty: { color: COLORS.text, fontSize: 13, fontWeight: '600' },

  gatesCard: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  gateRow: { flexDirection: 'row', marginBottom: 4 },
  gateTrack: { alignItems: 'center', width: 32, marginRight: 12 },
  gateDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gateDotIcon: { color: '#fff', fontSize: 10, fontWeight: '700' },
  gateLine: { width: 2, flex: 1, minHeight: 16, marginVertical: 4 },
  gateContent: { flex: 1, paddingBottom: 16 },
  gateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  gateName: { color: COLORS.text, fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  gateStatusText: { fontSize: 11, fontWeight: '700' },
  gateMeta: { color: COLORS.muted, fontSize: 12 },
  gateReason: { color: COLORS.red, fontSize: 12, marginTop: 4, fontStyle: 'italic' },

  emptyText: { color: COLORS.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  errorText: { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: COLORS.sky, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
});
