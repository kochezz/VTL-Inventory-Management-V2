'use client';

import { Clock, AlertTriangle, CheckCircle2, QrCode, Mail } from 'lucide-react';

interface RegisterTableProps {
  shifts:  any[] | undefined;
  punches: any[] | undefined;
  weeks:   any[] | undefined;
  loading: boolean;
}

function fmtTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function hrs(n: number | null | undefined): string {
  return n != null ? n.toFixed(2) : '—';
}

// Resolve the clock-in entry_method for a given shift from the raw punch list.
// We match on type='clock_in' and the same calendar date as the shift's clock_in.
function entryMethodFor(punches: any[] | undefined, clockIn: string | null): string | null {
  if (!punches || !clockIn) return null;
  const ciDay = new Date(clockIn).toDateString();
  const p = punches.find(
    (p: any) => p.type === 'clock_in' && p.time && new Date(p.time).toDateString() === ciDay
  );
  return p?.entry_method ?? null;
}

const STATUS_STYLE: Record<string, string> = {
  ok:                'bg-green-500/10  text-green-400  border-green-500/30',
  missing_punch:     'bg-red-500/10    text-red-400    border-red-500/30',
  orphan_clock_out:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  over_max_shift:    'bg-orange-500/10 text-orange-400 border-orange-500/30',
  manually_adjusted: 'bg-blue-500/10   text-blue-400   border-blue-500/30',
};

export default function RegisterTable({ shifts, punches, weeks, loading }: RegisterTableProps) {
  if (loading) {
    return (
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-12 flex justify-center">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!shifts || shifts.length === 0) {
    return (
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-12 text-center text-gray-500">
        No attendance records for this period.
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Shift detail ─────────────────────────────────────────────────────── */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-dark-700">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-400" />
            Shift Detail
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-dark-900 border-b border-dark-700 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Clock&nbsp;In</th>
                <th className="px-4 py-3 font-medium">Clock&nbsp;Out</th>
                <th className="px-4 py-3 font-medium text-right">Net&nbsp;h</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Entry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {shifts.map((s: any, i: number) => {
                const style  = STATUS_STYLE[s.status] || STATUS_STYLE.ok;
                const method = entryMethodFor(punches, s.clock_in);
                return (
                  <tr key={i} className="hover:bg-dark-900/50 transition-colors">
                    <td className="px-4 py-3 text-gray-300 font-medium whitespace-nowrap">
                      {fmtDate(s.clock_in)}
                    </td>
                    <td className="px-4 py-3 font-mono text-white">{fmtTime(s.clock_in)}</td>
                    <td className="px-4 py-3 font-mono text-white">{fmtTime(s.clock_out)}</td>
                    <td className="px-4 py-3 font-mono text-right text-white">{hrs(s.net_hours)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
                        {s.status === 'missing_punch' && <AlertTriangle className="w-3 h-3" />}
                        {s.status === 'ok'            && <CheckCircle2  className="w-3 h-3" />}
                        {(s.status ?? 'ok').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {method === 'qr' && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-dark-700 text-gray-400 border border-dark-600"
                          title="Scanned badge QR"
                        >
                          <QrCode className="w-3 h-3" /> QR
                        </span>
                      )}
                      {method === 'email' && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-dark-700 text-gray-400 border border-dark-600"
                          title="Typed email username"
                        >
                          <Mail className="w-3 h-3" /> Email
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Weekly summary ───────────────────────────────────────────────────── */}
      {weeks && weeks.length > 0 && (
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-700">
            <h3 className="text-sm font-bold text-white">Weekly Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-dark-900 border-b border-dark-700 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">ISO Week</th>
                  <th className="px-4 py-3 font-medium text-right">Normal&nbsp;h</th>
                  <th className="px-4 py-3 font-medium text-right">Weekday&nbsp;OT&nbsp;h</th>
                  <th className="px-4 py-3 font-medium text-right">Holiday&nbsp;OT&nbsp;h</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {weeks.map((w: any, i: number) => (
                  <tr key={i} className="hover:bg-dark-900/50 transition-colors">
                    <td className="px-4 py-3 text-gray-300 font-mono">{w.iso_week ?? `Week ${i + 1}`}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-400">
                      {hrs(w.normal_hours)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-yellow-400">
                      {hrs(w.weekday_ot_hours)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-orange-400">
                      {hrs(w.holiday_ot_hours)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
