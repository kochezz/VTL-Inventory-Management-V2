'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Package, 
  TrendingUp, 
  AlertCircle, 
  TruckIcon,
  ArrowRightLeft,
  Settings,
  Clock,
  MapPin,
  Activity,
  RefreshCw,
  ChevronRight,
  Factory,
  ShieldCheck,
  PlayCircle
} from 'lucide-react';
import axios from 'axios';

interface DashboardStats {
  total_inventory_value: number;
  low_stock_products: number;
  out_of_stock_products: number;
  active_batches: number;
  pending_qa: number;
  today_output: number;
}

interface ActiveBatch {
  batch_id: string;
  batch_number: string;
  product_name: string;
  status: string;
  planned_quantity: number;
  actual_output: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, token, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeBatches, setActiveBatches] = useState<ActiveBatch[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
  const [locationStock, setLocationStock] = useState<any[]>([]);

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

      const [statsRes, activeProdRes, transactionsRes, alertsRes, locationsRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/stats`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/active-production`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/recent-transactions?limit=5`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/low-stock-alerts?limit=5`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/stock-by-location`, { headers })
      ]);

      setStats(statsRes.data);
      setActiveBatches(activeProdRes.data);
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
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  };

  const getTransactionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'receive': 'bg-green-500/10 text-green-400 border-green-500/20',
      'issue': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'transfer': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'adjustment': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    };
    return colors[type] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  const getBatchStatusStyle = (status: string) => {
    switch (status) {
      case 'in_progress': return { bg: 'bg-blue-500/10', text: 'text-blue-400', pulse: true };
      case 'awaiting_qa': return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', pulse: false };
      case 'ready_for_setup': return { bg: 'bg-purple-500/10', text: 'text-purple-400', pulse: false };
      case 'completed': return { bg: 'bg-green-500/10', text: 'text-green-400', pulse: false };
      default: return { bg: 'bg-gray-500/10', text: 'text-gray-400', pulse: false };
    }
  };

  // Reusable KPI Card (Matched to Analytics styling)
  const KPICard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 relative overflow-hidden group hover:border-primary-500/50 transition-colors">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-${colorClass}-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
          <p className="text-gray-500 text-xs">{subtext}</p>
        </div>
        <div className={`p-3 rounded-lg bg-${colorClass}-500/10 text-${colorClass}-400`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (authLoading || !isAuthenticated || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Command Center</h1>
            <p className="text-gray-400 mt-1">Welcome back, {user?.full_name}. Here is your live operational overview.</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-white flex items-center gap-2 transition-colors disabled:opacity-50 font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>

        {/* 1. TOP KPI GRID (Mix of Inventory & Production) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard 
            title="Total Inventory Value" 
            value={formatCurrency(stats?.total_inventory_value || 0)} 
            subtext="Current warehouse valuation" 
            icon={TrendingUp} colorClass="green" 
          />
          <KPICard 
            title="Today's Output" 
            value={(stats?.today_output || 0).toLocaleString()} 
            subtext="Bottles produced today" 
            icon={Factory} colorClass="blue" 
          />
          <KPICard 
            title="Pending QA Actions" 
            value={stats?.pending_qa || 0} 
            subtext="Batches awaiting review" 
            icon={ShieldCheck} colorClass="yellow" 
          />
          <KPICard 
            title="Low Stock Alerts" 
            value={stats?.low_stock_products || 0} 
            subtext={`${stats?.out_of_stock_products || 0} items completely out of stock`} 
            icon={AlertCircle} colorClass="red" 
          />
        </div>

        {/* 2. MIDDLE SPLIT: PRODUCTION VS INVENTORY ALERTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Active Production Board */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                Live Production Board
              </h2>
              <button onClick={() => router.push('/production')} className="text-sm text-primary-400 hover:text-primary-300 flex items-center">
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
            
            <div className="space-y-3 flex-1">
              {activeBatches.length === 0 ? (
                <div className="text-center py-10">
                  <Factory className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No active batches</p>
                  <p className="text-xs text-gray-500">All production lines are currently idle.</p>
                </div>
              ) : (
                activeBatches.map((batch) => {
                  const style = getBatchStatusStyle(batch.status);
                  const progress = batch.status === 'in_progress' ? 50 : batch.status === 'awaiting_qa' ? 90 : batch.status === 'completed' ? 100 : 10;
                  
                  return (
                    <div key={batch.batch_id} onClick={() => router.push(`/production/${batch.batch_id}`)} className="p-4 bg-dark-900 border border-dark-700 rounded-lg hover:border-primary-500/50 cursor-pointer transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-white font-medium">{batch.batch_number}</p>
                          <p className="text-xs text-gray-400">{batch.product_name}</p>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 ${style.bg} ${style.text}`}>
                          {style.pulse && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>}
                          {batch.status.replace('_', ' ').toUpperCase()}
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span>{batch.actual_output || 0} / {batch.planned_quantity} units</span>
                        </div>
                        <div className="w-full bg-dark-800 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${style.bg.replace('/10', '')}`} style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                Critical Inventory Alerts
              </h2>
              <button onClick={() => router.push('/products?filter=low_stock')} className="text-sm text-primary-400 hover:text-primary-300 flex items-center">
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
            <div className="space-y-3 flex-1">
              {lowStockAlerts.length === 0 ? (
                <div className="text-center py-10">
                  <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">All systems normal</p>
                  <p className="text-xs text-gray-500">No components are currently below minimum thresholds.</p>
                </div>
              ) : (
                lowStockAlerts.map((alert) => (
                  <div key={alert.product_id} className="flex items-center justify-between p-4 bg-dark-900 border border-dark-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-10 rounded-full ${alert.urgency === 'critical' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                      <div>
                        <p className="text-sm font-medium text-white">{alert.product_name}</p>
                        <p className="text-xs text-gray-400">{alert.sku} • {alert.category_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${alert.urgency === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {alert.total_stock}
                      </p>
                      <p className="text-xs text-gray-500">Min: {alert.reorder_level} {alert.base_uom}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 3. WAREHOUSING & QUICK ACTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-dark-800 border border-dark-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-400" />
              Recent Inventory Flow
            </h2>
            <div className="space-y-2">
              {recentTransactions.length === 0 ? (
                <p className="text-gray-400 text-center py-4 text-sm">No recent transactions</p>
              ) : (
                recentTransactions.map((txn) => (
                  <div key={txn.transaction_id} className="flex items-center gap-4 p-3 bg-dark-900 rounded-lg">
                    <div className={`px-2 py-1 rounded text-xs font-bold border w-24 text-center ${getTransactionTypeColor(txn.transaction_type)}`}>
                      {txn.transaction_type.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{txn.product_name}</p>
                      <p className="text-xs text-gray-400">
                        {txn.quantity} {txn.uom} • {txn.from_location ? `From ${txn.from_location}` : ''} {txn.to_location ? `To ${txn.to_location}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(txn.transaction_date).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button onClick={() => router.push('/production')} className="w-full p-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors flex items-center gap-3">
                <PlayCircle className="w-5 h-5" />
                New Production Batch
              </button>
              <button onClick={() => router.push('/inventory?action=receive')} className="w-full p-3 bg-dark-900 hover:bg-dark-700 border border-dark-600 text-white rounded-xl transition-colors flex items-center gap-3">
                <TruckIcon className="w-4 h-4 text-green-400" />
                <span className="text-sm">Receive Shipment</span>
              </button>
              <button onClick={() => router.push('/inventory?action=issue')} className="w-full p-3 bg-dark-900 hover:bg-dark-700 border border-dark-600 text-white rounded-xl transition-colors flex items-center gap-3">
                <Package className="w-4 h-4 text-blue-400" />
                <span className="text-sm">Issue to Line</span>
              </button>
              <button onClick={() => router.push('/inventory?action=transfer')} className="w-full p-3 bg-dark-900 hover:bg-dark-700 border border-dark-600 text-white rounded-xl transition-colors flex items-center gap-3">
                <ArrowRightLeft className="w-4 h-4 text-purple-400" />
                <span className="text-sm">Transfer Stock</span>
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </DashboardLayout>
  );
}