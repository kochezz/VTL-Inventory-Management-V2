import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useQuality } from '../../hooks/useQuality';
import api, { Ncr, Capa, Audit, DocInReview } from '../../services/api';
import { COLORS, RADIUS, zebraRow } from '../../constants/theme';
import VTLAppHeader from '../../components/VTLAppHeader';
import { useAuthStore } from '../../stores/authStore';
import SignatureBottomSheet, { SheetField } from '../../components/SignatureBottomSheet';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { SkeletonRow } from '../../components/SkeletonLoader';

// ── Types & constants ─────────────────────────────────────────────────────────

type QualityTab = 'ncrs' | 'capas' | 'audits' | 'training';

const APPROVER_ROLES = ['admin', 'qa', 'manager', 'ceo', 'cfo'];

const CAPA_STATUS_FIELDS: SheetField[] = [
  {
    key: 'status',
    label: 'New Status',
    type: 'select',
    options: [
      { label: 'In Progress', value: 'IN_PROGRESS' },
      { label: 'Verified',    value: 'VERIFIED'    },
      { label: 'Closed',      value: 'CLOSED'      },
    ],
  },
  {
    key: 'effectiveness_review',
    label: 'Effectiveness Review',
    type: 'textarea',
    placeholder: 'Was the corrective action effective? Evidence…',
    optional: true,
  },
];

const SEV_LEFT_COLOR: Record<string, string> = {
  CRITICAL: COLORS.red,
  MAJOR:    COLORS.amber,
  MINOR:    COLORS.sky,
};

const AUDIT_TYPE_COLOR: Record<string, string> = {
  INTERNAL:   COLORS.sky,
  EXTERNAL:   COLORS.amber,
  REGULATORY: COLORS.red,
  SUPPLIER:   COLORS.teal,
};

