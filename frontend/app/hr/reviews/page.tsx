'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import HRLayout from '@/components/hr/HRLayout';
import { Search, Loader2, AlertTriangle, ChevronRight, Calendar, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

const HR_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
  .replace(/\/api\/?$/, '').replace(/\/$/, '');

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysDiff(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86_400_000);
}

// ── Outcome badge ─────────────────────────────────────────────────────────────
const OUTCOME_BADGE: Record<string, string> = {
  confirmed:        'bg-green-500/10 text-green-400 border-green-500/20',
  pip_passed:       'bg-green-500/10 text-green-400 border-green-500/20',
  on_track:         'bg-green-500/10 text-green-400 border-green-500/20',
  extended:         'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  action_required:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  probation_failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  pending:          'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

// ── Status chip helper ────────────────────────────────────────────────────────
// Uses data from v_hr_probation_schedule which already accounts for
// whether a review record exists — no client-side date math needed.
function ReviewChip({
  dueDate,
  isOverdue,
  outcome,
  label,
}: {
  dueDate: string | null;
  isOverdue: boolean;
  outcome: string | null;
  label: string;
}) {
  // Review completed — show outcome badge
  if (outcome && outcome !== 'pending') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border flex items-center gap-1 ${
          OUTCOME_BADGE[outcome] ?? OUTCOME_BADGE.pending
        }`}>
          <CheckCircle2 className="w-3 h-3" />
          {label} — {outcome.replace(/_/g, ' ')}
        </span>
        {dueDate && (
          <span className="text-[10px] text-gray-500">{fmtDate(dueDate)}</span>
        )}
      </div>
    );
  }

  // Not yet done — show schedule status
  const days = daysDiff(dueDate);
  if (days === null) {
    return <span className="text-xs text-gray-600">—</span>;
  }
  if (isOverdue) {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="px-2 py-0.5 rounded text-[11px] font-bold border bg-red-500/10 text-red-400 border-red-500/20">
          {label} — OVERDUE
        </span>
        <span className="text-[10px] text-gray-500">{fmtDate(dueDate)}</span>
      </div>
    );
  }
  if (days <= 14) {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="px-2 py-0.5 rounded text-[11px] font-bold border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
          {label} — {days}d left
        </span>
        <span className="text-[10px] text-gray-500">{fmtDate(dueDate)}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="px-2 py-0.5 rounded text-[11px] font-bold border bg-gray-500/10 text-gray-400 border-gray-500/20">
        {label} — Pending
      </span>
      <span className="text-[10px] text-gray-500">{fmtDate(dueDate)}</span>
    </div>
  );
}

// ── Table status cell (condensed for the full-schedule table) ─────────────────
function StatusCell({ isOverdue, outcome, dueDate }: {
  isOverdue: boolean;
  outcome: string | null;
  dueDate: string | null;
}) {
  if (outcome && outcome !== 'pending') {
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
        OUTCOME_BADGE[outcome] ?? OUTCOME_BADGE.pending
      }`}>
        {outcome.replace(/_/g, ' ')}
      </span>
    );
  }
  if (dueDate === null) {
    return <span className="text-xs text-gray-600">—</span>;
  }
  if (isOverdue) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-bold border bg-red-500/10 text-red-400 border-red-500/20">
        OVERDUE
      </span>
    );
  }
  const days = daysDiff(dueDate);
  if (days !== null && days <= 14) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-bold border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
        Due Soon
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-[11px] font-bold border bg-gray-500/10 text-gray-400 border-gray-500/20">
      Pending
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReviewsPage() {
  const router    = useRouter();
  const { token } = useAuth();

  // FIX: Fetch from v_hr_probation_schedule via /hr/probation-schedule
  // This view already accounts for existing review records when computing
  // day_30_overdue and day_90_overdue — no client-side date math needed.
  const [schedule, setSchedule]           = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [search, setSearch]               = useState('');
  const [scheduleFilter, setScheduleFilter] = useState<'active' | 'all'>('active');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    axios
      .get(`${HR_BASE}/hr/probation-schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(r => setSchedule(r.data))
      .catch(e => setError(e?.response?.data?.message || 'Failed to load review schedule'))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Derived lists ─────────────────────────────────────────────────────────
  // Urgent: genuinely overdue (no existing record AND date is past)
  // The view's day_30_overdue / day_90_overdue already encode this correctly.
  const urgent = schedule.filter(e =>
    ['onboarding', 'probation'].includes(e.hr_status ?? '') &&
    (e.day_30_overdue || e.day_90_overdue)
  );

  const filtered = schedule
    .filter(e => {
      const matchStatus =
        scheduleFilter === 'all'
          ? true
          : ['onboarding', 'probation'].includes(e.hr_status ?? '');
      const matchSearch = e.full_name?.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      // Sort: overdue first, then by day_30_due ascending
      const aOverdue = (a.day_30_overdue || a.day_90_overdue) ? -1 : 0;
      const bOverdue = (b.day_30_overdue || b.day_90_overdue) ? -1 : 0;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const aDate = a.day_30_due ?? a.day_90_due ?? '';
      const bDate = b.day_30_due ?? b.day_90_due ?? '';
      return aDate.localeCompare(bDate);
    });

  if (loading) {
    return (
      <HRLayout title="Probation Reviews" subtitle="Review schedule and outcomes">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
        </div>
      </HRLayout>
    );
  }

  return (
    <HRLayout title="Probation Reviews" subtitle="Review schedule and outcomes">
      <div className="p-6 space-y-8 max-w-[1400px] mx-auto pb-12">

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-5 py-4 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />{error}
          </div>
        )}

        {/* ── Section A: Genuinely Overdue ──────────────────────────────────── */}
        {urgent.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Overdue — Action Required
            </h2>
            {urgent.map(emp => (
              <div
                key={emp.user_id}
                className="border border-red-500/40 bg-red-500/5 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center text-primary-400 font-bold flex-shrink-0">
                    {emp.full_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{emp.full_name}</p>
                    <p className="text-xs text-gray-400 capitalize">
                      {emp.hr_status?.replace(/_/g, ' ')} · {emp.job_title ?? '—'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {emp.day_30_overdue && (
                    <ReviewChip
                      dueDate={emp.day_30_due}
                      isOverdue={true}
                      outcome={emp.day_30_outcome}
                      label="Day 30"
                    />
                  )}
                  {emp.day_90_overdue && (
                    <ReviewChip
                      dueDate={emp.day_90_due}
                      isOverdue={true}
                      outcome={emp.day_90_outcome}
                      label="Day 90"
                    />
                  )}
                </div>

                <button
                  onClick={() => router.push(`/hr/employees/${emp.user_id}?tab=reviews`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 border border-dark-600 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  View Profile <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-4 text-green-400 text-sm flex items-center gap-3">
            <Calendar className="w-5 h-5 flex-shrink-0" />
            No reviews overdue. All scheduled reviews are on track or completed.
          </div>
        )}

        {/* ── Section B: Full Schedule ──────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex-1">
              Full Schedule
            </h2>
            <div className="flex gap-3 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employee…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm"
                />
              </div>
              <select
                value={scheduleFilter}
                onChange={e => setScheduleFilter(e.target.value as 'active' | 'all')}
                className="px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm"
              >
                <option value="active">Active (Onboarding + Probation)</option>
                <option value="all">All (includes Confirmed)</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 text-center text-gray-500 text-sm">
              {schedule.length === 0
                ? 'No HR records found. Create HR records from the Employees page.'
                : 'No employees match the current filter.'}
            </div>
          ) : (
            <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-dark-900 border-b border-dark-700">
                  <tr>
                    <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Employee</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Start Date</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Day 30 Due</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Day 30 Status</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Day 90 Due</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Day 90 Status</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {filtered.map(emp => (
                    <tr key={emp.user_id} className="hover:bg-dark-700/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-400 font-bold text-xs flex-shrink-0">
                            {emp.full_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{emp.full_name}</p>
                            <p className="text-xs text-gray-500 capitalize">
                              {emp.hr_status?.replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-400 whitespace-nowrap">
                        {fmtDate(emp.start_date)}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-400 whitespace-nowrap">
                        {fmtDate(emp.day_30_due)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusCell
                          isOverdue={!!emp.day_30_overdue}
                          outcome={emp.day_30_outcome}
                          dueDate={emp.day_30_due}
                        />
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-400 whitespace-nowrap">
                        {fmtDate(emp.day_90_due)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusCell
                          isOverdue={!!emp.day_90_overdue}
                          outcome={emp.day_90_outcome}
                          dueDate={emp.day_90_due}
                        />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => router.push(`/hr/employees/${emp.user_id}?tab=reviews`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          View Profile <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </HRLayout>
  );
}