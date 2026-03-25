'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Package, TrendingUp, AlertCircle, TruckIcon, ArrowRightLeft,
  Settings, Clock, Activity, RefreshCw, ChevronRight, Factory, 
  ShieldCheck, PlayCircle, GraduationCap, AlertOctagon, FileText, 
  ClipboardCheck, Users, CalendarDays, CheckCircle2, X
} from 'lucide-react';
import axios from 'axios';

interface DashboardStats {
  total_inventory_value: number;
  low_stock_products: number;
  out_of_stock_products: number;
  active_batches: number;
  pending_qa: number;
  today_output: number;
  pending_training: number;
  assigned_ncrs: number;
  qa_pending_batches: number;
  qa_pending_ipqc: number;
  pending_holidays: number;
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
  const { formatCurrency } = useSettings();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeBatches, setActiveBatches] = useState<ActiveBatch[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);

  // Holiday Modal State
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [pendingHolidays, setPendingHolidays] = useState<any[]>([]);
  const [processingHoliday, setProcessingHoliday] = useState(false);

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

      const [statsRes, activeProdRes, transactionsRes, alertsRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/stats`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/active-production`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/recent-transactions?limit=5`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/low-stock-alerts?limit=5`, { headers })
      ]);

      setStats(statsRes.data);
      setActiveBatches(activeProdRes.data);
      setRecentTransactions(transactionsRes.data);
      setLowStockAlerts(alertsRes.data);
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

  const handleOpenHolidayModal = async () => {
    setShowHolidayModal(true);
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users/holidays/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingHolidays(res.data);
    } catch (e) { console.error(e); }
  };

  const handleHolidayResponse = async (id: string, status: string) => {
    try {
      setProcessingHoliday(true);
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/users/holidays/${id}/respond`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingHolidays(prev => prev.filter(h => h.request_id !== id));
      await fetchDashboardData(); // Refresh counter on dashboard
    } catch (e) { console.error(e); } 
    finally { setProcessingHoliday(false); }
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

  // Reusable Clickable KPI Card
  const KPICard = ({ title, value, subtext, icon: Icon, colorClass, onClick, alert }: any) => (
    <div 
      onClick={onClick}
      className={`bg-dark-800 border ${alert ? `border-${colorClass}-500 shadow-[0_0_15px_rgba(0,0,0,0.2)] shadow-${colorClass}-500/20` : 'border-dark-700'} rounded-xl p-5 relative overflow-hidden group hover:border-${colorClass}-500/50 transition-all cursor-pointer`}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 bg-${colorClass}-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
          <h3 className={`text-3xl font-bold mb-1 ${alert ? `text-${colorClass}-400` : 'text-white'}`}>{value}</h3>
          <p className="text-gray-500 text-xs">{subtext}</p>
        </div>
        <div className={`p-3 rounded-lg bg-${colorClass}-500/10 text-${colorClass}-400 group-hover:bg-${colorClass}-500/20 transition-colors`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (authLoading || !isAuthenticated || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  const isQA = user?.role === 'qa';
  const isAdmin = user?.role === 'admin';

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8 max-w-[1600px] mx-auto pb-12">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Command Center</h1>
            <p className="text-gray-400 mt-1">Welcome back, {user?.full_name}. Your role is <span className="uppercase text-primary-400 font-bold">{user?.role}</span>.</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg text-white flex items-center gap-2 transition-colors disabled:opacity-50 font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary-400' : 'text-gray-400'}`} />
            Sync Data
          </button>
        </div>

        {/* 1. PERSONAL ACTION CENTER (Always visible to all users) */}
        {stats && (stats.pending_training > 0 || stats.assigned_ncrs > 0 || stats.pending_holidays > 0) && (
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> My Action Center
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {stats.pending_training > 0 && (
                <div onClick={() => router.push('/qms/training')} className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-blue-500/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-full text-blue-400"><GraduationCap className="w-6 h-6"/></div>
                    <div>
                      <p className="text-white font-bold text-lg">{stats.pending_training} Training Modules Due</p>
                      <p className="text-blue-400 text-sm">You have newly released QMS SOPs to read and sign.</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-blue-400" />
                </div>
              )}
              
              {stats.assigned_ncrs > 0 && (
                <div onClick={() => router.push('/qms/ncr')} className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-red-500/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/20 rounded-full text-red-400"><AlertOctagon className="w-6 h-6"/></div>
                    <div>
                      <p className="text-white font-bold text-lg">{stats.assigned_ncrs} NCRs Assigned to You</p>
                      <p className="text-red-400 text-sm">Root cause analysis or CAPA required.</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-red-400" />
                </div>
              )}

              {stats.pending_holidays > 0 && (
                <div onClick={handleOpenHolidayModal} className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-orange-500/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-500/20 rounded-full text-orange-400"><CalendarDays className="w-6 h-6"/></div>
                    <div>
                      <p className="text-white font-bold text-lg">{stats.pending_holidays} Holiday Requests</p>
                      <p className="text-orange-400 text-sm">Team members awaiting approval.</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-orange-400" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. DYNAMIC KPI GRID (Role Based) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isQA ? (
            <>
              <KPICard 
                title="Batches Awaiting Release" 
                value={stats?.qa_pending_batches ?? 0} 
                subtext="Final QA approval required" 
                icon={ShieldCheck} 
                colorClass="green" 
                alert={(stats?.qa_pending_batches ?? 0) > 0}
                onClick={() => router.push('/production')}
              />
              <KPICard 
                title="Pending IPQC Reviews" 
                value={stats?.qa_pending_ipqc ?? 0} 
                subtext="In-process checks awaiting sign-off" 
                icon={ClipboardCheck} 
                colorClass="blue" 
                alert={(stats?.qa_pending_ipqc ?? 0) > 0}
                onClick={() => router.push('/production')}
              />
              <KPICard 
                title="Today's Output" 
                value={stats?.today_output?.toLocaleString() ?? 0} 
                subtext="Bottles produced today" 
                icon={Factory} 
                colorClass="purple" 
                onClick={() => router.push('/production')}
              />
              <KPICard 
                title="Low Stock Alerts" 
                value={stats?.low_stock_products ?? 0} 
                subtext={`${stats?.out_of_stock_products ?? 0} critical shortages`} 
                icon={AlertCircle} 
                colorClass="red" 
                alert={(stats?.low_stock_products ?? 0) > 0}
                onClick={() => router.push('/inventory')}
              />
            </>
          ) : (
            <>
              <KPICard 
                title="Total Inventory Value" 
                value={formatCurrency(stats?.total_inventory_value ?? 0, 'USD')} 
                subtext="Current warehouse valuation" 
                icon={TrendingUp} 
                colorClass="green" 
                onClick={() => router.push('/inventory')}
              />
              <KPICard 
                title="Today's Output" 
                value={stats?.today_output?.toLocaleString() ?? 0} 
                subtext="Bottles produced today" 
                icon={Factory} 
                colorClass="blue" 
                onClick={() => router.push('/production')}
              />
              <KPICard 
                title="Active Batches" 
                value={stats?.active_batches ?? 0} 
                subtext="Currently running on factory floor" 
                icon={Activity} 
                colorClass="purple" 
                onClick={() => router.push('/production')}
              />
              <KPICard 
                title="Low Stock Alerts" 
                value={stats?.low_stock_products ?? 0} 
                subtext={`${stats?.out_of_stock_products ?? 0} completely out of stock`} 
                icon={AlertCircle} 
                colorClass="red" 
                alert={(stats?.low_stock_products ?? 0) > 0}
                onClick={() => router.push('/inventory')}
              />
            </>
          )}
        </div>

        {/* 3. MIDDLE SPLIT: PRODUCTION VS QUICK ACTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Live Production Board (Takes 2/3 width) */}
          <div className="lg:col-span-2 bg-dark-800 border border-dark-700 rounded-xl p-6 flex flex-col shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                Live Production Board
              </h2>
              <button onClick={() => router.push('/production')} className="text-sm text-primary-400 hover:text-primary-300 flex items-center bg-primary-500/10 px-3 py-1 rounded-lg">
                Full Schedule <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {activeBatches.length === 0 ? (
                <div className="md:col-span-2 text-center py-12 border-2 border-dashed border-dark-700 rounded-xl">
                  <Factory className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No active batches</p>
                  <p className="text-xs text-gray-500">All production lines are currently idle.</p>
                </div>
              ) : (
                activeBatches.map((batch) => {
                  const style = getBatchStatusStyle(batch.status);
                  const progress = batch.status === 'in_progress' ? 50 : batch.status === 'awaiting_qa' ? 90 : batch.status === 'completed' ? 100 : 10;
                  
                  return (
                    <div key={batch.batch_id} onClick={() => router.push(`/production/${batch.batch_id}`)} className="p-5 bg-dark-900 border border-dark-700 rounded-xl hover:border-primary-500/50 cursor-pointer transition-colors shadow-inner">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-white font-bold text-lg">{batch.batch_number}</p>
                          <p className="text-sm text-gray-400">{batch.product_name}</p>
                        </div>
                        <div className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 border ${style.bg.replace('/10', '/20')} ${style.text} ${style.bg}`}>
                          {style.pulse && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>}
                          {batch.status.replace('_', ' ').toUpperCase()}
                        </div>
                      </div>
                      <div className="mt-auto">
                        <div className="flex justify-between text-sm text-gray-400 mb-2">
                          <span>Output Progress</span>
                          <span className="font-mono text-white">{batch.actual_output || 0} / {batch.planned_quantity}</span>
                        </div>
                        <div className="w-full bg-dark-950 rounded-full h-2 border border-dark-600 overflow-hidden">
                          <div className={`h-full rounded-full ${style.bg.replace('/10', '')} transition-all duration-1000`} style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Actions Panel (Tailored by Role) */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-400" />
              Quick Actions
            </h2>
            
            <div className="space-y-3">
              {/* QA ACTIONS */}
              {(isQA || isAdmin) && (
                <>
                  <button onClick={() => router.push('/qms/documents')} className="w-full p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl font-medium transition-colors flex items-center gap-3">
                    <FileText className="w-5 h-5" /> Master Document Register
                  </button>
                  <button onClick={() => router.push('/qms/ncr')} className="w-full p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl font-medium transition-colors flex items-center gap-3">
                    <AlertOctagon className="w-5 h-5" /> Open NCR Register
                  </button>
                </>
              )}

              {/* STANDARD OPERATIONS ACTIONS */}
              {(!isQA || isAdmin) && (
                <>
                  <button onClick={() => router.push('/production')} className="w-full p-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors flex items-center gap-3 shadow-lg shadow-primary-500/20">
                    <PlayCircle className="w-5 h-5" /> New Production Batch
                  </button>
                  <button onClick={() => router.push('/inventory?action=receive')} className="w-full p-4 bg-dark-900 hover:bg-dark-700 border border-dark-600 text-white rounded-xl transition-colors flex items-center gap-3">
                    <TruckIcon className="w-5 h-5 text-green-400" /> Receive Shipment (GRN)
                  </button>
                  <button onClick={() => router.push('/inventory?action=issue')} className="w-full p-4 bg-dark-900 hover:bg-dark-700 border border-dark-600 text-white rounded-xl transition-colors flex items-center gap-3">
                    <Package className="w-5 h-5 text-blue-400" /> Issue to Production Line
                  </button>
                </>
              )}
              
              {/* VENDOR/SALES ACTIONS */}
              <button onClick={() => router.push('/vendor-management/suppliers')} className="w-full p-4 bg-dark-900 hover:bg-dark-700 border border-dark-600 text-white rounded-xl transition-colors flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-400" /> Approved Vendor List
              </button>
            </div>
          </div>
          
        </div>

        {/* 4. BOTTOM LISTS (Low Stock & Transactions) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low Stock Alerts */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" /> Critical Inventory Alerts
              </h2>
            </div>
            <div className="space-y-2">
              {lowStockAlerts.length === 0 ? (
                <p className="text-gray-400 text-center py-4 text-sm">Inventory levels are healthy.</p>
              ) : (
                lowStockAlerts.map((alert) => (
                  <div key={alert.product_id} className="flex items-center justify-between p-3 bg-dark-900 border border-dark-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-10 rounded-full ${alert.urgency === 'critical' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                      <div>
                        <p className="text-sm font-medium text-white">{alert.product_name}</p>
                        <p className="text-xs text-gray-400">{alert.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-base font-bold font-mono ${alert.urgency === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {alert.total_stock}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Min: {alert.reorder_level}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-400" /> Recent Stock Movements
            </h2>
            <div className="space-y-2">
              {recentTransactions.length === 0 ? (
                <p className="text-gray-400 text-center py-4 text-sm">No recent transactions</p>
              ) : (
                recentTransactions.map((txn) => (
                  <div key={txn.transaction_id} className="flex items-center gap-4 p-3 bg-dark-900 border border-dark-700 rounded-lg">
                    <div className={`px-2 py-1.5 rounded text-[10px] font-bold border w-20 text-center tracking-wider uppercase ${getTransactionTypeColor(txn.transaction_type)}`}>
                      {txn.transaction_type}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white line-clamp-1">{txn.product_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">
                        {txn.quantity} {txn.uom} {txn.from_location ? `← ${txn.from_location}` : ''} {txn.to_location ? `→ ${txn.to_location}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap hidden sm:block">
                      {new Date(txn.transaction_date).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* HOLIDAY APPROVAL MODAL */}
      {showHolidayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-start pt-20">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-900/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-orange-400"/> Pending Holiday Approvals
              </h2>
              <button onClick={() => setShowHolidayModal(false)} className="text-gray-400 hover:text-white"><X className="w-6 h-6"/></button>
            </div>
            <div className="p-6">
               {pendingHolidays.map(req => (
                  <div key={req.request_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-dark-900 border border-dark-700 rounded-lg mb-3 gap-4">
                     <div>
                       <p className="text-white font-bold text-lg">{req.full_name}</p>
                       <p className="text-sm text-gray-400">{req.department || 'No Dept'} • <span className="text-orange-400 font-bold">Requested {req.days_requested} days</span></p>
                       <p className="text-sm text-gray-300 mt-1 bg-dark-950 px-3 py-1 rounded inline-block border border-dark-600">
                         {new Date(req.start_date).toLocaleDateString()} to {new Date(req.end_date).toLocaleDateString()}
                       </p>
                     </div>
                     <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => handleHolidayResponse(req.request_id, 'Declined')} disabled={processingHoliday} className="flex-1 sm:flex-none px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors font-medium border border-red-500/20 disabled:opacity-50">
                          Decline
                        </button>
                        <button onClick={() => handleHolidayResponse(req.request_id, 'Approved')} disabled={processingHoliday} className="flex-1 sm:flex-none px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 disabled:opacity-50">
                          <CheckCircle2 className="w-4 h-4"/> Approve
                        </button>
                     </div>
                  </div>
               ))}
               {pendingHolidays.length === 0 && (
                 <div className="text-center py-12">
                   <CheckCircle2 className="w-12 h-12 text-green-500/50 mx-auto mb-3" />
                   <p className="text-white font-bold text-lg">All caught up!</p>
                   <p className="text-gray-400">There are no pending holiday requests.</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}