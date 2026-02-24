'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  ArrowLeft, PackageCheck, Building2, FileText, Database, 
  Truck, MonitorSmartphone, CheckCircle2, AlertTriangle, XCircle, 
  UserCheck, CalendarDays, AlertCircle
} from 'lucide-react';

export default function GRNDetailsPage() {
  const params = useParams();
  const router = useRouter();
  
  const [grn, setGrn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (params.id) fetchGRNDetails(params.id as string);
  }, [params.id]);

  const fetchGRNDetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/grns/${id}`);
      setGrn(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load GRN details');
    } finally {
      setLoading(false);
    }
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case 'GOOD': return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1 w-max"><CheckCircle2 className="w-3 h-3"/> Good</span>;
      case 'DAMAGED': return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-1 w-max"><AlertTriangle className="w-3 h-3"/> Damaged</span>;
      case 'REJECTED': return <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1 w-max"><XCircle className="w-3 h-3"/> Rejected</span>;
      default: return <span className="text-gray-400">{condition}</span>;
    }
  };

  if (loading) return (
    <DashboardLayout>
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
      </div>
    </DashboardLayout>
  );

  if (error && !grn) return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto mt-10 p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Error Loading GRN</h2>
        <p>{error}</p>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors">Go Back</button>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="max-w-[1200px] mx-auto space-y-6 pb-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-dark-800 p-6 rounded-xl border border-dark-700 shadow-lg">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 bg-dark-900 hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg transition-colors border border-dark-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-white font-mono">{grn.grn_number}</h1>
                {grn.receipt_type === 'PHYSICAL' ? (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-2"><Truck className="w-4 h-4"/> Physical Delivery</span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-2"><MonitorSmartphone className="w-4 h-4"/> Service Receipt</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400 mt-2">
                <span className="flex items-center gap-1"><UserCheck className="w-4 h-4" /> Received by: <span className="text-white font-medium">{grn.received_by_name}</span></span>
                <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" /> Date: <span className="text-white font-medium">{new Date(grn.received_date).toLocaleString()}</span></span>
              </div>
            </div>
          </div>
          
          <button onClick={() => router.push(`/vendor-management/purchase-orders/${grn.po_id}`)} className="px-4 py-2 bg-dark-900 hover:bg-dark-700 border border-dark-600 text-primary-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <FileText className="w-4 h-4" /> View Original PO
          </button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-400" /> Vendor Details
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-dark-700/50 pb-2"><span className="text-gray-500">Vendor Name</span> <span className="text-white font-medium">{grn.vendor_name}</span></div>
              <div className="flex justify-between border-b border-dark-700/50 pb-2"><span className="text-gray-500">Purchase Order Ref</span> <span className="text-primary-400 font-mono font-medium">{grn.po_number}</span></div>
            </div>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-400" /> Delivery Meta Data
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-dark-700/50 pb-2"><span className="text-gray-500">Vendor DN Ref</span> <span className="text-white font-mono">{grn.delivery_note_ref || 'N/A'}</span></div>
              <div className="flex justify-between border-b border-dark-700/50 pb-2"><span className="text-gray-500">System Status</span> <span className="text-green-400 font-medium">{grn.status}</span></div>
            </div>
          </div>
        </div>

        {/* Global Notes (If any) */}
        {grn.notes && (
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <h3 className="text-sm font-medium text-gray-400 mb-1">Receiving Notes</h3>
            <p className="text-white">{grn.notes}</p>
          </div>
        )}

        {/* Received Items Table */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 overflow-x-auto shadow-lg border-t-4 border-t-green-500/50">
          <h2 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2 flex items-center gap-2">
            <Database className="w-5 h-5 text-green-400" /> Received Items Log
          </h2>
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase text-gray-500 border-b border-dark-700 bg-dark-900/50">
                <th className="px-4 py-3 font-medium">Item Description</th>
                <th className="px-4 py-3 font-medium text-right">Qty Received</th>
                <th className="px-4 py-3 font-medium">Condition</th>
                <th className="px-4 py-3 font-medium">Item Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {grn.items?.map((item: any) => (
                <tr key={item.grn_line_id} className="hover:bg-dark-700/20 transition-colors">
                  <td className="px-4 py-4 text-sm text-white">{item.item_description}</td>
                  <td className="px-4 py-4 text-sm text-white font-mono text-right">
                    <span className="font-bold text-green-400">{item.quantity_received}</span> <span className="text-gray-500 text-xs">{item.unit}</span>
                  </td>
                  <td className="px-4 py-4">
                    {getConditionBadge(item.condition_status)}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-400 italic">
                    {item.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="mt-4 pt-4 border-t border-dark-700 flex justify-between items-center text-sm">
            <span className="text-gray-500">Total Unique Items Received: <span className="text-white font-bold">{grn.items?.length || 0}</span></span>
            {grn.receipt_type === 'PHYSICAL' && (
              <span className="text-blue-400 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Live Inventory Updated</span>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}