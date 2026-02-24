'use client';

import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GRNList from '@/components/grn/GRNList';
import { PackageCheck, Plus } from 'lucide-react';

export default function GoodsReceiptsPage() {
  const router = useRouter();

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <PackageCheck className="w-8 h-8 text-green-400" />
              Goods Receipt Notes (GRN)
            </h1>
            <p className="text-gray-400 mt-1">
              Track physical deliveries and services received against approved Purchase Orders.
            </p>
          </div>
          
          <button
            onClick={() => router.push('/vendor-management/goods-receipts/new')}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-green-500/20 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Receive Goods
          </button>
        </div>

        {/* The GRN Table Component */}
        <GRNList />
        
      </div>
    </DashboardLayout>
  );
}