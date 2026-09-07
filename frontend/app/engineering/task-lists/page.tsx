'use client';

import { useState, useEffect } from 'react';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ListChecks, Plus, X, Clock, Wrench as WrenchIcon } from 'lucide-react';

interface TaskList {
  task_list_id: string;
  title: string;
  craft: string;
  estimated_duration_minutes: number;
  requires_line_shutdown: boolean;
  requires_cip_sanitation: boolean;
  step_count: number;
}

const CAN_MANAGE = ['admin', 'engineering_manager'];

export default function TaskListsPage() {
  const { isAuthenticated, user } = useAuth();
  const canManage = user?.role && CAN_MANAGE.includes(user.role);

  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '', craft: 'MECHANICAL', estimated_duration_minutes: '60',
    requires_line_shutdown: true, requires_cip_sanitation: false,
  });
  const [steps, setSteps] = useState(['']);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (isAuthenticated) fetchTaskLists();
  }, [isAuthenticated]);

  const fetchTaskLists = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/engineering/task-lists');
      setTaskLists(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load task lists.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ title: '', craft: 'MECHANICAL', estimated_duration_minutes: '60', requires_line_shutdown: true, requires_cip_sanitation: false });
    setSteps(['']);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validSteps = steps.map((s) => s.trim()).filter(Boolean);
    if (!form.title.trim()) return setFormError('Enter a title.');
    if (validSteps.length === 0) return setFormError('Add at least one step.');

    setSaving(true);
    setFormError('');
    try {
      await api.post('/engineering/task-lists', {
        title: form.title,
        craft: form.craft,
        estimated_duration_minutes: Number(form.estimated_duration_minutes),
        requires_line_shutdown: form.requires_line_shutdown,
        requires_cip_sanitation: form.requires_cip_sanitation,
        operations: validSteps.map((instruction_text) => ({ instruction_text })),
      });
      setShowModal(false);
      resetForm();
      await fetchTaskLists();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create this task list.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ListChecks className="w-8 h-8 text-cyan-500" />
              Task Lists
            </h1>
            <p className="text-gray-400 mt-1">Reusable job plans — the standard steps for a maintenance task</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-5 h-5" /> New Task List
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading task lists...</div>
        ) : taskLists.length === 0 ? (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-12 text-center">
            <ListChecks className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">
              No task lists yet. These are the reusable job plans PM schedules will run — create one before setting up a PM plan.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {taskLists.map((tl) => (
              <div key={tl.task_list_id} className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                <h3 className="text-white font-bold mb-2">{tl.title}</h3>
                <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-3">
                  <span className="flex items-center gap-1"><WrenchIcon className="w-3.5 h-3.5" /> {tl.craft}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {tl.estimated_duration_minutes} min</span>
                </div>
                <p className="text-gray-500 text-sm">{tl.step_count} step{tl.step_count !== 1 ? 's' : ''}</p>
                <div className="flex gap-2 mt-3">
                  {tl.requires_line_shutdown && (
                    <span className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30">Line Shutdown</span>
                  )}
                  {tl.requires_cip_sanitation && (
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">CIP Required</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManage && showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white">New Task List</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Monthly CIP Valve Inspection"
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Craft</label>
                  <select
                    value={form.craft}
                    onChange={(e) => setForm({ ...form, craft: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="MECHANICAL">Mechanical</option>
                    <option value="ELECTRICAL">Electrical</option>
                    <option value="SANITATION">Sanitation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Est. Duration (min)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.estimated_duration_minutes}
                    onChange={(e) => setForm({ ...form, estimated_duration_minutes: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.requires_line_shutdown}
                  onChange={(e) => setForm({ ...form, requires_line_shutdown: e.target.checked })}
                  className="rounded border-dark-600"
                />
                Requires line shutdown
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.requires_cip_sanitation}
                  onChange={(e) => setForm({ ...form, requires_cip_sanitation: e.target.checked })}
                  className="rounded border-dark-600"
                />
                Requires CIP sanitation before/after
              </label>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Steps (in order)</label>
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <input
                      key={i}
                      type="text"
                      value={step}
                      placeholder={`Step ${i + 1}...`}
                      onChange={(e) => {
                        const updated = [...steps];
                        updated[i] = e.target.value;
                        setSteps(updated);
                      }}
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSteps([...steps, ''])}
                  className="text-cyan-400 text-sm font-semibold mt-2"
                >
                  + Add another step
                </button>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
              >
                {saving ? 'Creating...' : 'Create Task List'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
