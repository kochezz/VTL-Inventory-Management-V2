'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import HRLayout from '@/components/hr/HRLayout';
import {
  Loader2, AlertTriangle, ChevronLeft, Lock,
  CheckCircle2, XCircle, Clock, AlertOctagon,
} from 'lucide-react';
import axios from 'axios';

const HR_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
  .replace(/\/api\/?$/, '').replace(/\/$/, '');

type Tab = 'overview' | 'onboarding' | 'reviews' | 'leave';

// ── Formatters ────────────────────────────────────────────────────────────────
function fmt(val: string | null | undefined) {
  return val ?? '—';
}

function fmtDate(val: string | null | undefined) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const MODULE_NAMES: Record<string, string> = {
  phase_1_induction:     'Phase 1: Induction',
  phase_2_gmp_safety:    'Phase 2: GMP & Safety',
  module_a_finance:      'Module A: Finance',
  module_b_operations:   'Module B: Operations',
  module_c_engineering:  'Module C: Engineering',
  module_d_qa_qc:        'Module D: QA / QC',
  module_e_sales_admin:  'Module E: Sales & Admin',
  module_f_mgmt_systems: 'Module F: Management Systems',
};

function fmtModule(m: string) {
  return MODULE_NAMES[m] || m.replace(/_/g, ' ');
}

const ONBOARDING_BADGE: Record<string, string> = {
  completed:      'bg-green-500/10 text-green-400 border-green-500/20',
  in_progress:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  not_started:    'bg-gray-500/10 text-gray-400 border-gray-500/20',
  not_applicable: 'bg-dark-700 text-gray-600 border-dark-600',
};

