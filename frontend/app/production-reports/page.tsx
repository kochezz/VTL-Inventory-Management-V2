'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  FileText,
  Download,
  Filter,
  Package,
  AlertCircle,
  BarChart3,
  Eye,
  RefreshCw,
  Factory,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Activity,
  ShieldCheck,
  AlertOctagon,
  Clock,
  XCircle,
  CheckCircle2,
  MapPin
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface BatchSummary {
  batch_id: string;
  batch_number: string;
  batch_record_code: string;
  product_name: string;
  pack_size: string;              
  product_category: string;       
  planned_quantity: number;
  actual_output: number;          
  rejected_bottles: number;       
  yield_percentage: number;       
  status: string;
  production_date: string;
  production_line: string;        
  shift: string;                  
  line_supervisor_name: string;   
  qa_manager_name: string;        
  created_at: string;
  production_started_at: string;  
  production_completed_at: string;
  qa_released_at: string;         
  stages_completed: number;
  stages_required: number;
  all_stages_approved: boolean;   
  qa_released: boolean;           
  has_deviations: boolean;
  storage_locations?: string; // Newly added field
}

interface ReportPreview {
  batch: any;
  components: any[];
  ipqc_records: any[];
  qa_gates: any[];
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

  // Memoized Production Summary Calculations
  const summaryStats = useMemo(() => {
    const total = batches.length;
    const planned = batches.reduce((sum, b) => sum + (b.planned_quantity || 0), 0);
    const output = batches.reduce((sum, b) => sum + (b.actual_output || 0), 0);
    const rejected = batches.reduce((sum, b) => sum + (b.rejected_bottles || 0), 0);
    
    const batchesWithYield = batches.filter(b => b.yield_percentage !== null && b.yield_percentage !== undefined);
    const avgYield = batchesWithYield.length > 0 
      ? (batchesWithYield.reduce((sum, b) => sum + parseFloat(b.yield_percentage as unknown as string), 0) / batchesWithYield.length).toFixed(1)
      : '0.0';

    const byStatus = batches.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Upgraded to extract storage locations and average yields per product
    const byProduct = batches.reduce((acc, b) => {
      const name = b.product_name || 'Unknown Product';
      if (!acc[name]) acc[name] = { count: 0, output: 0, locations: new Set<string>(), yieldSum: 0, yieldCount: 0 };
      
      acc[name].count += 1;
      acc[name].output += (b.actual_output || 0);
      
      if (b.storage_locations) {
         b.storage_locations.split(', ').forEach(loc => acc[name].locations.add(loc));
      }
      
      if (b.yield_percentage !== null && b.yield_percentage !== undefined) {
         acc[name].yieldSum += parseFloat(b.yield_percentage as unknown as string);
         acc[name].yieldCount += 1;
      }
      return acc;
    }, {} as Record<string, { count: number, output: number, locations: Set<string>, yieldSum: number, yieldCount: number }>);

    return { total, planned, output, rejected, avgYield, byStatus, byProduct };
  }, [batches]);

  // Memoized Quality Summary Calculations
  const qualityStats = useMemo(() => {
    const total = batches.length;
    if (total === 0) return { complianceRate: '0.0', deviations: 0, rejectedBatches: 0, pendingQA: 0, attentionNeeded: [], deviationLog: [] };

    const released = batches.filter(b => b.status === 'released').length;
    const complianceRate = ((released / total) * 100).toFixed(1);
    const deviations = batches.filter(b => b.has_deviations).length;
    const rejectedBatches = batches.filter(b => b.status === 'rejected').length;
    
    // Batches waiting for QA (Completed production, awaiting final release, or awaiting pre-prod QA)
    const pendingQA = batches.filter(b => ['completed', 'awaiting_qa'].includes(b.status)).length;
    const attentionNeeded = batches.filter(b => ['completed', 'awaiting_qa'].includes(b.status));
    
    // Any batch with deviations or physical rejections
    const deviationLog = batches.filter(b => b.has_deviations || (b.rejected_bottles && b.rejected_bottles > 0));

    return { complianceRate, deviations, rejectedBatches, pendingQA, attentionNeeded, deviationLog };
  }, [batches]);

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
      case 'completed': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'released': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'in_progress': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'pending': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'awaiting_qa': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'draft': return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
      case 'rejected': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
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

