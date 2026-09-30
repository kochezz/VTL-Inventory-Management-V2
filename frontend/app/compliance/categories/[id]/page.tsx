'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ArrowLeft, Gavel, AlertCircle, Eye, CheckCircle2, Upload, ShieldCheck, X, Clock } from 'lucide-react';
import { formatCadence } from '@/utils/complianceUtils';
import { RowErrorBoundary } from '@/components/compliance/RowErrorBoundary';

// Same role set the Categories list page itself uses -- viewing a single
// category's history is not more sensitive than seeing it in the list.
const CAN_VIEW_ROLES = ['junior_accountant', 'manager', 'admin', 'cfo', 'ceo'];
const EXECUTIVE_ROLES = ['admin', 'cfo', 'ceo'];

interface ComplianceCategory {
  category_id: string;
  name: string;
  regulator: string | null;
  cadence_type: 'ONE_OFF' | 'RECURRING' | null;
  interval_months: number | null;
  due_day_of_month: number | null;
  obligation_kind: 'FILING' | 'RENEWAL' | null;
  status: string;
}

interface ComplianceItem {
  item_id: string;
  due_date: string;
  issued_date: string | null;
  status: string;
  is_acknowledged: boolean;
  approved_by_name: string | null;
  evidence_file_ref: string | null;
  can_view_evidence: boolean;
  filed_late?: boolean;
  created_by: string;
}

const ITEM_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  PENDING_APPROVAL: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  APPROVED: 'bg-green-500/10 text-green-400 border-green-500/20',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
  NON_COMPLIANT: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  RETURNED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ARCHIVED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  UPCOMING: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  EVIDENCE_SUBMITTED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  VERIFIED: 'bg-green-500/10 text-green-400 border-green-500/20',
};

