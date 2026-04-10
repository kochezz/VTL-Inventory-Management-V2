'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  ArrowLeft, Building2, MapPin, Phone, Mail, FileCheck, 
  ShieldCheck, AlertTriangle, Briefcase, CreditCard, 
  CheckCircle2, XCircle, Clock, UserCheck, Edit
} from 'lucide-react';

const CATEGORIES: Record<string, string> = {
  MFG: 'Manufacturing', RAW: 'Raw Materials', PKG: 'Packaging',
  ENG: 'Engineering', SVC: 'Service Works', LOG: 'Logistics',
  CON: 'Consultancy', ICT: 'IT & Tech', FIN: 'Financial',
  FAC: 'Facilities', MKT: 'Marketing', OTH: 'Other',
};

export default function VendorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (params.id) {
      fetchVendorDetails(params.id as string);
    }
  }, [params.id]);

  const fetchVendorDetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/suppliers/${id}`);
      setVendor(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load vendor details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> Approved Vendor</span>;
      case 'CONDITIONALLY_APPROVED': return <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Conditionally Approved</span>;
      case 'AWAITING_QA': return <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-2"><Clock className="w-4 h-4"/> Awaiting QA Review</span>;
      case 'REVISION_REQUIRED': return <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Revision Required</span>;
      case 'REJECTED': return <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-2"><XCircle className="w-4 h-4"/> Rejected</span>;
      default: return <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20 flex items-center gap-2">Draft</span>;
    }
  };

  if (loading) return (
    <DashboardLayout>
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    </DashboardLayout>
  );

  if (error || !vendor) return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto mt-10 p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Error Loading Vendor</h2>
        <p>{error}</p>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-dark-800 text-white rounded-lg">Go Back</button>
      </div>
    </DashboardLayout>
  );

  const comp = vendor.compliance_data || {};
  const cap = vendor.capabilities_data || {};
  const dec = vendor.declaration_data || {};
  
  const bankingAccounts = Array.isArray(vendor.banking_data) 
    ? vendor.banking_data 
    : vendor.banking_data ? [vendor.banking_data] : [];

  const canViewBanking = user?.role === 'admin' || user?.role === 'cfo';
  const canReview = (user?.role === 'qa' || user?.role === 'admin') && vendor.status === 'AWAITING_QA';
  
  // NEW: Check if the user is allowed to edit vendor details
  const canEdit = ['sales', 'admin', 'manager', 'ceo', 'cfo'].includes(user?.role || '');

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-dark-800 p-6 rounded-xl border border-dark-700 shadow-lg">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 bg-dark-900 hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg transition-colors border border-dark-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-white">{vendor.legal_name}</h1>
                {getStatusBadge(vendor.status)}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1 font-mono text-primary-400">
                  <Building2 className="w-4 h-4" /> {vendor.vtl_supplier_id || 'ID Pending'}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" /> {CATEGORIES[vendor.primary_category] || vendor.primary_category}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* NEW EDIT BUTTON */}
            {canEdit && (
              <button 
                onClick={() => router.push(`/vendor-management/suppliers/${vendor.vendor_id}/edit`)}
                className="px-6 py-3 bg-dark-900 hover:bg-dark-700 text-white rounded-lg font-bold flex items-center gap-2 border border-dark-600 transition-colors shadow-sm"
              >
                <Edit className="w-5 h-5" /> Edit Details
              </button>
            )}

            {canReview && (
              <button 
                onClick={() => router.push(`/vendor-management/suppliers/${vendor.vendor_id}/review`)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 animate-pulse"
              >
                <FileCheck className="w-5 h-5" /> Execute QA Review
              </button>
            )}
          </div>
        </div>

        {vendor.status === 'REVISION_REQUIRED' && vendor.qa_notes && (
          <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-orange-400 font-bold mb-1">QA Revision Requested</h3>
              <p className="text-orange-200/80 text-sm">{vendor.qa_notes}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* COMPANY INFO */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-400" /> Company Information
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500">Trading Name</p><p className="text-white font-medium">{vendor.trading_name || 'N/A'}</p></div>
                <div><p className="text-gray-500">Year Established</p><p className="text-white font-medium">{vendor.year_established || 'N/A'}</p></div>
                <div><p className="text-gray-500">Company Reg No.</p><p className="text-white font-medium">{vendor.company_reg_no || 'N/A'}</p></div>
                <div><p className="text-gray-500">VAT / Tax ID</p><p className="text-white font-medium">{vendor.vat_number || 'N/A'}</p></div>
                <div className="col-span-2">
                  <p className="text-gray-500">Registered Address</p>
                  <p className="text-white font-medium flex items-start gap-1 mt-1">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" /> {vendor.registered_address}
                  </p>
                </div>
              </div>
            </div>

            {/* COMPLIANCE & CAPABILITIES */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary-400" /> Compliance & Capabilities
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><span className="text-gray-400 text-sm">Documented QMS</span>{comp.has_qms ? <CheckCircle2 className="w-5 h-5 text-green-400"/> : <XCircle className="w-5 h-5 text-gray-600"/>}</div>
                  {comp.has_qms && <div className="text-sm pl-4 border-l-2 border-dark-600 text-gray-300">Standard: {comp.qms_standard}</div>}
                  <div className="flex items-center justify-between"><span className="text-gray-400 text-sm">HSE Policy</span>{comp.has_hse_policy ? <CheckCircle2 className="w-5 h-5 text-green-400"/> : <XCircle className="w-5 h-5 text-gray-600"/>}</div>
                  <div className="flex items-center justify-between"><span className="text-gray-400 text-sm">Safety Certs</span>{comp.has_safety_certs ? <CheckCircle2 className="w-5 h-5 text-green-400"/> : <XCircle className="w-5 h-5 text-gray-600"/>}</div>
                  <div className="flex items-center justify-between"><span className="text-gray-400 text-sm">Regulatory Compliant</span>{comp.is_regulatory_compliant ? <CheckCircle2 className="w-5 h-5 text-green-400"/> : <XCircle className="w-5 h-5 text-red-500"/>}</div>
                  {comp.sanctions_history && (
                    <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-400 text-xs font-bold uppercase mb-1">Sanctions History</p>
                      <p className="text-red-200 text-sm">{comp.sanctions_details}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <div><p className="text-gray-500">Avg Lead Time</p><p className="text-white font-medium">{cap.lead_time || 'Not specified'}</p></div>
                  <div><p className="text-gray-500">Max Capacity</p><p className="text-white font-medium">{cap.max_capacity || 'Not specified'}</p></div>
                  <div><p className="text-gray-500">Geographic Areas</p><p className="text-white font-medium">{cap.geographic_areas || 'Not specified'}</p></div>
                  <div className="flex items-center justify-between pt-2 border-t border-dark-700"><span className="text-gray-400">Uses Subcontractors</span>{cap.uses_subcontractors ? <span className="text-yellow-400 font-medium">Yes</span> : <span className="text-gray-500">No</span>}</div>
                  {cap.uses_subcontractors && <p className="text-gray-300 bg-dark-900 p-2 rounded text-xs">{cap.subcontractor_details}</p>}
                </div>
              </div>
            </div>

            {/* TRADE REFERENCES */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary-400" /> Trade References
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vendor.references?.map((ref: any, idx: number) => (
                  <div key={ref.reference_id || idx} className="bg-dark-900 p-4 rounded-lg border border-dark-700">
                    <p className="text-white font-medium mb-2">{ref.company_name}</p>
                    <div className="text-sm text-gray-400 space-y-1">
                      <p className="flex items-center gap-2"><UserCheck className="w-3 h-3"/> {ref.contact_name || 'N/A'}</p>
                      <p className="flex items-center gap-2"><Phone className="w-3 h-3"/> {ref.contact_details || 'N/A'}</p>
                    </div>
                  </div>
                ))}
                {(!vendor.references || vendor.references.length === 0) && (
                  <p className="text-gray-500 text-sm">No references provided.</p>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            
            {/* CONTACTS */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Contacts</h2>
              <div className="space-y-4">
                {vendor.contacts?.map((contact: any, idx: number) => (
                  <div key={contact.contact_id || idx} className="relative pl-4 border-l-2 border-primary-500">
                    <p className="text-white font-medium flex items-center gap-2">
                      {contact.full_name} 
                      {contact.is_primary && <span className="px-2 py-0.5 rounded text-[10px] bg-primary-500/20 text-primary-400 uppercase">Primary</span>}
                    </p>
                    <p className="text-sm text-gray-400 mb-2">{contact.position || 'Representative'}</p>
                    <div className="space-y-1 text-sm text-gray-300">
                      <p className="flex items-center gap-2"><Phone className="w-3 h-3 text-gray-500"/> {contact.telephone}</p>
                      <p className="flex items-center gap-2"><Mail className="w-3 h-3 text-gray-500"/> {contact.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DECLARATION */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Signatory Declaration</h2>
              <div className="bg-dark-900 p-4 rounded-lg border border-dark-600 text-sm">
                <p className="text-gray-400 mb-1">Signed By</p>
                <p className="text-white font-bold text-lg">{dec.signatory_name || 'N/A'}</p>
                <p className="text-primary-400 mb-3">{dec.signatory_position || 'N/A'}</p>
                <p className="text-gray-500 flex items-center gap-2">
                  <Clock className="w-4 h-4"/> Date: {dec.declaration_date ? new Date(dec.declaration_date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>

            {/* BANKING */}
            {canViewBanking ? (
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary-400" /> Banking Details
                </h2>
                <div className="space-y-4">
                  {bankingAccounts.map((bank: any, idx: number) => (
                    <div key={idx} className="space-y-2 text-sm bg-dark-900 p-4 rounded-lg border border-dark-600 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-primary-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase">
                        {bank.currency || 'ZMW'}
                      </div>
                      <div className="flex justify-between mt-2"><span className="text-gray-500">Bank</span><span className="text-white font-medium">{bank.bank_name || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Branch</span><span className="text-white font-medium">{bank.branch_name || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Acc Name</span><span className="text-white font-medium">{bank.acc_name || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Acc No.</span><span className="text-white font-mono">{bank.acc_number || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Sort Code</span><span className="text-white font-mono">{bank.sort_code || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">SWIFT</span><span className="text-white font-mono">{bank.swift_code || 'N/A'}</span></div>
                    </div>
                  ))}
                  {bankingAccounts.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No banking data provided.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 text-center opacity-70">
                <CreditCard className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Banking details are restricted to Finance and Admin roles.</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}