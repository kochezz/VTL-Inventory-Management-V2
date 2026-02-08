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
  yield_percentage?: number;
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

  useEffect(() => {
    if (isAuthenticated && token && params.id) {
      fetchBatchDetails();
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
          endpoint = `/production/batches/${params.id}/complete`;
          data = { 
            actual_output: batch?.planned_quantity || 0,
            rejected_bottles: 0 
          };
          break;
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

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'draft': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'awaiting_qa': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'ready_for_setup': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'in_progress': 'bg-green-500/10 text-green-400 border-green-500/20',
      'completed': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      'released': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'rejected': 'bg-red-500/10 text-red-400 border-red-500/20',
      'on_hold': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  const getQAStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-400" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
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
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!batch) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-gray-400">Batch not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/production')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Batches
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{batch.batch_number}</h1>
              <p className="text-gray-400">{batch.product_name}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-4 py-2 rounded-lg border font-medium ${getStatusColor(batch.status)}`}>
                {batch.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Batch Information */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-400" />
                Batch Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Batch Record Code</label>
                  <p className="text-white font-mono">{batch.batch_record_code}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Product SKU</label>
                  <p className="text-white font-mono">{batch.sku}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Production Date</label>
                  <p className="text-white">
                    {new Date(batch.production_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Production Line</label>
                  <p className="text-white">{batch.production_line}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Shift</label>
                  <p className="text-white capitalize">{batch.shift}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Planned Quantity</label>
                  <p className="text-white font-semibold">{batch.planned_quantity.toLocaleString()} units</p>
                </div>
                {batch.actual_output && (
                  <>
                    <div>
                      <label className="text-sm text-gray-400">Actual Output</label>
                      <p className="text-green-400 font-semibold">{batch.actual_output.toLocaleString()} units</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Yield</label>
                      <p className="text-white font-semibold">{batch.yield_percentage?.toFixed(1)}%</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Components */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-400" />
                Component Assignments
              </h2>
              <div className="space-y-3">
                {batch.components.map((component) => (
                  <div
                    key={component.component_id}
                    className="bg-dark-900 rounded-lg p-4 border border-dark-700"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{component.component_name}</p>
                        <p className="text-sm text-gray-400">{component.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">{component.quantity_assigned.toLocaleString()} units</p>
                        <p className="text-xs text-gray-400">{component.location_code}</p>
                      </div>
                    </div>
                    {component.supplier_batch_lot && (
                      <p className="text-xs text-gray-500 mt-2">Lot: {component.supplier_batch_lot}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* QA Gates */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary-400" />
                QA Gates
              </h2>
              <div className="space-y-3">
                {batch.qa_gates.length === 0 ? (
                  <p className="text-gray-400 text-sm">No QA gates initiated yet</p>
                ) : (
                  batch.qa_gates.map((gate) => (
                    <div
                      key={gate.gate_id}
                      className="bg-dark-900 rounded-lg p-4 border border-dark-700"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getQAStatusIcon(gate.status)}
                          <div>
                            <p className="text-white font-medium">
                              Gate {gate.gate_number}: {gate.gate_name}
                            </p>
                            {gate.approved_by_name && (
                              <p className="text-sm text-gray-400">
                                {gate.status === 'approved' ? 'Approved' : 'Rejected'} by {gate.approved_by_name}
                                {gate.approved_at && ` on ${new Date(gate.approved_at).toLocaleDateString()}`}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          gate.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                          gate.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                          'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {gate.status.toUpperCase()}
                        </span>
                      </div>
                      
                      {gate.rejection_reason && (
                        <p className="text-sm text-red-400 mt-2">Reason: {gate.rejection_reason}</p>
                      )}
                      
                      {/* QA Approval Buttons - Only show for pending gates */}
                      {gate.status === 'pending' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-dark-700">
                          <button
                            onClick={() => handleQAApproval(batch.batch_id, gate.gate_id, 'approve')}
                            disabled={actionLoading}
                            className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleQAApproval(batch.batch_id, gate.gate_id, 'reject')}
                            disabled={actionLoading}
                            className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
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
    </DashboardLayout>
  );
}
