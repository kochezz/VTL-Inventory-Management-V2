'use client';

import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ApprovedVendorList from '@/components/vendor/ApprovedVendorList';
import { Building2, Plus } from 'lucide-react';

export default function SuppliersDirectoryPage() {
  const router = useRouter();

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-primary-400" />
              Supplier Directory (AVL)
            </h1>
            <p className="text-gray-400 mt-1">
              Manage your Approved Vendor List, track compliance, and review pending registrations.
            </p>
          </div>
          
          <button
            onClick={() => router.push('/vendor-management/suppliers/new')}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-primary-500/20 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Register New Supplier
          </button>
        </div>

        {/* The Table Component */}
        <ApprovedVendorList />
        
      </div>
    </DashboardLayout>
  );
}