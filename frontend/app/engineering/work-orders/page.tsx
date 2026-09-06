'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClipboardList, Search, MapPin, AlertCircle } from 'lucide-react';

interface WorkOrder {
  work_order_id: string;
  wo_number: string;
  order_type: string;
  status: string;
  priority: string;
  short_description: string;
  equipment_name: string | null;
  floc_name: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'text-gray-400',
  APPROVED: 'text-blue-400',
  SCHEDULED: 'text-cyan-400',
  IN_PROGRESS: 'text-yellow-400',
  TECO_COMPLETE: 'text-purple-400',
  CLOSED: 'text-green-400',
  CANCELLED: 'text-red-500',
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  MEDIUM: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function WorkOrdersPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (isAuthenticated) fetchWorkOrders();
  }, [isAuthenticated]);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/engineering/work-orders');
      setWorkOrders(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load work orders.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = workOrders.filter((wo) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      wo.wo_number.toLowerCase().includes(q) ||
      wo.short_description.toLowerCase().includes(q) ||
      (wo.equipment_name || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    total: workOrders.length,
    open: workOrders.filter((w) => !['CLOSED', 'CANCELLED'].includes(w.status)).length,
    inProgress: workOrders.filter((w) => w.status === 'IN_PROGRESS').length,
    closed: workOrders.filter((w) => w.status === 'CLOSED').length,
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-cyan-500" />
              Work Orders
            </h1>
            <p className="text-gray-400 mt-1">Maintenance work order lifecycle</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">Total</p>
            <p className="text-3xl font-black text-white">{counts.total}</p>
          </div>
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-cyan-500">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">Open</p>
            <p className="text-3xl font-black text-cyan-400">{counts.open}</p>
          </div>
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-yellow-500">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">In Progress</p>
            <p className="text-3xl font-black text-yellow-400">{counts.inProgress}</p>
          </div>
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-green-500">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">Closed</p>
            <p className="text-3xl font-black text-green-400">{counts.closed}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by WO number, description, or equipment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-800 border border-dark-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="APPROVED">Approved</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="TECO_COMPLETE">TECO Complete</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading work orders...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">
              {workOrders.length === 0
                ? 'No work orders have been raised yet.'
                : 'No work orders match this search or filter.'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-dark-900/50 border-b border-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">WO #</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Description</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Equipment</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Priority</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {filtered.map((wo) => (
                    <tr
                      key={wo.work_order_id}
                      onClick={() => router.push(`/engineering/work-orders/${wo.work_order_id}`)}
                      className="hover:bg-dark-700/30 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-white font-mono text-sm">{wo.wo_number}</td>
                      <td className="px-4 py-3 text-white">{wo.short_description}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {wo.equipment_name ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {wo.equipment_name}
                          </span>
                        ) : (
                          wo.floc_name || '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${PRIORITY_STYLES[wo.priority] || PRIORITY_STYLES.MEDIUM}`}>
                          {wo.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`flex items-center gap-1 font-semibold ${STATUS_STYLES[wo.status] || 'text-gray-400'}`}>
                          <AlertCircle className="w-4 h-4" /> {wo.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {filtered.map((wo) => (
                <div
                  key={wo.work_order_id}
                  onClick={() => router.push(`/engineering/work-orders/${wo.work_order_id}`)}
                  className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-2 active:bg-dark-700/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white font-semibold">{wo.short_description}</p>
                      <p className="text-gray-500 text-xs font-mono">{wo.wo_number}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold border shrink-0 ${PRIORITY_STYLES[wo.priority] || PRIORITY_STYLES.MEDIUM}`}>
                      {wo.priority}
                    </span>
                  </div>
                  {(wo.equipment_name || wo.floc_name) && (
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {wo.equipment_name || wo.floc_name}
                    </p>
                  )}
                  <span className={`inline-flex items-center gap-1 text-sm font-semibold ${STATUS_STYLES[wo.status] || 'text-gray-400'}`}>
                    <AlertCircle className="w-4 h-4" /> {wo.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
