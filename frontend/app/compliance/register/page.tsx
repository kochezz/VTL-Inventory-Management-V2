'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClipboardList, AlertCircle, CheckCircle2, Send, FileText, Upload } from 'lucide-react';

// Matches the sidebar's roles for this page.
const CAN_VIEW_ROLES = ['junior_accountant', 'manager', 'admin', 'cfo', 'ceo'];

interface ComplianceCategory {
  category_id: string;
  name: string;
  regulator: string | null;
  cadence_type: 'ONE_OFF' | 'RECURRING' | null;
  interval_months: number | null;
  due_day_of_month: number | null;
  anchor_date: string | null;
}

export default function ComplianceRegisterPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [categories, setCategories] = useState<ComplianceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    category_id: '',
    issued_date: '',
    due_date: '',
  });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    if (user && !CAN_VIEW_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (user && CAN_VIEW_ROLES.includes(user.role)) {
      fetchCategories();
    }
  }, [user]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      // status=ACTIVE (combined with the default active_only=true) is the
      // real enforcement mechanism: a category a junior just proposed sits
      // PENDING_APPROVAL and simply cannot appear here until an executive
      // approves it -- not just hidden by convention.
      const res = await api.get('/compliance/categories?status=ACTIVE');
      setCategories(res.data);
      if (res.data.length > 0) {
        setForm((prev) => ({ ...prev, category_id: prev.category_id || res.data[0].category_id }));
      }
    } catch (err) {
      setError('Failed to load compliance categories.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories.find((c) => c.category_id === form.category_id);
  const isRecurring = selectedCategory?.cadence_type === 'RECURRING';
  // due_date now lives on the category for a RECURRING one -- the backend
  // computes it server-side (nextDueDateForCategory in
  // compliance-service.js) and ignores whatever this form would have sent,
  // so the field is simply not shown for that case. A RECURRING category
  // with no anchor_date yet (the flexible-cadence migration left 7 of them
  // that way, to be filled in via the Categories page) can't accept items
  // until an executive sets one -- blocked here with the same message the
  // backend itself would 400 with, rather than letting the request round-
  // trip just to fail.
  const cadenceNotConfigured = isRecurring && !selectedCategory?.anchor_date;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0] || null;
    if (!file) { setEvidenceFile(null); return; }
    if (file.type !== 'application/pdf') {
      setFileError('Only PDF files are accepted.');
      setEvidenceFile(null);
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File exceeds the 10MB limit.');
      setEvidenceFile(null);
      e.target.value = '';
      return;
    }
    setEvidenceFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (cadenceNotConfigured) {
      setError("This category's cadence isn't fully configured yet (missing first due date). An executive needs to set this on the Categories page before items can be registered against it.");
      return;
    }
    if (!isRecurring && !form.due_date) {
      setError('Due date is required for a one-off category.');
      return;
    }
    if (!evidenceFile) {
      setError('A PDF evidence file is required.');
      return;
    }

    try {
      setSubmitting(true);

      const createRes = await api.post('/compliance/items', {
        category_id: form.category_id,
        issued_date: form.issued_date || undefined,
        due_date: isRecurring ? undefined : form.due_date,
        evidence_file_ref: evidenceFile.name,
      });

      const itemId = createRes.data.item_id;

      const fd = new FormData();
      fd.append('evidence', evidenceFile);
      await api.post(`/compliance/items/${itemId}/evidence`, fd);

      await api.post(`/compliance/items/${itemId}/submit`);

      setSuccess('Item registered, evidence attached, and submitted for approval.');
      setForm({ category_id: form.category_id, issued_date: '', due_date: '' });
      setEvidenceFile(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to register this item.');
    } finally {
      setSubmitting(false);
    }
  };

  if (user && !CAN_VIEW_ROLES.includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6 pb-12">

        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-primary-500" />
            Register Compliance Item
          </h1>
          <p className="text-gray-400 mt-1">Register a new item against an existing compliance category and submit it for approval.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p>{success}</p>
          </div>
        )}

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-2xl">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500 mb-4"></div>
              <p className="text-gray-400">Loading categories...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-white mb-1">No compliance categories available</p>
              <p className="text-gray-500 text-sm">Ask an admin, cfo, or ceo to set one up under Compliance &rarr; Categories first.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Category</label>
                <select
                  required
                  name="category_id"
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value, due_date: '' })}
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                >
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.name}{c.regulator ? ` (${c.regulator})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {cadenceNotConfigured && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>This category's first due date hasn't been set yet. Ask an admin, cfo, or ceo to configure it under Compliance &rarr; Categories before registering an item here.</p>
                </div>
              )}

              {isRecurring ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Issued Date (optional)</label>
                    <input
                      type="date"
                      name="issued_date"
                      value={form.issued_date}
                      onChange={(e) => setForm({ ...form, issued_date: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Due Date</label>
                    <div className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-gray-400 text-sm">
                      Computed automatically{selectedCategory?.due_day_of_month ? ` (day ${selectedCategory.due_day_of_month} of the cadence's next occurrence)` : ''}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Issued Date (optional)</label>
                    <input
                      type="date"
                      name="issued_date"
                      value={form.issued_date}
                      onChange={(e) => setForm({ ...form, issued_date: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Due Date</label>
                    <input
                      type="date" required
                      name="due_date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Evidence (PDF)</label>
                <label
                  htmlFor="evidence-file-input"
                  className="flex items-center gap-3 w-full px-4 py-3 bg-dark-950 border border-dashed border-dark-600 rounded-lg text-gray-400 hover:border-primary-500 hover:text-white cursor-pointer transition-colors"
                >
                  {evidenceFile ? <FileText className="w-5 h-5 text-primary-400 flex-shrink-0" /> : <Upload className="w-5 h-5 flex-shrink-0" />}
                  <span className="truncate">{evidenceFile ? evidenceFile.name : 'Click to choose a PDF file...'}</span>
                </label>
                <input
                  id="evidence-file-input"
                  type="file"
                  required
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {fileError && <p className="text-xs text-red-400 mt-1.5">{fileError}</p>}
                {evidenceFile && (
                  <p className="text-xs text-gray-500 mt-1.5">{(evidenceFile.size / 1024).toFixed(0)} KB</p>
                )}
              </div>

              <div className="pt-4 border-t border-dark-700 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || cadenceNotConfigured}
                  className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : <><Send className="w-5 h-5" /> Register &amp; Submit for Approval</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
