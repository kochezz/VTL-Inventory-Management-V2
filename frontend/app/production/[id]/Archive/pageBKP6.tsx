'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import axios from 'axios';
import { 
  ArrowLeft, Package, Calendar, User, MapPin, CheckCircle2, 
  XCircle, Clock, PlayCircle, StopCircle, AlertCircle, FileText,
  TrendingUp, Activity
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CompleteProductionModal, { ProductionCompletionData } from '@/components/production/CompleteProductionModal';
import IPQCCheckModal from '@/components/production/IPQCCheckModal';
import IPQCReviewModal from '@/components/production/IPQCReviewModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Component {
  component_id: string;
  component_name: string;
  sku: string;
  quantity_assigned: number;
  material_status: string;
  supplier_batch_lot?: string;
  location_name: string;
  location_code: string;
}

interface QAGate {
  gate_id: string;
  gate_number: number;
  gate_name: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
}

interface Batch {
  batch_id: string;
  batch_number: string;
  batch_record_code: string;
  product_id: string;
  product_name: string;
  sku: string;
  production_date: string;
  production_line: string;
  shift: string;
  planned_quantity: number;
  actual_output?: number;
  rejected_bottles?: number;
  yield_percentage?: number | string;
  status: string;
  line_supervisor_id?: string;
  line_supervisor_name?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  components: Component[];
  qa_gates: QAGate[];
  ipqc_count: number;
  deviation_count: number;
}

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, token } = useAuth();
  
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  // IPQC state
const [showIPQCModal, setShowIPQCModal] = useState(false);
const [ipqcHistory, setIpqcHistory] = useState<any[]>([]);
const [ipqcSummary, setIpqcSummary] = useState<any>(null);
const [nextIPQCDue, setNextIPQCDue] = useState<any>(null);
const [showQAReviewModal, setShowQAReviewModal] = useState(false);
const [selectedIPQCId, setSelectedIPQCId] = useState<string | null>(null);

  useEffect(() => {
  if (isAuthenticated && token && params.id) {
    fetchBatchDetails();
    fetchIPQCData();
  }
}, [isAuthenticated, token, params.id]);
  const fetchBatchDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/production/batches/${params.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBatch(response.data.batch);
    } catch (err: any) {
      console.error('Error fetching batch:', err);
      setError(err.response?.data?.message || 'Failed to load batch details');
    } finally {
      setLoading(false);
    }
  };

  const fetchIPQCData = async () => {
  try {
    const response = await axios.get(
      `${API_URL}/production/batches/${params.id}/ipqc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setIpqcHistory(response.data.checks);
    setIpqcSummary(response.data.summary);
    
    // Get next check due if in progress
    if (batch?.status === 'in_progress') {
      const dueResponse = await axios.get(
        `${API_URL}/production/batches/${params.id}/ipqc/next-due`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNextIPQCDue(dueResponse.data);
    }
  } catch (err) {
    console.error('Error fetching IPQC data:', err);
  }
};
  const handleOpenQAReview = (ipqcId: string) => {
     setSelectedIPQCId(ipqcId);
     setShowQAReviewModal(true);
   };
   
   const handleQAReviewSuccess = () => {
     fetchIPQCData();
     fetchBatchDetails();
   };
const handleStatusTransition = async (action: string) => {
    try {
      setActionLoading(true);
      setError('');

      let endpoint = '';
      let data = {};

      switch (action) {
        case 'submit_qa':
          endpoint = `/production/batches/${params.id}/submit-qa`;
          break;
        case 'approve_gate':
          endpoint = `/production/batches/${params.id}/qa-gates/${batch?.qa_gates[0]?.gate_id}/approve`;
          break;
        case 'reject_gate':
          endpoint = `/production/batches/${params.id}/qa-gates/${batch?.qa_gates[0]?.gate_id}/reject`;
          data = { reason: 'Rejected by user' };
          break;
        case 'start_production':
          endpoint = `/production/batches/${params.id}/start`;
          break;
        case 'complete_production':
          // Show modal instead of direct API call
          setShowCompleteModal(true);
          return; // Don't proceed with API call
      }

      await axios.post(
        `${API_URL}${endpoint}`,
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh batch details
      await fetchBatchDetails();
    } catch (err: any) {
      console.error('Error performing action:', err);
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQAApproval = async (batchId: string, gateId: string, action: 'approve' | 'reject') => {
    try {
      setActionLoading(true);
      setError('');

      const endpoint = action === 'approve' 
        ? `/production/batches/${batchId}/qa-gates/${gateId}/approve`
        : `/production/batches/${batchId}/qa-gates/${gateId}/reject`;

      const data = action === 'reject' 
        ? { reason: 'Rejected during QA review' }
        : {};

      await axios.post(
        `${API_URL}${endpoint}`,
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh batch details
      await fetchBatchDetails();
    } catch (err: any) {
      console.error('Error with QA approval:', err);
      
      // Handle permission errors specifically
      if (err.response?.status === 403) {
        setError('You do not have permission to approve/reject QA gates. Only QA personnel and administrators can perform this action.');
      } else {
        setError(err.response?.data?.message || 'QA action failed');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteProduction = async (completionData: ProductionCompletionData) => {
    try {
      setActionLoading(true);
      setError('');

      console.log('🔄 BatchDetailPage: Completing production for batch:', params.id);
      console.log('📦 Completion data:', completionData);

      const response = await axios.post(
        `${API_URL}/production/batches/${params.id}/complete`,
        completionData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('✅ BatchDetailPage: Production completion response:', response.data);

      // Close modal
      setShowCompleteModal(false);
      
      // Refresh batch details to show completed status
      await fetchBatchDetails();
    } catch (err: any) {
      console.error('❌ BatchDetailPage: Production completion error:', err);
      console.error('Response:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to complete production');
      throw err; // Re-throw to let modal handle it
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading batch details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !batch) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-red-400 font-medium">Error loading batch</p>
                <p className="text-red-400/80 text-sm">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!batch) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-400">Batch not found</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      awaiting_qa: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      ready_for_setup: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      in_progress: 'bg-green-500/10 text-green-400 border-green-500/20',
      completed: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      released: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return colors[status] || colors.draft;
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{batch.batch_number}</h1>
              <p className="text-gray-400 text-sm mt-1">{batch.batch_record_code}</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full border ${getStatusColor(batch.status)}`}>
            <span className="text-sm font-semibold uppercase tracking-wide">
              {batch.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Info */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-500" />
                Product Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Product Name</label>
                  <p className="text-white font-medium">{batch.product_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">SKU</label>
                  <p className="text-white font-mono text-sm">{batch.sku}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Production Date</label>
                  <p className="text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {new Date(batch.production_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Production Line</label>
                  <p className="text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {batch.production_line}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Shift</label>
                  <p className="text-white">{batch.shift}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Planned Quantity</label>
                  <p className="text-white font-semibold">{batch.planned_quantity.toLocaleString()} units</p>
                </div>
                {batch.actual_output !== undefined && batch.actual_output !== null && (
                  <>
                    <div>
                      <label className="text-sm text-gray-400">Actual Output</label>
                      <p className="text-white font-semibold">{batch.actual_output.toLocaleString()} units</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Yield</label>
                      <p className="text-green-400 font-semibold flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        {typeof batch.yield_percentage === 'number' 
                          ? `${batch.yield_percentage.toFixed(2)}%`
                          : batch.yield_percentage || 'N/A'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* QA Gates */}
            {batch.qa_gates && batch.qa_gates.length > 0 && (
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">QA Gates</h2>
                <div className="space-y-3">
                  {batch.qa_gates.map((gate) => (
                    <div
                      key={gate.gate_id}
                      className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-500/10 text-primary-400 font-bold">
                          {gate.gate_number}
                        </div>
                        <div>
                          <p className="text-white font-medium">{gate.gate_name}</p>
                          {gate.approved_by_name && (
                            <p className="text-sm text-gray-400">
                              Approved by {gate.approved_by_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {gate.status === 'approved' && (
                          <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Approved
                          </span>
                        )}
                        {gate.status === 'rejected' && (
                          <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-sm font-medium flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            Rejected
                          </span>
                        )}
                        {gate.status === 'pending' && (
                          <>
                            <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-full text-sm font-medium flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              Pending
                            </span>
                            <button
                              onClick={() => handleQAApproval(batch.batch_id, gate.gate_id, 'approve')}
                              disabled={actionLoading}
                              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleQAApproval(batch.batch_id, gate.gate_id, 'reject')}
                              disabled={actionLoading}
                              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Components */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Component Assignments</h2>
              <div className="space-y-3">
                {batch.components.map((component) => (
                  <div
                    key={component.component_id}
                    className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700"
                  >
                    <div>
                      <p className="text-white font-medium">{component.component_name}</p>
                      <p className="text-sm text-gray-400 font-mono">{component.sku}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {component.location_code} - {component.location_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">{component.quantity_assigned.toLocaleString()}</p>
                      <p className="text-sm text-gray-400">{component.material_status}</p>
                      {component.supplier_batch_lot && (
                        <p className="text-xs text-gray-500 mt-1">Lot: {component.supplier_batch_lot}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* IPQC Records - Phase 2 Enhanced */}
            {batch.status === 'in_progress' && (
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary-500" />
                  In-Process Quality Checks (IPQC)
                </h2>
                <button
                  onClick={() => setShowIPQCModal(true)}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Record IPQC Check
                </button>
              </div>

              {/* IPQC Summary Cards */}
              {ipqcSummary && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                    <p className="text-sm text-gray-400">Total Checks</p>
                    <p className="text-2xl font-bold text-white">{ipqcSummary.total_checks}</p>
                  </div>
                  <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                    <p className="text-sm text-green-400">Passed</p>
                    <p className="text-2xl font-bold text-green-400">{ipqcSummary.passed_checks}</p>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                    <p className="text-sm text-red-400">Failed</p>
                    <p className="text-2xl font-bold text-red-400">{ipqcSummary.failed_checks}</p>
                  </div>
                </div>
              )}

              {/* IPQC History Table - Phase 2 Enhanced Layout */}
              {ipqcHistory.length > 0 ? (
                <div className="overflow-x-auto -mx-6 px-6">
                  <div className="min-w-[1200px]">
                    <table className="w-full border-collapse">
                      <thead className="bg-dark-900/50 sticky top-0">
                        <tr className="border-b-2 border-dark-700">
                          <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4 w-20">Check #</th>
                          <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4 w-24">Time</th>
                          <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4 w-20">Fill</th>
                          <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4 w-20">Torque</th>
                          <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4 w-16">Visual</th>
                          <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4 w-16">Label</th>
                          <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4 w-16">Code</th>
                          <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4 w-20">Status</th>
                          <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4 w-32">QA Status</th>
                          <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4 w-32">Operator</th>
                          <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4 w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700/50">
                        {ipqcHistory.map((check, index) => (
                          <tr 
                            key={check.ipqc_id} 
                            className={`hover:bg-dark-800/50 transition-colors ${
                              index % 2 === 0 ? 'bg-dark-900/20' : ''
                            }`}
                          >
                            {/* Check Number */}
                            <td className="py-4 px-4">
                              <span className="text-white font-semibold text-sm">
                                #{check.check_sequence}
                              </span>
                            </td>

                            {/* Time */}
                            <td className="py-4 px-4">
                              <span className="text-gray-300 text-xs font-mono">
                                {new Date(check.check_time).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                            </td>

                            {/* Fill Volume */}
                            <td className="py-4 px-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-sm font-semibold ${
                                  check.fill_volume_within_spec ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {check.fill_volume_ml}ml
                                </span>
                                {check.fill_volume_within_spec ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                                )}
                              </div>
                            </td>

                            {/* Cap Torque */}
                            <td className="py-4 px-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-sm font-semibold ${
                                  check.cap_torque_within_spec ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {check.cap_torque_nm}Nm
                                </span>
                                {check.cap_torque_within_spec ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                                )}
                              </div>
                            </td>

                            {/* Visual Inspection */}
                            <td className="py-4 px-4 text-center">
                              {check.visual_inspection_pass ? (
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10">
                                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10">
                                  <XCircle className="w-5 h-5 text-red-400" />
                                </div>
                              )}
                            </td>

                            {/* Label Position */}
                            <td className="py-4 px-4 text-center">
                              {check.label_position_correct ? (
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10">
                                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10">
                                  <XCircle className="w-5 h-5 text-red-400" />
                                </div>
                              )}
                            </td>

                            {/* Coding Legibility */}
                            <td className="py-4 px-4 text-center">
                              {check.coding_legible ? (
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10">
                                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10">
                                  <XCircle className="w-5 h-5 text-red-400" />
                                </div>
                              )}
                            </td>

                            {/* Overall Status */}
                            <td className="py-4 px-4 text-center">
                              {check.all_checks_passed ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/30 text-green-400 rounded-md text-xs font-bold uppercase tracking-wide">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Pass
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-md text-xs font-bold uppercase tracking-wide">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Fail
                                </span>
                              )}
                            </td>

                            {/* QA Status - Enhanced Visibility */}
                            <td className="py-4 px-4">
                              {check.qa_status === 'qa_approved' ? (
                                <div className="inline-flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/40 rounded-lg">
                                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                                  <div className="flex flex-col items-start">
                                    <span className="text-xs font-bold text-green-400 uppercase tracking-wide">Approved</span>
                                    <span className="text-[10px] text-green-400/70">QA Verified</span>
                                  </div>
                                </div>
                              ) : check.qa_status === 'qa_rejected' ? (
                                <div className="inline-flex items-center gap-2 px-3 py-2 bg-red-500/20 border border-red-500/40 rounded-lg">
                                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                  <div className="flex flex-col items-start">
                                    <span className="text-xs font-bold text-red-400 uppercase tracking-wide">Rejected</span>
                                    <span className="text-[10px] text-red-400/70">See Notes</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 px-3 py-2 bg-yellow-500/20 border border-yellow-500/40 rounded-lg animate-pulse">
                                  <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                                  <div className="flex flex-col items-start">
                                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wide">Pending</span>
                                    <span className="text-[10px] text-yellow-400/70">QA Review</span>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Operator */}
                            <td className="py-4 px-4">
                              <span className="text-gray-300 text-sm font-medium">
                                {check.operator_name}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-4 text-center">
                              {check.qa_status === 'pending_qa_review' && (
                                <button
                                  onClick={() => handleOpenQAReview(check.ipqc_id)}
                                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold transition-all hover:scale-105 shadow-lg shadow-primary-500/20"
                                >
                                  Review
                                </button>
                              )}
                              {check.qa_status === 'qa_approved' && (
                                <button
                                  onClick={() => handleOpenQAReview(check.ipqc_id)}
                                  className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg text-xs font-semibold transition-all"
                                >
                                  View
                                </button>
                              )}
                              {check.qa_status === 'qa_rejected' && (
                                <button
                                  onClick={() => handleOpenQAReview(check.ipqc_id)}
                                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold transition-all"
                                >
                                  View Details
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-base font-medium mb-2">
                    No IPQC checks recorded yet
                  </p>
                  <p className="text-gray-500 text-sm">
                    Click "Record IPQC Check" to begin quality monitoring
                  </p>
                </div>
              )}
            </div>
          )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {batch.status === 'draft' && (
                  <button
                    onClick={() => handleStatusTransition('submit_qa')}
                    disabled={actionLoading}
                    className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Submit for QA
                  </button>
                )}
                
                {batch.status === 'ready_for_setup' && (
                  <button
                    onClick={() => handleStatusTransition('start_production')}
                    disabled={actionLoading}
                    className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Start Production
                  </button>
                )}

                {batch.status === 'in_progress' && (
                  <button
                    onClick={() => handleStatusTransition('complete_production')}
                    disabled={actionLoading}
                    className="w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <StopCircle className="w-4 h-4" />
                    Complete Production
                  </button>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-400">Created By</label>
                  <p className="text-white">{batch.created_by_name || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Created At</label>
                  <p className="text-white text-sm">
                    {new Date(batch.created_at).toLocaleString()}
                  </p>
                </div>
                {batch.line_supervisor_name && (
                  <div>
                    <label className="text-sm text-gray-400">Line Supervisor</label>
                    <p className="text-white">{batch.line_supervisor_name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Statistics</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">IPQC Records</span>
                  <span className="text-white font-semibold">{batch.ipqc_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Deviations</span>
                  <span className={`font-semibold ${batch.deviation_count > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                    {batch.deviation_count}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Components</span>
                  <span className="text-white font-semibold">{batch.components.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Production Modal */}
      {batch && (
        <CompleteProductionModal
          isOpen={showCompleteModal}
          onClose={() => setShowCompleteModal(false)}
          batch={{
            batch_id: batch.batch_id,
            batch_number: batch.batch_number,
            product_name: batch.product_name,
            planned_quantity: batch.planned_quantity
          }}
          onComplete={handleCompleteProduction}
        />
      )}
      {/* IPQC Modal */}
      <IPQCCheckModal
        batchId={params.id as string}
        batchNumber={batch?.batch_number || ''}
        productName={batch?.product_name || ''}
        isOpen={showIPQCModal}
        onClose={() => setShowIPQCModal(false)}
        onSuccess={() => {
          fetchIPQCData();
          fetchBatchDetails();
        }}
      />
      {/* QA Review Modal */}
      <IPQCReviewModal
        ipqcId={selectedIPQCId}
        isOpen={showQAReviewModal}
        onClose={() => {
          setShowQAReviewModal(false);
          setSelectedIPQCId(null);
        }}
        onSuccess={handleQAReviewSuccess}
      />
    </DashboardLayout>
  );
}
