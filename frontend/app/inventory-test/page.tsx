'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { MapPin, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';

interface Location {
  location_id: string;
  location_code: string;
  location_name: string;
  location_type: string;
  is_active: boolean;
}

export default function InventoryTestPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const testLocations = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🧪 Testing GET /api/inventory/locations');
      console.log('Token:', token ? 'Present' : 'Missing');
      console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/locations`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('✅ Response:', response.data);
      setLocations(response.data);
      
    } catch (error: any) {
      console.error('❌ Error:', error);
      setError(error.response?.data?.message || error.message || 'Failed to fetch locations');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <MapPin className="w-8 h-8 text-primary-400" />
            Inventory Locations Test
          </h1>
          <p className="text-gray-400 mt-1">
            Test the inventory locations API endpoint
          </p>
        </div>

        {/* Test Button */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <button
            onClick={testLocations}
            disabled={loading}
            className="w-full px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test GET /api/inventory/locations'}
          </button>
          
          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {locations.length > 0 && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-dark-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  Results: {locations.length} Locations Found
                </h2>
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {locations.map((location) => (
                    <tr key={location.location_id} className="hover:bg-dark-700">
                      <td className="px-6 py-4 text-sm text-primary-400 font-medium">
                        {location.location_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-white">
                        {location.location_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {location.location_type}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {location.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Debug Info */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Debug Info</h3>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-gray-400">API URL:</span>
              <span className="text-white">{process.env.NEXT_PUBLIC_API_URL}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Token:</span>
              <span className="text-white">{token ? '✓ Present' : '✗ Missing'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Authenticated:</span>
              <span className="text-white">{isAuthenticated ? '✓ Yes' : '✗ No'}</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
