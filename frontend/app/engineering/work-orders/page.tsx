'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClipboardList, Search, MapPin, AlertCircle, Plus, X } from 'lucide-react';

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

interface Equipment {
  equipment_id: string;
  equipment_code: string;
  name: string;
}

interface FunctionalLocation {
  floc_id: string;
  floc_code: string;
  name: string;
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

const CAN_MANAGE = ['admin', 'engineering_manager'];

export default function WorkOrdersPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const canManage = user?.role && CAN_MANAGE.includes(user.role);

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [locations, setLocations] = useState<FunctionalLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // New Work Order modal (manager only)
  const [showNewModal, setShowNewModal] = useState(false);
  const [assetMode, setAssetMode] = useState<'equipment' | 'location'>('equipment');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    order_type: 'PREVENTIVE',
    priority: 'MEDIUM',
    equipment_id: '',
    floc_id: '',
    short_description: '',
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetchWorkOrders();
      if (canManage) {
        fetchEquipment();
        fetchLocations();
      }
    }
  }, [isAuthenticated, canManage]);

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

  const fetchEquipment = async () => {
    try {
      const res = await api.get('/engineering/assets/equipment');
      setEquipment(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await api.get('/engineering/assets/locations');
      setLocations(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      order_type: 'PREVENTIVE',
      priority: 'MEDIUM',
      equipment_id: '',
      floc_id: '',
      short_description: '',
    });
    setAssetMode('equipment');
    setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (assetMode === 'equipment' && !formData.equipment_id) {
      return setFormError('Select the piece of equipment this relates to.');
    }
    if (assetMode === 'location' && !formData.floc_id) {
      return setFormError('Select the location this relates to.');
    }
    if (!formData.short_description.trim()) {
      return setFormError('Enter a description.');
    }

    setSaving(true);
    try {
      const res = await api.post('/engineering/work-orders', {
        order_type: formData.order_type,
        priority: formData.priority,
        short_description: formData.short_description,
        equipment_id: assetMode === 'equipment' ? formData.equipment_id : null,
        floc_id: assetMode === 'location' ? formData.floc_id : null,
      });
      setShowNewModal(false);
      resetForm();
      router.push(`/engineering/work-orders/${res.data.work_order_id}`);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create the work order.');
    } finally {
      setSaving(false);
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
          {canManage && (
            <button
              onClick={() => setShowNewModal(true)}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-5 h-5" /> New Work Order
            </button>
          )}
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

      {/* New Work Order modal (manager only — button is already gated, this is defense in depth) */}
      {canManage && showNewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white">New Work Order</h2>
              <button onClick={() => { setShowNewModal(false); resetForm(); }} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Order Type</label>
                <select
                  value={formData.order_type}
                  onChange={(e) => setFormData({ ...formData, order_type: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="PREVENTIVE">Preventive</option>
                  <option value="CORRECTIVE">Corrective</option>
                  <option value="EMERGENCY_BREAKDOWN">Emergency Breakdown</option>
                  <option value="CALIBRATION">Calibration</option>
                  <option value="CIP_ASSIST">CIP Assist</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Relates To</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setAssetMode('equipment')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${assetMode === 'equipment' ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-dark-900 border-dark-700 text-gray-400'}`}
                  >
                    Equipment
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetMode('location')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${assetMode === 'location' ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-dark-900 border-dark-700 text-gray-400'}`}
                  >
                    Location
                  </button>
                </div>
                {assetMode === 'equipment' ? (
                  <select
                    value={formData.equipment_id}
                    onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">Select equipment...</option>
                    {equipment.map((eq) => (
                      <option key={eq.equipment_id} value={eq.equipment_id}>
                        {eq.equipment_code} — {eq.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={formData.floc_id}
                    onChange={(e) => setFormData({ ...formData, floc_id: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">Select location...</option>
                    {locations.map((fl) => (
                      <option key={fl.floc_id} value={fl.floc_id}>
                        {fl.floc_code} — {fl.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Description</label>
                <textarea
                  value={formData.short_description}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  rows={3}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
              >
                {saving ? 'Creating...' : 'Create Work Order'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
