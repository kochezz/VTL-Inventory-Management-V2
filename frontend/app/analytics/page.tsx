'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  TrendingUp, TrendingDown, Activity, RefreshCw, Package, Factory, 
  ShieldCheck, AlertOctagon, Users, ShoppingCart, Building2, Clock, 
  DollarSign, Layers // <-- Added Layers back here!
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';

export default function AnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { formatCurrency } = useSettings(); // Pulling global currency setting
  
  const [timeRange, setTimeRange] = useState('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'production' | 'inventory' | 'quality' | 'crm' | 'srm'>('overview');

  const [liveMetrics, setLiveMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Fetch live metrics whenever the timeRange changes
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (isAuthenticated) {
      fetchLiveMetrics();
    }
  }, [authLoading, isAuthenticated, router, timeRange]);

  const fetchLiveMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const response = await api.get(`/analytics/dashboard?timeRange=${timeRange}`);
      setLiveMetrics(response.data.data);
    } catch (error) {
      console.error('Failed to fetch live metrics', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  if (authLoading || !isAuthenticated) return null;

  const CHART_COLORS = {
    blue: '#3b82f6', purple: '#8b5cf6', green: '#10b981', yellow: '#f59e0b',
    orange: '#f97316', red: '#ef4444', teal: '#14b8a6', gray: '#6b7280', amber: '#f59e0b'
  };

  const getTierColor = (tierName: string) => {
    switch (tierName) {
      case 'Corporate': return CHART_COLORS.amber;
      case 'Chain': return CHART_COLORS.purple;
      case 'Wholesale': return CHART_COLORS.blue;
      case 'Kantemba': return CHART_COLORS.gray;
      default: return CHART_COLORS.teal;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-900 border border-dark-700 p-3 rounded-lg shadow-xl">
          <p className="text-white font-medium mb-2 border-b border-dark-700 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-3 justify-between text-sm py-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                <span className="text-gray-300">{entry.name}</span>
              </div>
              <span className="text-white font-semibold">
                {entry.name.includes('Spend') || entry.name.includes('Value') 
                  ? formatCurrency(parseFloat(entry.value))
                  : entry.value.toLocaleString()}
                {entry.name === 'yield' || entry.name === 'accuracy' ? '%' : ''}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const KPICard = ({ title, value, subtext, trend, icon: Icon, colorClass, loading = false, prefix = '' }: any) => (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-${colorClass}-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-dark-700 animate-pulse rounded mb-1"></div>
          ) : (
            <h3 className="text-3xl font-bold text-white mb-1">
              {prefix}<span className="font-mono">{value}</span>
            </h3>
          )}
          <div className="flex items-center gap-2">
            {trend !== undefined && (
              <span className={`flex items-center text-xs font-semibold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {trend >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {Math.abs(trend)}%
              </span>
            )}
            <span className="text-gray-500 text-xs">{subtext}</span>
          </div>
        </div>
        <div className={`p-3 rounded-lg bg-${colorClass}-500/10 text-${colorClass}-400`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Business Intelligence</h1>
            <p className="text-gray-400 mt-1">Real-time financial and operational health</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-dark-800 border border-dark-700 text-white text-sm rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">This Quarter</option>
              <option value="1y">YTD</option>
              <option value="all">All Time</option>
            </select>
            <button onClick={fetchLiveMetrics} className="p-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
              <RefreshCw className={`w-5 h-5 ${loadingMetrics ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-dark-700 overflow-x-auto hide-scrollbar">
          {[
            { id: 'overview', label: 'Executive Overview', icon: Activity },
            { id: 'crm', label: 'Customers (CRM)', icon: Users },
            { id: 'srm', label: 'Procurement (SRM)', icon: ShoppingCart },
            { id: 'production', label: 'Production', icon: Factory },
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'quality', label: 'Quality (QMS)', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'border-primary-500 text-white' 
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-dark-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: EXECUTIVE OVERVIEW */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard 
                title="Active Customers" 
                value={liveMetrics?.crm?.totalActive || 0} 
                subtext="Trading partners" 
                icon={Users} colorClass="blue" loading={loadingMetrics} 
              />
              <KPICard 
                title="Active Suppliers" 
                value={liveMetrics?.srm?.totalActive || 0} 
                subtext="Approved on AVL" 
                icon={Building2} colorClass="purple" loading={loadingMetrics} 
              />
              <KPICard 
                title="Locked Cashflow" 
                value={formatCurrency(parseFloat(liveMetrics?.overview?.lockedCashflow || 0))} 
                subtext="Capital in Inventory" 
                icon={DollarSign} colorClass="green" loading={loadingMetrics} 
              />
              <KPICard 
                title="Pending Approvals" 
                value={liveMetrics?.overview?.pendingApprovals || 0} 
                subtext="Requiring CFO/CEO Action" 
                icon={Clock} colorClass="orange" loading={loadingMetrics} 
              />
            </div>

            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Production Volume vs. Yield Trend</h3>
                  <p className="text-sm text-gray-400">Daily breakdown by SKU and overall efficiency</p>
                </div>
              </div>
              <div className="h-[400px]">
                {liveMetrics?.production?.trendData?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={liveMetrics.production.trendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" domain={[95, 100]} stroke="#10b981" tick={{ fill: '#10b981' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#374151', opacity: 0.4 }} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar yAxisId="left" dataKey="500ml" name="FreshDrip 500ml" stackId="a" fill={CHART_COLORS.blue} radius={[0, 0, 4, 4]} />
                      <Bar yAxisId="left" dataKey="750ml" name="FreshDrip 750ml" stackId="a" fill={CHART_COLORS.purple} />
                      <Bar yAxisId="left" dataKey="5Gal" name="5-Gallon (New & Refill)" stackId="a" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="yield" name="Yield %" stroke={CHART_COLORS.green} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 italic">No production data for this period</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CRM */}
        {/* ========================================================================= */}
        {activeTab === 'crm' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KPICard title="Active Customers" value={liveMetrics?.crm?.totalActive || 0} subtext="Trading Accounts" icon={Users} colorClass="blue" loading={loadingMetrics} />
              <KPICard title="Pending Onboarding" value={liveMetrics?.crm?.pendingApproval || 0} subtext="Awaiting CFO Approval" icon={Clock} colorClass="orange" loading={loadingMetrics} />
              <KPICard title="Avg Onboarding Time" value="2.4 Days" subtext="Submission to Active" icon={TrendingDown} colorClass="green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-1">Customer Tier Distribution</h3>
                <p className="text-sm text-gray-400 mb-2">Breakdown of active accounts by tier</p>
                {liveMetrics?.crm?.byTier?.length > 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={liveMetrics.crm.byTier} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value" stroke="none"
                        >
                          {liveMetrics.crm.byTier.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={getTierColor(entry.name)} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} content={(props) => (
                          <ul className="flex flex-wrap justify-center gap-4 text-sm mt-4">
                            {props.payload?.map((entry, index) => (
                              <li key={`item-${index}`} className="flex items-center gap-2 text-gray-300">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                {entry.value} ({liveMetrics.crm.byTier[index].value})
                              </li>
                            ))}
                          </ul>
                        )}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500 italic">No active customer data.</div>
                )}
              </div>
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Sales Rep Leaderboard</h3>
                <div className="flex items-center justify-center h-48 border-2 border-dashed border-dark-700 rounded-lg text-gray-500 text-sm">
                  Detailed rep tracking metrics incoming...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SRM */}
        {/* ========================================================================= */}
        {activeTab === 'srm' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KPICard title="Approved Suppliers" value={liveMetrics?.srm?.totalActive || 0} subtext="Active on AVL" icon={Building2} colorClass="purple" loading={loadingMetrics} />
              <KPICard title="Pending POs" value={liveMetrics?.srm?.pendingApprovals?.reduce((sum: number, po: any) => sum + parseInt(po.count), 0) || 0} subtext="Awaiting Approvals" icon={Clock} colorClass="orange" loading={loadingMetrics} />
              <KPICard title="Compliance Alerts" value="0" subtext="Expiring certificates" icon={AlertOctagon} colorClass="red" />
            </div>

            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-1">Approved PO Spend by Currency</h3>
              <p className="text-sm text-gray-400 mb-6">Total financial commitment broken down by currency</p>
              {liveMetrics?.srm?.spendByCurrency?.length > 0 ? (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={liveMetrics.srm.spendByCurrency} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="currency" stroke="#9CA3AF" tickLine={false} axisLine={false} />
                      <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#374151', opacity: 0.2 }} />
                      <Legend />
                      <Bar dataKey="total_spend" name="Total Spend Value" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500 italic">No approved PO spend data.</div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PRODUCTION (Now with Financials) */}
        {/* ========================================================================= */}
        {activeTab === 'production' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KPICard title="Total Output" value={parseFloat(liveMetrics?.production?.kpis?.totalOutput || 0).toLocaleString()} subtext="Units Produced" icon={Factory} colorClass="blue" loading={loadingMetrics} />
              <KPICard title="Average Yield" value={`${liveMetrics?.production?.kpis?.avgYield || 0}%`} subtext="Overall Efficiency" icon={Activity} colorClass="green" loading={loadingMetrics} />
              <KPICard title="Production Value" value={formatCurrency(parseFloat(liveMetrics?.production?.kpis?.totalValue || 0))} subtext="Estimated Output Value" icon={DollarSign} colorClass="purple" loading={loadingMetrics} />
            </div>
             <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-1">Production Output Volume</h3>
                <p className="text-sm text-gray-400 mb-6">Units produced over time</p>
                <div className="h-[300px]">
                  {liveMetrics?.production?.trendData?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={liveMetrics.production.trendData}>
                        <defs>
                          <linearGradient id="color500" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis dataKey="date" stroke="#9CA3AF" tickLine={false} axisLine={false} />
                        <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="500ml" stroke={CHART_COLORS.blue} fillOpacity={1} fill="url(#color500)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 italic">No production data available.</div>
                  )}
                </div>
              </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: INVENTORY (Now with Locked Cashflow) */}
        {/* ========================================================================= */}
        {activeTab === 'inventory' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KPICard title="Locked Cashflow" value={formatCurrency(parseFloat(liveMetrics?.inventory?.kpis?.totalValue || 0))} subtext="Value of Inventory on Hand" icon={DollarSign} colorClass="green" loading={loadingMetrics} />
              <KPICard title="Total Units" value={parseFloat(liveMetrics?.inventory?.kpis?.totalItems || 0).toLocaleString()} subtext="Physical Stock Count" icon={Package} colorClass="blue" loading={loadingMetrics} />
              <KPICard title="Total SKUs" value={liveMetrics?.inventory?.kpis?.totalSkus || 0} subtext="Unique items managed" icon={Layers} colorClass="orange" loading={loadingMetrics} />
            </div>
           <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
             <h3 className="text-lg font-bold text-white mb-6">Warehouse Capacity Utilization</h3>
             <div className="space-y-6">
               {liveMetrics?.inventory?.warehouseUtilization?.map((zone: any, index: number) => (
                 <div key={index}>
                   <div className="flex justify-between items-end mb-2">
                     <span className="text-sm font-medium text-gray-300">{zone.name}</span>
                     <span className="text-sm font-bold" style={{ color: zone.color }}>{zone.used}%</span>
                   </div>
                   <div className="w-full bg-dark-900 rounded-full h-3">
                     <div 
                       className="h-3 rounded-full transition-all duration-1000" 
                       style={{ width: `${zone.used}%`, backgroundColor: zone.color }}
                     ></div>
                   </div>
                 </div>
               ))}
             </div>
           </div>
         </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: QUALITY */}
        {/* ========================================================================= */}
        {activeTab === 'quality' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-1">QA Release Approval Timeline</h3>
                <p className="text-sm text-gray-400 mb-6">Trailing 7-day acceptance accuracy</p>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={liveMetrics?.quality?.accuracyTrend || []} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="day" stroke="#9CA3AF" tickLine={false} axisLine={false} />
                      <YAxis domain={[95, 100]} stroke="#9CA3AF" tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" dataKey="accuracy" name="Approval Accuracy"
                        stroke={CHART_COLORS.blue} strokeWidth={4}
                        dot={{ fill: CHART_COLORS.blue, r: 6, strokeWidth: 0 }}
                        activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}