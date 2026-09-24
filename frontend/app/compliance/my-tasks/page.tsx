'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Inbox, AlertCircle, CheckCircle2, ShieldAlert, Eye, Undo2, X, Send, Upload, FileText } from 'lucide-react';

const CAN_VIEW_ROLES = ['junior_accountant', 'manager', 'admin', 'cfo', 'ceo'];

interface ComplianceItem {
  item_id: string;
  category_name: string;
  regulator: string | null;
  cadence_type: 'ONE_OFF' | 'RECURRING' | null;
  due_date: string;
  issued_date: string | null;
  days_until_due: number;
  status: string;
  is_acknowledged: boolean;
  reminder_tiers_fired: string[];
  evidence_file_ref: string | null;
  rejection_reason: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  PENDING_APPROVAL: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  APPROVED: 'bg-green-500/10 text-green-400 border-green-500/20',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
  NON_COMPLIANT: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  RETURNED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export default function ComplianceMyTasksPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState<Record<string, string>>({});
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<ComplianceItem | null>(null);
  const [editForm, setEditForm] = useState({ issued_date: '', due_date: '' });
  const [editEvidenceFile, setEditEvidenceFile] = useState<File | null>(null);
  const [editFileError, setEditFileError] = useState('');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Same authenticated-blob-fetch pattern as app/qms/documents/[id]/page.tsx
  // and the Approvals page -- a plain href/src can't carry the Bearer token.
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

