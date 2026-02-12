// ============================================================================
// PHASE 2A: IPQC QA REVIEW MODAL - FRONTEND COMPONENT
// Location: frontend/components/production/IPQCReviewModal.tsx
// Date: February 8, 2026
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, Clock, User } from 'lucide-react';
import { api } from '@/hooks/useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface IPQCReviewModalProps {
  ipqcId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface IPQCCheck {
  ipqc_id: string;
  batch_id: string;
  batch_number: string;
  product_name: string;
  check_sequence: number;
  check_time: string;
  fill_volume_ml: number;
  fill_volume_within_spec: boolean;
  cap_torque_nm: number;
  cap_torque_within_spec: boolean;
  visual_inspection_pass: boolean;
  visual_inspection_notes: string;
  label_position_correct: boolean;
  label_position_notes: string;
  coding_legible: boolean;
  coding_notes: string;
  all_checks_passed: boolean;
  operator_name: string;
  notes: string;
  created_at: string;
  qa_status: string;
}

export default function IPQCReviewModal({
  ipqcId,
  isOpen,
  onClose,
  onSuccess
}: IPQCReviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [ipqcCheck, setIpqcCheck] = useState<IPQCCheck | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && ipqcId) {
      fetchIPQCDetails();
    }
  }, [isOpen, ipqcId]);

  const fetchIPQCDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/production/ipqc/${ipqcId}/review`);
      setIpqcCheck(response.data.ipqc_check);
    } catch (err: any) {
      console.error('Error fetching IPQC details:', err);
      setError('Failed to load IPQC check details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setLoading(true);
      setError('');

      await api.post(`/production/ipqc/${ipqcId}/approve`);

      onSuccess();
      onClose();
      resetModal();
    } catch (err: any) {
      console.error('Error approving IPQC:', err);
      setError(err.response?.data?.error || 'Failed to approve IPQC check');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setLoading(true);
      setError('');

      if (!rejectionReason.trim()) {
        setError('Please provide a reason for rejection');
        setLoading(false);
        return;
      }

      await api.post(`/production/ipqc/${ipqcId}/reject`, {
        rejection_reason: rejectionReason
      });

      onSuccess();
      onClose();
      resetModal();
    } catch (err: any) {
      console.error('Error rejecting IPQC:', err);
      setError(err.response?.data?.error || 'Failed to reject IPQC check');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setAction(null);
    setRejectionReason('');
    setError('');
    setIpqcCheck(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-dark-800 border-b border-dark-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">QA Review - IPQC Check</h2>
            {ipqcCheck && (
              <p className="text-sm text-gray-400 mt-1">
                {ipqcCheck.batch_number} - Check #{ipqcCheck.check_sequence}
              </p>
            )}
          </div>
          <button
            onClick={() => { onClose(); resetModal(); }}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading && !ipqcCheck ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading IPQC check...</p>
          </div>
        ) : ipqcCheck ? (
          <div className="p-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {/* Overall Status Badge */}
            <div className={`p-4 rounded-lg mb-6 ${
              ipqcCheck.all_checks_passed
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              <div className="flex items-center gap-3">
                {ipqcCheck.all_checks_passed ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400" />
                )}
                <div>
                  <p className={`font-semibold ${
                    ipqcCheck.all_checks_passed ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {ipqcCheck.all_checks_passed ? 'All Checks Passed' : 'Some Checks Failed'}
                  </p>
                  <p className="text-sm text-gray-400">
                    Production within specifications
                  </p>
                </div>
              </div>
            </div>

            {/* Check Details Grid */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Product Info */}
              <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                <p className="text-sm text-gray-400 mb-1">Product</p>
                <p className="text-white font-medium">{ipqcCheck.product_name}</p>
              </div>

              {/* Check Time */}
              <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                <p className="text-sm text-gray-400 mb-1">Check Time</p>
                <p className="text-white font-medium">
                  {new Date(ipqcCheck.check_time).toLocaleString()}
                </p>
              </div>

              {/* Operator */}
              <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                <p className="text-sm text-gray-400 mb-1">Operator</p>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <p className="text-white font-medium">{ipqcCheck.operator_name}</p>
                </div>
              </div>

              {/* Recorded At */}
              <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                <p className="text-sm text-gray-400 mb-1">Recorded At</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <p className="text-white font-medium">
                    {new Date(ipqcCheck.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Measurements */}
            <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
              <h3 className="text-white font-semibold mb-4">Measurements</h3>
              
              <div className="space-y-3">
                {/* Fill Volume */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Fill Volume</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      ipqcCheck.fill_volume_within_spec ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {ipqcCheck.fill_volume_ml} ml
                    </span>
                    {ipqcCheck.fill_volume_within_spec ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>

                {/* Cap Torque */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Cap Torque</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      ipqcCheck.cap_torque_within_spec ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {ipqcCheck.cap_torque_nm} Nm
                    </span>
                    {ipqcCheck.cap_torque_within_spec ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Checks */}
            <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
              <h3 className="text-white font-semibold mb-4">Visual Inspections</h3>
              
              <div className="space-y-3">
                {/* Visual Inspection */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Visual Inspection</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      ipqcCheck.visual_inspection_pass ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {ipqcCheck.visual_inspection_pass ? 'Pass' : 'Fail'}
                    </span>
                    {ipqcCheck.visual_inspection_pass ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>
                {ipqcCheck.visual_inspection_notes && (
                  <p className="text-sm text-gray-400 pl-4">
                    Note: {ipqcCheck.visual_inspection_notes}
                  </p>
                )}

                {/* Label Position */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Label Position</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      ipqcCheck.label_position_correct ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {ipqcCheck.label_position_correct ? 'Correct' : 'Incorrect'}
                    </span>
                    {ipqcCheck.label_position_correct ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>
                {ipqcCheck.label_position_notes && (
                  <p className="text-sm text-gray-400 pl-4">
                    Note: {ipqcCheck.label_position_notes}
                  </p>
                )}

                {/* Coding Legibility */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Coding Legibility</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      ipqcCheck.coding_legible ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {ipqcCheck.coding_legible ? 'Clear' : 'Unclear'}
                    </span>
                    {ipqcCheck.coding_legible ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>
                {ipqcCheck.coding_notes && (
                  <p className="text-sm text-gray-400 pl-4">
                    Note: {ipqcCheck.coding_notes}
                  </p>
                )}
              </div>
            </div>

            {/* Additional Notes */}
            {ipqcCheck.notes && (
              <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
                <h3 className="text-white font-semibold mb-2">Additional Notes</h3>
                <p className="text-gray-400">{ipqcCheck.notes}</p>
              </div>
            )}

            {/* QA Action Selection */}
            {!action ? (
              <div className="flex gap-4">
                <button
                  onClick={() => setAction('approve')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Approve IPQC Check
                </button>
                <button
                  onClick={() => setAction('reject')}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Reject IPQC Check
                </button>
              </div>
            ) : action === 'approve' ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-400 font-semibold">Confirm Approval</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Are you sure you want to approve this IPQC check? This will allow production to continue.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Approving...' : 'Confirm Approval'}
                  </button>
                  <button
                    onClick={() => setAction(null)}
                    disabled={loading}
                    className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-400 font-semibold">Reject IPQC Check</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Please provide a detailed reason for rejection. This will be communicated to the production team.
                    </p>
                  </div>
                </div>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this check is being rejected..."
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-3 min-h-[100px]"
                  required
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleReject}
                    disabled={loading || !rejectionReason.trim()}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                  <button
                    onClick={() => { setAction(null); setRejectionReason(''); }}
                    disabled={loading}
                    className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
