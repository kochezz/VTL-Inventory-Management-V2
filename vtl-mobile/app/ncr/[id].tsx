import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { NCRDetail } from '../../services/api';
import { COLORS } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import SignatureBottomSheet, { SheetField } from '../../components/SignatureBottomSheet';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: COLORS.red,
  HIGH:     COLORS.red,
  MEDIUM:   COLORS.amber,
  LOW:      COLORS.teal,
};

const STATUS_COLOR: Record<string, string> = {
  OPEN:          COLORS.red,
  IN_PROGRESS:   COLORS.sky,
  CAPA_REQUIRED: COLORS.amber,
  CLOSED:        COLORS.green,
};

const APPROVER_ROLES = ['admin', 'qa', 'manager', 'ceo', 'cfo'];

const NCR_STATUS_FIELDS: SheetField[] = [
  {
    key: 'status',
    label: 'New Status',
    type: 'select',
    options: [
      { label: 'Open', value: 'OPEN' },
      { label: 'In Progress', value: 'IN_PROGRESS' },
      { label: 'CAPA Required', value: 'CAPA_REQUIRED' },
      { label: 'Closed', value: 'CLOSED' },
    ],
  },
  { key: 'root_cause', label: 'Root Cause', type: 'textarea', placeholder: 'Describe root cause…', optional: true },
  { key: 'resolution', label: 'Resolution', type: 'textarea', placeholder: 'Describe resolution taken…', optional: true },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function LabeledBlock({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={s.block}>
      <Text style={s.blockLabel}>{label}</Text>
      <Text style={s.blockValue}>{value?.trim() || '—'}</Text>
    </View>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string | null; color?: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, color ? { color } : null]}>{value ?? '—'}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NCRDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const toast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);

  const userRole = (user?.role as string) ?? '';
  const canApprove = APPROVER_ROLES.includes(userRole);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ncr', id],
    queryFn: () => api.getNCR(id),
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
          <Text style={s.errorText}>NCR not found.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => router.back()}>
            <Text style={s.retryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sevColor    = SEV_COLOR[(data.severity ?? '').toUpperCase()] ?? COLORS.muted;
  const statusColor = STATUS_COLOR[(data.status ?? '').toUpperCase()] ?? COLORS.muted;
  const isClosed    = (data.status ?? '').toUpperCase() === 'CLOSED';

  const handleUpdateNCR = async (values: Record<string, string>) => {
    await api.approveNCR(id, {
      status:             values.status,
      root_cause:         values.root_cause || undefined,
      resolution:         values.resolution || undefined,
      signature_password: values.signature_password,
    });
    await queryClient.invalidateQueries({ queryKey: ['ncr', id] });
    await queryClient.invalidateQueries({ queryKey: ['quality'] });
    toast.show('NCR updated successfully');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={s.headerBadges}>
          <View style={[s.pill, { borderColor: sevColor }]}>
            <Text style={[s.pillText, { color: sevColor }]}>{data.severity}</Text>
          </View>
          <View style={[s.pill, { borderColor: statusColor, marginLeft: 8 }]}>
            <Text style={[s.pillText, { color: statusColor }]}>{data.status}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Identity */}
        <Text style={s.ncrCode}>{data.ncr_code}</Text>

        {/* Description */}
        <View style={s.descCard}>
          <Text style={s.descLabel}>DESCRIPTION</Text>
          <Text style={s.descText}>{data.description}</Text>
        </View>

        {/* People & dates */}
        <Text style={s.sectionTitle}>Details</Text>
        <View style={s.card}>
          <InfoRow label="Raised By"   value={data.raised_by_name} />
          <View style={s.divider} />
          <InfoRow label="Assigned To" value={data.assigned_to_name} />
          <View style={s.divider} />
          <InfoRow label="Opened"      value={data.created_at ? formatDateTime(data.created_at) : null} />
          {data.updated_at && (
            <>
              <View style={s.divider} />
              <InfoRow label="Last Updated" value={formatDateTime(data.updated_at)} />
            </>
          )}
          {isClosed && data.closed_at && (
            <>
              <View style={s.divider} />
              <InfoRow label="Closed" value={formatDateTime(data.closed_at)} color={COLORS.green} />
            </>
          )}
        </View>

        {/* Investigation */}
        <Text style={s.sectionTitle}>Investigation</Text>
        <View style={s.card}>
          <LabeledBlock label="ROOT CAUSE" value={data.root_cause} />
          {data.resolution && (
            <>
              <View style={s.divider} />
              <LabeledBlock label="RESOLUTION" value={data.resolution} />
            </>
          )}
        </View>

        {/* Update action — authorized roles only */}
        {canApprove && !isClosed && (
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => setSheetOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={s.actionBtnText}>Update Status</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Bottom sheet */}
      <SignatureBottomSheet
        visible={sheetOpen}
        title={`Update ${data.ncr_code}`}
        fields={NCR_STATUS_FIELDS}
        submitLabel="Update NCR"
        onSubmit={handleUpdateNCR}
        onClose={() => setSheetOpen(false)}
      />

      {/* Toast */}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:      { padding: 4 },
  backText:     { color: COLORS.sky, fontSize: 17, fontWeight: '600' },
  headerBadges: { flexDirection: 'row', alignItems: 'center' },
  pill:         { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  pillText:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  ncrCode: { color: COLORS.sky, fontFamily: 'monospace', fontSize: 24, fontWeight: '800', marginBottom: 16 },

  descCard:  { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 24 },
  descLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  descText:  { color: COLORS.text, fontSize: 15, lineHeight: 22 },

  sectionTitle: { color: COLORS.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },

  card:    { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 16 },
  divider: { height: 1, backgroundColor: COLORS.border },

  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  infoLabel: { color: COLORS.muted, fontSize: 13 },
  infoValue: { color: COLORS.text, fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },

  block:       { padding: 14 },
  blockLabel:  { color: COLORS.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  blockValue:  { color: COLORS.text, fontSize: 14, lineHeight: 20 },

  actionBtn:     { backgroundColor: COLORS.sky, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 8 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
