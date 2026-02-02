'use client';

import { useEffect, useState } from 'react';
import { X, Package, MapPin, Box, TrendingUp, Calendar, Tag } from 'lucide-react';
import axios from 'axios';
import { useSettings } from '@/hooks/useSettings';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  token: string;
}

interface InventoryLocation {
  inventory_id: string;
  location_code: string;
  location_name: string;
  location_type: string;
  quantity_on_hand: number;
  quantity_allocated: number;
  quantity_available: number;
  uom: string;
}

interface ProductDetail {
  product_id: string;
  sku: string;
  product_name: string;
  description: string;
  category_name: string;
  base_uom: string;
  standard_cost: number | string;
  selling_price: number | string;
  reorder_level: number;
  is_active: boolean;
  total_stock: number;
  allocated_stock: number;
  available_stock: number;
  locations_count: number;
  created_at: string;
  updated_at: string;
  inventory_locations: InventoryLocation[];
}

export default function ProductDetailModal({
  isOpen,
  onClose,
  productId,
  token
}: ProductDetailModalProps) {
  const { formatCurrency } = useSettings();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && productId) {
      fetchProductDetails();
    }
  }, [isOpen, productId]);

  const fetchProductDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products/${productId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProduct(response.data);
    } catch (error: any) {
      console.error('Error fetching product details:', error);
      setError(error.response?.data?.message || 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const parsePrice = (price: number | string): number => {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      return parseFloat(price.replace('$', '').replace(',', '')) || 0;
    }
    return 0;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700 sticky top-0 bg-dark-800 z-10">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-primary-400" />
            <h2 className="text-2xl font-bold text-white">Product Details</h2>
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
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading product details...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
              {error}
            </div>
          ) : product ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-primary-400" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm text-gray-400">SKU</label>
                    <p className="text-lg font-mono text-primary-400 mt-1">{product.sku}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Product Name</label>
                    <p className="text-lg text-white font-medium mt-1">{product.product_name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Category</label>
                    <p className="text-lg text-white mt-1">{product.category_name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Unit of Measure</label>
                    <p className="text-lg text-white mt-1">{product.base_uom}</p>
                  </div>
                  {product.description && (
                    <div className="md:col-span-2">
                      <label className="text-sm text-gray-400">Description</label>
                      <p className="text-white mt-1">{product.description}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-gray-400">Status</label>
                    <p className="text-lg mt-1">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        product.is_active
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary-400" />
                  Pricing & Costs
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm text-gray-400">Standard Cost</label>
                    <p className="text-2xl text-white font-bold mt-1">
                      {formatCurrency(parsePrice(product.standard_cost), 'USD')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Selling Price</label>
                    <p className="text-2xl text-green-400 font-bold mt-1">
                      {formatCurrency(parsePrice(product.selling_price), 'USD')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Margin</label>
                    <p className="text-2xl text-primary-400 font-bold mt-1">
                      {formatCurrency(
                        parsePrice(product.selling_price) - parsePrice(product.standard_cost),
                        'USD'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stock Summary */}
              <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Box className="w-5 h-5 text-primary-400" />
                  Stock Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <label className="text-sm text-gray-400">Total Stock</label>
                    <p className="text-2xl text-white font-bold mt-1">
                      {product.total_stock?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{product.base_uom}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Available</label>
                    <p className="text-2xl text-green-400 font-bold mt-1">
                      {product.available_stock?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{product.base_uom}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Allocated</label>
                    <p className="text-2xl text-yellow-400 font-bold mt-1">
                      {product.allocated_stock?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{product.base_uom}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Reorder Level</label>
                    <p className="text-2xl text-orange-400 font-bold mt-1">
                      {product.reorder_level?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{product.base_uom}</p>
                  </div>
                </div>
              </div>

              {/* Inventory by Location */}
              <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-400" />
                  Inventory by Location ({product.locations_count || 0} locations)
                </h3>
                {product.inventory_locations && product.inventory_locations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-dark-950">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                            Location
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                            Type
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                            On Hand
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                            Allocated
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                            Available
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700">
                        {product.inventory_locations.map((location) => (
                          <tr key={location.inventory_id} className="hover:bg-dark-800 transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-white font-medium">{location.location_code}</p>
                                <p className="text-xs text-gray-400">{location.location_name}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-300">{location.location_type}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-white font-medium">
                                {location.quantity_on_hand?.toLocaleString() || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-yellow-400">
                                {location.quantity_allocated?.toLocaleString() || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-green-400 font-medium">
                                {location.quantity_available?.toLocaleString() || 0}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No inventory in any location</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Use Inventory → Receive to add stock
                    </p>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-400" />
                  Record Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Created At</label>
                    <p className="text-white mt-1">
                      {new Date(product.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Last Updated</label>
                    <p className="text-white mt-1">
                      {new Date(product.updated_at).toLocaleString()}
                    </p>
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
