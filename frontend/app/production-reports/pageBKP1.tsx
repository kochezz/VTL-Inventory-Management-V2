'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  Package,
  AlertCircle,
  BarChart3,
  FilePdf,
  Eye,
  RefreshCw,
  Factory,
  ClipboardCheck,
  Users,
  Clock
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface BatchSummary {
  batch_id: string;
  batch_number: string;
  batch_record_code: string;
  product_name: string;
  sku: string;
  planned_quantity: number;
  actual_quantity: number;
  status: string;
  production_date: string;
  created_at: string;
  completed_at: string;
  line_name: string;
  stages_completed: number;
  stages_required: number;
}

interface ReportPreview {
  batch: any;
  components: any[];
  ipqc_records: any[];
  qa_gates: any[];
  completion: any;
  generated_at: string;
}

export default function ProductionReportsPage() {
  const router = useRouter();
  const { isAuthenticated, token, isLoading: authLoading } = useAuth();
  
  const [selectedReport, setSelectedReport] = useState('batch-production');
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [reportPreview, setReportPreview] = useState<ReportPreview | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    product_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchBatches();
    }
  }, [isAuthenticated, token]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const fetchBatches = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.get(`${API_URL}/production/reports/batches`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filters
      });
      
      setBatches(response.data.batches);
    } catch (err: any) {
      console.error('Error fetching batches:', err);
      setError(err.response?.data?.message || 'Failed to fetch batches');
    } finally {
      setLoading(false);
    }
  };

  const fetchReportPreview = async (batchId: string) => {
    try {
      setPreviewLoading(true);
      setError('');
      
      const response = await axios.get(
        `${API_URL}/production/reports/batch/${batchId}/preview`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setReportPreview(response.data.report);
    } catch (err: any) {
      console.error('Error fetching report preview:', err);
      setError(err.response?.data?.message || 'Failed to fetch report preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadPDF = async (batchId: string) => {
    try {
      setError('');
      
      const response = await axios.get(
        `${API_URL}/production/reports/batch/${batchId}/pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const batch = batches.find(b => b.batch_id === batchId);
      link.setAttribute('download', `Production_Report_${batch?.batch_number || batchId}_${Date.now()}.pdf`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      console.error('Error downloading PDF:', err);
      setError(err.response?.data?.message || 'Failed to download PDF');
    }
  };

  const handleBatchSelect = (batchId: string) => {
    setSelectedBatch(batchId);
    fetchReportPreview(batchId);
  };

  const reportTypes = [
    {
      id: 'batch-production',
      name: 'Batch Production Report',
      description: 'Comprehensive production record with IPQC stages and QA approvals',
      icon: FileText,
      color: 'blue'
    },
    {
      id: 'production-summary',
      name: 'Production Summary',
      description: 'Overview of all production batches and metrics',
      icon: BarChart3,
      color: 'purple'
    },
    {
      id: 'quality-summary',
      name: 'Quality Summary',
      description: 'QA gates and IPQC compliance report',
      icon: ClipboardCheck,
      color: 'green'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'in_progress':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'pending':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'draft':
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Production Reports</h1>
            <p className="text-gray-400 mt-1">Generate and download production documentation</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchBatches}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Type Selection */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold text-white">Report Types</h2>
            {reportTypes.map((report) => {
              const Icon = report.icon;
              return (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    selectedReport === report.id
                      ? 'bg-primary-500/10 border-primary-500'
                      : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-6 h-6 text-${report.color}-400 flex-shrink-0`} />
                    <div>
                      <h3 className="font-semibold text-white text-sm">{report.name}</h3>
                      <p className="text-gray-400 text-xs mt-1">{report.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Filters */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </h3>
              
              <div>
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm"
                />
              </div>

              <button
                onClick={fetchBatches}
                className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm"
              >
                Apply Filters
              </button>
            </div>
          </div>

          {/* Batch List & Preview */}
          <div className="lg:col-span-2 space-y-4">
            {selectedReport === 'batch-production' && (
              <>
                <h2 className="text-lg font-semibold text-white">Select Batch</h2>
                
                {loading ? (
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 text-center">
                    <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-2" />
                    <p className="text-gray-400">Loading batches...</p>
                  </div>
                ) : batches.length === 0 ? (
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 text-center">
                    <Package className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400">No batches found</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {batches.map((batch) => (
                      <div
                        key={batch.batch_id}
                        className={`bg-dark-800 border rounded-xl p-4 transition-all cursor-pointer ${
                          selectedBatch === batch.batch_id
                            ? 'border-primary-500 bg-primary-500/5'
                            : 'border-dark-700 hover:border-dark-600'
                        }`}
                        onClick={() => handleBatchSelect(batch.batch_id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-white">{batch.batch_number}</h3>
                            <p className="text-sm text-gray-400">{batch.product_name}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(batch.status)}`}>
                            {batch.status.replace('_', ' ')}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-500">Production Date:</span>
                            <p className="text-gray-300">{new Date(batch.production_date).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Quantity:</span>
                            <p className="text-gray-300">{batch.actual_quantity || batch.planned_quantity}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Line:</span>
                            <p className="text-gray-300">{batch.line_name || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">IPQC Stages:</span>
                            <p className="text-gray-300">{batch.stages_completed || 0}/{batch.stages_required || 0}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadPDF(batch.batch_id);
                            }}
                            className="flex-1 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            Download PDF
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBatchSelect(batch.batch_id);
                            }}
                            className="flex-1 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            Preview
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Report Preview */}
                {reportPreview && (
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 mt-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-primary-400" />
                      Report Preview
                    </h3>

                    {previewLoading ? (
                      <div className="text-center py-8">
                        <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-2" />
                        <p className="text-gray-400">Loading preview...</p>
                      </div>
                    ) : (
                      <div className="space-y-4 text-sm">
                        {/* Batch Info */}
                        <div>
                          <h4 className="font-semibold text-white mb-2">Batch Information</h4>
                          <div className="bg-dark-700 rounded-lg p-3 space-y-1">
                            <p className="text-gray-300">Batch: <span className="text-white font-medium">{reportPreview.batch.batch_number}</span></p>
                            <p className="text-gray-300">Product: <span className="text-white">{reportPreview.batch.product_name}</span></p>
                            <p className="text-gray-300">Status: <span className="text-white capitalize">{reportPreview.batch.status.replace('_', ' ')}</span></p>
                          </div>
                        </div>

                        {/* Components */}
                        {reportPreview.components.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-white mb-2">Components ({reportPreview.components.length})</h4>
                            <div className="bg-dark-700 rounded-lg p-3">
                              {reportPreview.components.map((comp, idx) => (
                                <div key={idx} className="text-gray-300 py-1">
                                  • {comp.product_name} - Required: {comp.quantity_required} {comp.unit}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* IPQC Records */}
                        {reportPreview.ipqc_records.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-white mb-2">IPQC Stages ({reportPreview.ipqc_records.length})</h4>
                            <div className="bg-dark-700 rounded-lg p-3 space-y-2">
                              {reportPreview.ipqc_records.map((ipqc, idx) => (
                                <div key={idx} className="border-l-2 border-primary-500 pl-3">
                                  <p className="text-white font-medium">Stage {ipqc.stage_sequence}: {ipqc.stage_name}</p>
                                  <p className="text-gray-400 text-xs">Status: {ipqc.qa_status || 'Pending'}</p>
                                  {ipqc.qa_reviewer_name && (
                                    <p className="text-gray-400 text-xs">QA: {ipqc.qa_reviewer_name}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* QA Gates */}
                        {reportPreview.qa_gates.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-white mb-2">QA Gates ({reportPreview.qa_gates.length})</h4>
                            <div className="bg-dark-700 rounded-lg p-3 space-y-2">
                              {reportPreview.qa_gates.map((gate, idx) => (
                                <div key={idx} className="text-gray-300">
                                  Gate {gate.gate_number}: {gate.gate_name} - {gate.status || 'Pending'}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
