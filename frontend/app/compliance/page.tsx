'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClipboardCheck, AlertCircle, CheckCircle2, Clock, FileWarning, ShieldAlert, type LucideIcon } from 'lucide-react';
import { formatCadence } from '@/utils/complianceUtils';
import { RowErrorBoundary } from '@/components/compliance/RowErrorBoundary';

const CAN_VIEW_ROLES = ['junior_accountant', 'manager', 'admin', 'cfo', 'ceo'];

interface ComplianceCategory {
  category_id: string;
  name: string;
  regulator: string | null;
  cadence_type: 'ONE_OFF' | 'RECURRING' | null;
  interval_months: number | null;
  anchor_date: string | null;
  reminder_ladder_days: number[];
  obligation_kind: 'FILING' | 'RENEWAL' | null;
  responsible_user_id: string | null;
}

interface ComplianceItem {
  item_id: string;
  category_id: string;
  due_date: string;
  status: string;
  days_until_due: number;
  filed_late?: boolean;
}

// The Register's own period status -- distinct from compliance_items.status:
// DUE_SOON/NOT_CONFIGURED are computed here, never stored, and VERIFIED
// absorbs the legacy APPROVED status for display so pre-Step-2 rows don't
// need a data rewrite to show correctly (see the Step 1 dry-run report).
type PeriodStatus = 'NOT_CONFIGURED' | 'UPCOMING' | 'DUE_SOON' | 'EVIDENCE_SUBMITTED' | 'VERIFIED' | 'NON_COMPLIANT';

