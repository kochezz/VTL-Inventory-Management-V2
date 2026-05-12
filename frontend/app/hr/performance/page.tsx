'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import HRLayout from '@/components/hr/HRLayout';
import {
  Loader2, AlertTriangle, ChevronRight, ChevronDown,
  Star, Flag, BarChart3,
} from 'lucide-react';
import axios from 'axios';

const HR_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
  .replace(/\/api\/?$/, '').replace(/\/$/, '');

// ── Rating metadata ────────────────────────────────────────────────────────────
const RATING_META: Record<string, { label: string; badge: string; short: string }> = {
  rating_1_unacceptable: {
    label: 'Unacceptable',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    short: '1',
  },
  rating_2_below_target: {
    label: 'Below Target',
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    short: '2',
  },
  rating_3_on_target: {
    label: 'On Target',
    badge: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
    short: '3',
  },
  rating_4_above_target: {
    label: 'Above Target',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    short: '4',
  },
  rating_5_exceptional: {
    label: 'Exceptional',
    badge: 'bg-green-500/10 text-green-400 border-green-500/20',
    short: '5',
  },
};

const RATING_KEYS = Object.keys(RATING_META);

// ── Quarter helpers ───────────────────────────────────────────────────────────
function currentQuarter(): number {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

function quarterLabel(q: number): string {
  return `Q${q}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const router    = useRouter();
  const { token } = useAuth();

  const now = new Date();
  const thisYear    = now.getFullYear();
  const thisQuarter = currentQuarter();

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [selectedYear,    setSelectedYear]    = useState(thisYear);
  const [selectedQuarter, setSelectedQuarter] = useState(thisQuarter);
  const [search, setSearch]                   = useState('');

  // Lazy-loaded ratings per employee (avoids N+1 on page load)
  const [expandedRows, setExpandedRows] = useState<Record<string, any | null>>({});
  const [loadingRows, setLoadingRows]   = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    axios.get(`${HR_BASE}/hr/employees`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setEmployees(r.data))
      .catch(e => setError(e?.response?.data?.message || 'Failed to load employees'))
      .finally(() => setLoading(false));
  }, [token]);

  // When quarter/year changes, clear cached ratings so fresh data loads on expand
  useEffect(() => {
    setExpandedRows({});
  }, [selectedYear, selectedQuarter]);

  const toggleRow = async (userId: string) => {
    if (expandedRows[userId] !== undefined) {
      setExpandedRows(prev => { const n = { ...prev }; delete n[userId]; return n; });
      return;
    }
    setLoadingRows(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await axios.get(`${HR_BASE}/hr/employees/${userId}/ratings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Find the rating matching selected quarter/year
      const match = (res.data as any[]).find(
        r => r.quarter === selectedQuarter && r.year === selectedYear
      ) ?? null;
      setExpandedRows(prev => ({ ...prev, [userId]: match }));
    } catch {
      setExpandedRows(prev => ({ ...prev, [userId]: null }));
    } finally {
      setLoadingRows(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Filter employees with HR records
  const hrEmployees = employees.filter(e => e.hr_status != null);

  const filtered = hrEmployees.filter(e =>
    e.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Compute summary stats from whatever rows have been expanded
  const loadedRatings = Object.values(expandedRows).filter(r => r !== null && r !== undefined) as any[];
  const ratedCount    = loadedRatings.length;
  const notYetRated   = filtered.length - Object.keys(expandedRows).filter(id =>
    filtered.some(e => e.user_id === id)
  ).length;
  const bonusCount    = loadedRatings.filter(r => r?.bonus_eligible).length;

  // Distribution from loaded data
  const distribution: Record<string, number> = {};
  RATING_KEYS.forEach(k => { distribution[k] = 0; });
  loadedRatings.forEach(r => {
    if (r?.overall_rating && distribution[r.overall_rating] !== undefined) {
      distribution[r.overall_rating]++;
    }
  });

  const years = [thisYear - 1, thisYear, thisYear + 1];

  if (loading) {
    return (
      <HRLayout title="Performance Ratings" subtitle="Quarterly output ratings — all staff">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
        </div>
      </HRLayout>
    );
  }

  return (
    <HRLayout title="Performance Ratings" subtitle="Quarterly output ratings — all staff">
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto pb-12">

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-5 py-4 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />{error}
          </div>
        )}

        {/* ── Quarter selector + search ─────────────────────────────────────── */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 whitespace-nowrap">Quarter:</label>
            <select
              value={selectedQuarter}
              onChange={e => setSelectedQuarter(Number(e.target.value))}
              className="px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm"
            >
              {[1, 2, 3, 4].map(q => (
                <option key={q} value={q}>{quarterLabel(q)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 whitespace-nowrap">Year:</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-40 relative">
            <input
              type="text"
              placeholder="Search employee…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm"
            />
          </div>
          <p className="text-xs text-gray-500">
            {selectedQuarter === thisQuarter && selectedYear === thisYear
              ? 'Current quarter'
              : `${quarterLabel(selectedQuarter)} ${selectedYear}`}
            {' · '}Expand rows to load ratings
          </p>
        </div>

        {/* ── Summary stats ─────────────────────────────────────────────────── */}
        {ratedCount > 0 && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Rating Distribution (loaded rows)
            </h3>
            <div className="flex flex-wrap gap-3 mb-4">
              {RATING_KEYS.map(k => {
                const meta  = RATING_META[k];
                const count = distribution[k];
                if (count === 0) return null;
                return (
                  <div
                    key={k}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${meta.badge}`}
                  >
                    {meta.label}: <span className="font-bold ml-1">{count}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-6 text-sm text-gray-400">
              <span>Rows loaded: <span className="text-white font-semibold">{ratedCount}</span></span>
              <span>
                Bonus eligible:{' '}
                <span className="text-yellow-400 font-semibold flex items-center gap-1 inline-flex">
                  <Star className="w-3.5 h-3.5" /> {bonusCount}
                </span>
              </span>
              <span>
                Not yet rated (unloaded):{' '}
                <span className="text-gray-300 font-semibold">{notYetRated}</span>
              </span>
            </div>
          </div>
        )}

        {/* ── Main table ────────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-10 text-center text-gray-500 text-sm">
            {employees.length === 0
              ? 'No HR records found. Create HR records from the Employees page.'
              : 'No employees match your search.'}
          </div>
        ) : (
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-dark-900 border-b border-dark-700">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Employee</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Department</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Overall Rating</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Score</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Bonus</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Action Req.</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">PIP</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filtered.map(emp => {
                  const dept      = emp.department_structured ?? emp.department_name ?? emp.department ?? '—';
                  const isOpen    = expandedRows[emp.user_id] !== undefined;
                  const isLoading = loadingRows[emp.user_id];
                  const rating    = expandedRows[emp.user_id];   // null = no rating found
                  const meta      = rating?.overall_rating ? RATING_META[rating.overall_rating] : null;

                  return (
                    <tr
                      key={emp.user_id}
                      className="hover:bg-dark-700/40 transition-colors cursor-pointer"
                      onClick={() => toggleRow(emp.user_id)}
                    >
                      {/* Expand icon */}
                      <td className="px-4 py-3">
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
                            <p className="text-sm font-semibold text-white">{emp.full_name}</p>
                            <p className="text-xs text-gray-500 capitalize">
                              {emp.hr_status?.replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Department */}
                      <td className="px-4 py-3 text-sm text-gray-400">{dept}</td>
                      {/* Overall Rating */}
                      <td className="px-4 py-3">
                        {!isOpen ? (
                          <span className="text-xs text-gray-600 italic">click to load</span>
                        ) : rating && meta ? (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${meta.badge}`}>
                            {meta.label}
                          </span>
                        ) : isOpen ? (
                          <span className="text-xs text-gray-500 italic">Not yet rated</span>
                        ) : null}
                      </td>
                      {/* Score */}
                      <td className="px-4 py-3 text-sm text-gray-300 font-mono">
                        {rating?.overall_score != null ? Number(rating.overall_score).toFixed(1) : '—'}
                      </td>
                      {/* Bonus eligible */}
                      <td className="px-4 py-3 text-center">
                        {rating?.bonus_eligible
                          ? <Star className="w-4 h-4 text-yellow-400 mx-auto" />
                          : <span className="text-gray-700 text-sm">—</span>
                        }
                      </td>
                      {/* Action required */}
                      <td className="px-4 py-3 text-center">
                        {rating?.action_required
                          ? <Flag className="w-4 h-4 text-red-400 mx-auto" />
                          : <span className="text-gray-700 text-sm">—</span>
                        }
                      </td>
                      {/* PIP issued */}
                      <td className="px-4 py-3 text-center">
                        {emp.has_active_pip
                          ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">PIP</span>
                          : <span className="text-gray-700 text-sm">—</span>
                        }
                      </td>
                      {/* Actions */}
                      <td
                        className="px-4 py-3 text-right"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/hr/employees/${emp.user_id}?tab=reviews`)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary-600/20 hover:bg-primary-600/40 border border-primary-500/30 text-primary-400 text-xs rounded transition-colors"
                          >
                            Rate
                          </button>
                          <button
                            onClick={() => router.push(`/hr/employees/${emp.user_id}`)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white text-xs rounded transition-colors"
                          >
                            Profile <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </HRLayout>
  );
}