const DOC_TYPE_COLOR: Record<string, string> = {
  SOP: COLORS.sky,
  POL: COLORS.teal,
  MAN: COLORS.amber,
  FRM: COLORS.muted,
  CHK: COLORS.muted,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

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
  const MAP: Record<string, string> = {
    CRITICAL: COLORS.red,   HIGH: COLORS.red,
    MAJOR:    COLORS.amber, MEDIUM: COLORS.amber,
    MINOR:    COLORS.sky,   LOW: COLORS.teal,
  };
  const color = MAP[(severity ?? '').toUpperCase()] ?? COLORS.muted;
  return (
    <View style={[s.badge, { borderColor: color }]}>
      <Text style={[s.badgeText, { color }]}>{(severity ?? '').toUpperCase()}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const MAP: Record<string, string> = {
    OPEN:        COLORS.red,   IN_PROGRESS: COLORS.sky,
    CLOSED:      COLORS.green, VERIFIED:    COLORS.teal,
    PENDING:     COLORS.amber, SCHEDULED:   COLORS.sky,
    COMPLETED:   COLORS.green,
  };
  const color = MAP[(status ?? '').toUpperCase()] ?? COLORS.muted;
  return (
    <View style={[s.badge, { borderColor: color }]}>
      <Text style={[s.badgeText, { color }]}>{(status ?? '').replace(/_/g, ' ')}</Text>
    </View>
  );
}

function NcrRow({ ncr, onPress }: { ncr: Ncr; onPress: () => void }) {
  const leftColor = SEV_LEFT_COLOR[(ncr.severity ?? '').toUpperCase()] ?? COLORS.border;
  const age = Math.floor((Date.now() - new Date(ncr.created_at).getTime()) / 86_400_000);
  return (
    <TouchableOpacity
      style={[s.listRow, { borderLeftWidth: 3, borderLeftColor: leftColor }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={s.listRowTop}>
        <Text style={s.codeText}>{ncr.ncr_code}</Text>
        <SeverityBadge severity={ncr.severity} />
      </View>
      <Text style={s.descText} numberOfLines={2}>{ncr.description}</Text>
      <Text style={s.metaText}>Raised by {ncr.raised_by_name ?? 'Unknown'} · {age}d ago</Text>
      <View style={{ marginTop: 6 }}>
        <StatusBadge status={ncr.status} />
      </View>
    </TouchableOpacity>
  );
}

function CapaRow({
  capa,
  canApprove,
  onClose,
}: {
  capa: Capa;
  canApprove: boolean;
  onClose: () => void;
}) {
  const days = daysUntil(capa.due_date);
  const isOverdue = days < 0;
  const leftColor = isOverdue ? COLORS.red : days < 7 ? COLORS.amber : COLORS.green;
  return (
    <View style={[s.listRow, { borderLeftWidth: 3, borderLeftColor: leftColor }]}>
      <View style={s.listRowTop}>
        <Text style={s.codeText}>{capa.capa_code}</Text>
        <StatusBadge status={capa.status} />
      </View>
      <Text style={s.descText} numberOfLines={2}>{capa.action_description}</Text>
      <Text style={s.metaText}>Owner: {capa.owner_name ?? 'Unassigned'}</Text>
      <View style={s.listRowBottom}>
        <Text style={[s.dueDateText, { color: isOverdue ? COLORS.red : COLORS.amber }]}>
          {isOverdue ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
        </Text>
        {canApprove && (
          <TouchableOpacity style={s.inlineBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.inlineBtnText}>Close CAPA</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function AuditCard({ audit }: { audit: Audit }) {
  const color = AUDIT_TYPE_COLOR[(audit.audit_type ?? '').toUpperCase()] ?? COLORS.muted;
  return (
    <View style={[s.listRow, { borderLeftWidth: 3, borderLeftColor: COLORS.teal }]}>
      <View style={s.listRowTop}>
        <View style={[s.typePill, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[s.typePillText, { color }]}>{audit.audit_type}</Text>
        </View>
        <Text style={s.metaText}>{formatDate(audit.audit_date)}</Text>
      </View>
      <Text style={s.descText} numberOfLines={2}>{audit.scope}</Text>
      <View style={s.listRowBottom}>
        <Text style={s.metaText}>{audit.lead_auditor_name ?? 'TBA'}</Text>
        <StatusBadge status={audit.status} />
      </View>
    </View>
  );
}

function DocRow({
  doc,
  canApprove,
  onRelease,
}: {
  doc: DocInReview;
  canApprove: boolean;
  onRelease: () => void;
}) {
  const typeColor = DOC_TYPE_COLOR[doc.doc_type] ?? COLORS.muted;
  const isPendingApproval = doc.status === 'PENDING_APPROVAL';
  return (
    <View style={s.docRow}>
      <View style={[s.typePill, { backgroundColor: typeColor + '22', borderColor: typeColor }]}>
        <Text style={[s.typePillText, { color: typeColor }]}>{doc.doc_type}</Text>
      </View>
      <View style={s.docMid}>
        <Text style={s.codeText}>{doc.doc_code}</Text>
        <Text style={s.descText} numberOfLines={1}>{doc.doc_name}</Text>
        <Text style={s.metaText}>
          {doc.author_name ?? 'Unknown'} · v{doc.version_number ?? '?'} ·{' '}
          <Text style={{ color: isPendingApproval ? COLORS.amber : COLORS.sky }}>
            {isPendingApproval ? 'Pending Approval' : 'In Review'}
          </Text>
        </Text>
      </View>
      {canApprove && isPendingApproval && (
        <TouchableOpacity style={s.releaseBtn} onPress={onRelease} activeOpacity={0.8}>
          <Text style={s.releaseBtnText}>Release</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function QualityScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const toast = useToast();

  const userRole = (user?.role as string) ?? '';
  const canApprove = APPROVER_ROLES.includes(userRole);

  const [activeTab, setActiveTab] = useState<QualityTab>('ncrs');
  const [capaSheet, setCapaSheet] = useState<Capa | null>(null);
  const [docSheet, setDocSheet] = useState<DocInReview | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuality();

  // Secondary people query for Training tab leaderboard (shares cache with People tab)
  const { data: peopleData } = useQuery({
    queryKey: ['people'],
    queryFn: api.getPeople,
    staleTime: 300_000,
  });

  const handleCloseCAPA = async (values: Record<string, string>) => {
    if (!capaSheet) return;
    await api.approveCAPA(capaSheet.capa_id, {
      status:               values.status,
      effectiveness_review: values.effectiveness_review || undefined,
      signature_password:   values.signature_password,
    });
    await queryClient.invalidateQueries({ queryKey: ['quality'] });
    toast.show(`CAPA ${capaSheet.capa_code} closed`);
  };

  const handleReleaseDoc = async (values: Record<string, string>) => {
    if (!docSheet?.current_version_id) return;
    const result = await api.releaseDocument(docSheet.current_version_id, {
      signature_password: values.signature_password,
    });
    await queryClient.invalidateQueries({ queryKey: ['quality'] });
    toast.show(result.message ?? `${docSheet.doc_code} released`);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <VTLAppHeader title="Quality Management" subtitle="QMS · NCR · CAPA · Audits" />
        <View style={{ padding: 16 }}>
          {[...Array(5)].map((_, i) => (
            <SkeletonRow key={`quality-skeleton-${i}`} style={{ marginBottom: 12 }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <VTLAppHeader title="Quality Management" subtitle="QMS · NCR · CAPA · Audits" />
        <View style={s.center}>
          <Text style={s.errorText}>Failed to load quality data.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // QMS metrics computed from sections
  const qmsPct = data.qms_sections.length > 0
    ? Math.round(
        data.qms_sections.reduce((sum, s) => sum + s.completion_percentage, 0) /
        data.qms_sections.length,
      )
    : 0;
  const totalDocs    = data.qms_sections.reduce((sum, s) => sum + s.total_docs, 0);
  const releasedDocs = data.qms_sections.reduce((sum, s) => sum + s.released_docs, 0);
  const heroColor    = qmsPct >= 80 ? COLORS.green : qmsPct >= 50 ? COLORS.amber : COLORS.red;

  // Training leaderboard from cached people data
  const top10    = peopleData?.training_leaderboard.top_10 ?? [];
  const maxCount = top10.length > 0 ? Math.max(...top10.map((u) => u.acknowledged_count), 1) : 1;

  const docsInReview = data.docs_in_review ?? [];

  // Sort CAPAs overdue-first (most overdue first)
  const sortedCapas = [...data.overdue_capas].sort(
    (a, b) => daysUntil(a.due_date) - daysUntil(b.due_date),
  );

  const TABS: { key: QualityTab; label: string }[] = [
    { key: 'ncrs',     label: 'NCRs'     },
    { key: 'capas',    label: 'CAPAs'    },
    { key: 'audits',   label: 'Audits'   },
    { key: 'training', label: 'Training' },
  ];

  const compPct = data.training_compliance_pct ?? 0;
  const compColor = compPct >= 80 ? COLORS.green : compPct >= 60 ? COLORS.amber : COLORS.red;

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <VTLAppHeader title="Quality Management" subtitle="QMS · NCR · CAPA · Audits" />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={COLORS.sky} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── QMS Readiness Hero ── */}
        <View style={[s.hero, { borderTopColor: heroColor }]}>
          <View style={s.heroLeft}>
            <Text style={[s.heroPercent, { color: heroColor }]}>{qmsPct}%</Text>
            <Text style={s.heroLabel}>QMS Readiness</Text>
            <Text style={s.heroSub}>{releasedDocs} of {totalDocs} documents released</Text>
          </View>
          <View style={[s.heroRing, { borderColor: heroColor }]}>
            <Text style={[s.heroRingNum, { color: heroColor }]}>{qmsPct}</Text>
          </View>
        </View>

        {/* ── Section Progress List ── */}
        <SectionHeader title="By Department" />
        {data.qms_sections.map((sec) => {
          const pct = sec.completion_percentage;
          return (
            <View key={`qms-section-${sec.section_id ?? sec.section_name}-${sec.section_name}`} style={s.secRow}>
              <View style={s.secCodeChip}>
                <Text style={s.secCode} numberOfLines={1}>
                  {sec.section_name.slice(0, 3).toUpperCase()}
                </Text>
              </View>
              <Text style={s.secName} numberOfLines={1}>{sec.section_name}</Text>
              <View style={s.secBarBg}>
                <View style={[s.secBarFill, { width: `${pct}%` as any }]} />
              </View>
              <Text style={s.secPct}>{pct}%</Text>
            </View>
          );
        })}

        {/* ── Sub-tab Pills ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabScroll}
          style={s.tabScrollOuter}
        >
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabPill, activeTab === t.key && s.tabPillActive]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabLabel, activeTab === t.key && s.tabLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── NCRs Tab ── */}
        {activeTab === 'ncrs' && (
          <>
            {docsInReview.length > 0 && (
              <>
                <SectionHeader title="Documents in Review" count={docsInReview.length} />
                <View style={s.card}>
                  {docsInReview.map((doc, i) => (
                    <View key={`doc-${doc.doc_id ?? doc.current_version_id ?? doc.doc_code ?? i}-${doc.current_version_id ?? doc.version_number ?? i}`}>
                      {i > 0 && <View style={s.divider} />}
                      <DocRow doc={doc} canApprove={canApprove} onRelease={() => setDocSheet(doc)} />
                    </View>
                  ))}
                </View>
              </>
            )}

            <SectionHeader title="Open NCRs" count={data.open_ncrs.length} />
            {data.open_ncrs.length === 0 ? (
              <Text style={s.emptyText}>No open NCRs.</Text>
            ) : (
              <View style={s.card}>
                {data.open_ncrs.map((ncr, i) => (
                  <View key={`ncr-${ncr.ncr_id ?? ncr.ncr_code ?? i}-${ncr.ncr_code ?? i}`}>
                    {i > 0 && <View style={s.divider} />}
                    <NcrRow ncr={ncr} onPress={() => router.push(`/ncr/${ncr.ncr_id}` as any)} />
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── CAPAs Tab ── */}
        {activeTab === 'capas' && (
          <>
            <SectionHeader title="Overdue CAPAs" count={sortedCapas.length} />
            {sortedCapas.length === 0 ? (
              <Text style={s.emptyText}>No overdue CAPAs.</Text>
            ) : (
              <View style={s.card}>
                {sortedCapas.map((capa, i) => (
                  <View key={`capa-${capa.capa_id ?? capa.capa_code ?? i}-${capa.capa_code ?? i}`}>
                    {i > 0 && <View style={s.divider} />}
                    <CapaRow
                      capa={capa}
                      canApprove={canApprove}
                      onClose={() => setCapaSheet(capa)}
                    />
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── Audits Tab ── */}
        {activeTab === 'audits' && (
          <>
            <SectionHeader title="Upcoming Audits" count={data.upcoming_audits.length} />
            {data.upcoming_audits.length === 0 ? (
              <Text style={s.emptyText}>No upcoming audits scheduled.</Text>
            ) : (
              <View style={s.card}>
                {data.upcoming_audits.map((audit, i) => (
                  <View key={`audit-${audit.audit_id ?? audit.audit_code ?? i}-${audit.audit_code ?? audit.audit_date ?? i}`}>
                    {i > 0 && <View style={s.divider} />}
                    <AuditCard audit={audit} />
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── Training Tab ── */}
        {activeTab === 'training' && (
          <>
            {/* Compliance bar */}
            <View style={s.complianceCard}>
              <View style={s.complianceTop}>
                <Text style={s.complianceLabel}>Training Compliance: {compPct}%</Text>
              </View>
              <View style={s.complianceBarBg}>
                <View
                  style={[s.complianceBarFill, {
                    width: `${compPct}%` as any,
                    backgroundColor: compColor,
                    height: 16,
                  }]}
                />
              </View>
            </View>

            {/* Leaderboard */}
            {top10.length > 0 && (
              <>
                <SectionHeader title="Training Leaderboard" count={top10.length} />
                <View style={s.card}>
                  {top10.map((u, i) => {
                    const relPct = Math.round((u.acknowledged_count / maxCount) * 100);
                    const isStrong = relPct >= 80;
                    const isWeak   = relPct < 50;
                    const barColor = isStrong ? COLORS.green : isWeak ? COLORS.red : COLORS.amber;
                    return (
                      <View key={`training-user-${u.user_id ?? u.full_name ?? i}-${u.role ?? i}`}>
                        {i > 0 && <View style={s.divider} />}
                        <View style={s.leaderRow}>
                          <Text style={[s.leaderRank, { color: isStrong ? COLORS.green : isWeak ? COLORS.red : COLORS.muted }]}>
                            {isStrong ? '✓' : isWeak ? '!' : `#${i + 1}`}
                          </Text>
                          <View style={s.leaderMid}>
                            <Text style={s.leaderName}>{u.full_name}</Text>
                            <View style={s.roleChip}>
                              <Text style={s.roleChipText}>{u.role}</Text>
                            </View>
                          </View>
                          <View style={s.leaderRight}>
                            <View style={s.leaderBarBg}>
                              <View style={[s.leaderBarFill, { width: `${relPct}%` as any, backgroundColor: barColor }]} />
                            </View>
                            <Text style={[s.leaderPct, { color: barColor }]}>
                              {u.acknowledged_count}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* CAPA close sheet */}
      {capaSheet && (
        <SignatureBottomSheet
          visible={!!capaSheet}
          title={`Close ${capaSheet.capa_code}`}
          fields={CAPA_STATUS_FIELDS}
          submitLabel="Close CAPA"
          onSubmit={handleCloseCAPA}
          onClose={() => setCapaSheet(null)}
        />
      )}

      {/* Document release sheet */}
      {docSheet && (
        <SignatureBottomSheet
          visible={!!docSheet}
          title={`Release ${docSheet.doc_code}`}
          fields={[]}
          submitLabel="Release Document"
          onSubmit={handleReleaseDoc}
          onClose={() => setDocSheet(null)}
        />
      )}

      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  // Hero
  hero:        { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, borderTopWidth: 3, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  heroLeft:    { flex: 1 },
  heroPercent: { fontSize: 48, fontWeight: '800', lineHeight: 52 },
  heroLabel:   { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  heroSub:     { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  heroRing:    { width: 60, height: 60, borderRadius: 30, borderWidth: 6, borderColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  heroRingNum: { fontSize: 14, fontWeight: '800' },

  // Section progress
  secRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  secCodeChip:{ width: 40, backgroundColor: COLORS.surfaceAlt, borderRadius: 6, paddingVertical: 4, alignItems: 'center' },
  secCode:    { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  secName:    { flex: 1, color: COLORS.text, fontSize: 13, paddingHorizontal: 10 },
  secBarBg:   { width: 80, height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  secBarFill: { height: 6, backgroundColor: COLORS.sky, borderRadius: 3 },
  secPct:     { color: COLORS.sky, fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },

  // Sub-tabs
  tabScrollOuter: { marginTop: 20, marginBottom: 4 },
  tabScroll:      { gap: 8, paddingVertical: 4 },
  tabPill:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabPillActive:  { backgroundColor: COLORS.sky + '22', borderColor: COLORS.sky },
  tabLabel:       { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: COLORS.sky },

  // Shared list
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  sectionTitle:     { color: COLORS.text, fontSize: 14, fontWeight: '700', flex: 1 },
  sectionBadge:     { backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionBadgeText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },

  card:     { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  divider:  { height: 1, backgroundColor: COLORS.border },
  emptyText:{ color: COLORS.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 8 },

  badge:    { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText:{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  listRow:    { padding: 14 },
  listRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  listRowBottom:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  codeText:   { color: COLORS.sky, fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
  descText:   { color: COLORS.text, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  metaText:   { color: COLORS.muted, fontSize: 11 },
  dueDateText:{ fontSize: 12, fontWeight: '700' },

  typePill:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' },
  typePillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  inlineBtn:    { backgroundColor: COLORS.amber + '22', borderWidth: 1, borderColor: COLORS.amber, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  inlineBtnText:{ color: COLORS.amber, fontSize: 12, fontWeight: '700' },

  docRow:      { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  docMid:      { flex: 1 },
  releaseBtn:  { backgroundColor: COLORS.green + '22', borderWidth: 1, borderColor: COLORS.green, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  releaseBtnText:{ color: COLORS.green, fontSize: 11, fontWeight: '700' },

  // Training compliance
  complianceCard:   { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 4 },
  complianceTop:    { marginBottom: 10 },
  complianceLabel:  { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  complianceBarBg:  { height: 16, backgroundColor: COLORS.surfaceAlt, borderRadius: 4, overflow: 'hidden' },

  // Leaderboard
  leaderRow:    { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  leaderRank:   { fontSize: 14, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  leaderMid:    { flex: 1, gap: 4 },
  leaderName:   { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  roleChip:     { backgroundColor: COLORS.surfaceAlt, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  roleChipText: { color: COLORS.muted, fontSize: 10, fontWeight: '600' },
  leaderRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leaderBarBg:  { width: 80, height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  leaderBarFill:{ height: 6, borderRadius: 3 },
  leaderPct:    { fontSize: 13, fontWeight: '700', minWidth: 28, textAlign: 'right' },

  complianceBarFill: { borderRadius: 4 },

  errorText:   { color: COLORS.red, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: COLORS.sky, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText:{ color: '#fff', fontWeight: '700' },
});
