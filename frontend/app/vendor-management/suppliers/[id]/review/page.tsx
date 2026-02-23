'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, api } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  ArrowLeft, FileCheck, ShieldAlert, CheckCircle2, 
  AlertTriangle, FileSignature, XCircle, FileText, KeyRound
} from 'lucide-react';

export default function QAReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // QA Form State
  const [notes, setNotes] = useState('');
  const [isConditional, setIsConditional] = useState(false);
  const [password, setPassword] = useState(''); // Changed to password
  const [error, setError] = useState('');

  useEffect(() => {
    if (params.id) fetchVendorForReview(params.id as string);
  }, [params.id]);

  const fetchVendorForReview = async (id: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/suppliers/${id}`);
      const v = response.data;
      
      if (v.status !== 'AWAITING_QA') {
        router.push(`/vendor-management/suppliers/${id}`);
        return;
      }
      setVendor(v);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load vendor for review');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!password) {
      setError('You must enter your login password to digitally sign this approval.');
      return;
    }
    try {
      setActionLoading(true);
      setError('');
      await api.post(`/suppliers/${vendor.vendor_id}/approve`, {
        is_conditional: isConditional,
        notes: notes,
        signature_password: password // Sending password to backend
      });
      router.push(`/vendor-management/suppliers/${vendor.vendor_id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Approval failed. Please check your password.');
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!notes) {
      setError('You must provide a reason in the QA Notes to request a revision.');
      return;
    }
    if (!password) {
      setError('You must enter your login password to digitally sign this rejection.');
      return;
    }
    try {
      setActionLoading(true);
      setError('');
      await api.post(`/suppliers/${vendor.vendor_id}/reject`, {
        reason: notes,
        signature_password: password // Sending password to backend
      });
      router.push(`/vendor-management/suppliers/${vendor.vendor_id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Rejection failed. Please check your password.');
      setActionLoading(false);
    }
  };

  if (loading) return (
    <DashboardLayout>
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    </DashboardLayout>
  );

  if (!vendor) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.back()} className="p-2 bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg transition-colors border border-dark-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <FileCheck className="w-8 h-8 text-blue-400" />
              QA Vendor Assessment
            </h1>
            <p className="text-gray-400 mt-1">
              Reviewing submission for: <strong className="text-white">{vendor.legal_name}</strong>
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT: Data Verification Panel */}
          <div className="space-y-6">
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-400" /> Submitted Data Summary
              </h2>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4 bg-dark-900 p-4 rounded-lg">
                  <div><p className="text-gray-500">Primary Category</p><p className="text-white font-medium">{vendor.primary_category}</p></div>
                  <div><p className="text-gray-500">Company Reg No.</p><p className="text-white font-medium">{vendor.company_reg_no || 'N/A'}</p></div>
                </div>
                
                <div className="bg-dark-900 p-4 rounded-lg space-y-2">
                  <p className="text-gray-400 font-medium mb-2 border-b border-dark-700 pb-1">Compliance Snapshot</p>
                  <div className="flex justify-between items-center"><span className="text-gray-300">Documented QMS</span>{vendor.compliance_data?.has_qms ? <CheckCircle2 className="w-4 h-4 text-green-400"/> : <XCircle className="w-4 h-4 text-gray-500"/>}</div>
                  <div className="flex justify-between items-center"><span className="text-gray-300">HSE Policy</span>{vendor.compliance_data?.has_hse_policy ? <CheckCircle2 className="w-4 h-4 text-green-400"/> : <XCircle className="w-4 h-4 text-gray-500"/>}</div>
                  <div className="flex justify-between items-center"><span className="text-gray-300">Regulatory Compliant</span>{vendor.compliance_data?.is_regulatory_compliant ? <CheckCircle2 className="w-4 h-4 text-green-400"/> : <XCircle className="w-4 h-4 text-red-500"/>}</div>
                  {vendor.compliance_data?.sanctions_history && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
                      <strong>Sanctions Noted:</strong> {vendor.compliance_data.sanctions_details}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Future Placeholder for Scanned Form Viewer from Phase 4 */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 flex flex-col items-center justify-center h-64 text-gray-500 border-dashed">
              <FileText className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-medium">Scanned Document Viewer</p>
              <p className="text-sm opacity-70">Will display uploaded QA-00001 PDF in Phase 4</p>
            </div>
          </div>

          {/* RIGHT: QA Action & Digital Signature Panel */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 flex flex-col">
            <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-blue-400" /> Assessment Actions
            </h2>
            
            <div className="flex-1 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">QA Evaluation Notes</label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="Enter assessment notes. (Required if requesting a revision or granting conditional approval)"
                  className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white focus:border-blue-500 h-32 resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-yellow-500/5 rounded-lg border border-yellow-500/20 cursor-pointer" onClick={() => setIsConditional(!isConditional)}>
                <div>
                  <p className="text-yellow-400 font-medium">Approve Conditionally</p>
                  <p className="text-xs text-yellow-500/70">Check this if certificates are pending or temporary approval is needed.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={isConditional} 
                  onChange={(e) => setIsConditional(e.target.checked)} 
                  className="w-5 h-5 rounded border-yellow-500/50 text-yellow-500 focus:ring-yellow-500" 
                />
              </div>

              {/* PASSWORD SIGNATURE BOX */}
              <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
                <label className="block text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
                  <KeyRound className="w-4 h-4" /> Digital Signature Verification
                </label>
                <p className="text-xs text-blue-200/70 mb-3">Enter your login password to officially sign and authorize this assessment. This action is irreversible.</p>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Enter your password"
                  className="w-full px-4 py-2 bg-dark-950 border border-blue-500/50 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-dark-700">
              <button 
                onClick={handleReject} 
                disabled={actionLoading}
                className="w-full py-3 bg-dark-900 hover:bg-dark-700 border border-orange-500/30 text-orange-400 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                Request Revision
              </button>
              
              <button 
                onClick={handleApprove} 
                disabled={actionLoading}
                className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 ${
                  isConditional 
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg shadow-yellow-500/20' 
                    : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20'
                }`}
              >
                {actionLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><CheckCircle2 className="w-5 h-5" /> {isConditional ? 'Approve (Conditional)' : 'Approve Vendor'}</>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}