'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import { 
  Calculator, FileText, UploadCloud, Plus, Trash2, 
  Save, AlertCircle, Building2, CheckCircle2, FileDown,
  AlertOctagon // Added QMS Icon
} from 'lucide-react';
import RaiseNCRModal from '@/components/qms/RaiseNCRModal'; // Added NCR Modal Import

interface LineItem {
  item_no: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

const CURRENCIES = ['ZMW', 'USD', 'EUR', 'ZAR', 'CNY', 'GBP'];

export default function POCreationForm() {
  const router = useRouter();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form State
  const [vendorId, setVendorId] = useState('');
  const [department, setDepartment] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [shipVia, setShipVia] = useState('');
  const [currency, setCurrency] = useState('ZMW');
  const [summaryRef, setSummaryRef] = useState('');
  const [terms, setTerms] = useState('');
  
  // Financial Adjustments
  const [taxRate, setTaxRate] = useState(16); // 16% Default
  const [shipping, setShipping] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);

  // Line Items & PDF
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { item_no: 1, description: '', quantity: 1, unit: 'EA', unit_price: 0, line_total: 0 }
  ]);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfBase64, setPdfBase64] = useState('');

  // QMS Integration State
  const [showNCRModal, setShowNCRModal] = useState(false);

  useEffect(() => {
    fetchApprovedVendors();
  }, []);

  const fetchApprovedVendors = async () => {
    try {
      // Roadmap Rule: Only pull Approved or Conditionally Approved vendors (AVL)
      const response = await api.get('/suppliers?avl_only=true');
      setVendors(response.data);
    } catch (err) {
      setError('Failed to load Approved Vendor List.');
    } finally {
      setLoading(false);
    }
  };

  const selectedVendor = vendors.find(v => v.vendor_id === vendorId);

  // Dynamic Math Calculations
  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount + shipping + otherCharges;
    return { subtotal, taxAmount, total };
  }, [lineItems, taxRate, shipping, otherCharges]);

  // Line Item Handlers
  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-calculate line total
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].line_total = parseFloat((newItems[index].quantity * newItems[index].unit_price).toFixed(2));
    }
    
    setLineItems(newItems);
  };

  const addLineItem = () => {
    if (lineItems.length >= 20) return; // Roadmap limit
    setLineItems([...lineItems, { item_no: lineItems.length + 1, description: '', quantity: 1, unit: 'EA', unit_price: 0, line_total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    const newItems = lineItems.filter((_, i) => i !== index).map((item, i) => ({ ...item, item_no: i + 1 }));
    setLineItems(newItems);
  };

  // PDF File Handler (Converts to Base64)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed for quotations.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError('PDF file size must be less than 5MB.');
      return;
    }

    setPdfFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setPdfBase64(reader.result as string);
    };
    reader.onerror = () => {
      setError('Failed to read the PDF file. Please try again.');
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return setError('Please select a vendor.');
    if (!pdfBase64) return setError('A PDF Quotation must be attached to raise a PO.');
    if (lineItems.some(item => !item.description || item.unit_price <= 0)) {
      return setError('All line items must have a description and a valid price.');
    }

    setSubmitLoading(true);
    setError('');

    const payload = {
      vendor_id: vendorId,
      department,
      delivery_date: deliveryDate,
      ship_via: shipVia,
      currency,
      summary_ref: summaryRef,
      terms,
      tax_rate: taxRate,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      shipping,
      other_charges: otherCharges,
      total_amount: totals.total,
      quotation_pdf_base64: pdfBase64,
      line_items: lineItems
    };

    try {
      const response = await api.post('/pos', payload);
      setSuccess(true);
      // Wait a moment then redirect to the PO list (which we will build next)
      setTimeout(() => router.push('/vendor-management/purchase-orders'), 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create Purchase Order. (Check Exchange Rate API connection)');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-dark-800 border border-green-500/30 rounded-xl p-12 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Purchase Order Raised!</h2>
        <p className="text-gray-400">The PO has been generated, live USD thresholds calculated, and routed to the CFO for approval.</p>
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
            <FileText className="w-6 h-6 text-primary-400" />
            <h2 className="text-xl font-bold text-white">Purchase Order Details</h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => window.open('/qms/documents?search=QA-PUR-ORD-SOP-001', '_blank')} 
              className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <FileText className="w-4 h-4"/> View Purchasing SOP
            </button>
            <button 
              type="button"
              onClick={() => setShowNCRModal(true)} 
              className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <AlertOctagon className="w-4 h-4"/> Log Vendor Issue (NCR)
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
            
            {/* HEADER & VENDOR SELECTION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-primary-400 mb-2">Select Approved Vendor *</label>
                  {loading ? (
                    <div className="w-full px-4 py-3 bg-dark-900 border border-dark-700 rounded-lg text-gray-500 animate-pulse">Loading Approved Vendor List...</div>
                  ) : (
                    <select 
                      required 
                      value={vendorId} 
                      onChange={(e) => setVendorId(e.target.value)}
                      className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">-- Choose Vendor from AVL --</option>
                      {vendors.map(v => (
                        <option key={v.vendor_id} value={v.vendor_id}>
                          {v.legal_name} ({v.vtl_supplier_id})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedVendor && (
                  <div className="bg-dark-900 p-4 rounded-lg border border-dark-700 text-sm space-y-2 animate-in fade-in">
                    <p className="text-white font-medium flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400"/> {selectedVendor.legal_name}</p>
                    <p className="text-gray-400"><strong>Status:</strong> <span className="text-green-400">{selectedVendor.status.replace('_', ' ')}</span></p>
                    <p className="text-gray-400"><strong>Category:</strong> {selectedVendor.primary_category}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Currency</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded text-sm text-white focus:border-primary-500">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Delivery Date</label><input type="date" required value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded text-sm text-white focus:border-primary-500" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Department</label><input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Production" className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded text-sm text-white focus:border-primary-500" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Ship Via</label><input type="text" value={shipVia} onChange={(e) => setShipVia(e.target.value)} placeholder="e.g. DHL, Vendor Fleet" className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded text-sm text-white focus:border-primary-500" /></div>
              </div>
            </div>

            {/* LINE ITEMS TABLE */}
            <div className="space-y-4 pt-6 border-t border-dark-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Line Items</h3>
                <button type="button" onClick={addLineItem} className="text-sm px-3 py-1.5 bg-primary-600/20 hover:bg-primary-600/40 text-primary-400 rounded flex items-center gap-1 transition-colors">
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs uppercase text-gray-500 border-b border-dark-700">
                      <th className="pb-2 w-12">#</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2 w-24">Qty</th>
                      <th className="pb-2 w-24">Unit</th>
                      <th className="pb-2 w-32">Price ({currency})</th>
                      <th className="pb-2 w-32 text-right">Total ({currency})</th>
                      <th className="pb-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700/50">
                    {lineItems.map((item, idx) => (
                      <tr key={idx} className="group">
                        <td className="py-3 text-sm text-gray-500">{item.item_no}</td>
                        <td className="py-3 pr-2"><input type="text" required value={item.description} onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)} placeholder="Item description..." className="w-full px-3 py-1.5 bg-dark-900 border border-dark-600 rounded text-sm text-white" /></td>
                        <td className="py-3 pr-2"><input type="number" required min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => handleLineItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-3 py-1.5 bg-dark-900 border border-dark-600 rounded text-sm text-white" /></td>
                        <td className="py-3 pr-2"><input type="text" value={item.unit} onChange={(e) => handleLineItemChange(idx, 'unit', e.target.value)} className="w-full px-3 py-1.5 bg-dark-900 border border-dark-600 rounded text-sm text-white uppercase" /></td>
                        <td className="py-3 pr-2"><input type="number" required min="0" step="0.01" value={item.unit_price || ''} onChange={(e) => handleLineItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full px-3 py-1.5 bg-dark-900 border border-dark-600 rounded text-sm text-white" /></td>
                        <td className="py-3 text-right text-sm font-mono text-gray-300">{item.line_total.toFixed(2)}</td>
                        <td className="py-3 text-right">
                          <button type="button" onClick={() => removeLineItem(idx)} disabled={lineItems.length === 1} className="p-1.5 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TOTALS & ATTACHMENTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t border-dark-700">
              
              {/* Notes & Upload */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><label className="block text-xs text-gray-400 mb-1">Quotation Reference / Summary</label><input type="text" required value={summaryRef} onChange={(e) => setSummaryRef(e.target.value)} placeholder="e.g. Quote #QT-2026-884" className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded text-sm text-white" /></div>
                  <div className="col-span-2"><label className="block text-xs text-gray-400 mb-1">Terms & Conditions</label><textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Standard payment terms..." className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded text-sm text-white h-20 resize-none" /></div>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-lg border-dashed">
                  <h4 className="text-blue-400 font-medium text-sm flex items-center gap-2 mb-3"><FileDown className="w-4 h-4" /> Mandatory PDF Quotation</h4>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer bg-dark-800 hover:bg-dark-700 border border-dark-600 px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-white transition-colors">
                      <UploadCloud className="w-4 h-4 text-blue-400" />
                      Browse PDF
                      <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <span className="text-sm text-gray-400 truncate max-w-[200px]">{pdfFileName || 'No file selected'}</span>
                  </div>
                  {pdfFileName && <p className="text-xs text-green-400 mt-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Ready to upload</p>}
                </div>
              </div>

              {/* Financial Math */}
              <div className="bg-dark-900/50 p-6 rounded-xl border border-dark-700">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4"><Calculator className="w-5 h-5 text-primary-400" /> Financial Summary</h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center text-gray-300">
                    <span>Subtotal</span><span className="font-mono">{totals.subtotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-gray-300">
                    <div className="flex items-center gap-2">
                      <span>Tax (%)</span>
                      <input type="number" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} className="w-16 px-2 py-1 bg-dark-800 border border-dark-600 rounded text-xs text-white text-right" />
                    </div>
                    <span className="font-mono">{totals.taxAmount.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center text-gray-300">
                    <span>Shipping</span>
                    <input type="number" min="0" value={shipping || ''} onChange={(e) => setShipping(parseFloat(e.target.value) || 0)} className="w-24 px-2 py-1 bg-dark-800 border border-dark-600 rounded text-xs text-white text-right" placeholder="0.00" />
                  </div>

                  <div className="flex justify-between items-center text-gray-300 pb-4 border-b border-dark-700">
                    <span>Other Charges</span>
                    <input type="number" min="0" value={otherCharges || ''} onChange={(e) => setOtherCharges(parseFloat(e.target.value) || 0)} className="w-24 px-2 py-1 bg-dark-800 border border-dark-600 rounded text-xs text-white text-right" placeholder="0.00" />
                  </div>

                  <div className="flex justify-between items-center text-xl font-bold text-white pt-2">
                    <span>TOTAL ({currency})</span>
                    <span className="font-mono text-primary-400">{totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="pt-6 border-t border-dark-700 flex justify-end gap-4">
              <button type="button" onClick={() => router.back()} className="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors">Cancel</button>
              <button type="submit" disabled={submitLoading || !vendorId || !pdfBase64} className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-primary-500/20">
                {submitLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />} Raise Purchase Order
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* Embedded QMS NCR Modal */}
      <RaiseNCRModal 
        isOpen={showNCRModal}
        onClose={() => setShowNCRModal(false)}
        sourceModule="Procurement"
        sourceId={selectedVendor ? `Vendor Issue - ${selectedVendor.legal_name}` : 'Vendor Issue'}
        onSuccess={() => alert('Vendor Issue NCR successfully logged into the QMS.')}
      />
    </>
  );
}