const OUTCOME_BADGE: Record<string, string> = {
  confirmed:        'bg-green-500/10 text-green-400 border-green-500/20',
  pip_passed:       'bg-green-500/10 text-green-400 border-green-500/20',
  on_track:         'bg-green-500/10 text-green-400 border-green-500/20',
  extended:         'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  action_required:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  probation_failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  pip_failed:       'bg-red-500/10 text-red-400 border-red-500/20',
  serious_concern:  'bg-red-500/10 text-red-400 border-red-500/20',
  pending:          'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

// ── Field row helper ──────────────────────────────────────────────────────────
function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm text-white ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EmployeeProfilePage({ params }: { params: { id: string } }) {
  const userId = params.id;
  const router = useRouter();
  const { token, user: currentUser } = useAuth();

  const [tab, setTab]             = useState<Tab>('overview');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [profileData, setProfile] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any[]>([]);
  const [reviews, setReviews]     = useState<any[]>([]);
  const [leave, setLeave]         = useState<any>(null);

  const canSeeSalary = currentUser?.role === 'admin' || currentUser?.role === 'hr_admin';

  useEffect(() => {
    if (!token || !userId) return;
    fetchAll();
  }, [token, userId]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [empRes, onbRes, revRes, leaveRes] = await Promise.all([
        axios.get(`${HR_BASE}/hr/employees/${userId}`, { headers }),
        axios.get(`${HR_BASE}/hr/employees/${userId}/onboarding`, { headers }),
        axios.get(`${HR_BASE}/hr/employees/${userId}/reviews`, { headers }),
        axios.get(`${HR_BASE}/hr/employees/${userId}/leave-balance`, { headers }),
      ]);
      setProfile(empRes.data);
      setOnboarding(onbRes.data);
      setReviews(revRes.data);
      setLeave(leaveRes.data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('Employee HR record not found.');
      } else if (err?.response?.status === 403) {
        setError('You do not have access to this profile.');
      } else {
        setError(err?.response?.data?.message || 'Failed to load employee profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const profile    = profileData?.profile ?? null;
  const contract   = profileData?.contract ?? null;
  const activePip  = profileData?.activePip ?? null;
  const name       = profile?.full_name ?? 'Employee Profile';

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',   label: 'Overview' },
    { key: 'onboarding', label: 'Onboarding' },
    { key: 'reviews',    label: 'Reviews' },
    { key: 'leave',      label: 'Leave' },
  ];

  if (loading) {
    return (
      <HRLayout title="Employee Profile">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
        </div>
      </HRLayout>
    );
  }

  return (
    <HRLayout title={name}>
      <div className="p-6 space-y-6 max-w-[1200px] mx-auto pb-12">

        {/* Back button */}
        <button
          onClick={() => router.push('/hr/employees')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Employees
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-5 py-4 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />{error}
          </div>
        )}

        {/* Active PIP banner */}
        {(activePip || profile?.has_active_pip) && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 flex items-center gap-3 text-red-400">
            <AlertOctagon className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Active Performance Improvement Plan</p>
              {activePip?.pip_end_date && (
                <p className="text-xs mt-0.5">PIP ends: {fmtDate(activePip.pip_end_date)}</p>
              )}
            </div>
          </div>
        )}

        {/* Tab bar */}
        {profile && (
          <>
            <div className="flex border-b border-dark-700">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.key
                      ? 'text-primary-400 border-primary-400'
                      : 'text-gray-400 hover:text-white border-transparent'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Tab: Overview ──────────────────────────────────────────────── */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left: Core profile */}
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Employment Details
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Field label="Full Name"        value={fmt(profile.full_name)} />
                    <Field label="Email"            value={fmt(profile.email)} />
                    <Field label="Job Title"        value={fmt(profile.job_title)} />
                    <Field label="Department"       value={fmt(profile.department_structured ?? profile.department)} />
                    <Field label="Employment Date"  value={fmtDate(profile.employment_date)} />
                    <Field label="Employment Status" value={fmt(profile.employment_status)} />
                    <Field label="Reports To"       value={fmt(profile.reports_to_name ?? profile.reports_to)} />
                    <Field label="Contract Type"    value={fmt(contract?.contract_type ?? profile.contract_type)} />
                  </div>
                </div>

                {/* Right: HR extension */}
                <div className="space-y-4">
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      HR Status
                    </h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <Field label="HR Status" value={
                        <span className="capitalize">{fmt(profile.hr_status?.replace(/_/g, ' '))}</span>
                      } />
                      <Field label="Onboarding Complete" value={
                        profile.onboarding_complete
                          ? <CheckCircle2 className="w-4 h-4 text-green-400 inline" />
                          : <XCircle className="w-4 h-4 text-gray-600 inline" />
                      } />
                      <Field label="Probation End"       value={fmtDate(profile.effective_probation_end ?? profile.probation_end_date)} />
                      <Field label="Days to Prob. End"   value={
                        profile.days_to_probation_end !== null
                          ? <span className={
                              (profile.days_to_probation_end ?? 99) < 14 ? 'text-red-400 font-semibold' :
                              (profile.days_to_probation_end ?? 99) < 30 ? 'text-yellow-400' : 'text-gray-300'
                            }>{profile.days_to_probation_end} days</span>
                          : null
                      } />
                      <Field label="Confirmation Date"   value={fmtDate(profile.confirmation_date)} />
                      <Field label="Exit Date"           value={fmtDate(profile.exit_date)} />
                    </div>
                  </div>

                  {/* Salary (role-gated) */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                      Compensation
                    </h3>
                    {canSeeSalary ? (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <Field label="Basic Salary (ZMW)" value={
                          profile.basic_salary_zmw
                            ? Number(profile.basic_salary_zmw).toLocaleString('en-ZM', { style: 'currency', currency: 'ZMW' })
                            : '—'
                        } mono />
                        <Field label="Salary Effective" value={fmtDate(profile.salary_effective_date)} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-gray-500 text-sm">
                        <Lock className="w-4 h-4" />
                        Salary data is restricted to HR Admin and Admin roles.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Onboarding ────────────────────────────────────────────── */}
            {tab === 'onboarding' && (
              <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
                {onboarding.length === 0 ? (
                  <div className="p-10 text-center text-gray-500 text-sm">No onboarding records yet.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-dark-900 border-b border-dark-700">
                      <tr>
                        <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Module</th>
                        <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
                        <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Completed</th>
                        <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700">
                      {onboarding.map((m, i) => {
                        const badge = ONBOARDING_BADGE[m.status] || ONBOARDING_BADGE.not_started;
                        return (
                          <tr key={i} className="hover:bg-dark-700/40 transition-colors">
                            <td className="px-5 py-3 text-sm text-white font-medium">{fmtModule(m.module)}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badge}`}>
                                {(m.status ?? 'not_started').replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-400">{fmtDate(m.completed_date)}</td>
                            <td className="px-5 py-3 text-sm text-gray-300 font-mono">
                              {m.assessment_score !== null && m.assessment_score !== undefined
                                ? `${m.assessment_score}%`
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Tab: Reviews ───────────────────────────────────────────────── */}
            {tab === 'reviews' && (
              <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
                {reviews.length === 0 ? (
                  <div className="p-10 text-center text-gray-500 text-sm">No review records yet.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-dark-900 border-b border-dark-700">
                      <tr>
                        <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Type</th>
                        <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Review Date</th>
                        <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Outcome</th>
                        <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700">
                      {reviews.map((r, i) => {
                        const badge = OUTCOME_BADGE[r.outcome] || OUTCOME_BADGE.pending;
                        return (
                          <tr key={i} className="hover:bg-dark-700/40 transition-colors">
                            <td className="px-5 py-3 text-sm text-white font-medium capitalize">
                              {r.review_type?.replace(/_/g, ' ') ?? '—'}
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-400">{fmtDate(r.review_date)}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badge}`}>
                                {(r.outcome ?? 'pending').replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-300 font-mono">
                              {r.weighted_overall_score !== null && r.weighted_overall_score !== undefined
                                ? Number(r.weighted_overall_score).toFixed(1)
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Tab: Leave ─────────────────────────────────────────────────── */}
            {tab === 'leave' && (
              <div className="space-y-4">
                {leave ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Annual Entitlement', value: leave.annual_entitlement ?? 15, color: 'blue' },
                        { label: 'Days Taken',         value: leave.annual_taken ?? 0,        color: 'green' },
                        { label: 'Days Pending',       value: leave.pending_days ?? 0,        color: 'yellow' },
                        { label: 'Balance Remaining',  value: leave.annual_balance ?? (15 - (leave.annual_taken ?? 0)), color: 'primary' },
                      ].map(card => (
                        <div key={card.label} className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                          <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                          <p className="text-3xl font-bold text-white">{card.value}</p>
                          <p className="text-xs text-gray-500 mt-1">days</p>
                        </div>
                      ))}
                    </div>

                    {/* Usage progress bar */}
                    <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                      <div className="flex justify-between text-xs text-gray-400 mb-2">
                        <span>Annual leave usage</span>
                        <span>{leave.annual_taken ?? 0} / {leave.annual_entitlement ?? 15} days</span>
                      </div>
                      <div className="w-full bg-dark-950 rounded-full h-2.5 border border-dark-600">
                        <div
                          className="h-full rounded-full bg-primary-500 transition-all"
                          style={{
                            width: `${Math.min(
                              ((leave.annual_taken ?? 0) / (leave.annual_entitlement ?? 15)) * 100,
                              100
                            )}%`
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Leave requests are submitted from the main dashboard.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-10 text-center text-gray-500 text-sm">
                    No leave balance record found.
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>
    </HRLayout>
  );
}
