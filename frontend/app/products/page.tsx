'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AddProductModal from '@/components/products/AddProductModal';
import ProductDetailModal from '@/components/products/ProductDetailModal';
import {
  Package,
  Search,
  Filter,
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

export default function ProductsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  const { formatCurrency } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');

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
      console.error('Error fetching products:', error);
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

  // Export to CSV function
  const handleExport = () => {
    const csvHeaders = [
      'SKU',
      'Product Name',
      'Category',
      'Stock',
      'Status',
      'Cost',
      'Price',
      'UOM'
    ];

    const csvRows = filteredProducts.map(product => [
      product.sku,
      product.product_name,
      product.category_name,
      product.total_stock || 0,
      product.stock_status,
      parsePrice(product.standard_cost),
      parsePrice(product.selling_price),
      product.base_uom
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

  // Handle row click to show product details
  const handleProductClick = (productId: string) => {
    setSelectedProductId(productId);
    setShowDetailModal(true);
  };

  // Helper function to parse price (handles both "$0.06" and 0.06)
  const parsePrice = (price: number | string): number => {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      return parseFloat(price.replace('$', '').replace(',', '')) || 0;
    }
    return 0;
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const stockStats = {
    inStock: products.filter(p => p.stock_status === 'in_stock').length,
    lowStock: products.filter(p => p.stock_status === 'low_stock').length,
    outOfStock: products.filter(p => p.stock_status === 'out_of_stock').length,
  };

  const getStockStatusBadge = (status: string) => {
    const badges = {
      'in_stock': { 
        icon: CheckCircle, 
        text: 'In Stock', 
        class: 'bg-green-500/10 text-green-400 border-green-500/20' 
      },
      'low_stock': { 
        icon: AlertCircle, 
        text: 'Low Stock', 
        class: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' 
      },
      'out_of_stock': { 
        icon: XCircle, 
        text: 'Out of Stock', 
        class: 'bg-red-500/10 text-red-400 border-red-500/20' 
      },
    };

    const badge = badges[status as keyof typeof badges] || badges['out_of_stock'];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.class}`}>
        <Icon className="w-3.5 h-3.5" />
        {badge.text}
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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Package className="w-8 h-8 text-primary-400" />
              Products
            </h1>
            <p className="text-gray-400 mt-1">Manage your water bottle product catalog</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
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
            {/* Search */}
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

            {/* Category Filter */}
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

            {/* Stock Status Filter */}
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
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg text-white flex items-center gap-2 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Products Table */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-dark-900 border-b border-dark-700">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center bg-dark-800">
                      <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-300 font-medium text-lg">No products found</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {searchTerm || selectedCategory || stockStatusFilter
                          ? 'Try adjusting your filters'
                          : 'Add your first product to get started'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr 
                      key={product.product_id} 
                      /* ZEBRA STRIPING ADDED HERE (even:bg-dark-900/40) */
                      className="even:bg-dark-900/40 hover:bg-dark-700/80 transition-colors cursor-pointer group"
                      onClick={() => handleProductClick(product.product_id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-semibold text-primary-400 group-hover:text-primary-300 transition-colors">
                          {product.sku}
                        </span>
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
                          <span className="text-sm font-bold text-gray-200">
                            {product.total_stock?.toLocaleString() || 0}
                          </span>
                          <span className="text-xs text-gray-500 uppercase">{product.base_uom}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStockStatusBadge(product.stock_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-300">
                          {formatCurrency(parsePrice(product.selling_price), 'USD')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-400">
                          {formatCurrency(parsePrice(product.standard_cost), 'USD')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductClick(product.product_id);
                          }}
                          className="p-2 text-gray-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Product Modal */}
        <AddProductModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchProducts();
            setShowAddModal(false);
          }}
          token={token!}
          categories={categories}
        />

        {/* Product Detail Modal */}
        {selectedProductId && (
          <ProductDetailModal
            isOpen={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            productId={selectedProductId}
            token={token!}
          />
        )}
      </div>
    </DashboardLayout>
  );
}