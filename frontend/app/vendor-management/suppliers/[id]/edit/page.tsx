'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SupplierRegistrationForm from '@/components/vendor/SupplierRegistrationForm';
import { ArrowLeft, Edit, AlertTriangle } from 'lucide-react';

export default function EditVendorPage() {
  const params = useParams();
  const router = useRouter();
  const [vendorData, setVendorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (params.id) {
      fetchVendor(params.id as string);
    }
  }, [params.id]);

  const fetchVendor = async (id: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/suppliers/${id}`);
      setVendorData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load vendor details for editing');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-96">
          <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !vendorData) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto mt-10 p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3" />
          <h2 className="text-xl font-bold">Error</h2>
          <p>{error}</p>
          <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-dark-800 text-white rounded-lg">Go Back</button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg transition-colors border border-dark-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Edit className="w-8 h-8 text-primary-400" />
              Edit Vendor: {vendorData.legal_name}
            </h1>
            <div className="bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded text-yellow-400 text-sm mt-2 flex items-center gap-2 max-w-fit">
              <AlertTriangle className="w-4 h-4" />
              Saving edits will return this vendor to DRAFT status for re-approval.
            </div>
          </div>
        </div>

        {/* The Form Component - Passing initialData and isEditing flag! */}
        <SupplierRegistrationForm 
          initialData={vendorData} 
          isEditing={true} 
        />
        
      </div>
    </DashboardLayout>
  );
}