// A real, standalone component -- not inline JSX inside items.map() --
// following this module's established RowErrorBoundary rule (see
// components/compliance/RowErrorBoundary.tsx): the boundary can only catch
// an error thrown while rendering a distinct child component, not one
// thrown while the parent is still constructing its own JSX.
function EvidenceHistoryRow({ item, previewingId, onPreview }: {
  item: ComplianceItem;
  previewingId: string | null;
  onPreview: () => void;
}) {
  const hasEvidence = item.status !== 'DRAFT';
  return (
    <tr className={`hover:bg-dark-700/50 transition-colors ${item.status === 'ARCHIVED' ? 'opacity-60' : ''}`}>
      <td className="py-3 px-6 text-gray-300">{new Date(item.due_date).toLocaleDateString()}</td>
      <td className="py-3 px-6 text-center">
        <span className={`px-2.5 py-1 rounded-lg border font-bold text-xs uppercase tracking-wider ${ITEM_STATUS_STYLES[item.status] || ''}`}>
          {item.status.replace(/_/g, ' ')}
        </span>
        {item.filed_late && (
          <span className="block text-[10px] text-amber-400 mt-1 font-bold uppercase">Filed Late</span>
        )}
      </td>
      <td className="py-3 px-6 text-center">
        {item.is_acknowledged ? (
          <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" />
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="py-3 px-6 text-gray-300">{item.approved_by_name || '—'}</td>
      <td className="py-3 px-6 text-right">
        {hasEvidence && item.can_view_evidence ? (
          <button
            onClick={onPreview}
            disabled={previewingId === item.item_id}
            className="flex items-center gap-1.5 text-primary-400 hover:text-primary-300 text-xs font-medium ml-auto disabled:opacity-50"
          >
            <Eye className="w-3.5 h-3.5" />
            {previewingId === item.item_id ? 'Opening...' : 'View certificate'}
          </button>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

export default function ComplianceCategoryDetailPage() {
  const params = useParams();
  const categoryId = params?.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [category, setCategory] = useState<ComplianceCategory | null>(null);
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const [uploadTarget, setUploadTarget] = useState<ComplianceItem | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadExpiry, setUploadExpiry] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  const [verifyTarget, setVerifyTarget] = useState<ComplianceItem | null>(null);
  const [verifyJustification, setVerifyJustification] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    if (user && !CAN_VIEW_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (user && CAN_VIEW_ROLES.includes(user.role) && categoryId) {
      fetchDetail();
    }
  }, [user, categoryId]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError('');
      // show_archived=true here deliberately -- this is a history view, not
      // an operational worklist, so archived items stay visible for audit
      // purposes rather than hidden by the "off by default" rule that
      // applies to the Categories/My Tasks lists.
      const [catRes, itemsRes] = await Promise.all([
        api.get(`/compliance/categories/${categoryId}`),
        api.get(`/compliance/items?category_id=${categoryId}&show_archived=true`),
      ]);
      setCategory(catRes.data);
      setItems(itemsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load this category.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Same authenticated-blob-fetch pattern as My Tasks / Approvals -- a
  // plain href/src can't carry the Bearer token. Reuses the existing
  // GET /items/:id/evidence route unchanged, per the spec's explicit
  // instruction not to create a second evidence route.
  const previewEvidence = async (itemId: string) => {
    try {
      setPreviewingId(itemId);
      const res = await api.get(`/compliance/items/${itemId}/evidence`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      setError('Failed to load the evidence PDF for this item.');
      console.error(err);
    } finally {
      setPreviewingId(null);
    }
  };

  const openUpload = (item: ComplianceItem) => {
    setUploadTarget(item);
    setUploadFile(null);
    setUploadExpiry('');
    setUploadError('');
  };

  const handleUpload = async () => {
    if (!uploadTarget) return;
    if (!uploadFile) { setUploadError('Choose a PDF file.'); return; }
    if (category?.obligation_kind === 'RENEWAL' && !uploadExpiry) {
      setUploadError("The certificate's expiry date is required for a renewal obligation.");
      return;
    }
    try {
      setUploadLoading(true);
      setUploadError('');
      const fd = new FormData();
      fd.append('evidence', uploadFile);
      if (uploadExpiry) fd.append('certificate_expiry_date', uploadExpiry);
      await api.post(`/compliance/items/${uploadTarget.item_id}/evidence`, fd);
      setUploadTarget(null);
      fetchDetail();
    } catch (err: any) {
      setUploadError(err.response?.data?.message || 'Failed to upload evidence.');
    } finally {
      setUploadLoading(false);
    }
  };

  const openVerify = (item: ComplianceItem) => {
    setVerifyTarget(item);
    setVerifyJustification('');
    setVerifyError('');
  };

  const handleVerify = async () => {
    if (!verifyTarget) return;
    const isSelf = verifyTarget.created_by === user?.user_id;
    if (isSelf && !verifyJustification.trim()) {
      setVerifyError('Justification is required to verify your own upload.');
      return;
    }
    try {
      setVerifyLoading(true);
      setVerifyError('');
      await api.post(`/compliance/items/${verifyTarget.item_id}/verify`, { justification: verifyJustification || undefined });
      setVerifyTarget(null);
      fetchDetail();
    } catch (err: any) {
      setVerifyError(err.response?.data?.message || 'Failed to verify this item.');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Earliest not-yet-complete period, or the most recent complete one if
  // everything's caught up -- same rule the Compliance Register uses to
  // pick "the current period" for its own Next Due column.
  const currentPeriod = (() => {
    const pending = items
      .filter((i) => ['UPCOMING', 'EVIDENCE_SUBMITTED', 'NON_COMPLIANT'].includes(i.status))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    if (pending.length > 0) return pending[0];
    const complete = items
      .filter((i) => i.status === 'VERIFIED' || i.status === 'APPROVED')
      .sort((a, b) => b.due_date.localeCompare(a.due_date));
    return complete[0] || null;
  })();

  const isExecutive = !!user && EXECUTIVE_ROLES.includes(user.role);

  if (user && !CAN_VIEW_ROLES.includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1200px] mx-auto space-y-6 pb-12">
        <button
          onClick={() => router.push('/compliance')}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Register
        </button>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500 mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        ) : category ? (
          <>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Gavel className="w-8 h-8 text-primary-500" />
                {category.name}
              </h1>
              <p className="text-gray-400 mt-1">
                {category.regulator ? `${category.regulator} — ` : ''}
                {formatCadence(category.cadence_type, category.interval_months)}
                {category.obligation_kind && ` — ${category.obligation_kind}`}
              </p>
            </div>

            {currentPeriod && (
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-2xl">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Current Period</p>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-bold text-lg">Due {new Date(currentPeriod.due_date).toLocaleDateString()}</p>
                    <span className={`inline-block mt-1 px-2.5 py-1 rounded-lg border font-bold text-xs uppercase tracking-wider ${ITEM_STATUS_STYLES[currentPeriod.status] || ''}`}>
                      {currentPeriod.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {['UPCOMING', 'NON_COMPLIANT'].includes(currentPeriod.status) && (
                    <button
                      onClick={() => openUpload(currentPeriod)}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold"
                    >
                      <Upload className="w-4 h-4" /> Upload Evidence
                    </button>
                  )}
                  {currentPeriod.status === 'EVIDENCE_SUBMITTED' && (
                    isExecutive ? (
                      <button
                        onClick={() => openVerify(currentPeriod)}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold"
                      >
                        <ShieldCheck className="w-4 h-4" /> Verify
                      </button>
                    ) : (
                      <span className="flex items-center gap-2 text-sm text-gray-400"><Clock className="w-4 h-4" /> Awaiting verification</span>
                    )
                  )}
                  {(currentPeriod.status === 'VERIFIED' || currentPeriod.status === 'APPROVED') && currentPeriod.can_view_evidence && (
                    <button
                      onClick={() => previewEvidence(currentPeriod.item_id)}
                      disabled={previewingId === currentPeriod.item_id}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-dark-900 hover:bg-primary-600 text-white rounded-xl font-bold disabled:opacity-50"
                    >
                      <Eye className="w-4 h-4" /> {previewingId === currentPeriod.item_id ? 'Opening...' : 'View Certificate'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80">
                <h2 className="text-lg font-bold text-white">
                  {category.cadence_type === 'RECURRING' ? 'Evidence History' : 'Evidence'}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-dark-900/50 border-b border-dark-700">
                    <tr>
                      <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Due Date</th>
                      <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                      <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Acknowledged</th>
                      <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Approved By</th>
                      <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {items.length === 0 ? (
                      <tr><td colSpan={5} className="py-12 text-center text-gray-500">No items have been generated for this category yet.</td></tr>
                    ) : (
                      items.map((item) => (
                        <RowErrorBoundary
                          key={item.item_id}
                          fallback={
                            <tr>
                              <td colSpan={5} className="py-3 px-6 text-red-400 text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                This item ({item.item_id}) failed to render. Refresh, or contact support if this persists.
                              </td>
                            </tr>
                          }
                        >
                          <EvidenceHistoryRow
                            item={item}
                            previewingId={previewingId}
                            onPreview={() => previewEvidence(item.item_id)}
                          />
                        </RowErrorBoundary>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {uploadTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Upload Evidence</h2>
              <button onClick={() => setUploadTarget(null)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              {uploadError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">{uploadError}</div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">PDF file</label>
                <input
                  type="file" accept="application/pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-300"
                />
              </div>
              {category?.obligation_kind === 'RENEWAL' && (
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Certificate expiry date (required)</label>
                  <input
                    type="date"
                    value={uploadExpiry}
                    onChange={(e) => setUploadExpiry(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">This becomes the next renewal period&apos;s due date once verified.</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-dark-700 flex justify-end gap-3">
              <button onClick={() => setUploadTarget(null)} className="px-6 py-2.5 text-gray-400 hover:text-white font-medium bg-dark-900 rounded-lg">Cancel</button>
              <button
                onClick={handleUpload}
                disabled={uploadLoading}
                className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold disabled:opacity-50"
              >
                {uploadLoading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {verifyTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Verify Evidence</h2>
              <button onClick={() => setVerifyTarget(null)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-300 text-sm">Confirms the evidence on file satisfies this period. This cannot be undone.</p>
              {verifyTarget.created_by === user?.user_id && (
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Justification (required — you uploaded this evidence yourself)</label>
                  <textarea
                    value={verifyJustification}
                    onChange={(e) => setVerifyJustification(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  />
                </div>
              )}
              {verifyError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">{verifyError}</div>
              )}
            </div>
            <div className="p-6 border-t border-dark-700 flex justify-end gap-3">
              <button onClick={() => setVerifyTarget(null)} className="px-6 py-2.5 text-gray-400 hover:text-white font-medium bg-dark-900 rounded-lg">Cancel</button>
              <button
                onClick={handleVerify}
                disabled={verifyLoading}
                className="px-8 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold disabled:opacity-50"
              >
                {verifyLoading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
