// ============================================================================
// UPDATED: IPQC QA REVIEW MODAL - STAGE-AWARE VERSION
// With 21 CFR Part 11 Digital Signature & Comprehensive Data View
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, Clock, User, Droplet, Gauge, Package, Eye, FileText, Search, Key } from 'lucide-react';
import { api, useAuth } from '@/hooks/useAuth';
import axios from 'axios';

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
  
  // Stage info
  stage_id?: string;
  stage_sequence?: number;
  stage_name?: string;
  stage_code?: string;
  stage_category?: string;
  
  // Water treatment fields
  water_source?: string;
  raw_water_ph?: number;
  raw_water_conductivity?: number;
  ro_conductivity?: number;
  uv_system_status?: string;
  ozone_system_status?: string;
  ozone_residual_ppm?: number;
  water_treatment_approved?: boolean;
  water_treatment_notes?: string;
  line_clearance_verified?: boolean;
  equipment_cleaned?: boolean;
  
  // Filling fields
  fill_volume_ml?: number;
  fill_volume_within_spec?: boolean;
  fill_temperature?: number;
  fill_pressure?: number;
  rinsing_pressure?: number;
  
  // Capping fields
  cap_torque_nm?: number;
  cap_torque_within_spec?: boolean;
  
  // Visual inspection fields
  visual_inspection_pass?: boolean;
  visual_inspection_notes?: string;
  label_position_correct?: boolean;
  label_position_notes?: string;
  bottle_integrity?: string;
  seal_integrity?: string;
  
  // Coding fields
  coding_legible?: boolean;
  coding_notes?: string;
  tamper_evidence?: string;
  
  // Custom Data (JSON)
  stage_custom_data?: any;

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
  const { token } = useAuth(); // NEW: Needed for Signature Validation
  const [loading, setLoading] = useState(false);
  const [ipqcCheck, setIpqcCheck] = useState<IPQCCheck | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');
  
  // Digital Signature State (NEW)
  const [signature, setSignature] = useState('');

  useEffect(() => {
    if (isOpen && ipqcId) {
      fetchIPQCDetails();
      setSignature(''); // Reset signature on open
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

  // NEW: Signature Verification Function
  const verifySignature = async () => {
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/signature/verify`,
        { password: signature },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid digital signature: Incorrect password.');
      return false;
    }
  };

  const handleApprove = async () => {
    if (!signature) { setError('Digital signature required.'); return; }

    try {
      setLoading(true);
      setError('');

      if (!(await verifySignature())) {
        setLoading(false);
        return;
      }

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
    if (!signature) { setError('Digital signature required.'); return; }

    try {
      setLoading(true);
      setError('');

      if (!rejectionReason.trim()) {
        setError('Please provide a reason for rejection');
        setLoading(false);
        return;
      }

      if (!(await verifySignature())) {
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
    setSignature('');
    setError('');
    setIpqcCheck(null);
  };

  // Helper function to get stage icon
  const getStageIcon = () => {
    if (!ipqcCheck?.stage_code) return null;
    
    switch (ipqcCheck.stage_code) {
      case 'WATER_TREATMENT':
      case 'PRE_PRODUCTION':
        return <Droplet className="w-5 h-5 text-blue-400" />;
      case 'BOTTLE_BLOW':
        return <Eye className="w-5 h-5 text-purple-400" />;
      case 'RETURNED_BOTTLE_INSPECTION':
        return <Search className="w-5 h-5 text-purple-400" />;
      case 'WASHING':
        return <Droplet className="w-5 h-5 text-blue-400" />;
      case 'FILLING':
        return <Gauge className="w-5 h-5 text-green-400" />;
      case 'CAPPING':
        return <Package className="w-5 h-5 text-yellow-400" />;
      case 'LABELING':
        return <Eye className="w-5 h-5 text-purple-400" />;
      case 'CODING':
        return <FileText className="w-5 h-5 text-indigo-400" />;
      case 'SHRINK_SEAL':
        return <Package className="w-5 h-5 text-orange-400" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-gray-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {getStageIcon()}
                QA Review - {ipqcCheck?.stage_name || 'IPQC Check'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {ipqcCheck?.batch_number} • Check #{ipqcCheck?.check_sequence}
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                resetModal();
              }}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && !ipqcCheck ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading check details...</p>
            </div>
          ) : error && !ipqcCheck ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          ) : ipqcCheck ? (
            <>
              {/* Overall Status */}
              <div className={`p-4 rounded-lg mb-6 ${
                ipqcCheck.all_checks_passed 
                  ? 'bg-green-500/10 border border-green-500/30' 
                  : 'bg-red-500/10 border border-red-500/30'
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
                      {ipqcCheck.stage_category === 'pre_production' ? 'Pre-production verification' : 'In-process quality control'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Basic Info Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                  <p className="text-sm text-gray-400 mb-1">Product</p>
                  <p className="text-white font-medium">{ipqcCheck.product_name}</p>
                </div>

                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                  <p className="text-sm text-gray-400 mb-1">Check Time</p>
                  <p className="text-white font-medium">
                    {new Date(ipqcCheck.check_time).toLocaleString()}
                  </p>
                </div>

                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                  <p className="text-sm text-gray-400 mb-1">Operator</p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <p className="text-white font-medium">{ipqcCheck.operator_name}</p>
                  </div>
                </div>

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

              {/* STAGE-SPECIFIC MEASUREMENTS */}
              
              {/* Water Treatment / Pre-Production */}
              {(ipqcCheck.stage_code === 'WATER_TREATMENT' || ipqcCheck.stage_code === 'PRE_PRODUCTION') && (
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Droplet className="w-5 h-5 text-blue-400" />
                    Water Treatment Parameters
                  </h3>
                  
                  <div className="space-y-3">
                    {ipqcCheck.water_source && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Water Source</span>
                        <span className="text-white font-medium">{ipqcCheck.water_source}</span>
                      </div>
                    )}
                    
                    {ipqcCheck.raw_water_ph !== null && ipqcCheck.raw_water_ph !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Raw Water pH</span>
                        <span className="text-white font-medium">{ipqcCheck.raw_water_ph}</span>
                      </div>
                    )}
                    
                    {ipqcCheck.raw_water_conductivity !== null && ipqcCheck.raw_water_conductivity !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Raw Water Conductivity</span>
                        <span className="text-white font-medium">{ipqcCheck.raw_water_conductivity} µS/cm</span>
                      </div>
                    )}
                    
                    {ipqcCheck.ro_conductivity !== null && ipqcCheck.ro_conductivity !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">RO Conductivity</span>
                        <span className="text-white font-medium">{ipqcCheck.ro_conductivity} µS/cm</span>
                      </div>
                    )}
                    
                    {ipqcCheck.uv_system_status && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">UV System</span>
                        <span className="text-white font-medium">{ipqcCheck.uv_system_status}</span>
                      </div>
                    )}
                    
                    {ipqcCheck.ozone_system_status && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Ozone System</span>
                        <span className="text-white font-medium">{ipqcCheck.ozone_system_status}</span>
                      </div>
                    )}
                    
                    {ipqcCheck.ozone_residual_ppm !== null && ipqcCheck.ozone_residual_ppm !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Ozone Residual</span>
                        <span className="text-white font-medium">{ipqcCheck.ozone_residual_ppm} ppm</span>
                      </div>
                    )}
                    
                    {ipqcCheck.line_clearance_verified !== null && ipqcCheck.line_clearance_verified !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Line Clearance</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${ipqcCheck.line_clearance_verified ? 'text-green-400' : 'text-red-400'}`}>
                            {ipqcCheck.line_clearance_verified ? 'Verified' : 'Not Verified'}
                          </span>
                          {ipqcCheck.line_clearance_verified && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                        </div>
                      </div>
                    )}
                    
                    {ipqcCheck.equipment_cleaned !== null && ipqcCheck.equipment_cleaned !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Equipment Cleaned</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${ipqcCheck.equipment_cleaned ? 'text-green-400' : 'text-red-400'}`}>
                            {ipqcCheck.equipment_cleaned ? 'Yes' : 'No'}
                          </span>
                          {ipqcCheck.equipment_cleaned && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                        </div>
                      </div>
                    )}
                    
                    {ipqcCheck.water_treatment_notes && (
                      <div className="pt-2 border-t border-dark-700">
                        <p className="text-sm text-gray-400 mb-1">Treatment Notes</p>
                        <p className="text-white">{ipqcCheck.water_treatment_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BOTTLE BLOWING */}
              {ipqcCheck.stage_code === 'BOTTLE_BLOW' && (
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-purple-400" />
                    Bottle Blowing & Inspection
                  </h3>
                  
                  <div className="space-y-3">
                    {ipqcCheck.visual_inspection_pass !== null && ipqcCheck.visual_inspection_pass !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Visual Inspection</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${ipqcCheck.visual_inspection_pass ? 'text-green-400' : 'text-red-400'}`}>
                            {ipqcCheck.visual_inspection_pass ? 'Pass' : 'Fail'}
                          </span>
                          {ipqcCheck.visual_inspection_pass ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                      </div>
                    )}
                    
                    {ipqcCheck.bottle_integrity && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Bottle Integrity</span>
                        <span className={`font-medium ${
                          ipqcCheck.bottle_integrity === 'OK' ? 'text-green-400' : 
                          ipqcCheck.bottle_integrity === 'Minor Defects' ? 'text-yellow-400' : 
                          'text-red-400'
                        }`}>
                          {ipqcCheck.bottle_integrity}
                        </span>
                      </div>
                    )}
                    
                    {ipqcCheck.equipment_cleaned !== null && ipqcCheck.equipment_cleaned !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Equipment Cleaned</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${ipqcCheck.equipment_cleaned ? 'text-green-400' : 'text-red-400'}`}>
                            {ipqcCheck.equipment_cleaned ? 'Yes' : 'No'}
                          </span>
                          {ipqcCheck.equipment_cleaned && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                        </div>
                      </div>
                    )}
                    
                    {ipqcCheck.visual_inspection_notes && (
                      <div className="pt-2 border-t border-dark-700">
                        <p className="text-sm text-gray-400 mb-1">Inspection Notes</p>
                        <p className="text-white">{ipqcCheck.visual_inspection_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RETURNED BOTTLE INSPECTION (RE-FILL) */}
              {ipqcCheck.stage_code === 'RETURNED_BOTTLE_INSPECTION' && (
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Search className="w-5 h-5 text-purple-400" />
                    Returned Bottle Inspection (Re-Fill)
                  </h3>
                  
                  <div className="space-y-4">
                    {(() => {
                      const customData = ipqcCheck.stage_custom_data 
                        ? (typeof ipqcCheck.stage_custom_data === 'string' 
                            ? JSON.parse(ipqcCheck.stage_custom_data) 
                            : ipqcCheck.stage_custom_data)
                        : {};
                      
                      return (
                        <>
                          <div className="bg-dark-800 rounded p-3">
                            <p className="text-sm font-semibold text-gray-300 mb-2">Inspection Checklist</p>
                            <div className="space-y-2">
                              {[
                                { key: 'exterior_clean', label: 'Exterior Clean' },
                                { key: 'no_cracks_damage', label: 'No Cracks/Damage' },
                                { key: 'cap_threads_intact', label: 'Cap Threads Intact' },
                                { key: 'base_not_damaged', label: 'Base Not Damaged' },
                                { key: 'no_discoloration', label: 'No Discoloration' },
                                { key: 'no_foreign_odors', label: 'No Foreign Odors' },
                                { key: 'bottles_acceptable', label: 'All Bottles Acceptable' }
                              ].map(item => (
                                customData[item.key] !== undefined && (
                                  <div key={item.key} className="flex items-center justify-between">
                                    <span className="text-gray-400 text-sm">{item.label}</span>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-sm font-medium ${customData[item.key] ? 'text-green-400' : 'text-red-400'}`}>
                                        {customData[item.key] ? 'Pass' : 'Fail'}
                                      </span>
                                      {customData[item.key] ? (
                                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                                      ) : (
                                        <XCircle className="w-4 h-4 text-red-400" />
                                      )}
                                    </div>
                                  </div>
                                )
                              ))}
                            </div>
                          </div>

                          {ipqcCheck.visual_inspection_notes && (
                            <div className="pt-2 border-t border-dark-700">
                              <p className="text-sm text-gray-400 mb-1">Inspection Notes</p>
                              <p className="text-white">{ipqcCheck.visual_inspection_notes}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* WASHING */}
              {ipqcCheck.stage_code === 'WASHING' && (
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Droplet className="w-5 h-5 text-blue-400" />
                    Bottle Washing
                  </h3>
                  
                  <div className="space-y-4">
                    {(() => {
                      const customData = ipqcCheck.stage_custom_data 
                        ? (typeof ipqcCheck.stage_custom_data === 'string' 
                            ? JSON.parse(ipqcCheck.stage_custom_data) 
                            : ipqcCheck.stage_custom_data)
                        : {};
                      
                      return (
                        <>
                          {/* Washing Steps */}
                          <div className="bg-dark-800 rounded p-3">
                            <p className="text-sm font-semibold text-gray-300 mb-2">Washing Steps</p>
                            <div className="space-y-2">
                              {customData.external_wash_complete !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">External Wash</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${customData.external_wash_complete ? 'text-green-400' : 'text-red-400'}`}>
                                      {customData.external_wash_complete ? 'Complete' : 'Incomplete'}
                                    </span>
                                    {customData.external_wash_complete && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  </div>
                                </div>
                              )}
                              
                              {customData.internal_wash_complete !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">Internal Wash</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${customData.internal_wash_complete ? 'text-green-400' : 'text-red-400'}`}>
                                      {customData.internal_wash_complete ? 'Complete' : 'Incomplete'}
                                    </span>
                                    {customData.internal_wash_complete && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  </div>
                                </div>
                              )}
                              
                              {customData.sterilant_wash_complete !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">Sterilant Wash</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${customData.sterilant_wash_complete ? 'text-green-400' : 'text-red-400'}`}>
                                      {customData.sterilant_wash_complete ? 'Complete' : 'Incomplete'}
                                    </span>
                                    {customData.sterilant_wash_complete && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  </div>
                                </div>
                              )}
                              
                              {customData.final_rinse_complete !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">Final Rinse</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${customData.final_rinse_complete ? 'text-green-400' : 'text-red-400'}`}>
                                      {customData.final_rinse_complete ? 'Complete' : 'Incomplete'}
                                    </span>
                                    {customData.final_rinse_complete && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Water Quality */}
                          {(ipqcCheck.fill_temperature !== null || customData.rinse_temperature !== null) && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400">Rinse Temperature</span>
                                <span className="text-white font-medium">
                                  {ipqcCheck.fill_temperature || customData.rinse_temperature} °C
                                </span>
                              </div>
                              
                              {(ipqcCheck.fill_volume_within_spec !== null || customData.temperature_within_spec !== null) && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400">Temperature Status</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`font-medium ${
                                      (ipqcCheck.fill_volume_within_spec || customData.temperature_within_spec) 
                                        ? 'text-green-400' 
                                        : 'text-red-400'
                                    }`}>
                                      {(ipqcCheck.fill_volume_within_spec || customData.temperature_within_spec) 
                                        ? 'Within Spec' 
                                        : 'Out of Spec'}
                                    </span>
                                    {(ipqcCheck.fill_volume_within_spec || customData.temperature_within_spec) && (
                                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sterilant Type */}
                          {customData.sterilant_type && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Sterilant Type</span>
                              <span className="text-white font-medium">{customData.sterilant_type}</span>
                            </div>
                          )}

                          {/* Post-Wash Verification */}
                          <div className="bg-dark-800 rounded p-3">
                            <p className="text-sm font-semibold text-gray-300 mb-2">Post-Wash Verification</p>
                            <div className="space-y-2">
                              {ipqcCheck.visual_inspection_pass !== null && ipqcCheck.visual_inspection_pass !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">Bottles Visually Clean</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${ipqcCheck.visual_inspection_pass ? 'text-green-400' : 'text-red-400'}`}>
                                      {ipqcCheck.visual_inspection_pass ? 'Yes' : 'No'}
                                    </span>
                                    {ipqcCheck.visual_inspection_pass && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  </div>
                                </div>
                              )}
                              
                              {ipqcCheck.equipment_cleaned !== null && ipqcCheck.equipment_cleaned !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">Equipment Cleaned</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${ipqcCheck.equipment_cleaned ? 'text-green-400' : 'text-red-400'}`}>
                                      {ipqcCheck.equipment_cleaned ? 'Yes' : 'No'}
                                    </span>
                                    {ipqcCheck.equipment_cleaned && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Washing Notes */}
                          {ipqcCheck.visual_inspection_notes && (
                            <div className="pt-2 border-t border-dark-700">
                              <p className="text-sm text-gray-400 mb-1">Washing Notes</p>
                              <p className="text-white">{ipqcCheck.visual_inspection_notes}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Filling Stage */}
              {(ipqcCheck.stage_code === 'FILLING' && ipqcCheck.fill_volume_ml !== null) && (
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-green-400" />
                    Filling Parameters
                  </h3>
                  
                  <div className="space-y-3">
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
                    
                    {ipqcCheck.fill_pressure !== null && ipqcCheck.fill_pressure !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Fill Pressure</span>
                        <span className="text-white font-medium">{ipqcCheck.fill_pressure} MPa</span>
                      </div>
                    )}
                    {ipqcCheck.rinsing_pressure !== null && ipqcCheck.rinsing_pressure !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Rinsing Pressure</span>
                        <span className="text-white font-medium">{ipqcCheck.rinsing_pressure} MPa</span>
                      </div>
                    )}
                    {ipqcCheck.fill_temperature !== null && ipqcCheck.fill_temperature !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Fill Temperature</span>
                        <span className="text-white font-medium">{ipqcCheck.fill_temperature} °C</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Capping Stage */}
              {(ipqcCheck.stage_code === 'CAPPING' && ipqcCheck.cap_torque_nm !== null) && (
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-yellow-400" />
                    Capping Parameters
                  </h3>
                  
                  <div className="space-y-3">
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
              )}

              {/* Labeling / Visual Inspection Stage */}
              {(ipqcCheck.stage_code === 'LABELING' && ipqcCheck.visual_inspection_pass !== null) && (
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-purple-400" />
                    Visual Inspections
                  </h3>
                  
                  <div className="space-y-3">
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
                    
                    {ipqcCheck.label_position_correct !== null && ipqcCheck.label_position_correct !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Label Position</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${
                            ipqcCheck.label_position_correct ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {ipqcCheck.label_position_correct ? 'Correct' : 'Incorrect'}
                          </span>
                          {ipqcCheck.label_position_correct && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                        </div>
                      </div>
                    )}
                    
                    {ipqcCheck.bottle_integrity && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Bottle Integrity</span>
                        <span className="text-white font-medium">{ipqcCheck.bottle_integrity}</span>
                      </div>
                    )}
                    
                    {ipqcCheck.visual_inspection_notes && (
                      <div className="pt-2 border-t border-dark-700">
                        <p className="text-sm text-gray-400 mb-1">Inspection Notes</p>
                        <p className="text-white">{ipqcCheck.visual_inspection_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Coding Stage */}
              {(ipqcCheck.stage_code === 'CODING' && ipqcCheck.coding_legible !== null) && (
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    Coding & Traceability
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Coding Legible</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${
                          ipqcCheck.coding_legible ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {ipqcCheck.coding_legible ? 'Yes' : 'No'}
                        </span>
                        {ipqcCheck.coding_legible && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                      </div>
                    </div>
                    
                    {ipqcCheck.tamper_evidence && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Tamper Evidence</span>
                        <span className="text-white font-medium">{ipqcCheck.tamper_evidence}</span>
                      </div>
                    )}
                    
                    {ipqcCheck.coding_notes && (
                      <div className="pt-2 border-t border-dark-700">
                        <p className="text-sm text-gray-400 mb-1">Coding Notes</p>
                        <p className="text-white">{ipqcCheck.coding_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Shrink Cap Sealing Stage */}
              {ipqcCheck.stage_code === 'SHRINK_SEAL' && (
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-orange-400" />
                    Shrink Cap Sealing
                  </h3>
                  
                  <div className="space-y-4">
                    {(() => {
                      const customData = ipqcCheck.stage_custom_data 
                        ? (typeof ipqcCheck.stage_custom_data === 'string' 
                            ? JSON.parse(ipqcCheck.stage_custom_data) 
                            : ipqcCheck.stage_custom_data)
                        : {};
                      
                      return (
                        <>
                          {/* Process Steps Section */}
                          <div className="bg-dark-800 rounded p-3">
                            <p className="text-sm font-semibold text-gray-300 mb-2">Process Steps</p>
                            <div className="space-y-2">
                              {customData.tamper_sticker_applied !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">Tamper Sticker Applied</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${customData.tamper_sticker_applied ? 'text-green-400' : 'text-red-400'}`}>
                                      {customData.tamper_sticker_applied ? 'Yes' : 'No'}
                                    </span>
                                    {customData.tamper_sticker_applied && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  </div>
                                </div>
                              )}
                              
                              {customData.shrink_sleeve_applied !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">Shrink Sleeve Applied</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${customData.shrink_sleeve_applied ? 'text-green-400' : 'text-red-400'}`}>
                                      {customData.shrink_sleeve_applied ? 'Yes' : 'No'}
                                    </span>
                                    {customData.shrink_sleeve_applied && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  </div>
                                </div>
                              )}
                              
                              {customData.expiry_date_etched !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">Expiry Date Etched</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${customData.expiry_date_etched ? 'text-green-400' : 'text-red-400'}`}>
                                      {customData.expiry_date_etched ? 'Yes' : 'No'}
                                    </span>
                                    {customData.expiry_date_etched && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  </div>
                                </div>
                              )}
                              
                              {customData.expiry_date_legible !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">Expiry Date Legible</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${customData.expiry_date_legible ? 'text-green-400' : 'text-red-400'}`}>
                                      {customData.expiry_date_legible ? 'Yes' : 'No'}
                                    </span>
                                    {customData.expiry_date_legible && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  </div>
                                </div>
                              )}
                              
                              {customData.pvc_film_applied !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">PVC Film Applied</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${customData.pvc_film_applied ? 'text-green-400' : 'text-red-400'}`}>
                                      {customData.pvc_film_applied ? 'Yes' : 'No'}
                                    </span>
                                    {customData.pvc_film_applied && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  </div>
                                </div>
                              )}
                              
                              {customData.shrink_seal_complete !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400 text-sm">Shrink Seal Complete</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${customData.shrink_seal_complete ? 'text-green-400' : 'text-red-400'}`}>
                                      {customData.shrink_seal_complete ? 'Yes' : 'No'}
                                    </span>
                                    {customData.shrink_seal_complete && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Seal Appearance */}
                          {customData.seal_appearance && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Seal Appearance</span>
                              <span className={`font-medium ${
                                customData.seal_appearance === 'Smooth - No Wrinkles' ? 'text-green-400' : 
                                customData.seal_appearance === 'Minor Wrinkles' ? 'text-yellow-400' : 
                                'text-red-400'
                              }`}>
                                {customData.seal_appearance}
                              </span>
                            </div>
                          )}

                          {/* Final Inspection */}
                          {ipqcCheck.visual_inspection_pass !== null && ipqcCheck.visual_inspection_pass !== undefined && (
                            <div className="bg-dark-800 rounded p-3">
                              <p className="text-sm font-semibold text-gray-300 mb-2">Final Inspection</p>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400 text-sm">Visual Inspection</span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-medium ${ipqcCheck.visual_inspection_pass ? 'text-green-400' : 'text-red-400'}`}>
                                    {ipqcCheck.visual_inspection_pass ? 'Pass' : 'Fail'}
                                  </span>
                                  {ipqcCheck.visual_inspection_pass ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-400" />
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Shrink Seal Notes */}
                          {ipqcCheck.visual_inspection_notes && (
                            <div className="pt-2 border-t border-dark-700">
                              <p className="text-sm text-gray-400 mb-1">Shrink Seal Notes</p>
                              <p className="text-white">{ipqcCheck.visual_inspection_notes}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* General Notes (Always Show) */}
              {ipqcCheck.notes && (
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 mb-6">
                  <h3 className="text-white font-semibold mb-2">Additional Notes</h3>
                  <p className="text-gray-300">{ipqcCheck.notes}</p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              {/* QA ACTIONS & DIGITAL SIGNATURE BLOCK */}
              {!action ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => setAction('approve')}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Approve Check
                  </button>
                  <button
                    onClick={() => setAction('reject')}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject Check
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-200">
                  
                  {action === 'reject' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Rejection Reason *
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                        rows={3}
                        placeholder="Please detail why this check is being rejected..."
                        required
                      />
                    </div>
                  )}

                  {/* 21 CFR Part 11 Digital Signature Block */}
                  <div className="bg-dark-900 rounded-lg p-5 border border-dark-700 shadow-inner">
                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <Key className="w-4 h-4 text-primary-400" />
                      QA Electronic Signature Required
                    </h3>
                    <p className="text-xs text-gray-400 mb-3">
                      By entering your password, you electronically sign off on this QA {action === 'approve' ? 'approval' : 'rejection'} per 21 CFR Part 11 guidelines.
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

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setAction(null); setRejectionReason(''); setSignature(''); }}
                      disabled={loading}
                      className="flex-1 px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    {action === 'approve' ? (
                      <button
                        onClick={handleApprove}
                        disabled={loading || !signature}
                        className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? 'Verifying...' : <><CheckCircle2 className="w-5 h-5"/> Sign & Approve</>}
                      </button>
                    ) : (
                      <button
                        onClick={handleReject}
                        disabled={loading || !signature || !rejectionReason.trim()}
                        className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? 'Verifying...' : <><XCircle className="w-5 h-5"/> Sign & Reject</>}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}