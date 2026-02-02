'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Search, 
  Filter, 
  Download, 
  Plus,
  Package,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import axios from 'axios';

interface Product {
  product_id: string;
  sku: string;
  product_name: string;
  category_name: string;
  base_uom: string;
  standard_cost: number;
  selling_price: number;
  total_stock: number;
  reorder_level: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  is_active: boolean;
}

interface Category {
  category_id: number;
  category_name: string;
  product_count: number;
}

export default function ProductsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [statusCounts, setStatusCounts] = useState({
    in_stock: 0,
    low_stock: 0,
    out_of_stock: 0
  });
  const itemsPerPage = 20;

  // Handle authentication
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch status counts (for the cards)
  useEffect(() => {
    if (!authLoading && isAuthenticated && token) {
      fetchStatusCounts();
    }
  }, [authLoading, isAuthenticated, token, searchTerm, selectedCategory]);

  // Fetch data when authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && token) {
      fetchCategories();
      fetchProducts();
    }
  }, [authLoading, isAuthenticated, token, searchTerm, selectedCategory, selectedStatus, currentPage]);

  const fetchStatusCounts = async () => {
    try {
      // Fetch counts for each status
      const params = new URLSearchParams({
        limit: '1000', // Get all to count properly
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && { category_id: selectedCategory })
      });

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const allProducts = response.data.products;
      setStatusCounts({
        in_stock: allProducts.filter((p: Product) => p.stock_status === 'in_stock').length,
        low_stock: allProducts.filter((p: Product) => p.stock_status === 'low_stock').length,
        out_of_stock: allProducts.filter((p: Product) => p.stock_status === 'out_of_stock').length,
      });
    } catch (error) {
      console.error('Error fetching status counts:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products/categories`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && { category_id: selectedCategory }),
        ...(selectedStatus && { stock_status: selectedStatus }) // FIXED: Send to backend
      });

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setProducts(response.data.products);
      setTotalProducts(response.data.total);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            In Stock
          </span>
        );
      case 'low_stock':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <AlertCircle className="w-3 h-3 mr-1" />
            Low Stock
          </span>
        );
      case 'out_of_stock':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Out of Stock
          </span>
        );
    }
  };

  const totalPages = Math.ceil(totalProducts / itemsPerPage);

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading...</p>
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
            <p className="text-gray-400 mt-1">
              Manage your water bottle product catalog
            </p>
          </div>
          <button className="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors">
            <Plus className="w-5 h-5 mr-2" />
            Add Product
          </button>
        </div>

        {/* Status Quick Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => {
              setSelectedStatus(selectedStatus === 'in_stock' ? '' : 'in_stock');
              setCurrentPage(1);
            }}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedStatus === 'in_stock'
                ? 'bg-green-500/10 border-green-500'
                : 'bg-dark-800 border-dark-700 hover:border-green-500/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm text-gray-400">In Stock</p>
                <p className="text-2xl font-bold text-green-400 mt-1">
                  {statusCounts.in_stock}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </button>

          <button
            onClick={() => {
              setSelectedStatus(selectedStatus === 'low_stock' ? '' : 'low_stock');
              setCurrentPage(1);
            }}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedStatus === 'low_stock'
                ? 'bg-yellow-500/10 border-yellow-500'
                : 'bg-dark-800 border-dark-700 hover:border-yellow-500/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm text-gray-400">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">
                  {statusCounts.low_stock}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-400" />
            </div>
          </button>

          <button
            onClick={() => {
              setSelectedStatus(selectedStatus === 'out_of_stock' ? '' : 'out_of_stock');
              setCurrentPage(1);
            }}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedStatus === 'out_of_stock'
                ? 'bg-red-500/10 border-red-500'
                : 'bg-dark-800 border-dark-700 hover:border-red-500/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm text-gray-400">Out of Stock</p>
                <p className="text-2xl font-bold text-red-400 mt-1">
                  {statusCounts.out_of_stock}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by SKU, name, or description..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.category_id} value={category.category_id}>
                    {category.category_name} ({category.product_count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results count and active filters */}
          <div className="mt-3 flex items-center justify-between text-sm text-gray-400">
            <div className="flex items-center gap-3">
              <span>Showing {products.length} of {totalProducts} products</span>
              {selectedStatus && (
                <span className="px-2 py-1 bg-primary-500/10 text-primary-400 rounded-md text-xs">
                  Status: {selectedStatus.replace('_', ' ')}
                  <button 
                    onClick={() => setSelectedStatus('')}
                    className="ml-2 hover:text-primary-300"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <button className="inline-flex items-center text-primary-400 hover:text-primary-300 transition-colors">
              <Download className="w-4 h-4 mr-1" />
              Export
            </button>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-900 border-b border-dark-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
                        <span className="ml-3 text-gray-400">Loading products...</span>
                      </div>
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                      No products found
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr
                      key={product.product_id}
                      onClick={() => router.push(`/products/${product.product_id}`)}
                      className="hover:bg-dark-700 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-400">
                        {product.sku}
                      </td>
                      <td className="px-6 py-4 text-sm text-white">
                        <div className="max-w-xs truncate">{product.product_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {product.category_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {parseInt(product.total_stock).toLocaleString()} {product.base_uom}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStockStatusBadge(product.stock_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        ${parseFloat(product.standard_cost || '0').toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                        ${parseFloat(product.selling_price || '0').toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && products.length > 0 && (
            <div className="bg-dark-900 px-6 py-4 border-t border-dark-700 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center px-3 py-2 border border-dark-600 rounded-lg text-sm font-medium text-gray-300 bg-dark-800 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center px-3 py-2 border border-dark-600 rounded-lg text-sm font-medium text-gray-300 bg-dark-800 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
