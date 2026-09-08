'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { CalendarClock, Plus, X, Gauge, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

interface PMPlan {
  pm_plan_id: string;
  title: string;
  equipment_name: string | null;
  equipment_code: string | null;
  task_list_title: string | null;
  trigger_type: string;
  calendar_interval_days: number | null;
  next_due_date: string | null;
  counter_interval_units: number | null;
  next_due_counter: number | null;
  counter_point_name: string | null;
  counter_current_value: number | null;
  counter_unit: string | null;
  counter_point_id: string | null;
  is_active: boolean;
  open_work_order_id: string | null;
}

interface Equipment { equipment_id: string; equipment_code: string; name: string; }
interface TaskList { task_list_id: string; title: string; }
interface MeasuringPoint { point_id: string; name: string; current_value: number; unit_of_measure: string; }

const CAN_MANAGE = ['admin', 'engineering_manager'];

export default function PMSchedulePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const canManage = user?.role && CAN_MANAGE.includes(user.role);

  const [pmPlans, setPmPlans] = useState<PMPlan[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New PM Plan modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '', equipment_id: '', task_list_id: '', trigger_type: 'CALENDAR',
    calendar_interval_days: '30', counter_interval_units: '',
  });
  const [counterMode, setCounterMode] = useState<'existing' | 'new'>('existing');
  const [equipmentPoints, setEquipmentPoints] = useState<MeasuringPoint[]>([]);
  const [selectedPointId, setSelectedPointId] = useState('');
  const [newPoint, setNewPoint] = useState({ name: '', metric_type: '', unit_of_measure: '', initial_value: '0' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Log Reading modal
  const [readingPlan, setReadingPlan] = useState<PMPlan | null>(null);
  const [readingValue, setReadingValue] = useState('');
  const [loggingReading, setLoggingReading] = useState(false);
  const [readingError, setReadingError] = useState('');

  useEffect(() => {
    if (isAuthenticated) fetchAll();
  }, [isAuthenticated]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [plansRes, equipRes, tlRes] = await Promise.all([
        api.get('/engineering/pm-plans'),
        api.get('/engineering/assets/equipment'),
        api.get('/engineering/task-lists'),
      ]);
      setPmPlans(plansRes.data);
      setEquipmentList(equipRes.data);
      setTaskLists(tlRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load the PM schedule.');
    } finally {
      setLoading(false);
    }
  };

  const handleEquipmentChange = async (equipmentId: string) => {
    setForm({ ...form, equipment_id: equipmentId });
    setSelectedPointId('');
    setEquipmentPoints([]);
    if (!equipmentId) return;
    try {
      const res = await api.get(`/engineering/equipment/${equipmentId}/measuring-points`);
      setEquipmentPoints(res.data);
      setCounterMode(res.data.length > 0 ? 'existing' : 'new');
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setForm({ title: '', equipment_id: '', task_list_id: '', trigger_type: 'CALENDAR', calendar_interval_days: '30', counter_interval_units: '' });
    setEquipmentPoints([]);
    setSelectedPointId('');
    setNewPoint({ name: '', metric_type: '', unit_of_measure: '', initial_value: '0' });
    setCounterMode('existing');
    setFormError('');
  };

  const needsCalendar = form.trigger_type === 'CALENDAR' || form.trigger_type === 'BOTH_FIRST_DUE';
  const needsCounter = form.trigger_type === 'COUNTER' || form.trigger_type === 'BOTH_FIRST_DUE';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.equipment_id || !form.task_list_id) {
      return setFormError('Title, equipment, and task list are all required.');
    }
    if (needsCalendar && !form.calendar_interval_days) {
      return setFormError('Enter a calendar interval.');
    }
    if (needsCounter) {
      if (!form.counter_interval_units) return setFormError('Enter a counter interval.');
      if (counterMode === 'existing' && !selectedPointId) return setFormError('Select a measuring point.');
      if (counterMode === 'new' && (!newPoint.name || !newPoint.metric_type || !newPoint.unit_of_measure)) {
        return setFormError('Fill in the new measuring point\'s name, metric type, and unit.');
      }
    }

    setSaving(true);
    setFormError('');
    try {
      await api.post('/engineering/pm-plans', {
        title: form.title,
        equipment_id: form.equipment_id,
        task_list_id: form.task_list_id,
        trigger_type: form.trigger_type,
        calendar_interval_days: needsCalendar ? Number(form.calendar_interval_days) : null,
        counter_interval_units: needsCounter ? Number(form.counter_interval_units) : null,
        counter_point_id: needsCounter && counterMode === 'existing' ? selectedPointId : null,
        new_measuring_point: needsCounter && counterMode === 'new' ? {
          name: newPoint.name, metric_type: newPoint.metric_type,
          unit_of_measure: newPoint.unit_of_measure, initial_value: Number(newPoint.initial_value) || 0,
        } : null,
      });
      setShowModal(false);
      resetForm();
      await fetchAll();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create this PM plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingPlan?.counter_point_id) return;
    const val = Number(readingValue);
    if (isNaN(val)) return setReadingError('Enter a valid number.');
    setLoggingReading(true);
    setReadingError('');
    try {
      await api.post(`/engineering/measuring-points/${readingPlan.counter_point_id}/readings`, { reading_value: val });
      setReadingPlan(null);
      setReadingValue('');
      await fetchAll();
    } catch (err: any) {
      setReadingError(err.response?.data?.message || 'Failed to log this reading.');
    } finally {
      setLoggingReading(false);
    }
  };

  const [generating, setGenerating] = useState<string | null>(null); // holds pm_plan_id currently generating

  const handleGenerate = async (plan: PMPlan) => {
    setGenerating(plan.pm_plan_id);
    setError('');
    try {
      const res = await api.post(`/engineering/pm-plans/${plan.pm_plan_id}/generate-work-order`);
      router.push(`/engineering/work-orders/${res.data.work_order_id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate a work order from this plan.');
    } finally {
      setGenerating(null);
    }
  };

  const getDueStatus = (plan: PMPlan) => {
    const today = new Date();
    let overdue = false, dueSoon = false;
    if (plan.next_due_date) {
      const due = new Date(plan.next_due_date);
      const daysAway = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      if (daysAway < 0) overdue = true;
      else if (daysAway <= 7) dueSoon = true;
    }
    if (plan.next_due_counter != null && plan.counter_current_value != null) {
      if (plan.counter_current_value >= plan.next_due_counter) overdue = true;
      else if (plan.next_due_counter - plan.counter_current_value <= plan.next_due_counter * 0.1) dueSoon = true;
    }
    if (overdue) return { label: 'Overdue', className: 'bg-red-500/20 text-red-400 border-red-500/30' };
    if (dueSoon) return { label: 'Due Soon', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
    return { label: 'OK', className: 'bg-green-500/20 text-green-400 border-green-500/30' };
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <CalendarClock className="w-8 h-8 text-cyan-500" />
              PM Schedule
            </h1>
            <p className="text-gray-400 mt-1">Calendar and counter-based preventive maintenance plans</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-5 h-5" /> New PM Plan
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">{error}</div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading PM schedule...</div>
        ) : pmPlans.length === 0 ? (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-12 text-center">
            <CalendarClock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">
              No PM plans yet. {canManage ? 'Create one to start scheduling preventive maintenance.' : 'Ask an engineering manager to set one up.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pmPlans.map((plan) => {
              const status = getDueStatus(plan);
              return (
                <div key={plan.pm_plan_id} className="bg-dark-800 border border-dark-700 rounded-xl p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${status.className}`}>{status.label}</span>
                        <span className="text-xs text-gray-500">{plan.trigger_type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-white font-semibold">{plan.title}</p>
                      <p className="text-gray-400 text-sm">
                        {plan.equipment_name || '—'} · {plan.task_list_title || '—'}
                      </p>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                        {plan.next_due_date && (
                          <span>Next due: {new Date(plan.next_due_date).toLocaleDateString()}</span>
                        )}
                        {plan.counter_point_name && (
                          <span className="flex items-center gap-1">
                            <Gauge className="w-3.5 h-3.5" />
                            {plan.counter_point_name}: {plan.counter_current_value} / {plan.next_due_counter} {plan.counter_unit}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {plan.counter_point_id && (
                        <button
                          onClick={() => { setReadingPlan(plan); setReadingValue(String(plan.counter_current_value ?? '')); setReadingError(''); }}
                          className="min-h-[40px] px-4 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"
                        >
                          <Gauge className="w-4 h-4" /> Log Reading
                        </button>
                      )}
                      {plan.open_work_order_id ? (
                        <button
                          onClick={() => router.push(`/engineering/work-orders/${plan.open_work_order_id}`)}
                          className="min-h-[40px] px-4 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"
                        >
                          View Work Order <ArrowRight className="w-4 h-4" />
                        </button>
                      ) : canManage && (
                        <button
                          onClick={() => handleGenerate(plan)}
                          disabled={generating === plan.pm_plan_id}
                          className="min-h-[40px] px-4 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"
                        >
                          {generating === plan.pm_plan_id ? 'Generating...' : 'Generate Work Order'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New PM Plan modal */}
      {canManage && showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white">New PM Plan</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">{formError}</div>}

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Blow Molder Mold Service"
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Equipment</label>
                <select
                  value={form.equipment_id}
                  onChange={(e) => handleEquipmentChange(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Select equipment...</option>
                  {equipmentList.map((eq) => (
                    <option key={eq.equipment_id} value={eq.equipment_id}>{eq.equipment_code} — {eq.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Task List</label>
                <select
                  value={form.task_list_id}
                  onChange={(e) => setForm({ ...form, task_list_id: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Select task list...</option>
                  {taskLists.map((tl) => (
                    <option key={tl.task_list_id} value={tl.task_list_id}>{tl.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Trigger</label>
                <select
                  value={form.trigger_type}
                  onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="CALENDAR">Calendar-based (e.g. every 30 days)</option>
                  <option value="COUNTER">Counter-based (e.g. every 500,000 cycles)</option>
                  <option value="BOTH_FIRST_DUE">Both — whichever comes first</option>
                </select>
              </div>

              {needsCalendar && (
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Calendar Interval (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.calendar_interval_days}
                    onChange={(e) => setForm({ ...form, calendar_interval_days: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              )}

              {needsCounter && (
                <div className="space-y-3 border border-dark-700 rounded-lg p-4 bg-dark-900/30">
                  <p className="text-xs font-bold uppercase text-gray-400">Counter Setup</p>
                  {equipmentPoints.length > 0 && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setCounterMode('existing')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${counterMode === 'existing' ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-dark-900 border-dark-700 text-gray-400'}`}>
                        Use Existing
                      </button>
                      <button type="button" onClick={() => setCounterMode('new')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${counterMode === 'new' ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-dark-900 border-dark-700 text-gray-400'}`}>
                        Create New
                      </button>
                    </div>
                  )}
                  {counterMode === 'existing' && equipmentPoints.length > 0 ? (
                    <select
                      value={selectedPointId}
                      onChange={(e) => setSelectedPointId(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">Select measuring point...</option>
                      {equipmentPoints.map((mp) => (
                        <option key={mp.point_id} value={mp.point_id}>{mp.name} (currently {mp.current_value} {mp.unit_of_measure})</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      {equipmentPoints.length === 0 && form.equipment_id && (
                        <p className="text-gray-500 text-xs">This equipment has no measuring points yet — define one below.</p>
                      )}
                      <input
                        type="text" placeholder="Name (e.g. Run Hours)"
                        value={newPoint.name} onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                        className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <input
                        type="text" placeholder="Metric type (e.g. RUN_HOURS, CYCLE_COUNT)"
                        value={newPoint.metric_type} onChange={(e) => setNewPoint({ ...newPoint, metric_type: e.target.value.toUpperCase() })}
                        className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text" placeholder="Unit (e.g. HOURS, CYCLES)"
                          value={newPoint.unit_of_measure} onChange={(e) => setNewPoint({ ...newPoint, unit_of_measure: e.target.value.toUpperCase() })}
                          className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <input
                          type="number" placeholder="Starting value"
                          value={newPoint.initial_value} onChange={(e) => setNewPoint({ ...newPoint, initial_value: e.target.value })}
                          className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Service Every (units)</label>
                    <input
                      type="number" min="1"
                      value={form.counter_interval_units}
                      onChange={(e) => setForm({ ...form, counter_interval_units: e.target.value })}
                      placeholder="e.g. 500000"
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              )}

              <button type="submit" disabled={saving} className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors">
                {saving ? 'Creating...' : 'Create PM Plan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Log Reading modal */}
      {readingPlan && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white">Log Reading</h2>
              <button onClick={() => setReadingPlan(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleLogReading} className="p-5 space-y-4">
              {readingError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">{readingError}</div>}
              <p className="text-white font-semibold">{readingPlan.counter_point_name}</p>
              <p className="text-gray-500 text-xs">Current: {readingPlan.counter_current_value} {readingPlan.counter_unit}</p>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">New Reading</label>
                <input
                  type="number"
                  value={readingValue}
                  onChange={(e) => setReadingValue(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <button type="submit" disabled={loggingReading} className="w-full min-h-[44px] bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors">
                {loggingReading ? 'Saving...' : 'Log Reading'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
