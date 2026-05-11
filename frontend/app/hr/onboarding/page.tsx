'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import HRLayout from '@/components/hr/HRLayout';
import {
  Search, Loader2, AlertTriangle, CheckCircle2,
  ChevronRight, ChevronDown, GraduationCap,
} from 'lucide-react';
import axios from 'axios';

const HR_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
  .replace(/\/api\/?$/, '').replace(/\/$/, '');

// Module column definitions — order matches spec
const MODULES = [
  { key: 'phase_1_induction',    short: 'Ph.1' },
  { key: 'phase_2_gmp_safety',   short: 'Ph.2' },
  { key: 'module_a_finance',     short: 'Mod A' },
  { key: 'module_b_operations',  short: 'Mod B' },
  { key: 'module_c_engineering', short: 'Mod C' },
  { key: 'module_d_qa_qc',       short: 'Mod D' },
  { key: 'module_e_sales_admin', short: 'Mod E' },
  { key: 'module_f_mgmt_systems',short: 'Mod F' },
];

function fmtDate(val: string | null | undefined) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Compact module status icon ────────────────────────────────────────────────
function ModuleIcon({ status, startedDate }: { status?: string; startedDate?: string | null }) {
  if (!status || status === 'not_applicable') {
    return <span className="text-gray-700 text-sm select-none">—</span>;
  }
  if (status === 'completed') {
    return <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" />;
  }
  if (status === 'in_progress') {
    const msElapsed = startedDate ? Date.now() - new Date(startedDate).getTime() : 0;
    const overdue   = msElapsed > 14 * 24 * 60 * 60 * 1000;
    return overdue
      ? <AlertTriangle className="w-4 h-4 text-yellow-400 mx-auto" />
      : <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse mx-auto" />;
  }
  // not_started
  return <div className="w-3 h-3 rounded-full border border-gray-600 mx-auto" />;
}

