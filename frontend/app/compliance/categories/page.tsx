'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Gavel, Plus, X, Save, AlertCircle, Power, PowerOff, CalendarClock, Pencil } from 'lucide-react';

// junior_accountant and manager can now PROPOSE a category (backend:
// authorize(['junior_accountant','manager','admin','cfo','ceo']) on POST
// /categories) -- this page is their only frontend path to do that, so it
// must be open to them too, not just the executives who approve/edit/
// deactivate. Those still-executive-only actions are individually gated
// below by checking isExecutive rather than by blocking the whole page.
// The Approvals queue page keeps its own separate admin/cfo/ceo-only guard
// untouched -- being able to view/create a category here does not carry
// over to approving one there.
const CAN_VIEW_ROLES = ['junior_accountant', 'manager', 'admin', 'cfo', 'ceo'];

// Flexible-cadence presets -- map onto cadence_type + interval_months, the
// fields the backend actually validates (createComplianceCategory in
// compliance-service.js). CUSTOM is the only one where the user picks
// interval_months directly; every other preset is a fixed interval so
// there's nothing to get wrong.
const CADENCE_PRESETS = [
  { value: 'ONE_OFF', label: 'One-off / Expiry (e.g. a license renewal)', intervalMonths: null as number | null },
  { value: 'MONTHLY', label: 'Monthly', intervalMonths: 1 },
  { value: 'QUARTERLY', label: 'Quarterly (every 3 months)', intervalMonths: 3 },
  { value: 'SEMI_ANNUAL', label: 'Semi-annual (every 6 months)', intervalMonths: 6 },
  { value: 'ANNUAL', label: 'Annual (every 12 months)', intervalMonths: 12 },
  { value: 'BIENNIAL', label: 'Biennial (every 24 months)', intervalMonths: 24 },
  { value: 'CUSTOM', label: 'Custom -- every N months', intervalMonths: null },
];

// Mirrors defaultReminderLadderForCadence in compliance-service.js exactly
// -- kept in sync deliberately (interval 1 -> [5]; 2-5 -> [14,7,3]; >=6 or
// one-off -> [30,15,10]) so the pre-filled ladder shown here is never a
// guess at what the backend will actually default to if left unchanged.
function defaultReminderLadder(cadenceType: 'ONE_OFF' | 'RECURRING', intervalMonths: number | null): number[] {
  if (cadenceType === 'RECURRING' && intervalMonths === 1) return [5];
  if (cadenceType === 'RECURRING' && intervalMonths !== null && intervalMonths >= 2 && intervalMonths <= 5) return [14, 7, 3];
  return [30, 15, 10];
}

