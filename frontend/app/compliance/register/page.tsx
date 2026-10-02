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
  obligation_kind: 'FILING' | 'RENEWAL' | null;
}

const TODAY = new Date().toISOString().slice(0, 10);

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
  // Field-level errors for the three date rules below -- shown next to the
  // field that's wrong, not folded into the generic API-error banner.
  const [issuedDateError, setIssuedDateError] = useState('');
  const [dueDateError, setDueDateError] = useState('');
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
      // FILING + RECURRING categories generate their own periods (approval
      // bootstrap, then the scheduler) -- manual registration is a hard
      // 400 on the backend for these (createComplianceItem in
      // compliance-service.js), so they're excluded here rather than shown
      // and left to fail on submit.
      const registrable = res.data.filter(
        (c: ComplianceCategory) => !(c.cadence_type === 'RECURRING' && c.obligation_kind === 'FILING')
      );
      setCategories(registrable);
      if (registrable.length > 0) {
        setForm((prev) => ({ ...prev, category_id: prev.category_id || registrable[0].category_id }));
      }
    } catch (err) {
      setError('Failed to load compliance categories.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories.find((c) => c.category_id === form.category_id);
  const isRenewal = selectedCategory?.obligation_kind === 'RENEWAL';

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

  // Mirrors validateDateOnly in compliance-service.js (format + a sane
  // calendar date) plus the two RENEWAL-specific rules the backend also
  // enforces (createComplianceItem): issued_date can't be in the future,
  // and the expiry must actually be after it. Run before every submit so
  // the error lands on the field itself, not as a round-tripped API
  // message -- the backend re-checks all of this independently; this is
  // just so the common case never needs the round trip to find out.
  const validateDates = (): boolean => {
    setIssuedDateError('');
    setDueDateError('');
    let ok = true;

    if (form.issued_date) {
      if (form.issued_date > TODAY) {
        setIssuedDateError('Issued date cannot be in the future.');
        ok = false;
      }
    }

    if (isRenewal) {
      if (!form.due_date) {
        setDueDateError("The certificate's expiry date is required.");
        ok = false;
      } else if (form.issued_date && form.due_date <= form.issued_date) {
        setDueDateError('Expiry date must be after the issued date.');
        ok = false;
      }
    } else if (!form.due_date) {
      setDueDateError('Due date is required for a one-off category.');
      ok = false;
    }

    return ok;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateDates()) return;
    if (!evidenceFile) {
      setError('A PDF evidence file is required.');
      return;
    }

    try {
      setSubmitting(true);

      const createRes = await api.post('/compliance/items', {
        category_id: form.category_id,
        issued_date: form.issued_date || undefined,
        due_date: form.due_date,
        evidence_file_ref: evidenceFile.name,
      });

      const itemId = createRes.data.item_id;

      const fd = new FormData();
      fd.append('evidence', evidenceFile);
      // RENEWAL's evidence row carries its own certificate_expiry_date
      // (uploadComplianceEvidence requires it) -- the cert being uploaded
      // here IS the one whose expiry was just entered above as due_date,
      // so the same value feeds both.
      if (isRenewal) fd.append('certificate_expiry_date', form.due_date);
      await api.post(`/compliance/items/${itemId}/evidence`, fd);

      // No separate /submit call -- uploading evidence against a new-
      // vocabulary item (UPCOMING) already moves it straight to
      // EVIDENCE_SUBMITTED (uploadComplianceEvidence), where it waits in
      // the verification queue. Calling legacy /submit here would now be
      // rejected outright (assertNotNewVocabularyItem).
      setSuccess('Evidence submitted for verification. Someone other than you will need to verify it before this period is complete.');
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
          <p className="text-gray-400 mt-1">
            Register a new item against an existing compliance category. Someone other than you will verify the
            evidence before the period counts as complete.
          </p>
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
                  onChange={(e) => {
                    setForm({ ...form, category_id: e.target.value, due_date: '' });
                    setDueDateError('');
                    setIssuedDateError('');
                  }}
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                >
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.name}{c.regulator ? ` (${c.regulator})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Issued Date (optional)</label>
                  <input
                    type="date"
                    name="issued_date"
                    max={TODAY}
                    value={form.issued_date}
                    onChange={(e) => { setForm({ ...form, issued_date: e.target.value }); setIssuedDateError(''); }}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  />
                  {issuedDateError && <p className="text-xs text-red-400 mt-1.5">{issuedDateError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    {isRenewal ? 'Certificate Expiry Date' : 'Due Date'}
                  </label>
                  <input
                    type="date" required
                    name="due_date"
                    value={form.due_date}
                    onChange={(e) => { setForm({ ...form, due_date: e.target.value }); setDueDateError(''); }}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  />
                  {isRenewal && <p className="text-xs text-gray-500 mt-1.5">As printed on the certificate.</p>}
                  {dueDateError && <p className="text-xs text-red-400 mt-1.5">{dueDateError}</p>}
                </div>
              </div>

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
                  disabled={submitting}
                  className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : <><Send className="w-5 h-5" /> Submit Evidence for Verification</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
