'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Gavel, Plus, X, Save, AlertCircle, Power, PowerOff, CalendarClock, Pencil, Undo2, Send } from 'lucide-react';
import { formatCadence } from '@/utils/complianceUtils';
import { RowErrorBoundary } from '@/components/compliance/RowErrorBoundary';

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
  cadence_type: 'ONE_OFF' | 'RECURRING' | null;
  interval_months: number | null;
  due_day_of_month: number | null;
  anchor_date: string | null;
  reminder_ladder_days: number[];
  is_active: boolean;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'RETURNED' | 'ARCHIVED';
  rejection_reason: string | null;
  previous_status: string | null;
  archived_reason: string | null;
  created_by: string;
}

// status (has this been vetted at all) vs is_active (still in use) are
// shown as two separate badges deliberately -- conflating them into one
// indicator would hide exactly the distinction the backend keeps separate.
const STATUS_STYLES: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/20',
  RETURNED: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
  ARCHIVED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const EXECUTIVE_ROLES = ['admin', 'cfo', 'ceo'];

// formatCadence is the one shared source of truth for turning
// cadence_type/interval_months into a display string (used here and on
// the Approvals page) -- this just appends the due-day suffix this page
// additionally wants. Every category has had cadence_type backfilled
// since the flexible-cadence migration, so there's no longer a
// recurrence_type fallback case left to handle.
function cadenceLabel(cat: ComplianceCategory): string {
  const base = formatCadence(cat.cadence_type, cat.interval_months);
  return cat.cadence_type === 'RECURRING' && cat.due_day_of_month ? `${base} (day ${cat.due_day_of_month})` : base;
}

// Only PENDING_APPROVAL/RETURNED categories are still awaiting the cadence
// being finished off -- REJECTED/ARCHIVED are dead ends (nothing will ever
// be registered against them again), so the "needs configuration" prompt
// must never fire for those, even though they can still technically have
// cadence_type === 'RECURRING' && !anchor_date.
function needsCadenceSetup(cat: ComplianceCategory) {
  return cat.cadence_type === 'RECURRING' && !cat.anchor_date
    && (cat.status === 'PENDING_APPROVAL' || cat.status === 'RETURNED');
}

