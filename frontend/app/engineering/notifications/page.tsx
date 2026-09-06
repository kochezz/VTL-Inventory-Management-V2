'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Bell, Plus, X, AlertOctagon, Wrench as WrenchIcon, MapPin, ArrowRight
} from 'lucide-react';

interface Notification {
  notification_id: string;
  notification_number: string;
  notification_type: string;
  short_description: string;
  status: string;
  floc_id: string | null;
  equipment_id: string | null;
  caused_unplanned_downtime: boolean;
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

const CAN_MANAGE = ['admin', 'engineering_manager'];

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const canManage = user?.role && CAN_MANAGE.includes(user.role);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [locations, setLocations] = useState<FunctionalLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Report an Issue modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [assetMode, setAssetMode] = useState<'equipment' | 'location'>('equipment');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    notification_type: 'MAINTENANCE_REQUEST',
    equipment_id: '',
    floc_id: '',
    short_description: '',
    caused_unplanned_downtime: false,
  });

  // Convert to Work Order modal
  const [convertingNotification, setConvertingNotification] = useState<Notification | null>(null);
  const [convertSaving, setConvertSaving] = useState(false);
  const [convertError, setConvertError] = useState('');
  const [convertData, setConvertData] = useState({
    order_type: 'CORRECTIVE',
    priority: 'MEDIUM',
    short_description: '',
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      fetchEquipment();
      fetchLocations();
    }
  }, [isAuthenticated]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/engineering/notifications');
      setNotifications(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load notifications.');
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

  const resetReportForm = () => {
    setFormData({
      notification_type: 'MAINTENANCE_REQUEST',
      equipment_id: '',
      floc_id: '',
      short_description: '',
      caused_unplanned_downtime: false,
    });
    setAssetMode('equipment');
    setFormError('');
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (assetMode === 'equipment' && !formData.equipment_id) {
      return setFormError('Select the piece of equipment this relates to.');
    }
    if (assetMode === 'location' && !formData.floc_id) {
      return setFormError('Select the location this relates to.');
    }
    if (!formData.short_description.trim()) {
      return setFormError('Describe the issue.');
    }

    setSaving(true);
    try {
      await api.post('/engineering/notifications', {
        notification_type: formData.notification_type,
        equipment_id: assetMode === 'equipment' ? formData.equipment_id : null,
        floc_id: assetMode === 'location' ? formData.floc_id : null,
        short_description: formData.short_description,
        caused_unplanned_downtime: formData.caused_unplanned_downtime,
      });
      await fetchNotifications();
      setShowReportModal(false);
      resetReportForm();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to submit the report.');
    } finally {
      setSaving(false);
    }
  };

  const openConvertModal = (notification: Notification) => {
    setConvertingNotification(notification);
    setConvertData({
      order_type: notification.notification_type === 'BREAKDOWN' ? 'EMERGENCY_BREAKDOWN' : 'CORRECTIVE',
      priority: notification.notification_type === 'BREAKDOWN' ? 'HIGH' : 'MEDIUM',
      short_description: notification.short_description,
    });
    setConvertError('');
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingNotification) return;
    setConvertError('');
    setConvertSaving(true);
    try {
      const res = await api.post('/engineering/work-orders', {
        order_type: convertData.order_type,
        priority: convertData.priority,
        short_description: convertData.short_description,
        equipment_id: convertingNotification.equipment_id,
        floc_id: convertingNotification.floc_id,
        notification_id: convertingNotification.notification_id,
      });
      setConvertingNotification(null);
      await fetchNotifications();
      router.push(`/engineering/work-orders/${res.data.work_order_id}`);
    } catch (err: any) {
      setConvertError(err.response?.data?.message || 'Failed to create the work order.');
    } finally {
      setConvertSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OPEN: 'bg-red-500/20 text-red-400 border-red-500/30',
      CONVERTED_TO_WO: 'bg-green-500/20 text-green-400 border-green-500/30',
      CLOSED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      REJECTED: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-bold border ${styles[status] || styles.OPEN}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getAssetLabel = (n: Notification) => {
    if (n.equipment_id) {
      const eq = equipment.find((e) => e.equipment_id === n.equipment_id);
      return eq ? eq.name : 'Equipment';
    }
    if (n.floc_id) {
      const fl = locations.find((f) => f.floc_id === n.floc_id);
      return fl ? fl.name : 'Location';
    }
    return '—';
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Bell className="w-8 h-8 text-cyan-500" />
              Notifications
            </h1>
            <p className="text-gray-400 mt-1">Report a defect or breakdown before work is authorized</p>
          </div>
          <button
            onClick={() => setShowReportModal(true)}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-5 h-5" /> Report an Issue
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-12 text-center">
            <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No issues have been reported yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.notification_id} className="bg-dark-800 border border-dark-700 rounded-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-gray-500">{n.notification_number}</span>
                      {n.notification_type === 'BREAKDOWN' ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-red-400">
                          <AlertOctagon className="w-3.5 h-3.5" /> Breakdown
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold text-blue-400">
                          <WrenchIcon className="w-3.5 h-3.5" /> Maintenance Request
                        </span>
                      )}
                      {getStatusBadge(n.status)}
                    </div>
                    <p className="text-white mt-2">{n.short_description}</p>
                    <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {getAssetLabel(n)}
                    </p>
                  </div>
                  {canManage && n.status === 'OPEN' && (
                    <button
                      onClick={() => openConvertModal(n)}
                      className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shrink-0"
                    >
                      Convert to Work Order <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report an Issue modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white">Report an Issue</h2>
              <button onClick={() => { setShowReportModal(false); resetReportForm(); }} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitReport} className="p-5 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Issue Type</label>
                <select
                  value={formData.notification_type}
                  onChange={(e) => setFormData({ ...formData, notification_type: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="MAINTENANCE_REQUEST">Maintenance Request (non-urgent)</option>
                  <option value="BREAKDOWN">Breakdown (line down now)</option>
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
                  placeholder="What's wrong, and what have you observed?"
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.caused_unplanned_downtime}
                  onChange={(e) => setFormData({ ...formData, caused_unplanned_downtime: e.target.checked })}
                  className="rounded border-dark-600"
                />
                This has stopped the line (unplanned downtime)
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
              >
                {saving ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Convert to Work Order modal (manager only) */}
      {convertingNotification && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white">Convert to Work Order</h2>
              <button onClick={() => setConvertingNotification(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConvert} className="p-5 space-y-4">
              {convertError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">
                  {convertError}
                </div>
              )}
              <p className="text-gray-500 text-sm font-mono">{convertingNotification.notification_number}</p>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Order Type</label>
                <select
                  value={convertData.order_type}
                  onChange={(e) => setConvertData({ ...convertData, order_type: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="CORRECTIVE">Corrective</option>
                  <option value="EMERGENCY_BREAKDOWN">Emergency Breakdown</option>
                  <option value="PREVENTIVE">Preventive</option>
                  <option value="CALIBRATION">Calibration</option>
                  <option value="CIP_ASSIST">CIP Assist</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Priority</label>
                <select
                  value={convertData.priority}
                  onChange={(e) => setConvertData({ ...convertData, priority: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Description</label>
                <textarea
                  value={convertData.short_description}
                  onChange={(e) => setConvertData({ ...convertData, short_description: e.target.value })}
                  rows={3}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={convertSaving}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
              >
                {convertSaving ? 'Creating...' : 'Create Work Order'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
