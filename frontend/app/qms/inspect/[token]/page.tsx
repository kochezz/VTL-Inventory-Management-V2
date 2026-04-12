'use client';

// ============================================================================
// PUBLIC INSPECTOR PAGE — No login required
// Route: /qms/inspect/[token]
// File: app/qms/inspect/[token]/page.tsx
//
// This page is intentionally outside DashboardLayout — external auditors
// see a clean, branded, read-only view with no sidebar or nav controls.
// ============================================================================

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  ShieldCheck, History, Users, AlertOctagon, Link,
  CheckCircle2, Clock, XCircle, Target, ChevronDown,
  ChevronRight, AlertCircle
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const fmt = (d: string) => d
  ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  : '—';
const fmtFull = (d: string) => d ? new Date(d).toLocaleString('en-GB') : '—';

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    RELEASED:   'bg-green-100 text-green-800 border-green-300',
    SUPERSEDED: 'bg-gray-100 text-gray-600 border-gray-300',
    DRAFT:      'bg-yellow-100 text-yellow-800 border-yellow-300',
    OPEN:       'bg-red-100 text-red-800 border-red-300',
    CLOSED:     'bg-green-100 text-green-800 border-green-300',
  };
  return map[s] || 'bg-gray-100 text-gray-600 border-gray-300';
};

function Card({ title, icon: Icon, children, count }: any) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-blue-600"/>
          <h3 className="font-bold text-gray-900">{title}</h3>
          {count !== undefined && (
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{count}</span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400"/> : <ChevronRight className="w-4 h-4 text-gray-400"/>}
      </button>
      {open && <div className="p-6 bg-white">{children}</div>}
    </div>
  );
}

