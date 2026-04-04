'use client';

// ============================================================================
// QC LAB PAGE — frontend/app/lab/page.tsx
// Water Quality Testing Dashboard
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  FlaskConical, Plus, RefreshCw, CheckCircle2, XCircle,
  AlertCircle, Clock, Shield, FileCheck, ChevronRight
} from 'lucide-react';
import LabTestModal from '@/components/lab/LabTestModal';
import LabQAReviewModal from '@/components/lab/LabQAReviewModal';

interface LabTest {
  test_id: string;
  test_number: string;
  test_date: string;
  shift: string;
  overall_status: string;
  certificate_number: string | null;
  analyst_name: string;
  analyst_employee_id: string;
  supervisor_name: string | null;
  manager_name: string | null;
  batch_number: string | null;
  total_params: number;
  params_passed: number;
  params_failed: number;
  params_warning: number;
  created_at: string;
  approved_at: string | null;
}

interface LabStats {
  tests_today: number;
  pending_qa_review: number;
  pending_qa_review: number;
  valid_certs_today: number;
  failures_this_week: number;
  rejected_this_week: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft:           { label: 'Draft',              color: 'text-gray-400 bg-gray-400/10 border-gray-400/30',     icon: Clock },
  submitted:       { label: 'Awaiting QA', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', icon: Clock },
  manager_review:  { label: 'Awaiting Manager',    color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',    icon: Shield },
  pass:            { label: 'Passed — Cert Issued', color: 'text-green-400 bg-green-400/10 border-green-400/30', icon: CheckCircle2 },
  conditional_pass:{ label: 'Conditional Pass',    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', icon: AlertCircle },
  fail:            { label: 'Failed',              color: 'text-red-400 bg-red-400/10 border-red-400/30',       icon: XCircle },
  rejected:        { label: 'Rejected',            color: 'text-red-400 bg-red-400/10 border-red-400/30',       icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-gray-400 bg-gray-400/10 border-gray-400/30', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

function ShiftBadge({ shift }: { shift: string }) {
  const colors: Record<string, string> = {
    morning:   'text-amber-400 bg-amber-400/10',
    afternoon: 'text-blue-400 bg-blue-400/10',
    night:     'text-purple-400 bg-purple-400/10',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${colors[shift] ?? 'text-gray-400 bg-gray-400/10'}`}>
      {shift}
    </span>
  );
}

export default function LabPage() {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [stats, setStats] = useState<LabStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reviewTestId, setReviewTestId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      const [testsRes, statsRes] = await Promise.all([
        api.get(`/lab/tests?${params}`),
        api.get('/lab/stats'),
      ]);
      setTests(testsRes.data.tests);
      setStats(statsRes.data.stats);
    } catch (err) {
      console.error('Lab page fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRowClick = (test: LabTest) => {
    // Only open review modal for tests that need QA action or are viewable
    setReviewTestId(test.test_id);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <FlaskConical className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">QC Laboratory</h1>
              <p className="text-sm text-gray-400">Water quality testing and certification</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Test
            </button>
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Tests Today',       value: stats.tests_today,         color: 'text-white' },
              { label: 'Valid Certs Today', value: stats.valid_certs_today,   color: 'text-green-400' },
              { label: 'Awaiting QA Review',value: stats.pending_qa_review,  color: 'text-yellow-400' },
              { label: 'Drafts In Progress',value: stats.drafts_in_progress,  color: 'text-blue-400' },
              { label: 'Failures (7d)',     value: stats.failures_this_week,  color: 'text-red-400' },
              { label: 'Rejected (7d)',     value: stats.rejected_this_week,  color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-dark-800 rounded-xl p-4 border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pending Actions Banner */}
        {stats && (stats.pending_qa_review > 0 || stats.pending_qa_review > 0) && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-yellow-300 text-sm">
              {stats.pending_qa_review > 0 && `${stats.pending_qa_review} test(s) awaiting Supervisor review. `}
              {stats.pending_qa_review > 0 && `${stats.pending_qa_review} test(s) awaiting Manager sign-off.`}
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
          <div className="flex flex-wrap gap-2">
            {[
              { value: '', label: 'All Tests' },
              { value: 'draft', label: 'Draft' },
              { value: 'submitted', label: 'Awaiting QA Review' },
              { value: 'pass', label: 'Passed' },
              { value: 'conditional_pass', label: 'Conditional' },
              { value: 'fail', label: 'Failed' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === f.value
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-dark-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tests Table */}
        <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  {['Test No.', 'Date', 'Shift', 'Analyst', 'Batch', 'Results', 'Status', 'Certificate', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading tests...
                  </td></tr>
                ) : tests.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No lab tests found</p>
                    <button onClick={() => setShowCreateModal(true)} className="mt-2 text-primary-400 hover:text-primary-300 text-sm">
                      Record the first test
                    </button>
                  </td></tr>
                ) : tests.map(test => (
                  <tr
                    key={test.test_id}
                    onClick={() => handleRowClick(test)}
                    className="hover:bg-dark-700/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-primary-400">{test.test_number}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {new Date(test.test_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3"><ShiftBadge shift={test.shift} /></td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-white">{test.analyst_name}</p>
                      <p className="text-xs text-gray-500">{test.analyst_employee_id}</p>
                    </td>
                    <td className="px-4 py-3">
                      {test.batch_number
                        ? <span className="text-xs font-mono text-gray-300">{test.batch_number}</span>
                        : <span className="text-xs text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-400">{test.params_passed}✓</span>
                        {test.params_failed > 0 && <span className="text-red-400">{test.params_failed}✗</span>}
                        {test.params_warning > 0 && <span className="text-yellow-400">{test.params_warning}⚠</span>}
                        <span className="text-gray-500">/ {test.total_params}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={test.overall_status} /></td>
                    <td className="px-4 py-3">
                      {test.certificate_number
                        ? <div className="flex items-center gap-1.5 text-green-400">
                            <FileCheck className="w-3.5 h-3.5" />
                            <span className="text-xs font-mono">{test.certificate_number}</span>
                          </div>
                        : <span className="text-xs text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <LabTestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => { setShowCreateModal(false); fetchData(); }}
      />

      <LabQAReviewModal
        testId={reviewTestId}
        isOpen={!!reviewTestId}
        onClose={() => setReviewTestId(null)}
        onSuccess={() => { setReviewTestId(null); fetchData(); }}
      />
    </DashboardLayout>
  );
}
