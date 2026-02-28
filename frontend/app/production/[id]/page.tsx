'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import axios from 'axios';
import { 
  ArrowLeft, Package, Calendar, User, MapPin, CheckCircle2, 
  XCircle, Clock, PlayCircle, StopCircle, AlertCircle, FileText,
  TrendingUp, Activity, CheckCircle, Printer
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CompleteProductionModal, { ProductionCompletionData } from '@/components/production/CompleteProductionModal';
import IPQCCheckModal from '@/components/production/IPQCCheckModal';
import IPQCReviewModal from '@/components/production/IPQCReviewModal';
import MultiStageIPQCModal from '@/components/production/MultiStageIPQCModal';
import FinalReleaseModal from '@/components/production/FinalReleaseModal';
import RaiseNCRModal from '@/components/qms/RaiseNCRModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Component {
  component_id: string;
  component_name: string;
  sku: string;
  quantity_assigned: number;
  quantity_required?: number;
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
  ipqc_checks?: any[];
  deviation_count: number;
}

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, token, loading: authLoading } = useAuth();
  
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showFinalReleaseModal, setShowFinalReleaseModal] = useState(false);
  const [selectedGate, setSelectedGate] = useState<QAGate | null>(null);
  
  // IPQC state
  const [showIPQCModal, setShowIPQCModal] = useState(false); // Kept for legacy/fallback
  const [showQAReviewModal, setShowQAReviewModal] = useState(false);
  const [selectedIPQCId, setSelectedIPQCId] = useState<string | null>(null);

  // Multi-Stage IPQC State
  const [nextStage, setNextStage] = useState<any>(null);
  const [recordCompletion, setRecordCompletion] = useState<any>(null);
  const [showMultiStageModal, setShowMultiStageModal] = useState(false);

  // Helper variables - computed from batch data
  const ipqcChecks = batch?.ipqc_checks || [];
  const draftChecks = ipqcChecks.filter((c: any) => c.qa_status === 'draft_check');
  const pendingChecks = ipqcChecks.filter((c: any) => c.qa_status === 'pending_qa_review');
  const approvedChecks = ipqcChecks.filter((c: any) => c.qa_status === 'qa_approved');
  const rejectedChecks = ipqcChecks.filter((c: any) => c.qa_status === 'qa_rejected');

  useEffect(() => {
    if (isAuthenticated && token && params.id) {
      fetchBatchDetails();
    }
  }, [isAuthenticated, token, params.id]);

  // Fetch Multi-Stage Data when batch is loaded
  useEffect(() => {
    if (batch?.batch_id && batch.status === 'in_progress' && token) {
      fetchNextStage();
      fetchRecordCompletion();
    }
  }, [batch?.batch_id, batch?.status, token]);

  // Global 401 error handler
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && !authLoading && isAuthenticated === false) {
          localStorage.removeItem('token');
          router.push('/login');
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [router, authLoading, isAuthenticated]);

  const fetchBatchDetails = async () => {
    try {
      setLoading(true);
      if (!token) return;
      
      const response = await axios.get(
        `${API_URL}/production/batches/${params.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBatch(response.data.batch);
    } catch (err: any) {
      if (err.response?.status !== 401) {
        setError(err.response?.data?.message || 'Failed to load batch details');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchNextStage = async () => {
    if (!batch?.batch_id || !token) return;
    
    try {
      const response = await axios.get(
        `${API_URL}/production/batches/${batch.batch_id}/ipqc/next-stage`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNextStage(response.data);
    } catch (error) {
      // proper error handling would go here
    }
  };
  
  const fetchRecordCompletion = async () => {
    if (!batch?.batch_id || !token) return;
    
    try {
      const response = await axios.get(
        `${API_URL}/production/batches/${batch.batch_id}/batch-record/completion`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRecordCompletion(response.data.completion);
    } catch (error) {
      // proper error handling would go here
    }
  };

  const handleOpenQAReview = (ipqcId: string) => {
     setSelectedIPQCId(ipqcId);
     setShowQAReviewModal(true);
   };
   
   const handleQAReviewSuccess = () => {
     fetchBatchDetails();
     fetchRecordCompletion(); // Update progress on QA action
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
        case 'start_production':
          endpoint = `/production/batches/${params.id}/start`;
          break;
        case 'complete_production':
          setShowCompleteModal(true);
          return;
      }

      await axios.post(
        `${API_URL}${endpoint}`,
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await fetchBatchDetails();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQAApproval = async (batchId: string, gateId: string, action: 'approve' | 'reject', locationId?: string) => {
    try {
      setActionLoading(true);
      setError('');

      const endpoint = action === 'approve' 
        ? `/production/batches/${batchId}/qa-gates/${gateId}/approve`
        : `/production/batches/${batchId}/qa-gates/${gateId}/reject`;

      const data: any = action === 'reject' 
        ? { reason: 'Rejected during QA review' }
        : {};

      if (locationId) {
        data.location_id = locationId;
      }

      await axios.post(
        `${API_URL}${endpoint}`,
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await fetchBatchDetails();
    } catch (err: any) {
      setError(err.response?.data?.message || 'QA action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteProduction = async (completionData: ProductionCompletionData) => {
    try {
      setActionLoading(true);
      setError('');
      
      await axios.post(
        `${API_URL}/production/batches/${params.id}/complete`,
        completionData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowCompleteModal(false);
      await fetchBatchDetails();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete production');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!batch) return null;

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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{batch.batch_number}</h1>
              <p className="text-gray-400 text-sm mt-1">{batch.batch_record_code}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* LAB REPORT VIEW BUTTON (Shows if Lab Report is attached to any IPQC Check) */}
            {batch.ipqc_checks?.some((c: any) => c.lab_report_data) && (
              <button
                onClick={() => {
                  const checkWithReport = batch.ipqc_checks.find((c: any) => c.lab_report_data);
                  if (checkWithReport) {
                    try {
                      // Convert Base64 to Blob for native browser rendering
                      const base64Data = checkWithReport.lab_report_data;
                      const arr = base64Data.split(',');
                      const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
                      const bstr = atob(arr[1]);
                      let n = bstr.length;
                      const u8arr = new Uint8Array(n);
                      while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                      }
                      const blob = new Blob([u8arr], { type: mime });
                      const url = URL.createObjectURL(blob);
                      
                      // Open the Blob URL in a new tab
                      window.open(url, '_blank');
                    } catch (error) {
                      console.error('Failed to open document:', error);
                      alert('Could not open the document. The file might be corrupted.');
                    }
                  }
                }}
                className="px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg text-sm font-medium transition-colors border border-blue-500/30 flex items-center gap-2 whitespace-nowrap"
              >
                <FileText className="w-4 h-4" /> View Lab Report
              </button>
            )}

            {/* PRINT PICK LIST BUTTON */}
            {(batch.status === 'ready_for_setup' || batch.status === 'in_progress') && (
              <button
                onClick={() => window.open(`/production/${batch.batch_id}/pick-list`, '_blank')}
                className="px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-600 text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Printer className="w-4 h-4" /> Pick List
              </button>
            )}

            {/* GENERATE COA BUTTON */}
            {batch.status === 'released' && (
              <button
                onClick={() => window.open(`/production/${batch.batch_id}/coa`, '_blank')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors shadow-lg flex items-center gap-2 whitespace-nowrap"
              >
                <FileText className="w-4 h-4" /> Generate COA
              </button>
            )}

            {/* STATUS BADGE - FIXED WRAPPING */}
            <div className={`px-4 py-2 rounded-full border whitespace-nowrap ${getStatusColor(batch.status)}`}>
              <span className="text-sm font-semibold uppercase tracking-wide">
                {batch.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400">{error}</p>
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
                  <p className="text-white font-medium">{batch.product_name || 'Product name unavailable'}</p>
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
                    <div key={gate.gate_id} className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-500/10 text-primary-400 font-bold">
                          {gate.gate_number}
                        </div>
                        <div>
                          <p className="text-white font-medium">{gate.gate_name}</p>
                          {gate.approved_by_name && (
                            <p className="text-sm text-gray-400">Approved by {gate.approved_by_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {gate.status === 'approved' && (
                          <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Approved
                          </span>
                        )}
                        {gate.status === 'rejected' && (
                          <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-sm font-medium flex items-center gap-1">
                            <XCircle className="w-4 h-4" /> Rejected
                          </span>
                        )}
                        {gate.status === 'pending' && (
                          <>
                            <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-full text-sm font-medium flex items-center gap-1">
                              <Clock className="w-4 h-4" /> Pending
                            </span>
                            <button
                              onClick={() => {
                                // Check if this is Final Release gate (gate 4)
                                if (gate.gate_number === 4 || gate.gate_name === 'Final Release') {
                                  // Open comprehensive modal for final release
                                  setSelectedGate(gate);
                                  setShowFinalReleaseModal(true);
                                } else {
                                  // For other gates, approve directly
                                  handleQAApproval(batch.batch_id, gate.gate_id, 'approve');
                                }
                              }}
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
                {batch.components.map((component) => {
                  // Calculate actual usage based on actual output (if available)
                  const actualUsed = batch.actual_output && component.quantity_required
                    ? Math.ceil(component.quantity_required * batch.actual_output * 1.05) // With 5% buffer
                    : component.quantity_assigned;
                  
                  const isCompleted = batch.status === 'completed' || batch.status === 'released';
                  
                  return (
                    <div key={component.component_id} className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700">
                      <div>
                        <p className="text-white font-medium">{component.component_name}</p>
                        <p className="text-sm text-gray-400 font-mono">{component.sku}</p>
                        <p className="text-xs text-gray-500 mt-1">{component.location_code} - {component.location_name}</p>
                      </div>
                      <div className="text-right">
                        {/* Show actual usage if batch is completed */}
                        {isCompleted && batch.actual_output ? (
                          <>
                            <p className="text-white font-semibold">{actualUsed.toLocaleString()} units</p>
                            <p className="text-xs text-gray-500">
                              Assigned: {component.quantity_assigned.toLocaleString()}
                            </p>
                          </>
                        ) : (
                          <p className="text-white font-semibold">{component.quantity_assigned.toLocaleString()} units</p>
                        )}
                        <p className="text-sm text-gray-400">{component.material_status}</p>
                        {component.supplier_batch_lot && (
                          <p className="text-xs text-gray-500 mt-1">Lot: {component.supplier_batch_lot}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* IPQC Records */}
            {batch.status === 'in_progress' && (
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary-500" />
                  In-Process Quality Checks (IPQC)
                </h2>
                
                {/* Updated Header Button - Triggers MultiStage Modal if valid */}
                {nextStage && !nextStage.all_stages_complete ? (
                   <button
                   onClick={() => setShowMultiStageModal(true)}
                   className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                 >
                   <FileText className="w-4 h-4" />
                   Record Check
                 </button>
                ) : null}
              </div>

              {/* IPQC Statistics */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-dark-900 rounded-lg border border-dark-700">
                  <p className="text-sm text-gray-400">Draft</p>
                  <p className="text-2xl font-bold text-blue-400">{draftChecks.length}</p>
                </div>
                <div className="p-4 bg-dark-900 rounded-lg border border-dark-700">
                  <p className="text-sm text-gray-400">Pending QA</p>
                  <p className="text-2xl font-bold text-yellow-400">{pendingChecks.length}</p>
                </div>
                <div className="p-4 bg-dark-900 rounded-lg border border-dark-700">
                  <p className="text-sm text-gray-400">Approved</p>
                  <p className="text-2xl font-bold text-green-400">{approvedChecks.length}</p>
                </div>
                <div className="p-4 bg-dark-900 rounded-lg border border-dark-700">
                  <p className="text-sm text-gray-400">Rejected</p>
                  <p className={`text-2xl font-bold ${rejectedChecks.length > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                    {rejectedChecks.length}
                  </p>
                </div>
              </div>

              {/* IPQC History - STAGE AWARE DISPLAY */}
              {ipqcChecks.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {ipqcChecks.map((check: any) => (
                    <div key={check.ipqc_id} className="bg-dark-900 rounded-lg p-4 border border-dark-700 hover:border-primary-500/30 transition-colors">
                      {/* Stage Badge */}
                      {check.stage_name && (
                        <div className="mb-3">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            check.stage_code === 'WATER_TREATMENT' || check.stage_code === 'PRE_PRODUCTION' 
                              ? 'bg-blue-500/20 text-blue-400' :
                            check.stage_code === 'FILLING' || check.stage_code === 'BOTTLE_BLOW'
                              ? 'bg-green-500/20 text-green-400' :
                            check.stage_code === 'CAPPING'
                              ? 'bg-yellow-500/20 text-yellow-400' :
                            check.stage_code === 'LABELING' || check.stage_code === 'WASHING'
                              ? 'bg-purple-500/20 text-purple-400' :
                            'bg-indigo-500/20 text-indigo-400'
                          }`}>
                            Stage {check.stage_sequence}: {check.stage_name}
                          </span>
                        </div>
                      )}

                      {/* Header */}
                      <div className="flex items-center justify-between mb-3 border-b border-dark-700 pb-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 font-bold text-xs">
                            #{check.check_sequence}
                          </div>
                          <div>
                            <span className="text-sm text-white font-medium block">Check #{check.check_sequence}</span>
                            <span className="text-xs text-gray-500 block">
                              {new Date(check.check_time).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          check.qa_status === 'qa_approved' 
                            ? 'bg-green-500/20 text-green-400'
                            : check.qa_status === 'pending_qa_review'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : check.qa_status === 'qa_rejected'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {check.qa_status === 'qa_approved' ? 'QA Approved' :
                           check.qa_status === 'pending_qa_review' ? 'Pending QA' :
                           check.qa_status === 'qa_rejected' ? 'Rejected' : 'Draft'}
                        </span>
                      </div>

                      {/* STAGE-SPECIFIC DETAILS */}
                      <div className="space-y-3 text-sm py-2">
                        {/* Water Treatment / Pre-Production Stage */}
                        {(check.stage_code === 'WATER_TREATMENT' || check.stage_code === 'PRE_PRODUCTION') && (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {check.water_source && (
                              <div className="flex justify-between border-b border-dark-700/50 pb-1">
                                <span className="text-gray-400">Water Source:</span>
                                <span className="text-white">{check.water_source}</span>
                              </div>
                            )}
                            {check.raw_water_ph && (
                              <div className="flex justify-between border-b border-dark-700/50 pb-1">
                                <span className="text-gray-400">Raw Water pH:</span>
                                <span className="text-white">{check.raw_water_ph}</span>
                              </div>
                            )}
                            {check.ro_conductivity && (
                              <div className="flex justify-between border-b border-dark-700/50 pb-1">
                                <span className="text-gray-400">RO Conductivity:</span>
                                <span className="text-white">{check.ro_conductivity} µS/cm</span>
                              </div>
                            )}
                            {check.ozone_residual_ppm !== null && check.ozone_residual_ppm !== undefined && (
                              <div className="flex justify-between border-b border-dark-700/50 pb-1">
                                <span className="text-gray-400">Ozone Residual:</span>
                                <span className="text-white">{check.ozone_residual_ppm} ppm</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Filling Stage */}
                        {(check.stage_code === 'FILLING' && check.fill_volume_ml !== null) && (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div className="flex justify-between border-b border-dark-700/50 pb-1">
                              <span className="text-gray-400">Fill Volume:</span>
                              <span className={`font-semibold ${check.fill_volume_within_spec ? 'text-green-400' : 'text-red-400'}`}>
                                {check.fill_volume_ml} ml
                              </span>
                            </div>
                            {check.fill_pressure && (
                              <div className="flex justify-between border-b border-dark-700/50 pb-1">
                                <span className="text-gray-400">Fill Pressure:</span>
                                <span className="text-white">{check.fill_pressure} MPa</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Capping Stage */}
                        {(check.stage_code === 'CAPPING' && check.cap_torque_nm !== null) && (
                          <div className="flex justify-between border-b border-dark-700/50 pb-1">
                            <span className="text-gray-400">Cap Torque:</span>
                            <span className={`font-semibold ${check.cap_torque_within_spec ? 'text-green-400' : 'text-red-400'}`}>
                              {check.cap_torque_nm} Nm
                            </span>
                          </div>
                        )}

                        {/* Labeling Stage */}
                        {(check.stage_code === 'LABELING') && (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {check.visual_inspection_pass !== null && (
                              <div className="flex justify-between border-b border-dark-700/50 pb-1">
                                <span className="text-gray-400">Visual Inspection:</span>
                                <span className={`flex items-center gap-1 font-semibold ${check.visual_inspection_pass ? 'text-green-400' : 'text-red-400'}`}>
                                  {check.visual_inspection_pass ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  {check.visual_inspection_pass ? 'Pass' : 'Fail'}
                                </span>
                              </div>
                            )}
                            {check.label_position_correct !== null && (
                              <div className="flex justify-between border-b border-dark-700/50 pb-1">
                                <span className="text-gray-400">Label Position:</span>
                                <span className={`flex items-center gap-1 font-semibold ${check.label_position_correct ? 'text-green-400' : 'text-red-400'}`}>
                                  {check.label_position_correct ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  {check.label_position_correct ? 'Correct' : 'Incorrect'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Coding Stage */}
                        {(check.stage_code === 'CODING' && check.coding_legible !== null) && (
                          <div className="flex justify-between border-b border-dark-700/50 pb-1">
                            <span className="text-gray-400">Coding Legible:</span>
                            <span className={`flex items-center gap-1 font-semibold ${check.coding_legible ? 'text-green-400' : 'text-red-400'}`}>
                              {check.coding_legible ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {check.coding_legible ? 'Yes' : 'No'}
                            </span>
                          </div>
                        )}

                        {/* Operator & Notes - Always show */}
                        <div className="flex justify-between pt-1">
                          <span className="text-gray-400">Operator:</span>
                          <span className="text-white flex items-center gap-1">
                            <User className="w-3 h-3 text-gray-400" />
                            {check.operator_name}
                          </span>
                        </div>

                        {check.notes && (
                          <div className="bg-dark-800/50 rounded p-2 text-xs text-gray-300 italic">
                            "{check.notes}"
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {check.qa_status === 'pending_qa_review' && (
                        <button
                          onClick={() => handleOpenQAReview(check.ipqc_id)}
                          className="w-full mt-3 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-primary-500/10"
                        >
                          Review Check
                        </button>
                      )}
                      
                      {(check.qa_status === 'qa_approved' || check.qa_status === 'qa_rejected') && (
                        <button
                          onClick={() => handleOpenQAReview(check.ipqc_id)}
                          className="w-full mt-3 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-base font-medium mb-2">No IPQC checks recorded yet</p>
                </div>
              )}
            </div>
          )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Batch Record Progress - Multi-Stage IPQC */}
            {batch.status === 'in_progress' && recordCompletion && (
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Batch Record Progress</h3>
                  <span className="text-2xl font-bold text-primary-400">
                    {recordCompletion.completion_percentage}%
                  </span>
                </div>
                
                <div className="w-full bg-dark-700 rounded-full h-3 mb-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 via-green-500 to-indigo-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${recordCompletion.completion_percentage}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    {recordCompletion.completed_stages} of {recordCompletion.total_stages} stages completed
                  </span>
                  {recordCompletion.all_stages_complete && (
                    <span className="text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      All Stages Complete
                    </span>
                  )}
                </div>
              </div>
            )}

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
                  <>
                    {/* Submit for QA if there are DRAFT checks */}
                    {draftChecks.length > 0 && (
                      <>
                        <div className="w-full p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-3">
                          <p className="text-blue-400 text-sm font-semibold">
                            {draftChecks.length} IPQC check(s) ready to submit
                          </p>
                        </div>
                        
                        <button
                          onClick={async () => {
                            try {
                              setActionLoading(true);
                              if (!token) return;
                              
                              await axios.post(
                                `${API_URL}/production/batches/${batch.batch_id}/ipqc/submit-for-qa`,
                                {},
                                { headers: { Authorization: `Bearer ${token}` } }
                              );
                              await fetchBatchDetails();
                            } catch (err: any) {
                              setError(err.response?.data?.message || 'Failed to submit IPQC checks');
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          disabled={actionLoading}
                          className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
                        >
                          <FileText className="w-4 h-4" />
                          Submit Check for QA Review
                        </button>
                      </>
                    )}

                    {/* Show alert if there are PENDING QA checks */}
                    {pendingChecks.length > 0 && (
                      <div className="w-full p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-yellow-400 text-sm font-semibold">
                              {pendingChecks.length} IPQC check(s) awaiting QA approval
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Multi-Stage IPQC Button - Dynamic for current stage */}
                    {nextStage && !nextStage.all_stages_complete && (
                      <button
                        onClick={() => setShowMultiStageModal(true)}
                        className={`w-full px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mb-3 ${
                          (nextStage.next_stage.next_stage_code === 'WATER_TREATMENT' || 
                           nextStage.next_stage.next_stage_code === 'PRE_PRODUCTION')
                            ? 'bg-blue-500 hover:bg-blue-600' 
                            : (nextStage.next_stage.next_stage_code === 'BOTTLE_BLOW' ||
                               nextStage.next_stage.next_stage_code === 'WASHING')
                            ? 'bg-purple-500 hover:bg-purple-600'
                            : nextStage.next_stage.next_stage_code === 'FILLING'
                            ? 'bg-green-500 hover:bg-green-600'
                            : nextStage.next_stage.next_stage_code === 'CAPPING'
                            ? 'bg-yellow-500 hover:bg-yellow-600'
                            : nextStage.next_stage.next_stage_code === 'LABELING'
                            ? 'bg-purple-500 hover:bg-purple-600'
                            : 'bg-indigo-500 hover:bg-indigo-600'
                        } text-white`}
                      >
                        {(nextStage.next_stage.next_stage_code === 'WATER_TREATMENT' || 
                          nextStage.next_stage.next_stage_code === 'PRE_PRODUCTION') && '💧'}
                        {(nextStage.next_stage.next_stage_code === 'BOTTLE_BLOW' ||
                          nextStage.next_stage.next_stage_code === 'WASHING') && '👁️'}
                        {nextStage.next_stage.next_stage_code === 'FILLING' && '🚰'}
                        {nextStage.next_stage.next_stage_code === 'CAPPING' && '🔩'}
                        {nextStage.next_stage.next_stage_code === 'LABELING' && '🏷️'}
                        {nextStage.next_stage.next_stage_code === 'CODING' && '🔢'}
                        Record {nextStage.next_stage.next_stage_name}
                      </button>
                    )}

                    {/* All Stages Complete Message */}
                    {nextStage?.all_stages_complete && (
                      <div className="w-full p-3 bg-green-500/10 border border-green-500/30 rounded-lg mb-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          <div>
                            <p className="text-green-400 text-sm font-semibold">All IPQC Stages Complete</p>
                            <p className="text-green-400/70 text-xs">Ready to complete production</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleStatusTransition('complete_production')}
                      disabled={
                        actionLoading || 
                        draftChecks.length > 0 ||
                        pendingChecks.length > 0 ||
                        approvedChecks.length === 0 ||
                        !nextStage?.all_stages_complete
                      }
                      className="w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      title={
                        draftChecks.length > 0 
                          ? 'Submit IPQC checks for QA review first' 
                          : pendingChecks.length > 0
                          ? 'Wait for QA to approve IPQC checks'
                          : approvedChecks.length === 0
                          ? 'At least one IPQC check must be QA approved'
                          : !nextStage?.all_stages_complete
                          ? 'All IPQC stages must be completed'
                          : ''
                      }
                    >
                      <StopCircle className="w-4 h-4" />
                      Complete Production
                    </button>
                    {(draftChecks.length > 0 || pendingChecks.length > 0 || approvedChecks.length === 0 || !nextStage?.all_stages_complete) && (
                      <p className="text-xs text-gray-500 text-center mt-1">
                        {draftChecks.length > 0
                          ? 'Submit IPQC checks for QA review'
                          : pendingChecks.length > 0
                          ? 'Waiting for QA approval'
                          : !nextStage?.all_stages_complete
                          ? 'Complete all IPQC stages'
                          : 'At least one check must be QA approved'}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Stats - Metadata */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-400">Created By</label>
                  <p className="text-white">{batch.created_by_name || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Created At</label>
                  <p className="text-white text-sm">{new Date(batch.created_at).toLocaleString()}</p>
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
            planned_quantity: batch.planned_quantity,
            qa_gates: batch.qa_gates,      
            ipqc_checks: batch.ipqc_checks   
          }}
          onComplete={handleCompleteProduction}
        />
      )}
      
      {/* Old IPQC Modal - Kept as fallback/reference if needed */}
      <IPQCCheckModal
        batchId={params.id as string}
        batchNumber={batch?.batch_number || ''}
        productName={batch?.product_name || ''}
        isOpen={showIPQCModal}
        onClose={() => setShowIPQCModal(false)}
        onSuccess={async () => {
          setShowIPQCModal(false);
          await fetchBatchDetails();
        }}
      />
      
      {/* Multi-Stage IPQC Modal */}
      {showMultiStageModal && nextStage && !nextStage.all_stages_complete && (
        <MultiStageIPQCModal
          isOpen={showMultiStageModal}
          onClose={() => setShowMultiStageModal(false)}
          onSuccess={async () => {
            setShowMultiStageModal(false);
            await fetchBatchDetails();
            await fetchNextStage();
            await fetchRecordCompletion();
          }}
          batchId={params.id as string}
          batchNumber={batch?.batch_number || ''}
          productId={batch?.product_id || ''}
          productName={batch?.product_name || ''}
          nextStage={nextStage.next_stage}
        />
      )}

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

      {/* Final Release Modal - NEW */}
      {showFinalReleaseModal && selectedGate && batch && (
        <FinalReleaseModal
          isOpen={showFinalReleaseModal}
          onClose={() => {
            setShowFinalReleaseModal(false);
            setSelectedGate(null);
          }}
          batch={batch}
          gate={selectedGate}
          onApprove={async (locationId) => {
            await handleQAApproval(batch.batch_id, selectedGate.gate_id, 'approve', locationId);
            setShowFinalReleaseModal(false);
            setSelectedGate(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}