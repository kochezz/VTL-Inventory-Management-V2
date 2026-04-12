'use client';

// ============================================================================
// QMS COMPLIANCE DASHBOARD — Phase 4
// Route: /qms/compliance
// File: app/qms/compliance/page.tsx
// ============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  ShieldCheck, AlertCircle, AlertOctagon, Target,
  GraduationCap, CheckCircle2, Clock, TrendingUp,
  TrendingDown, ArrowRight, RefreshCw, ChevronRight,
  FileText, Users, BarChart3, Calendar
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

const n = (v: any) => parseInt(v) || 0;

function GaugeRing({ pct, colour, size = 80 }: { pct: number; colour: string; size?: number }) {
  const r   = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth="8"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={colour} strokeWidth="8"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}/>
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize="14"
        fontWeight="700" fill="white">{pct}%</text>
    </svg>
  );
}

function KpiCard({ label, value, sub, icon: Icon, colour = 'text-white', warn = false, onClick }: any) {
  return (
    <div onClick={onClick}
      className={`bg-dark-800 border rounded-xl p-5 ${onClick ? 'cursor-pointer hover:border-dark-500 transition-all' : ''} ${warn ? 'border-red-500/30' : 'border-dark-700'}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${warn ? 'bg-red-500/10' : 'bg-dark-700'}`}>
          <Icon className={`w-4 h-4 ${warn ? 'text-red-400' : 'text-primary-400'}`}/>
        </div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-3xl font-black ${warn && n(value) > 0 ? 'text-red-400' : colour}`}>{value ?? '—'}</p>
      {sub && <p className={`text-xs mt-1 ${warn ? 'text-red-400/70' : 'text-gray-500'}`}>{sub}</p>}
    </div>
  );
}

function AgeBand({ label, count, colour }: { label: string; count: number; colour: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colour }}/>
      <span className="text-sm text-gray-300 flex-1">{label}</span>
      <span className="font-bold text-white">{count}</span>
    </div>
  );
}

// ============================================================================

export default function ComplianceDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await api.get('/qms/compliance');
      setData(res.data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Failed to load compliance data', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <DashboardLayout>
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"/>
      </div>
    </DashboardLayout>
  );

  if (!data) return (
    <DashboardLayout>
      <div className="p-10 text-center text-red-400">Failed to load compliance data.</div>
    </DashboardLayout>
  );

  const s = data.summary;
  const totalTraining = n(s.training_completed) + n(s.training_pending);
  const trainingPct   = totalTraining > 0 ? Math.round((n(s.training_completed) / totalTraining) * 100) : 100;
  const totalNCR      = n(s.ncr_open) + n(s.ncr_closed);
  const ncrClosurePct = totalNCR > 0 ? Math.round((n(s.ncr_closed) / totalNCR) * 100) : 100;
  const releasedPct   = n(s.total_docs) > 0 ? Math.round((n(s.released) / (n(s.total_docs) - n(s.withdrawn))) * 100) : 0;

  const overallScore = Math.round(
    (releasedPct * 0.35) +
    (trainingPct * 0.30) +
    (ncrClosurePct * 0.20) +
    ((n(s.capa_overdue) === 0 ? 100 : Math.max(0, 100 - n(s.capa_overdue) * 20)) * 0.15)
  );

  const scoreColour = overallScore >= 85 ? '#10b981' : overallScore >= 65 ? '#f59e0b' : '#ef4444';

  return (
    <DashboardLayout>
      <div className="max-w-[1400px] mx-auto space-y-6 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-primary-500"/> QMS Compliance Dashboard
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Real-time compliance health · Last refreshed {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/qms/review-calendar')}
              className="px-4 py-2 bg-dark-800 border border-dark-700 hover:border-primary-500/50 text-white rounded-lg text-sm flex items-center gap-2 transition-colors">
              <Calendar className="w-4 h-4 text-primary-400"/> Review Calendar
            </button>
            <button onClick={fetchData}
              className="px-4 py-2 bg-dark-800 border border-dark-700 hover:bg-dark-700 text-white rounded-lg text-sm flex items-center gap-2 transition-colors">
              <RefreshCw className="w-4 h-4"/> Refresh
            </button>
          </div>
        </div>

        {/* Overall compliance score */}
        <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 flex items-center gap-8">
          <div className="flex-shrink-0">
            <GaugeRing pct={overallScore} colour={scoreColour} size={120}/>
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">
              Overall QMS Compliance Score
            </h2>
            <p className="text-4xl font-black text-white mb-1">{overallScore}<span className="text-gray-500 text-2xl">/100</span></p>
            <p className="text-sm text-gray-400">
              Weighted across document release readiness (35%), training completion (30%), NCR closure (20%), and CAPA timeliness (15%).
            </p>
          </div>
          <div className="hidden lg:flex flex-col gap-2 text-sm flex-shrink-0 min-w-[200px]">
            {[
              { label: 'Document readiness', pct: releasedPct, w: '35%' },
              { label: 'Training completion', pct: trainingPct, w: '30%' },
              { label: 'NCR closure rate',    pct: ncrClosurePct, w: '20%' },
              { label: 'CAPA timeliness',     pct: n(s.capa_overdue) === 0 ? 100 : Math.max(0, 100 - n(s.capa_overdue) * 20), w: '15%' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-24 bg-dark-700 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${item.pct}%` }}/>
                </div>
                <span className="text-gray-400 text-xs flex-1">{item.label}</span>
                <span className="text-white text-xs font-bold">{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Overdue Reviews"  value={n(s.overdue_review)}  icon={Clock}         warn={n(s.overdue_review) > 0}  sub="Released docs past review date" onClick={() => router.push('/qms/review-calendar')}/>
          <KpiCard label="Due within 30d"   value={n(s.due_within_30d)}  icon={AlertCircle}   warn={n(s.due_within_30d) > 0}   sub="Action recommended now"/>
          <KpiCard label="Training Pending" value={n(s.training_pending)} icon={GraduationCap} warn={n(s.training_pending) > 0}  sub="Unacknowledged document tasks" onClick={() => router.push('/qms/training')}/>
          <KpiCard label="Open NCRs"        value={n(s.ncr_open)}         icon={AlertOctagon}  warn={n(s.ncr_open) > 0}         sub={`${n(s.ncr_aged_open)} open >30 days`} onClick={() => router.push('/qms/ncr')}/>
          <KpiCard label="Released Docs"    value={n(s.released)}         icon={CheckCircle2}  colour="text-green-400"           sub={`${releasedPct}% of active documents`}/>
          <KpiCard label="In Review"        value={n(s.in_review)}        icon={FileText}      colour="text-blue-400"            sub="Awaiting QA approval"/>
          <KpiCard label="Open CAPAs"       value={n(s.capa_open)}        icon={Target}        warn={n(s.capa_overdue) > 0}     sub={`${n(s.capa_overdue)} overdue`} onClick={() => router.push('/qms/capa')}/>
          <KpiCard label="CAPA Closure"     value={`${data.capa_closure_rate}%`} icon={TrendingUp} colour="text-green-400"      sub={`${n(s.capa_closed)} closed total`}/>
        </div>

        {/* Two column: NCR age + Training by dept */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* NCR age analysis */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-400"/> NCR Age Analysis
              </h3>
              <button onClick={() => router.push('/qms/ncr')}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3"/>
              </button>
            </div>
            <div className="space-y-3 mb-5">
              {[
                { label: 'Critical (>60 days)',  count: data.ncr_age_bands.critical, colour: '#ef4444' },
                { label: 'Overdue (>30 days)',   count: data.ncr_age_bands.overdue,  colour: '#f97316' },
                { label: 'Aging (>14 days)',     count: data.ncr_age_bands.aging,    colour: '#f59e0b' },
                { label: 'Recent (<14 days)',    count: data.ncr_age_bands.recent,   colour: '#10b981' },
                { label: 'Closed',               count: data.ncr_age_bands.closed,   colour: '#64748b' },
              ].map(b => <AgeBand key={b.label} {...b}/>)}
            </div>
            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden gap-px">
              {[
                { count: data.ncr_age_bands.critical, colour: '#ef4444' },
                { count: data.ncr_age_bands.overdue,  colour: '#f97316' },
                { count: data.ncr_age_bands.aging,    colour: '#f59e0b' },
                { count: data.ncr_age_bands.recent,   colour: '#10b981' },
                { count: data.ncr_age_bands.closed,   colour: '#334155' },
              ].map((b, i) => {
                const total = Object.values(data.ncr_age_bands).reduce((a: any, v: any) => a + v, 0) as number;
                const w = total > 0 ? (b.count / total) * 100 : 0;
                return w > 0 ? (
                  <div key={i} style={{ width: `${w}%`, backgroundColor: b.colour }} className="transition-all duration-700"/>
                ) : null;
              })}
            </div>
            {data.ncr_records.filter((r: any) => r.age_band === 'critical').length > 0 && (
              <div className="mt-4 pt-4 border-t border-dark-700 space-y-2">
                <p className="text-xs font-bold text-red-400 mb-2">Critical NCRs — immediate action required</p>
                {data.ncr_records.filter((r: any) => r.age_band === 'critical').slice(0, 3).map((r: any) => (
                  <div key={r.ncr_id} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-amber-400">{r.ncr_code}</span>
                    <span className="text-gray-400 truncate mx-3 flex-1">{r.description?.slice(0, 40)}…</span>
                    <span className="text-red-400 font-bold flex-shrink-0">{r.age_days}d</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Training by department */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-400"/> Training Completion by Department
              </h3>
              <button onClick={() => router.push('/qms/training')}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                Training matrix <ChevronRight className="w-3 h-3"/>
              </button>
            </div>
            {data.dept_training.length === 0 ? (
              <p className="text-gray-500 text-sm italic">No training tasks assigned yet.</p>
            ) : (
              <div className="space-y-4">
                {data.dept_training.map((dept: any) => {
                  const pct = parseFloat(dept.completion_pct) || 0;
                  const colour = pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={dept.department}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-gray-300 font-medium">{dept.department || 'Unassigned'}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{dept.completed_tasks}/{dept.total_tasks} tasks</span>
                          <span className="font-bold" style={{ color: colour }}>{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: colour }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Overall training gauge */}
            <div className="mt-6 pt-5 border-t border-dark-700 flex items-center gap-4">
              <GaugeRing pct={trainingPct} colour={trainingPct >= 90 ? '#10b981' : '#f59e0b'} size={72}/>
              <div>
                <p className="text-white font-bold">Overall training completion</p>
                <p className="text-gray-400 text-sm">{n(s.training_completed)} acknowledged · {n(s.training_pending)} pending</p>
              </div>
            </div>
          </div>
        </div>

        {/* Due-soon ribbon */}
        {n(s.due_within_30d) > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-amber-400 flex items-center gap-2">
                <Clock className="w-5 h-5"/> {n(s.due_within_30d)} document{n(s.due_within_30d) !== 1 ? 's' : ''} due for review within 30 days
              </h3>
              <button onClick={() => router.push('/qms/review-calendar')}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                View full calendar <ArrowRight className="w-3.5 h-3.5"/>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.calendar_all
                .filter((d: any) => d.urgency === 'critical' || d.urgency === 'overdue')
                .slice(0, 6)
                .map((d: any) => (
                  <div key={d.doc_id}
                    onClick={() => router.push(`/qms/documents/${d.doc_id}`)}
                    className="flex items-center justify-between bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 cursor-pointer hover:border-amber-500/40 transition-colors">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-primary-400 font-bold">{d.doc_code}</p>
                      <p className="text-white text-sm truncate">{d.doc_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{d.owner_name || 'No owner'}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className={`text-xs font-bold ${d.urgency === 'overdue' ? 'text-red-400' : 'text-amber-400'}`}>
                        {d.urgency === 'overdue' ? 'OVERDUE' : 'DUE SOON'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(d.review_due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