// ── Overall % progress bar ────────────────────────────────────────────────────
function PctBar({ pct, complete }: { pct: number; complete: boolean }) {
  const colour = complete || pct >= 100
    ? 'bg-green-500'
    : pct > 50
      ? 'bg-yellow-500'
      : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 bg-dark-950 rounded-full h-1.5 border border-dark-600">
        <div className={`h-full rounded-full ${colour} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OnboardingTrackerPage() {
  const router  = useRouter();
  const { token } = useAuth();

  const [employees, setEmployees]     = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'incomplete' | 'overdue'>('all');
  const [deptFilter, setDeptFilter]   = useState('all');

  // Lazy-loaded module data per expanded row — avoids N+1 on page load
  const [expandedRows, setExpandedRows] = useState<Record<string, any[]>>({});
  const [loadingRows, setLoadingRows]   = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!token) return;
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [empRes, deptRes] = await Promise.all([
        axios.get(`${HR_BASE}/hr/employees`, { headers }),
        axios.get(`${HR_BASE}/hr/departments`, { headers }),
      ]);
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = async (userId: string) => {
    if (expandedRows[userId] !== undefined) {
      setExpandedRows(prev => { const n = { ...prev }; delete n[userId]; return n; });
      return;
    }
    setLoadingRows(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await axios.get(`${HR_BASE}/hr/employees/${userId}/onboarding`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setExpandedRows(prev => ({ ...prev, [userId]: res.data }));
    } catch {
      setExpandedRows(prev => ({ ...prev, [userId]: [] }));
    } finally {
      setLoadingRows(prev => ({ ...prev, [userId]: false }));
    }
  };

  // ── Computed summaries ────────────────────────────────────────────────────
  const onboardingEmps = employees.filter(e =>
    e.hr_status === 'onboarding' || e.hr_status === 'probation' || e.hr_status === 'confirmed'
  );
  const completeCount    = employees.filter(e => e.onboarding_complete).length;
  const inProgressCount  = employees.filter(e => e.hr_status === 'onboarding' && !e.onboarding_complete).length;
  const overdueCount     = employees.filter(e => e.hr_status === 'onboarding' && !e.onboarding_complete).length;

  // ── Client-side filters ───────────────────────────────────────────────────
  const filtered = onboardingEmps.filter(emp => {
    const dept = emp.department_structured ?? emp.department_name ?? emp.department ?? '';
    const matchSearch = emp.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchDept   = deptFilter === 'all' || dept === deptFilter;
    const matchStatus =
      statusFilter === 'all'        ? true :
      statusFilter === 'complete'   ? emp.onboarding_complete :
      statusFilter === 'incomplete' ? !emp.onboarding_complete :
      /* overdue */                   (emp.hr_status === 'onboarding' && !emp.onboarding_complete);
    return matchSearch && matchDept && matchStatus;
  });

  if (loading) {
    return (
      <HRLayout title="Onboarding Tracker" subtitle="Module completion across all active employees">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
        </div>
      </HRLayout>
    );
  }

  return (
    <HRLayout title="Onboarding Tracker" subtitle="Module completion across all active employees">
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto pb-12">

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-5 py-4 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />{error}
          </div>
        )}

        {/* ── Summary cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: 'Onboarding Complete',
              value: completeCount,
              sub:   'employees fully signed-off',
              colour: 'green',
            },
            {
              label: 'In Progress',
              value: inProgressCount,
              sub:   'currently in onboarding status',
              colour: 'blue',
            },
            {
              label: 'Overdue Modules',
              value: overdueCount,
              sub:   'employees with incomplete onboarding',
              colour: overdueCount > 0 ? 'red' : 'gray',
            },
          ].map(card => (
            <div
              key={card.label}
              className="bg-dark-800 border border-dark-700 rounded-xl p-5 flex items-center gap-4"
            >
              <div className={`p-3 rounded-lg bg-${card.colour}-500/10`}>
                <GraduationCap className={`w-6 h-6 text-${card.colour}-400`} />
              </div>
              <div>
                <p className="text-xs text-gray-400">{card.label}</p>
                <p className="text-2xl font-bold text-white">{card.value}</p>
                <p className="text-xs text-gray-500">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search employee name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm"
          >
            <option value="all">All</option>
            <option value="complete">Complete only</option>
            <option value="incomplete">Incomplete only</option>
            <option value="overdue">Overdue (onboarding status)</option>
          </select>
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm"
          >
            <option value="all">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-gray-500 self-center">
            {filtered.length} employees
          </span>
        </div>

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {employees.length === 0 && !error && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-12 text-center">
            <GraduationCap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-white font-semibold mb-1">No HR records found</p>
            <p className="text-gray-400 text-sm mb-4">
              Create HR records for employees to track their onboarding progress.
            </p>
            <button
              onClick={() => router.push('/hr/employees')}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors"
            >
              Go to Employees
            </button>
          </div>
        )}

        {/* ── Master tracker table ──────────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-dark-900 border-b border-dark-700">
                <tr>
                  <th className="px-4 py-3 w-6" />
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase whitespace-nowrap">Employee</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase whitespace-nowrap">Department</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase whitespace-nowrap">Start Date</th>
                  {MODULES.map(m => (
                    <th key={m.key} className="px-2 py-3 text-xs font-medium text-gray-400 uppercase text-center whitespace-nowrap">
                      {m.short}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase whitespace-nowrap">Overall %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filtered.map(emp => {
                  const dept     = emp.department_structured ?? emp.department_name ?? emp.department ?? '—';
                  const pct      = typeof emp.onboarding_pct === 'number' ? emp.onboarding_pct : 0;
                  const isOpen   = expandedRows[emp.user_id] !== undefined;
                  const isLoading = loadingRows[emp.user_id];
                  const modules  = expandedRows[emp.user_id] ?? [];

                  // Build module status lookup when expanded
                  const modMap: Record<string, any> = {};
                  modules.forEach(m => { modMap[m.module] = m; });

                  return (
                    <>
                      {/* Main row */}
                      <tr
                        key={emp.user_id}
                        className="hover:bg-dark-700/40 transition-colors cursor-pointer"
                        onClick={() => router.push(`/hr/employees/${emp.user_id}?tab=onboarding`)}
                      >
                        {/* Expand toggle — stops propagation so it doesn't navigate */}
                        <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleRow(emp.user_id); }}>
                          {isLoading
                            ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                            : isOpen
                              ? <ChevronDown className="w-4 h-4 text-gray-400" />
                              : <ChevronRight className="w-4 h-4 text-gray-400" />
                          }
                        </td>
                        {/* Employee */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-400 font-bold text-xs flex-shrink-0">
                              {emp.full_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white leading-tight">{emp.full_name}</p>
                              {emp.onboarding_complete && (
                                <span className="text-[10px] text-green-400 font-semibold">✓ Complete</span>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Department */}
                        <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{dept}</td>
                        {/* Start date */}
                        <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                          {fmtDate(emp.employment_date)}
                        </td>
                        {/* Module columns — show icons if expanded, dash if not */}
                        {MODULES.map(m => (
                          <td key={m.key} className="px-2 py-3 text-center">
                            {isOpen
                              ? <ModuleIcon
                                  status={modMap[m.key]?.status}
                                  startedDate={modMap[m.key]?.started_date}
                                />
                              : <span className="text-gray-700 text-xs select-none">·</span>
                            }
                          </td>
                        ))}
                        {/* Overall % */}
                        <td className="px-4 py-3">
                          <PctBar pct={pct} complete={!!emp.onboarding_complete} />
                        </td>
                      </tr>

                      {/* Expanded module detail row */}
                      {isOpen && (
                        <tr key={`${emp.user_id}-expanded`} className="bg-dark-900/60">
                          <td />
                          <td colSpan={3} className="px-4 py-2 text-xs text-gray-500 italic">
                            Module details — click row to open full profile
                          </td>
                          {MODULES.map(m => {
                            const mod = modMap[m.key];
                            return (
                              <td key={m.key} className="px-2 py-2 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <ModuleIcon status={mod?.status} startedDate={mod?.started_date} />
                                  {mod?.completed_date && (
                                    <span className="text-[9px] text-gray-600">
                                      {fmtDate(mod.completed_date)}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-4 py-2">
                            <button
                              onClick={() => router.push(`/hr/employees/${emp.user_id}?tab=onboarding`)}
                              className="text-xs text-primary-400 hover:text-primary-300 transition-colors whitespace-nowrap"
                            >
                              Full profile →
                            </button>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length === 0 && employees.length > 0 && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 text-center text-gray-500 text-sm">
            No employees match your filters.
          </div>
        )}

      </div>
    </HRLayout>
  );
}
