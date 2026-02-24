'use client';

import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import POCreationForm from '@/components/po/POCreationForm';
import { ArrowLeft, FileText } from 'lucide-react';

export default function NewPurchaseOrderPage() {
  const router = useRouter();

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        
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
              <FileText className="w-8 h-8 text-primary-400" />
              Raise Purchase Order
            </h1>
            <p className="text-gray-400 mt-1">
              Create a new PO. Ensure a valid PDF Quotation is attached for approval routing.
            </p>
          </div>
        </div>

        {/* The PO Form Component */}
        <POCreationForm />
        
      </div>
    </DashboardLayout>
  );
}