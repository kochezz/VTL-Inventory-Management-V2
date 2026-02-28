'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, Package, TrendingDown, FileText, Key } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';

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

interface CompleteProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: any;
  onComplete: (data: ProductionCompletionData) => Promise<void>;
}

export default function CompleteProductionModal({ isOpen, onClose, batch, onComplete }: CompleteProductionModalProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [actualOutput, setActualOutput] = useState(batch.planned_quantity);
  const [rejectedBottles, setRejectedBottles] = useState(0);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const [signature, setSignature] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActualOutput(batch.planned_quantity);
      setRejectedBottles(0);
      setRejectionReason('');
      setSignature('');
    }
  }, [isOpen, batch.planned_quantity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signature) { setError('Digital signature is required.'); return; }

    setLoading(true);
    setError('');

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/signature/verify`,
        { password: signature },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await onComplete({
        actual_output: actualOutput,
        rejected_bottles: rejectedBottles,
        rejection_reasons: rejectionReason
      });
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Signature verification failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-2xl">
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-400" /> Complete Production Run
          </h2>
          <div className="flex items-center gap-3">
            {/* QMS SOP REFERENCE */}
            <button 
              onClick={() => window.open('/qms/documents?search=QA-PRO-TRC-SOP-009', '_blank')} 
              className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <FileText className="w-4 h-4"/> Batch Traceability SOP
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Planned Quantity</label>
              <div className="px-4 py-3 bg-dark-900 border border-dark-700 rounded-lg text-gray-400 cursor-not-allowed">
                {batch.planned_quantity} units
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Actual Good Output *</label>
              <input type="number" min="0" value={actualOutput} onChange={(e) => setActualOutput(parseInt(e.target.value) || 0)} className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 font-bold" required />
            </div>
          </div>

          <div className="border border-dark-700 rounded-lg p-4 bg-dark-900">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-red-400" />
              <h3 className="text-white font-medium">Rejections & Scrap</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Total Rejected Bottles</label>
                <input type="number" min="0" value={rejectedBottles} onChange={(e) => setRejectedBottles(parseInt(e.target.value) || 0)} className="w-full px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500" />
              </div>
              {rejectedBottles > 0 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Primary Reason for Rejection *</label>
                  <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} required rows={2} className="w-full px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500" placeholder="e.g., Cap alignment issues on line 2..." />
                </div>
              )}
            </div>
          </div>

          <div className="bg-dark-900 rounded-lg p-5 border border-dark-700">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Key className="w-4 h-4 text-primary-400" />
              Supervisor Electronic Signature Required
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              By entering your password, you confirm these production output numbers are accurate and submit them for final QA review.
            </p>
            <input
              type="password"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Enter your login password"
              className="w-full px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dark-700">
            <button type="button" onClick={onClose} disabled={loading} className="px-6 py-2 border border-dark-600 rounded-lg text-gray-300 hover:bg-dark-700 transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !signature} className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
              {loading ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span>Signing...</span></> : <><CheckCircle2 className="w-5 h-5" /><span>Sign & Complete Run</span></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}