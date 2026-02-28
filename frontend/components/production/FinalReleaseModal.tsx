'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, Package, ClipboardCheck, AlertTriangle, MapPin, Key, FileText } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';

interface FinalReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: {
    batch_id: string;
    batch_number: string;
    product_name: string;
    planned_quantity: number;
    actual_output?: number;
    yield_percentage?: number | string;
    rejected_bottles?: number;
    qa_gates?: QAGate[];
    ipqc_checks?: IPQCCheck[];
  };
  gate: {
    gate_id: string;
    gate_name: string;
  };
  onApprove: (locationId: string) => Promise<void>;
}

interface QAGate {
  gate_id: string;
  gate_name: string;
  gate_number: number;
  status: string;
  approved_by_name?: string;
  approved_at?: string;
}

interface IPQCCheck {
  ipqc_id: string;
  stage_sequence: number;
  stage_name: string;
  stage_code: string;
  qa_status: string;
  qa_reviewed_by_name?: string;
  qa_reviewed_at?: string;
}

export default function FinalReleaseModal({ 
  isOpen, 
  onClose, 
  batch,
  gate,
  onApprove 
}: FinalReleaseModalProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  
  const [signature, setSignature] = useState('');

  useEffect(() => {
    if (isOpen && token) {
      setSignature('');
      axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/locations`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => setLocations(res.data || []))
      .catch(err => console.error('Failed to load locations', err));
    }
  }, [isOpen, token]);

  const approvedGates = batch.qa_gates?.filter(g => 
    g.status === 'approved' || g.status === 'qa_approved'
  ) || [];
  
  const approvedIPQC = batch.ipqc_checks?.filter(c => 
    c.qa_status === 'approved' || c.qa_status === 'qa_approved'
  ) || [];

  const handleApprove = async () => {
    if (!selectedLocation) {
      setError('Please select a Destination Warehouse Location before releasing the batch.');
      return;
    }
    if (!signature) {
      setError('Digital signature is required.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/signature/verify`,
        { password: signature },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      await onApprove(selectedLocation);
      onClose();
    } catch (err: any) {
      console.error('Error approving final release:', err);
      setError(err.response?.data?.message || err.message || 'Failed to verify signature or release batch.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-dark-700 shrink-0 bg-dark-900/50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              Final QA Release Approval
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {batch.batch_number} - {batch.product_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* QMS SOP REFERENCE */}
            <button 
              onClick={() => window.open('/qms/documents?search=QA-PRO-REL-SOP-010', '_blank')} 
              className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <FileText className="w-4 h-4"/> QA Release SOP
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* 1. QA APPROVAL SUMMARY */}
          <div className="bg-dark-900 rounded-lg p-5 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-green-400" />
              Quality Assurance Validation Summary
            </h3>

            {approvedGates.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  Approved QA Gates ({approvedGates.length})
                </p>
                <div className="space-y-2">
                  {approvedGates.map((g) => (
                    <div key={g.gate_id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg border border-dark-700">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-white font-medium">{g.gate_name}</p>
                          {g.approved_by_name && g.approved_at && (
                            <p className="text-xs text-gray-400">
                              Approved by {g.approved_by_name} • {new Date(g.approved_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-green-400 px-3 py-1 bg-green-400/10 rounded-full">
                        Approved
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {approvedIPQC.length > 0 && (
              <div className="mt-4 pt-4 border-t border-dark-700">
                <p className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                  Approved In-Process Quality Checks ({approvedIPQC.length})
                </p>
                <div className="space-y-2">
                  {approvedIPQC
                    .sort((a, b) => a.stage_sequence - b.stage_sequence)
                    .map((check) => (
                      <div key={check.ipqc_id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg border border-dark-700">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-white font-medium">
                              <span className="text-gray-400">Stage {check.stage_sequence}:</span> {check.stage_name}
                            </p>
                            {check.qa_reviewed_at && (
                              <p className="text-xs text-gray-400">
                                Reviewed {check.qa_reviewed_by_name ? `by ${check.qa_reviewed_by_name}` : ''} on {new Date(check.qa_reviewed_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-green-400 px-3 py-1 bg-green-400/10 rounded-full">
                          Approved
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {approvedGates.length === 0 && approvedIPQC.length === 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-400">No approved quality checks found</p>
                  <p className="text-xs text-yellow-400/80 mt-1">
                    All required QA gates and IPQC stages should be completed before final release.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 2. PRODUCTION SUMMARY */}
          <div className="bg-dark-900 rounded-lg p-5 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-400" />
              Production Output Summary
            </h3>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">Planned Quantity</p>
                <p className="text-2xl font-bold text-white">{batch.planned_quantity.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">units</p>
              </div>

              <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">Actual Output</p>
                <p className="text-2xl font-bold text-white">
                  {(batch.actual_output ?? batch.planned_quantity).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">good units</p>
              </div>

              <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">Rejected</p>
                <p className={`text-2xl font-bold ${batch.rejected_bottles && batch.rejected_bottles > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {batch.rejected_bottles?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">scrap units</p>
              </div>

              <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                <p className="text-xs text-gray-400 mb-1">Yield</p>
                <p className={`text-2xl font-bold ${
                  parseFloat(String(batch.yield_percentage || 100)) >= 95 ? 'text-green-400' :
                  parseFloat(String(batch.yield_percentage || 100)) >= 90 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {batch.yield_percentage ?? '100.00'}%
                </p>
                <p className="text-xs text-gray-500 mt-1">efficiency</p>
              </div>
            </div>
          </div>

          {/* 3. WAREHOUSE DESTINATION */}
          <div className="bg-dark-900 rounded-lg p-5 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              Destination Warehouse
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Select where the <strong className="text-white">{(batch.actual_output ?? batch.planned_quantity).toLocaleString()}</strong> finished units will be stored.
            </p>
            
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Destination Location --</option>
              {locations.map(loc => (
                <option key={loc.location_id} value={loc.location_id}>
                  {loc.location_name} ({loc.location_code})
                </option>
              ))}
            </select>
          </div>

          {/* 4. DIGITAL SIGNATURE BLOCK */}
          <div className="bg-dark-900 rounded-lg p-5 border border-dark-700 shadow-inner">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Key className="w-4 h-4 text-primary-400" />
              Final QA Electronic Signature Required
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              By entering your password, you verify the quality data above and authorize the final release of this batch. This action permanently deducts consumed raw materials and adds finished goods to the inventory ledger.
            </p>
            <input
              type="password"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Enter your login password"
              className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono tracking-widest"
              required
            />
          </div>

        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-dark-700 bg-dark-900/50 rounded-b-xl shrink-0">
          <button type="button" onClick={onClose} disabled={loading} className="px-6 py-2.5 border border-dark-600 rounded-lg text-gray-300 hover:bg-dark-700 transition-colors disabled:opacity-50 font-medium">
            Cancel
          </button>
          <button type="button" onClick={handleApprove} disabled={loading || !selectedLocation || !signature} className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 font-medium">
            {loading ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span>Syncing Inventory...</span></>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /><span>Sign & Release Batch</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}