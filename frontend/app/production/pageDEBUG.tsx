'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import axios from 'axios';
import { Plus } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface Batch {
  batch_id: number;
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
  const { isAuthenticated, isLoading: authLoading, token, user } = useAuth();
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>({});

  // Auth guard
  useEffect(() => {
    console.log('🔒 Auth Guard Check:', {
      authLoading,
      isAuthenticated,
      hasToken: !!token,
      tokenLength: token?.length
    });
    
    if (!authLoading && !isAuthenticated) {
      console.log('❌ Not authenticated, redirecting to login');
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router, token]);

  // Fetch batches when authenticated
  useEffect(() => {
    console.log('📊 Fetch Effect Triggered:', {
      isAuthenticated,
      hasToken: !!token,
      tokenPreview: token?.substring(0, 20) + '...',
      axiosHeader: axios.defaults.headers.common['Authorization']?.toString().substring(0, 30) + '...'
    });

    if (isAuthenticated && token) {
      console.log('✅ Conditions met, fetching batches...');
      fetchBatches();
    } else {
      console.log('⏳ Waiting for auth...', { isAuthenticated, hasToken: !!token });
    }
  }, [isAuthenticated, token]);

  const fetchBatches = async () => {
    console.log('🔍 === FETCH BATCHES START ===');
    
    try {
      setLoading(true);
      setError('');

      // Debug: Check token sources
      const hookToken = token;
      const localToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const axiosHeader = axios.defaults.headers.common['Authorization'];

      console.log('🔑 Token Sources:', {
        fromHook: hookToken?.substring(0, 30) + '...',
        fromLocalStorage: localToken?.substring(0, 30) + '...',
        fromAxiosDefaults: axiosHeader?.toString().substring(0, 40) + '...',
        allMatch: hookToken === localToken?.substring(0, localToken.length)
      });

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const fullUrl = `${API_URL}/production/batches`;
      
      console.log('🌐 Making request to:', fullUrl);
      console.log('🔑 Using token from hook:', hookToken?.substring(0, 30) + '...');

      // Make the request with explicit header
      const response = await axios.get(fullUrl, {
        headers: { 
          Authorization: `Bearer ${hookToken}`
        }
      });

      console.log('✅ Response received:', {
        status: response.status,
        batchCount: response.data.batches?.length || 0,
        data: response.data
      });

      setBatches(response.data.batches || []);
      
      setDebugInfo({
        success: true,
        batchCount: response.data.batches?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      setLoading(false);
    } catch (err: any) {
      console.error('❌ === FETCH BATCHES ERROR ===');
      console.error('Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: {
          url: err.config?.url,
          headers: err.config?.headers,
          method: err.config?.method
        }
      });
      
      setError(err.response?.data?.error || err.message || 'Failed to load batches');
      setDebugInfo({
        success: false,
        error: err.message,
        status: err.response?.status,
        timestamp: new Date().toISOString()
      });
      
      setLoading(false);
    }
    
    console.log('🔍 === FETCH BATCHES END ===');
  };

  // Don't render until auth is ready
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Initializing authentication...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-gray-400">Redirecting to login...</p>
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
            <p className="text-gray-400">Debug Mode - Check console for detailed logs</p>
          </div>
        </div>

        {/* Debug Panel */}
        <div className="bg-dark-900 rounded-lg border border-dark-800 p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">🔍 Debug Information</h3>
          <div className="space-y-2 text-sm font-mono">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-400">Authenticated:</span>
                <span className={`ml-2 ${isAuthenticated ? 'text-green-400' : 'text-red-400'}`}>
                  {isAuthenticated ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Auth Loading:</span>
                <span className={`ml-2 ${authLoading ? 'text-yellow-400' : 'text-green-400'}`}>
                  {authLoading ? '⏳ Yes' : '✅ No'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Has Token:</span>
                <span className={`ml-2 ${token ? 'text-green-400' : 'text-red-400'}`}>
                  {token ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Token Length:</span>
                <span className="ml-2 text-white">{token?.length || 0} chars</span>
              </div>
              <div>
                <span className="text-gray-400">User:</span>
                <span className="ml-2 text-white">{user?.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Batch Count:</span>
                <span className="ml-2 text-white">{batches.length}</span>
              </div>
            </div>
            
            {token && (
              <div className="mt-4 pt-4 border-t border-dark-700">
                <span className="text-gray-400">Token Preview:</span>
                <div className="mt-2 p-2 bg-dark-950 rounded text-xs text-green-400 break-all">
                  {token.substring(0, 100)}...
                </div>
              </div>
            )}

            {debugInfo && (
              <div className="mt-4 pt-4 border-t border-dark-700">
                <span className="text-gray-400">Last Fetch Attempt:</span>
                <pre className="mt-2 p-2 bg-dark-950 rounded text-xs text-white overflow-auto">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Manual Refresh Button */}
        <div className="mb-6">
          <button
            onClick={() => {
              console.log('🔄 Manual refresh triggered');
              fetchBatches();
            }}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {loading ? 'Loading...' : 'Refresh Batches'}
          </button>
        </div>

        {/* Content */}
        <div className="bg-dark-900 rounded-lg border border-dark-800 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading batches...</p>
                <p className="text-xs text-gray-500 mt-2">Check console for detailed logs</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center max-w-2xl">
                <p className="text-red-400 mb-4 text-lg font-semibold">Error Loading Batches</p>
                <p className="text-red-300 mb-6">{error}</p>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4 text-left">
                  <p className="text-sm text-red-200 font-mono">{error}</p>
                </div>
                <button
                  onClick={fetchBatches}
                  className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : batches.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-gray-400 mb-2">No batches found</p>
                <p className="text-sm text-gray-500">The query succeeded but returned 0 batches</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-950 border-b border-dark-800">
                  <tr>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Batch Number</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Product</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.batch_id} className="border-b border-dark-800 hover:bg-dark-800">
                      <td className="py-4 px-6 text-blue-400">{batch.batch_number}</td>
                      <td className="py-4 px-6 text-white">{batch.product_name}</td>
                      <td className="py-4 px-6 text-gray-300">{batch.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
