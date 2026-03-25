'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  ArrowLeft,
  Edit,
  Package,
  DollarSign,
  TrendingUp,
  MapPin,
  AlertCircle,
  CheckCircle,
  XCircle,
  Box,
  Layers
} from 'lucide-react';
import axios from 'axios';

interface InventoryLocation {
  location_id: string;
  location_code: string;
  location_name: string;
  location_type: string;
  quantity_on_hand: number;
  quantity_allocated: number;
  quantity_available: number;
}

interface Product {
  product_id: string;
  sku: string;
  product_name: string;
  description: string;
  category_name: string;
  base_uom: string;
  standard_cost: number;
  selling_price: number;
  total_stock: number;
  reorder_level: number;
  available_stock: number;
  allocated_stock: number;
  locations_count: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  inventory_locations: InventoryLocation[];
}

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const productId = params.id as string;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && token && productId) {
      fetchProduct();
    }
  }, [authLoading, isAuthenticated, token, productId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products/${productId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setProduct(response.data);
    } catch (error: any) {
      console.error('Error fetching product:', error);
      setError(error.response?.data?.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const getStockStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle className="w-4 h-4 mr-1.5" />
            In Stock
          </span>
        );
      case 'low_stock':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <AlertCircle className="w-4 h-4 mr-1.5" />
            Low Stock
          </span>
        );
      case 'out_of_stock':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-4 h-4 mr-1.5" />
            Out of Stock
          </span>
        );
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error || !product) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push('/products')}
            className="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Products
          </button>
          
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-12 text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Product Not Found</h2>
            <p className="text-gray-400">{error || 'The product you are looking for does not exist.'}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/products')}
            className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Products
          </button>
          
          <button className="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors">
            <Edit className="w-4 h-4 mr-2" />
            Edit Product
          </button>
        </div>

        {/* Product Header */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">{product.product_name}</h1>
                {getStockStatusBadge(product.stock_status)}
              </div>
              <p className="text-gray-400 mb-4">{product.description || 'No description available'}</p>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400">SKU:</span>
                  <span className="text-primary-400 font-medium">{product.sku}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400">Category:</span>
                  <span className="text-white">{product.category_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400">Unit:</span>
                  <span className="text-white">{product.base_uom}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Total Stock */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Total Stock</p>
            <p className="text-2xl font-bold text-white">
              {(product.total_stock || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">{product.base_uom}</p>
          </div>

          {/* Available Stock */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Available</p>
            <p className="text-2xl font-bold text-white">
              {(product.available_stock || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Unallocated</p>
          </div>

          {/* Standard Cost */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Cost</p>
            <p className="text-2xl font-bold text-white">
              ${(product.standard_cost || 0).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Per unit</p>
          </div>

          {/* Selling Price */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-primary-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary-400" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Price</p>
            <p className="text-2xl font-bold text-white">
              ${(product.selling_price || 0).toFixed(2)}
            </p>
            <p className="text-xs text-green-400 mt-1">
              {(((product.selling_price || 0) - (product.standard_cost || 0)) / (product.standard_cost || 1) * 100).toFixed(0)}% margin
            </p>
          </div>
        </div>

        {/* Inventory by Location */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-dark-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-400" />
                  Inventory by Location
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Stock distribution across {product.locations_count || 0} location(s)
                </p>
              </div>
              {product.reorder_level && (
                <div className="text-right">
                  <p className="text-sm text-gray-400">Reorder Level</p>
                  <p className="text-lg font-bold text-yellow-400">
                    {(product.reorder_level || 0).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    On Hand
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Allocated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Available
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {product.inventory_locations && product.inventory_locations.length > 0 ? (
                  product.inventory_locations.map((location) => (
                    <tr key={location.location_id} className="hover:bg-dark-700 transition-colors">
                      <td className="px-6 py-4 text-sm text-white">
                        {location.location_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-primary-400 font-medium">
                        {location.location_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {location.location_type?.replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-4 text-sm text-white text-right font-medium">
                        {(location.quantity_on_hand || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-yellow-400 text-right">
                        {(location.quantity_allocated || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-green-400 text-right font-medium">
                        {(location.quantity_available || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No inventory found in any location
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Additional Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Information */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Product Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-dark-700">
                <span className="text-gray-400">SKU</span>
                <span className="text-white font-medium">{product.sku}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-dark-700">
                <span className="text-gray-400">Category</span>
                <span className="text-white">{product.category_name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-dark-700">
                <span className="text-gray-400">Unit of Measure</span>
                <span className="text-white">{product.base_uom}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-dark-700">
                <span className="text-gray-400">Status</span>
                <span className={product.is_active ? 'text-green-400' : 'text-red-400'}>
                  {product.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">Created</span>
                <span className="text-white">
                  {new Date(product.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Stock Metrics */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Stock Metrics</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Stock Level</span>
                  <span className="text-white font-medium">
                    {(((product.total_stock || 0) / (product.reorder_level || 1)) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      product.stock_status === 'in_stock'
                        ? 'bg-green-500'
                        : product.stock_status === 'low_stock'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.min(100, ((product.total_stock || 0) / (product.reorder_level || 1)) * 100)}%`
                    }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-dark-700">
                <div className="flex justify-between py-2">
                  <span className="text-gray-400">Total Inventory Value</span>
                  <span className="text-white font-medium">
                    ${((product.standard_cost || 0) * (product.total_stock || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-400">Potential Revenue</span>
                  <span className="text-green-400 font-medium">
                    ${((product.selling_price || 0) * (product.available_stock || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}