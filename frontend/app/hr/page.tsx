'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import HRLayout from '@/components/hr/HRLayout';
import {
  Users, UserCheck, AlertTriangle, CheckCircle2,
  ClipboardList, Calendar, CalendarDays, Loader2,
  GraduationCap, ClipboardCheck, TrendingUp,
} from 'lucide-react';
import axios from 'axios';

interface HRDashboardStats {
  total_active: number;
  onboarding: number;
  on_probation: number;
  confirmed: number;
  on_pip: number;
  incomplete_onboarding: number;
  probation_due_14_days: number;
  pending_holiday_approvals: number;
}

interface ComplianceSnapshot {
  missing_contracts: number;
  overdue_day_30_reviews: number;
  overdue_day_90_reviews: number;
  active_pips: number;
  expired_sop_training: number;
  users_missing_hr_record: number;
}

// HR routes are mounted at /hr (not /api/hr) — strip /api from the base URL
const HR_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
  .replace(/\/api\/?$/, '')
  .replace(/\/$/, '');

// ── KPI Card (matches dashboard page pattern exactly) ────────────────────────
function KPICard({ title, value, subtext, icon: Icon, colorClass, onClick, alert }: {
  title: string;
  value: number | string;
  subtext: string;
  icon: any;
  colorClass: string;
  onClick?: () => void;
  alert?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-dark-800 border ${
        alert
          ? `border-${colorClass}-500 shadow-[0_0_15px_rgba(0,0,0,0.2)] shadow-${colorClass}-500/20`
          : 'border-dark-700'
      } rounded-xl p-5 relative overflow-hidden group hover:border-${colorClass}-500/50 transition-all cursor-pointer`}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 bg-${colorClass}-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`} />
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
          <h3 className={`text-3xl font-bold mb-1 ${alert ? `text-${colorClass}-400` : 'text-white'}`}>
            {value}
          </h3>
          <p className="text-gray-500 text-xs">{subtext}</p>
        </div>
        <div className={`p-3 rounded-lg bg-${colorClass}-500/10 text-${colorClass}-400 group-hover:bg-${colorClass}-500/20 transition-colors`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// ── Compliance status chip ───────────────────────────────────────────────────
function ComplianceChip({ label, value, alertColor, tooltip }: {
  label: string;
  value: number;
  alertColor: string;
  tooltip?: string;
}) {
  const ok = value === 0;
  return (
    <div
      title={tooltip}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
        ok
          ? 'bg-green-500/10 border-green-500/30 text-green-400'
          : `bg-${alertColor}-500/10 border-${alertColor}-500/30 text-${alertColor}-400`
      }`}
    >
      {label}:<span className="font-bold ml-1">{value}</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function HRDashboardPage() {
  const router = useRouter();
  const { token } = useAuth();

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [stats, setStats]             = useState<HRDashboardStats | null>(null);
  const [compliance, setCompliance]   = useState<ComplianceSnapshot | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dashRes, compRes] = await Promise.all([
        axios.get(`${HR_BASE}/hr/dashboard`, { headers }),
        axios.get(`${HR_BASE}/hr/compliance`, { headers }),
      ]);
      setStats(dashRes.data);
      setCompliance(compRes.data);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setError('You do not have access to the HR module');
      } else {
        setError(err?.response?.data?.message || err?.message || 'Failed to load HR data');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <HRLayout title="HR Dashboard" subtitle="People & compliance overview">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
        </div>
      </HRLayout>
    );
  }

  return (
    <HRLayout title="HR Dashboard" subtitle="People & compliance overview">
      <div className="p-6 space-y-8 max-w-[1600px] mx-auto pb-12">

        {/* Error bar */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-5 py-4 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Section 1: KPI Cards ─────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard
              title="Total Active Employees"
              value={stats.total_active ?? 0}
              subtext="Currently employed"
              icon={Users}
              colorClass="blue"
              onClick={() => router.push('/hr/employees')}
            />
            <KPICard
              title="Currently Onboarding"
              value={stats.onboarding ?? 0}
              subtext="In-progress onboarding programmes"
              icon={GraduationCap}
              colorClass="yellow"
              alert={(stats.onboarding ?? 0) > 0}
              onClick={() => router.push('/hr/onboarding')}
            />
            <KPICard
              title="On Probation"
              value={stats.on_probation ?? 0}
              subtext="Probationary employees"
              icon={Calendar}
              colorClass="purple"
              alert={(stats.on_probation ?? 0) > 0}
              onClick={() => router.push('/hr/reviews')}
            />
            <KPICard
              title="Confirmed Employees"
              value={stats.confirmed ?? 0}
              subtext="Passed probation review"
              icon={CheckCircle2}
              colorClass="green"
              onClick={() => router.push('/hr/employees')}
            />
            <KPICard
              title="Employees on PIP"
              value={stats.on_pip ?? 0}
              subtext="Active improvement plans"
              icon={AlertTriangle}
              colorClass="red"
              alert={(stats.on_pip ?? 0) > 0}
              onClick={() => router.push('/hr/reviews')}
            />
            <KPICard
              title="Incomplete Onboarding"
              value={stats.incomplete_onboarding ?? 0}
              subtext="Modules not yet completed"
              icon={ClipboardList}
              colorClass="orange"
              alert={(stats.incomplete_onboarding ?? 0) > 0}
              onClick={() => router.push('/hr/onboarding')}
            />
            <KPICard
              title="Probation Reviews Due"
              value={stats.probation_due_14_days ?? 0}
              subtext="Due within next 14 days"
              icon={CalendarDays}
              colorClass="red"
              alert={(stats.probation_due_14_days ?? 0) > 0}
              onClick={() => router.push('/hr/reviews')}
            />
            <KPICard
              title="Pending Holiday Approvals"
              value={stats.pending_holiday_approvals ?? 0}
              subtext="Awaiting manager response"
              icon={CalendarDays}
              colorClass="yellow"
              alert={(stats.pending_holiday_approvals ?? 0) > 0}
              onClick={() => router.push('/hr/employees')}
            />
          </div>
        )}

        {/* ── Section 2: Compliance Snapshot ───────────────────────────────── */}
        {compliance && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" /> Compliance Snapshot
            </h2>
            <div className="flex flex-wrap gap-3">
              <ComplianceChip
                label="Missing Contracts"
                value={compliance.missing_contracts ?? 0}
                alertColor="red"
              />
              <ComplianceChip
                label="Overdue Day 30 Reviews"
                value={compliance.overdue_day_30_reviews ?? 0}
                alertColor="red"
              />
              <ComplianceChip
                label="Overdue Day 90 Reviews"
                value={compliance.overdue_day_90_reviews ?? 0}
                alertColor="red"
              />
              <ComplianceChip
                label="Active PIPs"
                value={compliance.active_pips ?? 0}
                alertColor="yellow"
              />
              <ComplianceChip
                label="Expired SOP Training"
                value={compliance.expired_sop_training ?? 0}
                alertColor="orange"
              />
              <ComplianceChip
                label="Missing HR Records"
                value={compliance.users_missing_hr_record ?? 0}
                alertColor="yellow"
                tooltip="Active users with no HR extension record"
              />
            </div>
          </div>
        )}

        {/* ── Section 3: Quick Actions ──────────────────────────────────────── */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => router.push('/hr/employees')}
              className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-primary-500/20"
            >
              <UserCheck className="w-4 h-4" /> Add HR Record
            </button>
            <button
              onClick={() => router.push('/hr/reviews')}
              className="px-5 py-2.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4" /> Schedule Review
            </button>
            <button
              onClick={() => router.push('/hr/onboarding')}
              className="px-5 py-2.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <GraduationCap className="w-4 h-4" /> View Onboarding Tracker
            </button>
          </div>
        </div>

      </div>
    </HRLayout>
  );
}
