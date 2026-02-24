'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import { 
  Search, Filter, Eye, PackageCheck, Truck, MonitorSmartphone
} from 'lucide-react';

interface GRN {
  grn_id: string;
  grn_number: string;
  po_number: string;
  vendor_name: string;
  receipt_type: string;
  received_date: string;
  received_by_name: string;
  delivery_note_ref: string;
}

export default function GRNList() {
  const router = useRouter();
  const [grns, setGrns] = useState<GRN[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    fetchGRNs();
  }, [typeFilter]);

  const fetchGRNs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter) params.append('receipt_type', typeFilter);

      const response = await api.get(`/grns?${params.toString()}`);
      setGrns(response.data);
    } catch (error) {
      console.error('Failed to fetch GRNs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGRNs = grns.filter(g => 
    g.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.vendor_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl">
      
      {/* Filters & Search Bar */}
      <div className="p-4 border-b border-dark-700 flex flex-col md:flex-row gap-4 justify-between items-center bg-dark-900/50">
        
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search GRN, PO, or Vendor..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500 transition-colors"
          />
        </div>

        <div className="w-full md:w-auto">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full md:w-48 pl-9 pr-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white appearance-none"
            >
              <option value="">All Receipt Types</option>
              <option value="PHYSICAL">Physical Delivery</option>
              <option value="SERVICE">Service / Electronic</option>
            </select>
          </div>
        </div>

      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-dark-900/80 border-b border-dark-700 text-xs uppercase tracking-wider text-gray-400">
              <th className="px-6 py-4 font-medium">GRN Number</th>
              <th className="px-6 py-4 font-medium">PO Reference</th>
              <th className="px-6 py-4 font-medium">Vendor</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Date Received</th>
              <th className="px-6 py-4 font-medium">Received By</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
                  Loading receipts...
                </td>
              </tr>
            ) : filteredGRNs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No Goods Receipt Notes found.
                </td>
              </tr>
            ) : (
              filteredGRNs.map((grn) => (
                <tr key={grn.grn_id} className="hover:bg-dark-700/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono text-sm font-bold text-green-400">{grn.grn_number}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono text-sm text-gray-300">{grn.po_number}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-white font-medium truncate max-w-[200px]">{grn.vendor_name}</p>
                    {grn.delivery_note_ref && <p className="text-xs text-gray-500 mt-1">Ref: {grn.delivery_note_ref}</p>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {grn.receipt_type === 'PHYSICAL' ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1 w-max"><Truck className="w-3 h-3"/> Physical</span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1 w-max"><MonitorSmartphone className="w-3 h-3"/> Service</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {new Date(grn.received_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {grn.received_by_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button 
                      onClick={() => router.push(`/vendor-management/goods-receipts/${grn.grn_id}`)}
                      className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors inline-flex items-center gap-2"
                      title="View Details"
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