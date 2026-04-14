'use client';

// ============================================================================
// SALES ANALYTICS — frontend/app/sales/analytics/page.tsx
// Phase D2: Revenue dashboard   Phase D3: Marketing signals
// Follows identical patterns to /analytics/page.tsx:
//   KPICard · CustomTooltip · CHART_COLORS · tab navigation style
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, api } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  BarChart3, TrendingUp, TrendingDown, ShoppingBag, Users, Activity,
  DollarSign, XCircle, Download, RefreshCw, AlertTriangle, Package,
  GitMerge, Calendar, Zap, Target
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from 'recharts';

// ── Constants — identical palette to existing analytics page ─────────────────

const CHART_COLORS = {
  blue:   '#3b82f6',
  purple: '#8b5cf6',
  green:  '#10b981',
  yellow: '#f59e0b',
  orange: '#f97316',
  red:    '#ef4444',
  teal:   '#14b8a6',
  gray:   '#6b7280',
  amber:  '#f59e0b',
  pink:   '#ec4899',
};

const SKU_COLOR: Record<string, string> = {
  'FD-500ML-REGULAR':   CHART_COLORS.blue,
  'FD-500ML-PREMIUM':   CHART_COLORS.purple,
  'FD-750ML-REGULAR':   CHART_COLORS.teal,
  'FD-5GAL-REGULAR':    CHART_COLORS.green,
  'ICE-SPHERE-1200G':   CHART_COLORS.amber,
  'ICE-SPHERE-3600G':   CHART_COLORS.orange,
  'SACHET-WATER-500ML': CHART_COLORS.pink,
};

const PAYMENT_COLOR: Record<string, string> = {
  cash:   CHART_COLORS.green,
  mobile: CHART_COLORS.blue,
  card:   CHART_COLORS.purple,
  mixed:  CHART_COLORS.amber,
};

const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
// Only 6-hour slots to keep heatmap readable on screen
const SHOWN_HOURS = [0, 6, 9, 12, 15, 18, 21];
const HOUR_LABEL  = (h: number) =>
  h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`;

// ── Re-usable components matching existing analytics patterns ─────────────────

// Identical signature to existing KPICard
const KPICard = ({ title, value, subtext, trend, icon: Icon, colorClass, loading = false }: any) => (
  <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 relative overflow-hidden group">
    <div className={`absolute top-0 right-0 w-24 h-24 bg-${colorClass}-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`} />
    <div className="flex justify-between items-start relative z-10">
      <div>
        <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
        {loading
          ? <div className="h-8 w-24 bg-dark-700 animate-pulse rounded mb-1" />
          : <h3 className="text-3xl font-bold text-white mb-1 font-mono">{value}</h3>
        }
        <div className="flex items-center gap-2">
          {trend !== undefined && (
            <span className={`flex items-center text-xs font-semibold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend >= 0
                ? <TrendingUp className="w-3 h-3 mr-1" />
                : <TrendingDown className="w-3 h-3 mr-1" />}
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

