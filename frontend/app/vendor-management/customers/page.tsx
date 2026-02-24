'use client';

import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CustomerDirectory from '@/components/crm/CustomerDirectory';
import { Users, Plus } from 'lucide-react';

export default function CustomersPage() {
  const router = useRouter();

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-primary-400" />
              Customer CRM
            </h1>
            <p className="text-gray-400 mt-1">
              Manage your buyers, track onboarding pipelines, and view active accounts.
            </p>
          </div>
          
          <button
            onClick={() => router.push('/vendor-management/customers/new')}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-primary-500/20 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Onboard Customer
          </button>
        </div>

        {/* The CRM Table Component */}
        <CustomerDirectory />
        
      </div>
    </DashboardLayout>
  );
}