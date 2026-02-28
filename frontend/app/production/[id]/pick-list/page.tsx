'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import { Printer } from 'lucide-react';

export default function PickListPage() {
  const params = useParams();
  const [batch, setBatch] = useState<any>(null);

  useEffect(() => {
    if (params.id) {
      api.get(`/production/batches/${params.id}`).then(res => setBatch(res.data.batch));
    }
  }, [params.id]);

  if (!batch) return <div className="p-10 text-center">Loading Pick List...</div>;

  return (
    <div className="min-h-screen bg-gray-200 print:bg-white text-black p-4 font-sans">
      <div className="max-w-4xl mx-auto mb-6 flex justify-end print:hidden">
        <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow flex items-center gap-2 transition-colors">
          <Printer className="w-4 h-4"/> Print Pick List
        </button>
      </div>

      {/* A4 PRINTABLE DOCUMENT */}
      <div className="max-w-4xl mx-auto bg-white border border-gray-300 shadow-xl print:shadow-none print:border-none p-10">
        
        {/* HEADER BLOCK - VTL BRANDING */}
        <div className="flex justify-between items-start border-b-4 border-gray-900 pb-6 mb-6">
          <div className="flex items-center gap-6">
            {/* Logo Image */}
            <img 
              src="/logo.png" 
              alt="Vilagio" 
              className="h-20 w-auto object-contain"
              onError={(e) => {
                 e.currentTarget.src = "/logo-dark.png";
              }}
            />
            <div className="border-l-2 border-gray-300 pl-6">
              <h1 className="text-3xl font-black uppercase tracking-widest text-gray-900 mb-1">VILAGIO TRADING LIMITED</h1>
              <p className="text-sm text-gray-700">Plot No. 28441, Gymkhana | 50/50 Kitwe Road | CHINGOLA</p>
              <p className="text-sm text-gray-700">Email: quality@vilag.io | Quality System ISO 22000 & HACCP Compliant</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <h2 className="text-2xl font-light text-gray-700">Material Pick List</h2>
            <p className="text-sm font-bold text-gray-800 mt-1">Warehouse Operations</p>
            <p className="text-xs text-gray-500">Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* METADATA BLOCK */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-bold uppercase">Product to Manufacture</p>
            <p className="text-lg font-bold">{batch.product_name}</p>
            <p className="text-sm font-mono text-gray-600">SKU: {batch.sku}</p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-xs text-gray-500 font-bold uppercase">Production Batch</p>
            <p className="text-lg font-mono font-bold text-blue-800">{batch.batch_number}</p>
            <p className="text-sm font-mono text-gray-600">Trace: {batch.batch_record_code}</p>
          </div>
        </div>

        <div className="bg-gray-100 border border-gray-300 p-4 flex justify-between text-sm mb-8">
          <div><span className="font-bold">Target Quantity:</span> {batch.planned_quantity} Units</div>
          <div><span className="font-bold">Production Line:</span> {batch.production_line}</div>
          <div><span className="font-bold">Shift:</span> <span className="uppercase">{batch.shift}</span></div>
        </div>

        <div className="border-y-2 border-black py-2 mb-6 bg-gray-50">
          <h3 className="text-lg font-black tracking-widest pl-2">RAW MATERIALS & PACKAGING</h3>
        </div>

        {/* COMPONENTS TABLE */}
        <table className="w-full text-sm text-left border-collapse mb-12">
          <thead>
            <tr className="bg-gray-900 text-white text-xs uppercase tracking-wider">
              <th className="p-3 border border-gray-900">Component / Item</th>
              <th className="p-3 border border-gray-900">SKU</th>
              <th className="p-3 border border-gray-900">Warehouse Location</th>
              <th className="p-3 border border-gray-900 text-right">Qty Required</th>
              <th className="p-3 border border-gray-900 text-center">Picked</th>
            </tr>
          </thead>
          <tbody>
            {batch.components?.map((comp: any, idx: number) => (
              <tr key={idx} className="border-b border-gray-300">
                <td className="p-3 font-medium">{comp.component_name}</td>
                <td className="p-3 font-mono text-xs text-gray-600">{comp.sku}</td>
                <td className="p-3 text-gray-700">
                  {comp.location_name} <br/>
                  <span className="text-xs font-mono">{comp.location_code}</span>
                </td>
                <td className="p-3 text-right font-bold text-lg">{comp.quantity_assigned}</td>
                {/* Empty checkbox square for printing */}
                <td className="p-3 text-center align-middle">
                  <div className="w-6 h-6 border-2 border-gray-400 rounded mx-auto"></div>
                </td>
              </tr>
            ))}
            {(!batch.components || batch.components.length === 0) && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500 italic">No components assigned to this batch.</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* SIGNATURE HANDOVER BLOCK */}
        <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-gray-300">
          <div>
            <p className="text-xs text-gray-500 mb-8">Prepared By (Production)</p>
            <div className="border-b border-black mb-2">
              <span className="font-custom italic text-lg text-blue-900">{batch.created_by_name}</span>
            </div>
            <p className="text-xs font-bold text-gray-900">Signature</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-8">Issued By (Warehouse)</p>
            <div className="border-b border-black mb-2 h-7"></div>
            <p className="text-xs font-bold text-gray-900">Signature & Date</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-8">Received By (Operator)</p>
            <div className="border-b border-black mb-2 h-7"></div>
            <p className="text-xs font-bold text-gray-900">Signature & Date</p>
          </div>
        </div>
        
        <div className="mt-8 text-center text-xs text-gray-400">
          Generated by Vilagio ERP • Document Control
        </div>

      </div>
    </div>
  );
}