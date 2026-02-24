'use client';

import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CustomerOnboardingForm from '@/components/crm/CustomerOnboardingForm';
import { ArrowLeft, Users } from 'lucide-react';

export default function NewCustomerPage() {
  const router = useRouter();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        
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
              <Users className="w-8 h-8 text-primary-400" />
              Onboard New Customer
            </h1>
            <p className="text-gray-400 mt-1">
              Add a new buyer to the CRM. Tier 3 (Chain) customers require CEO notification.
            </p>
          </div>
        </div>

        {/* The Form Component */}
        <CustomerOnboardingForm />
        
      </div>
    </DashboardLayout>
  );
}