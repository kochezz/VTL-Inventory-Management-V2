'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import { 
  Search, Filter, Eye, Users, 
  CheckCircle2, Clock, AlertCircle, Store, MapPin
} from 'lucide-react';

interface Customer {
  customer_id: string;
  vtl_customer_id: string | null;
  trading_name: string;
  tier_name: string;
  status: string;
  territory: string;
  created_at: string;
  onboarded_by_name: string;
}

export default function CustomerDirectory() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [statusFilter]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const response = await api.get(`/customers?${params.toString()}`);
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.trading_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.vtl_customer_id && c.vtl_customer_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
    c.territory?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1 w-max"><CheckCircle2 className="w-3 h-3"/> Active</span>;
      case 'PENDING_CFO':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1 w-max"><Clock className="w-3 h-3"/> Pending CFO</span>;
      case 'REVISION_REQUIRED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-1 w-max"><AlertCircle className="w-3 h-3"/> Revision Req.</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20 w-max">{status}</span>;
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'Chain':
        return <span className="px-2 py-1 rounded text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">CHAIN (T3)</span>;
      case 'Wholesale':
        return <span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">WHOLESALE (T2)</span>;
      case 'Kantemba':
        return <span className="px-2 py-1 rounded text-xs font-bold bg-gray-700 text-gray-300 border border-gray-600">KANTEMBA (T1)</span>;
      default:
        return <span className="px-2 py-1 rounded text-xs text-gray-400">{tier}</span>;
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
            placeholder="Search by Name, ID, or Territory..." 
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
              <option value="ACTIVE">Active</option>
              <option value="PENDING_CFO">Pending CFO</option>
              <option value="REVISION_REQUIRED">Revision Required</option>
            </select>
          </div>
        </div>

      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-dark-900/80 border-b border-dark-700 text-xs uppercase tracking-wider text-gray-400">
              <th className="px-6 py-4 font-medium">Customer ID</th>
              <th className="px-6 py-4 font-medium">Trading Name</th>
              <th className="px-6 py-4 font-medium">Tier</th>
              <th className="px-6 py-4 font-medium">Territory</th>
              <th className="px-6 py-4 font-medium">Onboarded By</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
                  Loading directory...
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No customers found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.customer_id} className="hover:bg-dark-700/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {customer.vtl_customer_id ? (
                      <span className="font-mono text-sm font-bold text-primary-400">{customer.vtl_customer_id}</span>
                    ) : (
                      <span className="text-xs text-gray-500 italic">Pending ID</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-white font-medium truncate max-w-[200px] flex items-center gap-2">
                      <Store className="w-4 h-4 text-gray-500" />
                      {customer.trading_name}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getTierBadge(customer.tier_name)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-gray-500" /> {customer.territory || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {customer.onboarded_by_name}
                    <div className="text-xs text-gray-600">{new Date(customer.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(customer.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button 
                      onClick={() => router.push(`/vendor-management/customers/${customer.customer_id}`)}
                      className="p-2 text-gray-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-colors inline-flex items-center gap-2"
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