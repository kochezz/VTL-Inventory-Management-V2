'use client';

// ============================================================================
// QMS REVIEW CALENDAR — Phase 4
// Route: /qms/review-calendar
// File: app/qms/review-calendar/page.tsx
// ============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  ArrowLeft, Calendar, Clock, AlertCircle, CheckCircle2,
  Filter, ChevronLeft, ChevronRight, AlertOctagon, User
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const URGENCY_CONFIG: Record<string, { label: string; colour: string; bg: string; border: string }> = {
  overdue:   { label: 'Overdue',     colour: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30' },
  critical:  { label: 'Due ≤30d',    colour: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30' },
  soon:      { label: 'Due ≤90d',    colour: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  scheduled: { label: 'Scheduled',   colour: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
};

const DOC_TYPE_DOT: Record<string, string> = {
  MAN: '#8b5cf6', POL: '#0ea5e9', SOP: '#10b981',
  FRM: '#f59e0b', CHK: '#f97316', LOG: '#6366f1', REG: '#ec4899',
};

// ============================================================================

export default function ReviewCalendarPage() {
  const router = useRouter();

  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [typeFilter, setTypeFilter]   = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [viewMode, setViewMode] = useState<'timeline'|'list'>('timeline');

  const now = new Date();
  const [scrollMonth, setScrollMonth] = useState(0); // offset from current month

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await api.get('/qms/review-calendar');
      setData(res.data);
    } catch (e) {
      console.error('Failed to load calendar', e);
    } finally {
      setLoading(false);
    }
  }

  // Filtered documents
  const filtered = (data?.all || []).filter((d: any) => {
    const matchType    = !typeFilter    || d.doc_type === typeFilter;
    const matchUrgency = !urgencyFilter || d.urgency  === urgencyFilter;
    return matchType && matchUrgency;
  });

  // Group filtered docs by month
  const byMonth: Record<string, any[]> = {};
  filtered.forEach((d: any) => {
    const key = `${d.due_year}-${String(d.due_month).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(d);
  });

  // Build 12 month grid starting from current month
  const months = Array.from({ length: 12 }, (_, i) => {
    const date  = new Date(now.getFullYear(), now.getMonth() + i + scrollMonth, 1);
    const year  = date.getFullYear();
    const month = date.getMonth() + 1;
    const key   = `${year}-${String(month).padStart(2, '0')}`;
    return { year, month, key, label: `${MONTH_NAMES[month - 1]} ${year}`, docs: byMonth[key] || [] };
  });

  const totalDocs = filtered.length;

  if (loading) return (
    <DashboardLayout>
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"/>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="max-w-[1400px] mx-auto space-y-5 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/qms/compliance')}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400"/>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Calendar className="w-7 h-7 text-primary-500"/> Review Calendar
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                12-month forward view of document review obligations · {totalDocs} document{totalDocs !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex bg-dark-800 border border-dark-700 rounded-lg p-1">
              {(['timeline', 'list'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors capitalize ${viewMode === m ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {m}
                </button>
              ))}
            </div>

            {/* Doc type filter */}
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm focus:border-primary-500 outline-none">
              <option value="">All types</option>
              {['SOP','POL','MAN','FRM','CHK','LOG','REG'].map(t =>
                <option key={t} value={t}>{t}</option>
              )}
            </select>

            {/* Urgency filter */}
            <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}
              className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm focus:border-primary-500 outline-none">
              <option value="">All urgencies</option>
              {Object.entries(URGENCY_CONFIG).map(([k, v]) =>
                <option key={k} value={k}>{v.label}</option>
              )}
            </select>
          </div>
        </div>

        {/* Urgency summary bar */}
        {data?.urgency_counts && (
          <div className="flex gap-3 flex-wrap">
            {Object.entries(URGENCY_CONFIG).map(([key, cfg]) => {
              const count = data.urgency_counts[key] || 0;
              return (
                <button key={key}
                  onClick={() => setUrgencyFilter(urgencyFilter === key ? '' : key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${urgencyFilter === key ? `${cfg.bg} ${cfg.border} ${cfg.colour}` : 'bg-dark-800 border-dark-700 text-gray-400 hover:border-dark-500'}`}>
                  <span className="font-black text-lg">{count}</span>
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Navigation controls */}
        <div className="flex items-center justify-between">
          <button onClick={() => setScrollMonth(s => s - 1)}
            disabled={scrollMonth <= -6}
            className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 transition-colors text-sm">
            <ChevronLeft className="w-4 h-4"/> Previous
          </button>
          <button onClick={() => setScrollMonth(0)}
            className="px-4 py-2 bg-dark-700 text-white rounded-lg text-sm transition-colors hover:bg-dark-600">
            Today
          </button>
          <button onClick={() => setScrollMonth(s => s + 1)}
            disabled={scrollMonth >= 12}
            className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 transition-colors text-sm">
            Next <ChevronRight className="w-4 h-4"/>
          </button>
        </div>

        {/* ── TIMELINE VIEW ───────────────────────────────────────────────── */}
        {viewMode === 'timeline' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {months.map(({ year, month, key, label, docs }) => {
              const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
              const hasOverdue = docs.some(d => d.urgency === 'overdue');
              const hasCritical = docs.some(d => d.urgency === 'critical');

              return (
                <div key={key}
                  className={`bg-dark-800 rounded-xl overflow-hidden border transition-all ${
                    isCurrentMonth ? 'border-primary-500/50 shadow-lg shadow-primary-500/10' :
                    hasOverdue     ? 'border-red-500/40' :
                    hasCritical    ? 'border-amber-500/30' :
                    'border-dark-700'
                  }`}>
                  {/* Month header */}
                  <div className={`px-4 py-3 border-b ${
                    isCurrentMonth ? 'bg-primary-600/20 border-primary-500/30' :
                    hasOverdue     ? 'bg-red-500/10 border-red-500/20' :
                    hasCritical    ? 'bg-amber-500/10 border-amber-500/20' :
                    'bg-dark-900/60 border-dark-700'
                  }`}>
                    <div className="flex items-center justify-between">
                      <p className={`font-bold text-sm ${isCurrentMonth ? 'text-primary-400' : 'text-white'}`}>
                        {label}
                        {isCurrentMonth && <span className="ml-2 text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded">Now</span>}
                      </p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        docs.length === 0 ? 'text-gray-600 bg-dark-700' :
                        hasOverdue  ? 'text-red-400 bg-red-500/20' :
                        hasCritical ? 'text-amber-400 bg-amber-500/20' :
                        'text-gray-300 bg-dark-700'
                      }`}>
                        {docs.length}
                      </span>
                    </div>
                  </div>

                  {/* Documents */}
                  <div className="p-3 space-y-2 min-h-[80px]">
                    {docs.length === 0 ? (
                      <p className="text-gray-700 text-xs italic text-center py-3">No reviews due</p>
                    ) : docs.map((doc: any) => {
                      const cfg = URGENCY_CONFIG[doc.urgency];
                      return (
                        <div key={doc.doc_id}
                          onClick={() => router.push(`/qms/documents/${doc.doc_id}`)}
                          className={`px-3 py-2 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${cfg.bg} ${cfg.border}`}>
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                              style={{ backgroundColor: DOC_TYPE_DOT[doc.doc_type] || '#64748b' }}/>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-bold font-mono ${cfg.colour}`}>{doc.doc_code}</p>
                              <p className="text-xs text-gray-300 truncate leading-tight mt-0.5">{doc.doc_name}</p>
                              {doc.owner_name && (
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  <User className="w-2.5 h-2.5"/> {doc.owner_name}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className={`text-xs mt-1.5 font-medium ${cfg.colour}`}>
                            {new Date(doc.review_due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── LIST VIEW ───────────────────────────────────────────────────── */}
        {viewMode === 'list' && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-dark-900 border-b border-dark-700">
                <tr>
                  <th className="px-5 py-3 text-xs text-gray-400 uppercase font-medium">Document</th>
                  <th className="px-5 py-3 text-xs text-gray-400 uppercase font-medium">Section</th>
                  <th className="px-5 py-3 text-xs text-gray-400 uppercase font-medium">Owner</th>
                  <th className="px-5 py-3 text-xs text-gray-400 uppercase font-medium">Review Due</th>
                  <th className="px-5 py-3 text-xs text-gray-400 uppercase font-medium text-center">Urgency</th>
                  <th className="px-5 py-3 text-xs text-gray-400 uppercase font-medium text-center">Task</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500 italic">
                      No documents match the current filters.
                    </td>
                  </tr>
                ) : filtered.map((doc: any) => {
                  const cfg = URGENCY_CONFIG[doc.urgency];
                  return (
                    <tr key={doc.doc_id}
                      onClick={() => router.push(`/qms/documents/${doc.doc_id}`)}
                      className="hover:bg-dark-700/50 cursor-pointer transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: DOC_TYPE_DOT[doc.doc_type] || '#64748b' }}/>
                          <div>
                            <p className="font-mono font-bold text-primary-400 text-sm">{doc.doc_code}</p>
                            <p className="text-white text-sm font-medium">{doc.doc_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs bg-dark-700 text-gray-300 px-2 py-0.5 rounded font-medium">
                          {doc.section_code}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400">
                        {doc.owner_name || <span className="text-gray-600 italic">Unassigned</span>}
                      </td>
                      <td className="px-5 py-4">
                        <p className={`text-sm font-medium ${cfg.colour}`}>
                          {new Date(doc.review_due_date).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'long', year: 'numeric'
                          })}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.border} ${cfg.colour}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {doc.has_open_task ? (
                          <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Task open</span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs text-gray-500 px-1">
          <span className="font-medium uppercase tracking-wider">Doc type</span>
          {Object.entries(DOC_TYPE_DOT).map(([k, colour]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colour }}/>
              <span>{k}</span>
            </div>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
}
