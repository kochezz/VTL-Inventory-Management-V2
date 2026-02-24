'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import { 
  Search, Filter, Eye, Clock, 
  CheckCircle2, XCircle, AlertCircle, ShieldAlert
} from 'lucide-react';

interface PurchaseOrder {
  po_id: string;
  po_number: string;
  date_raised: string;
  currency: string;
  total_amount: string;
  status: string;
  vendor_name: string;
  raised_by_name: string;
}

export default function PurchaseOrderList() {
  const router = useRouter();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchPOs();
  }, [statusFilter]);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const response = await api.get(`/pos?${params.toString()}`);
      setPos(response.data);
    } catch (error) {
      console.error('Failed to fetch POs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPOs = pos.filter(p => 
    p.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.vendor_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1 w-max"><CheckCircle2 className="w-3 h-3"/> Approved</span>;
      case 'PENDING_CFO':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1 w-max"><Clock className="w-3 h-3"/> Pending CFO</span>;
      case 'PENDING_CEO':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1 w-max"><ShieldAlert className="w-3 h-3"/> Pending CEO</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1 w-max"><XCircle className="w-3 h-3"/> Rejected</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20 w-max"><AlertCircle className="w-3 h-3"/> {status}</span>;
    }
  };

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl">
      
      {/* Filters & Search Bar */}
      <div className="p-4 border-b border-dark-700 flex flex-col md:flex-row gap-4 justify-between items-center bg-dark-900/50">
        
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by PO Number or Vendor..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 transition-colors"
          />
        </div>

        <div className="w-full md:w-auto">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-48 pl-9 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white appearance-none"
            >
              <option value="">All Statuses</option>
              <option value="PENDING_CFO">Pending CFO</option>
              <option value="PENDING_CEO">Pending CEO</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-dark-900/80 border-b border-dark-700 text-xs uppercase tracking-wider text-gray-400">
              <th className="px-6 py-4 font-medium">PO Number</th>
              <th className="px-6 py-4 font-medium">Vendor</th>
              <th className="px-6 py-4 font-medium">Date Raised</th>
              <th className="px-6 py-4 font-medium">Raised By</th>
              <th className="px-6 py-4 font-medium text-right">Total Amount</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
                  Loading purchase orders...
                </td>
              </tr>
            ) : filteredPOs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No Purchase Orders found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredPOs.map((po) => (
                <tr key={po.po_id} className="hover:bg-dark-700/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono text-sm font-bold text-primary-400">{po.po_number}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-white font-medium truncate max-w-[200px]">{po.vendor_name}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {new Date(po.date_raised).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {po.raised_by_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-xs text-gray-500 mr-1">{po.currency}</span>
                    <span className="text-white font-mono font-medium">
                      {parseFloat(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(po.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button 
                      onClick={() => router.push(`/vendor-management/purchase-orders/${po.po_id}`)}
                      className="p-2 text-gray-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-colors inline-flex items-center gap-2"
                      title="View Details & Approve"
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
  );
}