'use client';

import { useState, useEffect } from 'react';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AssetDetailModal from '@/components/engineering/AssetDetailModal';
import {
  Wrench, Search, MapPin, CircleDot, AlertTriangle, XCircle, Settings,
  Ban, Plus, X, FolderTree, Download, Pencil, Trash2
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
  cost_usd: number | string | null;
}

interface FunctionalLocation {
  floc_id: string;
  floc_code: string;
  name: string;
  parent_floc_id: string | null;
  parent_name: string | null;
  criticality: string;
}

type Currency = 'USD' | 'ZMW';

// engineering (non-manager) can already read (requireAssetRegisterRead on
// the backend covers Finance + engineering broadly); create/edit/delete
// stays scoped to engineering_manager/admin, matching the pre-existing,
// deliberate backend convention -- this session doesn't widen it further.
const CAN_MANAGE = ['admin', 'engineering_manager'];

export default function AssetRegisterPage() {
  const { isAuthenticated, user, token } = useAuth();
  const canManage = user?.role && CAN_MANAGE.includes(user.role);

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [locations, setLocations] = useState<FunctionalLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Currency toggle -- same shared conversion mechanism Products/Pricing
  // already use: a live rate fetched from /sales/exchange-rate, not a
  // reimplementation.
  const [currency, setCurrency] = useState<Currency>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(27);

  // Detail modal
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Add Location modal
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationForm, setLocationForm] = useState({
    floc_code: '', name: '', parent_floc_id: '', criticality: 'MEDIUM',
  });
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Add/Edit Equipment modal -- one form, toggled between create and edit
  // by whether editingEquipmentId is set.
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
  const [equipmentForm, setEquipmentForm] = useState({
    equipment_code: '', name: '', model_number: '', manufacturer: '',
    floc_id: '', food_contact_surface: false, cost_usd: '',
  });
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [equipmentError, setEquipmentError] = useState('');

  // Delete confirmation
  const [deletingEquipment, setDeletingEquipment] = useState<Equipment | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAll();
      fetchExchangeRate();
    }
  }, [isAuthenticated]);

  const fetchExchangeRate = async () => {
    try {
      const res = await api.get('/sales/exchange-rate');
      setExchangeRate(Number(res.data.exchange_rate) || 27);
    } catch (err) {
      console.error('Failed to fetch exchange rate');
    }
  };

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

  const openAddEquipment = () => {
    setEditingEquipmentId(null);
    setEquipmentForm({ equipment_code: '', name: '', model_number: '', manufacturer: '', floc_id: '', food_contact_surface: false, cost_usd: '' });
    setEquipmentError('');
    setShowEquipmentModal(true);
  };

  const openEditEquipment = (eq: Equipment, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setEditingEquipmentId(eq.equipment_id);
    setEquipmentForm({
      equipment_code: eq.equipment_code,
      name: eq.name,
      model_number: eq.model_number || '',
      manufacturer: eq.manufacturer || '',
      floc_id: eq.floc_id || '',
      food_contact_surface: eq.food_contact_surface,
      cost_usd: eq.cost_usd != null ? String(eq.cost_usd) : '',
    });
    setEquipmentError('');
    setShowEquipmentModal(true);
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentForm.equipment_code.trim() || !equipmentForm.name.trim()) {
      return setEquipmentError('Code and name are required.');
    }
    setSavingEquipment(true);
    setEquipmentError('');
    try {
      const payload = {
        ...equipmentForm,
        floc_id: equipmentForm.floc_id || null,
        cost_usd: equipmentForm.cost_usd === '' ? null : parseFloat(equipmentForm.cost_usd),
      };
      if (editingEquipmentId) {
        // equipment_code is immutable once created (it's the natural key
        // other records like work orders reference by); only send the
        // fields the edit form actually offers.
        const { equipment_code, ...updatable } = payload;
        await api.patch(`/engineering/assets/equipment/${editingEquipmentId}`, updatable);
      } else {
        await api.post('/engineering/assets/equipment', payload);
      }
      setShowEquipmentModal(false);
      setEditingEquipmentId(null);
      setEquipmentForm({ equipment_code: '', name: '', model_number: '', manufacturer: '', floc_id: '', food_contact_surface: false, cost_usd: '' });
      await fetchAll();
    } catch (err: any) {
      setEquipmentError(err.response?.data?.message || `Failed to ${editingEquipmentId ? 'update' : 'create'} this equipment.`);
    } finally {
      setSavingEquipment(false);
    }
  };

  const handleDeleteEquipment = async () => {
    if (!deletingEquipment) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/engineering/assets/equipment/${deletingEquipment.equipment_id}`);
      setDeletingEquipment(null);
      await fetchAll();
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Failed to delete this equipment.');
    } finally {
      setDeleting(false);
    }
  };

  const openDetail = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
    setShowDetailModal(true);
  };

  const parsePrice = (price: number | string | undefined | null): number => {
    if (price == null) return 0;
    if (typeof price === 'number') return price;
    return parseFloat(price.replace('$', '').replace(',', '')) || 0;
  };

  const formatCost = (usdCost: number | string | null) => {
    if (usdCost == null) return '—';
    if (currency === 'ZMW') return `K${(parsePrice(usdCost) * exchangeRate).toFixed(2)}`;
    return `$${parsePrice(usdCost).toFixed(2)}`;
  };

  // Same Blob + anchor-download pattern as products/page.tsx's handleExport
  // -- the only existing CSV-export precedent in this codebase, reused
  // rather than reimplemented.
  const handleExportCsv = () => {
    const csvHeaders = ['Equipment Code', 'Name', 'Location', 'Manufacturer', 'Model Number', 'Status', 'Food Contact Surface', 'Cost (USD)', 'Cost (ZMW)'];

    const csvRows = filtered.map((eq) => [
      eq.equipment_code,
      eq.name,
      eq.floc_name || '',
      eq.manufacturer || '',
      eq.model_number || '',
      eq.status,
      eq.food_contact_surface ? 'Yes' : 'No',
      eq.cost_usd != null ? parsePrice(eq.cost_usd).toFixed(2) : '',
      eq.cost_usd != null ? (parsePrice(eq.cost_usd) * exchangeRate).toFixed(2) : '',
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asset_register_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
          <div className="flex flex-wrap items-center gap-3">
            {/* Currency Toggle -- identical markup to products/page.tsx */}
            <div className="flex items-center bg-dark-800 border border-dark-700 rounded-xl p-1">
              {(['USD', 'ZMW'] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    currency === c
                      ? c === 'ZMW'
                        ? 'bg-green-500 text-white shadow'
                        : 'bg-blue-500 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {c === 'USD' ? '$ USD' : 'K ZMW'}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="px-4 py-2.5 bg-dark-800 border border-dark-700 hover:bg-dark-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Download CSV
            </button>

            {canManage && (
              <>
                <button
                  onClick={() => setShowLocationModal(true)}
                  className="px-4 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
                >
                  <FolderTree className="w-4 h-4" /> Add Location
                </button>
                <button
                  onClick={openAddEquipment}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-cyan-500/20"
                >
                  <Plus className="w-5 h-5" /> Add Equipment
                </button>
              </>
            )}
          </div>
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
                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Cost ({currency})</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Status</th>
                    {canManage && <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {filtered.map((eq) => (
                    <tr
                      key={eq.equipment_id}
                      onClick={() => openDetail(eq.equipment_id)}
                      className="hover:bg-dark-700/30 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-white font-mono text-sm">{eq.equipment_code}</td>
                      <td className="px-4 py-3 text-white">{eq.name}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {eq.floc_name ? <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {eq.floc_name}</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{eq.manufacturer || '—'}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm font-mono">{formatCost(eq.cost_usd)}</td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(eq.status)}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={(ev) => openEditEquipment(eq, ev)}
                              className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(ev) => { ev.stopPropagation(); setDeleteError(''); setDeletingEquipment(eq); }}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {filtered.map((eq) => (
                <div
                  key={eq.equipment_id}
                  onClick={() => openDetail(eq.equipment_id)}
                  className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-2 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white font-semibold">{eq.name}</p>
                      <p className="text-gray-500 text-xs font-mono">{eq.equipment_code}</p>
                    </div>
                    {getStatusBadge(eq.status)}
                  </div>
                  {eq.floc_name && <p className="text-gray-400 text-sm flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {eq.floc_name}</p>}
                  {eq.manufacturer && <p className="text-gray-500 text-xs">{eq.manufacturer}</p>}
                  <p className="text-gray-300 text-sm font-mono">{formatCost(eq.cost_usd)}</p>
                  {canManage && (
                    <div className="flex gap-2 pt-2 border-t border-dark-700">
                      <button
                        onClick={(ev) => openEditEquipment(eq, ev)}
                        className="flex-1 py-2 text-sm text-cyan-400 bg-cyan-400/10 rounded-lg flex items-center justify-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); setDeleteError(''); setDeletingEquipment(eq); }}
                        className="flex-1 py-2 text-sm text-red-400 bg-red-400/10 rounded-lg flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
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

      {/* Add/Edit Equipment modal */}
      {canManage && showEquipmentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white">{editingEquipmentId ? 'Edit Equipment' : 'Add Equipment'}</h2>
              <button onClick={() => setShowEquipmentModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveEquipment} className="p-5 space-y-4">
              {equipmentError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">{equipmentError}</div>}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Equipment Code</label>
                <input
                  type="text"
                  value={equipmentForm.equipment_code}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, equipment_code: e.target.value.toUpperCase() })}
                  placeholder="e.g. MTR-4021"
                  disabled={!!editingEquipmentId}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {editingEquipmentId && <p className="text-xs text-gray-500 mt-1">Equipment code can't be changed after creation.</p>}
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
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Acquisition Cost (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={equipmentForm.cost_usd}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, cost_usd: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg pl-7 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Captured now, at creation -- not retrofitted later.</p>
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
                {savingEquipment ? 'Saving...' : editingEquipmentId ? 'Save Changes' : 'Add Equipment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {canManage && deletingEquipment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white">Delete Equipment</h2>
              <button onClick={() => setDeletingEquipment(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {deleteError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">{deleteError}</div>}
              <p className="text-gray-300">
                Delete <span className="font-mono text-cyan-400">{deletingEquipment.equipment_code}</span> — {deletingEquipment.name}? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingEquipment(null)}
                  className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteEquipment}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AssetDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        equipmentId={selectedEquipmentId}
        token={token || ''}
        currency={currency}
        exchangeRate={exchangeRate}
      />
    </DashboardLayout>
  );
}
