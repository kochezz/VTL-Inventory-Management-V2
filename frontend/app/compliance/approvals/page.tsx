'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ListChecks, AlertCircle, CheckCircle2, XCircle, X, FileText, Eye } from 'lucide-react';

// Same standard as /pricing and /compliance/categories -- a route guard,
// not just a hidden nav link.
const CAN_VIEW_ROLES = ['admin', 'cfo', 'ceo'];

interface ComplianceItem {
  item_id: string;
  category_id: string;
  category_name: string;
  regulator: string | null;
  due_date: string;
  days_until_due: number;
  status: string;
  created_by: string;
  evidence_file_ref: string | null;
}

export default function ComplianceApprovalsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const [actionModal, setActionModal] = useState<{ item: ComplianceItem; type: 'approve' | 'reject' } | null>(null);
  const [justification, setJustification] = useState('');
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');

  // Same authenticated-blob-fetch pattern already established in
  // app/qms/documents/[id]/page.tsx -- a plain <a href> or <iframe src>
  // pointing at the API directly wouldn't carry the Bearer token, since
  // auth here is header-based, not cookie-based. Opens in a new tab so the
  // browser's native PDF viewer renders it inline (a real preview, not a
  // forced download).
  const previewEvidence = async (itemId: string) => {
    try {
      setPreviewError('');
      setPreviewingId(itemId);
      const res = await api.get(`/compliance/items/${itemId}/evidence`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Deliberately not revoking the object URL immediately -- the new tab
      // needs it to stay alive to render the PDF.
    } catch (err) {
      setPreviewError('Failed to load the evidence PDF for this item.');
      console.error(err);
    } finally {
      setPreviewingId(null);
    }
  };

  useEffect(() => {
    if (user && !CAN_VIEW_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (user && CAN_VIEW_ROLES.includes(user.role)) {
      fetchQueue();
    }
  }, [user]);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await api.get('/compliance/items?status=PENDING_APPROVAL');
      setItems(res.data);
    } catch (err) {
      setError('Failed to load the approval queue.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isSelfApproval = (item: ComplianceItem) => item.created_by === user?.user_id;

  const openApprove = (item: ComplianceItem) => {
    setActionError('');
    setJustification('');
    setActionModal({ item, type: 'approve' });
  };
  const openReject = (item: ComplianceItem) => {
    setActionError('');
    setReason('');
    setActionModal({ item, type: 'reject' });
  };

  const confirmAction = async () => {
    if (!actionModal) return;
    const { item, type } = actionModal;

    if (type === 'approve' && isSelfApproval(item) && !justification.trim()) {
      setActionError('Justification is required when approving your own submission.');
      return;
    }
    if (type === 'reject' && !reason.trim()) {
      setActionError('A rejection reason is required.');
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');
      if (type === 'approve') {
        await api.post(`/compliance/items/${item.item_id}/approve`, isSelfApproval(item) ? { justification } : {});
      } else {
        await api.post(`/compliance/items/${item.item_id}/reject`, { reason });
      }
      setActionModal(null);
      fetchQueue();
    } catch (err: any) {
      setActionError(err.response?.data?.message || `Failed to ${type} this item.`);
    } finally {
      setActionLoading(false);
    }
  };

  if (user && !CAN_VIEW_ROLES.includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6 pb-12">

        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ListChecks className="w-8 h-8 text-primary-500" />
            Compliance Approval Queue
          </h1>
          <p className="text-gray-400 mt-1">Items awaiting approval. Self-approving your own submission requires a justification.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {previewError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{previewError}</p>
          </div>
        )}

        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-dark-900/80 border-b border-dark-700">
                <tr>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Due Date</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Evidence</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr><td colSpan={4} className="py-16 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500 mb-4"></div>
                    <p className="text-gray-400">Loading queue...</p>
                  </td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={4} className="py-16 text-center">
                    <CheckCircle2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-lg font-medium text-white mb-1">Nothing pending approval</p>
                    <p className="text-gray-500 text-sm">The queue is clear.</p>
                  </td></tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.item_id} className="hover:bg-dark-700/50 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-white">{item.category_name}</p>
                        {item.regulator && <p className="text-xs text-gray-500">{item.regulator}</p>}
                        {isSelfApproval(item) && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs font-bold">Your own submission</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-gray-300">
                        {new Date(item.due_date).toLocaleDateString()}
                        <span className={`block text-xs mt-0.5 ${item.days_until_due < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {item.days_until_due < 0 ? `${Math.abs(item.days_until_due)} days overdue` : `${item.days_until_due} days remaining`}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => previewEvidence(item.item_id)}
                          disabled={previewingId === item.item_id}
                          className="flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm font-medium disabled:opacity-50"
                          title="Open the evidence PDF in a new tab"
                        >
                          {previewingId === item.item_id ? (
                            <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-primary-400"></span>
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                          <span className="truncate max-w-[160px]">{item.evidence_file_ref || 'View evidence'}</span>
                        </button>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openApprove(item)}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve
                          </button>
                          <button
                            onClick={() => openReject(item)}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {actionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">
                {actionModal.type === 'approve' ? 'Approve Item' : 'Reject Item'}
              </h2>
              <button onClick={() => setActionModal(null)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              {actionError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{actionError}</p>
                </div>
              )}
              <p className="text-gray-300">
                <span className="font-bold text-white">{actionModal.item.category_name}</span>
                {' '}— due {new Date(actionModal.item.due_date).toLocaleDateString()}
              </p>
              <button
                type="button"
                onClick={() => previewEvidence(actionModal.item.item_id)}
                disabled={previewingId === actionModal.item.item_id}
                className="flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm font-medium disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                {previewingId === actionModal.item.item_id ? 'Opening...' : 'Review the evidence PDF before deciding'}
              </button>

              {actionModal.type === 'approve' && isSelfApproval(actionModal.item) && (
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Justification (required for self-approval)</label>
                  <textarea
                    required rows={3}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Why is it appropriate for you to approve your own submission?"
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  />
                </div>
              )}

              {actionModal.type === 'reject' && (
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Rejection Reason</label>
                  <textarea
                    required rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this being rejected?"
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button onClick={() => setActionModal(null)} className="px-6 py-2.5 text-gray-400 hover:text-white font-medium bg-dark-900 rounded-lg">Cancel</button>
                <button
                  onClick={confirmAction}
                  disabled={actionLoading}
                  className={`px-6 py-2.5 text-white rounded-lg font-bold disabled:opacity-50 ${actionModal.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {actionLoading ? 'Working...' : actionModal.type === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
