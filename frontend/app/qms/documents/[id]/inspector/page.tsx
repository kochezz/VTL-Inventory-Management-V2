'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  ArrowLeft, ShieldCheck, History, Users, Link, AlertOctagon,
  CheckCircle2, Clock, XCircle, Share2, Copy, Trash2, ExternalLink,
  FileText, Target, ChevronDown, ChevronRight, RefreshCw, Download
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface InspectorPack {
  document: any;
  versions: any[];
  approvals: any[];
  training_records: any[];
  training_pending: any[];
  audit_trail: any[];
  linked_documents: any[];
  ncr_capa_impact: any[];
  training_summary: { completed: string; total: string };
  generated_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    RELEASED:   'bg-green-500/10 text-green-400 border-green-500/20',
    REVIEW:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
    DRAFT:      'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    SUPERSEDED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    WITHDRAWN:  'bg-red-500/10 text-red-400 border-red-500/20',
    OPEN:       'bg-red-500/10 text-red-400 border-red-500/20',
    CLOSED:     'bg-green-500/10 text-green-400 border-green-500/20',
  };
  return map[s] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
};

const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtFull = (d: string) => d ? new Date(d).toLocaleString('en-GB') : '—';

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, count }: {
  title: string; icon: any; children: React.ReactNode; count?: number;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 bg-dark-900/60 hover:bg-dark-900 transition-colors">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary-400"/>
          <h3 className="text-white font-bold">{title}</h3>
          {count !== undefined && (
            <span className="text-xs bg-dark-700 text-gray-400 px-2 py-0.5 rounded-full">{count}</span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-500"/> : <ChevronRight className="w-4 h-4 text-gray-500"/>}
      </button>
      {open && <div className="p-6">{children}</div>}
    </div>
  );
}

// ============================================================================

export default function InspectorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [pack, setPack]               = useState<InspectorPack | null>(null);
  const [shareToken, setShareToken]   = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [expiryDays, setExpiryDays]   = useState(30);
  const [recipientNote, setRecipientNote] = useState('');
  const [copied, setCopied]           = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  useEffect(() => {
    if (params.id) fetchAll();
  }, [params.id]);

  async function fetchAll() {
    try {
      setLoading(true);
      const [packRes, tokenRes] = await Promise.all([
        api.get(`/qms/documents/${params.id}/inspector`),
        api.get(`/qms/documents/${params.id}/share-token`).catch(() => ({ data: null })),
      ]);
      setPack(packRes.data);
      setShareToken(tokenRes.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load inspector pack');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateShareLink(e: React.FormEvent) {
    e.preventDefault();
    try {
      setShareLoading(true);
      const res = await api.post(`/qms/documents/${params.id}/share-token`, {
        expiry_days: expiryDays,
        recipient_note: recipientNote,
      });
      setShareToken({ ...res.data, share_url: res.data.share_url });
      setShowShareModal(false);
      setSuccess('Share link created. Copy it and send to your auditor.');
      setTimeout(() => setSuccess(''), 5000);
      await fetchAll();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create share link');
    } finally {
      setShareLoading(false); }
  }

  async function handleRevokeToken() {
    if (!confirm('Revoke this share link? The external auditor will immediately lose access.')) return;
    try {
      await api.delete(`/qms/documents/${params.id}/share-token`);
      setShareToken(null);
      setSuccess('Share link revoked.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to revoke');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shareUrl = shareToken?.share_url ||
    (shareToken?.token ? `${process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin}/qms/inspect/${shareToken.token}` : null);

  if (loading) return (
    <DashboardLayout>
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"/>
      </div>
    </DashboardLayout>
  );

  if (!pack) return (
    <DashboardLayout>
      <div className="p-10 text-center text-red-400">{error || 'Inspector data unavailable'}</div>
    </DashboardLayout>
  );

  const doc     = pack.document;
  const current = pack.versions.find(v => v.status === 'RELEASED') || pack.versions[pack.versions.length - 1];
  const trainingPct = parseInt(pack.training_summary.total) > 0
    ? Math.round((parseInt(pack.training_summary.completed) / parseInt(pack.training_summary.total)) * 100)
    : 100;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-16">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button onClick={() => router.push(`/qms/documents/${params.id}`)}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors mt-1">
              <ArrowLeft className="w-5 h-5 text-gray-400"/>
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="font-mono font-bold text-primary-400 text-sm bg-primary-500/10 px-2 py-0.5 rounded">{doc.doc_code}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${statusBadge(doc.status)}`}>{doc.status}</span>
              </div>
              <h1 className="text-2xl font-bold text-white">{doc.doc_name}</h1>
              <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4"/> Inspector View
                <span className="text-gray-600">·</span>
                Generated {fmtFull(pack.generated_at)}
              </p>
            </div>
          </div>

          {/* Share link panel */}
          <div className="flex-shrink-0">
            {shareToken && shareUrl ? (
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 w-80 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-green-400 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5"/> Active Share Link
                  </p>
                  <button onClick={handleRevokeToken} className="text-gray-600 hover:text-red-400 transition-colors" title="Revoke link">
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                </div>
                {shareToken.recipient_note && (
                  <p className="text-xs text-gray-400 italic">{shareToken.recipient_note}</p>
                )}
                <div className="flex items-center gap-2">
                  <input readOnly value={shareUrl}
                    className="flex-1 text-xs bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-300 font-mono truncate"/>
                  <button onClick={() => copyToClipboard(shareUrl)}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-colors flex-shrink-0 ${copied ? 'bg-green-600 text-white' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}>
                    {copied ? 'Copied!' : <><Copy className="w-3 h-3 inline mr-1"/>Copy</>}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Expires {fmt(shareToken.expires_at)}
                  {shareToken.access_count > 0 && ` · Accessed ${shareToken.access_count}×`}
                </p>
              </div>
            ) : (
              <button onClick={() => setShowShareModal(true)}
                className="px-4 py-2.5 bg-dark-800 border border-dark-700 hover:border-primary-500/50 text-white rounded-xl font-medium flex items-center gap-2 text-sm transition-colors">
                <Share2 className="w-4 h-4 text-primary-400"/> Share with Auditor
              </button>
            )}
          </div>
        </div>

        {success && <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{success}</div>}
        {error   && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

        {/* KPI bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Current Version', value: current ? `v${current.version_number}` : '—', sub: current ? fmt(current.effective_date) : 'Not released' },
            { label: 'Review Due',      value: current?.review_due_date ? fmt(current.review_due_date) : '—', sub: current?.review_due_date && new Date(current.review_due_date) < new Date() ? 'OVERDUE' : 'On track', warn: !!(current?.review_due_date && new Date(current.review_due_date) < new Date()) },
            { label: 'Training',        value: `${trainingPct}%`, sub: `${pack.training_summary.completed} / ${pack.training_summary.total} complete` },
            { label: 'Version History', value: String(pack.versions.length), sub: `${pack.approvals.length} approval${pack.approvals.length !== 1 ? 's' : ''} recorded` },
          ].map(kpi => (
            <div key={kpi.label} className="bg-dark-800 border border-dark-700 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
              <p className={`text-2xl font-black ${kpi.warn ? 'text-red-400' : 'text-white'}`}>{kpi.value}</p>
              <p className={`text-xs mt-0.5 ${kpi.warn ? 'text-red-400' : 'text-gray-500'}`}>{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Version history & approvals */}
        <Section title="Version History & Approval Records" icon={History} count={pack.versions.length}>
          <div className="space-y-4">
            {pack.versions.map((v: any) => (
              <div key={v.version_id} className={`border rounded-xl p-4 ${v.status === 'RELEASED' ? 'border-green-500/30 bg-green-500/5' : 'border-dark-600 bg-dark-900/40'}`}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-white">v{v.version_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border font-bold ${statusBadge(v.status)}`}>{v.status}</span>
                    {v.ncr_code && <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Triggered by {v.ncr_code}</span>}
                    {v.capa_code && <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">CAPA: {v.capa_code}</span>}
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">{fmtFull(v.created_at)}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-xs text-gray-500">Authored by</p><p className="text-white font-medium">{v.author_name || '—'}</p></div>
                  <div><p className="text-xs text-gray-500">Reviewed by</p><p className="text-white font-medium">{v.reviewer_name || '—'}</p></div>
                  <div><p className="text-xs text-gray-500">Approved by</p><p className="text-green-400 font-medium">{v.approver_name || '—'}</p></div>
                  {v.status === 'RELEASED' && <div><p className="text-xs text-gray-500">Effective date</p><p className="text-white font-medium">{fmt(v.effective_date)}</p></div>}
                </div>
                {v.change_reason && (
                  <div className="mt-3 pt-3 border-t border-dark-700">
                    <p className="text-xs text-gray-500 mb-1">Change reason</p>
                    <p className="text-gray-300 text-sm italic">"{v.change_reason}"</p>
                  </div>
                )}
                {/* E-signature records for this version */}
                {pack.approvals.filter((a: any) => a.version_id === v.version_id).map((a: any) => (
                  <div key={a.approval_id} className="mt-3 pt-3 border-t border-dark-700 flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0"/>
                    <p className="text-xs text-gray-400">
                      Electronically signed by <strong className="text-white">{a.approver_name}</strong>
                      {a.approver_title && ` (${a.approver_title})`} on {fmtFull(a.action_at)} — role: {a.role}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>

        {/* Training acknowledgements */}
        <Section title="Training Acknowledgements" icon={Users} count={pack.training_records.length}>
          {pack.training_records.length === 0 ? (
            <p className="text-gray-500 text-sm italic">No acknowledgements recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Employee</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Department</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Role</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Version</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Acknowledged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {pack.training_records.map((r: any) => (
                    <tr key={r.record_id} className="hover:bg-dark-700/30">
                      <td className="py-2 px-3 text-white font-medium">{r.user_name}</td>
                      <td className="py-2 px-3 text-gray-400">{r.user_dept || '—'}</td>
                      <td className="py-2 px-3"><span className="text-xs bg-dark-700 text-gray-300 px-2 py-0.5 rounded">{r.user_role}</span></td>
                      <td className="py-2 px-3 text-gray-400 font-mono">v{r.version_number}</td>
                      <td className="py-2 px-3 text-green-400 text-xs">{fmtFull(r.acknowledged_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pack.training_pending.length > 0 && (
            <div className="mt-4 pt-4 border-t border-dark-700">
              <p className="text-xs font-bold text-amber-400 mb-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5"/> {pack.training_pending.length} pending acknowledgement{pack.training_pending.length !== 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {pack.training_pending.map((t: any) => (
                  <span key={t.task_id} className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-1 rounded">
                    {t.user_name} ({t.user_role})
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Related documents */}
        {pack.linked_documents.length > 0 && (
          <Section title="Related Documents" icon={Link} count={pack.linked_documents.length}>
            <div className="space-y-2">
              {pack.linked_documents.map((l: any) => (
                <div key={`${l.link_id}-${l.relationship}`} className="flex items-center justify-between bg-dark-900 border border-dark-700 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-dark-700 text-gray-400 px-2 py-0.5 rounded capitalize">{l.relationship.replace(/_/g, ' ')}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{l.doc_code} — {l.doc_name}</p>
                      <p className="text-gray-500 text-xs">{l.doc_type} · {l.status} {l.version_number ? `· v${l.version_number}` : ''}</p>
                    </div>
                  </div>
                  <button onClick={() => router.push(`/qms/documents/${l.doc_id}/inspector`)}
                    className="text-gray-600 hover:text-primary-400 transition-colors">
                    <ExternalLink className="w-4 h-4"/>
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* NCR/CAPA quality events */}
        {pack.ncr_capa_impact.length > 0 && (
          <Section title="Quality Events (NCR / CAPA)" icon={AlertOctagon} count={pack.ncr_capa_impact.length}>
            <div className="space-y-3">
              {pack.ncr_capa_impact.map((n: any) => (
                <div key={n.ncr_id} className="bg-dark-900 border border-dark-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-amber-400">{n.ncr_code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border font-bold ${statusBadge(n.ncr_status)}`}>{n.ncr_status}</span>
                      <span className="text-xs text-gray-500">Severity: {n.severity}</span>
                    </div>
                    <span className="text-xs text-gray-500">{fmt(n.ncr_date)}</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">{n.description}</p>
                  {n.capa_code && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dark-700">
                      <Target className="w-3.5 h-3.5 text-purple-400"/>
                      <span className="font-mono text-xs text-purple-400">{n.capa_code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${statusBadge(n.capa_status)}`}>{n.capa_status}</span>
                      <span className="text-xs text-gray-400 truncate">{n.action_description}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">Triggered revision v{n.triggered_version} · Raised by {n.raised_by_name}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Full audit trail */}
        <Section title="21 CFR Part 11 Audit Trail" icon={ShieldCheck} count={pack.audit_trail.length}>
          <div className="space-y-0">
            {pack.audit_trail.map((entry: any, i: number) => (
              <div key={entry.trail_id} className="flex gap-4 py-3 border-b border-dark-700/50 last:border-0">
                <div className="flex flex-col items-center pt-1 gap-1 w-4 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-primary-500/60"/>
                  {i < pack.audit_trail.length - 1 && <div className="w-px flex-1 bg-dark-700"/>}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-primary-400 uppercase tracking-wider">
                      {entry.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{fmtFull(entry.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-0.5">
                    {entry.actor_name || 'System'} <span className="text-gray-500 text-xs">({entry.actor_role || 'system'})</span>
                  </p>
                  {entry.from_status && entry.to_status && (
                    <p className="text-xs text-gray-500 mt-0.5">{entry.from_status} → {entry.to_status}</p>
                  )}
                  {entry.notes && <p className="text-xs text-gray-500 italic mt-0.5">{entry.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </Section>

      </div>

      {/* Share link modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary-400"/> Share with External Auditor
              </h2>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateShareLink} className="p-6 space-y-5">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm">
                Creates a secure, read-only link. The auditor sees the full inspector pack — versions, approvals, training records, and audit trail — but cannot log in or modify anything.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Link expires after</label>
                <select value={expiryDays} onChange={e => setExpiryDays(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 outline-none">
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days (recommended)</option>
                  <option value={90}>90 days</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Recipient note (optional)</label>
                <input type="text" value={recipientNote} onChange={e => setRecipientNote(e.target.value)}
                  placeholder="e.g. Shared with SGS auditor — Annual ISO audit April 2026"
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 outline-none"/>
                <p className="text-xs text-gray-500 mt-1">Recorded in the document audit trail.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowShareModal(false)}
                  className="flex-1 px-4 py-2 bg-dark-700 text-white rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={shareLoading}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-sm disabled:opacity-50">
                  {shareLoading ? 'Generating...' : 'Generate Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}