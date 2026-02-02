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
  RefreshCw
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
  ResponsiveContainer
} from 'recharts';

export default function AnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { formatCurrency } = useSettings();
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

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

  // Mock data for charts
  const monthlyTrends = [
    { month: 'Aug', receive: 450, issue: 320, transfer: 180 },
    { month: 'Sep', receive: 520, issue: 380, transfer: 210 },
    { month: 'Oct', receive: 480, issue: 350, transfer: 195 },
    { month: 'Nov', receive: 610, issue: 420, transfer: 240 },
    { month: 'Dec', receive: 590, issue: 450, transfer: 260 },
    { month: 'Jan', receive: 670, issue: 490, transfer: 285 },
  ];

  const categoryPerformance = [
    { name: 'Raw Materials', value: 850, percentage: 28.3 },
    { name: 'Finished Goods', value: 920, percentage: 30.7 },
    { name: 'Spare Parts', value: 630, percentage: 21.0 },
    { name: 'Packaging', value: 600, percentage: 20.0 },
  ];

  const COLORS = ['#4267B3', '#5B7FC7', '#7497DB', '#8DAEE0'];

  const turnoverData = [
    { category: 'Raw Materials', actual: 5.8, target: 5.0 },
    { category: 'Finished Goods', actual: 4.2, target: 5.0 },
    { category: 'Spare Parts', actual: 3.5, target: 4.0 },
    { category: 'Packaging', actual: 6.1, target: 5.5 },
  ];

  const accuracyTrend = [
    { day: 'Mon', accuracy: 98.5 },
    { day: 'Tue', accuracy: 98.8 },
    { day: 'Wed', accuracy: 98.2 },
    { day: 'Thu', accuracy: 99.1 },
    { day: 'Fri', accuracy: 98.9 },
    { day: 'Sat', accuracy: 98.7 },
    { day: 'Sun', accuracy: 99.0 },
  ];

  const warehouseUtilization = [
    { name: 'ZONE-A', used: 4200, capacity: 6000, percentage: 70 },
    { name: 'ZONE-B', used: 5400, capacity: 6000, percentage: 90 },
    { name: 'ZONE-C', used: 3800, capacity: 6000, percentage: 63 },
    { name: 'ZONE-D', used: 2100, capacity: 4000, percentage: 53 },
    { name: 'ZONE-E', used: 1600, capacity: 4000, percentage: 40 },
  ];

  const kpis = [
    {
      title: 'Inventory Turnover',
      value: '5.2x',
      change: '+8%',
      trend: 'up',
      target: '5.0x',
      status: 'good'
    },
    {
      title: 'Stock Accuracy',
      value: '98.9%',
      change: '+2.1%',
      trend: 'up',
      target: '98.0%',
      status: 'good'
    },
    {
      title: 'Fill Rate',
      value: '96.5%',
      change: '-1.2%',
      trend: 'down',
      target: '97.0%',
      status: 'warning'
    },
    {
      title: 'Carrying Cost',
      value: formatCurrency(12400, 'USD'), // FIXED: Was '$12.4K'
      change: '-5%',
      trend: 'down',
      target: formatCurrency(15000, 'USD'), // FIXED: Was '<$15K'
      status: 'good'
    },
  ];

  const insights = [
    {
      type: 'success',
      title: 'Stock Accuracy Improving',
      description: 'Cycle counting initiatives showing positive results',
      color: 'green'
    },
    {
      type: 'warning',
      title: 'Fill Rate Below Target',
      description: 'Low stock in 3 high-demand product categories',
      color: 'yellow'
    },
    {
      type: 'info',
      title: 'ZONE-B Near Capacity',
      description: 'Consider redistributing inventory to other zones',
      color: 'blue'
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
            <p className="text-gray-400 mt-1">Real-time inventory insights and performance metrics</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            {/* Refresh Button */}
            <button className="px-4 py-2 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg text-white flex items-center gap-2 transition-colors">
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((kpi, index) => (
            <div key={index} className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-400">{kpi.title}</h3>
                <span className={`w-2 h-2 rounded-full ${
                  kpi.status === 'good' ? 'bg-green-400' : 
                  kpi.status === 'warning' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold text-white">{kpi.value}</p>
                  <p className="text-xs text-gray-500 mt-1">Target: {kpi.target}</p>
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  kpi.trend === 'up' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {kpi.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>{kpi.change}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Transaction Trends */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Monthly Transaction Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="receive" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                <Area type="monotone" dataKey="issue" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} />
                <Area type="monotone" dataKey="transfer" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Category Performance */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Category Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryPerformance}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percentage }) => `${percentage}%`}
                >
                  {categoryPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value: any, name: any, props: any) => [
                    `${value} units (${props.payload.percentage}%)`,
                    props.payload.name
                  ]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value, entry: any) => (
                    <span style={{ color: '#9CA3AF' }}>
                      {entry.payload.name}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inventory Turnover by Category */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Inventory Turnover by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={turnoverData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9CA3AF" />
                <YAxis dataKey="category" type="category" stroke="#9CA3AF" width={120} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Legend />
                <Bar dataKey="actual" fill="#4267B3" radius={[0, 8, 8, 0]} />
                <Bar dataKey="target" fill="#6B7280" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stock Accuracy Trend */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Stock Accuracy Trend (7 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={accuracyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="day" stroke="#9CA3AF" />
                <YAxis domain={[95, 100]} stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="accuracy" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  dot={{ fill: '#10B981', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Warehouse Utilization */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Warehouse Location Utilization</h3>
          <div className="space-y-4">
            {warehouseUtilization.map((location, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">{location.name}</span>
                  <span className="text-sm text-gray-400">
                    {location.used.toLocaleString()} / {location.capacity.toLocaleString()} units ({location.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      location.percentage >= 90 ? 'bg-red-500' :
                      location.percentage >= 75 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${location.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {insights.map((insight, index) => (
            <div 
              key={index}
              className={`bg-dark-800 border rounded-xl p-6 ${
                insight.color === 'green' ? 'border-green-500/20 bg-green-500/5' :
                insight.color === 'yellow' ? 'border-yellow-500/20 bg-yellow-500/5' :
                'border-blue-500/20 bg-blue-500/5'
              }`}
            >
              <div className="flex items-start gap-3">
                <Activity className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                  insight.color === 'green' ? 'text-green-400' :
                  insight.color === 'yellow' ? 'text-yellow-400' :
                  'text-blue-400'
                }`} />
                <div>
                  <h4 className={`font-semibold mb-1 ${
                    insight.color === 'green' ? 'text-green-400' :
                    insight.color === 'yellow' ? 'text-yellow-400' :
                    'text-blue-400'
                  }`}>
                    {insight.title}
                  </h4>
                  <p className="text-sm text-gray-400">{insight.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