// Identical to existing CustomTooltip
const CustomTooltip = ({ active, payload, label, formatCurrency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-900 border border-dark-700 p-3 rounded-lg shadow-xl">
      <p className="text-white font-medium mb-2 border-b border-dark-700 pb-1 text-sm">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-3 justify-between text-sm py-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-300">{entry.name}</span>
          </div>
          <span className="text-white font-semibold">
            {entry.name?.toLowerCase().includes('revenue') || entry.name?.toLowerCase().includes('value')
              ? formatCurrency(parseFloat(entry.value))
              : entry.value?.toLocaleString?.() ?? entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Card wrapper matching the style used in the existing analytics page
const SectionCard = ({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
    <div className="flex justify-between items-start mb-1">
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

const ExportButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-gray-300 rounded-lg text-xs transition-colors flex-shrink-0">
    <Download className="w-3.5 h-3.5" />{label}
  </button>
);

// ── Peak hours heatmap ────────────────────────────────────────────────────────

function PeakHoursHeatmap({ data }: { data: any[][] }) {
  if (!data?.length) return (
    <div className="h-48 flex items-center justify-center text-gray-500 italic">
      No transaction data for this period
    </div>
  );
  const max = Math.max(...data.flat().map(c => c.count), 1);
  const intensity = (n: number) => {
    const p = n / max;
    if (p === 0)   return 'bg-dark-900';
    if (p < 0.15)  return 'bg-blue-950/80';
    if (p < 0.35)  return 'bg-blue-900/70';
    if (p < 0.55)  return 'bg-blue-700/80';
    if (p < 0.75)  return 'bg-blue-500/80';
    return 'bg-blue-400';
  };
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[480px]">
        <div className="flex mb-1.5 ml-10">
          {SHOWN_HOURS.map(h => (
            <div key={h} className="flex-1 text-center text-xs text-gray-500">{HOUR_LABEL(h)}</div>
          ))}
        </div>
        {data.map((dayRow, d) => (
          <div key={d} className="flex items-center gap-0.5 mb-0.5">
            <span className="w-10 text-xs text-gray-400 text-right pr-2 flex-shrink-0">{DAYS[d]}</span>
            <div className="flex flex-1 gap-0.5">
              {dayRow
                .filter(cell => SHOWN_HOURS.includes(cell.hour))
                .map(cell => (
                  <div key={`${d}-${cell.hour}`}
                    className={`flex-1 h-8 rounded cursor-help transition-opacity hover:opacity-70 ${intensity(cell.count)}`}
                    title={`${DAYS[d]} ${HOUR_LABEL(cell.hour)} — ${cell.count} transactions`}
                  />
                ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1 mt-3 justify-end">
          <span className="text-xs text-gray-500 mr-1">Low</span>
          {['bg-dark-900','bg-blue-950/80','bg-blue-900/70','bg-blue-700/80','bg-blue-500/80','bg-blue-400'].map((cls,i) => (
            <div key={i} className={`w-5 h-4 rounded ${cls}`} />
          ))}
          <span className="text-xs text-gray-500 ml-1">High</span>
        </div>
      </div>
    </div>
  );
}

// ── Bundle signals visualisation ──────────────────────────────────────────────

function BundleSignals({ data }: { data: any[] }) {
  if (!data?.length) return (
    <div className="h-48 flex items-center justify-center text-gray-500 italic">
      No co-purchase patterns yet — more transaction data needed
    </div>
  );
  const max = Math.max(...data.map(d => d.co_occurrence_count), 1);
  return (
    <div className="space-y-2">
      {data.slice(0, 8).map((pair, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-dark-900 rounded-lg border border-dark-700">
          <GitMerge className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-medium">
                {pair.product_a?.replace('FreshDrip ','').replace(' Bottled Water','')}
              </span>
              <span className="text-gray-500 text-xs font-bold">+</span>
              <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-medium">
                {pair.product_b?.replace('FreshDrip ','').replace(' Bottled Water','')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full"
                  style={{ width: `${(pair.co_occurrence_count / max) * 100}%` }} />
              </div>
              <span className="text-xs text-amber-400 font-bold w-12 text-right flex-shrink-0">
                {pair.co_occurrence_count}×
              </span>
            </div>
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-600 text-center pt-1">
        Co-occurrence = number of transactions where both products appeared together
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SalesAnalyticsPage() {
  const router   = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { formatCurrency } = useSettings();

  const [timeRange, setTimeRange]   = useState('30d');
  const [activeTab, setActiveTab]   = useState<'revenue' | 'operations' | 'marketing'>('revenue');
  const [data, setData]             = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    else if (isAuthenticated) fetchData();
  }, [authLoading, isAuthenticated, timeRange]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const res = await api.get(`/sales-analytics/dashboard?timeRange=${timeRange}`);
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to fetch sales analytics', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleExport = async (exportType: string) => {
    try {
      const res = await api.get(
        `/sales-analytics/export?timeRange=${timeRange}&exportType=${exportType}`,
        { responseType: 'blob' } as any
      );
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download',
        `VTL_Sales_${exportType}_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (authLoading || !isAuthenticated) return null;

  const kpi = data?.kpis || {};

  // SKU bar chart data — short names for x-axis
  const skuChartData = (data?.revenueBySku || []).map((r: any) => ({
    name:    r.product_name?.replace('FreshDrip ','').replace(' Bottled Water','') || r.sku,
    sku:     r.sku,
    revenue: parseFloat(r.revenue || 0),
    units:   parseInt(r.units_sold || 0),
    orders:  parseInt(r.order_count || 0),
  }));

  // Payment pie data
  const paymentData = (data?.paymentBreakdown || []).map((r: any) => ({
    name:  r.payment_method.charAt(0).toUpperCase() + r.payment_method.slice(1),
    value: parseFloat(r.revenue || 0),
    count: parseInt(r.count || 0),
    pct:   parseFloat(r.pct || 0),
    color: PAYMENT_COLOR[r.payment_method] || CHART_COLORS.gray,
  }));

  const fmtTooltip = (val: any) => formatCurrency(parseFloat(val));

  const TABS = [
    { id: 'revenue',    label: 'Revenue & Sales',        icon: TrendingUp  },
    { id: 'operations', label: 'Operations',             icon: Activity    },
    { id: 'marketing',  label: 'Marketing Signals (D3)', icon: Target      },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

        {/* ── Header & Controls — same style as analytics/page.tsx ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Sales Analytics</h1>
            <p className="text-gray-400 mt-1">Revenue intelligence · Marketing signals · CSV export</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={e => setTimeRange(e.target.value)}
              className="bg-dark-800 border border-dark-700 text-white text-sm rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">This Quarter</option>
              <option value="1y">Year to Date</option>
            </select>
            <button onClick={fetchData}
              className="p-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
              <RefreshCw className={`w-5 h-5 ${loadingData ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── KPI row — 8 cards matching 4-col grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <KPICard title="Total Revenue"    value={formatCurrency(kpi.totalRevenue || 0)}      subtext="completed sales"       icon={DollarSign} colorClass="green"  loading={loadingData} />
          <KPICard title="Transactions"     value={(kpi.totalTransactions || 0).toLocaleString()} subtext="processed"          icon={ShoppingBag} colorClass="blue"  loading={loadingData} />
          <KPICard title="Avg Order Value"  value={formatCurrency(kpi.avgOrderValue || 0)}     subtext="per transaction"       icon={TrendingUp} colorClass="purple" loading={loadingData} />
          <KPICard title="Discounts Given"  value={formatCurrency(kpi.totalDiscounts || 0)}    subtext="total concessions"     icon={TrendingDown} colorClass="yellow" loading={loadingData} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <KPICard title="Unique Customers" value={kpi.uniqueCustomers || 0}                   subtext="B2B accounts"          icon={Users}      colorClass="teal"   loading={loadingData} />
          <KPICard title="Walk-in Sales"    value={(kpi.walkinCount || 0).toLocaleString()}    subtext="anonymous"             icon={Activity}   colorClass="orange" loading={loadingData} />
          <KPICard title="Void Rate"        value={`${kpi.voidRate || '0.00'}%`}               subtext={`${kpi.voidCount || 0} voided`} icon={XCircle} colorClass="red"    loading={loadingData} />
          <KPICard title="Voided Revenue"   value={formatCurrency(kpi.voidedRevenue || 0)}     subtext="reversed"              icon={AlertTriangle} colorClass="orange" loading={loadingData} />
        </div>

        {/* ── Tab navigation — identical style to analytics/page.tsx ── */}
        <div className="flex border-b border-dark-700 overflow-x-auto hide-scrollbar">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-dark-600'
                }`}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </div>

        {/* ================================================================= */}
        {/* TAB 1: REVENUE & SALES                                            */}
        {/* ================================================================= */}
        {activeTab === 'revenue' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Revenue by SKU — ComposedChart bars + units line */}
            <SectionCard
              title="Revenue by SKU"
              subtitle="Completed sales — bars = revenue, line = units sold"
              action={<ExportButton label="Export SKU data" onClick={() => handleExport('sku_performance')} />}
            >
              <div className="h-[300px]">
                {skuChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={skuChartData} margin={{ top: 10, right: 30, bottom: 50, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        angle={-20} textAnchor="end" interval={0} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} cursor={{ fill: '#374151', opacity: 0.3 }} />
                      <Legend wrapperStyle={{ paddingTop: '20px', color: '#9CA3AF' }} />
                      <Bar yAxisId="left" dataKey="revenue" name="Revenue" radius={[4,4,0,0]}>
                        {skuChartData.map((entry: any, i: number) => (
                          <Cell key={i} fill={SKU_COLOR[entry.sku] || CHART_COLORS.blue} />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="units" name="Units Sold"
                        stroke={CHART_COLORS.amber} strokeWidth={3}
                        dot={{ fill: CHART_COLORS.amber, r: 4, strokeWidth: 0 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 italic">No sales data for this period</div>
                )}
              </div>
            </SectionCard>

            {/* SKU performance table */}
            <SectionCard title="SKU Performance Detail" subtitle="Units, revenue, avg price, orders and discounts">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-700 text-xs uppercase tracking-wider text-gray-400">
                      {['Product','SKU','Units Sold','Revenue','Avg Price','Orders','Discounts'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {loadingData
                      ? Array.from({length:5}).map((_,i) => (
                          <tr key={i}><td colSpan={7} className="px-4 py-3">
                            <div className="h-4 bg-dark-700 rounded animate-pulse" /></td></tr>
                        ))
                      : (data?.revenueBySku || []).map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-dark-700/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-white">{row.product_name?.replace('FreshDrip ','').replace(' Bottled Water','')}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-400">{row.sku}</td>
                            <td className="px-4 py-3 font-mono text-white">{parseInt(row.units_sold || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 font-mono text-green-400 font-semibold">{formatCurrency(parseFloat(row.revenue || 0))}</td>
                            <td className="px-4 py-3 font-mono text-gray-300">{formatCurrency(parseFloat(row.avg_price || 0))}</td>
                            <td className="px-4 py-3 text-gray-300">{parseInt(row.order_count || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 font-mono text-yellow-400">{formatCurrency(parseFloat(row.total_discounts || 0))}</td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* Daily trend + Monthly revenue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard
                title="Daily Revenue Trend"
                subtitle="B2B accounts vs walk-in split"
                action={<ExportButton label="Export" onClick={() => handleExport('transactions')} />}
              >
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={(data?.dailyTrend || []).map((r: any) => ({
                        date:   new Date(r.sale_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}),
                        b2b:    parseFloat(r.b2b_revenue),
                        walkin: parseFloat(r.walkin_revenue),
                      }))}
                      margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <defs>
                        <linearGradient id="b2bGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={CHART_COLORS.blue}  stopOpacity={0.35}/>
                          <stop offset="95%" stopColor={CHART_COLORS.blue}  stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="walkinGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={CHART_COLORS.green} stopOpacity={0.35}/>
                          <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                      <Legend wrapperStyle={{ paddingTop: '12px', color: '#9CA3AF' }} />
                      <Area type="monotone" dataKey="b2b"    name="B2B Revenue"    stroke={CHART_COLORS.blue}  fill="url(#b2bGrad)"    strokeWidth={2} />
                      <Area type="monotone" dataKey="walkin" name="Walk-in Revenue" stroke={CHART_COLORS.green} fill="url(#walkinGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title="Monthly Revenue" subtitle="Last 12 months">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(data?.monthlyTrend || []).map((r: any) => ({
                        month:        r.month,
                        revenue:      parseFloat(r.revenue),
                        transactions: parseInt(r.transactions),
                      }))}
                      margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} cursor={{ fill: '#374151', opacity: 0.3 }} />
                      <Legend wrapperStyle={{ paddingTop: '12px', color: '#9CA3AF' }} />
                      <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.purple} radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: OPERATIONS                                                 */}
        {/* ================================================================= */}
        {activeTab === 'operations' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Peak hours heatmap */}
            <SectionCard
              title="Peak Hours Heatmap"
              subtitle="Transaction density by day of week and time — hover for details"
            >
              <PeakHoursHeatmap data={data?.heatmap || []} />
            </SectionCard>

            {/* Payment breakdown + Void rate */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Payment Method Breakdown" subtitle="Revenue share by payment method">
                {paymentData.length > 0 ? (
                  <>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={paymentData} cx="50%" cy="50%"
                            innerRadius={65} outerRadius={100} paddingAngle={3}
                            dataKey="value" nameKey="name" stroke="none">
                            {paymentData.map((entry: any, i: number) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any, n: any) => [formatCurrency(parseFloat(v)), n]} />
                          <Legend
                            content={(props) => (
                              <ul className="flex flex-wrap justify-center gap-4 text-sm mt-3">
                                {props.payload?.map((entry, i) => (
                                  <li key={i} className="flex items-center gap-2 text-gray-300">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                    {entry.value} — {paymentData[i]?.pct}%
                                  </li>
                                ))}
                              </ul>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {paymentData.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2.5 bg-dark-900 rounded-lg border border-dark-700">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white">{p.name}</p>
                            <p className="text-xs text-gray-500">{p.count} txns · {formatCurrency(p.value)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-500 italic">No payment data</div>
                )}
              </SectionCard>

              <SectionCard title="Daily Void / Return Rate" subtitle="Stacked completed vs voided with void rate line">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={(data?.voidTrend || []).map((r: any) => ({
                        date:      new Date(r.sale_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}),
                        completed: parseInt(r.completed),
                        voided:    parseInt(r.voided),
                        rate:      parseFloat(r.void_rate_pct),
                      }))}
                      margin={{ top: 10, right: 30, bottom: 10, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis yAxisId="left"  tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} cursor={{ fill: '#374151', opacity: 0.3 }} />
                      <Legend wrapperStyle={{ paddingTop: '12px', color: '#9CA3AF' }} />
                      <Bar yAxisId="left" dataKey="completed" name="Completed" fill={CHART_COLORS.green} radius={[2,2,0,0]} stackId="a" />
                      <Bar yAxisId="left" dataKey="voided"    name="Voided"    fill={CHART_COLORS.red}   radius={[2,2,0,0]} stackId="a" />
                      <Line yAxisId="right" type="monotone" dataKey="rate" name="Void Rate %"
                        stroke={CHART_COLORS.amber} strokeWidth={3}
                        dot={{ fill: CHART_COLORS.amber, r: 4, strokeWidth: 0 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            {/* Top customers */}
            <SectionCard title="Top 10 Customers by Revenue" subtitle="Completed transactions only">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-700 text-xs uppercase tracking-wider text-gray-400">
                      {['#','Customer','Tier','VTL ID','Orders','Revenue','Last Purchase'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {(data?.topCustomers || []).map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-dark-700/30 transition-colors">
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{i+1}</td>
                        <td className="px-4 py-3 font-medium text-white">{c.customer_name}</td>
                        <td className="px-4 py-3">
                          {c.tier_name
                            ? <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">{c.tier_name}</span>
                            : <span className="text-xs text-gray-500 italic">Walk-in</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{c.vtl_customer_id || '—'}</td>
                        <td className="px-4 py-3 text-gray-300">{c.orders}</td>
                        <td className="px-4 py-3 font-mono text-green-400 font-semibold">{formatCurrency(parseFloat(c.revenue || 0))}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {c.last_purchase ? new Date(c.last_purchase).toLocaleDateString('en-GB') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: MARKETING SIGNALS (D3)                                     */}
        {/* ================================================================= */}
        {activeTab === 'marketing' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* D3 notice */}
            <div className="flex items-start gap-4 p-5 bg-dark-800 border border-dark-700 rounded-xl">
              <div className="p-2 bg-amber-500/10 rounded-lg flex-shrink-0">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-white font-semibold mb-1">Marketing Intelligence Layer</p>
                <p className="text-gray-400 text-sm">
                  Derived from real transaction data and updated live. Export any dataset as CSV
                  to feed directly into offline campaign planning or share with your commercial team.
                </p>
              </div>
            </div>

            {/* Bundling + Slow movers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard
                title="Bundling Opportunities"
                subtitle="Products most frequently purchased together in a single transaction"
                action={<ExportButton label="Export" onClick={() => handleExport('bundles')} />}
              >
                <BundleSignals data={data?.marketing?.bundles || []} />
              </SectionCard>

              <SectionCard title="Slow-Moving SKUs" subtitle="Products with the lowest sales velocity in the selected period">
                <div className="space-y-2">
                  {(data?.marketing?.slowMovers || []).map((row: any, i: number) => {
                    const unitsSold = parseInt(row.units_sold_period || 0);
                    const isZero = unitsSold === 0;
                    return (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${
                        isZero
                          ? 'bg-red-500/5 border-red-500/20'
                          : unitsSold < 10
                            ? 'bg-yellow-500/5 border-yellow-500/20'
                            : 'bg-dark-900 border-dark-700'
                      }`}>
                        {isZero
                          ? <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          : <Package className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {row.product_name?.replace('FreshDrip ','').replace(' Bottled Water','')}
                          </p>
                          <p className="text-xs text-gray-500">{row.sku}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${isZero ? 'text-red-400' : 'text-amber-400'}`}>
                            {unitsSold.toLocaleString()} units
                          </p>
                          <p className="text-xs text-gray-500">{parseFloat(row.stock_on_hand||0).toLocaleString()} in stock</p>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-600 text-center pt-2">
                    Red = zero sales in period with stock on hand — escalate to commercial team
                  </p>
                </div>
              </SectionCard>
            </div>

            {/* Seasonal pattern */}
            <SectionCard
              title="Seasonal Revenue Pattern"
              subtitle="Monthly revenue over the last 2 years — identify peak and trough months for campaign timing"
              action={<ExportButton label="Export seasonal data" onClick={() => handleExport('seasonal')} />}
            >
              <div className="h-[280px]">
                {(data?.marketing?.seasonal || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(data.marketing.seasonal).map((r: any) => ({
                        period: `${r.month_name} ${r.year}`,
                        revenue: parseFloat(r.revenue),
                        monthNum: r.month_num,
                      }))}
                      margin={{ top: 10, right: 10, bottom: 50, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="period" tick={{ fill: '#9CA3AF', fontSize: 9 }}
                        angle={-35} textAnchor="end" interval={1} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} cursor={{ fill: '#374151', opacity: 0.3 }} />
                      <Bar dataKey="revenue" name="Revenue" radius={[4,4,0,0]}>
                        {(data.marketing.seasonal).map((_: any, i: number) => (
                          <Cell key={i} fill={_.month_num <= 3 || _.month_num >= 11 ? CHART_COLORS.amber : CHART_COLORS.blue} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 italic">
                    Seasonal data populates after 2+ months of transactions
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                Amber = Q4/Q1 (historically high demand in dry season). Blue = Q2/Q3. Use this to plan stock builds and promotional pushes.
              </p>
            </SectionCard>

            {/* SKU demand trend lines */}
            <SectionCard
              title="SKU Demand Trends"
              subtitle="Week-over-week unit velocity per product — spot growth, plateau, and decline early"
            >
              <div className="h-[280px]">
                {Object.keys(data?.marketing?.demandTrend || {}).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="week" allowDuplicatedCategory={false}
                        tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                      <Legend wrapperStyle={{ paddingTop: '16px', color: '#9CA3AF' }} />
                      {Object.entries(data.marketing.demandTrend).map(([sku, val]: [string, any]) => (
                        <Line key={sku}
                          data={val.points}
                          type="monotone"
                          dataKey="units"
                          name={sku.replace('FD-','').replace('-REGULAR',' Reg').replace('-PREMIUM',' Prem')}
                          stroke={SKU_COLOR[sku] || CHART_COLORS.gray}
                          strokeWidth={2}
                          dot={{ fill: SKU_COLOR[sku] || CHART_COLORS.gray, r: 3, strokeWidth: 0 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 italic">
                    Demand trend data requires sales across multiple weeks
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Export hub */}
            <SectionCard
              title="Marketing Data Export"
              subtitle="Download raw datasets as CSV for offline analysis, campaign planning, and commercial review"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'All Transactions',  type: 'transactions',   icon: ShoppingBag, color: 'blue',
                    desc: 'Full transaction history with customer, cashier, payment, and amounts' },
                  { label: 'SKU Performance',   type: 'sku_performance', icon: Package,     color: 'green',
                    desc: 'Units sold, revenue, avg price, and discounts per product SKU' },
                  { label: 'Bundle Signals',    type: 'bundles',        icon: GitMerge,    color: 'yellow',
                    desc: 'Product co-occurrence pairs ranked by frequency — use for promotions' },
                  { label: 'Seasonal Patterns', type: 'seasonal',       icon: Calendar,    color: 'purple',
                    desc: 'Monthly revenue across last 2 years for demand forecasting' },
                ].map(exp => (
                  <button key={exp.type} onClick={() => handleExport(exp.type)}
                    className={`p-5 bg-dark-900 border border-dark-700 hover:border-${exp.color}-500/50 rounded-xl text-left group transition-all`}>
                    <div className={`p-2.5 bg-${exp.color}-500/10 rounded-lg w-fit mb-3 group-hover:bg-${exp.color}-500/20 transition-colors`}>
                      <exp.icon className={`w-5 h-5 text-${exp.color}-400`} />
                    </div>
                    <p className="text-white font-semibold text-sm mb-1">{exp.label}</p>
                    <p className="text-gray-500 text-xs leading-relaxed mb-4">{exp.desc}</p>
                    <div className="flex items-center gap-1.5">
                      <Download className={`w-3.5 h-3.5 text-${exp.color}-400`} />
                      <span className={`text-xs text-${exp.color}-400 font-medium`}>Download CSV</span>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
