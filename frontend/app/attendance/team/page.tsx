'use client';

// Manager / HR view — direct reports' attendance registers.
// Also provides month-end reconciliation CSV export.
//
// NOTE ON EXPORT FORMAT:
// ExcelJS is required by reporting-service.js but is NOT in backend/package.json.
// Using client-side CSV (the same approach as frontend/app/reports/page.tsx) until
// ExcelJS is added to backend dependencies and a streaming endpoint is built.

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth, api } from '@/hooks/useAuth';
import RegisterTable from '@/components/attendance/RegisterTable';
import { Users, Download, AlertTriangle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const TEAM_ROLES = [
  'admin','hr_admin','hr_manager','manager',
  'production_manager','warehouse_manager','ceo','cfo',
];

function exportCsv(shifts: any[], punches: any[], workerName: string, month: string) {
  // Matches the existing CSV pattern in reports/page.tsx
  const header = ['Date','Clock In','Clock Out','Net Hours','Status','Entry Method'];
  const rows = shifts.map((s: any) => {
    const clockInDay = s.clock_in ? new Date(s.clock_in).toDateString() : null;
    const punchIn    = clockInDay
      ? punches?.find((p: any) => p.type === 'clock_in' && new Date(p.time).toDateString() === clockInDay)
      : null;
    return [
      s.clock_in  ? new Date(s.clock_in).toLocaleDateString()                                 : '',
      s.clock_in  ? new Date(s.clock_in).toLocaleTimeString([], { hour12: false })             : '—',
      s.clock_out ? new Date(s.clock_out).toLocaleTimeString([], { hour12: false })            : '—',
      s.net_hours != null ? Number(s.net_hours).toFixed(2)                                     : '',
      s.status ?? '',
      punchIn?.entry_method ?? '',
    ];
  });

  const csv = [header, ...rows]
    .map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Attendance_${workerName.replace(/ /g, '_')}_${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TeamRegisterPage() {
  const { user }          = useAuth();
  const router            = useRouter();
  const [team,       setTeam]       = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!user?.role) return;
    if (!TEAM_ROLES.includes(user.role)) { router.push('/dashboard'); return; }
    api.get('/attendance/team')
      .then(r => {
        setTeam(r.data.team);
        if (r.data.team.length) setSelectedId(r.data.team[0].user_id);
      })
      .catch(() => setError('Failed to load team.'));
  }, [user?.role]);

  useEffect(() => {
    if (!selectedId) return;
    loadRegister();
  }, [selectedId, month]);

  async function loadRegister() {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/attendance/register/${selectedId}?month=${month}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load register.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const selectedWorker   = team.find((t: any) => t.user_id === selectedId);
  const missingPunches   = data?.shifts?.filter((s: any) => s.status === 'missing_punch').length ?? 0;
  const hasData          = (data?.shifts?.length ?? 0) > 0;

  if (user?.role && !TEAM_ROLES.includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Users className="w-8 h-8 text-primary-400" />
              Team Attendance Register
            </h1>
            <p className="text-gray-400 mt-1">
              View your direct reports' attendance. Export CSV for month-end reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white
                         focus:border-primary-500 outline-none min-w-[200px]"
            >
              {team.length === 0 && <option value="">No direct reports</option>}
              {team.map((m: any) => (
                <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
              ))}
            </select>

            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white
                         focus:border-primary-500 outline-none [color-scheme:dark]"
            />

            {hasData && (
              <button
                onClick={() =>
                  exportCsv(data.shifts, data.punches, selectedWorker?.full_name ?? 'Worker', month)
                }
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700
                           text-white rounded-lg transition-colors font-medium"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {missingPunches > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg
                          flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {missingPunches} missing punch{missingPunches !== 1 ? 'es' : ''} this month
            for {selectedWorker?.full_name ?? 'this employee'}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg
                          flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <RegisterTable
          shifts={data?.shifts}
          punches={data?.punches}
          weeks={data?.weeks}
          loading={loading}
        />
      </div>
    </DashboardLayout>
  );
}
