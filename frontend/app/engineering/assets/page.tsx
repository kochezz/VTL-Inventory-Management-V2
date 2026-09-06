'use client';

import { useState, useEffect } from 'react';
import { api, useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Wrench, Search, MapPin, CircleDot, AlertTriangle, XCircle, Settings, Ban
} from 'lucide-react';

interface Equipment {
  equipment_id: string;
  equipment_code: string;
  name: string;
  model_number: string | null;
  manufacturer: string | null;
  floc_id: string | null;
  floc_name: string | null;
  floc_code: string | null;
  status: string;
  food_contact_surface: boolean;
  installation_date: string | null;
}

export default function AssetRegisterPage() {
  const { isAuthenticated } = useAuth();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (isAuthenticated) fetchEquipment();
  }, [isAuthenticated]);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/engineering/assets/equipment');
      setEquipment(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load the asset register.');
    } finally {
      setLoading(false);
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
        return (
          <span className="flex items-center gap-1 text-green-400">
            <CircleDot className="w-4 h-4" /> Operational
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="flex items-center gap-1 text-yellow-400">
            <AlertTriangle className="w-4 h-4" /> Degraded
          </span>
        );
      case 'OUT_OF_SERVICE':
        return (
          <span className="flex items-center gap-1 text-red-400">
            <XCircle className="w-4 h-4" /> Out of Service
          </span>
        );
      case 'IN_REPAIR':
        return (
          <span className="flex items-center gap-1 text-blue-400">
            <Settings className="w-4 h-4" /> In Repair
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-gray-500">
            <Ban className="w-4 h-4" /> Scrapped
          </span>
        );
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
            <p className="text-gray-400 mt-1">
              Functional locations and equipment across the plant
            </p>
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

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

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
            {/* Desktop: table. Hidden below md, since a wide table doesn't fit a phone screen. */}
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
                        {eq.floc_name ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {eq.floc_name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{eq.manufacturer || '—'}</td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(eq.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards instead of a cramped table */}
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
                  {eq.floc_name && (
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {eq.floc_name}
                    </p>
                  )}
                  {eq.manufacturer && (
                    <p className="text-gray-500 text-xs">{eq.manufacturer}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
