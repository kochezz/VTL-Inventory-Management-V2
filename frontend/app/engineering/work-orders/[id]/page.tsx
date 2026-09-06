'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  ArrowLeft, ClipboardList, MapPin, Calendar, User, ShieldCheck,
  Plus, X, CheckCircle2, XCircle, MinusCircle, Clock
} from 'lucide-react';

interface WorkOrderDetail {
  work_order_id: string;
  wo_number: string;
  order_type: string;
  status: string;
  priority: string;
  short_description: string;
  equipment_name: string | null;
  floc_name: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  caused_unplanned_downtime: boolean;
  food_safety_cleared: boolean;
  created_by_name: string | null;
  cleared_by_name: string | null;
  closed_at: string | null;
}

interface ChecklistItem {
  item_id: string;
  step_sequence: number;
  instruction: string;
  status: string;
  measured_value: number | null;
  performed_by_name: string | null;
  inspected_at: string | null;
}

interface TimeConfirmation {
  confirmation_id: string;
  technician_name: string | null;
  start_time: string;
  end_time: string;
  actual_hours: number;
  work_notes: string | null;
}

const CAN_MANAGE = ['admin', 'engineering_manager'];

const NEXT_STATUS: Record<string, { label: string; status: string }[]> = {
  DRAFT: [{ label: 'Approve', status: 'APPROVED' }],
  APPROVED: [{ label: 'Schedule', status: 'SCHEDULED' }],
  SCHEDULED: [{ label: 'Start Work', status: 'IN_PROGRESS' }],
  IN_PROGRESS: [{ label: 'Mark Complete', status: 'TECO_COMPLETE' }],
};

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const canManage = user?.role && CAN_MANAGE.includes(user.role);

  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Add checklist items (manager only)
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [newSteps, setNewSteps] = useState(['']);
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [checklistError, setChecklistError] = useState('');

  // Log time
  const [showLogTime, setShowLogTime] = useState(false);
  const [timeForm, setTimeForm] = useState({ start_time: '', end_time: '', work_notes: '' });
  const [loggingTime, setLoggingTime] = useState(false);
  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    if (isAuthenticated && params.id) fetchAll();
  }, [isAuthenticated, params.id]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [woRes, checklistRes, timeRes] = await Promise.all([
        api.get(`/engineering/work-orders/${params.id}`),
        api.get(`/engineering/work-orders/${params.id}/checklist`),
        api.get(`/engineering/work-orders/${params.id}/time`),
      ]);
      setWorkOrder(woRes.data);
      setChecklist(checklistRes.data);
      setTimeEntries(timeRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load this work order.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');

  const handleStatusChange = async (status: string) => {
    setStatusUpdating(true);
    setError('');
    try {
      await api.patch(`/engineering/work-orders/${params.id}/status`, { status });
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleChecklistStatus = async (itemId: string, status: string) => {
    try {
      await api.patch(`/engineering/checklist/${itemId}`, { status });
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update checklist item.');
    }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    const steps = newSteps.map((s) => s.trim()).filter(Boolean);
    if (steps.length === 0) return setChecklistError('Add at least one step.');
    setAddingChecklist(true);
    setChecklistError('');
    try {
      const items = steps.map((instruction, i) => ({ step_sequence: i + 1, instruction }));
      await api.post(`/engineering/work-orders/${params.id}/checklist`, { items });
      setShowAddChecklist(false);
      setNewSteps(['']);
      await fetchAll();
    } catch (err: any) {
      setChecklistError(err.response?.data?.message || 'Failed to add checklist items.');
    } finally {
      setAddingChecklist(false);
    }
  };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeForm.start_time || !timeForm.end_time) return setTimeError('Enter both a start and end time.');
    setLoggingTime(true);
    setTimeError('');
    try {
      await api.post(`/engineering/work-orders/${params.id}/time`, timeForm);
      setShowLogTime(false);
      setTimeForm({ start_time: '', end_time: '', work_notes: '' });
      await fetchAll();
    } catch (err: any) {
      setTimeError(err.response?.data?.message || 'Failed to log time. Check that the end time is after the start time.');
    } finally {
      setLoggingTime(false);
    }
  };

  if (!isAuthenticated) return null;

  const nextActions = workOrder ? NEXT_STATUS[workOrder.status] || [] : [];

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
            {/* Header */}
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

              {/* Status action buttons — large tap targets for mobile */}
              {nextActions.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-dark-700">
                  {nextActions.map((action) => (
                    <button
                      key={action.status}
                      onClick={() => handleStatusChange(action.status)}
                      disabled={statusUpdating}
                      className="min-h-[48px] px-6 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
                    >
                      {statusUpdating ? 'Updating...' : action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Key facts */}
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
            </div>

            {/* Checklist */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Checklist</h2>
                {canManage && (
                  <button
                    onClick={() => setShowAddChecklist(true)}
                    className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    <Plus className="w-4 h-4" /> Add Steps
                  </button>
                )}
              </div>

              {checklist.length === 0 ? (
                <p className="text-gray-500 text-sm">No checklist steps have been added to this work order yet.</p>
              ) : (
                <div className="space-y-3">
                  {checklist.map((item) => (
                    <div key={item.item_id} className="bg-dark-900/50 border border-dark-700 rounded-lg p-4">
                      <p className="text-white mb-3">{item.step_sequence}. {item.instruction}</p>
                      {/* Large tap targets — this is executed on a phone on the plant floor */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleChecklistStatus(item.item_id, 'PASS')}
                          className={`flex-1 min-h-[44px] rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors ${
                            item.status === 'PASS'
                              ? 'bg-green-600 text-white'
                              : 'bg-dark-700 text-gray-400 hover:bg-green-600/20 hover:text-green-400'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" /> Pass
                        </button>
                        <button
                          onClick={() => handleChecklistStatus(item.item_id, 'FAIL')}
                          className={`flex-1 min-h-[44px] rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors ${
                            item.status === 'FAIL'
                              ? 'bg-red-600 text-white'
                              : 'bg-dark-700 text-gray-400 hover:bg-red-600/20 hover:text-red-400'
                          }`}
                        >
                          <XCircle className="w-4 h-4" /> Fail
                        </button>
                        <button
                          onClick={() => handleChecklistStatus(item.item_id, 'NOT_APPLICABLE')}
                          className={`flex-1 min-h-[44px] rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors ${
                            item.status === 'NOT_APPLICABLE'
                              ? 'bg-gray-600 text-white'
                              : 'bg-dark-700 text-gray-400 hover:bg-gray-600/40'
                          }`}
                        >
                          <MinusCircle className="w-4 h-4" /> N/A
                        </button>
                      </div>
                      {item.performed_by_name && (
                        <p className="text-gray-500 text-xs mt-2">
                          {item.performed_by_name} · {formatDate(item.inspected_at)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Time confirmations */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyan-500" /> Time Logged
                </h2>
                <button
                  onClick={() => setShowLogTime(true)}
                  className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  <Plus className="w-4 h-4" /> Log Time
                </button>
              </div>

              {timeEntries.length === 0 ? (
                <p className="text-gray-500 text-sm">No time has been logged against this work order yet.</p>
              ) : (
                <div className="space-y-2">
                  {timeEntries.map((t) => (
                    <div key={t.confirmation_id} className="bg-dark-900/50 border border-dark-700 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <p className="text-white text-sm">{t.technician_name || 'Unknown technician'}</p>
                        <p className="text-gray-500 text-xs">
                          {formatDate(t.start_time)} — {formatDate(t.end_time)}
                        </p>
                        {t.work_notes && <p className="text-gray-400 text-sm mt-1">{t.work_notes}</p>}
                      </div>
                      <p className="text-cyan-400 font-bold text-sm shrink-0">{Number(t.actual_hours).toFixed(2)} hrs</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Add Checklist Steps modal (manager only) */}
      {canManage && showAddChecklist && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white">Add Checklist Steps</h2>
              <button onClick={() => { setShowAddChecklist(false); setNewSteps(['']); }} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddChecklist} className="p-5 space-y-3">
              {checklistError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">
                  {checklistError}
                </div>
              )}
              {newSteps.map((step, i) => (
                <input
                  key={i}
                  type="text"
                  value={step}
                  placeholder={`Step ${i + 1}...`}
                  onChange={(e) => {
                    const updated = [...newSteps];
                    updated[i] = e.target.value;
                    setNewSteps(updated);
                  }}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              ))}
              <button
                type="button"
                onClick={() => setNewSteps([...newSteps, ''])}
                className="text-cyan-400 text-sm font-semibold"
              >
                + Add another step
              </button>
              <button
                type="submit"
                disabled={addingChecklist}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
              >
                {addingChecklist ? 'Adding...' : 'Add Steps'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Log Time modal */}
      {showLogTime && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white">Log Time</h2>
              <button onClick={() => setShowLogTime(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleLogTime} className="p-5 space-y-4">
              {timeError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">
                  {timeError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Start Time</label>
                <input
                  type="datetime-local"
                  value={timeForm.start_time}
                  onChange={(e) => setTimeForm({ ...timeForm, start_time: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">End Time</label>
                <input
                  type="datetime-local"
                  value={timeForm.end_time}
                  onChange={(e) => setTimeForm({ ...timeForm, end_time: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Notes (optional)</label>
                <textarea
                  value={timeForm.work_notes}
                  onChange={(e) => setTimeForm({ ...timeForm, work_notes: e.target.value })}
                  rows={2}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <button
                type="submit"
                disabled={loggingTime}
                className="w-full min-h-[48px] bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
              >
                {loggingTime ? 'Saving...' : 'Log Time'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