// A real, standalone component -- not an inline arrow function invoked
// directly inside categories.map() -- because RowErrorBoundary can only
// catch an error React itself throws while rendering a distinct child
// component. An error thrown while the PARENT is still constructing its
// own JSX (e.g. evaluating cat.reminder_ladder_days.join(...) directly
// inside a <td>) is attributed to the parent, since the boundary hasn't
// been invoked yet at that point -- confirmed by a regression test on the
// Approvals page that initially made this exact mistake.
function CategoryTableRow({
  cat, isExecutive, currentUserId, isAdmin, onResubmit, onEditCadence, onToggleActive, onWithdraw, onArchive, onRestore, onOpenDetail,
}: {
  cat: ComplianceCategory;
  isExecutive: boolean;
  currentUserId: string | undefined;
  isAdmin: boolean;
  onResubmit: () => void;
  onEditCadence: () => void;
  onToggleActive: () => void;
  onWithdraw: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onOpenDetail: () => void;
}) {
  const isAuthor = cat.created_by === currentUserId;
  const archived = cat.status === 'ARCHIVED';
  return (
    <tr className={`hover:bg-dark-700/50 transition-colors ${archived ? 'opacity-60' : ''}`}>
      <td className="py-4 px-6 font-bold text-white">
        {cat.status === 'ACTIVE' ? (
          <button onClick={onOpenDetail} className="hover:text-primary-400 hover:underline text-left" title="View evidence history">
            {cat.name}
          </button>
        ) : cat.name}
      </td>
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
        {(cat.status === 'REJECTED' || cat.status === 'RETURNED') && cat.rejection_reason && (
          <p className={`text-xs mt-1 max-w-[160px] mx-auto ${cat.status === 'RETURNED' ? 'text-orange-300' : 'text-gray-500'}`}>{cat.rejection_reason}</p>
        )}
        {archived && cat.archived_reason && (
          <p className="text-xs mt-1 max-w-[160px] mx-auto text-gray-500">{cat.archived_reason}</p>
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
            than shown-then-403'd for a junior_accountant viewer. Archived
            rows are read-only: the only action left is Restore, admin-only,
            server-enforced the same way every other action here is. */}
        <div className="flex items-center justify-end gap-2">
          {archived ? (
            isAdmin ? (
              <button
                onClick={onRestore}
                className="p-2 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-all inline-flex items-center gap-1.5 text-xs font-bold"
                title="Restore this category to its previous status"
              >
                <Undo2 className="w-4 h-4" />
                Restore
              </button>
            ) : (
              <span className="text-xs text-gray-600">Archived (read-only)</span>
            )
          ) : (
            <>
              {cat.status === 'RETURNED' && isAuthor && (
                <button
                  onClick={onResubmit}
                  className="p-2 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg transition-all inline-flex items-center gap-1.5 text-xs font-bold"
                  title="Fix and resubmit this category"
                >
                  <Undo2 className="w-4 h-4" />
                  Fix &amp; Resubmit
                </button>
              )}
              {cat.status === 'RETURNED' && (isAuthor || isAdmin) && (
                <button
                  onClick={onWithdraw}
                  className="p-2 text-gray-400 hover:text-white bg-dark-900 hover:bg-red-600 rounded-lg transition-all inline-flex items-center gap-1.5 text-xs font-bold"
                  title="Withdraw this category (archive it instead of fixing and resubmitting)"
                >
                  Withdraw
                </button>
              )}
              {cat.status === 'REJECTED' && (isAuthor || isAdmin) && (
                <button
                  onClick={onArchive}
                  className="p-2 text-gray-400 hover:text-white bg-dark-900 hover:bg-red-600 rounded-lg transition-all inline-flex items-center gap-1.5 text-xs font-bold"
                  title="Archive this rejected category"
                >
                  Archive
                </button>
              )}
              {isExecutive && cat.cadence_type === 'RECURRING' && (cat.status === 'PENDING_APPROVAL' || cat.status === 'RETURNED' || cat.status === 'ACTIVE') && (
                <button
                  onClick={onEditCadence}
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
                  onClick={onToggleActive}
                  className="p-2 text-gray-400 hover:text-white bg-dark-900 hover:bg-primary-600 rounded-lg transition-all inline-flex items-center gap-1.5 text-xs font-bold"
                  title={cat.is_active ? 'Deactivate' : 'Reactivate'}
                >
                  {cat.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  {cat.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              ) : cat.status === 'PENDING_APPROVAL' ? (
                <span className="text-xs text-amber-400">{isExecutive ? 'Review in Approval Queue' : 'Awaiting executive approval'}</span>
              ) : null}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// The cadence sub-form's own state shape, used by BOTH the create-category
// modal and the RETURNED-category fix-and-resubmit modal (Bug 2) -- one
// component (CadenceFieldsForm below), not two hand-kept-in-sync copies of
// the preset/preview/reminder-ladder logic.
interface CadenceFormState {
  cadencePreset: string;
  customIntervalMonths: string;
  anchorDate: string;
  dueDayOfMonth: string;
  reminderLadderDays: string;
}

const CADENCE_FORM_DEFAULTS: CadenceFormState = {
  cadencePreset: 'ONE_OFF',
  customIntervalMonths: '3',
  anchorDate: '',
  dueDayOfMonth: '',
  reminderLadderDays: defaultReminderLadder('ONE_OFF', null).join(','),
};

const CREATE_FORM_DEFAULTS = {
  name: '',
  regulator: '',
  ...CADENCE_FORM_DEFAULTS,
};

function isRecurringPreset(form: CadenceFormState) {
  return form.cadencePreset !== 'ONE_OFF';
}

function effectiveIntervalMonths(form: CadenceFormState): number | null {
  const preset = CADENCE_PRESETS.find((p) => p.value === form.cadencePreset)!;
  return form.cadencePreset === 'CUSTOM' ? (parseInt(form.customIntervalMonths, 10) || null) : preset.intervalMonths;
}

// Reverse of the preset -> interval_months mapping -- used to pre-fill the
// resubmit modal's cadence preset from a category's existing cadence_type/
// interval_months (e.g. a category created with a 3-month CUSTOM interval
// opens back up as QUARTERLY, since that preset also maps to 3).
function presetForCadence(cadenceType: 'ONE_OFF' | 'RECURRING' | null, intervalMonths: number | null): string {
  if (cadenceType !== 'RECURRING') return 'ONE_OFF';
  const match = CADENCE_PRESETS.find((p) => p.value !== 'ONE_OFF' && p.value !== 'CUSTOM' && p.intervalMonths === intervalMonths);
  return match ? match.value : 'CUSTOM';
}

// Maps the form's UI-friendly shape onto the exact fields
// createComplianceCategory/updateComplianceCategory validate -- the one
// place that translation happens, used by both the create and resubmit
// submit handlers so they can never drift on it.
function cadenceFormToApiFields(form: CadenceFormState) {
  const recurring = isRecurringPreset(form);
  const interval = effectiveIntervalMonths(form);
  return {
    cadence_type: recurring ? ('RECURRING' as const) : ('ONE_OFF' as const),
    interval_months: recurring ? (interval ?? undefined) : undefined,
    anchor_date: recurring ? (form.anchorDate || undefined) : undefined,
    due_day_of_month: recurring && form.dueDayOfMonth ? parseInt(form.dueDayOfMonth, 10) : undefined,
  };
}

// A real, standalone component (see the RowErrorBoundary comment above for
// why that matters elsewhere on this page) covering presets, the custom-
// interval input, first due date + due-day override, the 3-date preview,
// and the reminder ladder -- everything Phase B's create-category form
// had, now shared with Bug 2's resubmit-with-fixed-cadence form. `onPatch`
// (not a direct value setter) is what lets one component work against two
// different parent state shapes (newCategory has name/regulator alongside
// these fields; resubmitForm does too) without either needing to know the
// other's full shape.
function CadenceFieldsForm({
  value, onPatch,
}: {
  value: CadenceFormState;
  onPatch: (patch: Partial<CadenceFormState>) => void;
}) {
  const isCustomPreset = value.cadencePreset === 'CUSTOM';
  const isRecurring = isRecurringPreset(value);
  const interval = effectiveIntervalMonths(value);

  // Live preview of the next 3 due dates -- purely a UI convenience so
  // whoever is creating/fixing the category can sanity-check "every 3
  // months from this date" actually lands where they expect.
  const previewDates = useMemo(() => {
    if (!isRecurring || !value.anchorDate || !interval) return [];
    const anchor = new Date(value.anchorDate + 'T00:00:00Z');
    if (isNaN(anchor.getTime())) return [];
    const dueDay = value.dueDayOfMonth ? parseInt(value.dueDayOfMonth, 10) : anchor.getUTCDate();
    if (!dueDay || dueDay < 1 || dueDay > 31) return [];
    const dates = [anchor];
    let cur = anchor;
    for (let i = 0; i < 2; i++) {
      cur = nextDueDateClamped(cur, interval, dueDay);
      dates.push(cur);
    }
    return dates;
  }, [isRecurring, value.anchorDate, value.dueDayOfMonth, interval]);

  // Reminder ladder re-derives its default every time the cadence changes,
  // per "pre-filled from interval default, editable" -- it stays editable
  // after that (a manual edit isn't preserved across a further cadence
  // change, matching "pre-filled," not "remembered").
  const handleCadenceChange = (presetValue: string) => {
    const preset = CADENCE_PRESETS.find((p) => p.value === presetValue)!;
    const cadenceType = presetValue === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING';
    const intervalMonths = presetValue === 'CUSTOM'
      ? (parseInt(value.customIntervalMonths, 10) || null)
      : preset.intervalMonths;
    onPatch({
      cadencePreset: presetValue,
      reminderLadderDays: defaultReminderLadder(cadenceType, intervalMonths).join(','),
    });
  };

  const handleCustomIntervalChange = (v: string) => {
    const intervalMonths = parseInt(v, 10) || null;
    onPatch({
      customIntervalMonths: v,
      reminderLadderDays: defaultReminderLadder('RECURRING', intervalMonths).join(','),
    });
  };

  return (
    <>
      <div>
        <label className="block text-sm font-bold text-gray-300 mb-2">Cadence</label>
        <select
          required
          value={value.cadencePreset}
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
            value={value.customIntervalMonths}
            onChange={(e) => handleCustomIntervalChange(e.target.value)}
            className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
          />
        </div>
      )}

      {isRecurring && (
        <>
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">First due date</label>
            <input
              type="date" required
              value={value.anchorDate}
              onChange={(e) => onPatch({ anchorDate: e.target.value })}
              className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1.5">Every future occurrence is calculated from this date. Required for a recurring category.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2">Due day of month (optional override)</label>
            <input
              type="number" min={1} max={31}
              value={value.dueDayOfMonth}
              onChange={(e) => onPatch({ dueDayOfMonth: e.target.value })}
              placeholder={value.anchorDate ? String(new Date(value.anchorDate + 'T00:00:00Z').getUTCDate()) : 'defaults to first due date’s day'}
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
          value={value.reminderLadderDays}
          onChange={(e) => onPatch({ reminderLadderDays: e.target.value })}
          placeholder="30,15,10,5"
          className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white font-mono focus:border-primary-500"
        />
        <p className="text-xs text-gray-500 mt-1.5">Pre-filled from the cadence you picked -- edit freely.</p>
      </div>
    </>
  );
}

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

  // Creator's fix-and-resubmit flow for a RETURNED category -- separate
  // from editingCategory above, which is the executive-only, any-status
  // cadence edit (anchor_date/due_day_of_month). This one is name/
  // regulator/reminder_ladder_days, RETURNED-only, creator-or-admin --
  // enforced server-side by updateComplianceCategory, mirrored here only
  // for which fields the form shows.
  const [resubmitCategory, setResubmitCategory] = useState<ComplianceCategory | null>(null);
  const [resubmitForm, setResubmitForm] = useState<CadenceFormState & { name: string; regulator: string }>({
    name: '', regulator: '', ...CADENCE_FORM_DEFAULTS,
  });
  const [resubmitLoading, setResubmitLoading] = useState(false);
  const [resubmitError, setResubmitError] = useState('');

  const [showArchived, setShowArchived] = useState(false);

  // One shared confirmation modal for withdraw/archive/restore -- each just
  // a status transition plus an optional/required reason, so one dialog
  // covers all three rather than three near-identical copies.
  const [confirmAction, setConfirmAction] = useState<{
    kind: 'withdraw' | 'archive' | 'restore';
    category: ComplianceCategory;
  } | null>(null);
  const [confirmReason, setConfirmReason] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  useEffect(() => {
    if (user && !CAN_VIEW_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (user && CAN_VIEW_ROLES.includes(user.role)) {
      fetchCategories();
    }
  }, [user, showArchived]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/compliance/categories?active_only=false&show_archived=${showArchived}`);
      setCategories(res.data);
    } catch (err) {
      setError('Failed to load compliance categories.');
      console.error(err);
    } finally {
      setLoading(false);
    }
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

      const recurring = isRecurringPreset(newCategory);
      if (recurring && !effectiveIntervalMonths(newCategory)) {
        setCreateError('Enter a valid number of months (1-60) for a custom cadence.');
        setCreateLoading(false);
        return;
      }
      if (recurring && !newCategory.anchorDate) {
        setCreateError('First due date is required for a recurring category.');
        setCreateLoading(false);
        return;
      }

      await api.post('/compliance/categories', {
        name: newCategory.name,
        regulator: newCategory.regulator || undefined,
        ...cadenceFormToApiFields(newCategory),
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

  const openResubmitModal = (category: ComplianceCategory) => {
    setResubmitCategory(category);
    const cadencePreset = presetForCadence(category.cadence_type, category.interval_months);
    setResubmitForm({
      name: category.name,
      regulator: category.regulator || '',
      cadencePreset,
      customIntervalMonths: cadencePreset === 'CUSTOM' && category.interval_months ? String(category.interval_months) : '3',
      anchorDate: category.anchor_date ? category.anchor_date.slice(0, 10) : '',
      dueDayOfMonth: category.due_day_of_month ? String(category.due_day_of_month) : '',
      reminderLadderDays: category.reminder_ladder_days.join(','),
    });
    setResubmitError('');
  };

  const handleFixAndResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resubmitCategory) return;
    try {
      setResubmitLoading(true);
      setResubmitError('');

      const ladder = resubmitForm.reminderLadderDays
        .split(',')
        .map((d) => parseInt(d.trim(), 10))
        .filter((d) => !isNaN(d));
      if (ladder.length === 0) {
        setResubmitError('Reminder ladder must have at least one valid number of days.');
        setResubmitLoading(false);
        return;
      }

      const recurring = isRecurringPreset(resubmitForm);
      if (recurring && !effectiveIntervalMonths(resubmitForm)) {
        setResubmitError('Enter a valid number of months (1-60) for a custom cadence.');
        setResubmitLoading(false);
        return;
      }
      if (recurring && !resubmitForm.anchorDate) {
        setResubmitError('First due date is required for a recurring category.');
        setResubmitLoading(false);
        return;
      }

      // Every field here -- including cadence_type/interval_months/
      // anchor_date/due_day_of_month when they've changed -- lands in the
      // same PATCH request, so updateComplianceCategory's own audit_log
      // write (keyed off Object.keys(updates)) captures the cadence change
      // with old/new values automatically; nothing extra needed here for
      // that (Bug 2, item 4).
      await api.patch(`/compliance/categories/${resubmitCategory.category_id}`, {
        name: resubmitForm.name,
        regulator: resubmitForm.regulator || null,
        ...cadenceFormToApiFields(resubmitForm),
        reminder_ladder_days: ladder,
      });
      await api.post(`/compliance/categories/${resubmitCategory.category_id}/resubmit`);

      setResubmitCategory(null);
      fetchCategories();
    } catch (err: any) {
      setResubmitError(err.response?.data?.message || 'Failed to save changes and resubmit this category.');
    } finally {
      setResubmitLoading(false);
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

  const openConfirm = (kind: 'withdraw' | 'archive' | 'restore', category: ComplianceCategory) => {
    setConfirmAction({ kind, category });
    setConfirmReason('');
    setConfirmError('');
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { kind, category } = confirmAction;

    if (kind === 'withdraw' && confirmReason.trim().length < 10) {
      setConfirmError('A withdrawal reason of at least 10 characters is required.');
      return;
    }

    try {
      setConfirmLoading(true);
      setConfirmError('');
      if (kind === 'restore') {
        await api.post(`/compliance/categories/${category.category_id}/restore`);
      } else {
        await api.post(`/compliance/categories/${category.category_id}/${kind}`, { reason: confirmReason || undefined });
      }
      setConfirmAction(null);
      fetchCategories();
    } catch (err: any) {
      setConfirmError(err.response?.data?.message || `Failed to ${kind} this category.`);
    } finally {
      setConfirmLoading(false);
    }
  };

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
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-900 text-primary-600 focus:ring-primary-500"
              />
              Show archived
            </label>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors font-bold shadow-lg shadow-primary-500/20"
            >
              <Plus className="w-5 h-5" />
              New Category
            </button>
          </div>
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
                    <RowErrorBoundary
                      key={cat.category_id}
                      fallback={
                        <tr>
                          <td colSpan={7} className="py-3 px-6 text-red-400 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            This category ({cat.name || cat.category_id}) failed to render. Refresh, or contact support if this persists.
                          </td>
                        </tr>
                      }
                    >
                      <CategoryTableRow
                        cat={cat}
                        isExecutive={isExecutive}
                        currentUserId={user?.user_id}
                        isAdmin={user?.role === 'admin'}
                        onResubmit={() => openResubmitModal(cat)}
                        onEditCadence={() => openEditModal(cat)}
                        onToggleActive={() => toggleActive(cat)}
                        onWithdraw={() => openConfirm('withdraw', cat)}
                        onArchive={() => openConfirm('archive', cat)}
                        onRestore={() => openConfirm('restore', cat)}
                        onOpenDetail={() => router.push(`/compliance/categories/${cat.category_id}`)}
                      />
                    </RowErrorBoundary>
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

              <CadenceFieldsForm
                value={newCategory}
                onPatch={(patch) => setNewCategory({ ...newCategory, ...patch })}
              />

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

      {resubmitCategory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-dark-700 bg-dark-900/80 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Undo2 className="w-5 h-5 text-orange-400" />
                Fix &amp; Resubmit -- {resubmitCategory.name}
              </h2>
              <button onClick={() => setResubmitCategory(null)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleFixAndResubmit} className="p-6 space-y-5">
              {resubmitCategory.rejection_reason && (
                <p className="text-sm text-orange-300 bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-2">
                  <span className="font-bold">Why it was returned:</span> {resubmitCategory.rejection_reason}
                </p>
              )}
              {resubmitError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{resubmitError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Name</label>
                <input
                  type="text" required
                  value={resubmitForm.name}
                  onChange={(e) => setResubmitForm({ ...resubmitForm, name: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Regulator (optional)</label>
                <input
                  type="text"
                  value={resubmitForm.regulator}
                  onChange={(e) => setResubmitForm({ ...resubmitForm, regulator: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                />
              </div>

              <CadenceFieldsForm
                value={resubmitForm}
                onPatch={(patch) => setResubmitForm({ ...resubmitForm, ...patch })}
              />

              <p className="text-xs text-gray-500">
                Cadence is editable here because this category has never been approved yet -- once approved, it's locked (deactivate and recreate instead).
              </p>

              <div className="pt-4 border-t border-dark-700 flex justify-end gap-3">
                <button type="button" onClick={() => setResubmitCategory(null)} className="px-6 py-2.5 text-gray-400 hover:text-white font-medium bg-dark-900 rounded-lg">Cancel</button>
                <button type="submit" disabled={resubmitLoading} className="px-8 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50">
                  {resubmitLoading ? 'Saving...' : <><Send className="w-5 h-5" /> Save &amp; Resubmit</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-xl font-bold text-white">
                {confirmAction.kind === 'withdraw' && 'Withdraw this category?'}
                {confirmAction.kind === 'archive' && 'Archive this category?'}
                {confirmAction.kind === 'restore' && 'Restore this category?'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-300 text-sm">
                {confirmAction.kind === 'withdraw' && (
                  <>&quot;{confirmAction.category.name}&quot; will be archived (soft-deleted) instead of being fixed and resubmitted. It will be hidden from default lists and excluded from the scheduler. This can be undone by an admin later.</>
                )}
                {confirmAction.kind === 'archive' && (
                  <>&quot;{confirmAction.category.name}&quot; will be archived (soft-deleted). It will be hidden from default lists and excluded from the scheduler. This can be undone by an admin later.</>
                )}
                {confirmAction.kind === 'restore' && (
                  <>&quot;{confirmAction.category.name}&quot; will be restored to its previous status ({confirmAction.category.previous_status || 'unknown'}) and become visible/active in lists again.</>
                )}
              </p>

              {(confirmAction.kind === 'withdraw' || confirmAction.kind === 'archive') && (
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">
                    Reason {confirmAction.kind === 'withdraw' ? '(required)' : '(optional)'}
                  </label>
                  <textarea
                    value={confirmReason}
                    onChange={(e) => setConfirmReason(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                    placeholder={confirmAction.kind === 'withdraw' ? 'At least 10 characters...' : 'Optional...'}
                  />
                </div>
              )}

              {confirmError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">{confirmError}</div>
              )}
            </div>
            <div className="p-6 border-t border-dark-700 flex justify-end gap-3">
              <button onClick={() => setConfirmAction(null)} className="px-6 py-2.5 text-gray-400 hover:text-white font-medium bg-dark-900 rounded-lg">Cancel</button>
              <button
                onClick={handleConfirmAction}
                disabled={confirmLoading}
                className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold disabled:opacity-50"
              >
                {confirmLoading ? 'Working...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
