'use client';

import { useState, useEffect } from 'react';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Wrench, Search, MapPin, CircleDot, AlertTriangle, XCircle, Settings,
  Ban, Plus, X, FolderTree
} from 'lucide-react';

interface Equipment {
  equipment_id: string;
  equipment_code: string;
  name: string;
  model_number: string | null;
  manufacturer: string | null;
  floc_id: string | null;
  floc_name: string | null;
  status: string;
  food_contact_surface: boolean;
}

interface FunctionalLocation {
  floc_id: string;
  floc_code: string;
  name: string;
  parent_floc_id: string | null;
  parent_name: string | null;
  criticality: string;
}

const CAN_MANAGE = ['admin', 'engineering_manager'];

export default function AssetRegisterPage() {
  const { isAuthenticated, user } = useAuth();
  const canManage = user?.role && CAN_MANAGE.includes(user.role);

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [locations, setLocations] = useState<FunctionalLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Add Location modal
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationForm, setLocationForm] = useState({
    floc_code: '', name: '', parent_floc_id: '', criticality: 'MEDIUM',
  });
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Add Equipment modal
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [equipmentForm, setEquipmentForm] = useState({
    equipment_code: '', name: '', model_number: '', manufacturer: '',
    floc_id: '', food_contact_surface: false,
  });
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [equipmentError, setEquipmentError] = useState('');

  useEffect(() => {
    if (isAuthenticated) fetchAll();
  }, [isAuthenticated]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [equipRes, locRes] = await Promise.all([
        api.get('/engineering/assets/equipment'),
        api.get('/engineering/assets/locations'),
      ]);
      setEquipment(equipRes.data);
      setLocations(locRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load the asset register.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationForm.floc_code.trim() || !locationForm.name.trim()) {
      return setLocationError('Code and name are required.');
    }
    setSavingLocation(true);
    setLocationError('');
    try {
      await api.post('/engineering/assets/locations', {
        ...locationForm,
        parent_floc_id: locationForm.parent_floc_id || null,
      });
      setShowLocationModal(false);
      setLocationForm({ floc_code: '', name: '', parent_floc_id: '', criticality: 'MEDIUM' });
      await fetchAll();
    } catch (err: any) {
      setLocationError(err.response?.data?.message || 'Failed to create this location.');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentForm.equipment_code.trim() || !equipmentForm.name.trim()) {
      return setEquipmentError('Code and name are required.');
    }
    setSavingEquipment(true);
    setEquipmentError('');
    try {
      await api.post('/engineering/assets/equipment', {
        ...equipmentForm,
        floc_id: equipmentForm.floc_id || null,
      });
      setShowEquipmentModal(false);
      setEquipmentForm({ equipment_code: '', name: '', model_number: '', manufacturer: '', floc_id: '', food_contact_surface: false });
      await fetchAll();
    } catch (err: any) {
      setEquipmentError(err.response?.data?.message || 'Failed to create this equipment.');
    } finally {
      setSavingEquipment(false);
    }
  };

  const filtered = equipment.filter((eq) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      eq.equipment_code.toLowerCase().includes(q) ||
      eq.name.toLowerCase().includes(q) ||
      (eq.floc_name || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || eq.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPERATIONAL':
        return <span className="flex items-center gap-1 text-green-400"><CircleDot className="w-4 h-4" /> Operational</span>;
      case 'DEGRADED':
        return <span className="flex items-center gap-1 text-yellow-400"><AlertTriangle className="w-4 h-4" /> Degraded</span>;
      case 'OUT_OF_SERVICE':
        return <span className="flex items-center gap-1 text-red-400"><XCircle className="w-4 h-4" /> Out of Service</span>;
      case 'IN_REPAIR':
        return <span className="flex items-center gap-1 text-blue-400"><Settings className="w-4 h-4" /> In Repair</span>;
      default:
        return <span className="flex items-center gap-1 text-gray-500"><Ban className="w-4 h-4" /> Scrapped</span>;
    }
  };

  const counts = {
    total: equipment.length,
    operational: equipment.filter((e) => e.status === 'OPERATIONAL').length,
    degraded: equipment.filter((e) => e.status === 'DEGRADED').length,
    down: equipment.filter((e) => e.status === 'OUT_OF_SERVICE' || e.status === 'IN_REPAIR').length,
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Wrench className="w-8 h-8 text-cyan-500" />
              Asset Register
            </h1>
            <p className="text-gray-400 mt-1">Functional locations and equipment across the plant</p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowLocationModal(true)}
                className="px-4 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
              >
                <FolderTree className="w-4 h-4" /> Add Location
              </button>
              <button
                onClick={() => setShowEquipmentModal(true)}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-cyan-500/20"
              >
                <Plus className="w-5 h-5" /> Add Equipment
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">Total Assets</p>
            <p className="text-3xl font-black text-white">{counts.total}</p>
          </div>
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-green-500">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">Operational</p>
            <p className="text-3xl font-black text-green-400">{counts.operational}</p>
          </div>
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-yellow-500">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">Degraded</p>
            <p className="text-3xl font-black text-yellow-400">{counts.degraded}</p>
          </div>
          <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-red-500">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">Down</p>
            <p className="text-3xl font-black text-red-400">{counts.down}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Functional Locations */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
            <FolderTree className="w-5 h-5 text-cyan-500" /> Functional Locations
          </h2>
          {locations.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No functional locations exist yet. Add one before adding equipment to it.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {locations.map((fl) => (
                <span key={fl.floc_id} className="px-3 py-1.5 bg-dark-900/50 border border-dark-700 rounded-lg text-sm text-gray-300">
                  <span className="font-mono text-cyan-400">{fl.floc_code}</span> — {fl.name}
                  {fl.parent_name && <span className="text-gray-500"> (under {fl.parent_name})</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Equipment search/filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by code, name, or location..."
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
            <option value="OPERATIONAL">Operational</option>
            <option value="DEGRADED">Degraded</option>
            <option value="OUT_OF_SERVICE">Out of Service</option>
            <option value="IN_REPAIR">In Repair</option>
            <option value="SCRAPPED">Scrapped</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading asset register...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-12 text-center">
            <Wrench className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">
              {equipment.length === 0
                ? 'No equipment has been added to the asset register yet.'
                : 'No equipment matches this search or filter.'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-dark-900/50 border-b border-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Code</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Name</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Location</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Manufacturer</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {filtered.map((eq) => (
                    <tr key={eq.equipment_id} className="hover:bg-dark-700/30">
                      <td className="px-4 py-3 text-white font-mono text-sm">{eq.equipment_code}</td>
                      <td className="px-4 py-3 text-white">{eq.name}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {eq.floc_name ? <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {eq.floc_name}</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{eq.manufacturer || '—'}</td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(eq.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {filtered.map((eq) => (
                <div key={eq.equipment_id} className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white font-semibold">{eq.name}</p>
                      <p className="text-gray-500 text-xs font-mono">{eq.equipment_code}</p>
                    </div>
                    {getStatusBadge(eq.status)}
                  </div>
                  {eq.floc_name && <p className="text-gray-400 text-sm flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {eq.floc_name}</p>}
                  {eq.manufacturer && <p className="text-gray-500 text-xs">{eq.manufacturer}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add Location modal */}
      {canManage && showLocationModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white">Add Functional Location</h2>
              <button onClick={() => setShowLocationModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateLocation} className="p-5 space-y-4">
              {locationError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">{locationError}</div>}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Code</label>
                <input
                  type="text"
                  value={locationForm.floc_code}
                  onChange={(e) => setLocationForm({ ...locationForm, floc_code: e.target.value.toUpperCase() })}
                  placeholder="e.g. LINE01-FILLER"
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Name</label>
                <input
                  type="text"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  placeholder="e.g. Line 01 - Filling Block"
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Parent Location (optional)</label>
                <select
                  value={locationForm.parent_floc_id}
                  onChange={(e) => setLocationForm({ ...locationForm, parent_floc_id: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">None (top level)</option>
                  {locations.map((fl) => (
                    <option key={fl.floc_id} value={fl.floc_id}>{fl.floc_code} — {fl.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Criticality</label>
                <select
                  value={locationForm.criticality}
                  onChange={(e) => setLocationForm({ ...locationForm, criticality: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="VERY_HIGH">Very High</option>
                </select>
              </div>
              <button type="submit" disabled={savingLocation} className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors">
                {savingLocation ? 'Creating...' : 'Add Location'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Equipment modal */}
      {canManage && showEquipmentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white">Add Equipment</h2>
              <button onClick={() => setShowEquipmentModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateEquipment} className="p-5 space-y-4">
              {equipmentError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">{equipmentError}</div>}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Equipment Code</label>
                <input
                  type="text"
                  value={equipmentForm.equipment_code}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, equipment_code: e.target.value.toUpperCase() })}
                  placeholder="e.g. MTR-4021"
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Name</label>
                <input
                  type="text"
                  value={equipmentForm.name}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                  placeholder="e.g. Capper Carousel Servo Motor"
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Functional Location</label>
                <select
                  value={equipmentForm.floc_id}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, floc_id: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Not linked to a location</option>
                  {locations.map((fl) => (
                    <option key={fl.floc_id} value={fl.floc_id}>{fl.floc_code} — {fl.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Model Number</label>
                  <input
                    type="text"
                    value={equipmentForm.model_number}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, model_number: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Manufacturer</label>
                  <input
                    type="text"
                    value={equipmentForm.manufacturer}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, manufacturer: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={equipmentForm.food_contact_surface}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, food_contact_surface: e.target.checked })}
                  className="rounded border-dark-600"
                />
                This is a food-contact surface
              </label>
              <button type="submit" disabled={savingEquipment} className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors">
                {savingEquipment ? 'Creating...' : 'Add Equipment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
