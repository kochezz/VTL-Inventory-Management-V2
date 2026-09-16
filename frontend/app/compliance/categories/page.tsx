'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Gavel, Plus, X, Save, AlertCircle, Power, PowerOff } from 'lucide-react';

// Matches this page's own sidebar nav entry (DashboardLayout.tsx) -- defining
// what compliance obligations exist is an executive-level decision, same
// boundary the backend's authorize(['admin','cfo','ceo']) enforces on
// POST/PATCH /api/compliance/categories. This guard is what makes the
// boundary real for direct-URL access, not just a hidden nav link (the same
// standard applied to /pricing earlier in this project).
const CAN_VIEW_ROLES = ['admin', 'cfo', 'ceo'];

const RECURRENCE_TYPES = [
  { value: 'ONE_OFF_EXPIRY', label: 'One-off / Expiry (e.g. a license renewal)' },
  { value: 'MONTHLY_RECURRING', label: 'Monthly Recurring' },
  { value: 'ANNUAL_RECURRING', label: 'Annual Recurring' },
];

interface ComplianceCategory {
  category_id: string;
  name: string;
  regulator: string | null;
  recurrence_type: string;
  reminder_ladder_days: number[];
  is_active: boolean;
}

export default function ComplianceCategoriesPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [categories, setCategories] = useState<ComplianceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newCategory, setNewCategory] = useState({
    name: '',
    regulator: '',
    recurrence_type: 'ONE_OFF_EXPIRY',
    reminder_ladder_days: '30,15,10,5',
  });

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateLoading(true);
      setCreateError('');

      const ladder = newCategory.reminder_ladder_days
        .split(',')
        .map((d) => parseInt(d.trim(), 10))
        .filter((d) => !isNaN(d));

      if (ladder.length === 0) {
        setCreateError('reminder ladder must have at least one valid number of days.');
        setCreateLoading(false);
        return;
      }

      await api.post('/compliance/categories', {
        name: newCategory.name,
        regulator: newCategory.regulator || undefined,
        recurrence_type: newCategory.recurrence_type,
        reminder_ladder_days: ladder,
      });

      setShowCreateModal(false);
      setNewCategory({ name: '', regulator: '', recurrence_type: 'ONE_OFF_EXPIRY', reminder_ladder_days: '30,15,10,5' });
      fetchCategories();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to create category.');
    } finally {
      setCreateLoading(false);
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
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr><td colSpan={6} className="py-16 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500 mb-4"></div>
                    <p className="text-gray-400">Loading categories...</p>
                  </td></tr>
                ) : categories.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center">
                    <Gavel className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-lg font-medium text-white mb-1">No compliance categories yet</p>
                    <p className="text-gray-500 text-sm">Create one to let junior_accountant register items against it.</p>
                  </td></tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.category_id} className="hover:bg-dark-700/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-white">{cat.name}</td>
                      <td className="py-4 px-6 text-gray-300">{cat.regulator || '—'}</td>
                      <td className="py-4 px-6 text-gray-300">{cat.recurrence_type.replace(/_/g, ' ')}</td>
                      <td className="py-4 px-6 text-gray-300 font-mono text-sm">{cat.reminder_ladder_days.join(', ')} days</td>
                      <td className="py-4 px-6 text-center">
                        <span className={`px-3 py-1.5 rounded-lg border font-bold text-xs uppercase tracking-wider ${
                          cat.is_active
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => toggleActive(cat)}
                          className="p-2 text-gray-400 hover:text-white bg-dark-900 hover:bg-primary-600 rounded-lg transition-all inline-flex items-center gap-1.5 text-xs font-bold"
                          title={cat.is_active ? 'Deactivate' : 'Reactivate'}
                        >
                          {cat.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          {cat.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
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
                  value={newCategory.recurrence_type}
                  onChange={(e) => setNewCategory({ ...newCategory, recurrence_type: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white focus:border-primary-500"
                >
                  {RECURRENCE_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                {newCategory.recurrence_type === 'MONTHLY_RECURRING' && (
                  <p className="text-xs text-amber-400 mt-1.5">Items registered under a monthly-recurring category will require a day-of-month at registration time.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Reminder Ladder (days before due, comma-separated)</label>
                <input
                  type="text" required
                  value={newCategory.reminder_ladder_days}
                  onChange={(e) => setNewCategory({ ...newCategory, reminder_ladder_days: e.target.value })}
                  placeholder="30,15,10,5"
                  className="w-full px-4 py-2 bg-dark-950 border border-dark-600 rounded-lg text-white font-mono focus:border-primary-500"
                />
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
    </DashboardLayout>
  );
}
