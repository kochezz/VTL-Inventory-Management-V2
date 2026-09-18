'use client';

import { useEffect, useState } from 'react';
import { X, Wrench, MapPin, DollarSign, Calendar, Tag, CircleDot, AlertTriangle, XCircle, Settings, Ban } from 'lucide-react';
import axios from 'axios';

interface AssetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentId: string;
  token: string;
  currency: 'USD' | 'ZMW';
  exchangeRate: number;
}

interface EquipmentDetail {
  equipment_id: string;
  equipment_code: string;
  name: string;
  model_number: string | null;
  manufacturer: string | null;
  floc_id: string | null;
  floc_name: string | null;
  floc_code: string | null;
  parent_equipment_id: string | null;
  installation_date: string | null;
  status: string;
  food_contact_surface: boolean;
  cost_usd: number | string | null;
  created_at: string;
  updated_at: string;
}

// Same fixed-overlay / sectioned-card / formatPrice-prop pattern as
// components/products/ProductDetailModal.tsx -- reused deliberately rather
// than reinvented, per this session's own instruction.
export default function AssetDetailModal({
  isOpen,
  onClose,
  equipmentId,
  token,
  currency,
  exchangeRate
}: AssetDetailModalProps) {
  const [equipment, setEquipment] = useState<EquipmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && equipmentId) {
      fetchEquipmentDetails();
    }
  }, [isOpen, equipmentId]);

  const fetchEquipmentDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/engineering/assets/equipment/${equipmentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEquipment(response.data);
    } catch (err: any) {
      console.error('Error fetching equipment details:', err);
      setError(err.response?.data?.message || 'Failed to load equipment details');
    } finally {
      setLoading(false);
    }
  };

  const parsePrice = (price: number | string | undefined | null): number => {
    if (price == null) return 0;
    if (typeof price === 'number') return price;
    return parseFloat(price.replace('$', '').replace(',', '')) || 0;
  };

  // Same conversion formula the Products module uses (usd * exchangeRate) --
  // no stored ZMW value here, since equipment cost has no POS-style retail
  // rounding to preserve; the exchange rate itself comes from the same
  // shared /sales/exchange-rate endpoint Products/Pricing already use.
  const formatPrice = (usdPrice: number | string | null) => {
    if (usdPrice == null) return '—';
    if (currency === 'ZMW') return `K${(parsePrice(usdPrice) * exchangeRate).toFixed(2)}`;
    return `$${parsePrice(usdPrice).toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPERATIONAL':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20"><CircleDot className="w-4 h-4" /> Operational</span>;
      case 'DEGRADED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"><AlertTriangle className="w-4 h-4" /> Degraded</span>;
      case 'OUT_OF_SERVICE':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20"><XCircle className="w-4 h-4" /> Out of Service</span>;
      case 'IN_REPAIR':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"><Settings className="w-4 h-4" /> In Repair</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20"><Ban className="w-4 h-4" /> Scrapped</span>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700 sticky top-0 bg-dark-800 z-10">
          <div className="flex items-center gap-3">
            <Wrench className="w-6 h-6 text-cyan-400" />
            <h2 className="text-2xl font-bold text-white">Asset Details</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading equipment details...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
              {error}
            </div>
          ) : equipment ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-cyan-400" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm text-gray-400">Equipment Code</label>
                    <p className="text-lg font-mono text-cyan-400 mt-1">{equipment.equipment_code}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Name</label>
                    <p className="text-lg text-white font-medium mt-1">{equipment.name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Model Number</label>
                    <p className="text-lg text-white mt-1">{equipment.model_number || '—'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Manufacturer</label>
                    <p className="text-lg text-white mt-1">{equipment.manufacturer || '—'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Status</label>
                    <p className="mt-1">{getStatusBadge(equipment.status)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Food-Contact Surface</label>
                    <p className="text-lg text-white mt-1">{equipment.food_contact_surface ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>

              {/* Cost */}
              <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-cyan-400" />
                  Cost ({currency})
                </h3>
                <div>
                  <label className="text-sm text-gray-400">Acquisition Cost</label>
                  <p className="text-2xl text-green-400 font-bold mt-1">
                    {formatPrice(equipment.cost_usd)}
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-cyan-400" />
                  Functional Location
                </h3>
                {equipment.floc_name ? (
                  <p className="text-lg text-white">
                    <span className="font-mono text-cyan-400">{equipment.floc_code}</span> — {equipment.floc_name}
                  </p>
                ) : (
                  <p className="text-gray-500">Not linked to a functional location</p>
                )}
              </div>

              {/* Metadata */}
              <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  Record Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Installation Date</label>
                    <p className="text-white mt-1">
                      {equipment.installation_date ? new Date(equipment.installation_date).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Created At</label>
                    <p className="text-white mt-1">{new Date(equipment.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Last Updated</label>
                    <p className="text-white mt-1">{new Date(equipment.updated_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-dark-700 p-6 flex justify-end sticky bottom-0 bg-dark-800">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
