'use client';

import { useState } from 'react';
import { X, AlertCircle, CheckCircle2, Package, TrendingDown, ClipboardCheck } from 'lucide-react';

interface CompleteProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: {
    batch_id: string;
    batch_number: string;
    product_name: string;
    planned_quantity: number;
    qa_gates?: QAGate[];
    ipqc_checks?: IPQCCheck[];
  };
  onComplete: (data: ProductionCompletionData) => Promise<void>;
}

export interface ProductionCompletionData {
  actual_output: number;
  rejected_bottles: number;
  rejection_reasons?: string;
  rejection_breakdown?: {
    underfill?: number;
    overfill?: number;
    cap_defect?: number;
    label_defect?: number;
    contamination?: number;
    damaged?: number;
    other?: number;
  };
}

interface QAGate {
  gate_id: string;
  gate_name: string;
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
  qa_reviewed_by?: string;
  qa_reviewed_at?: string;
}

export default function CompleteProductionModal({ 
  isOpen, 
  onClose, 
  batch, 
  onComplete 
}: CompleteProductionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filter approved QA items
  const approvedGates = batch.qa_gates?.filter(g => 
    g.status === 'approved' || g.status === 'qa_approved'
  ) || [];
  
  const approvedIPQC = batch.ipqc_checks?.filter(c => 
    c.qa_status === 'approved' || c.qa_status === 'qa_approved'
  ) || [];
  
  const [formData, setFormData] = useState({
    bottles_started: batch.planned_quantity,
    good_bottles: batch.planned_quantity,
    rejected_bottles: 0,
    rejection_reasons: '',
    underfill: 0,
    overfill: 0,
    cap_defect: 0,
    label_defect: 0,
    contamination: 0,
    damaged: 0,
    other: 0
  });

  const calculateYield = () => {
    const total = formData.bottles_started;
    if (total === 0) return 0;
    return ((formData.good_bottles / total) * 100).toFixed(2);
  };

  const totalRejectionReasons = 
    formData.underfill + 
    formData.overfill + 
    formData.cap_defect + 
    formData.label_defect + 
    formData.contamination + 
    formData.damaged + 
    formData.other;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const actualRejections = formData.bottles_started - formData.good_bottles;
    
    if (actualRejections > 0 && totalRejectionReasons !== actualRejections) {
      setError(`Rejection breakdown (${totalRejectionReasons}) must equal rejected bottles (${actualRejections})`);
      return;
    }

    if (actualRejections > 0 && !formData.rejection_reasons.trim()) {
      setError('Please provide rejection reasons when there are rejected bottles');
      return;
    }

    try {
      setLoading(true);

      const completionData: ProductionCompletionData = {
        actual_output: formData.good_bottles,
        rejected_bottles: actualRejections,
        rejection_reasons: formData.rejection_reasons.trim() || undefined,
        rejection_breakdown: actualRejections > 0 ? {
          underfill: formData.underfill,
          overfill: formData.overfill,
          cap_defect: formData.cap_defect,
          label_defect: formData.label_defect,
          contamination: formData.contamination,
          damaged: formData.damaged,
          other: formData.other
        } : undefined
      };

      await onComplete(completionData);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to complete production');
    } finally {
      setLoading(false);
    }
  };

  const updateRejectedBottles = () => {
    const total = 
      formData.underfill + 
      formData.overfill + 
      formData.cap_defect + 
      formData.label_defect + 
      formData.contamination + 
      formData.damaged + 
      formData.other;
    
    setFormData(prev => ({ ...prev, rejected_bottles: total }));
  };

  if (!isOpen) return null;

  const actualRejections = formData.bottles_started - formData.good_bottles;
  const hasRejections = actualRejections > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              Complete Production & Release
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {batch.batch_number} - {batch.product_name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* QA APPROVAL SUMMARY */}
          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-green-400" />
              Quality Assurance Summary
            </h3>

            {/* QA Gates */}
            {approvedGates.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  QA Gates ({approvedGates.length})
                </p>
                <div className="space-y-2">
                  {approvedGates.map((gate) => (
                    <div key={gate.gate_id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg border border-dark-700">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-white font-medium">{gate.gate_name}</p>
                          {gate.approved_by_name && gate.approved_at && (
                            <p className="text-xs text-gray-400">
                              By {gate.approved_by_name} • {new Date(gate.approved_at).toLocaleString()}
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

            {/* IPQC Checks */}
            {approvedIPQC.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                  In-Process Quality Checks ({approvedIPQC.length})
                </p>
                <div className="space-y-2">
                  {approvedIPQC.sort((a, b) => a.stage_sequence - b.stage_sequence).map((check) => (
                    <div key={check.ipqc_id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg border border-dark-700">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-white font-medium">
                            <span className="text-gray-400">Stage {check.stage_sequence}:</span> {check.stage_name}
                          </p>
                          {check.qa_reviewed_at && (
                            <p className="text-xs text-gray-400">
                              Reviewed {new Date(check.qa_reviewed_at).toLocaleString()}
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
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <p className="text-sm text-yellow-400">No approved quality checks found</p>
              </div>
            )}

            {(approvedGates.length > 0 || approvedIPQC.length > 0) && (
              <div className="mt-4 pt-4 border-t border-dark-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Total QA Approvals:</span>
                  <span className="text-green-400 font-semibold">
                    {approvedGates.length + approvedIPQC.length} approved
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Rest of the form remains the same... */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dark-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-dark-600 rounded-lg text-gray-300 hover:bg-dark-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Completing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Complete & Release Batch</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}