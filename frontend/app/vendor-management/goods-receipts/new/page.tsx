'use client';

import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GRNCreationForm from '@/components/grn/GRNCreationForm';
import { ArrowLeft, PackageCheck } from 'lucide-react';

export default function NewGoodsReceiptPage() {
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
              <PackageCheck className="w-8 h-8 text-green-400" />
              Goods Receipt Note (GRN)
            </h1>
            <p className="text-gray-400 mt-1">
              Log incoming deliveries against approved Purchase Orders and update inventory levels.
            </p>
          </div>
        </div>

        {/* The GRN Form Component */}
        <GRNCreationForm />
        
      </div>
    </DashboardLayout>
  );
}