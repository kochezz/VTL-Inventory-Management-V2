'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  ArrowLeft, FileText, CheckCircle2, XCircle, Clock, 
  AlertCircle, ShieldAlert, KeyRound, Building2, Calculator, UserCheck, DownloadCloud
} from 'lucide-react';

export default function PurchaseOrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  
  // PDF Blob State
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Approval Form State
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (params.id) fetchPODetails(params.id as string);
  }, [params.id]);

  // Convert Base64 to Blob URL for reliable cross-browser PDF rendering
  useEffect(() => {
    if (po?.quotation_pdf_base64) {
      try {
        const base64Data = po.quotation_pdf_base64.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        setPdfBlobUrl(blobUrl);

        // Cleanup memory when component unmounts
        return () => URL.revokeObjectURL(blobUrl);
      } catch (e) {
        console.error("Failed to generate PDF blob", e);
      }
    }
  }, [po]);

  const fetchPODetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/pos/${id}`);
      setPo(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load PO details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Fully Approved</span>;
      case 'PENDING_CFO': return <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-2"><Clock className="w-4 h-4"/> Pending CFO Approval</span>;
      case 'PENDING_CEO': return <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> Pending CEO Approval</span>;
      case 'REJECTED': return <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-2"><XCircle className="w-4 h-4"/> Rejected</span>;
      default: return <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> {status}</span>;
    }
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!password) return setError('Digital signature (password) is required.');
    if (action === 'reject' && !notes) return setError('A reason must be provided when rejecting a PO.');

    try {
      setActionLoading(true);
      setError('');
      
      let actingRole = undefined;
      if (user?.role === 'admin') {
        actingRole = po.status === 'PENDING_CFO' ? 'cfo' : 'ceo';
      }

      const endpoint = action === 'approve' ? `/pos/${po.po_id}/approve` : `/pos/${po.po_id}/reject`;
      await api.post(endpoint, {
        signature_password: password,
        notes: notes,
        reason: notes,
        acting_role: actingRole
      });
      
      await fetchPODetails(po.po_id);
      setPassword('');
      setNotes('');
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} PO. Check your password.`);
    } finally {
      setActionLoading(false);
    }
  };

  const canApprove = () => {
    if (!user) return false;
    if (user.role === 'admin') return po?.status === 'PENDING_CFO' || po?.status === 'PENDING_CEO';
    if (user.role === 'cfo') return po?.status === 'PENDING_CFO';
    if (user.role === 'ceo') return po?.status === 'PENDING_CEO';
    return false;
  };

  if (loading) return (
    <DashboardLayout>
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    </DashboardLayout>
  );

  if (error && !po) return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto mt-10 p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Error Loading PO</h2>
        <p>{error}</p>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-dark-800 text-white rounded-lg">Go Back</button>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-dark-800 p-6 rounded-xl border border-dark-700 shadow-lg">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 bg-dark-900 hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg transition-colors border border-dark-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-white font-mono">{po.po_number}</h1>
                {getStatusBadge(po.status)}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <UserCheck className="w-4 h-4" /> Raised by: {po.raised_by_name}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> Date: {new Date(po.date_raised).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && po && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: Data & PDF */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Vendor & General Info */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary-400" /> Vendor Details
                </h2>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-500 block">Vendor Name</span> <span className="text-white font-medium">{po.vendor_name}</span></p>
                  <p><span className="text-gray-500 block">VTL Supplier ID</span> <span className="text-primary-400 font-mono">{po.vtl_supplier_id}</span></p>
                  <p><span className="text-gray-500 block">Address</span> <span className="text-white">{po.registered_address}</span></p>
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-400" /> PO Meta Data
                </h2>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-500 block">Department</span> <span className="text-white">{po.department || 'N/A'}</span></p>
                  <p><span className="text-gray-500 block">Delivery Date</span> <span className="text-white">{po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : 'N/A'}</span></p>
                  <p><span className="text-gray-500 block">Shipping Method</span> <span className="text-white">{po.ship_via || 'N/A'}</span></p>
                  <p><span className="text-gray-500 block">Quote Reference</span> <span className="text-white">{po.summary_ref || 'N/A'}</span></p>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 overflow-x-auto">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary-400" /> Line Items
              </h2>
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs uppercase text-gray-500 border-b border-dark-700">
                    <th className="pb-2 font-medium w-12">#</th>
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium text-right">Qty</th>
                    <th className="pb-2 font-medium text-right">Price ({po.currency})</th>
                    <th className="pb-2 font-medium text-right">Total ({po.currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50">
                  {po.line_items?.map((item: any, idx: number) => (
                    <tr key={idx} className="text-sm">
                      <td className="py-3 text-gray-500">{item.item_no}</td>
                      <td className="py-3 text-white">{item.description}</td>
                      <td className="py-3 text-right text-white">{item.quantity} {item.unit}</td>
                      <td className="py-3 text-right text-white">{parseFloat(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 text-right font-mono text-gray-300">{parseFloat(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Financial Totals */}
              <div className="mt-6 pt-4 border-t border-dark-700 flex flex-col items-end space-y-2 text-sm w-full">
                <div className="flex justify-between w-64 text-gray-400"><span>Subtotal:</span> <span>{parseFloat(po.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between w-64 text-gray-400"><span>Tax ({po.tax_rate}%):</span> <span>{parseFloat(po.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                {parseFloat(po.shipping) > 0 && <div className="flex justify-between w-64 text-gray-400"><span>Shipping:</span> <span>{parseFloat(po.shipping).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
                {parseFloat(po.other_charges) > 0 && <div className="flex justify-between w-64 text-gray-400"><span>Other Charges:</span> <span>{parseFloat(po.other_charges).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
                <div className="flex justify-between w-64 text-lg font-bold text-white pt-2 border-t border-dark-700">
                  <span>TOTAL ({po.currency}):</span> <span className="text-primary-400">{parseFloat(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between w-64 text-xs text-gray-500 mt-1">
                  <span>Live USD Equivalent:</span> <span>${parseFloat(po.total_usd_equiv).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Embedded PDF Viewer with Download Button */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-400" /> Attached Quotation
                </div>
                {pdfBlobUrl && (
                  <a 
                    href={pdfBlobUrl} 
                    download={`Quotation-${po.po_number}.pdf`}
                    className="flex items-center gap-2 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-500 rounded-lg text-sm text-gray-300 transition-colors"
                  >
                    <DownloadCloud className="w-4 h-4" /> Download PDF
                  </a>
                )}
              </h2>
              
              {pdfBlobUrl ? (
                <div className="w-full h-[600px] border border-dark-600 rounded-lg overflow-hidden bg-dark-900">
                  <iframe src={pdfBlobUrl} className="w-full h-full" title="Quotation PDF" />
                </div>
              ) : (
                <div className="p-8 text-center bg-dark-900 border border-dark-700 border-dashed rounded-lg text-gray-500">
                  Loading or No Quotation Attached...
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Action & Audit Trail */}
          <div className="space-y-6">
            
            {/* Approval Action Panel */}
            {canApprove() ? (
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 flex flex-col shadow-lg border-t-4 border-t-primary-500">
                <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-primary-400" /> Required Action
                </h2>
                
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Reviewer Notes / Reason</label>
                    <textarea 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      placeholder="Optional for approval. Required for rejection."
                      className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white focus:border-primary-500 h-24 resize-none"
                    />
                  </div>

                  <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
                    <label className="block text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
                      <KeyRound className="w-4 h-4" /> Digital Signature Verification
                    </label>
                    <p className="text-xs text-blue-200/70 mb-3">Enter your login password to officially authorize this Purchase Order.</p>
                    <input 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      placeholder="Enter your password"
                      className="w-full px-4 py-2 bg-dark-950 border border-blue-500/50 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-dark-700">
                  <button 
                    onClick={() => handleAction('reject')} 
                    disabled={actionLoading}
                    className="w-full py-3 bg-dark-900 hover:bg-dark-700 border border-red-500/30 text-red-400 rounded-lg font-bold transition-colors disabled:opacity-50"
                  >
                    Reject PO
                  </button>
                  <button 
                    onClick={() => handleAction('approve')} 
                    disabled={actionLoading}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 shadow-lg shadow-green-500/20"
                  >
                    {actionLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><CheckCircle2 className="w-5 h-5" /> Approve</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 text-center">
                <ShieldAlert className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                <h3 className="text-white font-medium mb-1">No Actions Required</h3>
                <p className="text-sm text-gray-400">You do not have permission to approve this PO at its current tier, or it has already been finalized.</p>
              </div>
            )}

            {/* Audit Trail */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Approval Audit Trail</h2>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-dark-600 before:to-transparent">
                {po.approvals?.length > 0 ? po.approvals.map((approval: any, idx: number) => (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-dark-800 bg-dark-900 text-gray-500 group-[.is-active]:text-green-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      {approval.status === 'APPROVED' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-dark-900 p-4 rounded-lg border border-dark-700 shadow-md">
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-white text-sm uppercase">{approval.approval_role} Review</div>
                        <div className="font-mono text-[10px] text-gray-500">{new Date(approval.action_at).toLocaleDateString()}</div>
                      </div>
                      <div className="text-xs text-gray-400 mb-2">By: {approval.approver_name}</div>
                      <div className={`text-xs font-medium px-2 py-1 rounded w-max ${approval.status === 'APPROVED' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {approval.status}
                      </div>
                      {(approval.rejection_reason || approval.notes) && (
                        <div className="mt-2 text-xs text-gray-300 italic">"{approval.rejection_reason || approval.notes}"</div>
                      )}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500 italic text-center w-full z-10 relative bg-dark-800">No approvals recorded yet.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}