const STATUS_STYLES: Record<PeriodStatus, string> = {
  NOT_CONFIGURED: 'bg-red-500/10 text-red-400 border-red-500/30',
  NON_COMPLIANT: 'bg-red-500/10 text-red-400 border-red-500/30',
  DUE_SOON: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  EVIDENCE_SUBMITTED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  VERIFIED: 'bg-green-500/10 text-green-400 border-green-500/30',
  UPCOMING: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

const STATUS_ICONS: Record<PeriodStatus, LucideIcon> = {
  NOT_CONFIGURED: AlertCircle,
  NON_COMPLIANT: ShieldAlert,
  DUE_SOON: Clock,
  EVIDENCE_SUBMITTED: FileWarning,
  VERIFIED: CheckCircle2,
  UPCOMING: Clock,
};

interface RegisterRow {
  category: ComplianceCategory;
  periodStatus: PeriodStatus;
  currentPeriod: ComplianceItem | null;
  lastEvidenceDate: string | null;
}

// "Current period" is the earliest not-yet-complete item (UPCOMING/
// EVIDENCE_SUBMITTED/NON_COMPLIANT); if every item is already complete
// (VERIFIED, or legacy APPROVED), the most recent one of those instead, so
// a fully-caught-up obligation still shows its last filing rather than
// nothing at all.
function pickCurrentPeriod(items: ComplianceItem[]): ComplianceItem | null {
  const pending = items
    .filter((i) => ['UPCOMING', 'EVIDENCE_SUBMITTED', 'NON_COMPLIANT'].includes(i.status))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  if (pending.length > 0) return pending[0];

  const complete = items
    .filter((i) => i.status === 'VERIFIED' || i.status === 'APPROVED')
    .sort((a, b) => b.due_date.localeCompare(a.due_date));
  return complete[0] || null;
}

function computePeriodStatus(cat: ComplianceCategory, item: ComplianceItem | null): PeriodStatus {
  if (!cat.obligation_kind) return 'NOT_CONFIGURED';
  // Only a FILING category needs anchor_date -- its one generator (approval
  // bootstrap / scheduler) creates periods from it directly. RENEWAL's
  // anchor_date is optional/informational (TCC, ZPPA): its due date always
  // comes from the certificate actually held, so a RENEWAL category with no
  // anchor_date is correctly configured, not a gap.
  if (cat.cadence_type === 'RECURRING' && cat.obligation_kind === 'FILING' && !cat.anchor_date) return 'NOT_CONFIGURED';
  if (!item) return 'UPCOMING';
  if (item.status === 'NON_COMPLIANT') return 'NON_COMPLIANT';
  if (item.status === 'EVIDENCE_SUBMITTED') return 'EVIDENCE_SUBMITTED';
  if (item.status === 'VERIFIED' || item.status === 'APPROVED') return 'VERIFIED';
  // UPCOMING -- DUE_SOON if inside the reminder ladder's widest window.
  const maxLadder = cat.reminder_ladder_days.length > 0 ? Math.max(...cat.reminder_ladder_days) : 0;
  if (item.days_until_due <= maxLadder) return 'DUE_SOON';
  return 'UPCOMING';
}

function RegisterTableRow({ row, onOpenDetail }: { row: RegisterRow; onOpenDetail: () => void }) {
  const { category: cat, periodStatus, currentPeriod, lastEvidenceDate } = row;
  const Icon = STATUS_ICONS[periodStatus];
  return (
    <tr className={`hover:bg-dark-700/50 transition-colors ${periodStatus === 'NOT_CONFIGURED' ? 'bg-red-500/5' : ''}`}>
      <td className="py-4 px-6 font-bold text-white">
        <button onClick={onOpenDetail} className="hover:text-primary-400 hover:underline text-left">{cat.name}</button>
      </td>
      <td className="py-4 px-6 text-gray-300">{cat.regulator || '—'}</td>
      <td className="py-4 px-6 text-gray-300">{formatCadence(cat.cadence_type, cat.interval_months)}</td>
      <td className="py-4 px-6 text-gray-300">
        {currentPeriod ? new Date(currentPeriod.due_date).toLocaleDateString() : '—'}
      </td>
      <td className="py-4 px-6 text-center">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-xs uppercase tracking-wider ${STATUS_STYLES[periodStatus]}`}>
          <Icon className="w-3.5 h-3.5" />
          {periodStatus.replace(/_/g, ' ')}
        </span>
      </td>
      <td className="py-4 px-6 text-gray-300">
        {lastEvidenceDate ? new Date(lastEvidenceDate).toLocaleDateString() : '—'}
      </td>
    </tr>
  );
}

export default function ComplianceRegisterPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regulatorFilter, setRegulatorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (user && !CAN_VIEW_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (user && CAN_VIEW_ROLES.includes(user.role)) {
      fetchRegister();
    }
  }, [user]);

  const fetchRegister = async () => {
    try {
      setLoading(true);
      setError('');
      const catsRes = await api.get('/compliance/categories?status=ACTIVE');
      const categories: ComplianceCategory[] = catsRes.data;

      const itemsByCategory = await Promise.all(
        categories.map((cat) =>
          api.get(`/compliance/items?category_id=${cat.category_id}&show_archived=true`).then((r) => r.data as ComplianceItem[])
        )
      );

      const built = categories.map((cat, idx) => {
        const items = itemsByCategory[idx];
        const currentPeriod = pickCurrentPeriod(items);
        const periodStatus = computePeriodStatus(cat, currentPeriod);
        const verifiedItems = items
          .filter((i) => i.status === 'VERIFIED' || i.status === 'APPROVED')
          .sort((a, b) => b.due_date.localeCompare(a.due_date));
        return { category: cat, periodStatus, currentPeriod, lastEvidenceDate: verifiedItems[0]?.due_date || null };
      });
      setRows(built);
    } catch (err) {
      setError('Failed to load the compliance register.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const regulators = useMemo(() => Array.from(new Set(rows.map((r) => r.category.regulator).filter(Boolean))) as string[], [rows]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => !regulatorFilter || r.category.regulator === regulatorFilter)
      .filter((r) => !statusFilter || r.periodStatus === statusFilter)
      .sort((a, b) => {
        // NOT_CONFIGURED always first, red flags next, everything else by name.
        if (a.periodStatus === 'NOT_CONFIGURED' && b.periodStatus !== 'NOT_CONFIGURED') return -1;
        if (b.periodStatus === 'NOT_CONFIGURED' && a.periodStatus !== 'NOT_CONFIGURED') return 1;
        return a.category.name.localeCompare(b.category.name);
      });
  }, [rows, regulatorFilter, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => { c[r.periodStatus] = (c[r.periodStatus] || 0) + 1; });
    return c;
  }, [rows]);

  if (user && !CAN_VIEW_ROLES.includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6 pb-12">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-primary-500" />
            Compliance Register
          </h1>
          <p className="text-gray-400 mt-1">Every active regulatory obligation, at a glance.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(Object.keys(STATUS_STYLES) as PeriodStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`px-3 py-1.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition-all ${STATUS_STYLES[s]} ${statusFilter === s ? 'ring-2 ring-primary-500' : 'opacity-80 hover:opacity-100'}`}
            >
              {counts[s] || 0} {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <select
            value={regulatorFilter}
            onChange={(e) => setRegulatorFilter(e.target.value)}
            className="px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm"
          >
            <option value="">All regulators</option>
            {regulators.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-dark-900/80 border-b border-dark-700">
                <tr>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Obligation</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Regulator</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Cadence</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Next Due</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Last Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr><td colSpan={6} className="py-16 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500 mb-4"></div>
                    <p className="text-gray-400">Loading register...</p>
                  </td></tr>
                ) : filteredRows.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-500">No obligations match this filter.</td></tr>
                ) : (
                  filteredRows.map((row) => (
                    <RowErrorBoundary
                      key={row.category.category_id}
                      fallback={
                        <tr><td colSpan={6} className="py-3 px-6 text-red-400 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          This obligation ({row.category.name}) failed to render.
                        </td></tr>
                      }
                    >
                      <RegisterTableRow row={row} onOpenDetail={() => router.push(`/compliance/categories/${row.category.category_id}`)} />
                    </RowErrorBoundary>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
