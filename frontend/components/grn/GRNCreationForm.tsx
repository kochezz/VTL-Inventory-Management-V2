'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import { 
  PackageCheck, Truck, AlertCircle, CheckCircle2, 
  Save, FileText, Database, ShieldAlert,
  AlertOctagon // Added QMS Icon
} from 'lucide-react';
import RaiseNCRModal from '@/components/qms/RaiseNCRModal'; // Added NCR Modal Import

interface ReceiveItem {
  po_line_id: string;
  description: string;
  ordered: number;
  previously_received: number;
  quantity_received: number; // What the user is receiving NOW
  condition_status: string;
  inventory_id: string;
  notes: string;
}

export default function GRNCreationForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Data State
  const [availablePOs, setAvailablePOs] = useState<any[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [poDetails, setPoDetails] = useState<any>(null);

  // Form State
  const [selectedPoId, setSelectedPoId] = useState('');
  const [receiptType, setReceiptType] = useState('PHYSICAL');
  const [deliveryNoteRef, setDeliveryNoteRef] = useState('');
  const [globalNotes, setGlobalNotes] = useState('');
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);

  // QMS Integration State
  const [showNCRModal, setShowNCRModal] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch PO details when a PO is selected
  useEffect(() => {
    if (selectedPoId) {
      fetchPODetails(selectedPoId);
    } else {
      setPoDetails(null);
      setReceiveItems([]);
    }
  }, [selectedPoId]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // Fetch POs and Inventory simultaneously
      const [poRes, invRes] = await Promise.all([
        api.get('/pos'),
        api.get('/inventory').catch(() => ({ data: [] })) // Fallback if inventory is empty/unreachable
      ]);

      // Only allow receiving against APPROVED or PARTIALLY_RECEIVED POs
      const receivablePOs = poRes.data.filter((po: any) => 
        po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED'
      );
      
      setAvailablePOs(receivablePOs);
      setInventoryList(invRes.data);
    } catch (err) {
      setError('Failed to load initial data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPODetails = async (poId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/pos/${poId}`);
      const po = res.data;
      setPoDetails(po);

      // Initialize the receiving line items
      const initialItems = po.line_items.map((item: any) => {
        const remaining = item.quantity - parseFloat(item.quantity_received || 0);
        return {
          po_line_id: item.line_id,
          description: item.description,
          ordered: item.quantity,
          previously_received: parseFloat(item.quantity_received || 0),
          quantity_received: remaining > 0 ? remaining : 0, // Default to receiving the exact remainder
          condition_status: 'GOOD',
          inventory_id: '', // User will map this
          notes: ''
        };
      });

      setReceiveItems(initialItems);
    } catch (err) {
      setError('Failed to fetch Purchase Order details.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (index: number, field: keyof ReceiveItem, value: any) => {
    const newItems = [...receiveItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setReceiveItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoId) return setError('Please select a Purchase Order.');
    
    // Filter out items where the user is receiving 0
    const itemsToReceive = receiveItems.filter(item => item.quantity_received > 0);
    
    if (itemsToReceive.length === 0) {
      return setError('You must receive a quantity greater than 0 for at least one item.');
    }

    // If Physical, strongly recommend mapping to inventory (though we'll allow bypass for non-stock physical items like spare parts)
    const unmappedItems = itemsToReceive.filter(i => receiptType === 'PHYSICAL' && !i.inventory_id);
    if (unmappedItems.length > 0) {
      const confirmBypass = window.confirm('You have physical items that are not mapped to an Inventory SKU. They will not update live stock levels. Continue?');
      if (!confirmBypass) return;
    }

    setSubmitLoading(true);
    setError('');

    const payload = {
      po_id: selectedPoId,
      receipt_type: receiptType,
      delivery_note_ref: deliveryNoteRef,
      notes: globalNotes,
      items: itemsToReceive
    };

    try {
      await api.post('/grns', payload);
      setSuccess(true);
      setTimeout(() => router.push('/vendor-management/goods-receipts'), 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate GRN.');
      setSubmitLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-dark-800 border border-green-500/30 rounded-xl p-12 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Goods Receipt Note Generated!</h2>
        <p className="text-gray-400">The PO has been updated and the physical stock has been injected into inventory.</p>
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mt-6"></div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl">
        
        {/* QMS INTEGRATED HEADER */}
        <div className="p-6 border-b border-dark-700 bg-dark-900/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <PackageCheck className="w-6 h-6 text-primary-400" />
            <h2 className="text-xl font-bold text-white">Receive Goods / Services</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.open('/qms/documents?search=QA-WH-INSP-SOP-002', '_blank')}
              className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <FileText className="w-4 h-4"/> View Receiving SOP
            </button>
            <button
              type="button"
              onClick={() => setShowNCRModal(true)}
              className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <AlertOctagon className="w-4 h-4"/> Log Issue (NCR)
            </button>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* STEP 1: PO SELECTION */}
            <div className="bg-dark-900 p-6 rounded-xl border border-dark-700 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-gray-400" /> 1. Select Approved Purchase Order
              </h3>
              
              {loading && !selectedPoId ? (
                <div className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-gray-500 animate-pulse">Loading valid POs...</div>
              ) : (
                <select 
                  required 
                  value={selectedPoId} 
                  onChange={(e) => setSelectedPoId(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 text-lg"
                >
                  <option value="">-- Scan or Select PO Number --</option>
                  {availablePOs.map(po => (
                    <option key={po.po_id} value={po.po_id}>
                      {po.po_number} - {po.vendor_name} ({po.status.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              )}

              {poDetails && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-dark-800 text-sm">
                  <div><span className="block text-gray-500">Vendor</span><span className="text-white font-medium">{poDetails.vendor_name}</span></div>
                  <div><span className="block text-gray-500">Department</span><span className="text-white">{poDetails.department || 'N/A'}</span></div>
                  <div><span className="block text-gray-500">PO Status</span><span className="text-primary-400 font-medium">{poDetails.status.replace('_', ' ')}</span></div>
                  <div><span className="block text-gray-500">Total Value</span><span className="text-white">{poDetails.currency} {parseFloat(poDetails.total_amount).toLocaleString()}</span></div>
                </div>
              )}
            </div>

            {/* STEP 2: RECEIPT DETAILS */}
            {poDetails && (
              <div className="bg-dark-900 p-6 rounded-xl border border-dark-700 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                <div className="md:col-span-3">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-dark-800 pb-2">
                    <Truck className="w-5 h-5 text-gray-400" /> 2. Delivery Information
                  </h3>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-primary-400 mb-2">Receipt Type *</label>
                  <select value={receiptType} onChange={(e) => setReceiptType(e.target.value)} className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white">
                    <option value="PHYSICAL">Physical Delivery (Warehouse)</option>
                    <option value="SERVICE">Service / Electronic Delivery</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Services will not update warehouse inventory.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Vendor Delivery Note Ref</label>
                  <input type="text" value={deliveryNoteRef} onChange={(e) => setDeliveryNoteRef(e.target.value)} placeholder="e.g. DN-99482" className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Receiving Notes</label>
                  <input type="text" value={globalNotes} onChange={(e) => setGlobalNotes(e.target.value)} placeholder="Condition of truck, seals intact, etc." className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white" />
                </div>
              </div>
            )}

            {/* STEP 3: LINE ITEMS */}
            {poDetails && (
              <div className="space-y-4 animate-in fade-in">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-gray-400" /> 3. Receive Line Items
                </h3>
                
                <div className="overflow-x-auto bg-dark-900 rounded-xl border border-dark-700">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs uppercase text-gray-500 border-b border-dark-700 bg-dark-950/50">
                        <th className="px-4 py-3 font-medium">Description</th>
                        <th className="px-4 py-3 font-medium w-24">Ordered</th>
                        <th className="px-4 py-3 font-medium w-24">Received</th>
                        <th className="px-4 py-3 font-medium w-32 text-primary-400">Receive NOW</th>
                        <th className="px-4 py-3 font-medium w-32">Condition</th>
                        {receiptType === 'PHYSICAL' && <th className="px-4 py-3 font-medium w-48 text-blue-400">Map to Inventory SKU</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-800">
                      {receiveItems.map((item, idx) => {
                        const remaining = item.ordered - item.previously_received;
                        const isComplete = remaining <= 0;

                        return (
                          <tr key={item.po_line_id} className={isComplete ? 'opacity-50 bg-dark-950' : ''}>
                            <td className="px-4 py-4 text-sm text-white">{item.description}</td>
                            <td className="px-4 py-4 text-sm text-gray-400 font-mono">{item.ordered}</td>
                            <td className="px-4 py-4 text-sm text-gray-400 font-mono">{item.previously_received}</td>
                            <td className="px-4 py-4">
                              <input 
                                type="number" 
                                min="0" 
                                max={remaining + (remaining * 0.1)} // Allow slight 10% over-delivery if needed
                                step="0.01" 
                                disabled={isComplete}
                                value={item.quantity_received === 0 && !isComplete ? '' : item.quantity_received} 
                                onChange={(e) => handleItemChange(idx, 'quantity_received', parseFloat(e.target.value) || 0)} 
                                className="w-full px-2 py-1.5 bg-dark-800 border border-primary-500/50 rounded text-sm text-white font-mono" 
                              />
                            </td>
                            <td className="px-4 py-4">
                              <select 
                                disabled={isComplete}
                                value={item.condition_status} 
                                onChange={(e) => handleItemChange(idx, 'condition_status', e.target.value)} 
                                className="w-full px-2 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white"
                              >
                                <option value="GOOD">Good</option>
                                <option value="DAMAGED">Damaged</option>
                                <option value="REJECTED">Rejected</option>
                              </select>
                            </td>
                            {receiptType === 'PHYSICAL' && (
                              <td className="px-4 py-4">
                                <select 
                                  disabled={isComplete || item.condition_status !== 'GOOD'}
                                  value={item.inventory_id} 
                                  onChange={(e) => handleItemChange(idx, 'inventory_id', e.target.value)} 
                                  className="w-full px-2 py-1.5 bg-dark-800 border border-blue-500/30 rounded text-sm text-white"
                                >
                                  <option value="">-- Do Not Map --</option>
                                  {inventoryList.map(inv => (
                                    <option key={inv.id} value={inv.id}>{inv.sku} - {inv.name}</option>
                                  ))}
                                </select>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {poDetails && (
              <div className="pt-6 border-t border-dark-700 flex justify-end gap-4 animate-in fade-in">
                <button type="button" onClick={() => router.back()} className="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={submitLoading || receiveItems.every(i => i.quantity_received === 0)} className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-green-500/20">
                  {submitLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />} Generate GRN
                </button>
              </div>
            )}

          </form>
        </div>
      </div>

      {/* Embedded QMS NCR Modal */}
      <RaiseNCRModal 
        isOpen={showNCRModal}
        onClose={() => setShowNCRModal(false)}
        sourceModule="Warehouse"
        sourceId={poDetails ? `PO-${poDetails.po_number}` : 'Goods Receipt Check'}
        onSuccess={() => alert('Damaged Goods NCR successfully logged into the QMS.')}
      />
    </>
  );
}