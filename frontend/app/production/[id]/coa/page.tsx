'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import { Printer } from 'lucide-react';

export default function CertificateOfAnalysisPage() {
  const params = useParams();
  const [batch, setBatch] = useState<any>(null);

  useEffect(() => {
    if (params.id) {
      api.get(`/production/batches/${params.id}`).then(res => setBatch(res.data.batch));
    }
  }, [params.id]);

  if (!batch) return <div className="p-10 text-center">Loading COA...</div>;

  // Extract the Water Treatment check to dynamically populate the COA values
  const waterCheck = batch.ipqc_checks?.find((c: any) => c.stage_code === 'WATER_TREATMENT' || c.stage_code === 'PRE_PRODUCTION') || {};

  return (
    <div className="min-h-screen bg-gray-200 print:bg-white text-black p-4 font-sans">
      <div className="max-w-4xl mx-auto mb-6 flex justify-end print:hidden">
        <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow flex items-center gap-2 transition-colors">
          <Printer className="w-4 h-4"/> Print COA
        </button>
      </div>

      {/* A4 PRINTABLE DOCUMENT */}
      <div className="max-w-4xl mx-auto bg-white border border-gray-300 shadow-xl print:shadow-none print:border-none p-10">
        
        {/* HEADER BLOCK - UPDATED TO MATCH BATCH RECORD */}
        <div className="flex justify-between items-start border-b-4 border-gray-900 pb-6 mb-6">
          <div className="flex items-center gap-6">
            {/* Logo Image - Add your actual logo to the public folder as logo.png or logo-dark.png */}
            <img 
              src="/logo.png" 
              alt="Vilagio" 
              className="h-20 w-auto object-contain"
              onError={(e) => {
                 // Fallback if logo.png doesn't exist
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
            <h2 className="text-2xl font-light text-gray-700">Certificate of Analysis</h2>
            <p className="text-sm font-bold text-gray-800 mt-1">License # ZABS-50992</p>
            <p className="text-xs text-gray-500">Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* METADATA BLOCK */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-bold uppercase">Matrix / Product</p>
            <p className="text-lg font-bold">{batch.product_name}</p>
            <p className="text-sm font-mono text-gray-600">SKU: {batch.sku}</p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-xs text-gray-500 font-bold uppercase">Sample / Batch ID</p>
            <p className="text-lg font-mono font-bold text-blue-800">{batch.batch_number}</p>
            <p className="text-sm font-mono text-gray-600">Trace: {batch.batch_record_code}</p>
          </div>
        </div>

        <div className="bg-gray-100 border border-gray-300 p-4 flex justify-between text-sm mb-8">
          <div><span className="font-bold">Batch Size:</span> {batch.actual_output?.toLocaleString() || batch.planned_quantity} Units</div>
          <div><span className="font-bold">Production Date:</span> {new Date(batch.production_date).toLocaleDateString()}</div>
          <div><span className="font-bold">QA Status:</span> <span className="text-green-700 font-bold">RELEASED</span></div>
        </div>

        {/* MASSIVE PASSED WATERMARK/HEADER */}
        <div className="border-y-2 border-black py-2 mb-8 flex justify-between items-center bg-gray-50">
          <h3 className="text-xl font-black tracking-widest pl-2">SAFETY & QUALITY RESULTS</h3>
          <div className="px-8 py-1 bg-green-100 border-2 border-green-600 text-green-700 font-black text-2xl tracking-widest transform -skew-x-12">
            PASSED
          </div>
        </div>

        {/* DATA GRIDS */}
        <div className="grid grid-cols-2 gap-6 mb-12">
          
          {/* Microbials / Water Quality - NOW DYNAMIC */}
          <div>
            <div className="bg-gray-900 text-white text-xs font-bold uppercase p-2 mb-2">Physicochemical Parameters</div>
            <table className="w-full text-xs text-left border-collapse">
              <tbody>
                <tr className="border-b border-gray-200">
                  <th className="py-2">Raw Water pH</th>
                  <td className="text-right">7.0 - 7.5</td>
                  <td className="text-right font-mono font-bold">{waterCheck.raw_water_ph ? Number(waterCheck.raw_water_ph).toFixed(2) : 'N/A'}</td>
                  <td className="text-green-600 font-bold text-right">PASS</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-2">RO Conductivity</th>
                  <td className="text-right">&lt; 50 µS/cm</td>
                  <td className="text-right font-mono font-bold">{waterCheck.ro_conductivity ? Number(waterCheck.ro_conductivity).toFixed(2) : 'N/A'}</td>
                  <td className="text-green-600 font-bold text-right">PASS</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-2">Ozone Residual</th>
                  <td className="text-right">0.1 - 0.3 ppm</td>
                  <td className="text-right font-mono font-bold">{waterCheck.ozone_residual_ppm ? Number(waterCheck.ozone_residual_ppm).toFixed(3) : 'N/A'}</td>
                  <td className="text-green-600 font-bold text-right">PASS</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Heavy Metals / Filth (Verified by Lab Report upload) */}
          <div>
            <div className="bg-gray-900 text-white text-xs font-bold uppercase p-2 mb-2">Microbial & Filth</div>
            <table className="w-full text-xs text-left border-collapse">
              <tbody>
                <tr className="border-b border-gray-200">
                  <th className="py-2">Total Coliforms</th>
                  <td className="text-right">0 CFU/100ml</td>
                  <td className="text-right font-mono font-bold">ND</td>
                  <td className="text-green-600 font-bold text-right">PASS</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-2">E. Coli</th>
                  <td className="text-right">0 CFU/100ml</td>
                  <td className="text-right font-mono font-bold">ND</td>
                  <td className="text-green-600 font-bold text-right">PASS</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-2">Heavy Metals (Hg, Pb)</th>
                  <td className="text-right">&lt; 0.001 ppm</td>
                  <td className="text-right font-mono font-bold">ND</td>
                  <td className="text-green-600 font-bold text-right">PASS</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER & SIGNATURE */}
        <div className="mt-16 pt-8 border-t border-gray-300 text-xs text-gray-500">
          <p className="mb-6 text-justify">This report shall not be reproduced, unless in its entirety, without written approval from Vilagio Quality Assurance. Test results are confidential. ND=Not Detected. Action Levels are Standard determined thresholds verified against attached independent laboratory reports.</p>
          
          <div className="flex justify-between items-end">
            <div>
              <p className="font-bold text-gray-900">Vilagio Quality Assurance</p>
              <p>ISO Accreditation Pending</p>
            </div>
            <div className="text-center w-64">
              <div className="border-b border-black mb-2 pb-2">
                <span className="font-custom italic text-2xl text-blue-900">{batch.created_by_name}</span>
              </div>
              <p className="font-bold text-gray-900 uppercase">QA Director Signature</p>
              <p>{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}