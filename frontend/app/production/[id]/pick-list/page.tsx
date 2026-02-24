'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import axios from 'axios';
import { Printer, ArrowLeft } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function PickListPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  
  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && params.id) {
      fetchBatchDetails();
    }
  }, [token, params.id]);

  const fetchBatchDetails = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/production/batches/${params.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBatch(response.data.batch);
    } catch (err) {
      console.error('Failed to load batch', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading Pick List...</div>;
  if (!batch) return <div className="p-10 text-center">Batch not found.</div>;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white text-black p-4 md:p-8 font-sans">
      
      {/* Non-printable controls */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Batch
        </button>
        <button 
          onClick={() => window.print()} 
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-lg"
        >
          <Printer className="w-4 h-4" /> Print Pick List
        </button>
      </div>

      {/* The Printable A4 Document */}
      <div className="max-w-4xl mx-auto bg-white p-8 border border-gray-300 shadow-sm print:shadow-none print:border-none print:p-0">
        
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">VILAGIO TRADING LTD</h1>
            <p className="text-gray-600 text-sm font-medium mt-1">PRODUCTION MATERIAL PICK LIST</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-500">Document No.</p>
            <p className="text-xl font-mono font-bold">{batch.batch_number}</p>
          </div>
        </div>

        {/* Batch Meta Data */}
        <div className="grid grid-cols-2 border border-black mb-8 text-sm">
          <div className="p-3 border-r border-b border-black">
            <span className="text-gray-500 block text-xs uppercase font-bold">Product Target</span>
            <span className="font-bold text-lg">{batch.product_name}</span>
          </div>
          <div className="p-3 border-b border-black">
            <span className="text-gray-500 block text-xs uppercase font-bold">Target Quantity</span>
            <span className="font-mono font-bold text-lg">{batch.planned_quantity.toLocaleString()} units</span>
          </div>
          <div className="p-3 border-r border-black">
            <span className="text-gray-500 block text-xs uppercase font-bold">Production Line</span>
            <span className="font-medium">{batch.production_line} (Shift: {batch.shift})</span>
          </div>
          <div className="p-3">
            <span className="text-gray-500 block text-xs uppercase font-bold">Production Date</span>
            <span className="font-medium">{new Date(batch.production_date).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Component Instructions */}
        <div className="mb-4">
          <h2 className="text-lg font-bold uppercase border-b border-gray-400 pb-1 mb-2">Required Components</h2>
          <p className="text-xs text-gray-600 italic">Operator instructions: Proceed to the indicated warehouse locations. Verify the SKU and Lot Number before picking. Tick the box once physically secured.</p>
        </div>

        {/* Component Table */}
        <table className="w-full text-left border-collapse border border-black mb-12">
          <thead>
            <tr className="bg-gray-100 print:bg-gray-100">
              <th className="border border-black p-2 text-xs uppercase w-10 text-center">Pick</th>
              <th className="border border-black p-2 text-xs uppercase">SKU / Item</th>
              <th className="border border-black p-2 text-xs uppercase">Warehouse Location</th>
              <th className="border border-black p-2 text-xs uppercase">Target Lot</th>
              <th className="border border-black p-2 text-xs uppercase text-right">Qty to Pick</th>
            </tr>
          </thead>
          <tbody>
            {batch.components?.map((comp: any, idx: number) => (
              <tr key={comp.component_id} className="border-b border-black">
                <td className="border border-black p-2 text-center align-middle">
                  <div className="w-6 h-6 border-2 border-gray-400 rounded mx-auto"></div>
                </td>
                <td className="border border-black p-2">
                  <div className="font-bold text-sm">{comp.component_name}</div>
                  <div className="font-mono text-xs text-gray-600">{comp.sku}</div>
                </td>
                <td className="border border-black p-2">
                  <div className="font-bold text-sm">{comp.location_code}</div>
                  <div className="text-xs text-gray-600">{comp.location_name}</div>
                </td>
                <td className="border border-black p-2 font-mono text-sm">
                  {comp.supplier_batch_lot || 'FIFO'}
                </td>
                <td className="border border-black p-2 text-right font-mono font-bold text-lg">
                  {comp.quantity_assigned.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures & Approvals */}
        <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t-2 border-gray-300">
          <div>
            <div className="border-b border-black mb-1 h-8"></div>
            <p className="text-xs font-bold uppercase text-gray-600">Issued By (Production/Planning)</p>
            <p className="text-sm mt-1">{batch.created_by_name}</p>
          </div>
          <div>
            <div className="border-b border-black mb-1 h-8"></div>
            <p className="text-xs font-bold uppercase text-gray-600">Picked & Verified By (Warehouse)</p>
            <p className="text-sm mt-1 text-gray-400 italic">Sign & Date</p>
          </div>
        </div>

      </div>
    </div>
  );
}