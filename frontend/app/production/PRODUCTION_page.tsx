'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import axios from 'axios';
import { Plus, Filter, Search, ChevronDown } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CreateBatchModal from '@/components/production/CreateBatchModal';

interface Batch {
  batch_id: string;  // ✅ UUID is a string, not number
  batch_number: string;
  product_name: string;
  sku: string;
  production_date: string;
  planned_quantity: number;
  actual_output: number;
  status: string;
  created_by_name: string;
  created_at: string;
}

export default function ProductionPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchBatches();
    }
  }, [isAuthenticated, token, statusFilter, productFilter]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (productFilter) params.append('productId', productFilter);

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/production/batches?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Batches response:', response.data);
      
      // ✅ CRITICAL: Ensure we always set an array
      const batchData = response.data.batches || response.data || [];
      const batchArray = Array.isArray(batchData) ? batchData : [];
      
      console.log('Setting batches:', batchArray.length, 'items');
      setBatches(batchArray);
    } catch (err: any) {
      console.error('Error fetching batches:', err);
      setError(err.response?.data?.error || 'Failed to load batches');
      setBatches([]); // ✅ Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'draft': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'awaiting_qa': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'ready_for_setup': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'in_progress': 'bg-green-500/10 text-green-400 border-green-500/20',
      'completed': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      'released': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'rejected': 'bg-red-500/10 text-red-400 border-red-500/20',
      'on_hold': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  // ✅ Safety check for array operations
  const getStatusCounts = () => {
    const batchArray = Array.isArray(batches) ? batches : [];
    return {
      total: batchArray.length,
      draft: batchArray.filter(b => b.status === 'draft').length,
      in_progress: batchArray.filter(b => b.status === 'in_progress').length,
      awaiting_qa: batchArray.filter(b => b.status === 'awaiting_qa').length,
    };
  };

  const counts = getStatusCounts();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleBatchClick = (batchId: string) => {
    router.push(`/production/${batchId}`);
  };

  const handleCreateBatchSuccess = () => {
    fetchBatches();
  };

  // ✅ Ensure batches is always an array for rendering
  const batchArray = Array.isArray(batches) ? batches : [];

  // Don't render until auth is ready
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Production Batches</h1>
            <p className="text-gray-400">Manage and monitor production batch records</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Batch
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-dark-900 rounded-lg border border-dark-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Batches</p>
                <p className="text-3xl font-bold text-white">{counts.total}</p>
              </div>
              <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-dark-900 rounded-lg border border-dark-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Draft</p>
                <p className="text-3xl font-bold text-white">{counts.draft}</p>
              </div>
              <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-dark-900 rounded-lg border border-dark-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">In Progress</p>
                <p className="text-3xl font-bold text-white">{counts.in_progress}</p>
              </div>
              <div className="h-12 w-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-dark-900 rounded-lg border border-dark-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Awaiting QA</p>
                <p className="text-3xl font-bold text-white">{counts.awaiting_qa}</p>
              </div>
              <div className="h-12 w-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-dark-900 rounded-lg border border-dark-800 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by batch number or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="awaiting_qa">Awaiting QA</option>
                <option value="ready_for_setup">Ready for Setup</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="released">Released</option>
                <option value="rejected">Rejected</option>
                <option value="on_hold">On Hold</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option value="">All Products</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Batch List */}
        <div className="bg-dark-900 rounded-lg border border-dark-800 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading batches...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={fetchBatches}
                  className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : batchArray.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="h-16 w-16 bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="text-gray-400 mb-2">No batches found</p>
                <p className="text-sm text-gray-500 mb-4">Create your first batch to get started</p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Batch
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-950 border-b border-dark-800">
                  <tr>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Batch Number</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Product</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Production Date</th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">Quantity</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Status</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Created By</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ✅ Use batchArray instead of batches directly */}
                  {batchArray.map((batch, index) => (
                    <tr
                      key={batch.batch_id}
                      onClick={() => handleBatchClick(batch.batch_id)}
                      className={`border-b border-dark-800 hover:bg-dark-800 transition-colors cursor-pointer ${
                        index % 2 === 0 ? 'bg-dark-900' : 'bg-dark-950'
                      }`}
                    >
                      <td className="py-4 px-6">
                        <span className="text-blue-400 font-medium">{batch.batch_number}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="text-white font-medium">{batch.product_name}</p>
                          <p className="text-sm text-gray-500">{batch.sku}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-300">{formatDate(batch.production_date)}</td>
                      <td className="py-4 px-6 text-right">
                        <div>
                          <p className="text-white font-medium">{batch.planned_quantity?.toLocaleString()} units</p>
                          {batch.actual_output && (
                            <p className="text-sm text-gray-500">{batch.actual_output.toLocaleString()} actual</p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-lg border font-medium text-sm capitalize ${getStatusColor(batch.status)}`}>
                          {batch.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-300">{batch.created_by_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Debug Section */}
        <div className="mt-6">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
          >
            {showDebug ? '▼' : '▶'} Debug Information
          </button>

          {showDebug && (
            <div className="mt-4 bg-dark-950 rounded-lg border border-dark-800 p-4 overflow-x-auto">
              <pre className="text-xs text-gray-400">
                {JSON.stringify({
                  isAuthenticated,
                  hasToken: !!token,
                  batchCount: batchArray.length,
                  batchesIsArray: Array.isArray(batches),
                  loading,
                  error
                }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Create Batch Modal */}
      {isAuthenticated && token && (
        <CreateBatchModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreateBatchSuccess}
        />
      )}
    </DashboardLayout>
  );
}
