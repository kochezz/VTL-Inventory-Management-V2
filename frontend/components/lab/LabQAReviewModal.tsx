'use client';

// ============================================================================
// LAB QA REVIEW MODAL — frontend/components/lab/LabQAReviewModal.tsx
// ============================================================================
// WORKFLOW:
//   Stage 1 — Analyst records + submits (digital sig) → status: submitted
//   Stage 2 — QA reviews + signs off                 → status: pass / conditional_pass / rejected
//
// QA is the single release authority. No supervisor/manager split.
// CoA PDF download available once status = pass or conditional_pass.
// ============================================================================

import { useState, useEffect } from 'react';
import {
  X, CheckCircle2, XCircle, AlertCircle, Key, FileCheck,
  Shield, User, Calendar, FlaskConical, ChevronDown, ChevronUp,
  Download
} from 'lucide-react';
import { api, useAuth } from '@/hooks/useAuth';
import axios from 'axios';

interface LabQAReviewModalProps {
  testId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface LabTest {
  test_id: string;
  test_number: string;
  test_date: string;
  shift: string;
  overall_status: string;
  certificate_number: string | null;
  ro_system_reference: string;
  equipment_calibration_ref: string;
  notes: string;
  analyst_name: string;
  analyst_employee_id: string;
  qa_reviewer_name: string | null;
  batch_number: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  parameters: Array<{
    parameter_code: string;
    parameter_name: string;
    reading_value: number | null;
    reading_text: string | null;
    unit: string;
    spec_min: number | null;
    spec_max: number | null;
    status: string;
    notes: string | null;
  }>;
  approvals: Array<{
    stage: number;
    action: string;
    actioned_by_name: string;
    actioned_by_employee_id: string;
    comments: string | null;
    deviation_note: string | null;
    actioned_at: string;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:            { label: 'Draft',            cls: 'text-gray-400 bg-gray-400/10 border-gray-400/30' },
  submitted:        { label: 'Awaiting QA',      cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  pass:             { label: 'QA Approved',      cls: 'text-green-400 bg-green-400/10 border-green-400/30' },
  conditional_pass: { label: 'Conditional Pass', cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  fail:             { label: 'Failed',           cls: 'text-red-400 bg-red-400/10 border-red-400/30' },
  rejected:         { label: 'Rejected',         cls: 'text-red-400 bg-red-400/10 border-red-400/30' },
};

function StatusPill({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? { label: status, cls: 'text-gray-400 bg-gray-400/10 border-gray-400/30' };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.cls}`}>{c.label}</span>;
}

function ParamRow({ param }: { param: LabTest['parameters'][0] }) {
  const displayVal = param.reading_value !== null
    ? `${parseFloat(String(param.reading_value)).toFixed(3).replace(/\.?0+$/, '')} ${param.unit}`
    : param.reading_text === '0' ? 'Absent'
    : `Present (${param.reading_text} CFU/mL)`;

  const specText = param.spec_min !== null || param.spec_max !== null
    ? [
        param.spec_min !== null ? `≥${param.spec_min}` : '',
        param.spec_max !== null ? `≤${param.spec_max}` : '',
      ].filter(Boolean).join(' – ') + ` ${param.unit}`
    : '0 CFU/mL (Absent)';

  const icon =
    param.status === 'pass'    ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
    param.status === 'fail'    ? <XCircle className="w-4 h-4 text-red-400" /> :
    param.status === 'warning' ? <AlertCircle className="w-4 h-4 text-yellow-400" /> :
    <div className="w-4 h-4 rounded-full border-2 border-dark-500" />;

  return (
    <tr className={`border-b border-dark-700 ${param.status === 'fail' ? 'bg-red-500/5' : param.status === 'warning' ? 'bg-yellow-500/5' : ''}`}>
      <td className="px-4 py-2.5 text-sm text-white">{param.parameter_name}</td>
      <td className="px-4 py-2.5 text-sm font-mono text-gray-300 text-right">{displayVal}</td>
      <td className="px-4 py-2.5 text-xs text-gray-500 text-center">{specText}</td>
      <td className="px-4 py-2.5 text-center">{icon}</td>
      <td className="px-4 py-2.5 text-xs text-gray-400">{param.notes ?? '—'}</td>
    </tr>
  );
}

export default function LabQAReviewModal({ testId, isOpen, onClose, onSuccess }: LabQAReviewModalProps) {
  const { token, user } = useAuth();
  const [test, setTest]           = useState<LabTest | null>(null);
  const [loading, setLoading]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError]         = useState('');
  const [action, setAction]       = useState<'approve' | 'reject' | 'conditional' | null>(null);
  const [comments, setComments]   = useState('');
  const [deviationNote, setDeviationNote] = useState('');
  const [signature, setSignature] = useState('');
  const [showParams, setShowParams] = useState(true);

  useEffect(() => {
    if (!isOpen || !testId) return;
    setError(''); setAction(null); setComments('');
    setDeviationNote(''); setSignature('');
    setLoading(true);

    api.get(`/lab/tests/${testId}`)
      .then(res => setTest(res.data.test))
      .catch(() => setError('Failed to load test details'))
      .finally(() => setLoading(false));
  }, [isOpen, testId]);

  const verifySignature = async () => {
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/signature/verify`,
        { password: signature },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid digital signature.');
      return false;
    }
  };

  // QA can act if test is 'submitted' and user has QA/admin/manager role
  const canAct = test?.overall_status === 'submitted' &&
    ['admin', 'manager', 'qa'].includes(user?.role || '');

  const isCertified = ['pass', 'conditional_pass'].includes(test?.overall_status || '');

  const handleQAAction = async () => {
    if (!action || !signature.trim()) {
      setError('Please select an action and enter your digital signature.');
      return;
    }
    if (action === 'conditional' && !deviationNote.trim()) {
      setError('A deviation note is mandatory for a conditional approval.');
      return;
    }
    if (action === 'reject' && !comments.trim()) {
      setError('A rejection reason is required.');
      return;
    }

    setError('');
    setSubmitting(true);
    const verified = await verifySignature();
    if (!verified) { setSubmitting(false); return; }

    try {
      await api.post(`/lab/tests/${testId}/qa-review`, {
        action,
        comments:       comments || null,
        deviation_note: deviationNote || null,
        signature_verified: true,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit QA review');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCoA = async () => {
    if (!test) return;
    setDownloading(true);
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/lab/tests/${testId}/certificate/pdf`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `CoA_${test.certificate_number || test.test_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Failed to download certificate. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-dark-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FlaskConical className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {loading ? 'Loading...' : (test?.test_number ?? 'Lab Test')}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {test && <StatusPill status={test.overall_status} />}
                  {canAct && (
                    <span className="text-xs text-yellow-400 font-medium">· QA review required</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* CoA Download — only when certified */}
              {isCertified && (
                <button
                  onClick={downloadCoA}
                  disabled={downloading}
                  className="px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-lg text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {downloading
                    ? <><div className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /> Generating...</>
                    : <><Download className="w-3.5 h-3.5" /> Download CoA</>}
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {loading && (
            <div className="text-center py-8 text-gray-400">Loading test details...</div>
          )}

          {test && (
            <>
              {/* Certificate banner — shown when certified */}
              {isCertified && test.certificate_number && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                  <FileCheck className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-green-400 font-semibold text-sm">Certificate Issued</p>
                    <p className="text-green-300 text-xs font-mono">{test.certificate_number}</p>
                  </div>
                  <button
                    onClick={downloadCoA}
                    disabled={downloading}
                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloading ? 'Generating...' : 'Download CoA PDF'}
                  </button>
                </div>
              )}

              {/* Meta grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {[
                  { icon: Calendar, label: 'Test Date', value: new Date(test.test_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
                  { icon: User,     label: 'Shift',     value: <span className="capitalize">{test.shift}</span> },
                  { icon: User,     label: 'Analyst',   value: test.analyst_name },
                  { icon: Shield,   label: 'RO System', value: test.ro_system_reference || '—' },
                ].map(item => (
                  <div key={item.label} className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                    <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                    <p className="text-white font-medium text-sm">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Overall result banner */}
              <div className={`rounded-lg p-4 border flex items-center gap-3 ${
                isCertified ? 'bg-green-500/10 border-green-500/30'
                : test.overall_status === 'rejected' ? 'bg-red-500/10 border-red-500/30'
                : test.overall_status === 'submitted' ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-dark-700 border-dark-600'
              }`}>
                {isCertified
                  ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  : test.overall_status === 'submitted'
                  ? <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
                <div>
                  <p className="font-medium text-white text-sm">
                    {test.parameters.filter(p => p.status === 'pass').length} / {test.parameters.length} parameters pass specification
                  </p>
                  <p className="text-xs text-gray-400">
                    {test.parameters.filter(p => p.status === 'fail').length > 0 && `${test.parameters.filter(p => p.status === 'fail').length} failed · `}
                    {test.parameters.filter(p => p.status === 'warning').length > 0 && `${test.parameters.filter(p => p.status === 'warning').length} near limit`}
                    {test.parameters.every(p => p.status === 'pass') && 'All within specification'}
                  </p>
                </div>
                {test.qa_reviewer_name && (
                  <div className="ml-auto text-right">
                    <p className="text-xs text-gray-400">QA Reviewed by</p>
                    <p className="text-sm text-white">{test.qa_reviewer_name}</p>
                  </div>
                )}
              </div>

              {/* Parameters table */}
              <div className="bg-dark-900 rounded-lg border border-dark-700 overflow-hidden">
                <button
                  onClick={() => setShowParams(!showParams)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white hover:bg-dark-800 transition-colors"
                >
                  Parameter Results
                  {showParams ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {showParams && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t border-b border-dark-700 bg-dark-800">
                          {['Parameter', 'Reading', 'Spec Limit', 'Result', 'Note'].map(h => (
                            <th key={h} className="px-4 py-2 text-left text-gray-400 font-medium text-xs">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {test.parameters.map(p => <ParamRow key={p.parameter_code} param={p} />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Review trail */}
              {test.approvals.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-300">Review Trail</h3>
                  {test.approvals.map(approval => (
                    <div key={`${approval.stage}-${approval.actioned_at}`} className="bg-dark-900 rounded-lg p-3 border border-dark-700 flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        approval.action === 'approve' || approval.action === 'submit' ? 'bg-green-500/20 text-green-400' :
                        approval.action === 'reject'  ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>{approval.stage}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-white">
                            {approval.actioned_by_name}
                            <span className="text-gray-500 text-xs ml-1">({approval.actioned_by_employee_id})</span>
                          </p>
                          <p className="text-xs text-gray-500 flex-shrink-0">
                            {new Date(approval.actioned_at).toLocaleString('en-GB')}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 capitalize mt-0.5">
                          {approval.stage === 1 ? 'Analyst submission' : 'QA review'} — {approval.action}
                        </p>
                        {approval.comments && <p className="text-xs text-gray-300 mt-1">{approval.comments}</p>}
                        {approval.deviation_note && (
                          <div className="mt-1 px-2 py-1 bg-yellow-500/10 rounded text-xs text-yellow-300">
                            Deviation note: {approval.deviation_note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* QA Action Block */}
              {canAct && (
                <div className="space-y-4 pt-2 border-t border-dark-700">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-300">QA Review & Sign-off</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      As QA, your sign-off is the final authority. Approving will issue a numbered Certificate of Analysis.
                    </p>
                  </div>

                  {!action ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setAction('approve')}
                        className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve & Issue CoA
                      </button>
                      {test.parameters.some(p => p.status === 'fail' || p.status === 'warning') && (
                        <button
                          onClick={() => setAction('conditional')}
                          className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                        >
                          <AlertCircle className="w-4 h-4" /> Conditional Pass
                        </button>
                      )}
                      <button
                        onClick={() => setAction('reject')}
                        className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Selected action indicator */}
                      <div className={`px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${
                        action === 'approve'     ? 'bg-green-500/10 text-green-400' :
                        action === 'reject'      ? 'bg-red-500/10 text-red-400' :
                        'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {action === 'approve' ? <CheckCircle2 className="w-4 h-4" /> : action === 'reject' ? <XCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span className="capitalize">{action === 'approve' ? 'Approve & Issue Certificate of Analysis' : action === 'reject' ? 'Reject — Re-test required' : 'Conditional Pass'}</span>
                        <button onClick={() => { setAction(null); setComments(''); setDeviationNote(''); }} className="ml-2 text-xs opacity-60 hover:opacity-100">change</button>
                      </div>

                      {/* Comments / rejection reason */}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">
                          {action === 'reject' ? 'Rejection Reason *' : 'QA Comments (optional)'}
                        </label>
                        <textarea
                          value={comments}
                          onChange={e => setComments(e.target.value)}
                          rows={2}
                          placeholder={action === 'reject' ? 'Detail why this test is rejected and what re-test is required...' : 'Optional QA review comments...'}
                          className={`w-full px-3 py-2 border rounded-lg text-white text-sm focus:outline-none resize-none ${
                            action === 'reject'
                              ? 'bg-red-500/10 border-red-500/30 focus:border-red-500'
                              : 'bg-dark-900 border-dark-600 focus:border-primary-500'
                          }`}
                        />
                      </div>

                      {/* Deviation note — mandatory for conditional */}
                      {action === 'conditional' && (
                        <div>
                          <label className="block text-xs font-medium text-yellow-400 mb-1">Deviation Note * (mandatory)</label>
                          <textarea
                            value={deviationNote}
                            onChange={e => setDeviationNote(e.target.value)}
                            rows={2}
                            placeholder="Document the justification for issuing a conditional certificate despite out-of-spec parameters..."
                            className="w-full px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-yellow-500 resize-none"
                          />
                        </div>
                      )}

                      {/* Digital signature */}
                      <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                        <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-primary-400" />
                          QA Electronic Signature — 21 CFR Part 11
                        </h4>
                        <p className="text-xs text-gray-400 mb-3">
                          Enter your login password to electronically sign this QA review.
                          {action !== 'reject' && ' A numbered Certificate of Analysis will be generated and issued.'}
                        </p>
                        <input
                          type="password"
                          value={signature}
                          onChange={e => { setSignature(e.target.value); setError(''); }}
                          placeholder="Enter your login password"
                          className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono tracking-widest text-sm"
                          onKeyDown={e => { if (e.key === 'Enter' && signature && !submitting) handleQAAction(); }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {canAct && action && (
          <div className="p-6 border-t border-dark-700 flex-shrink-0 flex gap-3">
            <button
              onClick={() => { setAction(null); setSignature(''); setError(''); }}
              disabled={submitting}
              className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleQAAction}
              disabled={
                submitting || !signature.trim() ||
                (action === 'conditional' && !deviationNote.trim()) ||
                (action === 'reject' && !comments.trim())
              }
              className={`flex-1 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-white ${
                action === 'approve'     ? 'bg-green-500 hover:bg-green-600' :
                action === 'reject'      ? 'bg-red-500 hover:bg-red-600' :
                'bg-yellow-500 hover:bg-yellow-600'
              }`}
            >
              {submitting
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verifying...</>
                : <>
                    {action === 'approve' ? <CheckCircle2 className="w-4 h-4" /> : action === 'reject' ? <XCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    Sign & {action === 'approve' ? 'Issue Certificate' : action === 'reject' ? 'Reject Test' : 'Conditionally Approve'}
                  </>}
            </button>
          </div>
        )}

        {!canAct && test && (
          <div className="p-4 border-t border-dark-700 flex-shrink-0 flex gap-3">
            {isCertified && (
              <button
                onClick={downloadCoA}
                disabled={downloading}
                className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {downloading ? 'Generating PDF...' : `Download Certificate of Analysis`}
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