// Mirrors nextDueDateClamped in compliance-service.js exactly -- "next due
// = previous due + interval, day clamped to month end." Used only for the
// live preview; the backend independently computes the real due dates the
// same way, so this never needs to be authoritative, only accurate enough
// to preview correctly.
function nextDueDateClamped(base: Date, intervalMonths: number, dueDayOfMonth: number): Date {
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + intervalMonths;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(dueDayOfMonth, lastDayOfTargetMonth);
  return new Date(Date.UTC(year, month, day));
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

interface ComplianceCategory {
  category_id: string;
  name: string;
  regulator: string | null;
  recurrence_type: string | null;
  cadence_type: 'ONE_OFF' | 'RECURRING' | null;
  interval_months: number | null;
  due_day_of_month: number | null;
  anchor_date: string | null;
  reminder_ladder_days: number[];
  is_active: boolean;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED';
  rejection_reason: string | null;
}

// status (has this been vetted at all) vs is_active (still in use) are
// shown as two separate badges deliberately -- conflating them into one
// indicator would hide exactly the distinction the backend keeps separate.
const STATUS_STYLES: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/20',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const EXECUTIVE_ROLES = ['admin', 'cfo', 'ceo'];

const CREATE_FORM_DEFAULTS = {
  name: '',
  regulator: '',
  cadencePreset: 'ONE_OFF',
  customIntervalMonths: '3',
  anchorDate: '',
  dueDayOfMonth: '',
  reminderLadderDays: defaultReminderLadder('ONE_OFF', null).join(','),
};

export default function ComplianceCategoriesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isExecutive = !!user && EXECUTIVE_ROLES.includes(user.role);

  const [categories, setCategories] = useState<ComplianceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newCategory, setNewCategory] = useState(CREATE_FORM_DEFAULTS);

  const [editingCategory, setEditingCategory] = useState<ComplianceCategory | null>(null);
  const [editAnchorDate, setEditAnchorDate] = useState('');
  const [editDueDayOfMonth, setEditDueDayOfMonth] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (user && !CAN_VIEW_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (user && CAN_VIEW_ROLES.includes(user.role)) {
      fetchCategories();
    }
  }, [user]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get('/compliance/categories?active_only=false');
      setCategories(res.data);
    } catch (err) {
      setError('Failed to load compliance categories.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedPreset = CADENCE_PRESETS.find((p) => p.value === newCategory.cadencePreset)!;
  const isCustomPreset = newCategory.cadencePreset === 'CUSTOM';
  const isRecurringPreset = newCategory.cadencePreset !== 'ONE_OFF';
  const effectiveIntervalMonths = isCustomPreset
    ? (parseInt(newCategory.customIntervalMonths, 10) || null)
    : selectedPreset.intervalMonths;

  // Live preview of the next 3 due dates -- purely a UI convenience so
  // whoever is creating the category can sanity-check "every 3 months from
  // this date" actually lands where they expect, before submitting.
  const previewDates = useMemo(() => {
    if (!isRecurringPreset || !newCategory.anchorDate || !effectiveIntervalMonths) return [];
    const anchor = new Date(newCategory.anchorDate + 'T00:00:00Z');
    if (isNaN(anchor.getTime())) return [];
    const dueDay = newCategory.dueDayOfMonth ? parseInt(newCategory.dueDayOfMonth, 10) : anchor.getUTCDate();
    if (!dueDay || dueDay < 1 || dueDay > 31) return [];
    const dates = [anchor];
    let cur = anchor;
    for (let i = 0; i < 2; i++) {
      cur = nextDueDateClamped(cur, effectiveIntervalMonths, dueDay);
      dates.push(cur);
    }
    return dates;
  }, [isRecurringPreset, newCategory.anchorDate, newCategory.dueDayOfMonth, effectiveIntervalMonths]);

  // Reminder ladder re-derives its default every time the cadence changes,
  // per "pre-filled from interval default, editable" -- it stays editable
  // after that (a manual edit isn't preserved across a further cadence
  // change, matching "pre-filled," not "remembered").
  const handleCadenceChange = (presetValue: string) => {
    const preset = CADENCE_PRESETS.find((p) => p.value === presetValue)!;
    const cadenceType = presetValue === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING';
    const intervalMonths = presetValue === 'CUSTOM'
      ? (parseInt(newCategory.customIntervalMonths, 10) || null)
      : preset.intervalMonths;
    setNewCategory({
      ...newCategory,
      cadencePreset: presetValue,
      reminderLadderDays: defaultReminderLadder(cadenceType, intervalMonths).join(','),
    });
  };

  const handleCustomIntervalChange = (value: string) => {
    const intervalMonths = parseInt(value, 10) || null;
    setNewCategory({
      ...newCategory,
      customIntervalMonths: value,
      reminderLadderDays: defaultReminderLadder('RECURRING', intervalMonths).join(','),
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateLoading(true);
      setCreateError('');

      const ladder = newCategory.reminderLadderDays
        .split(',')
        .map((d) => parseInt(d.trim(), 10))
        .filter((d) => !isNaN(d));

      if (ladder.length === 0) {
        setCreateError('Reminder ladder must have at least one valid number of days.');
        setCreateLoading(false);
        return;
      }

      if (isRecurringPreset && !effectiveIntervalMonths) {
        setCreateError('Enter a valid number of months (1-60) for a custom cadence.');
        setCreateLoading(false);
        return;
      }

      if (isRecurringPreset && !newCategory.anchorDate) {
        setCreateError('First due date is required for a recurring category.');
        setCreateLoading(false);
        return;
      }

      await api.post('/compliance/categories', {
        name: newCategory.name,
        regulator: newCategory.regulator || undefined,
        cadence_type: isRecurringPreset ? 'RECURRING' : 'ONE_OFF',
        interval_months: isRecurringPreset ? effectiveIntervalMonths : undefined,
        anchor_date: isRecurringPreset ? newCategory.anchorDate : undefined,
        due_day_of_month: isRecurringPreset && newCategory.dueDayOfMonth ? parseInt(newCategory.dueDayOfMonth, 10) : undefined,
        reminder_ladder_days: ladder,
      });

      setShowCreateModal(false);
      setNewCategory(CREATE_FORM_DEFAULTS);
      fetchCategories();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to create category.');
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditModal = (category: ComplianceCategory) => {
    setEditingCategory(category);
    setEditAnchorDate(category.anchor_date ? category.anchor_date.slice(0, 10) : '');
    setEditDueDayOfMonth(category.due_day_of_month ? String(category.due_day_of_month) : '');
    setEditError('');
  };

  const handleEditCadence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      setEditLoading(true);
      setEditError('');

      if (!editAnchorDate) {
        setEditError('First due date is required.');
        setEditLoading(false);
        return;
      }

      await api.patch(`/compliance/categories/${editingCategory.category_id}`, {
        anchor_date: editAnchorDate,
        due_day_of_month: editDueDayOfMonth ? parseInt(editDueDayOfMonth, 10) : undefined,
      });

      setEditingCategory(null);
      fetchCategories();
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Failed to update cadence.');
    } finally {
      setEditLoading(false);
    }
  };

  const toggleActive = async (category: ComplianceCategory) => {
    try {
      await api.patch(`/compliance/categories/${category.category_id}`, { is_active: !category.is_active });
      fetchCategories();
    } catch (err) {
      console.error('Failed to toggle category status', err);
    }
  };

  const cadenceLabel = (cat: ComplianceCategory): string => {
    if (cat.cadence_type === 'ONE_OFF') return 'One-off / Expiry';
    if (cat.cadence_type === 'RECURRING') {
      const n = cat.interval_months;
      const unit = n === 1 ? 'Every month' : `Every ${n} months`;
      return cat.due_day_of_month ? `${unit} (day ${cat.due_day_of_month})` : unit;
    }
    // Pre-migration categories that haven't been touched since -- fall back
    // to the deprecated field rather than show a blank cadence.
    return (cat.recurrence_type || '—').replace(/_/g, ' ');
  };

  const needsCadenceSetup = (cat: ComplianceCategory) => cat.cadence_type === 'RECURRING' && !cat.anchor_date;

  if (user && !CAN_VIEW_ROLES.includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6 pb-12">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Gavel className="w-8 h-8 text-primary-500" />
              Compliance Categories
            </h1>
            <p className="text-gray-400 mt-1">Define the regulatory obligations items get registered against (e.g. PACRA Annual Return, ZRA Tax Clearance).</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors font-bold shadow-lg shadow-primary-500/20"
          >
            <Plus className="w-5 h-5" />
            New Category
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-dark-900/80 border-b border-dark-700">
                <tr>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Regulator</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Cadence</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Reminder Ladder</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Approval</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">In Use</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr><td colSpan={7} className="py-16 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500 mb-4"></div>
                    <p className="text-gray-400">Loading categories...</p>
                  </td></tr>
                ) : categories.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center">
                    <Gavel className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-lg font-medium text-white mb-1">No compliance categories yet</p>
                    <p className="text-gray-500 text-sm">Create one to let junior_accountant register items against it.</p>
                  </td></tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.category_id} className="hover:bg-dark-700/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-white">{cat.name}</td>
                      <td className="py-4 px-6 text-gray-300">{cat.regulator || '—'}</td>
                      <td className="py-4 px-6 text-gray-300">
                        {cadenceLabel(cat)}
                        {needsCadenceSetup(cat) && (
                          <div className="flex items-center gap-1.5 mt-1 text-amber-400 text-xs">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            First due date not set -- items can't be registered yet
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-gray-300 font-mono text-sm">{cat.reminder_ladder_days.join(', ')} days</td>
                      <td className="py-4 px-6 text-center">
                        <span className={`px-3 py-1.5 rounded-lg border font-bold text-xs uppercase tracking-wider ${STATUS_STYLES[cat.status]}`}>
                          {cat.status.replace('_', ' ')}
                        </span>
                        {cat.status === 'REJECTED' && cat.rejection_reason && (
                          <p className="text-xs text-gray-500 mt-1 max-w-[160px] mx-auto">{cat.rejection_reason}</p>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {cat.status === 'ACTIVE' ? (
                          <span className={`px-3 py-1.5 rounded-lg border font-bold text-xs uppercase tracking-wider ${
                            cat.is_active
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                          }`}>
                            {cat.is_active ? 'In Use' : 'Deactivated'}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {/* Edit-cadence/deactivate both hit PATCH /categories/:id, which
                            the backend restricts to admin/cfo/ceo -- hidden here rather
                            than shown-then-403'd for a junior_accountant viewer. */}
                        <div className="flex items-center justify-end gap-2">
                          {isExecutive && cat.cadence_type === 'RECURRING' && (
                            <button
                              onClick={() => openEditModal(cat)}
                              className={`p-2 rounded-lg transition-all inline-flex items-center gap-1.5 text-xs font-bold ${
                                needsCadenceSetup(cat)
                                  ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
                                  : 'text-gray-400 hover:text-white bg-dark-900 hover:bg-primary-600'
                              }`}
                              title="Edit first due date / due day"
                            >
                              <Pencil className="w-4 h-4" />
                              {needsCadenceSetup(cat) ? 'Set First Due Date' : 'Edit Cadence'}
                            </button>
                          )}
                          {cat.status === 'ACTIVE' && isExecutive ? (
                            <button
                              onClick={() => toggleActive(cat)}
                              className="p-2 text-gray-400 hover:text-white bg-dark-900 hover:bg-primary-600 rounded-lg transition-all inline-flex items-center gap-1.5 text-xs font-bold"
                              title={cat.is_active ? 'Deactivate' : 'Reactivate'}
                            >
                              {cat.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                              {cat.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          ) : cat.status === 'PENDING_APPROVAL' ? (
                            <span className="text-xs text-amber-400">{isExecutive ? 'Review in Approval Queue' : 'Awaiting executive approval'}</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Gavel className="w-5 h-5 text-primary-500" />
                New Compliance Category
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              {createError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{createError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Name</label>
                <input
                  type="text" required
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="e.g. PACRA Annual Return"
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Regulator (optional)</label>
                <input
                  type="text"
                  value={newCategory.regulator}
                  onChange={(e) => setNewCategory({ ...newCategory, regulator: e.target.value })}
                  placeholder="e.g. PACRA, ZRA, NAPSA"
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Cadence</label>
                <select
                  required
                  value={newCategory.cadencePreset}
                  onChange={(e) => handleCadenceChange(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                >
                  {CADENCE_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {isCustomPreset && (
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Every how many months?</label>
                  <input
                    type="number" required min={1} max={60}
                    value={newCategory.customIntervalMonths}
                    onChange={(e) => handleCustomIntervalChange(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                  />
                </div>
              )}

              {isRecurringPreset && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">First due date</label>
                    <input
                      type="date" required
                      value={newCategory.anchorDate}
                      onChange={(e) => setNewCategory({ ...newCategory, anchorDate: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">Every future occurrence is calculated from this date. Required for a recurring category.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Due day of month (optional override)</label>
                    <input
                      type="number" min={1} max={31}
                      value={newCategory.dueDayOfMonth}
                      onChange={(e) => setNewCategory({ ...newCategory, dueDayOfMonth: e.target.value })}
                      placeholder={newCategory.anchorDate ? String(new Date(newCategory.anchorDate + 'T00:00:00Z').getUTCDate()) : 'defaults to first due date’s day'}
                      className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">Leave blank to use the first due date's own day of month.</p>
                  </div>

                  {previewDates.length > 0 && (
                    <div className="p-4 bg-dark-900/60 border border-dark-700 rounded-xl">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5" />
                        Next 3 due dates
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {previewDates.map((d, i) => (
                          <span key={i} className="px-3 py-1 bg-dark-950 border border-dark-600 rounded-lg text-sm text-white font-mono">
                            {formatDate(d)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Reminder Ladder (days before due, comma-separated)</label>
                <input
                  type="text" required
                  value={newCategory.reminderLadderDays}
                  onChange={(e) => setNewCategory({ ...newCategory, reminderLadderDays: e.target.value })}
                  placeholder="30,15,10,5"
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white font-mono focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1.5">Pre-filled from the cadence you picked -- edit freely.</p>
              </div>

              <div className="pt-4 border-t border-dark-700 flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-2.5 text-gray-400 hover:text-white font-medium bg-dark-900 rounded-lg">Cancel</button>
                <button type="submit" disabled={createLoading} className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50">
                  {createLoading ? 'Creating...' : <><Save className="w-5 h-5" /> Create Category</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-primary-500" />
                Edit Cadence -- {editingCategory.name}
              </h2>
              <button onClick={() => setEditingCategory(null)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleEditCadence} className="p-6 space-y-5">
              {editError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{editError}</p>
                </div>
              )}

              <p className="text-sm text-gray-400">
                Interval ({editingCategory.interval_months === 1 ? 'every month' : `every ${editingCategory.interval_months} months`}) is locked after creation -- deactivate and recreate this category to change it. Only the first due date and due day can be edited here.
              </p>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">First due date</label>
                <input
                  type="date" required
                  value={editAnchorDate}
                  onChange={(e) => setEditAnchorDate(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Due day of month (optional override)</label>
                <input
                  type="number" min={1} max={31}
                  value={editDueDayOfMonth}
                  onChange={(e) => setEditDueDayOfMonth(e.target.value)}
                  placeholder={editAnchorDate ? String(new Date(editAnchorDate + 'T00:00:00Z').getUTCDate()) : 'defaults to first due date’s day'}
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                />
              </div>

              <div className="pt-4 border-t border-dark-700 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingCategory(null)} className="px-6 py-2.5 text-gray-400 hover:text-white font-medium bg-dark-900 rounded-lg">Cancel</button>
                <button type="submit" disabled={editLoading} className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50">
                  {editLoading ? 'Saving...' : <><Save className="w-5 h-5" /> Save</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
