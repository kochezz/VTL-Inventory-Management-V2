'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Package, 
  TrendingUp, 
  AlertCircle, 
  Users,
  TruckIcon,
  ArrowRightLeft,
  Settings,
  Clock,
  MapPin,
  Activity,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import axios from 'axios';

interface DashboardStats {
  total_products: number;
  in_stock_products: number;
  low_stock_products: number;
  out_of_stock_products: number;
  total_inventory_value: number;
  total_inventory_units: number;
  active_users: number;
  today_transactions: number;
  monthly_transactions: number;
  transaction_change_percent: number;
}

interface RecentTransaction {
  transaction_id: string;
  transaction_number: string;
  transaction_date: string;
  transaction_type: string;
  transaction_type_display: string;
  sku: string;
  product_name: string;
  quantity: number;
  uom: string;
  from_location: string | null;
  to_location: string | null;
  performed_by: string;
}

interface LowStockAlert {
  product_id: string;
  sku: string;
  product_name: string;
  category_name: string;
  total_stock: number;
  reorder_level: number;
  base_uom: string;
  urgency: 'critical' | 'low';
}

interface LocationStock {
  location_code: string;
  location_name: string;
  location_type: string;
  product_count: number;
  total_units: number;
  total_value: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, token, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [locationStock, setLocationStock] = useState<LocationStock[]>([]);

  // FIXED: Check authentication after loading is complete
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!authLoading && isAuthenticated) {
      fetchDashboardData();
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchDashboardData = async () => {
    if (!token) return;

    try {
      setLoading(true);

      const headers = { Authorization: `Bearer ${token}` };

      // Fetch all dashboard data in parallel
      const [statsRes, transactionsRes, alertsRes, locationsRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/stats`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/recent-transactions?limit=5`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/low-stock-alerts?limit=5`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/stock-by-location`, { headers })
      ]);

      setStats(statsRes.data);
      setRecentTransactions(transactionsRes.data);
      setLowStockAlerts(alertsRes.data);
      setLocationStock(locationsRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    }
  };

  const getTransactionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'receive': 'bg-green-500/10 text-green-400 border-green-500/20',
      'issue': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'transfer': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'adjustment': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'return': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      'damage': 'bg-red-500/10 text-red-400 border-red-500/20'
    };
    return colors[type] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  // FIXED: Show loading state while auth is loading
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Checking authentication...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // FIXED: Return null only after auth check is complete
  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const statCards = [
    {
      name: 'Total Products',
      value: stats?.total_products.toLocaleString() || '0',
      icon: Package,
      description: `${stats?.in_stock_products} in stock`,
      trend: null,
      color: 'blue'
    },
    {
      name: 'Low Stock Items',
      value: stats?.low_stock_products.toLocaleString() || '0',
      icon: AlertCircle,
      description: `${stats?.out_of_stock_products} out of stock`,
      trend: null,
      color: 'red'
    },
    {
      name: 'Total Value',
      value: formatCurrency(stats?.total_inventory_value || 0),
      icon: TrendingUp,
      description: `${stats?.total_inventory_units.toLocaleString()} total units`,
      trend: null,
      color: 'green'
    },
    {
      name: 'Transactions',
      value: stats?.monthly_transactions.toLocaleString() || '0',
      icon: Activity,
      description: `${stats?.today_transactions} today`,
      trend: stats?.transaction_change_percent || 0,
      color: 'purple'
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Welcome back, {user?.full_name}!
            </h1>
            <p className="text-gray-400 mt-1">
              Here's what's happening with your inventory today.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg text-white flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.name}
                className="bg-dark-800 border border-dark-700 rounded-xl p-6 hover:border-primary-500/50 transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 bg-${stat.color}-500/10 rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 text-${stat.color}-400`} />
                  </div>
                  {stat.trend !== null && (
                    <span className={`text-sm font-medium ${stat.trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {stat.trend >= 0 ? '+' : ''}{stat.trend}%
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-1">{stat.name}</p>
                <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.description}</p>
              </div>
            );
          })}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-400" />
                Recent Activity
              </h2>
              <button
                onClick={() => router.push('/inventory')}
                className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {recentTransactions.length === 0 ? (
                <p className="text-gray-400 text-center py-8 text-sm">
                  No recent transactions
                </p>
              ) : (
                recentTransactions.map((txn) => (
                  <div
                    key={txn.transaction_id}
                    className="flex items-start gap-3 p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors"
                  >
                    <div className={`mt-1 px-2 py-1 rounded text-xs font-medium border ${getTransactionTypeColor(txn.transaction_type)}`}>
                      {txn.transaction_type.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {txn.product_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {txn.quantity} {txn.uom}
                        {txn.from_location && ` from ${txn.from_location}`}
                        {txn.to_location && ` to ${txn.to_location}`}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(txn.transaction_date)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                Low Stock Alerts
              </h2>
              <button
                onClick={() => router.push('/products?filter=low_stock')}
                className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {lowStockAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Package className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-gray-400 text-sm">All products in stock!</p>
                </div>
              ) : (
                lowStockAlerts.map((alert) => (
                  <div
                    key={alert.product_id}
                    className="flex items-center justify-between p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${alert.urgency === 'critical' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                        <p className="text-sm font-medium text-white truncate">
                          {alert.product_name}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 ml-4">
                        {alert.sku} • {alert.category_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${alert.urgency === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {alert.total_stock}
                      </p>
                      <p className="text-xs text-gray-500">
                        / {alert.reorder_level} {alert.base_uom}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Stock by Location */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary-400" />
            Stock Distribution by Location
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {locationStock.map((location) => (
              <div
                key={location.location_code}
                className="p-4 bg-dark-700 rounded-lg border border-dark-600 hover:border-primary-500/50 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-white">{location.location_code}</p>
                    <p className="text-xs text-gray-400">{location.location_name}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-primary-500/10 text-primary-400 rounded">
                    {location.location_type}
                  </span>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Products:</span>
                    <span className="text-white font-medium">{location.product_count}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Units:</span>
                    <span className="text-white font-medium">{location.total_units?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Value:</span>
                    <span className="text-white font-medium">{formatCurrency(location.total_value || 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/inventory?action=receive')}
              className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <TruckIcon className="w-5 h-5" />
              Receive Inventory
            </button>
            <button
              onClick={() => router.push('/inventory?action=issue')}
              className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Package className="w-5 h-5" />
              Issue to Production
            </button>
            <button
              onClick={() => router.push('/inventory?action=transfer')}
              className="px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ArrowRightLeft className="w-5 h-5" />
              Transfer Stock
            </button>
            <button
              onClick={() => router.push('/inventory?action=adjust')}
              className="px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Settings className="w-5 h-5" />
              Adjust Inventory
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
