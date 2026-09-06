'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ArrowLeft, ClipboardList, MapPin, Calendar, User, ShieldCheck } from 'lucide-react';

interface WorkOrderDetail {
  work_order_id: string;
  wo_number: string;
  order_type: string;
  status: string;
  priority: string;
  short_description: string;
  equipment_name: string | null;
  equipment_code: string | null;
  floc_name: string | null;
  floc_code: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  caused_unplanned_downtime: boolean;
  food_safety_cleared: boolean;
  created_by_name: string | null;
  cleared_by_name: string | null;
  created_at: string;
  closed_at: string | null;
}

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated && params.id) fetchWorkOrder();
  }, [isAuthenticated, params.id]);

  const fetchWorkOrder = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/engineering/work-orders/${params.id}`);
      setWorkOrder(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load this work order.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1000px] mx-auto space-y-6 pb-12">
        <button
          onClick={() => router.push('/engineering/work-orders')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Work Orders
        </button>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading work order...</div>
        ) : workOrder ? (
          <div className="space-y-6">
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-cyan-400 font-mono text-sm">{workOrder.wo_number}</p>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2 mt-1">
                    <ClipboardList className="w-6 h-6 text-cyan-500" />
                    {workOrder.short_description}
                  </h1>
                </div>
                <span className="px-3 py-1.5 rounded-lg text-sm font-bold bg-dark-700 text-white self-start sm:self-auto">
                  {workOrder.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Order Type</p>
                <p className="text-white">{workOrder.order_type.replace('_', ' ')}</p>
              </div>
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Priority</p>
                <p className="text-white">{workOrder.priority}</p>
              </div>
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 sm:col-span-2">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Asset / Location
                </p>
                <p className="text-white">
                  {workOrder.equipment_name || workOrder.floc_name || 'Not linked to a specific asset'}
                </p>
              </div>
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Scheduled Start
                </p>
                <p className="text-white">{formatDate(workOrder.scheduled_start)}</p>
              </div>
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Scheduled End
                </p>
                <p className="text-white">{formatDate(workOrder.scheduled_end)}</p>
              </div>
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Created By
                </p>
                <p className="text-white">{workOrder.created_by_name || '—'}</p>
              </div>
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Food Safety Cleared
                </p>
                <p className={workOrder.food_safety_cleared ? 'text-green-400' : 'text-gray-500'}>
                  {workOrder.food_safety_cleared ? 'Yes' : 'Not yet'}
                </p>
              </div>
              {workOrder.caused_unplanned_downtime && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 sm:col-span-2">
                  <p className="text-red-400 font-semibold">This work order caused unplanned downtime.</p>
                </div>
              )}
              {workOrder.closed_at && (
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 sm:col-span-2">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">Closed</p>
                  <p className="text-white">
                    {formatDate(workOrder.closed_at)}
                    {workOrder.cleared_by_name && ` by ${workOrder.cleared_by_name}`}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 text-gray-500 text-sm text-center">
              Time confirmations, checklist execution, and parts issuance will appear here in a future update.
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
