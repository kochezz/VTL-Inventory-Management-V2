'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ArrowLeft, Gavel, AlertCircle, Eye, CheckCircle2 } from 'lucide-react';
import { formatCadence } from '@/utils/complianceUtils';
import { RowErrorBoundary } from '@/components/compliance/RowErrorBoundary';

// Same role set the Categories list page itself uses -- viewing a single
// category's history is not more sensitive than seeing it in the list.
const CAN_VIEW_ROLES = ['junior_accountant', 'manager', 'admin', 'cfo', 'ceo'];

interface ComplianceCategory {
  category_id: string;
  name: string;
  regulator: string | null;
  cadence_type: 'ONE_OFF' | 'RECURRING' | null;
  interval_months: number | null;
  due_day_of_month: number | null;
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
}

const ITEM_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  PENDING_APPROVAL: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  APPROVED: 'bg-green-500/10 text-green-400 border-green-500/20',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
  NON_COMPLIANT: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  RETURNED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ARCHIVED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
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

  if (user && !CAN_VIEW_ROLES.includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1200px] mx-auto space-y-6 pb-12">
        <button
          onClick={() => router.push('/compliance/categories')}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Categories
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
              </p>
            </div>

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
    </DashboardLayout>
  );
}
