'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/hooks/useAuth';
import { 
  Building2, MapPin, Phone, CreditCard, 
  CheckCircle2, Save, AlertCircle, Plus, Trash2, Store
} from 'lucide-react';

export default function CustomerOnboardingForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Business Identity
  const [tradingName, setTradingName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tpin, setTpin] = useState('');
  const [businessType, setBusinessType] = useState('Sole Trader');
  const [territory, setTerritory] = useState('');

  // Commercial Profile
  const [tierName, setTierName] = useState('Kantemba'); // Kantemba, Wholesale, Chain, Corporate
  
  // Credit Terms
  const [paymentTerms, setPaymentTerms] = useState('Cash');
  const [creditLimit, setCreditLimit] = useState<number>(0);

  // Dynamic Arrays
  const [locations, setLocations] = useState([
    { outlet_name: 'Main Store', address: '', town: '', region: '', is_primary: true }
  ]);
  
  const [contacts, setContacts] = useState([
    { full_name: '', position: 'Owner/Manager', phone: '', email: '', whatsapp: '', is_primary: true }
  ]);

  const [products, setProducts] = useState([
    { estimated_monthly_volume: 0, preferred_delivery_frequency: 'Weekly', notes: '' }
  ]);

  // Handlers for dynamic arrays
  const handleLocationChange = (index: number, field: string, value: string) => {
    const newLocs = [...locations];
    newLocs[index] = { ...newLocs[index], [field]: value };
    setLocations(newLocs);
  };

  const addLocation = () => {
    setLocations([...locations, { outlet_name: `Branch/Site ${locations.length + 1}`, address: '', town: '', region: '', is_primary: false }]);
  };

  const removeLocation = (index: number) => {
    if (locations.length > 1) setLocations(locations.filter((_, i) => i !== index));
  };

  const handleContactChange = (index: number, field: string, value: string) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setContacts(newContacts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!tradingName) return setError('Trading Name is required.');
    if (locations.some(l => !l.address || !l.town)) return setError('All locations must have an address and town.');
    if (contacts.some(c => !c.full_name || !c.phone)) return setError('All contacts must have a name and phone number.');

    const payload = {
      trading_name: tradingName,
      legal_name: legalName || tradingName,
      tpin,
      business_type: businessType,
      tier_name: tierName,
      payment_terms: paymentTerms,
      credit_limit: creditLimit,
      territory,
      locations,
      contacts,
      products
    };

    try {
      await api.post('/customers', payload);
      setSuccess(true);
      setTimeout(() => router.push('/vendor-management/customers'), 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to onboard customer.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-dark-800 border border-green-500/30 rounded-xl p-12 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Customer Onboarding Submitted!</h2>
        <p className="text-gray-400">The customer profile has been sent to the CFO for credit limit approval and ID generation.</p>
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mt-6"></div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl">
      <div className="p-6 border-b border-dark-700 bg-dark-900/50 flex items-center gap-3">
        <Store className="w-6 h-6 text-primary-400" />
        <h2 className="text-xl font-bold text-white">New Customer Profile</h2>
      </div>

      <div className="p-6 md:p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          
          {/* SECTION 1: BUSINESS IDENTITY & TIER */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-dark-700 pb-2">
              <Building2 className="w-5 h-5 text-primary-400" /> Business Identity
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-primary-400 mb-2">Customer Tier *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['Kantemba', 'Wholesale', 'Chain', 'Corporate'].map((tier) => (
                    <label 
                      key={tier} 
                      className={`cursor-pointer p-4 rounded-lg border-2 text-center transition-all ${
                        tierName === tier ? 'border-primary-500 bg-primary-500/10 text-white' : 'border-dark-600 bg-dark-900 text-gray-400 hover:border-dark-500'
                      }`}
                    >
                      <input type="radio" name="tier" value={tier} checked={tierName === tier} onChange={(e) => {
                        setTierName(e.target.value);
                        if (e.target.value !== 'Chain' && e.target.value !== 'Corporate' && locations.length > 1) {
                          setLocations([locations[0]]); // Reset to single location if changing away from Chain/Corporate
                        }
                      }} className="hidden" />
                      <div className="font-bold mb-1">{tier}</div>
                      <div className="text-xs opacity-70">
                        {tier === 'Kantemba' && 'Single shop/kiosk'}
                        {tier === 'Wholesale' && 'Bulk buyer / Distributor'}
                        {tier === 'Chain' && 'Multiple outlets/towns'}
                        {tier === 'Corporate' && 'B2B, Mines, Clubs'}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div><label className="block text-sm text-gray-400 mb-1">Trading Name *</label><input type="text" required value={tradingName} onChange={(e) => setTradingName(e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Legal Name (If different)</label><input type="text" value={legalName} onChange={(e) => setLegalName(e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">TPIN / Tax Number</label><input type="text" value={tpin} onChange={(e) => setTpin(e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white font-mono" /></div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Business Type</label>
                <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white">
                  <option value="Sole Trader">Sole Trader</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Ltd Company">Ltd Company</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: LOCATIONS */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-dark-700 pb-2">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-400" /> Location(s)
              </h3>
              {(tierName === 'Chain' || tierName === 'Corporate') && (
                <button type="button" onClick={addLocation} className="text-xs px-3 py-1 bg-primary-600/20 text-primary-400 hover:bg-primary-600/40 rounded flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Branch/Site
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {locations.map((loc, idx) => (
                <div key={idx} className="bg-dark-900 p-4 rounded-lg border border-dark-600 relative group">
                  {locations.length > 1 && (
                    <button type="button" onClick={() => removeLocation(idx)} className="absolute top-2 right-2 p-1.5 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(tierName === 'Chain' || tierName === 'Corporate') && (
                      <div className="lg:col-span-4"><label className="block text-xs text-gray-400 mb-1">Outlet/Branch/Site Name</label><input type="text" value={loc.outlet_name} onChange={(e) => handleLocationChange(idx, 'outlet_name', e.target.value)} className="w-full px-3 py-1.5 bg-dark-950 border border-dark-600 rounded text-white" /></div>
                    )}
                    <div className="lg:col-span-2"><label className="block text-xs text-gray-400 mb-1">Street Address *</label><input type="text" required value={loc.address} onChange={(e) => handleLocationChange(idx, 'address', e.target.value)} className="w-full px-3 py-1.5 bg-dark-950 border border-dark-600 rounded text-white" /></div>
                    <div><label className="block text-xs text-gray-400 mb-1">Town/City *</label><input type="text" required value={loc.town} onChange={(e) => handleLocationChange(idx, 'town', e.target.value)} className="w-full px-3 py-1.5 bg-dark-950 border border-dark-600 rounded text-white" /></div>
                    <div><label className="block text-xs text-gray-400 mb-1">Region/Province</label><input type="text" value={loc.region} onChange={(e) => handleLocationChange(idx, 'region', e.target.value)} className="w-full px-3 py-1.5 bg-dark-950 border border-dark-600 rounded text-white" /></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2"><label className="block text-sm text-gray-400 mb-1">Assigned Sales Territory</label><input type="text" value={territory} onChange={(e) => setTerritory(e.target.value)} placeholder="e.g. Copperbelt North" className="w-full md:w-1/2 px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
          </div>

          {/* SECTION 3: CONTACTS */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-dark-700 pb-2">
              <Phone className="w-5 h-5 text-primary-400" /> Primary Contact
            </h3>
            <div className="bg-dark-900 p-4 rounded-lg border border-dark-600 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-xs text-gray-400 mb-1">Full Name *</label><input type="text" required value={contacts[0].full_name} onChange={(e) => handleContactChange(0, 'full_name', e.target.value)} className="w-full px-3 py-1.5 bg-dark-950 border border-dark-600 rounded text-white" /></div>
              <div><label className="block text-xs text-gray-400 mb-1">Position / Title</label><input type="text" value={contacts[0].position} onChange={(e) => handleContactChange(0, 'position', e.target.value)} className="w-full px-3 py-1.5 bg-dark-950 border border-dark-600 rounded text-white" /></div>
              <div><label className="block text-xs text-gray-400 mb-1">Phone Number *</label><input type="tel" required value={contacts[0].phone} onChange={(e) => handleContactChange(0, 'phone', e.target.value)} className="w-full px-3 py-1.5 bg-dark-950 border border-dark-600 rounded text-white" /></div>
              <div className="md:col-span-2"><label className="block text-xs text-gray-400 mb-1">Email Address</label><input type="email" value={contacts[0].email} onChange={(e) => handleContactChange(0, 'email', e.target.value)} className="w-full px-3 py-1.5 bg-dark-950 border border-dark-600 rounded text-white" /></div>
              <div><label className="block text-xs text-green-400/80 mb-1">WhatsApp Number</label><input type="tel" value={contacts[0].whatsapp} onChange={(e) => handleContactChange(0, 'whatsapp', e.target.value)} placeholder="Include country code" className="w-full px-3 py-1.5 bg-dark-950 border border-dark-600 rounded text-white" /></div>
            </div>
          </div>

          {/* SECTION 4: COMMERCIAL & CREDIT */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-dark-700 pb-2">
              <CreditCard className="w-5 h-5 text-primary-400" /> Commercial Profile & Credit
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Requested Payment Terms</label>
                <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white">
                  <option value="Cash">Cash on Delivery (Default)</option>
                  <option value="7-day">7-Day Account</option>
                  <option value="14-day">14-Day Account</option>
                  <option value="30-day">30-Day Account</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Requested Credit Limit (ZMW)</label>
                <input type="number" min="0" value={creditLimit || ''} onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)} placeholder="Leave 0 for Cash terms" className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white font-mono" disabled={paymentTerms === 'Cash'} />
              </div>
              <div><label className="block text-sm text-gray-400 mb-1">Estimated Monthly Volume (Units)</label><input type="number" min="0" value={products[0].estimated_monthly_volume || ''} onChange={(e) => setProducts([{...products[0], estimated_monthly_volume: parseFloat(e.target.value) || 0}])} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white" /></div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Preferred Delivery Frequency</label>
                <select value={products[0].preferred_delivery_frequency} onChange={(e) => setProducts([{...products[0], preferred_delivery_frequency: e.target.value}])} className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white">
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Bi-Weekly">Bi-Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Ad-hoc">Ad-hoc (On Demand)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-dark-700 flex justify-end gap-4">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-primary-500/20">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />} Submit for CFO Approval
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}