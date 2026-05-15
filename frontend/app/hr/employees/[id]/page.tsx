'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import HRLayout from '@/components/hr/HRLayout';
import {
  Loader2, AlertTriangle, ChevronLeft, Lock,
  CheckCircle2, XCircle, Clock, AlertOctagon, Save, Plus, X,
  Download, Upload,
} from 'lucide-react';
import axios from 'axios';

const HR_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
  .replace(/\/api\/?$/, '').replace(/\/$/, '');

type Tab = 'overview' | 'onboarding' | 'reviews' | 'leave' | 'documents';

function fmt(val: string | null | undefined) {
  return val ?? '—';
}

function fmtDate(val: string | null | undefined) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const MODULE_NAMES: Record<string, string> = {
  phase_1_induction:     'Phase 1: Induction',
  phase_2_gmp_safety:    'Phase 2: GMP & Safety',
  module_a_finance:      'Module A: Finance',
  module_b_operations:   'Module B: Operations',
  module_c_engineering:  'Module C: Engineering',
  module_d_qa_qc:        'Module D: QA / QC',
  module_e_sales_admin:  'Module E: Sales & Admin',
  module_f_mgmt_systems: 'Module F: Management Systems',
};

function fmtModule(m: string | null | undefined) {
  if (!m) return '—';
  return MODULE_NAMES[m] || m.replace(/_/g, ' ');
}

function toDateInput(val: string | null | undefined) {
  if (!val) return '';
  try { return new Date(val).toISOString().split('T')[0]; } catch { return ''; }
}

function matchDepartmentId(userDepartment: string | null | undefined, departments: any[]) {
  if (!userDepartment) return '';
  const normalized = userDepartment.trim().toLowerCase();
  const aliases: Record<string, string> = {
    'quality assurance': 'Quality Assurance',
    qa: 'Quality Assurance',
    production: 'Production',
    operations: 'Production',
    engineering: 'Engineering',
    inventory: 'Inventory',
    warehouse: 'Inventory',
    'human resources': 'Human Resources',
    hr: 'Human Resources',
    finance: 'Finance',
    sales: 'Sales',
    management: 'Management',
    it: 'IT',
    'information technology': 'IT',
  };
  const target = aliases[normalized] ?? userDepartment;
  return departments.find(d => d.name?.toLowerCase() === target.toLowerCase())?.id ?? '';
}

function matchReportsToUserId(reportsTo: string | null | undefined, users: any[], currentUserId: string) {
  if (!reportsTo) return '';
  const normalized = reportsTo.trim().toLowerCase();
  return users.find(u =>
    u.user_id !== currentUserId && u.full_name?.trim().toLowerCase() === normalized
  )?.user_id ?? '';
}

const ONBOARDING_BADGE: Record<string, string> = {
  completed:      'bg-green-500/10 text-green-400 border-green-500/20',
  in_progress:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  not_started:    'bg-gray-500/10 text-gray-400 border-gray-500/20',
  not_applicable: 'bg-dark-700 text-gray-600 border-dark-600',
};

const OUTCOME_BADGE: Record<string, string> = {
  confirmed:        'bg-green-500/10 text-green-400 border-green-500/20',
  pip_passed:       'bg-green-500/10 text-green-400 border-green-500/20',
  on_track:         'bg-green-500/10 text-green-400 border-green-500/20',
  extended:         'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  action_required:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  probation_failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  pip_failed:       'bg-red-500/10 text-red-400 border-red-500/20',
  serious_concern:  'bg-red-500/10 text-red-400 border-red-500/20',
  pending:          'bg-gray-500/10 text-gray-400 border-dark-600',
};

const DOC_TYPE_LABEL: Record<string, string> = {
  employment_contract:  'Employment Contract',
  schedule_3_receipt:   'Document Receipt (Schedule 3)',
  nrc_passport_copy:    'NRC / Passport Copy',
  phase_1_signoff:      'Phase 1 Sign-Off',
  phase_2_signoff:      'Phase 2 Sign-Off',
  module_signoff:       'Module Sign-Off',
  day_30_review_form:   'Day 30 Review Form',
  day_90_review_form:   'Day 90 Review Form',
  confirmation_letter:  'Confirmation Letter',
  pip_document:         'PIP Document',
  written_warning:      'Written Warning',
  sop_training_record:  'SOP Training Record',
  training_certificate: 'Training Certificate',
  exit_documentation:   'Exit Documentation',
  other:                'Other',
};

// ── Field row helper ──────────────────────────────────────────────────────────
function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm text-white ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

