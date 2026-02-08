// ============================================================================
// IPQC RECORDING MODAL - FRONTEND COMPONENT
// Phase 2.1: Critical GMP Data Collection
// Location: frontend/components/production/IPQCCheckModal.tsx
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { api } from '@/hooks/useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface IPQCCheckModalProps {
  batchId: string;
  batchNumber: string;
  productName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface IPQCFormData {
  check_time: string;
  fill_volume_ml: string;
  fill_volume_within_spec: boolean;
  cap_torque_nm: string;
  cap_torque_within_spec: boolean;
  visual_inspection_pass: boolean;
  visual_inspection_notes: string;
  label_position_correct: boolean;
  label_position_notes: string;
  coding_legible: boolean;
  coding_notes: string;
  notes: string;
}

export default function IPQCCheckModal({
  batchId,
  batchNumber,
  productName,
  isOpen,
  onClose,
  onSuccess
}: IPQCCheckModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkSequence, setCheckSequence] = useState<number>(1);
  
  const [formData, setFormData] = useState<IPQCFormData>({
    check_time: new Date().toISOString().slice(0, 16),
    fill_volume_ml: '',
    fill_volume_within_spec: true,
    cap_torque_nm: '',
    cap_torque_within_spec: true,
    visual_inspection_pass: true,
    visual_inspection_notes: '',
    label_position_correct: true,
    label_position_notes: '',
    coding_legible: true,
    coding_notes: '',
    notes: ''
  });

  // Load next check sequence when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchNextSequence();
      // Set current time
      setFormData(prev => ({
        ...prev,
        check_time: new Date().toISOString().slice(0, 16)
      }));
    }
  }, [isOpen]);

  const fetchNextSequence = async () => {
    try {
      const response = await api.get(
        `/production/batches/${batchId}/ipqc`
      );
      setCheckSequence(response.data.checks.length + 1);
    } catch (err) {
      console.error('Error fetching check sequence:', err);
      setCheckSequence(1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.fill_volume_ml || !formData.cap_torque_nm) {
      setError('Please enter fill volume and cap torque measurements');
      return;
    }

    if (parseFloat(formData.fill_volume_ml) <= 0) {
      setError('Fill volume must be greater than 0');
      return;
    }

    if (parseFloat(formData.cap_torque_nm) <= 0) {
      setError('Cap torque must be greater than 0');
      return;
    }

    // Check for failed items and notes
    if (!formData.visual_inspection_pass && !formData.visual_inspection_notes.trim()) {
      setError('Please provide notes for failed visual inspection');
      return;
    }

    if (!formData.label_position_correct && !formData.label_position_notes.trim()) {
      setError('Please provide notes for incorrect label position');
      return;
    }

    if (!formData.coding_legible && !formData.coding_notes.trim()) {
      setError('Please provide notes for illegible coding');
      return;
    }

    try {
      setLoading(true);

      const response = await api.post(
        `/production/batches/${batchId}/ipqc`,
        {
          ...formData,
          fill_volume_ml: parseFloat(formData.fill_volume_ml),
          cap_torque_nm: parseFloat(formData.cap_torque_nm)
        }
      );

      console.log('✅ IPQC check recorded:', response.data);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('❌ Error recording IPQC:', err);
      setError(err.response?.data?.message || 'Failed to record IPQC check');
    } finally {
      setLoading(false);
    }
  };

  const allChecksPassed = 
    formData.fill_volume_within_spec &&
    formData.cap_torque_within_spec &&
    formData.visual_inspection_pass &&
    formData.label_position_correct &&
    formData.coding_legible;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-dark-900 border-b border-dark-700 p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-semibold text-white">
                IPQC Check #{checkSequence}
              </h2>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {batchNumber} - {productName}
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
          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Overall Status Indicator */}
          <div className={`p-4 rounded-lg border ${
            allChecksPassed 
              ? 'bg-green-500/10 border-green-500/20' 
              : 'bg-red-500/10 border-red-500/20'
          }`}>
            <div className="flex items-center gap-3">
              {allChecksPassed ? (
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-400" />
              )}
              <div>
                <p className={`font-semibold ${allChecksPassed ? 'text-green-400' : 'text-red-400'}`}>
                  {allChecksPassed ? 'All Checks Passing' : 'Some Checks Failed'}
                </p>
                <p className="text-sm text-gray-400">
                  {allChecksPassed 
                    ? 'Production within specifications' 
                    : 'Review failed items and provide notes'}
                </p>
              </div>
            </div>
          </div>

          {/* Check Time */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Clock className="w-4 h-4 inline mr-2" />
              Check Time *
            </label>
            <input
              type="datetime-local"
              value={formData.check_time}
              onChange={(e) => setFormData({ ...formData, check_time: e.target.value })}
              className="w-full px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {/* Fill Volume */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Fill Volume (ml) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.fill_volume_ml}
                onChange={(e) => setFormData({ ...formData, fill_volume_ml: e.target.value })}
                placeholder="e.g., 500.00"
                className="w-full px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Target: 500 ± 2 ml</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Within Specification?
              </label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.fill_volume_within_spec}
                    onChange={() => setFormData({ ...formData, fill_volume_within_spec: true })}
                    className="w-4 h-4"
                  />
                  <span className="text-green-400">Pass</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!formData.fill_volume_within_spec}
                    onChange={() => setFormData({ ...formData, fill_volume_within_spec: false })}
                    className="w-4 h-4"
                  />
                  <span className="text-red-400">Fail</span>
                </label>
              </div>
            </div>
          </div>

          {/* Cap Torque */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cap Torque (Nm) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.cap_torque_nm}
                onChange={(e) => setFormData({ ...formData, cap_torque_nm: e.target.value })}
                placeholder="e.g., 1.0"
                className="w-full px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Target: 0.8 - 1.2 Nm</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Within Specification?
              </label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.cap_torque_within_spec}
                    onChange={() => setFormData({ ...formData, cap_torque_within_spec: true })}
                    className="w-4 h-4"
                  />
                  <span className="text-green-400">Pass</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!formData.cap_torque_within_spec}
                    onChange={() => setFormData({ ...formData, cap_torque_within_spec: false })}
                    className="w-4 h-4"
                  />
                  <span className="text-red-400">Fail</span>
                </label>
              </div>
            </div>
          </div>

          {/* Visual Inspection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Visual Inspection *
            </label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.visual_inspection_pass}
                  onChange={() => setFormData({ ...formData, visual_inspection_pass: true })}
                  className="w-4 h-4"
                />
                <span className="text-green-400">Pass</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!formData.visual_inspection_pass}
                  onChange={() => setFormData({ ...formData, visual_inspection_pass: false })}
                  className="w-4 h-4"
                />
                <span className="text-red-400">Fail</span>
              </label>
            </div>
            {!formData.visual_inspection_pass && (
              <textarea
                value={formData.visual_inspection_notes}
                onChange={(e) => setFormData({ ...formData, visual_inspection_notes: e.target.value })}
                placeholder="Describe the visual defects..."
                rows={2}
                className="w-full px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            )}
          </div>

          {/* Label Position */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Label Position *
            </label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.label_position_correct}
                  onChange={() => setFormData({ ...formData, label_position_correct: true })}
                  className="w-4 h-4"
                />
                <span className="text-green-400">Correct</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!formData.label_position_correct}
                  onChange={() => setFormData({ ...formData, label_position_correct: false })}
                  className="w-4 h-4"
                />
                <span className="text-red-400">Incorrect</span>
              </label>
            </div>
            {!formData.label_position_correct && (
              <textarea
                value={formData.label_position_notes}
                onChange={(e) => setFormData({ ...formData, label_position_notes: e.target.value })}
                placeholder="Describe the label issue..."
                rows={2}
                className="w-full px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            )}
          </div>

          {/* Coding Legibility */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Coding Legibility *
            </label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.coding_legible}
                  onChange={() => setFormData({ ...formData, coding_legible: true })}
                  className="w-4 h-4"
                />
                <span className="text-green-400">Clear</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!formData.coding_legible}
                  onChange={() => setFormData({ ...formData, coding_legible: false })}
                  className="w-4 h-4"
                />
                <span className="text-red-400">Unclear</span>
              </label>
            </div>
            {!formData.coding_legible && (
              <textarea
                value={formData.coding_notes}
                onChange={(e) => setFormData({ ...formData, coding_notes: e.target.value })}
                placeholder="Describe the coding issue..."
                rows={2}
                className="w-full px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            )}
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional observations..."
              rows={3}
              className="w-full px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Record IPQC Check
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