  useEffect(() => {
    if (user && !CAN_VIEW_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (user && CAN_VIEW_ROLES.includes(user.role)) {
      fetchTasks();
    }
  }, [user]);

  // "My Tasks" combines two things worth seeing in one place: items I
  // personally created (any status, so I can track my own submissions
  // through the workflow) and any item currently open for acknowledgement
  // (NON_COMPLIANT, not yet acknowledged) -- acknowledge is open to any of
  // the 4 compliance-module roles, not scoped to the creator, so this list
  // is deliberately broader than "just what I submitted."
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const [mineRes, needsAckRes] = await Promise.all([
        api.get('/compliance/items?mine=true'),
        api.get('/compliance/items?needs_acknowledgement=true'),
      ]);
      const merged = new Map<string, ComplianceItem>();
      [...mineRes.data, ...needsAckRes.data].forEach((item: ComplianceItem) => merged.set(item.item_id, item));
      setItems(Array.from(merged.values()).sort((a, b) => a.days_until_due - b.days_until_due));
    } catch (err) {
      setError('Failed to load your compliance tasks.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (itemId: string) => {
    try {
      setAckingId(itemId);
      await api.post(`/compliance/items/${itemId}/acknowledge`, { note: ackNote[itemId] || undefined });
      fetchTasks();
    } catch (err) {
      console.error('Failed to acknowledge item', err);
    } finally {
      setAckingId(null);
    }
  };

  const openEdit = (item: ComplianceItem) => {
    setEditingItem(item);
    setEditForm({
      issued_date: item.issued_date ? item.issued_date.slice(0, 10) : '',
      due_date: item.due_date ? item.due_date.slice(0, 10) : '',
    });
    setEditEvidenceFile(null);
    setEditFileError('');
    setEditError('');
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFileError('');
    const file = e.target.files?.[0] || null;
    if (!file) { setEditEvidenceFile(null); return; }
    if (file.type !== 'application/pdf') {
      setEditFileError('Only PDF files are accepted.');
      setEditEvidenceFile(null);
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setEditFileError('File exceeds the 10MB limit.');
      setEditEvidenceFile(null);
      e.target.value = '';
      return;
    }
    setEditEvidenceFile(file);
  };

  // Fixes whatever changed (evidence, issued_date, and due_date for a
  // ONE_OFF category -- a RECURRING one still computes it server-side, same
  // rule as everywhere else in this module) and resubmits in one step,
  // matching the natural workflow: a return exists specifically because
  // something needs fixing before it goes back to PENDING_APPROVAL.
  const handleSaveAndResubmit = async () => {
    if (!editingItem) return;
    try {
      setEditLoading(true);
      setEditError('');

      if (editEvidenceFile) {
        const fd = new FormData();
        fd.append('evidence', editEvidenceFile);
        await api.post(`/compliance/items/${editingItem.item_id}/evidence`, fd);
      }

      const patchBody: Record<string, string> = {};
      if (editForm.issued_date !== (editingItem.issued_date ? editingItem.issued_date.slice(0, 10) : '')) {
        patchBody.issued_date = editForm.issued_date;
      }
      if (editingItem.cadence_type !== 'RECURRING' && editForm.due_date !== editingItem.due_date.slice(0, 10)) {
        patchBody.due_date = editForm.due_date;
      }
      if (Object.keys(patchBody).length > 0) {
        await api.patch(`/compliance/items/${editingItem.item_id}`, patchBody);
      }

      await api.post(`/compliance/items/${editingItem.item_id}/resubmit`);

      setEditingItem(null);
      fetchTasks();
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Failed to save changes and resubmit this item.');
    } finally {
      setEditLoading(false);
    }
  };

  // Split out into its own "Returned to You" section (per the session's
  // explicit decision) rather than leaving RETURNED items inline in the
  // general list below -- they need an action (Fix & Resubmit) and a
  // reason the rest of the list doesn't have, so they'd stand out
  // awkwardly if left in place instead of grouped together up top.
  const returnedItems = items.filter((i) => i.status === 'RETURNED');
  const otherItems = items.filter((i) => i.status !== 'RETURNED');

  if (user && !CAN_VIEW_ROLES.includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6 pb-12">

        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Inbox className="w-8 h-8 text-primary-500" />
            My Compliance Tasks
          </h1>
          <p className="text-gray-400 mt-1">Items you've submitted, and any item currently open for acknowledgement.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500 mb-4"></div>
            <p className="text-gray-400">Loading tasks...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-white mb-1">Nothing needs your attention</p>
            <p className="text-gray-500 text-sm">No submissions of yours, and nothing awaiting acknowledgement.</p>
          </div>
        ) : (
          <>
            {returnedItems.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
                  <Undo2 className="w-5 h-5 text-amber-400" />
                  Returned to You
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs">{returnedItems.length}</span>
                </h2>
                <div className="space-y-4 mb-6">
                  {returnedItems.map((item) => (
                    <div key={item.item_id} className="bg-dark-800 border border-amber-500/30 rounded-xl p-5 shadow-lg">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-white text-lg">{item.category_name}</p>
                            <span className={`px-2.5 py-1 rounded-lg border font-bold text-xs uppercase tracking-wider ${STATUS_STYLES[item.status] || ''}`}>
                              {item.status}
                            </span>
                          </div>
                          {item.regulator && <p className="text-xs text-gray-500 mt-0.5">{item.regulator}</p>}
                          {item.rejection_reason && (
                            <p className="text-sm text-amber-300 mt-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                              <span className="font-bold">Why it was returned:</span> {item.rejection_reason}
                            </p>
                          )}
                          <button
                            onClick={() => previewEvidence(item.item_id)}
                            disabled={previewingId === item.item_id}
                            className="flex items-center gap-1.5 text-primary-400 hover:text-primary-300 text-xs font-medium mt-2 disabled:opacity-50"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {previewingId === item.item_id ? 'Opening...' : (item.evidence_file_ref || 'View evidence')}
                          </button>
                        </div>
                        <button
                          onClick={() => openEdit(item)}
                          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 md:w-56"
                        >
                          <Undo2 className="w-4 h-4" />
                          Fix &amp; Resubmit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          <div className="space-y-4">
            {otherItems.map((item) => (
              <div key={item.item_id} className="bg-dark-800 border border-dark-700 rounded-xl p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white text-lg">{item.category_name}</p>
                      <span className={`px-2.5 py-1 rounded-lg border font-bold text-xs uppercase tracking-wider ${STATUS_STYLES[item.status] || ''}`}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {item.regulator && <p className="text-xs text-gray-500 mt-0.5">{item.regulator}</p>}
                    <p className="text-sm text-gray-400 mt-2">
                      Due {new Date(item.due_date).toLocaleDateString()} —{' '}
                      <span className={item.days_until_due < 0 ? 'text-red-400 font-bold' : 'text-gray-400'}>
                        {item.days_until_due < 0 ? `${Math.abs(item.days_until_due)} days overdue` : `${item.days_until_due} days remaining`}
                      </span>
                    </p>
                    {item.reminder_tiers_fired.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        <span className="text-xs text-gray-500 mr-1">Reminders sent:</span>
                        {item.reminder_tiers_fired.map((tier) => (
                          <span key={tier} className="px-2 py-0.5 bg-dark-900 border border-dark-600 rounded text-xs font-mono text-gray-300">
                            {tier.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => previewEvidence(item.item_id)}
                      disabled={previewingId === item.item_id}
                      className="flex items-center gap-1.5 text-primary-400 hover:text-primary-300 text-xs font-medium mt-2 disabled:opacity-50"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {previewingId === item.item_id ? 'Opening...' : (item.evidence_file_ref || 'View evidence')}
                    </button>
                  </div>

                  {item.status === 'NON_COMPLIANT' && !item.is_acknowledged && (
                    <div className="flex flex-col gap-2 md:w-80">
                      <input
                        type="text"
                        value={ackNote[item.item_id] || ''}
                        onChange={(e) => setAckNote({ ...ackNote, [item.item_id]: e.target.value })}
                        placeholder="Optional note..."
                        className="px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500"
                      />
                      <button
                        onClick={() => handleAcknowledge(item.item_id)}
                        disabled={ackingId === item.item_id}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        {ackingId === item.item_id ? 'Acknowledging...' : 'Acknowledge'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Undo2 className="w-5 h-5 text-amber-400" />
                Fix &amp; Resubmit — {editingItem.category_name}
              </h2>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-6 space-y-5">
              {editingItem.rejection_reason && (
                <p className="text-sm text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span className="font-bold">Why it was returned:</span> {editingItem.rejection_reason}
                </p>
              )}
              {editError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{editError}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Issued Date (optional)</label>
                  <input
                    type="date"
                    value={editForm.issued_date}
                    onChange={(e) => setEditForm({ ...editForm, issued_date: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Due Date</label>
                  {editingItem.cadence_type === 'RECURRING' ? (
                    <div className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-gray-400 text-sm">
                      Computed automatically
                    </div>
                  ) : (
                    <input
                      type="date" required
                      value={editForm.due_date}
                      onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Replace Evidence (PDF, optional)</label>
                <label
                  htmlFor="edit-evidence-file-input"
                  className="flex items-center gap-3 w-full px-4 py-3 bg-dark-950 border border-dashed border-dark-600 rounded-lg text-gray-400 hover:border-primary-500 hover:text-white cursor-pointer transition-colors"
                >
                  {editEvidenceFile ? <FileText className="w-5 h-5 text-primary-400 flex-shrink-0" /> : <Upload className="w-5 h-5 flex-shrink-0" />}
                  <span className="truncate">{editEvidenceFile ? editEvidenceFile.name : `Keep existing (${editingItem.evidence_file_ref || 'current file'}) or choose a new PDF...`}</span>
                </label>
                <input
                  id="edit-evidence-file-input"
                  type="file"
                  accept="application/pdf"
                  onChange={handleEditFileChange}
                  className="hidden"
                />
                {editFileError && <p className="text-xs text-red-400 mt-1.5">{editFileError}</p>}
              </div>

              <div className="pt-4 border-t border-dark-700 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingItem(null)} className="px-6 py-2.5 text-gray-400 hover:text-white font-medium bg-dark-900 rounded-lg">Cancel</button>
                <button
                  onClick={handleSaveAndResubmit}
                  disabled={editLoading}
                  className="px-8 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : <><Send className="w-5 h-5" /> Save &amp; Resubmit</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
