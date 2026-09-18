'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, api } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PricingManager from '@/components/admin/PricingManager';
import { DollarSign, Save, RefreshCw, CheckCircle2 } from 'lucide-react';

// Page-visibility gate -- who can reach /pricing at all. junior_accountant
// added (Finance Access Expansion): they can now edit per-product pricing
// via PricingManager below, so they need to reach this page. manager stays
// out, unchanged.
const CAN_VIEW_ROLES = ['admin', 'ceo', 'cfo', 'junior_accountant'];

// Separate, narrower gate for the Global Exchange Rate widget specifically
// -- a DIFFERENT backend route (POST /sales/exchange-rate) that
// junior_accountant was NOT given access to in this session (only
// PUT /products/pricing and POST /products were). Reusing CAN_VIEW_ROLES
// here would show junior_accountant an "Update" button on this widget that
// 403s -- the same class of frontend/backend mismatch found and fixed
// across the compliance sessions. The backend's authorize() array
// separately includes 'manager', but exchange-rate history shows manager
// has never actually used it, so it's not treated as an access boundary
// here either.
const CAN_EDIT_EXCHANGE_RATE_ROLES = ['admin', 'ceo', 'cfo'];

export default function PricingPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [globalRate, setGlobalRate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const canEdit = CAN_EDIT_EXCHANGE_RATE_ROLES.includes(user?.role || '');

  useEffect(() => {
    if (user && !CAN_VIEW_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    fetchRate();
  }, [token]);

  const fetchRate = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api.get('/sales/exchange-rate');
      setGlobalRate(res.data.exchange_rate.toString());
    } catch (err) {
      console.error('Failed to fetch exchange rate');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRate = async () => {
    if (!token || !globalRate) return;
    try {
      setSaving(true);
      setSuccess(false);
      await api.post('/sales/exchange-rate', { rate_value: parseFloat(globalRate) });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update exchange rate');
    } finally {
      setSaving(false);
    }
  };

  if (user && !CAN_VIEW_ROLES.includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto pb-12">
        
        {/* Exchange Rate Widget */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 mb-6 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" /> Global Exchange Rate (USD to ZMW)
            </h2>
            <p className="text-sm text-gray-400 mt-1">This rate dictates the locked ZMW pricing below and applies to all POS terminals globally.</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-48">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 font-bold">K</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="1"
                disabled={!canEdit || loading}
                value={globalRate}
                onChange={(e) => setGlobalRate(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 bg-dark-900 border border-dark-600 rounded-lg text-white font-mono font-bold focus:border-green-500 disabled:opacity-50"
                placeholder="0.00"
              />
            </div>
            
            {canEdit && (
              <button
                onClick={handleSaveRate}
                disabled={saving || loading || !globalRate}
                className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50 min-w-[100px] justify-center"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : success ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {success ? 'Saved!' : 'Update'}
              </button>
            )}
          </div>
        </div>

        {/* Pricing Manager - Passing the rate down as a prop! */}
        <PricingManager globalRate={parseFloat(globalRate) || 27} />
        
      </div>
    </DashboardLayout>
  );
}