'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Package,
  Factory,
  ShieldCheck,
  AlertOctagon,
  Calendar,
  BarChart3,
  Layers,
  Droplets
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';

export default function AnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { formatCurrency } = useSettings();
  
  const [timeRange, setTimeRange] = useState('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'production' | 'inventory' | 'quality'>('overview');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) return null;

  // ==========================================
  // REALISTIC MOCK DATA (Tailored to Vilagio)
  // ==========================================

  const CHART_COLORS = {
    blue: '#3b82f6',
    purple: '#8b5cf6',
    green: '#10b981',
    yellow: '#f59e0b',
    orange: '#f97316',
    red: '#ef4444',
    teal: '#14b8a6',
    gray: '#6b7280'
  };

  // Production Volume vs Yield (Composed Chart)
  const productionOutputData = [
    { date: 'Mon', '500ml': 12000, '750ml': 8500, '5Gal': 800, yield: 98.2 },
    { date: 'Tue', '500ml': 14500, '750ml': 9200, '5Gal': 950, yield: 98.5 },
    { date: 'Wed', '500ml': 13200, '750ml': 8800, '5Gal': 850, yield: 97.8 },
    { date: 'Thu', '500ml': 15000, '750ml': 10500, '5Gal': 1100, yield: 99.1 },
    { date: 'Fri', '500ml': 16500, '750ml': 11200, '5Gal': 1250, yield: 99.3 },
    { date: 'Sat', '500ml': 11000, '750ml': 7500, '5Gal': 600, yield: 98.9 },
    { date: 'Sun', '500ml': 8500, '750ml': 5000, '5Gal': 400, yield: 99.5 },
  ];

  // Rejection Breakdown (Donut)
  const rejectionData = [
    { name: 'Underfill', value: 45, color: CHART_COLORS.orange },
    { name: 'Cap Defect', value: 30, color: CHART_COLORS.yellow },
    { name: 'Label Defect', value: 25, color: CHART_COLORS.purple },
    { name: 'Damaged', value: 15, color: CHART_COLORS.red },
    { name: 'Contamination', value: 5, color: CHART_COLORS.gray },
  ];

  // Inventory Trends (Area)
  const inventoryTrends = [
    { month: 'Sep', received: 45000, consumed: 42000 },
    { month: 'Oct', received: 52000, consumed: 48000 },
    { month: 'Nov', received: 48000, consumed: 51000 },
    { month: 'Dec', received: 61000, consumed: 55000 },
    { month: 'Jan', received: 59000, consumed: 62000 },
    { month: 'Feb', received: 67000, consumed: 64000 },
  ];

  // Stock Accuracy
  const accuracyTrend = [
    { day: 'Mon', accuracy: 98.5 },
    { day: 'Tue', accuracy: 98.8 },
    { day: 'Wed', accuracy: 98.2 },
    { day: 'Thu', accuracy: 99.1 },
    { day: 'Fri', accuracy: 98.9 },
    { day: 'Sat', accuracy: 99.4 },
    { day: 'Sun', accuracy: 99.6 },
  ];

  // IPQC Compliance
  const complianceData = [
    { stage: 'Water Treatment', pass: 99.8, fail: 0.2 },
    { stage: 'Blowing', pass: 97.5, fail: 2.5 },
    { stage: 'Washing', pass: 99.1, fail: 0.9 },
    { stage: 'Filling', pass: 96.8, fail: 3.2 },
    { stage: 'Capping', pass: 98.4, fail: 1.6 },
    { stage: 'Labeling', pass: 98.9, fail: 1.1 },
  ];

  // Warehouse Capacity
  const warehouseUtilization = [
    { name: 'Raw Materials (Zone A)', used: 85, color: CHART_COLORS.blue },
    { name: 'Finished Goods (Zone B)', used: 62, color: CHART_COLORS.green },
    { name: 'Packaging (Zone C)', used: 92, color: CHART_COLORS.orange },
    { name: 'Quarantine (Zone D)', used: 15, color: CHART_COLORS.red },
  ];

  // Custom Tooltip component for sleek Power BI feel
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
              <span className="text-white font-semibold">{entry.value.toLocaleString()}{entry.name === 'yield' || entry.name === 'accuracy' ? '%' : ''}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // KPI Card Component
  const KPICard = ({ title, value, subtext, trend, icon: Icon, colorClass }: any) => (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-${colorClass}-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
          <div className="flex items-center gap-2">
            <span className={`flex items-center text-xs font-semibold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {Math.abs(trend)}%
            </span>
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
            <p className="text-gray-400 mt-1">Holistic view of Manufacturing & Supply Chain performance</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-dark-800 border border-dark-700 text-white text-sm rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">This Quarter</option>
              <option value="1y">YTD</option>
            </select>
            <button className="p-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-dark-700 overflow-x-auto hide-scrollbar">
          {[
            { id: 'overview', label: 'Executive Overview', icon: Activity },
            { id: 'production', label: 'Production Metrics', icon: Factory },
            { id: 'inventory', label: 'Inventory & Warehousing', icon: Package },
            { id: 'quality', label: 'Quality & IPQC', icon: ShieldCheck },
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
            {/* High-Level KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard title="Total Output (Units)" value="152.4K" subtext="vs last period" trend={12.5} icon={Factory} colorClass="blue" />
              <KPICard title="Avg Production Yield" value="98.7%" subtext="target: 98.0%" trend={0.5} icon={TrendingUp} colorClass="green" />
              <KPICard title="Inventory Turnover" value="6.2x" subtext="vs last period" trend={-1.2} icon={Layers} colorClass="purple" />
              <KPICard title="OEE (Efficiency)" value="82.4%" subtext="target: 85.0%" trend={3.4} icon={Activity} colorClass="orange" />
            </div>

            {/* Master Chart: Output vs Yield */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Production Volume vs. Yield Trend</h3>
                  <p className="text-sm text-gray-400">Daily breakdown by SKU and overall efficiency</p>
                </div>
              </div>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={productionOutputData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
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
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PRODUCTION METRICS */}
        {/* ========================================================================= */}
        {activeTab === 'production' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Output by Product (Area Chart) */}
              <div className="lg:col-span-2 bg-dark-800 border border-dark-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-1">Production Output Volume</h3>
                <p className="text-sm text-gray-400 mb-6">Units produced over time</p>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={productionOutputData}>
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
                </div>
              </div>

              {/* Rejection Pareto (Donut) */}
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-1">Defect Breakdown</h3>
                <p className="text-sm text-gray-400 mb-2">Primary causes for rejected units</p>
                <div className="flex-1 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={rejectionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {rejectionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Custom Legend */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {rejectionData.slice(0,4).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                      {item.name} ({item.value}%)
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: INVENTORY & WAREHOUSING */}
        {/* ========================================================================= */}
        {activeTab === 'inventory' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KPICard title="Total Inventory Value" value={formatCurrency(142500, 'USD')} subtext="Current valuation" trend={2.1} icon={BarChart3} colorClass="green" />
              <KPICard title="Low Stock Alerts" value="12" subtext="Components below minimum" trend={-15} icon={AlertOctagon} colorClass="red" />
              <KPICard title="Stock Accuracy" value="99.2%" subtext="Cycle count variance" trend={0.3} icon={ShieldCheck} colorClass="blue" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Receipt vs Consumption */}
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">Material Flow (Received vs Consumed)</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={inventoryTrends} margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="month" stroke="#9CA3AF" tickLine={false} axisLine={false} />
                      <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#374151', opacity: 0.2 }} />
                      <Legend />
                      <Bar dataKey="received" name="Received (kg/units)" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="consumed" name="Consumed in Production" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Warehouse Capacity */}
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">Warehouse Capacity Utilization</h3>
                <div className="space-y-6">
                  {warehouseUtilization.map((zone, index) => (
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: QUALITY & IPQC */}
        {/* ========================================================================= */}
        {activeTab === 'quality' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Compliance by Stage */}
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-1">IPQC Stage Compliance</h3>
                <p className="text-sm text-gray-400 mb-6">First-time pass rates by production stage</p>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={complianceData} layout="vertical" margin={{ left: 40, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                      <XAxis type="number" domain={[90, 100]} stroke="#9CA3AF" tickLine={false} axisLine={false} />
                      <YAxis dataKey="stage" type="category" stroke="#E5E7EB" tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#374151', opacity: 0.2 }} />
                      <Bar dataKey="pass" name="Pass Rate %" fill={CHART_COLORS.green} radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Accuracy Trend */}
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-1">QA Release Approval Timeline</h3>
                <p className="text-sm text-gray-400 mb-6">Trailing 7-day acceptance accuracy</p>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={accuracyTrend} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="day" stroke="#9CA3AF" tickLine={false} axisLine={false} />
                      <YAxis domain={[95, 100]} stroke="#9CA3AF" tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="accuracy" 
                        name="Approval Accuracy"
                        stroke={CHART_COLORS.blue} 
                        strokeWidth={4}
                        dot={{ fill: CHART_COLORS.blue, r: 6, strokeWidth: 0 }}
                        activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}