export default function PublicInspectorPage() {
  const params  = useParams();
  const token   = params.token as string;

  const [pack, setPack]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (token) fetchPack();
  }, [token]);

  async function fetchPack() {
    try {
      const res = await fetch(`${API_URL}/qms/inspect/${token}`);
      if (res.status === 404) { setExpired(true); return; }
      if (!res.ok) { setError('Failed to load document pack.'); return; }
      setPack(await res.json());
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"/>
        <p className="text-gray-500 text-sm">Loading document pack…</p>
      </div>
    </div>
  );

  // ── Expired / invalid ───────────────────────────────────────────────────────
  if (expired) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-red-500"/>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Link Expired or Revoked</h1>
        <p className="text-gray-500 mb-6">This share link is no longer valid. It may have expired or been revoked by the document owner. Please contact the Vilagio QA team for a new link.</p>
        <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-600">
          <p><strong>Vilagio Technologies Ltd.</strong></p>
          <p>quality@vilag.io</p>
        </div>
      </div>
    </div>
  );

  if (error || !pack) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4"/>
        <p className="text-gray-700">{error || 'Document not available.'}</p>
      </div>
    </div>
  );

  const doc       = pack.document;
  const current   = pack.versions.find((v: any) => v.status === 'RELEASED') || pack.versions[pack.versions.length - 1];
  const tokenInfo = pack.share_token_info;
  const trainingPct = parseInt(pack.training_summary.total) > 0
    ? Math.round((parseInt(pack.training_summary.completed) / parseInt(pack.training_summary.total)) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* Header bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white text-sm">VTL</div>
            <div>
              <p className="font-bold text-gray-900 text-sm">VILAGIO TRADING LIMITED</p>
              <p className="text-gray-500 text-xs">Quality Management System — Controlled Document Inspector</p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>Read-only view · External auditor access</p>
            {tokenInfo?.expires_at && <p>Link valid until {fmt(tokenInfo.expires_at)}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Document identity */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono font-bold text-blue-600 text-sm bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{doc.doc_code}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${statusBadge(doc.status)}`}>{doc.status}</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{doc.doc_type}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{doc.doc_name}</h1>
              <p className="text-gray-500 text-sm">{doc.section_code} — {doc.section_name}</p>
            </div>
            <div className="text-right text-sm text-gray-500 space-y-1 flex-shrink-0">
              {current && <>
                <p><strong>Version:</strong> {current.version_number}</p>
                <p><strong>Effective:</strong> {fmt(current.effective_date)}</p>
                <p><strong>Review due:</strong> {fmt(current.review_due_date)}</p>
              </>}
            </div>
          </div>

          {doc.owner_name && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6 text-sm text-gray-600">
              <div><span className="font-medium">Document Owner:</span> {doc.owner_name}{doc.owner_title ? ` — ${doc.owner_title}` : ''}</div>
              {doc.owner_dept && <div><span className="font-medium">Department:</span> {doc.owner_dept}</div>}
            </div>
          )}
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Versions on record', value: String(pack.versions.length) },
            { label: 'E-signature approvals', value: String(pack.approvals.length) },
            { label: 'Training completion', value: `${trainingPct}%`, warn: trainingPct < 100 },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <p className={`text-3xl font-black ${k.warn ? 'text-amber-600' : 'text-gray-900'}`}>{k.value}</p>
              <p className="text-xs text-gray-500 mt-1">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Version history */}
        <Card title="Version History & Electronic Signatures" icon={History} count={pack.versions.length}>
          <div className="space-y-4">
            {pack.versions.map((v: any) => (
              <div key={v.version_id} className={`border rounded-xl p-4 ${v.status === 'RELEASED' ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-gray-900">v{v.version_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border font-bold ${statusBadge(v.status)}`}>{v.status}</span>
                    {v.ncr_code && <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">NCR: {v.ncr_code}</span>}
                  </div>
                  <span className="text-xs text-gray-500">{fmtFull(v.created_at)}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <div><p className="text-xs text-gray-400">Author</p><p className="font-medium text-gray-900">{v.author_name || '—'}</p></div>
                  <div><p className="text-xs text-gray-400">Reviewer</p><p className="font-medium text-gray-900">{v.reviewer_name || '—'}</p></div>
                  <div><p className="text-xs text-gray-400">Approver</p><p className="font-medium text-green-700">{v.approver_name || '—'}</p></div>
                </div>
                {v.change_reason && (
                  <p className="text-sm text-gray-600 italic border-t border-gray-200 pt-2 mt-2">"{v.change_reason}"</p>
                )}
                {pack.approvals.filter((a: any) => a.version_id === v.version_id).map((a: any) => (
                  <div key={a.approval_id} className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                    <ShieldCheck className="w-4 h-4 text-green-600"/>
                    <span>Electronically signed by <strong>{a.approver_name}</strong>{a.approver_title ? ` (${a.approver_title})` : ''} on {fmtFull(a.action_at)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>

        {/* Training */}
        <Card title="Training Acknowledgements" icon={Users} count={pack.training_records.length}>
          {pack.training_records.length === 0 ? (
            <p className="text-gray-500 text-sm italic">No training records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-xs text-gray-500 font-medium">Employee</th>
                    <th className="text-left py-2 px-2 text-xs text-gray-500 font-medium">Department</th>
                    <th className="text-left py-2 px-2 text-xs text-gray-500 font-medium">Version</th>
                    <th className="text-left py-2 px-2 text-xs text-gray-500 font-medium">Acknowledged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pack.training_records.map((r: any) => (
                    <tr key={r.record_id}>
                      <td className="py-2 px-2 font-medium text-gray-900">{r.user_name}</td>
                      <td className="py-2 px-2 text-gray-600">{r.user_dept || '—'}</td>
                      <td className="py-2 px-2 text-gray-500 font-mono text-xs">v{r.version_number}</td>
                      <td className="py-2 px-2 text-green-700 text-xs">{fmtFull(r.acknowledged_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pack.training_pending.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-amber-700 font-bold mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5"/> {pack.training_pending.length} pending
              </p>
              <div className="flex flex-wrap gap-2">
                {pack.training_pending.map((t: any) => (
                  <span key={t.task_id} className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2 py-1 rounded">
                    {t.user_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Quality events */}
        {pack.ncr_capa_impact.length > 0 && (
          <Card title="Quality Events (NCR / CAPA)" icon={AlertOctagon} count={pack.ncr_capa_impact.length}>
            <div className="space-y-3">
              {pack.ncr_capa_impact.map((n: any) => (
                <div key={n.ncr_id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm font-bold text-amber-700">{n.ncr_code}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${statusBadge(n.ncr_status)}`}>{n.ncr_status}</span>
                    <span className="text-xs text-gray-500">{n.severity}</span>
                    <span className="text-xs text-gray-400 ml-auto">{fmt(n.ncr_date)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{n.description}</p>
                  {n.capa_code && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 border-t border-gray-100 pt-2">
                      <Target className="w-3.5 h-3.5 text-purple-600"/>
                      <span className="font-mono text-purple-700">{n.capa_code}</span>
                      <span className={`px-1.5 py-0.5 rounded border ${statusBadge(n.capa_status)}`}>{n.capa_status}</span>
                      <span className="truncate">{n.action_description}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Audit trail */}
        <Card title="Audit Trail (21 CFR Part 11)" icon={ShieldCheck} count={pack.audit_trail.length}>
          <div className="space-y-0 max-h-96 overflow-y-auto">
            {pack.audit_trail.map((entry: any, i: number) => (
              <div key={entry.trail_id} className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0 text-sm">
                <div className="w-px bg-gray-200 mx-2 flex-shrink-0 relative">
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-400"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-700 uppercase">{entry.action.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{fmtFull(entry.created_at)}</span>
                  </div>
                  <p className="text-gray-700">{entry.actor_name || 'System'} <span className="text-gray-400 text-xs">({entry.actor_role})</span></p>
                  {entry.notes && <p className="text-xs text-gray-500 italic">{entry.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 py-6 border-t border-gray-200">
          <p className="font-medium text-gray-600 mb-1">VILAGIO TRADING LIMITED</p>
          <p>This is a read-only, auditor-access view generated by the Vilagio QMS.</p>
          <p>Document content is managed in accordance with ISO 9001:2015 and GMP requirements.</p>
          {tokenInfo?.recipient_note && <p className="mt-2 italic">Note: {tokenInfo.recipient_note}</p>}
        </div>

      </div>
    </div>
  );
}