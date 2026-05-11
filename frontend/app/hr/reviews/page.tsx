'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import HRLayout from '@/components/hr/HRLayout';
import { Search, Loader2, AlertTriangle, ChevronRight, Calendar } from 'lucide-react';
import axios from 'axios';

const HR_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
  .replace(/\/api\/?$/, '').replace(/\/$/, '');

// ── Date helpers ──────────────────────────────────────────────────────────────
function addDays(dateStr: string | null | undefined, days: number): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d;
}

function daysDiff(target: Date | null): number | null {
  if (!target) return null;
  return Math.floor((target.getTime() - Date.now()) / 86_400_000);
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Status badge helpers ──────────────────────────────────────────────────────
type ReviewStatus = 'overdue' | 'due_soon' | 'pending' | 'na';

function reviewStatus(days: number | null): ReviewStatus {
  if (days === null) return 'na';
  if (days < 0)   return 'overdue';
  if (days <= 14) return 'due_soon';
  return 'pending';
}

const STATUS_BADGE: Record<ReviewStatus, string> = {
  overdue:  'bg-red-500/10 text-red-400 border-red-500/20',
  due_soon: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  pending:  'bg-gray-500/10 text-gray-400 border-gray-500/20',
  na:       'bg-dark-700 text-gray-600 border-dark-600',
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  overdue:  'OVERDUE',
  due_soon: 'Due Soon',
  pending:  'Pending',
  na:       '—',
};

export default function ReviewsPage() {
  const router  = useRouter();
  const { token } = useAuth();

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [scheduleFilter, setScheduleFilter] = useState<'active' | 'all'>('active');

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    setLoading(true);
    axios.get(`${HR_BASE}/hr/employees`, { headers })
      .then(r => setEmployees(r.data))
      .catch(e => setError(e?.response?.data?.message || 'Failed to load employees'))
      .finally(() => setLoading(false));
  }, [token]);

  // Enrich each employee with computed date fields
  const enriched = employees
    .filter(e => ['onboarding', 'probation', 'confirmed'].includes(e.hr_status ?? ''))
    .map(e => {
      const day30     = addDays(e.employment_date, 28);
      const day90     = e.effective_probation_end ? new Date(e.effective_probation_end) : null;
      const day30Days = daysDiff(day30);
      const day90Days = daysDiff(day90);
      return { ...e, day30, day90, day30Days, day90Days };
    });

  // Section A — urgent: due within 7 days or overdue
  const urgent = enriched.filter(e =>
    ['onboarding', 'probation'].includes(e.hr_status ?? '') &&
    ((e.day30Days !== null && e.day30Days <= 7) ||
     (e.day90Days !== null && e.day90Days <= 7))
  );

  // Section B — full schedule (filtered)
  const scheduled = enriched
    .filter(e => {
      const matchFilter =
        scheduleFilter === 'all'
          ? true
          : ['onboarding', 'probation'].includes(e.hr_status ?? '');
      const matchSearch = e.full_name?.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    })
    .sort((a, b) => {
      const aMin = Math.min(a.day30Days ?? 999, a.day90Days ?? 999);
      const bMin = Math.min(b.day30Days ?? 999, b.day90Days ?? 999);
      return aMin - bMin;
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

        {/* ── Section A: Urgent / Overdue ───────────────────────────────────── */}
        {urgent.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Overdue / Due This Week
            </h2>
            {urgent.map(emp => {
              const d30Status = reviewStatus(emp.day30Days);
              const d90Status = reviewStatus(emp.day90Days);
              const isOverdue  = d30Status === 'overdue' || d90Status === 'overdue';
              const borderCls  = isOverdue
                ? 'border-red-500/40 bg-red-500/5'
                : 'border-yellow-500/40 bg-yellow-500/5';

              return (
                <div
                  key={emp.user_id}
                  className={`border rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 ${borderCls}`}
                >
                  {/* Avatar + name */}
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

                  {/* Day 30 chip */}
                  {emp.day30Days !== null && emp.day30Days <= 7 && (
                    <div className="flex flex-col items-start sm:items-center gap-0.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${STATUS_BADGE[d30Status]}`}>
                        Day 30 — {d30Status === 'overdue' ? `${Math.abs(emp.day30Days)}d overdue` : `${emp.day30Days}d`}
                      </span>
                      <span className="text-[10px] text-gray-500">{fmtDate(emp.day30)}</span>
                    </div>
                  )}

                  {/* Day 90 chip */}
                  {emp.day90Days !== null && emp.day90Days <= 7 && (
                    <div className="flex flex-col items-start sm:items-center gap-0.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${STATUS_BADGE[d90Status]}`}>
                        Day 90 — {d90Status === 'overdue' ? `${Math.abs(emp.day90Days)}d overdue` : `${emp.day90Days}d`}
                      </span>
                      <span className="text-[10px] text-gray-500">{fmtDate(emp.day90)}</span>
                    </div>
                  )}

                  <button
                    onClick={() => router.push(`/hr/employees/${emp.user_id}?tab=reviews`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 border border-dark-600 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                  >
                    View Profile <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {urgent.length === 0 && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-4 text-green-400 text-sm flex items-center gap-3">
            <Calendar className="w-5 h-5 flex-shrink-0" />
            No reviews overdue or due within the next 7 days.
          </div>
        )}

        {/* ── Section B: Full Schedule ──────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex-1">
              Full Schedule
            </h2>

            {/* Filters */}
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

          {scheduled.length === 0 ? (
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 text-center text-gray-500 text-sm">
              {employees.length === 0
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
                  {scheduled.map(emp => {
                    const d30s = reviewStatus(emp.day30Days);
                    const d90s = reviewStatus(emp.day90Days);
                    return (
                      <tr key={emp.user_id} className="hover:bg-dark-700/40 transition-colors">
                        {/* Employee */}
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
                        {/* Start Date */}
                        <td className="px-5 py-3 text-sm text-gray-400">{fmtDate(emp.employment_date)}</td>
                        {/* Day 30 Due */}
                        <td className="px-5 py-3 text-sm text-gray-400">{fmtDate(emp.day30)}</td>
                        {/* Day 30 Status */}
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${STATUS_BADGE[d30s]}`}>
                            {STATUS_LABEL[d30s]}
                          </span>
                        </td>
                        {/* Day 90 Due */}
                        <td className="px-5 py-3 text-sm text-gray-400">{fmtDate(emp.day90)}</td>
                        {/* Day 90 Status */}
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${STATUS_BADGE[d90s]}`}>
                            {STATUS_LABEL[d90s]}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => router.push(`/hr/employees/${emp.user_id}?tab=reviews`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            View Profile <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </HRLayout>
  );
}
