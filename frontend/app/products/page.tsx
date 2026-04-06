'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AddProductModal from '@/components/products/AddProductModal';
import ProductDetailModal from '@/components/products/ProductDetailModal';
import {
  Package,
  Search,
  Plus,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';
import axios from 'axios';

interface Product {
  product_id: string;
  sku: string;
  product_name: string;
  description: string;
  category_id: string;
  category_name: string;
  base_uom: string;
  standard_cost: number | string;
  selling_price: number | string;
  selling_price_zmw?: number | string;
  reorder_level: number;
  is_active: boolean;
  total_stock: number;
  stock_status: string;
  created_at: string;
  updated_at: string;
}

interface Category {
  category_id: string;
  category_name: string;
  product_count: number;
}

type Currency = 'USD' | 'ZMW';

export default function ProductsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Currency Toggle State
  const [currency, setCurrency] = useState<Currency>('USD');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');

  // Dynamic Exchange Rate Calculation
  const exchangeRate = products.length > 0 && products[0].selling_price_zmw 
    ? (Number(products[0].selling_price_zmw) / Number(products[0].selling_price)) 
    : 27;

  // Safe Price Parser
  const parsePrice = (price: number | string | undefined | null): number => {
    if (price == null) return 0;
    if (typeof price === 'number') return price;
    return parseFloat(price.replace('$', '').replace(',', '')) || 0;
  };

  // Currency Formatter
  const formatPrice = (usdPrice: number | string, zmwPrice?: number | string | null) => {
    if (currency === 'ZMW') {
      // Use exact ZMW price from DB if it exists, otherwise calculate it (for costs)
      if (zmwPrice && Number(zmwPrice) > 0) return `K${Number(zmwPrice).toFixed(2)}`;
      return `K${(parsePrice(usdPrice) * exchangeRate).toFixed(2)}`;
    }
    return `$${parsePrice(usdPrice).toFixed(2)}`;
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchProducts();
      fetchCategories();
    }
  }, [isAuthenticated, token, selectedCategory, stockStatusFilter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category_id', selectedCategory);
      if (stockStatusFilter) params.append('stock_status', stockStatusFilter);
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setProducts(response.data.products || []);
      setLoading(false);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load products');
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products/categories`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleExport = () => {
    const csvHeaders = ['SKU','Product Name','Category','Stock','Status','Cost USD','Cost ZMW','Price USD','Price ZMW','UOM'];
    
    const csvRows = filteredProducts.map(p => [
      p.sku,
      p.product_name,
      p.category_name,
      p.total_stock || 0,
      p.stock_status,
      parsePrice(p.standard_cost).toFixed(2),
      (parsePrice(p.standard_cost) * exchangeRate).toFixed(2),
      parsePrice(p.selling_price).toFixed(2),
      (p.selling_price_zmw || (parsePrice(p.selling_price) * exchangeRate)).toFixed(2),
      p.base_uom
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleProductClick = (productId: string) => {
    setSelectedProductId(productId);
    setShowDetailModal(true);
  };

  const filteredProducts = products.filter(product => {
    return product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
           product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           product.description?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const stockStats = {
    inStock: products.filter(p => p.stock_status === 'in_stock').length,
    lowStock: products.filter(p => p.stock_status === 'low_stock').length,
    outOfStock: products.filter(p => p.stock_status === 'out_of_stock').length,
  };

  const getStockStatusBadge = (status: string) => {
    const badges = {
      'in_stock': { icon: CheckCircle, text: 'In Stock', class: 'bg-green-500/10 text-green-400 border-green-500/20' },
      'low_stock': { icon: AlertCircle, text: 'Low Stock', class: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
      'out_of_stock': { icon: XCircle, text: 'Out of Stock', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    const badge = badges[status as keyof typeof badges] || badges['out_of_stock'];
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.class}`}>
        <Icon className="w-3.5 h-3.5" />{badge.text}
      </span>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading products...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header with Currency Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Package className="w-8 h-8 text-primary-400" />
              Products
            </h1>
            <p className="text-gray-400 mt-1">Manage your water bottle product catalog</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Currency Toggle */}
            <div className="flex items-center bg-dark-800 border border-dark-700 rounded-xl p-1">
              {(['USD', 'ZMW'] as Currency[]).map(c => (
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
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Product
            </button>
          </div>
        </div>

        {/* Stock Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 hover:border-green-500/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-400">In Stock</span>
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stockStats.inStock}</p>
          </div>
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 hover:border-yellow-500/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-400">Low Stock</span>
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stockStats.lowStock}</p>
          </div>
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 hover:border-red-500/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-400">Out of Stock</span>
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stockStats.outOfStock}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by SKU, name, or description..."
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category.category_id} value={category.category_id}>
                    {category.category_name} ({category.product_count})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-700">
            <p className="text-sm text-gray-400">
              Showing <span className="text-white font-medium">{filteredProducts.length}</span> of {products.length} products
            </p>
            <button 
              onClick={handleExport}
              disabled={filteredProducts.length === 0}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg text-white flex items-center gap-2 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-dark-900 border-b border-dark-700">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Product Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Price ({currency})</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cost ({currency})</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {filteredProducts.map((product) => (
                  <tr 
                    key={product.product_id} 
                    className="even:bg-dark-900/40 hover:bg-dark-700/80 transition-colors cursor-pointer group"
                    onClick={() => handleProductClick(product.product_id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono font-semibold text-primary-400">{product.sku}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
                          {product.product_name}
                        </span>
                        <span className="text-xs text-gray-500 mt-0.5">{product.description || 'No description'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-400">{product.category_name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-gray-200">{product.total_stock?.toLocaleString() || 0}</span>
                        <span className="text-xs text-gray-500 uppercase">{product.base_uom}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStockStatusBadge(product.stock_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-primary-400">
                        {formatPrice(product.selling_price, product.selling_price_zmw)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-400">
                        {formatPrice(product.standard_cost)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleProductClick(product.product_id); }}
                        className="p-2 text-gray-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showAddModal && (
          <AddProductModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => { fetchProducts(); setShowAddModal(false); }}
            token={token!}
            categories={categories}
          />
        )}

        {selectedProductId && (
          <ProductDetailModal
            isOpen={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            productId={selectedProductId}
            token={token!}
            currency={currency}
            exchangeRate={exchangeRate}
          />
        )}
      </div>
    </DashboardLayout>
  );
}