// ── HR Record create/edit form ────────────────────────────────────────────────
function HRRecordForm({
  userId,
  profile,
  departments,
  users,
  token,
  onSaved,
  existingRecord,
}: {
  userId: string;
  profile: any;
  departments: any[];
  users: any[];
  token: string;
  onSaved: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingRecord?: any;
}) {
  const isEdit = !!existingRecord;

  const [form, setForm] = useState({
    department_id:         existingRecord?.department_id         || '',
    reports_to_user_id:    existingRecord?.reports_to_user_id    || '',
    hr_status:             existingRecord?.hr_status             || 'onboarding',
    contract_type:         existingRecord?.contract_type         || 'probationary',
    offer_accepted_date:   toDateInput(existingRecord?.offer_accepted_date)   || '',
    basic_salary_zmw:      existingRecord?.basic_salary_zmw      ? String(existingRecord.basic_salary_zmw) : '',
    salary_effective_date: toDateInput(existingRecord?.salary_effective_date) || toDateInput(profile?.employment_date),
    napsa_member_number:   existingRecord?.napsa_member_number   || '',
    confirmation_date:     toDateInput(existingRecord?.confirmation_date)     || '',
  });
  const [saving, setSaving]   = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (isEdit) return;
    setForm(prev => ({
      ...prev,
      department_id:      prev.department_id      || String(matchDepartmentId(profile?.department, departments)),
      reports_to_user_id: prev.reports_to_user_id || matchReportsToUserId(profile?.reports_to, users, userId),
      salary_effective_date: prev.salary_effective_date || toDateInput(profile?.employment_date),
    }));
  }, [profile, departments, users, userId, isEdit]);

  const update = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        department_id:         form.department_id        || null,
        reports_to_user_id:    form.reports_to_user_id   || null,
        hr_status:             form.hr_status            || 'onboarding',
        contract_type:         form.contract_type        || 'probationary',
        offer_accepted_date:   form.offer_accepted_date  || null,
        basic_salary_zmw:      form.basic_salary_zmw === '' ? null : Number(form.basic_salary_zmw),
        salary_effective_date: form.salary_effective_date || null,
        napsa_member_number:   form.napsa_member_number  || null,
        confirmation_date:     form.confirmation_date    || null,
      };

      const method = isEdit ? 'put' : 'post';
      await axios[method](`${HR_BASE}/hr/employees/${userId}/record`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(isEdit ? 'HR record updated successfully.' : 'HR record created successfully.');
      await onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save HR record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-dark-800 border border-primary-500/30 rounded-xl p-6 space-y-5">
      <div>
        <h3 className="text-xs font-bold text-primary-400 uppercase tracking-widest">
          {isEdit ? 'Edit HR Record' : 'Create HR Record'}
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Complete the HR extension fields. Base user details are synced from System User Management.
        </p>
      </div>

      {message && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-4 py-3 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Department</label>
          <select value={form.department_id} onChange={e => update('department_id', e.target.value)}
            className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm">
            <option value="">Unassigned</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Reports To</label>
          <select value={form.reports_to_user_id} onChange={e => update('reports_to_user_id', e.target.value)}
            className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm">
            <option value="">Unassigned</option>
            {users.filter(u => u.user_id !== userId).map(u => (
              <option key={u.user_id} value={u.user_id}>
                {u.full_name} {u.job_title ? `- ${u.job_title}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">HR Status</label>
          <select value={form.hr_status} onChange={e => update('hr_status', e.target.value)}
            className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm">
            <option value="pre_start">Pre-Start</option>
            <option value="onboarding">Onboarding</option>
            <option value="probation">Probation</option>
            <option value="confirmed">Confirmed</option>
            <option value="pip_active">PIP Active</option>
            <option value="notice_period">Notice Period</option>
            <option value="exited">Exited</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Contract Type</label>
          <select value={form.contract_type} onChange={e => update('contract_type', e.target.value)}
            className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm">
            <option value="probationary">Probationary</option>
            <option value="permanent">Permanent</option>
            <option value="long_term">Long Term</option>
            <option value="short_term">Short Term</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Offer Accepted Date</label>
          <input type="date" value={form.offer_accepted_date}
            onChange={e => update('offer_accepted_date', e.target.value)}
            className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Salary Effective Date</label>
          <input type="date" value={form.salary_effective_date}
            onChange={e => update('salary_effective_date', e.target.value)}
            className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Basic Salary ZMW</label>
          <input type="number" min="0" step="0.01" value={form.basic_salary_zmw}
            onChange={e => update('basic_salary_zmw', e.target.value)}
            className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">NAPSA Member Number</label>
          <input type="text" value={form.napsa_member_number}
            onChange={e => update('napsa_member_number', e.target.value)}
            className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
        </div>

        {form.hr_status === 'confirmed' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Confirmation Date</label>
            <input type="date" value={form.confirmation_date}
              onChange={e => update('confirmation_date', e.target.value)}
              className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save HR Record'}
        </button>
      </div>
    </form>
  );
}

// ── OnboardingUpdateModal ─────────────────────────────────────────────────────
function OnboardingUpdateModal({ userId, token, modalData, onboardingGate, onClose, onSaved }: {
  userId: string;
  token: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modalData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onboardingGate: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    status:              modalData?.status || 'not_started',
    scheduled_date:      toDateInput(modalData?.scheduled_date),
    started_date:        toDateInput(modalData?.started_date),
    completed_date:      toDateInput(modalData?.completed_date),
    trainer_signed_date: toDateInput(modalData?.trainer_signed_date),
    trainee_signed_date: toDateInput(modalData?.trainee_signed_date),
    assessment_score:    modalData?.assessment_score != null ? String(modalData.assessment_score) : '',
    notes:               modalData?.notes || '',
  });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const showGateWarning =
    form.status === 'completed' &&
    onboardingGate &&
    !onboardingGate.gateOpen &&
    modalData.module !== 'phase_2_gmp_safety';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setGateError(null);

    if (modalData.module === 'phase_2_gmp_safety' && form.status === 'completed') {
      try {
        const gateRes = await axios.get(
          `${HR_BASE}/hr/employees/${userId}/gate-status/onboarding`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!gateRes.data.gateOpen) {
          const missing = (gateRes.data.missing as string[])
            .map(m => m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
            .join(', ');
          setGateError(
            `Cannot complete Phase 2 until all required onboarding documents are uploaded and signed off by a line manager. Missing: ${missing}`
          );
          setSaving(false);
          return;
        }
      } catch {
        // gate check failed — allow save to proceed
      }
    }

    try {
      await axios.put(
        `${HR_BASE}/hr/employees/${userId}/onboarding/${modalData.module}`,
        {
          status:              form.status,
          scheduled_date:      form.scheduled_date      || null,
          started_date:        form.started_date        || null,
          completed_date:      form.completed_date      || null,
          trainer_signed_date: form.trainer_signed_date || null,
          trainee_signed_date: form.trainee_signed_date || null,
          assessment_score:    form.assessment_score !== '' ? Number(form.assessment_score) : null,
          notes:               form.notes               || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update onboarding module');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">{fmtModule(modalData.module)}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}
        {gateError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">{gateError}</div>
        )}
        {showGateWarning && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg px-4 py-3 text-sm">
            ⚠ Onboarding documentation incomplete — ensure all gate documents are uploaded and signed off before marking onboarding as complete.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select value={form.status} onChange={e => update('status', e.target.value)}
              className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm">
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="not_applicable">Not Applicable</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Scheduled Date</label>
              <input type="date" value={form.scheduled_date} onChange={e => update('scheduled_date', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Started Date</label>
              <input type="date" value={form.started_date} onChange={e => update('started_date', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Completed Date</label>
              <input type="date" value={form.completed_date} onChange={e => update('completed_date', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Trainer Signed Date</label>
              <input type="date" value={form.trainer_signed_date} onChange={e => update('trainer_signed_date', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Trainee Signed Date</label>
              <input type="date" value={form.trainee_signed_date} onChange={e => update('trainee_signed_date', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
            </div>
            {modalData.module === 'phase_2_gmp_safety' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Assessment Score (0–100)</label>
                <input type="number" min="0" max="100" value={form.assessment_score}
                  onChange={e => update('assessment_score', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3}
              className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-dark-600 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ReviewModal ───────────────────────────────────────────────────────────────
function ReviewModal({ userId, token, onClose, onSaved }: {
  userId: string;
  token: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    review_type:            'day_30',
    review_date:            new Date().toISOString().split('T')[0],
    scheduled_date:         '',
    outcome:                'pending',
    outcome_justification:  '',
    weighted_overall_score: '',
    confirmed_in_post:      false,
  });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  const update = (key: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setGateError(null);

    if (form.review_type === 'day_90' && form.outcome === 'confirmed') {
      try {
        const gateRes = await axios.get(
          `${HR_BASE}/hr/employees/${userId}/gate-status/probation`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!gateRes.data.gateOpen) {
          const missing = (gateRes.data.missing as string[])
            .map(m => m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
            .join(', ');
          setGateError(
            `Cannot confirm employment: required probation documents are missing or not signed off. Go to the Documents tab to resolve. Missing: ${missing}`
          );
          setSaving(false);
          return;
        }
      } catch {
        // gate check failed — allow save to proceed
      }
    }

    try {
      await axios.post(
        `${HR_BASE}/hr/employees/${userId}/reviews`,
        {
          review_type:            form.review_type,
          review_date:            form.review_date            || null,
          scheduled_date:         form.scheduled_date         || null,
          outcome:                form.outcome,
          outcome_justification:  form.outcome_justification  || null,
          weighted_overall_score: form.weighted_overall_score !== '' ? Number(form.weighted_overall_score) : null,
          confirmed_in_post:      form.confirmed_in_post,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">New Review</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}
        {gateError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">{gateError}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Review Type</label>
              <select value={form.review_type} onChange={e => update('review_type', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm">
                <option value="day_30">Day 30</option>
                <option value="day_90">Day 90</option>
                <option value="pip_30_day">PIP 30 Day</option>
                <option value="pip_final">PIP Final</option>
                <option value="annual_h1">Annual H1</option>
                <option value="annual_h2">Annual H2</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Review Date *</label>
              <input type="date" value={form.review_date} required
                onChange={e => update('review_date', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Scheduled Date</label>
              <input type="date" value={form.scheduled_date}
                onChange={e => update('scheduled_date', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Outcome</label>
              <select value={form.outcome} onChange={e => update('outcome', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm">
                <option value="pending">Pending</option>
                <option value="on_track">On Track</option>
                <option value="action_required">Action Required</option>
                <option value="serious_concern">Serious Concern</option>
                <option value="confirmed">Confirmed</option>
                <option value="extended">Extended</option>
                <option value="probation_failed">Probation Failed</option>
                <option value="pip_passed">PIP Passed</option>
                <option value="pip_failed">PIP Failed</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Weighted Overall Score (1–5)</label>
              <input type="number" min="1" max="5" step="0.1" value={form.weighted_overall_score}
                onChange={e => update('weighted_overall_score', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Outcome Justification</label>
            <textarea value={form.outcome_justification}
              onChange={e => update('outcome_justification', e.target.value)} rows={3}
              className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm resize-none" />
          </div>

          {form.outcome === 'confirmed' && (
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.confirmed_in_post}
                onChange={e => update('confirmed_in_post', e.target.checked)}
                className="accent-primary-500" />
              Confirmed in Post
            </label>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-dark-600 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── DocUploadModal ────────────────────────────────────────────────────────────
function DocUploadModal({ userId, token, onClose, onSaved }: {
  userId: string;
  token: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    document_type:    '',
    document_title:   '',
    document_date:    today,
    version:          '1.0',
    notes:            '',
    is_gate_document: false,
    gate_category:    '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const update = (key: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleTypeChange = (val: string) => {
    setForm(prev => ({
      ...prev,
      document_type:  val,
      document_title: prev.document_title || (DOC_TYPE_LABEL[val] ?? ''),
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > 20 * 1024 * 1024) {
      setError('File size must be under 20 MB.');
      return;
    }
    setError(null);
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) { setError('Please select a file to upload.'); return; }
    if (!form.document_type) { setError('Document type is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('document_file',    selectedFile);
      formData.append('document_type',    form.document_type);
      formData.append('document_title',   form.document_title);
      formData.append('document_date',    form.document_date);
      formData.append('version',          form.version);
      formData.append('is_gate_document', String(form.is_gate_document));
      formData.append('gate_category',    form.gate_category);
      formData.append('notes',            form.notes);

      await axios.post(
        `${HR_BASE}/hr/employees/${userId}/documents`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to upload document');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Upload Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Document Type *</label>
              <select value={form.document_type} onChange={e => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm">
                <option value="">— Select —</option>
                {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Document Title</label>
              <input type="text" value={form.document_title}
                onChange={e => update('document_title', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Document Date</label>
              <input type="date" value={form.document_date}
                onChange={e => update('document_date', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Version</label>
              <input type="text" value={form.version}
                onChange={e => update('version', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={form.is_gate_document}
              onChange={e => update('is_gate_document', e.target.checked)}
              className="accent-primary-500" />
            Gate Document
          </label>

          {form.is_gate_document && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Gate Category</label>
              <select value={form.gate_category} onChange={e => update('gate_category', e.target.value)}
                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm">
                <option value="">— Select —</option>
                <option value="onboarding">Onboarding</option>
                <option value="probation">Probation</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm resize-none" />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">File * (PDF, JPG or PNG — max 20 MB)</label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/jpg,image/png"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-600/20 file:text-primary-400 hover:file:bg-primary-600/40 cursor-pointer"
            />
            {selectedFile && (
              <p className="text-xs text-gray-500 mt-1">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-dark-600 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {saving ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── SignOffModal ──────────────────────────────────────────────────────────────
function SignOffModal({ documentId, documentTitle, token, onClose, onSaved }: {
  documentId: string;
  documentTitle: string;
  token: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [signNote, setSignNote]   = useState('');
  const [password, setPassword]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await axios.post(
        `${HR_BASE}/hr/documents/${documentId}/sign-off`,
        { signature_password: password, sign_note: signNote || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await onSaved();
      onClose();
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('Invalid password. Please try again.');
      } else {
        setError(err?.response?.data?.message || 'Failed to sign off document');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Manager Sign-Off</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-sm text-gray-300">
          <p className="font-medium text-white mb-1">{documentTitle}</p>
          <p className="text-xs text-gray-500">
            Your digital sign-off constitutes a non-repudiation record verified by your system credentials.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="accent-primary-500 mt-0.5 flex-shrink-0" />
            I confirm I have reviewed this document and it is complete and correct.
          </label>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Sign-Off Note (optional)</label>
            <textarea value={signNote} onChange={e => setSignNote(e.target.value)} rows={2}
              placeholder="e.g. Original sighted in person"
              className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm resize-none" />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Digital Signature — Your Password *</label>
            <input type="password" value={password} required
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your system password"
              className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white text-sm" />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-dark-600 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !confirmed}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Signing...' : 'Sign Off Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const userId = resolvedParams.id;

  const router = useRouter();
  const { token, user: currentUser } = useAuth();
  const [createModeRequested, setCreateModeRequested] = useState(false);
  const [editHrMode, setEditHrMode]       = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [onboardingModal, setOnboardingModal] = useState<any>(null);
  const [reviewModal, setReviewModal]     = useState(false);
  const [uploadModal, setUploadModal]     = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [signOffModal, setSignOffModal]   = useState<any>(null);

  const [tab, setTab]                 = useState<Tab>('overview');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profileData, setProfile]     = useState<any>(null);
  const [onboarding, setOnboarding]   = useState<any[]>([]);
  const [reviews, setReviews]         = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [leave, setLeave]             = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [documents, setDocuments]     = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [onboardingGate, setOnboardingGate] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [probationGate, setProbationGate]   = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [departments, setDepartments] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activeUsers, setActiveUsers] = useState<any[]>([]);

  const canSeeSalary      = currentUser?.role === 'admin' || currentUser?.role === 'hr_admin';
  const canManageHrRecord = currentUser?.role === 'admin' || currentUser?.role === 'hr_admin';
  const canUploadDoc      = canManageHrRecord || currentUser?.role === 'hr_manager';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCreateModeRequested(new URLSearchParams(window.location.search).get('create') === 'true');
  }, []);

  useEffect(() => {
    if (!token || !userId) return;
    fetchAll();
  }, [token, userId, currentUser?.role]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [empRes, deptRes, usersRes] = await Promise.all([
        axios.get(`${HR_BASE}/hr/employees/${userId}`, { headers }),
        canManageHrRecord
          ? axios.get(`${HR_BASE}/hr/departments`, { headers })
          : Promise.resolve({ data: [] }),
        canManageHrRecord
          ? axios.get(`${HR_BASE}/hr/active-users`, { headers }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);

      const returnedProfile = empRes.data?.profile;
      setProfile(empRes.data);
      setDepartments(deptRes.data);

      const allUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
      setActiveUsers(allUsers.filter((u: any) => u.is_active !== false));

      if (returnedProfile?.hr_record_exists === false) {
        setOnboarding([]);
        setReviews([]);
        setLeave(null);
        setDocuments([]);
        setOnboardingGate(null);
        setProbationGate(null);
        setTab('overview');
        return;
      }

      const [onbRes, revRes, leaveRes, docsRes] = await Promise.all([
        axios.get(`${HR_BASE}/hr/employees/${userId}/onboarding`, { headers }),
        axios.get(`${HR_BASE}/hr/employees/${userId}/reviews`, { headers }),
        axios.get(`${HR_BASE}/hr/employees/${userId}/leave-balance`, { headers }),
        axios.get(`${HR_BASE}/hr/employees/${userId}/documents`, { headers }).catch(() => ({ data: [] })),
      ]);
      setOnboarding(onbRes.data);
      setReviews(revRes.data);
      setLeave(leaveRes.data);
      setDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);

      // Gate status fetches — fire-and-forget
      axios.get(`${HR_BASE}/hr/employees/${userId}/gate-status/onboarding`, { headers })
        .then(r => setOnboardingGate(r.data)).catch(() => {});
      axios.get(`${HR_BASE}/hr/employees/${userId}/gate-status/probation`, { headers })
        .then(r => setProbationGate(r.data)).catch(() => {});

    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('Employee not found.');
      } else if (err?.response?.status === 403) {
        setError('You do not have access to this profile.');
      } else {
        setError(err?.response?.data?.message || 'Failed to load employee profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const profile     = profileData?.profile  ?? null;
  const contract    = profileData?.contract  ?? null;
  const activePip   = profileData?.activePip ?? null;
  const name        = profile?.full_name ?? 'Employee Profile';
  const hasHrRecord = profile?.hr_record_exists !== false;
  const showCreateForm = canManageHrRecord && (!hasHrRecord || createModeRequested || editHrMode);

  const TABS: { key: Tab; label: string }[] = hasHrRecord ? [
    { key: 'overview',   label: 'Overview'   },
    { key: 'onboarding', label: 'Onboarding' },
    { key: 'reviews',    label: 'Reviews'    },
    { key: 'leave',      label: 'Leave'      },
    { key: 'documents',  label: 'Documents'  },
  ] : [
    { key: 'overview', label: 'Overview' },
  ];

  const handleRecordSaved = async () => {
    await fetchAll();
    setCreateModeRequested(false);
    setEditHrMode(false);
    router.replace(`/hr/employees/${userId}`);
  };

  if (loading) {
    return (
      <HRLayout title="Employee Profile">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
        </div>
      </HRLayout>
    );
  }

  return (
    <HRLayout title={name}>
      <div className="p-6 space-y-6 max-w-[1200px] mx-auto pb-12">

        {/* Back button */}
        <button
          onClick={() => router.push('/hr/employees')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Employees
        </button>

        {/* Page-level error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-5 py-4 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />{error}
          </div>
        )}

        {/* Active PIP banner */}
        {(activePip || profile?.has_active_pip) && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 flex items-center gap-3 text-red-400">
            <AlertOctagon className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Active Performance Improvement Plan</p>
              {activePip?.pip_end_date && (
                <p className="text-xs mt-0.5">PIP ends: {fmtDate(activePip.pip_end_date)}</p>
              )}
            </div>
          </div>
        )}

        {/* No HR record — non-admin message */}
        {profile && !hasHrRecord && !canManageHrRecord && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl px-5 py-4 text-sm">
            This employee has not yet had an HR record created. Please contact HR Admin.
          </div>
        )}

        {/* HR record creation / edit form */}
        {profile && showCreateForm && token && (
          <HRRecordForm
            userId={userId}
            profile={profile}
            departments={departments}
            users={activeUsers}
            token={token}
            onSaved={handleRecordSaved}
            existingRecord={editHrMode ? profile : undefined}
          />
        )}

        {/* Tabs + tab content */}
        {profile && (
          <>
            <div className="flex border-b border-dark-700">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.key
                      ? 'text-primary-400 border-primary-400'
                      : 'text-gray-400 hover:text-white border-transparent'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Tab: Overview ──────────────────────────────────────────────── */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left: Core profile */}
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Employment Details
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Field label="Full Name"         value={fmt(profile.full_name)} />
                    <Field label="Email"             value={fmt(profile.email)} />
                    <Field label="Employee Number"   value={fmt(profile.employee_number)} mono />
                    <Field label="Job Title"         value={fmt(profile.job_title)} />
                    <Field label="Department"        value={fmt(profile.department_structured ?? profile.department)} />
                    <Field label="Reports To"        value={fmt(profile.reports_to_name ?? profile.reports_to)} />
                    <Field label="Employment Date"   value={fmtDate(profile.employment_date)} />
                    <Field label="Employment Status" value={fmt(profile.employment_status)} />
                    <Field label="Employment Type"   value={fmt(profile.employment_type)} />
                    <Field label="System Role"       value={fmt(profile.role?.replace(/_/g, ' '))} />
                    <Field label="Contract Type"     value={fmt(contract?.contract_type ?? profile.contract_type)} />
                  </div>
                </div>

                {/* Right: HR extension */}
                <div className="space-y-4">
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        HR Status
                      </h3>
                      {canManageHrRecord && hasHrRecord && !showCreateForm && (
                        <button
                          onClick={() => setEditHrMode(true)}
                          className="text-xs text-primary-400 hover:text-primary-300 border border-primary-500/30 px-2 py-0.5 rounded transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <Field label="HR Status" value={
                        <span className="capitalize">{fmt(profile.hr_status?.replace(/_/g, ' '))}</span>
                      } />
                      <Field label="Onboarding Complete" value={
                        profile.onboarding_complete
                          ? <CheckCircle2 className="w-4 h-4 text-green-400 inline" />
                          : <XCircle className="w-4 h-4 text-gray-600 inline" />
                      } />
                      <Field label="Probation End" value={fmtDate(profile.effective_probation_end ?? profile.probation_end_date)} />

                      {['onboarding', 'probation'].includes(profile.hr_status ?? '') ? (
                        <Field label="Days to Prob. End" value={
                          profile.days_to_probation_end !== null && profile.days_to_probation_end !== undefined
                            ? <span className={
                                Number(profile.days_to_probation_end) < 0   ? 'text-red-400 font-semibold' :
                                Number(profile.days_to_probation_end) < 14  ? 'text-red-400 font-semibold' :
                                Number(profile.days_to_probation_end) < 30  ? 'text-yellow-400' : 'text-gray-300'
                              }>
                                {Number(profile.days_to_probation_end) < 0
                                  ? `${Math.abs(profile.days_to_probation_end)} days overdue`
                                  : `${profile.days_to_probation_end} days remaining`}
                              </span>
                            : '—'
                        } />
                      ) : (
                        <Field label="Probation Status" value={
                          <span className="text-green-400 font-semibold capitalize">
                            {profile.hr_status?.replace(/_/g, ' ') ?? '—'}
                          </span>
                        } />
                      )}

                      <Field label="Confirmation Date" value={fmtDate(profile.confirmation_date)} />
                      <Field label="Exit Date"         value={fmtDate(profile.exit_date)} />
                    </div>
                  </div>

                  {/* Salary (role-gated) */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                      Compensation
                    </h3>
                    {canSeeSalary ? (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <Field label="Basic Salary (ZMW)" value={
                          profile.basic_salary_zmw
                            ? Number(profile.basic_salary_zmw).toLocaleString('en-ZM', { style: 'currency', currency: 'ZMW' })
                            : '—'
                        } mono />
                        <Field label="Salary Effective" value={fmtDate(profile.salary_effective_date)} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-gray-500 text-sm">
                        <Lock className="w-4 h-4" />
                        Salary data is restricted to HR Admin and Admin roles.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Onboarding ────────────────────────────────────────────── */}
            {tab === 'onboarding' && (
              <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">

                {/* ── Computed progress summary ─────────────────────────── */}
                {onboarding.length > 0 && (() => {
                  const done = onboarding.filter(m =>
                    m.status === 'completed' || m.status === 'not_applicable'
                  ).length;
                  const total = onboarding.length;
                  const pct   = Math.round((done / total) * 100);
                  const allDone = pct === 100;
                  return (
                    <div className={`px-5 py-3 border-b border-dark-700 flex items-center justify-between
                      ${allDone ? 'bg-green-500/5' : 'bg-dark-900/60'}`}>
                      <div className="flex items-center gap-3">
                        {allDone
                          ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                          : <Clock className="w-4 h-4 text-amber-400" />
                        }
                        <span className="text-sm font-semibold text-white">
                          {allDone ? 'Onboarding Complete' : 'Onboarding In Progress'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {done} of {total} modules done
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-dark-950 rounded-full h-2 border border-dark-600">
                          <div
                            className={`h-full rounded-full transition-all ${
                              allDone ? 'bg-green-500' : pct > 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold ${
                          allDone ? 'text-green-400' : 'text-white'
                        }`}>{pct}%</span>
                      </div>
                    </div>
                  );
                })()}

                {onboarding.length === 0 ? (
                  <div className="p-10 text-center text-gray-500 text-sm">No onboarding records yet.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-dark-900 border-b border-dark-700">
                      <tr>
                        <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Module</th>
                        <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
                        <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Completed</th>
                        <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Score</th>
                        <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700">
                      {onboarding.map((m, i) => {
                        const badge = ONBOARDING_BADGE[m.status] || ONBOARDING_BADGE.not_started;
                        return (
                          <tr key={i} className="hover:bg-dark-700/40 transition-colors">
                            <td className="px-5 py-3 text-sm text-white font-medium">{fmtModule(m.module)}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badge}`}>
                                {(m.status ?? 'not_started').replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-400">{fmtDate(m.completed_date)}</td>
                            <td className="px-5 py-3 text-sm text-gray-300 font-mono">
                              {m.assessment_score !== null && m.assessment_score !== undefined
                                ? `${m.assessment_score}%`
                                : '—'}
                            </td>
                            <td className="px-5 py-3 text-right">
                              {m.module && (currentUser?.role === 'hr_admin' || currentUser?.role === 'admin' ||
                                currentUser?.role === 'hr_manager') && (
                                <button
                                  onClick={() => setOnboardingModal(m)}
                                  className="text-xs px-3 py-1.5 bg-primary-600/20 hover:bg-primary-600/40 border border-primary-500/30 text-primary-400 rounded-lg transition-colors"
                                >
                                  Update
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Tab: Reviews ───────────────────────────────────────────────── */}
            {tab === 'reviews' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  {canManageHrRecord && (
                    <button
                      onClick={() => setReviewModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" /> New Review
                    </button>
                  )}
                </div>
                <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
                  {reviews.length === 0 ? (
                    <div className="p-10 text-center text-gray-500 text-sm">No review records yet.</div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-dark-900 border-b border-dark-700">
                        <tr>
                          <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Type</th>
                          <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Review Date</th>
                          <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Outcome</th>
                          <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700">
                        {reviews.map((r, i) => {
                          const badge = OUTCOME_BADGE[r.outcome] || OUTCOME_BADGE.pending;
                          return (
                            <tr key={i} className="hover:bg-dark-700/40 transition-colors">
                              <td className="px-5 py-3 text-sm text-white font-medium capitalize">
                                {r.review_type?.replace(/_/g, ' ') ?? '—'}
                              </td>
                              <td className="px-5 py-3 text-sm text-gray-400">{fmtDate(r.review_date)}</td>
                              <td className="px-5 py-3">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badge}`}>
                                  {(r.outcome ?? 'pending').replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-sm text-gray-300 font-mono">
                                {r.weighted_overall_score !== null && r.weighted_overall_score !== undefined
                                  ? Number(r.weighted_overall_score).toFixed(1)
                                  : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── Tab: Leave ─────────────────────────────────────────────────── */}
            {tab === 'leave' && (
              <div className="space-y-4">
                {leave ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Annual Entitlement', value: leave.annual_entitlement ?? 15 },
                        { label: 'Days Taken',         value: leave.annual_taken ?? 0 },
                        { label: 'Days Pending',       value: leave.pending_days ?? 0 },
                        { label: 'Balance Remaining',  value: leave.annual_balance ?? (15 - (leave.annual_taken ?? 0)) },
                      ].map(card => (
                        <div key={card.label} className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                          <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                          <p className="text-3xl font-bold text-white">{card.value}</p>
                          <p className="text-xs text-gray-500 mt-1">days</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                      <div className="flex justify-between text-xs text-gray-400 mb-2">
                        <span>Annual leave usage</span>
                        <span>{leave.annual_taken ?? 0} / {leave.annual_entitlement ?? 15} days</span>
                      </div>
                      <div className="w-full bg-dark-950 rounded-full h-2.5 border border-dark-600">
                        <div
                          className="h-full rounded-full bg-primary-500 transition-all"
                          style={{
                            width: `${Math.min(
                              ((leave.annual_taken ?? 0) / (leave.annual_entitlement ?? 15)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Leave requests are submitted from the main dashboard.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-10 text-center text-gray-500 text-sm">
                    No leave balance record found.
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Documents ─────────────────────────────────────────────── */}
            {tab === 'documents' && (
              <div className="space-y-4">

                {/* Section A: Gate status banners (admin/hr_admin only) */}
                {canManageHrRecord && (onboardingGate || probationGate) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {onboardingGate && (
                      <div className={`rounded-lg px-4 py-3 border text-sm ${
                        onboardingGate.gateOpen
                          ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                      }`}>
                        <p className="font-semibold mb-1">Onboarding Gate</p>
                        {onboardingGate.gateOpen ? (
                          <span className="flex items-center gap-1.5 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> All documents filed &amp; signed
                          </span>
                        ) : (
                          <>
                            <p className="text-xs">{onboardingGate.missing.length} document{onboardingGate.missing.length !== 1 ? 's' : ''} missing</p>
                            <ul className="mt-1 text-xs opacity-80 list-disc list-inside space-y-0.5">
                              {(onboardingGate.missing as string[]).map(m => (
                                <li key={m}>{DOC_TYPE_LABEL[m] ?? m.replace(/_/g, ' ')}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                    {probationGate && (
                      <div className={`rounded-lg px-4 py-3 border text-sm ${
                        probationGate.gateOpen
                          ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                      }`}>
                        <p className="font-semibold mb-1">Probation Gate</p>
                        {probationGate.gateOpen ? (
                          <span className="flex items-center gap-1.5 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> All documents filed &amp; signed
                          </span>
                        ) : (
                          <>
                            <p className="text-xs">{probationGate.missing.length} document{probationGate.missing.length !== 1 ? 's' : ''} missing</p>
                            <ul className="mt-1 text-xs opacity-80 list-disc list-inside space-y-0.5">
                              {(probationGate.missing as string[]).map(m => (
                                <li key={m}>{DOC_TYPE_LABEL[m] ?? m.replace(/_/g, ' ')}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Section B+C: Document list + upload button */}
                <div className="space-y-3">
                  <div className="flex justify-end">
                    {canUploadDoc && token && (
                      <button
                        onClick={() => setUploadModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        <Upload className="w-4 h-4" /> Upload Document
                      </button>
                    )}
                  </div>

                  <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
                    {documents.length === 0 ? (
                      <div className="p-10 text-center text-gray-500 text-sm">No documents uploaded yet.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-dark-900 border-b border-dark-700">
                            <tr>
                              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Type</th>
                              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Title</th>
                              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Date</th>
                              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">File</th>
                              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Sign-Off</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-dark-700">
                            {documents.map((d, i) => (
                              <tr key={i} className="hover:bg-dark-700/40 transition-colors">
                                <td className="px-4 py-3 text-sm">
                                  <div className="space-y-1">
                                    <p className="text-white">{DOC_TYPE_LABEL[d.document_type] ?? fmt(d.document_type)}</p>
                                    {d.is_gate_document && (
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                        d.gate_category === 'probation'
                                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                      }`}>
                                        {d.gate_category === 'probation' ? 'Probation Gate' : 'Onboarding Gate'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-300 max-w-[180px] truncate">{fmt(d.document_title)}</td>
                                <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{fmtDate(d.document_date)}</td>
                                <td className="px-4 py-3 text-sm">
                                  {d.file_original_name ? (
                                    <button
                                      onClick={() => window.open(`${HR_BASE}/hr/documents/${d.id}/download`, '_blank')}
                                      className="flex items-center gap-1.5 text-primary-400 hover:text-primary-300 transition-colors"
                                    >
                                      <Download className="w-3.5 h-3.5 flex-shrink-0" />
                                      <span className="text-xs truncate max-w-[110px]">{d.file_original_name}</span>
                                    </button>
                                  ) : (
                                    <span className="text-gray-600 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {d.manager_checked ? (
                                    <div className="flex items-start gap-1.5 text-green-400">
                                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                      <div>
                                        <p className="text-xs font-semibold">Signed off</p>
                                        <p className="text-[10px] text-gray-500">{fmtDate(d.manager_signed_at)}</p>
                                      </div>
                                    </div>
                                  ) : canManageHrRecord ? (
                                    <button
                                      onClick={() => setSignOffModal(d)}
                                      className="text-xs px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg hover:bg-yellow-500/20 transition-colors whitespace-nowrap"
                                    >
                                      Sign Off
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-500">Pending sign-off</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {onboardingModal && token && (
        <OnboardingUpdateModal
          userId={userId}
          token={token}
          modalData={onboardingModal}
          onboardingGate={onboardingGate}
          onClose={() => setOnboardingModal(null)}
          onSaved={fetchAll}
        />
      )}

      {reviewModal && token && (
        <ReviewModal
          userId={userId}
          token={token}
          onClose={() => setReviewModal(false)}
          onSaved={fetchAll}
        />
      )}

      {uploadModal && token && (
        <DocUploadModal
          userId={userId}
          token={token}
          onClose={() => setUploadModal(false)}
          onSaved={fetchAll}
        />
      )}

      {signOffModal && token && (
        <SignOffModal
          documentId={signOffModal.id}
          documentTitle={signOffModal.document_title ?? 'Document'}
          token={token}
          onClose={() => setSignOffModal(null)}
          onSaved={fetchAll}
        />
      )}

    </HRLayout>
  );
}
