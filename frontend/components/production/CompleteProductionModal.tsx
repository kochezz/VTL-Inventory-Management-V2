'use client';

import { useState } from 'react';
import { X, AlertCircle, CheckCircle2, Package, TrendingDown } from 'lucide-react';

interface CompleteProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: {
    batch_id: string;
    batch_number: string;
    product_name: string;
    planned_quantity: number;
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

export default function CompleteProductionModal({ 
  isOpen, 
  onClose, 
  batch, 
  onComplete 
}: CompleteProductionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    bottles_started: batch.planned_quantity,
    good_bottles: batch.planned_quantity,
    rejected_bottles: 0,
    rejection_reasons: '',
    // Rejection breakdown
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

    console.log('🔄 CompleteProductionModal: Starting submission...');
    console.log('Form data:', formData);

    // Validation
    if (formData.good_bottles + formData.rejected_bottles === 0) {
      setError('Total bottles produced cannot be zero');
      return;
    }

    // Check if there are rejections (bottles started > good bottles)
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
      console.log('✅ Validation passed, preparing completion data...');

      const actualRejectedBottles = formData.bottles_started - formData.good_bottles;

      const completionData: ProductionCompletionData = {
        actual_output: formData.good_bottles,
        rejected_bottles: actualRejectedBottles,
        rejection_reasons: formData.rejection_reasons,
        rejection_breakdown: {
          underfill: formData.underfill,
          overfill: formData.overfill,
          cap_defect: formData.cap_defect,
          label_defect: formData.label_defect,
          contamination: formData.contamination,
          damaged: formData.damaged,
          other: formData.other
        }
      };

      console.log('📤 Sending completion data:', completionData);

      await onComplete(completionData);
      
      console.log('✅ Production completed successfully!');
      onClose();
    } catch (err: any) {
      console.error('❌ CompleteProductionModal error:', err);
      console.error('Error details:', err.response?.data);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              Complete Production
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {batch.batch_number} - {batch.product_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Production Summary */}
          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-400" />
              Production Summary
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Bottles Started */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bottles Started
                </label>
                <input
                  type="number"
                  value={formData.bottles_started}
                  onChange={(e) => setFormData({ ...formData, bottles_started: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="0"
                  required
                />
              </div>

              {/* Good Bottles */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Good Finished Bottles *
                </label>
                <input
                  type="number"
                  value={formData.good_bottles}
                  onChange={(e) => setFormData({ ...formData, good_bottles: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="0"
                  required
                />
              </div>

              {/* Rejected Bottles */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rejected Bottles
                </label>
                <input
                  type="number"
                  value={Math.max(0, formData.bottles_started - formData.good_bottles)}
                  readOnly
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-calculated: Bottles Started - Good Bottles</p>
              </div>

              {/* Yield Percentage */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Yield (%)
                </label>
                <div className="px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg">
                  <span className={`text-lg font-bold ${
                    parseFloat(calculateYield()) >= 95 ? 'text-green-400' :
                    parseFloat(calculateYield()) >= 90 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {calculateYield()}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Rejection Breakdown - Show when good bottles < bottles started */}
          {formData.good_bottles < formData.bottles_started && (
            <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-400" />
                Rejection Breakdown
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Underfill</label>
                  <input
                    type="number"
                    value={formData.underfill}
                    onChange={(e) => {
                      setFormData({ ...formData, underfill: parseInt(e.target.value) || 0 });
                      setTimeout(updateRejectedBottles, 0);
                    }}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Overfill</label>
                  <input
                    type="number"
                    value={formData.overfill}
                    onChange={(e) => {
                      setFormData({ ...formData, overfill: parseInt(e.target.value) || 0 });
                      setTimeout(updateRejectedBottles, 0);
                    }}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cap Defect</label>
                  <input
                    type="number"
                    value={formData.cap_defect}
                    onChange={(e) => {
                      setFormData({ ...formData, cap_defect: parseInt(e.target.value) || 0 });
                      setTimeout(updateRejectedBottles, 0);
                    }}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Label Defect</label>
                  <input
                    type="number"
                    value={formData.label_defect}
                    onChange={(e) => {
                      setFormData({ ...formData, label_defect: parseInt(e.target.value) || 0 });
                      setTimeout(updateRejectedBottles, 0);
                    }}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Contamination</label>
                  <input
                    type="number"
                    value={formData.contamination}
                    onChange={(e) => {
                      setFormData({ ...formData, contamination: parseInt(e.target.value) || 0 });
                      setTimeout(updateRejectedBottles, 0);
                    }}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Damaged</label>
                  <input
                    type="number"
                    value={formData.damaged}
                    onChange={(e) => {
                      setFormData({ ...formData, damaged: parseInt(e.target.value) || 0 });
                      setTimeout(updateRejectedBottles, 0);
                    }}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Other</label>
                  <input
                    type="number"
                    value={formData.other}
                    onChange={(e) => {
                      setFormData({ ...formData, other: parseInt(e.target.value) || 0 });
                      setTimeout(updateRejectedBottles, 0);
                    }}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min="0"
                  />
                </div>
              </div>

              {/* Total Check */}
              <div className="flex items-center justify-between p-3 bg-dark-800 rounded-lg border border-dark-600">
                <span className="text-sm font-medium text-gray-300">Total Breakdown:</span>
                <span className={`text-lg font-bold ${
                  totalRejectionReasons === (formData.bottles_started - formData.good_bottles) ? 'text-green-400' : 'text-red-400'
                }`}>
                  {totalRejectionReasons} / {formData.bottles_started - formData.good_bottles}
                  {totalRejectionReasons === (formData.bottles_started - formData.good_bottles) && ' ✓'}
                </span>
              </div>

              {/* Rejection Reasons */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rejection Reasons / Notes *
                </label>
                <textarea
                  value={formData.rejection_reasons}
                  onChange={(e) => setFormData({ ...formData, rejection_reasons: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Describe the main causes of rejections..."
                  required={formData.rejected_bottles > 0}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Complete Production
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
