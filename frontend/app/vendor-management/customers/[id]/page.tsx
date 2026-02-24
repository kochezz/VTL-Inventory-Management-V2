'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  ArrowLeft, Users, Building2, MapPin, Phone, CreditCard, 
  CheckCircle2, XCircle, Clock, AlertCircle, ShieldAlert, KeyRound, 
  Store, UserCheck, CalendarDays
} from 'lucide-react';

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Approval Form State
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (params.id) fetchCustomerDetails(params.id as string);
  }, [params.id]);

  const fetchCustomerDetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/customers/${id}`);
      setCustomer(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load customer details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Active Account</span>;
      case 'PENDING_CFO': return <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-2"><Clock className="w-4 h-4"/> Pending CFO Approval</span>;
      case 'REVISION_REQUIRED': return <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Revision Required</span>;
      default: return <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> {status}</span>;
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'Chain': return <span className="px-3 py-1 rounded-md text-sm font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">CHAIN (T3)</span>;
      case 'Wholesale': return <span className="px-3 py-1 rounded-md text-sm font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">WHOLESALE (T2)</span>;
      case 'Kantemba': return <span className="px-3 py-1 rounded-md text-sm font-bold bg-gray-700 text-gray-300 border border-gray-600">KANTEMBA (T1)</span>;
      default: return <span className="px-3 py-1 rounded-md text-sm text-gray-400">{tier}</span>;
    }
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!password) return setError('Digital signature (password) is required.');
    if (action === 'reject' && !notes) return setError('A reason must be provided when returning to Sales.');

    try {
      setActionLoading(true);
      setError('');

      const endpoint = action === 'approve' ? `/customers/${customer.customer_id}/approve` : `/customers/${customer.customer_id}/reject`;
      await api.post(endpoint, {
        signature_password: password,
        notes: notes,
        reason: notes
      });
      
      // Refresh to show the new VTL-CUS ID and Active status
      await fetchCustomerDetails(customer.customer_id);
      setPassword('');
      setNotes('');
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} customer. Check your password.`);
    } finally {
      setActionLoading(false);
    }
  };

  const canApprove = () => {
    if (!user) return false;
    if ((user.role === 'admin' || user.role === 'cfo') && customer?.status === 'PENDING_CFO') return true;
    return false;
  };

  if (loading) return (
    <DashboardLayout>
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    </DashboardLayout>
  );

  if (error && !customer) return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto mt-10 p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Error Loading Customer</h2>
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
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                  <Store className="w-8 h-8 text-primary-400" />
                  {customer.trading_name}
                </h1>
                {getStatusBadge(customer.status)}
                {getTierBadge(customer.tier_name)}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400 mt-2">
                {customer.vtl_customer_id ? (
                  <span className="font-mono text-primary-400 font-bold border border-primary-500/30 bg-primary-500/10 px-2 py-0.5 rounded">ID: {customer.vtl_customer_id}</span>
                ) : (
                  <span className="font-mono text-gray-500 italic border border-dark-600 bg-dark-900 px-2 py-0.5 rounded">ID Pending Approval</span>
                )}
                <span className="flex items-center gap-1"><UserCheck className="w-4 h-4" /> Onboarded by: {customer.onboarded_by_name}</span>
                <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" /> Date: {new Date(customer.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {error && customer && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: Data Details */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary-400" /> Business Identity
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-dark-700/50 pb-2"><span className="text-gray-500">Legal Name</span> <span className="text-white">{customer.legal_name || customer.trading_name}</span></div>
                  <div className="flex justify-between border-b border-dark-700/50 pb-2"><span className="text-gray-500">TPIN / Tax No.</span> <span className="text-white font-mono">{customer.tpin || 'N/A'}</span></div>
                  <div className="flex justify-between border-b border-dark-700/50 pb-2"><span className="text-gray-500">Business Type</span> <span className="text-white">{customer.business_type}</span></div>
                  <div className="flex justify-between border-b border-dark-700/50 pb-2"><span className="text-gray-500">Sales Territory</span> <span className="text-white">{customer.territory || 'N/A'}</span></div>
                </div>
              </div>
              
              <div>
                <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary-400" /> Commercial & Credit
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-dark-700/50 pb-2">
                    <span className="text-gray-500">Payment Terms</span> 
                    <span className={`font-bold ${customer.payment_terms === 'Cash' ? 'text-green-400' : 'text-blue-400'}`}>{customer.payment_terms}</span>
                  </div>
                  <div className="flex justify-between border-b border-dark-700/50 pb-2">
                    <span className="text-gray-500">Credit Limit (ZMW)</span> 
                    <span className="text-white font-mono">{parseFloat(customer.credit_limit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {customer.products?.length > 0 && (
                    <>
                      <div className="flex justify-between border-b border-dark-700/50 pb-2"><span className="text-gray-500">Est. Monthly Vol</span> <span className="text-white">{customer.products[0].estimated_monthly_volume} Units</span></div>
                      <div className="flex justify-between border-b border-dark-700/50 pb-2"><span className="text-gray-500">Delivery Freq.</span> <span className="text-white">{customer.products[0].preferred_delivery_frequency}</span></div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Contacts Array */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary-400" /> Authorized Contacts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customer.contacts?.map((contact: any) => (
                  <div key={contact.contact_id} className="bg-dark-900 border border-dark-600 rounded-lg p-4 relative">
                    {contact.is_primary && <span className="absolute top-2 right-2 text-[10px] uppercase font-bold bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded">Primary</span>}
                    <p className="text-white font-bold">{contact.full_name}</p>
                    <p className="text-xs text-gray-400 mb-2">{contact.position || 'Contact'}</p>
                    <p className="text-sm text-gray-300 flex items-center gap-2"><Phone className="w-3 h-3 text-gray-500"/> {contact.phone}</p>
                    {contact.email && <p className="text-sm text-gray-300">Email: {contact.email}</p>}
                    {contact.whatsapp && <p className="text-sm text-green-400 flex items-center gap-1 mt-1">WhatsApp: {contact.whatsapp}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Locations Array (Supports Chains) */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-400" /> Physical Locations ({customer.locations?.length || 0})
              </h2>
              <div className="space-y-3">
                {customer.locations?.map((loc: any, idx: number) => (
                  <div key={loc.location_id} className="flex items-start gap-3 bg-dark-900 border border-dark-600 rounded-lg p-4">
                    <div className="mt-1 bg-dark-800 p-2 rounded text-gray-400 font-mono text-xs">{idx + 1}</div>
                    <div>
                      {loc.outlet_name && <p className="text-white font-bold text-sm mb-1">{loc.outlet_name}</p>}
                      <p className="text-gray-300 text-sm">{loc.address}</p>
                      <p className="text-gray-400 text-sm">{loc.town}{loc.region ? `, ${loc.region}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Action & Audit Trail */}
          <div className="space-y-6">
            
            {/* Approval Action Panel */}
            {canApprove() ? (
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 flex flex-col shadow-lg border-t-4 border-t-primary-500">
                <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-primary-400" /> CFO Credit Approval
                </h2>
                
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Reviewer Notes</label>
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
                    <p className="text-xs text-blue-200/70 mb-3">Enter your login password to authorize this credit limit and generate the VTL Customer ID.</p>
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
                    className="w-full py-3 bg-dark-900 hover:bg-dark-700 border border-orange-500/30 text-orange-400 rounded-lg font-bold transition-colors disabled:opacity-50"
                  >
                    Return to Sales
                  </button>
                  <button 
                    onClick={() => handleAction('approve')} 
                    disabled={actionLoading}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 shadow-lg shadow-green-500/20"
                  >
                    {actionLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><CheckCircle2 className="w-5 h-5" /> Approve Account</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 text-center">
                <ShieldAlert className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                <h3 className="text-white font-medium mb-1">No Actions Required</h3>
                <p className="text-sm text-gray-400">Account is active or you do not have permission to approve credit limits.</p>
              </div>
            )}

            {/* Audit Trail */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Account History</h2>
              <div className="space-y-4">
                <div className="bg-dark-900 p-3 rounded-lg border border-dark-600">
                  <p className="text-xs text-gray-400 mb-1">Onboarded By</p>
                  <p className="text-sm text-white font-medium">{customer.onboarded_by_name}</p>
                  <p className="text-xs text-gray-500">{new Date(customer.created_at).toLocaleString()}</p>
                </div>
                {customer.cfo_approved_by && (
                  <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/30">
                    <p className="text-xs text-green-400/80 mb-1">Credit Approved By (CFO)</p>
                    <p className="text-sm text-white font-medium">{customer.cfo_name}</p>
                    <p className="text-xs text-green-400/60">{new Date(customer.approved_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}