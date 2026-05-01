import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import api, { Ncr, Capa, Audit, QmsSection } from '../../services/api';
import { COLORS } from '../../constants/theme';

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: COLORS.red,
  HIGH:     COLORS.red,
  MEDIUM:   COLORS.amber,
  LOW:      COLORS.teal,
};

const AUDIT_TYPE_COLOR: Record<string, string> = {
  INTERNAL:   COLORS.sky,
  EXTERNAL:   COLORS.amber,
  REGULATORY: COLORS.red,
  SUPPLIER:   COLORS.teal,
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

function SeverityBadge({ severity }: { severity: string }) {
  const color = SEV_COLOR[severity?.toUpperCase()] ?? COLORS.muted;
  return (
    <View style={[s.badge, { borderColor: color }]}>
      <Text style={[s.badgeText, { color }]}>{severity}</Text>
    </View>
  );
}

function SectionCircle({ section }: { section: QmsSection }) {
  const color = (section as any).color_code ?? COLORS.sky;
  const pct = section.completion_percentage;
  return (
    <View style={s.circleWrapper}>
      <View style={[s.circle, { borderColor: color }]}>
        <Text style={[s.circlePercent, { color }]}>{pct}%</Text>
      </View>
      <Text style={s.circleCode} numberOfLines={1}>{(section as any).section_code ?? '—'}</Text>
      <Text style={s.circleCount}>{section.released_docs}/{section.total_docs}</Text>
    </View>
  );
}

function NcrRow({ ncr, onPress }: { ncr: Ncr; onPress: () => void }) {
  const age = daysAgo(ncr.created_at);
  return (
    <TouchableOpacity style={s.listRow} onPress={onPress} activeOpacity={0.75}>
      <View style={s.listRowTop}>
        <Text style={s.codeText}>{ncr.ncr_code}</Text>
        <SeverityBadge severity={ncr.severity} />
      </View>
      <Text style={s.descText} numberOfLines={2}>
        {ncr.description.substring(0, 80)}{ncr.description.length > 80 ? '…' : ''}
      </Text>
      <View style={s.listRowBottom}>
        <Text style={s.metaText}>
          {ncr.raised_by_name ?? 'Unknown'} · {age}d ago
        </Text>
        <Text style={s.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function CapaRow({ capa }: { capa: Capa }) {
  const overdue = daysUntil(capa.due_date);
  const isOverdue = overdue < 0;
  return (
    <View style={s.listRow}>
      <View style={s.listRowTop}>
        <Text style={s.codeText}>{capa.capa_code}</Text>
        <Text style={[s.overdueBadge, { color: isOverdue ? COLORS.red : COLORS.amber }]}>
          {isOverdue ? `${Math.abs(overdue)}d overdue` : `due ${formatDate(capa.due_date)}`}
        </Text>
      </View>
      <Text style={s.descText} numberOfLines={2}>{capa.action_description}</Text>
      <Text style={s.metaText}>{capa.owner_name ?? 'Unassigned'}</Text>
    </View>
  );
}

function AuditCard({ audit }: { audit: Audit }) {
  const color = AUDIT_TYPE_COLOR[audit.audit_type] ?? COLORS.muted;
  const daysLeft = daysUntil(audit.audit_date);
  return (
    <View style={[s.auditCard, { borderLeftColor: color }]}>
      <View style={s.auditRow}>
        <View style={[s.auditTypePill, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[s.auditTypeText, { color }]}>{audit.audit_type}</Text>
        </View>
        <Text style={s.auditDate}>{formatDate(audit.audit_date)}</Text>
      </View>
      <Text style={s.auditScope} numberOfLines={1}>{audit.scope}</Text>
      <View style={s.auditFooter}>
        <Text style={s.metaText}>{audit.lead_auditor_name ?? 'TBA'}</Text>
        <Text style={[s.daysLeft, { color: daysLeft <= 7 ? COLORS.amber : COLORS.muted }]}>
          {daysLeft > 0 ? `in ${daysLeft}d` : 'today'}
        </Text>
      </View>
    </View>
  );
}

function ComplianceBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? COLORS.green : pct >= 50 ? COLORS.amber : COLORS.red;
  return (
    <View style={s.complianceCard}>
      <View style={s.complianceTop}>
        <Text style={s.complianceLabel}>Overall Training Compliance</Text>
        <Text style={[s.compliancePct, { color }]}>{pct}%</Text>
      </View>
      <View style={s.complianceBarBg}>
        <View style={[s.complianceBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={s.complianceHint}>Full per-user breakdown on the People tab.</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function QualityScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['quality'],
    queryFn: api.getQuality,
    staleTime: 30_000,
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
          <Text style={s.errorText}>Failed to load quality data.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const auditsToShow = data.upcoming_audits.slice(0, 3);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={COLORS.sky} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.screenTitle}>Quality</Text>

        {/* 1 — QMS Readiness */}
        <SectionHeader title="QMS Readiness" count={data.qms_sections.length} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.circleScroll}>
          {data.qms_sections.map((sec) => (
            <SectionCircle key={sec.section_id} section={sec} />
          ))}
        </ScrollView>

        {/* 2 — Open NCRs */}
        <SectionHeader title="Open NCRs" count={data.open_ncrs.length} />
        {data.open_ncrs.length === 0 ? (
          <Text style={s.emptyText}>No open NCRs.</Text>
        ) : (
          <View style={s.card}>
            {data.open_ncrs.map((ncr, i) => (
              <View key={ncr.ncr_id}>
                {i > 0 && <View style={s.divider} />}
                <NcrRow
                  ncr={ncr}
                  onPress={() => router.push(`/ncr/${ncr.ncr_id}` as any)}
                />
              </View>
            ))}
          </View>
        )}

        {/* 3 — Overdue CAPAs */}
        <SectionHeader title="Overdue CAPAs" count={data.overdue_capas.length} />
        {data.overdue_capas.length === 0 ? (
          <Text style={s.emptyText}>No overdue CAPAs.</Text>
        ) : (
          <View style={s.card}>
            {data.overdue_capas.map((capa, i) => (
              <View key={capa.capa_id}>
                {i > 0 && <View style={s.divider} />}
                <CapaRow capa={capa} />
              </View>
            ))}
          </View>
        )}

        {/* 4 — Upcoming Audits */}
        <SectionHeader title="Upcoming Audits" count={auditsToShow.length} />
        {auditsToShow.length === 0 ? (
          <Text style={s.emptyText}>No upcoming audits scheduled.</Text>
        ) : (
          auditsToShow.map((audit) => (
            <AuditCard key={audit.audit_id} audit={audit} />
          ))
        )}

        {/* 5 — Training Compliance */}
        <SectionHeader title="Training Compliance" />
        <ComplianceBar pct={data.training_compliance_pct ?? 0} />

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

  card:      { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  divider:   { height: 1, backgroundColor: COLORS.border },
  emptyText: { color: COLORS.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 8 },

  badge:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // QMS section circles
  circleScroll:   { marginBottom: 4 },
  circleWrapper:  { alignItems: 'center', marginRight: 16, width: 72 },
  circle:         { width: 64, height: 64, borderRadius: 32, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, marginBottom: 6 },
  circlePercent:  { fontSize: 14, fontWeight: '800' },
  circleCode:     { color: COLORS.text, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  circleCount:    { color: COLORS.muted, fontSize: 10, textAlign: 'center' },

  // NCR / CAPA rows
  listRow:       { padding: 14 },
  listRowTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  listRowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  codeText:      { color: COLORS.sky, fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
  descText:      { color: COLORS.text, fontSize: 13, lineHeight: 18 },
  overdueBadge:  { fontSize: 12, fontWeight: '700' },
  metaText:      { color: COLORS.muted, fontSize: 12 },
  chevron:       { color: COLORS.muted, fontSize: 20 },

  // Audit cards
  auditCard:     { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, padding: 14, marginBottom: 10 },
  auditRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  auditTypePill: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  auditTypeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  auditDate:     { color: COLORS.muted, fontSize: 13 },
  auditScope:    { color: COLORS.text, fontSize: 14, fontWeight: '500', marginBottom: 8 },
  auditFooter:   { flexDirection: 'row', justifyContent: 'space-between' },
  daysLeft:      { fontSize: 12, fontWeight: '600' },

  // Training compliance
  complianceCard:  { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  complianceTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  complianceLabel: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  compliancePct:   { fontSize: 28, fontWeight: '800' },
  complianceBarBg: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  complianceBarFill:{ height: 8, borderRadius: 4 },
  complianceHint:  { color: COLORS.muted, fontSize: 12 },

  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