        {/* Layout */}
        <div className="flex flex-col lg:flex-row gap-6 w-full">
          
          {/* Left Sidebar (Filters & Navigation) */}
          <div className="w-full lg:w-[320px] shrink-0 space-y-4">
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
                  <option value="awaiting_qa">Awaiting QA</option>
                  <option value="ready_for_setup">Ready for Setup</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="released">Released</option>
                  <option value="rejected">Rejected</option>
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
                className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-medium mt-2"
              >
                Apply Filters
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="w-full flex-1 space-y-4">
            
            {/* 1. BATCH PRODUCTION REPORT */}
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
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
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
                        
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs mt-4">
                          <div>
                            <span className="text-gray-500 block mb-1">Production Date</span>
                            <p className="text-gray-300 font-medium">{new Date(batch.production_date).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 block mb-1">Output / Planned</span>
                            <p className="text-gray-300 font-medium">{batch.actual_output || 0} / {batch.planned_quantity}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 block mb-1">Yield</span>
                            <p className={`font-medium ${parseFloat(String(batch.yield_percentage || 100)) >= 95 ? 'text-green-400' : 'text-yellow-400'}`}>
                              {batch.yield_percentage || 100}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500 block mb-1">IPQC Stages</span>
                            <p className="text-gray-300 font-medium">{batch.stages_completed || 0}/{batch.stages_required || 6}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2 pt-3 border-t border-dark-700/50">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadPDF(batch.batch_id);
                            }}
                            className="flex-1 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs flex items-center justify-center gap-2 transition-colors font-medium"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download PDF
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBatchSelect(batch.batch_id);
                            }}
                            className="flex-1 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-xs flex items-center justify-center gap-2 transition-colors font-medium"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Preview
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Report Preview Panel */}
                {reportPreview && (
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 mt-6 shadow-lg">
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
                      <div className="space-y-6 text-sm">
                        
                        <div className="bg-dark-900 border border-dark-700 rounded-lg p-4">
                          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            Batch Information
                          </h4>
                          <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                            <div className="flex justify-between border-b border-dark-700/50 pb-1">
                              <span className="text-gray-400">Batch Number:</span>
                              <span className="text-white font-medium">{reportPreview.batch.batch_number}</span>
                            </div>
                            <div className="flex justify-between border-b border-dark-700/50 pb-1">
                              <span className="text-gray-400">Status:</span>
                              <span className={`capitalize font-medium ${
                                reportPreview.batch.status === 'released' ? 'text-purple-400' : 'text-green-400'
                              }`}>{reportPreview.batch.status.replace('_', ' ')}</span>
                            </div>
                            <div className="flex justify-between border-b border-dark-700/50 pb-1 col-span-2">
                              <span className="text-gray-400">Product:</span>
                              <span className="text-white">{reportPreview.batch.product_name}</span>
                            </div>
                          </div>
                        </div>

                        {reportPreview.components.length > 0 && (
                          <div className="bg-dark-900 border border-dark-700 rounded-lg p-4">
                            <h4 className="font-semibold text-white mb-3">Components ({reportPreview.components.length})</h4>
                            <div className="space-y-2">
                              {reportPreview.components.map((comp, idx) => (
                                <div key={idx} className="flex justify-between items-center text-gray-300 bg-dark-800 px-3 py-2 rounded">
                                  <span>{comp.component_name || comp.product_name}</span>
                                  <span className="font-medium text-white">Consumed: {comp.actual_consumed || 0}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {reportPreview.ipqc_records.length > 0 && (
                          <div className="bg-dark-900 border border-dark-700 rounded-lg p-4">
                            <h4 className="font-semibold text-white mb-3">IPQC Stages ({reportPreview.ipqc_records.length})</h4>
                            <div className="space-y-3">
                              {reportPreview.ipqc_records.map((ipqc, idx) => (
                                <div key={idx} className="border-l-2 border-primary-500 pl-3 bg-dark-800/50 py-2 pr-3 rounded-r">
                                  <p className="text-white font-medium mb-1">Stage {ipqc.stage_sequence || ''}: {ipqc.stage_name}</p>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Status: <span className={ipqc.qa_status.includes('approved') ? 'text-green-400' : 'text-yellow-400'}>{ipqc.qa_status.replace('_', ' ')}</span></span>
                                    {ipqc.qa_reviewed_by_name && <span className="text-gray-400">QA: {ipqc.qa_reviewed_by_name}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {reportPreview.qa_gates.length > 0 && (
                          <div className="bg-dark-900 border border-dark-700 rounded-lg p-4">
                            <h4 className="font-semibold text-white mb-3">QA Gates ({reportPreview.qa_gates.length})</h4>
                            <div className="space-y-2">
                              {reportPreview.qa_gates.map((gate, idx) => (
                                <div key={idx} className="flex justify-between items-center text-gray-300 bg-dark-800 px-3 py-2 rounded">
                                  <span>Gate {gate.gate_number}: {gate.gate_name}</span>
                                  <span className={`text-xs font-medium px-2 py-1 rounded bg-dark-900 border ${
                                    gate.status === 'approved' ? 'text-green-400 border-green-500/20' : 'text-yellow-400 border-yellow-500/20'
                                  }`}>{gate.status || 'Pending'}</span>
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

            {/* 2. PRODUCTION SUMMARY REPORT */}
            {selectedReport === 'production-summary' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-white">Production Summary</h2>
                  <p className="text-sm text-gray-400">Based on current filters</p>
                </div>
                
                {/* Top Metrics Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                        <Package className="w-5 h-5" />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">Total Batches</p>
                    </div>
                    <p className="text-3xl font-bold text-white">{summaryStats.total}</p>
                  </div>
                  
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
                        <Factory className="w-5 h-5" />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">Total Output</p>
                    </div>
                    <p className="text-3xl font-bold text-white">{summaryStats.output.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Planned: {summaryStats.planned.toLocaleString()}</p>
                  </div>
                  
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">Avg. Yield</p>
                    </div>
                    <p className="text-3xl font-bold text-white">{summaryStats.avgYield}%</p>
                  </div>

                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                        <TrendingDown className="w-5 h-5" />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">Total Rejected</p>
                    </div>
                    <p className="text-3xl font-bold text-red-400">{summaryStats.rejected.toLocaleString()}</p>
                  </div>
                </div>

                {/* Breakdowns Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Status Breakdown */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-gray-400" />
                      Batches by Status
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(summaryStats.byStatus).map(([status, count]) => (
                        <div key={status}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300 capitalize">{status.replace('_', ' ')}</span>
                            <span className="text-white font-medium">{count}</span>
                          </div>
                          <div className="w-full bg-dark-900 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                status === 'released' ? 'bg-purple-500' :
                                status === 'completed' ? 'bg-green-500' :
                                status === 'in_progress' ? 'bg-blue-500' :
                                status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'
                              }`} 
                              style={{ width: `${(count / summaryStats.total) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                      {Object.keys(summaryStats.byStatus).length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">No data available for selected filters</p>
                      )}
                    </div>
                  </div>

                  {/* Product Output Breakdown */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-gray-400" />
                      Output by Product
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(summaryStats.byProduct).map(([product, data]) => (
                        <div key={product} className="bg-dark-900 border border-dark-700 rounded-lg p-3">
                          <p className="text-sm font-medium text-white mb-2 truncate">{product}</p>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Batches: <span className="text-white">{data.count}</span></span>
                            <span className="text-gray-400">Output: <span className="text-green-400 font-medium">{data.output.toLocaleString()}</span> units</span>
                          </div>
                        </div>
                      ))}
                      {Object.keys(summaryStats.byProduct).length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">No data available for selected filters</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* NEW: Product Traceability & Storage Locations */}
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-400" />
                    Product Traceability & Storage Locations
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-dark-900/50 border-b border-dark-700">
                        <tr>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Product Name</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Batches Produced</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Total Output</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Avg Yield</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Current Storage Location(s)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700/50">
                        {Object.entries(summaryStats.byProduct).map(([product, data]) => (
                          <tr key={product} className="hover:bg-dark-700/30 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-white">{product}</td>
                            <td className="px-4 py-3 text-sm text-gray-300">{data.count}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-green-400">{data.output.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-gray-300">
                              {data.yieldCount > 0 ? (data.yieldSum / data.yieldCount).toFixed(1) + '%' : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300">
                              {data.locations.size > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {Array.from(data.locations).map((loc, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-xs font-medium">
                                      {loc}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-500 italic">No storage data currently available</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {Object.keys(summaryStats.byProduct).length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                              No data available for selected filters
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* 3. QUALITY SUMMARY REPORT */}
            {selectedReport === 'quality-summary' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-white">Quality & Compliance Summary</h2>
                  <p className="text-sm text-gray-400">Based on current filters</p>
                </div>
                
                {/* Top Quality Metrics Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">Compliance Rate</p>
                    </div>
                    <p className="text-3xl font-bold text-white">{qualityStats.complianceRate}%</p>
                    <p className="text-xs text-gray-500 mt-1">Released vs Total Batches</p>
                  </div>
                  
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400">
                        <Clock className="w-5 h-5" />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">Pending QA Review</p>
                    </div>
                    <p className="text-3xl font-bold text-white">{qualityStats.pendingQA}</p>
                    <p className="text-xs text-gray-500 mt-1">Batches awaiting QA action</p>
                  </div>
                  
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
                        <AlertOctagon className="w-5 h-5" />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">Deviations</p>
                    </div>
                    <p className="text-3xl font-bold text-white">{qualityStats.deviations}</p>
                    <p className="text-xs text-gray-500 mt-1">Batches with logged deviations</p>
                  </div>

                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                        <XCircle className="w-5 h-5" />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">Rejected Batches</p>
                    </div>
                    <p className="text-3xl font-bold text-red-400">{qualityStats.rejectedBatches}</p>
                    <p className="text-xs text-gray-500 mt-1">Failed final release</p>
                  </div>
                </div>

                {/* Detailed Logs Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* QA Attention Needed List */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-400" />
                      Requires QA Attention
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {qualityStats.attentionNeeded.length > 0 ? (
                        qualityStats.attentionNeeded.map(batch => (
                          <div key={batch.batch_id} className="bg-dark-900 border border-dark-700 rounded-lg p-4 hover:border-yellow-500/50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="text-white font-medium">{batch.batch_number}</p>
                                <p className="text-xs text-gray-400">{batch.product_name}</p>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                batch.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                              }`}>
                                {batch.status === 'completed' ? 'Awaiting Release' : 'Awaiting QA'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-dark-700">
                              <span className="text-xs text-gray-500">Date: {new Date(batch.production_date).toLocaleDateString()}</span>
                              <button 
                                onClick={() => router.push(`/production/${batch.batch_id}`)}
                                className="text-xs text-primary-400 hover:text-primary-300 font-medium"
                              >
                                Review Batch →
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <ShieldCheck className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-400 font-medium">All Caught Up!</p>
                          <p className="text-sm text-gray-500">No batches currently waiting for QA approval.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Deviation & Rejection Log */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <AlertOctagon className="w-5 h-5 text-orange-400" />
                      Deviation & Rejection Log
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {qualityStats.deviationLog.length > 0 ? (
                        qualityStats.deviationLog.map(batch => (
                          <div key={batch.batch_id} className="bg-dark-900 border border-dark-700 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="text-white font-medium">{batch.batch_number}</p>
                                <p className="text-xs text-gray-400">{batch.product_name}</p>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                batch.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-orange-500/10 text-orange-400'
                              }`}>
                                {batch.status === 'rejected' ? 'Rejected' : 'Deviations Logged'}
                              </span>
                            </div>
                            <div className="mt-3 pt-3 border-t border-dark-700 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">Rejected Bottles:</span>
                                <p className="text-white font-medium">{batch.rejected_bottles || 0} units</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Yield:</span>
                                <p className={`font-medium ${parseFloat(String(batch.yield_percentage || 100)) >= 95 ? 'text-green-400' : 'text-red-400'}`}>
                                  {batch.yield_percentage || 100}%
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <CheckCircle2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-400 font-medium">No Deviations</p>
                          <p className="text-sm text-gray-500">No rejections or deviations in this period.</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}