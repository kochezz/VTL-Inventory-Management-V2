'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth, api } from '@/hooks/useAuth';
import { 
  Plus, Search, Filter, PlayCircle, CheckCircle2, 
  Clock, AlertCircle, FileText, Settings2, Calendar, LayoutGrid, Activity
} from 'lucide-react';

// RESTORED: Your original modal import!
import CreateBatchModal from '@/components/production/CreateBatchModal';

interface Batch {
  batch_id: string;
  batch_number: string;
  product_name: string;
  sku: string;
  production_date: string;
  planned_quantity: number;
  actual_output: number;
  status: string;
  display_status?: string; 
  created_by_name: string;
  created_at: string;
}

export default function ProductionPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // RESTORED: Your original modal state!
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });

  const [stats, setStats] = useState({
    active: 0,
    awaiting_qa: 0,
    completed_today: 0,
    efficiency: 0
  });

  useEffect(() => {
    fetchBatches();
  }, [filters]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      
      // Build query string
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
      
      const response = await api.get(`/production/batches?${queryParams.toString()}`);
      const data = response.data.batches || [];
      setBatches(data);
      
      // Calculate basic stats from all returned data
      const active = data.filter((b: Batch) => b.status === 'in_progress' || b.status === 'ready_for_setup').length;
      
      // Use display_status if available to count Awaiting QA
      const awaitingQa = data.filter((b: Batch) => 
        b.display_status === 'awaiting_qa' || b.status === 'awaiting_qa'
      ).length;
      
      const todayStr = new Date().toISOString().split('T')[0];
      const completedToday = data.filter((b: Batch) => 
        b.status === 'completed' && b.production_date.startsWith(todayStr)
      ).length;
      
      setStats({
        active,
        awaiting_qa: awaitingQa,
        completed_today: completedToday,
        efficiency: 94 // Mock for now
      });
      
    } catch (err: any) {
      console.error('Failed to fetch batches:', err);
      setError('Failed to load production batches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      case 'ready_for_setup': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'in_progress': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'awaiting_qa': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'released': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateBatchSuccess = () => {
    setIsCreateModalOpen(false);
    fetchBatches();
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Settings2 className="w-6 h-6 text-primary-500" />
              Production Control
            </h1>
            <p className="text-gray-400 mt-1">Manage batches, IPQC, and line operations</p>
          </div>
          
          <button 
            // RESTORED: Opens your original modal instead of breaking the router!
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            New Batch
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg">
              <PlayCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Active Batches</p>
              <p className="text-2xl font-bold text-white">{stats.active}</p>
            </div>
          </div>
          
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 text-yellow-400 rounded-lg">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Awaiting QA</p>
              <p className="text-2xl font-bold text-white">{stats.awaiting_qa}</p>
            </div>
          </div>
          
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-green-500/10 text-green-400 rounded-lg">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Completed Today</p>
              <p className="text-2xl font-bold text-white">{stats.completed_today}</p>
            </div>
          </div>
          
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-primary-500/10 text-primary-400 rounded-lg">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">OEE (Est.)</p>
              <p className="text-2xl font-bold text-white">{stats.efficiency}%</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Search batch number or product..."
                className="w-full bg-dark-900 border border-dark-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-primary-500 focus:outline-none"
              />
            </div>
            
            <div className="w-full md:w-48 relative">
              <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-primary-500 focus:outline-none appearance-none"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="ready_for_setup">Ready for Setup</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_qa">Awaiting QA</option>
                <option value="completed">Completed</option>
                <option value="released">Released</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <div className="relative">
                <Calendar className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  name="dateFrom"
                  value={filters.dateFrom}
                  onChange={handleFilterChange}
                  className="bg-dark-900 border border-dark-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-primary-500 focus:outline-none [color-scheme:dark]"
                />
              </div>
              <span className="text-gray-500 flex items-center">-</span>
              <input
                type="date"
                name="dateTo"
                value={filters.dateTo}
                onChange={handleFilterChange}
                className="bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 focus:outline-none [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Batch List */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
          {error && (
            <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-dark-900/50 border-b border-dark-700">
                <tr>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Batch Info</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Production Date</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Output / Planned</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Created By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500"></div>
                      <p className="mt-2 text-gray-400">Loading batches...</p>
                    </td>
                  </tr>
                ) : batches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      <LayoutGrid className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                      <p className="text-lg font-medium text-white mb-1">No batches found</p>
                      <p>Try adjusting your filters or create a new batch.</p>
                    </td>
                  </tr>
                ) : (
                  batches.map((batch, index) => (
                    <tr 
                      key={batch.batch_id} 
                      onClick={() => router.push(`/production/${batch.batch_id}`)}
                      // ZEBRA STRIPING
                      className={`hover:bg-dark-700/60 transition-colors cursor-pointer ${index % 2 !== 0 ? 'bg-dark-900/30' : ''}`}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-dark-900 rounded-lg text-primary-400 shadow-inner">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-white">{batch.batch_number}</p>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {batch.batch_id.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-medium text-white">{batch.product_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">SKU: {batch.sku}</p>
                      </td>
                      <td className="py-4 px-6 text-gray-300">
                        {new Date(batch.production_date).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-end gap-2">
                          <span className="text-lg font-mono font-bold text-white">
                            {batch.actual_output || 0}
                          </span>
                          <span className="text-sm text-gray-500 mb-0.5">/ {batch.planned_quantity}</span>
                        </div>
                        {batch.status === 'in_progress' && (
                          <div className="w-full h-1.5 bg-dark-900 rounded-full mt-2 overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(100, ((batch.actual_output || 0) / batch.planned_quantity) * 100)}%` }}
                            ></div>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap align-middle">
                        {(() => {
                          const finalStatus = batch.display_status || batch.status || 'unknown';
                          return (
                            <span className={`px-3 py-1 rounded-lg border font-medium text-sm capitalize ${getStatusColor(finalStatus)}`}>
                              {finalStatus.replace(/_/g, ' ')}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-4 px-6 text-gray-300">{batch.created_by_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RESTORED: The actual modal component injection! */}
      {isCreateModalOpen && (
        <CreateBatchModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreateBatchSuccess}
        />
      )}
    </DashboardLayout>
  );
}