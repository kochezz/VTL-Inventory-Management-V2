'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import axios from 'axios';
import { ArrowLeft, Calendar, Package, User, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Component {
  component_id: number;
  component_name: string;
  sku: string;
  quantity_required: number;
  quantity_assigned: number;
  location_code: string;
  location_name: string;
  material_status: string;
  supplier_batch_lot: string;
}

interface QAGate {
  gate_id: number;
  gate_number: number;
  gate_name: string;
  status: string;
  approved_by: number;
  approved_by_name: string;
  approved_at: string;
  rejection_reason: string;
}

interface Batch {
  batch_id: number;
  batch_number: string;
  batch_record_code: string;
  product_id: number;
  product_name: string;
  sku: string;
  production_date: string;
  production_line: string;
  shift: string;
  planned_quantity: number;
  actual_output: number;
  status: string;
  line_supervisor_id: number;
  line_supervisor_name: string;
  created_by: number;
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
  const batchId = params.id as string;

  // ✅ Use useAuth hook for token (like products page)
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch batch when authenticated
  useEffect(() => {
    if (isAuthenticated && token && batchId) {
      fetchBatchDetails();
    }
  }, [isAuthenticated, token, batchId]);

  const fetchBatchDetails = async () => {
    try {
      setLoading(true);
      setError('');

      // ✅ Use token from useAuth hook
      const response = await axios.get(`${API_URL}/production/batches/${batchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setBatch(response.data.batch || null);
    } catch (err: any) {
      console.error('Error fetching batch details:', err);
      setError(err.response?.data?.error || 'Failed to load batch details');
    } finally {
      setLoading(false);
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

  const getGateStatusIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle className="w-5 h-5 text-green-400" />;
    if (status === 'rejected') return <XCircle className="w-5 h-5 text-red-400" />;
    return <AlertCircle className="w-5 h-5 text-yellow-400" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Don't render until auth is ready
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/production')}
          className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Batches
        </button>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading batch details...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchBatchDetails}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : !batch ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-400">Batch not found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-dark-900 rounded-lg border border-dark-800 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">{batch.batch_number}</h1>
                  <p className="text-gray-400">{batch.batch_record_code}</p>
                </div>
                <span className={`px-4 py-2 rounded-lg border font-medium capitalize ${getStatusColor(batch.status)}`}>
                  {batch.status.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Product</p>
                    <p className="text-white font-medium">{batch.product_name}</p>
                    <p className="text-xs text-gray-500">{batch.sku}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Production Date</p>
                    <p className="text-white font-medium">{formatDate(batch.production_date)}</p>
                    <p className="text-xs text-gray-500">{batch.shift} shift</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Created By</p>
                    <p className="text-white font-medium">{batch.created_by_name}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(batch.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Quantity</p>
                    <p className="text-white font-medium">{batch.planned_quantity.toLocaleString()} units</p>
                    {batch.actual_output && (
                      <p className="text-xs text-gray-500">{batch.actual_output.toLocaleString()} actual</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Components */}
            <div className="bg-dark-900 rounded-lg border border-dark-800 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Components</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-dark-950 border-b border-dark-800">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Component</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Location</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Quantity</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Lot/Batch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.components && batch.components.map((component) => (
                      <tr key={component.component_id} className="border-b border-dark-800">
                        <td className="py-3 px-4">
                          <p className="text-white font-medium">{component.component_name}</p>
                          <p className="text-xs text-gray-500">{component.sku}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-white">{component.location_code}</p>
                          <p className="text-xs text-gray-500">{component.location_name}</p>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <p className="text-white">{component.quantity_assigned?.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">({component.quantity_required} per unit)</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-300 capitalize">{component.material_status}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-300">{component.supplier_batch_lot || 'N/A'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* QA Gates */}
            <div className="bg-dark-900 rounded-lg border border-dark-800 p-6">
              <h2 className="text-xl font-bold text-white mb-4">QA Gates</h2>
              <div className="space-y-4">
                {batch.qa_gates && batch.qa_gates.length > 0 ? (
                  batch.qa_gates.map((gate) => (
                    <div
                      key={gate.gate_id}
                      className="flex items-center justify-between p-4 bg-dark-950 rounded-lg border border-dark-800"
                    >
                      <div className="flex items-center gap-4">
                        {getGateStatusIcon(gate.status)}
                        <div>
                          <p className="text-white font-medium">Gate {gate.gate_number}: {gate.gate_name}</p>
                          {gate.approved_by_name && (
                            <p className="text-sm text-gray-400">
                              {gate.status === 'approved' ? 'Approved' : 'Rejected'} by {gate.approved_by_name}
                              {gate.approved_at && ` on ${formatDateTime(gate.approved_at)}`}
                            </p>
                          )}
                          {gate.rejection_reason && (
                            <p className="text-sm text-red-400 mt-1">{gate.rejection_reason}</p>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        gate.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                        gate.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                        'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {gate.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-center py-4">No QA gates recorded yet</p>
                )}
              </div>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-dark-900 rounded-lg border border-dark-800 p-6">
                <h3 className="text-lg font-bold text-white mb-3">Production Line</h3>
                <p className="text-white">{batch.production_line}</p>
                {batch.line_supervisor_name && (
                  <p className="text-sm text-gray-400 mt-2">
                    Supervisor: {batch.line_supervisor_name}
                  </p>
                )}
              </div>

              <div className="bg-dark-900 rounded-lg border border-dark-800 p-6">
                <h3 className="text-lg font-bold text-white mb-3">Records</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">IPQC Checks:</span>
                    <span className="text-white">{batch.ipqc_count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Deviations:</span>
                    <span className="text-white">{batch.deviation_count || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
