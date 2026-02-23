'use client';

import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SupplierRegistrationForm from '@/components/vendor/SupplierRegistrationForm';
import { ArrowLeft, Building2 } from 'lucide-react';

export default function NewSupplierPage() {
  const router = useRouter();

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
              <Building2 className="w-8 h-8 text-primary-400" />
              Register New Supplier
            </h1>
            <p className="text-gray-400 mt-1">
              Complete the digital VTL Assessment Form (QA-00001) to add a new vendor.
            </p>
          </div>
        </div>

        {/* The Form Component */}
        <SupplierRegistrationForm />
        
      </div>
    </DashboardLayout>
  );
}