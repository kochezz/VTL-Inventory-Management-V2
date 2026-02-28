'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import { 
  Search, 
  Filter, 
  Eye, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  XCircle,
  AlertCircle,
  FileText, // Added QMS Icons
  AlertOctagon,
  Users
} from 'lucide-react';
import RaiseNCRModal from '@/components/qms/RaiseNCRModal'; // Added NCR Modal Import

interface Vendor {
  vendor_id: string;
  vtl_supplier_id: string | null;
  legal_name: string;
  trading_name: string | null;
  primary_category: string;
  status: string;
  created_at: string;
  qa_approved_at: string | null;
  created_by_name: string | null;
}

const CATEGORIES: Record<string, string> = {
  MFG: 'Manufacturing',
  RAW: 'Raw Materials',
  PKG: 'Packaging',
  ENG: 'Engineering',
  SVC: 'Service Works',
  LOG: 'Logistics',
  CON: 'Consultancy',
  ICT: 'IT & Tech',
  FIN: 'Financial',
  FAC: 'Facilities',
  MKT: 'Marketing',
  OTH: 'Other',
};

export default function ApprovedVendorList() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // QMS Integration State
  const [showNCRModal, setShowNCRModal] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, [statusFilter, categoryFilter]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      // Construct query params
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);

      const response = await api.get(`/suppliers?${params.toString()}`);
      setVendors(response.data);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter by search query locally for snappy performance
  const filteredVendors = vendors.filter(v => 
    v.legal_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.vtl_supplier_id && v.vtl_supplier_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1 w-max"><ShieldCheck className="w-3 h-3"/> Approved</span>;
      case 'CONDITIONALLY_APPROVED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-1 w-max"><ShieldAlert className="w-3 h-3"/> Conditional</span>;
      case 'AWAITING_QA':
      case 'QA_REVIEW':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1 w-max"><Clock className="w-3 h-3"/> QA Review</span>;
      case 'REVISION_REQUIRED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-1 w-max"><AlertCircle className="w-3 h-3"/> Needs Revision</span>;
      case 'REJECTED':
      case 'SUSPENDED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1 w-max"><XCircle className="w-3 h-3"/> {status}</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20 w-max">Draft</span>;
    }
  };

  return (
    <>
      <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl">
        
        {/* QMS INTEGRATED HEADER */}
        <div className="p-4 border-b border-dark-700 flex flex-col sm:flex-row justify-between items-center bg-dark-900 gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-400" /> 
            Approved Vendor List (AVL)
          </h2>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.open('/qms/documents?search=QA-PUR-VEN-SOP-002', '_blank')} 
              className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <FileText className="w-4 h-4"/> Vendor Management SOP
            </button>
            <button 
              onClick={() => setShowNCRModal(true)} 
              className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <AlertOctagon className="w-4 h-4"/> Log Vendor NCR
            </button>
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div className="p-4 border-b border-dark-700 flex flex-col md:flex-row gap-4 justify-between items-center bg-dark-900/50">
          
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by company name or VTL-ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 transition-colors"
            />
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-48">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white appearance-none"
              >
                <option value="">All Categories</option>
                {Object.entries(CATEGORIES).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 md:w-48">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white appearance-none"
              >
                <option value="">All Statuses</option>
                <option value="APPROVED">Approved (AVL)</option>
                <option value="CONDITIONALLY_APPROVED">Conditionally Approved</option>
                <option value="AWAITING_QA">Pending QA</option>
                <option value="DRAFT">Drafts</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>

        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-dark-900/80 border-b border-dark-700 text-xs uppercase tracking-wider text-gray-400">
                <th className="px-6 py-4 font-medium">VTL Supplier ID</th>
                <th className="px-6 py-4 font-medium">Vendor Name</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Date Added</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
                    Loading vendors...
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No vendors found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => (
                  <tr key={vendor.vendor_id} className="hover:bg-dark-700/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vendor.vtl_supplier_id ? (
                        <span className="font-mono text-sm text-primary-400">{vendor.vtl_supplier_id}</span>
                      ) : (
                        <span className="text-gray-500 text-sm italic">Pending Approval</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">{vendor.legal_name}</p>
                      {vendor.trading_name && <p className="text-xs text-gray-400">T/A: {vendor.trading_name}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-dark-900 border border-dark-600 text-gray-300">
                        {CATEGORIES[vendor.primary_category] || vendor.primary_category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(vendor.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {new Date(vendor.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => router.push(`/vendor-management/suppliers/${vendor.vendor_id}`)}
                        className="p-2 text-gray-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-colors inline-flex items-center gap-2"
                        title="View Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Embedded QMS NCR Modal */}
      <RaiseNCRModal 
        isOpen={showNCRModal}
        onClose={() => setShowNCRModal(false)}
        sourceModule="Procurement"
        sourceId="Vendor Performance Issue"
        onSuccess={() => alert('Vendor NCR successfully logged into the QMS.')}
      />
    </>
  );
}