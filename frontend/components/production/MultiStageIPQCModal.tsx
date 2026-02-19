// ============================================================================
// MULTI-STAGE IPQC MODAL COMPONENT
// Dynamic forms based on production stage
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { api } from '@/hooks/useAuth';
import { X, Droplet, Gauge, Package, Eye, FileText, CheckCircle, AlertCircle, Search } from 'lucide-react';

interface MultiStageIPQCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  batchId: string;
  batchNumber: string;
  productId: string;
  productName: string;
  nextStage: {
    next_stage_sequence: number;
    next_stage_name: string;
    next_stage_code: string;
    next_stage_category: string;
    next_stage_id: string;
    stage_details: any;
  } | null;
  token?: string | null; // Added support for prop-based token
}

export default function MultiStageIPQCModal({
  isOpen,
  onClose,
  onSuccess,
  batchId,
  batchNumber,
  productId,
  productName,
  nextStage
}: MultiStageIPQCModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form data - all possible fields for all stages
  const [formData, setFormData] = useState({
    // Common
    check_time: new Date().toISOString().slice(0, 16),
    notes: '',
    
    // Stage 1: Water Treatment
    water_source: 'Borehole',
    raw_water_ph: '',
    raw_water_conductivity: '',
    ro_conductivity: '',
    uv_system_status: 'ON',
    ozone_system_status: 'Active',
    ozone_residual_ppm: '',
    water_treatment_approved: true,
    water_treatment_notes: '',
    line_clearance_verified: false,
    equipment_cleaned: false,

    // Bottle Washing fields (Stage 3 for 5-gallon)
    external_wash_complete: false,
    internal_wash_complete: false,
    sterilant_wash_complete: false,
    rinse_temperature: '',
    temperature_within_spec: true,
    sterilant_type: 'Chlorine Solution',
    final_rinse_complete: false,
    bottles_visually_clean: false,
    washing_equipment_cleaned: false,
    washing_notes: '',
    
    // Stage 2: Filling
    fill_volume_ml: '',
    fill_volume_within_spec: true,
    fill_temperature: '',
    fill_pressure: '',
    rinsing_pressure: '',
    
    // Stage 3: Capping
    cap_torque_nm: '',
    cap_torque_within_spec: true,
    
    // Stage 4: Labeling & Visual
    visual_inspection_pass: true,
    visual_inspection_notes: '',
    label_position_correct: true,
    label_position_notes: '',
    bottle_integrity: 'OK',
    seal_integrity: 'OK',
    
    // Stage 5: Coding
    coding_legible: true,
    coding_notes: '',
    tamper_evidence: 'OK',

    // Stage 6: Shrink Cap Sealing (5-gallon only)
    tamper_sticker_applied: false,
    shrink_sleeve_applied: false,
    expiry_date_etched: false,
    expiry_date_legible: true,
    pvc_film_applied: false,
    shrink_seal_complete: false,
    seal_appearance: 'Smooth - No Wrinkles',
    final_visual_inspection: true,
    shrink_seal_notes: '',

    // RETURNED_BOTTLE_INSPECTION fields (for Re-Fill products)
    exterior_clean: false,
    no_cracks_damage: false,
    cap_threads_intact: false,
    base_not_damaged: false,
    no_discoloration: false,
    no_foreign_odors: false,
    bottles_acceptable: false,
    returned_bottle_notes: ''
  });

  // Reset form when stage changes
  useEffect(() => {
    if (nextStage) {
      setFormData(prev => ({
        ...prev,
        check_time: new Date().toISOString().slice(0, 16)
      }));
    }
  }, [nextStage]);

  if (!isOpen || !nextStage) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Build payload based on stage
      const payload: any = {
        stage_id: nextStage.next_stage_id,
        stage_sequence: nextStage.next_stage_sequence,
        stage_name: nextStage.next_stage_name,
        stage_code: nextStage.next_stage_code,  
        stage_category: nextStage.next_stage_category,
        check_time: formData.check_time,
        notes: formData.notes,
        all_checks_passed: true
      };

      // Add stage-specific fields
      if (nextStage.next_stage_code === 'WATER_TREATMENT' || nextStage.next_stage_code === 'PRE_PRODUCTION') {
        // Water treatment verification (Stage 1 for all products)
        payload.water_source = formData.water_source;
        payload.raw_water_ph = parseFloat(formData.raw_water_ph);
        payload.raw_water_conductivity = parseFloat(formData.raw_water_conductivity);
        payload.ro_conductivity = parseFloat(formData.ro_conductivity);
        payload.uv_system_status = formData.uv_system_status;
        payload.ozone_system_status = formData.ozone_system_status;
        payload.ozone_residual_ppm = parseFloat(formData.ozone_residual_ppm);
        payload.water_treatment_approved = formData.water_treatment_approved;
        payload.water_treatment_notes = formData.water_treatment_notes;
        payload.line_clearance_verified = formData.line_clearance_verified;
        payload.equipment_cleaned = formData.equipment_cleaned;
      } 
      else if (nextStage.next_stage_code === 'BOTTLE_BLOW') {
        // Bottle blowing & inspection (Stage 2 for 5-gallon)
        payload.visual_inspection_pass = formData.visual_inspection_pass;
        payload.visual_inspection_notes = formData.visual_inspection_notes;
        payload.bottle_integrity = formData.bottle_integrity;
        payload.equipment_cleaned = formData.equipment_cleaned;
      }
      else if (nextStage.next_stage_code === 'RETURNED_BOTTLE_INSPECTION') {
        // Store inspection checklist in stage_custom_data
        payload.stage_custom_data = {
          exterior_clean: formData.exterior_clean,
          no_cracks_damage: formData.no_cracks_damage,
          cap_threads_intact: formData.cap_threads_intact,
          base_not_damaged: formData.base_not_damaged,
          no_discoloration: formData.no_discoloration,
          no_foreign_odors: formData.no_foreign_odors,
          bottles_acceptable: formData.bottles_acceptable
        };
        
        // Map to standard fields for compatibility
        payload.visual_inspection_pass = formData.bottles_acceptable;
        payload.visual_inspection_notes = formData.returned_bottle_notes;
        payload.bottle_integrity = formData.no_cracks_damage && formData.base_not_damaged ? 'OK' : 'Compromised';
      }
      else if (nextStage.next_stage_code === 'WASHING') {
        // Bottle washing (Stage 3 for 5-gallon)
        payload.stage_custom_data = {
          external_wash_complete: formData.external_wash_complete,
          internal_wash_complete: formData.internal_wash_complete,
          sterilant_wash_complete: formData.sterilant_wash_complete,
          rinse_temperature: formData.rinse_temperature ? parseFloat(formData.rinse_temperature) : null,
          temperature_within_spec: formData.temperature_within_spec,
          sterilant_type: formData.sterilant_type,
          final_rinse_complete: formData.final_rinse_complete,
          bottles_visually_clean: formData.bottles_visually_clean
        };
        
        // Use main fields where applicable
        payload.equipment_cleaned = formData.washing_equipment_cleaned;
        payload.visual_inspection_pass = formData.bottles_visually_clean;
        payload.visual_inspection_notes = formData.washing_notes;
        
        // Repurpose temperature fields for washing
        payload.fill_temperature = formData.rinse_temperature ? parseFloat(formData.rinse_temperature) : null;
        payload.fill_volume_within_spec = formData.temperature_within_spec;
      }
      else if (nextStage.next_stage_code === 'FILLING') {
        payload.fill_volume_ml = parseFloat(formData.fill_volume_ml);
        payload.fill_volume_within_spec = formData.fill_volume_within_spec;
        payload.fill_temperature = formData.fill_temperature ? parseFloat(formData.fill_temperature) : null;
        payload.fill_pressure = formData.fill_pressure ? parseFloat(formData.fill_pressure) : null;
        payload.rinsing_pressure = formData.rinsing_pressure ? parseFloat(formData.rinsing_pressure) : null;
      } 
      else if (nextStage.next_stage_code === 'CAPPING') {
        payload.cap_torque_nm = parseFloat(formData.cap_torque_nm);
        payload.cap_torque_within_spec = formData.cap_torque_within_spec;
      } 
      else if (nextStage.next_stage_code === 'LABELING') {
        payload.visual_inspection_pass = formData.visual_inspection_pass;
        payload.visual_inspection_notes = formData.visual_inspection_notes;
        payload.label_position_correct = formData.label_position_correct;
        payload.label_position_notes = formData.label_position_notes;
        payload.bottle_integrity = formData.bottle_integrity;
        payload.seal_integrity = formData.seal_integrity;
      } 
      else if (nextStage.next_stage_code === 'CODING') {
        payload.coding_legible = formData.coding_legible;
        payload.coding_notes = formData.coding_notes;
        payload.tamper_evidence = formData.tamper_evidence;
      }
      else if (nextStage.next_stage_code === 'SHRINK_SEAL') {
        // Detailed Debug Logging
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 SHRINK_SEAL - Building payload');
        console.log('Step 1: Check formData values:');
        console.log('  tamper_sticker_applied:', formData.tamper_sticker_applied, typeof formData.tamper_sticker_applied);
        console.log('  shrink_sleeve_applied:', formData.shrink_sleeve_applied, typeof formData.shrink_sleeve_applied);
        console.log('  expiry_date_etched:', formData.expiry_date_etched, typeof formData.expiry_date_etched);
        console.log('  expiry_date_legible:', formData.expiry_date_legible, typeof formData.expiry_date_legible);
        console.log('  pvc_film_applied:', formData.pvc_film_applied, typeof formData.pvc_film_applied);
        console.log('  shrink_seal_complete:', formData.shrink_seal_complete, typeof formData.shrink_seal_complete);
        console.log('  seal_appearance:', formData.seal_appearance, typeof formData.seal_appearance);
        console.log('  final_visual_inspection:', formData.final_visual_inspection, typeof formData.final_visual_inspection);
        console.log('  shrink_seal_notes:', formData.shrink_seal_notes, typeof formData.shrink_seal_notes);
        
        // Shrink cap sealing (Stage 6 for 5-gallon)
        payload.stage_custom_data = {
          tamper_sticker_applied: formData.tamper_sticker_applied,
          shrink_sleeve_applied: formData.shrink_sleeve_applied,
          expiry_date_etched: formData.expiry_date_etched,
          expiry_date_legible: formData.expiry_date_legible,
          pvc_film_applied: formData.pvc_film_applied,
          shrink_seal_complete: formData.shrink_seal_complete,
          seal_appearance: formData.seal_appearance
        };
        
        console.log('Step 2: Built stage_custom_data object:');
        console.log('  payload.stage_custom_data:', payload.stage_custom_data);
        console.log('  JSON.stringify:', JSON.stringify(payload.stage_custom_data));
        
        // Map to main database fields
        payload.visual_inspection_pass = formData.final_visual_inspection;
        payload.visual_inspection_notes = formData.shrink_seal_notes;
        payload.seal_integrity = formData.seal_appearance === 'Smooth - No Wrinkles' ? 'OK' : 'Compromised';
        payload.tamper_evidence = formData.tamper_sticker_applied ? 'OK' : 'Not Visible';
        
        console.log('Step 3: Complete payload:');
        console.log('  Full payload:', JSON.stringify(payload, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }

      await api.post(
        `/production/batches/${batchId}/ipqc/multi-stage`,
        payload
      );

      onSuccess();
    } catch (err: any) {
      console.error('Error recording IPQC:', err);
      setError(err.response?.data?.message || 'Failed to record IPQC check');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Get icon for current stage
  const getStageIcon = () => {
    switch (nextStage.next_stage_code) {
      case 'WATER_TREATMENT':
      case 'PRE_PRODUCTION':
        return <Droplet className="w-5 h-5" />;
      case 'BOTTLE_BLOW':
      case 'WASHING':
        return <Eye className="w-5 h-5" />;
      case 'RETURNED_BOTTLE_INSPECTION':
        return <Search className="w-5 h-5" />;
      case 'FILLING': return <Gauge className="w-5 h-5" />;
      case 'CAPPING': return <Package className="w-5 h-5" />;
      case 'LABELING': return <Eye className="w-5 h-5" />;
      case 'CODING': return <FileText className="w-5 h-5" />;
      case 'SHRINK_SEAL': return <Package className="w-5 h-5" />;
      default: return <CheckCircle className="w-5 h-5" />;
    }
  };

  // Get color for current stage
  const getStageColor = () => {
    switch (nextStage.next_stage_code) {
      case 'WATER_TREATMENT':
      case 'PRE_PRODUCTION':
        return 'blue';
      case 'BOTTLE_BLOW':
      case 'WASHING':
        return 'purple';
      case 'RETURNED_BOTTLE_INSPECTION':
        return 'purple';
      case 'FILLING': return 'green';
      case 'CAPPING': return 'yellow';
      case 'LABELING': return 'purple';
      case 'CODING': return 'indigo';
      case 'SHRINK_SEAL': return 'orange';
      default: return 'gray';
    }
  };

  const stageColor = getStageColor();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`p-6 border-b border-dark-700 bg-${stageColor}-500/10`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-${stageColor}-500/20 rounded-lg text-${stageColor}-400`}>
                {getStageIcon()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {nextStage.next_stage_name}
                </h2>
                <p className="text-sm text-gray-400">
                  Stage {nextStage.next_stage_sequence} • {nextStage.next_stage_category}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>Batch: {batchNumber}</span>
            <span>•</span>
            <span>{productName}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-400 text-sm font-medium">Error</p>
                <p className="text-red-400/80 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Common Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Check Time
              </label>
              <input
                type="datetime-local"
                value={formData.check_time}
                onChange={(e) => handleChange('check_time', e.target.value)}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          </div>

          {/* STAGE 1: WATER TREATMENT / PRE-PRODUCTION */}
          {(nextStage.next_stage_code === 'WATER_TREATMENT' || nextStage.next_stage_code === 'PRE_PRODUCTION') && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Droplet className="w-5 h-5 text-blue-400" />
                Water Treatment Parameters
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Water Source
                  </label>
                  <select
                    value={formData.water_source}
                    onChange={(e) => handleChange('water_source', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Borehole">Borehole</option>
                    <option value="Municipal">Municipal</option>
                    <option value="Surface Water">Surface Water</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Raw Water pH
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.raw_water_ph}
                    onChange={(e) => handleChange('raw_water_ph', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 7.2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Raw Water Conductivity (µS/cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.raw_water_conductivity}
                    onChange={(e) => handleChange('raw_water_conductivity', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 450"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    RO Conductivity (µS/cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.ro_conductivity}
                    onChange={(e) => handleChange('ro_conductivity', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="≤ 50 µS/cm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    UV System Status
                  </label>
                  <select
                    value={formData.uv_system_status}
                    onChange={(e) => handleChange('uv_system_status', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ON">ON / Intensity OK</option>
                    <option value="OFF">OFF</option>
                    <option value="Low Intensity">Low Intensity</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ozone System Status
                  </label>
                  <select
                    value={formData.ozone_system_status}
                    onChange={(e) => handleChange('ozone_system_status', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ozone Residual (ppm)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.ozone_residual_ppm}
                    onChange={(e) => handleChange('ozone_residual_ppm', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.1 - 0.3 ppm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.line_clearance_verified}
                    onChange={(e) => handleChange('line_clearance_verified', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Line Clearance Verified</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.equipment_cleaned}
                    onChange={(e) => handleChange('equipment_cleaned', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Equipment Cleaned & Ready</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.water_treatment_approved}
                    onChange={(e) => handleChange('water_treatment_approved', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Water Treatment Approved for Production</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Water Treatment Notes
                </label>
                <textarea
                  value={formData.water_treatment_notes}
                  onChange={(e) => handleChange('water_treatment_notes', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Any observations or deviations..."
                />
              </div>
            </div>
          )}

          {/* STAGE 2: BOTTLE BLOWING & INSPECTION */}
          {nextStage.next_stage_code === 'BOTTLE_BLOW' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-400" />
                Bottle Blowing & Inspection
              </h3>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.visual_inspection_pass}
                    onChange={(e) => handleChange('visual_inspection_pass', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-purple-500 focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-300">Visual Inspection PASS</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.equipment_cleaned}
                    onChange={(e) => handleChange('equipment_cleaned', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-purple-500 focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-300">Equipment Cleaned & Ready</span>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bottle Integrity
                  </label>
                  <select
                    value={formData.bottle_integrity}
                    onChange={(e) => handleChange('bottle_integrity', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="OK">OK - No Defects</option>
                    <option value="Minor Defects">Minor Defects</option>
                    <option value="Major Defects">Major Defects</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Inspection Notes
                </label>
                <textarea
                  value={formData.visual_inspection_notes}
                  onChange={(e) => handleChange('visual_inspection_notes', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={2}
                  placeholder="Any defects or observations..."
                />
              </div>
            </div>
          )}

          {/* STAGE 2: RETURNED BOTTLE INSPECTION (Re-Fill) */}
          {nextStage.next_stage_code === 'RETURNED_BOTTLE_INSPECTION' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-purple-400" />
                Returned Bottle Inspection (Re-Fill)
              </h3>
              
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <p className="text-sm text-purple-300 mb-3">
                  Inspect returned 5-gallon bottles before refilling. All items must pass inspection.
                </p>
                
                <div className="space-y-3">
                  {/* Exterior Clean */}
                  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.exterior_clean}
                      onChange={(e) => setFormData({ ...formData, exterior_clean: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex-1">Bottle exterior is clean (no dirt, old labels removed)</span>
                  </label>

                  {/* No Cracks/Damage */}
                  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.no_cracks_damage}
                      onChange={(e) => setFormData({ ...formData, no_cracks_damage: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex-1">No visible cracks or structural damage</span>
                  </label>

                  {/* Cap Threads */}
                  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.cap_threads_intact}
                      onChange={(e) => setFormData({ ...formData, cap_threads_intact: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex-1">Cap threads are intact (not stripped or damaged)</span>
                  </label>

                  {/* Base Not Damaged */}
                  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.base_not_damaged}
                      onChange={(e) => setFormData({ ...formData, base_not_damaged: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex-1">Bottle base/bottom is not damaged or cracked</span>
                  </label>

                  {/* No Discoloration */}
                  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.no_discoloration}
                      onChange={(e) => setFormData({ ...formData, no_discoloration: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex-1">No discoloration or cloudiness in plastic</span>
                  </label>

                  {/* No Foreign Odors */}
                  <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.no_foreign_odors}
                      onChange={(e) => setFormData({ ...formData, no_foreign_odors: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex-1">No foreign odors detected</span>
                  </label>

                  {/* Final Acceptance */}
                  <div className="pt-3 mt-3 border-t border-purple-500/20">
                    <label className="flex items-center gap-3 text-white cursor-pointer hover:bg-dark-700 p-2 rounded transition-colors font-medium">
                      <input
                        type="checkbox"
                        checked={formData.bottles_acceptable}
                        onChange={(e) => setFormData({ ...formData, bottles_acceptable: e.target.checked })}
                        className="w-5 h-5 rounded border-dark-600 text-purple-500 focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="flex-1">✓ All bottles in batch are acceptable for refilling</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Inspection Notes (Optional)
                </label>
                <textarea
                  value={formData.returned_bottle_notes}
                  onChange={(e) => setFormData({ ...formData, returned_bottle_notes: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Note any bottles rejected, issues found, or other observations..."
                />
              </div>
            </div>
          )}

          {/* STAGE 3: BOTTLE WASHING - NEW FORM */}
          {nextStage.next_stage_code === 'WASHING' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Droplet className="w-5 h-5 text-blue-400" />
                Bottle Washing
              </h3>

              {/* Washing Steps */}
              <div className="space-y-3 bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-sm font-semibold text-gray-300 mb-2">Washing Steps</p>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.external_wash_complete}
                    onChange={(e) => handleChange('external_wash_complete', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">External Wash Complete</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.internal_wash_complete}
                    onChange={(e) => handleChange('internal_wash_complete', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Internal Wash Complete</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.sterilant_wash_complete}
                    onChange={(e) => handleChange('sterilant_wash_complete', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Sterilant Wash Complete</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.final_rinse_complete}
                    onChange={(e) => handleChange('final_rinse_complete', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Final Rinse Complete</span>
                </label>
              </div>

              {/* Water Quality */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rinse Water Temperature (°C) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.rinse_temperature}
                    onChange={(e) => handleChange('rinse_temperature', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="60-80°C"
                    required
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      checked={formData.temperature_within_spec}
                      onChange={(e) => handleChange('temperature_within_spec', e.target.checked)}
                      className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">Temperature Within Spec</span>
                  </label>
                </div>
              </div>

              {/* Sterilant */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sterilant Type
                </label>
                <select
                  value={formData.sterilant_type}
                  onChange={(e) => handleChange('sterilant_type', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Chlorine Solution">Chlorine Solution</option>
                  <option value="Hydrogen Peroxide">Hydrogen Peroxide</option>
                  <option value="Peracetic Acid">Peracetic Acid</option>
                  <option value="Ozone">Ozone</option>
                </select>
              </div>

              {/* Post-Wash Checks */}
              <div className="space-y-3 bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-sm font-semibold text-gray-300 mb-2">Post-Wash Verification</p>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.bottles_visually_clean}
                    onChange={(e) => handleChange('bottles_visually_clean', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Bottles Visually Clean</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.washing_equipment_cleaned}
                    onChange={(e) => handleChange('washing_equipment_cleaned', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Washing Equipment Cleaned & Ready</span>
                </label>
              </div>

              {/* Washing Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Washing Notes
                </label>
                <textarea
                  value={formData.washing_notes}
                  onChange={(e) => handleChange('washing_notes', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Any observations or issues during washing..."
                />
              </div>
            </div>
          )}

          {/* STAGE: FILLING */}
          {nextStage.next_stage_code === 'FILLING' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Gauge className="w-5 h-5 text-green-400" />
                Filling Parameters
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Fill Volume (ml) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.fill_volume_ml}
                    onChange={(e) => handleChange('fill_volume_ml', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., 500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Fill Pressure (MPa)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fill_pressure}
                    onChange={(e) => handleChange('fill_pressure', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., 0.35"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rinsing Pressure (MPa)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.rinsing_pressure}
                    onChange={(e) => handleChange('rinsing_pressure', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="≥ 0.3 MPa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Fill Temperature (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.fill_temperature}
                    onChange={(e) => handleChange('fill_temperature', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ambient"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.fill_volume_within_spec}
                  onChange={(e) => handleChange('fill_volume_within_spec', e.target.checked)}
                  className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-green-500 focus:ring-2 focus:ring-green-500"
                />
                <span className="text-sm text-gray-300">Fill Volume Within Specification</span>
              </label>
            </div>
          )}

          {/* STAGE 3: CAPPING */}
          {nextStage.next_stage_code === 'CAPPING' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-yellow-400" />
                Capping Parameters
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Cap Torque (Nm) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cap_torque_nm}
                    onChange={(e) => handleChange('cap_torque_nm', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="0.8 - 1.2 Nm"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.cap_torque_within_spec}
                  onChange={(e) => handleChange('cap_torque_within_spec', e.target.checked)}
                  className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-yellow-500 focus:ring-2 focus:ring-yellow-500"
                />
                <span className="text-sm text-gray-300">Cap Torque Within Specification</span>
              </label>
            </div>
          )}

          {/* STAGE 4: LABELING & VISUAL */}
          {nextStage.next_stage_code === 'LABELING' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-400" />
                Labeling & Visual Inspection
              </h3>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.visual_inspection_pass}
                    onChange={(e) => handleChange('visual_inspection_pass', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-purple-500 focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-300">Visual Inspection PASS</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.label_position_correct}
                    onChange={(e) => handleChange('label_position_correct', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-purple-500 focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-300">Label Position Correct</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bottle Integrity
                  </label>
                  <select
                    value={formData.bottle_integrity}
                    onChange={(e) => handleChange('bottle_integrity', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="OK">OK - No Defects</option>
                    <option value="Minor Defects">Minor Defects</option>
                    <option value="Major Defects">Major Defects</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Seal Integrity
                  </label>
                  <select
                    value={formData.seal_integrity}
                    onChange={(e) => handleChange('seal_integrity', e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="OK">OK - Intact</option>
                    <option value="Compromised">Compromised</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Visual Inspection Notes
                </label>
                <textarea
                  value={formData.visual_inspection_notes}
                  onChange={(e) => handleChange('visual_inspection_notes', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={2}
                  placeholder="Any defects or observations..."
                />
              </div>
            </div>
          )}

          {/* STAGE 5: CODING */}
          {nextStage.next_stage_code === 'CODING' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Coding & Traceability
              </h3>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.coding_legible}
                    onChange={(e) => handleChange('coding_legible', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-300">Coding Legible & Clear</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tamper Evidence
                </label>
                <select
                  value={formData.tamper_evidence}
                  onChange={(e) => handleChange('tamper_evidence', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="OK">OK - Visible</option>
                  <option value="Not Visible">Not Visible</option>
                  <option value="Compromised">Compromised</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Coding Notes
                </label>
                <textarea
                  value={formData.coding_notes}
                  onChange={(e) => handleChange('coding_notes', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Batch code, expiry date verified..."
                />
              </div>
            </div>
          )}

          {/* STAGE 6: SHRINK CAP SEALING (5-Gallon) */}
          {nextStage.next_stage_code === 'SHRINK_SEAL' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-400" />
                Shrink Cap Sealing
              </h3>

              {/* Process Steps */}
              <div className="space-y-3 bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-sm font-semibold text-gray-300 mb-2">Process Steps</p>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.tamper_sticker_applied}
                    onChange={(e) => handleChange('tamper_sticker_applied', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-300">Tamper Evidence Sticker Applied</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.shrink_sleeve_applied}
                    onChange={(e) => handleChange('shrink_sleeve_applied', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-300">Shrink Cap Sleeve Applied</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.expiry_date_etched}
                    onChange={(e) => handleChange('expiry_date_etched', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-300">Expiry Date Laser Etched</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.expiry_date_legible}
                    onChange={(e) => handleChange('expiry_date_legible', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-300">Expiry Date Legible</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.pvc_film_applied}
                    onChange={(e) => handleChange('pvc_film_applied', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-300">PVC Film Applied</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.shrink_seal_complete}
                    onChange={(e) => handleChange('shrink_seal_complete', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-300">Shrink Seal Complete</span>
                </label>
              </div>

              {/* Seal Appearance */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Seal Appearance
                </label>
                <select
                  value={formData.seal_appearance}
                  onChange={(e) => handleChange('seal_appearance', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="Smooth - No Wrinkles">Smooth - No Wrinkles</option>
                  <option value="Minor Wrinkles">Minor Wrinkles</option>
                  <option value="Major Wrinkles">Major Wrinkles</option>
                  <option value="Incomplete Seal">Incomplete Seal</option>
                </select>
              </div>

              {/* Final Visual Inspection */}
              <div className="space-y-3 bg-dark-900 p-4 rounded-lg border border-dark-700">
                <p className="text-sm font-semibold text-gray-300 mb-2">Final Inspection</p>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.final_visual_inspection}
                    onChange={(e) => handleChange('final_visual_inspection', e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-300">Final Visual Inspection PASS</span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Shrink Seal Notes
                </label>
                <textarea
                  value={formData.shrink_seal_notes}
                  onChange={(e) => handleChange('shrink_seal_notes', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={2}
                  placeholder="Any observations or issues during sealing process..."
                />
              </div>
            </div>
          )}

          {/* General Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              General Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Any additional observations or comments..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-dark-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2 bg-${stageColor}-500 hover:bg-${stageColor}-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Record Check
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}