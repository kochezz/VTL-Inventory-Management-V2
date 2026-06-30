'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth, api } from '@/hooks/useAuth';
import RegisterTable from '@/components/attendance/RegisterTable';
import { CalendarDays, AlertTriangle } from 'lucide-react';

export default function MyRegisterPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!user?.user_id) return;
    load();
  }, [user?.user_id, month]);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/attendance/register/${user!.user_id}?month=${month}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load attendance register.');
    } finally {
      setLoading(false);
    }
  }

  // Summary figures come from the weekly rollup (shifts have net_hours only)
  const totalNormal = data?.weeks?.reduce(
    (acc: number, w: any) => acc + (w.normal_hours ?? 0), 0
  ) ?? 0;
  const totalOT = data?.weeks?.reduce(
    (acc: number, w: any) => acc + (w.weekday_ot_hours ?? 0) + (w.holiday_ot_hours ?? 0), 0
  ) ?? 0;
  const missingPunches: number =
    data?.shifts?.filter((s: any) => s.status === 'missing_punch').length ?? 0;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <CalendarDays className="w-8 h-8 text-primary-400" />
              My Attendance Register
            </h1>
            <p className="text-gray-400 mt-1">Your clock-in / clock-out record for the selected month</p>
          </div>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white
                       focus:border-primary-500 outline-none [color-scheme:dark]"
          />
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Normal Hours</p>
              <p className="text-2xl font-bold text-white font-mono">{totalNormal.toFixed(1)}</p>
            </div>
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Overtime Hours</p>
              <p className={`text-2xl font-bold font-mono ${totalOT > 0 ? 'text-yellow-400' : 'text-white'}`}>
                {totalOT.toFixed(1)}
              </p>
            </div>
            <div className={`rounded-xl p-5 ${
              missingPunches > 0
                ? 'bg-red-500/10 border border-red-500/30'
                : 'bg-dark-800 border border-dark-700'
            }`}>
              <p className={`text-xs uppercase tracking-wider mb-1 ${
                missingPunches > 0 ? 'text-red-400' : 'text-gray-400'
              }`}>Missing Punches</p>
              <p className={`text-2xl font-bold font-mono ${missingPunches > 0 ? 'text-red-400' : 'text-white'}`}>
                {missingPunches}
              </p>
              {missingPunches > 0 && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Please report to your manager
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
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
