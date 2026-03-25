'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  Package,
  AlertCircle,
  DollarSign,
  BarChart3,
  FileSpreadsheet,
  FileCode,
  MapPin,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';

interface ReportData {
  report_type: string;
  generated_at: string;
  total_records: number;
  data: any[];
  summary?: any;
  filters?: any;
}

export default function ReportsPage() {
  const router = useRouter();
  const { isAuthenticated, token, isLoading: authLoading } = useAuth();
  const [selectedReport, setSelectedReport] = useState('stock-levels');
  const [dateRange, setDateRange] = useState({ 
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0]
  });
  const [additionalFilters, setAdditionalFilters] = useState({
    location_id: '',
    category_id: '',
    stock_status: '',
    urgency: '',
    group_by: 'category'
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const reportTypes = [
    {
      id: 'stock-levels',
      name: 'Stock Levels Report',
      description: 'Current inventory levels across all locations',
      icon: Package,
      color: 'blue'
    },
    {
      id: 'low-stock',
      name: 'Low Stock Report',
      description: 'Products below reorder threshold',
      icon: AlertCircle,
      color: 'red'
    },
    {
      id: 'valuation',
      name: 'Inventory Valuation',
      description: 'Financial value of inventory by category',
      icon: DollarSign,
      color: 'green'
    },
    {
      id: 'movement',
      name: 'Stock Movement',
      description: 'Transaction history and trends',
      icon: TrendingUp,
      color: 'purple'
    },
    {
      id: 'transaction-summary',
      name: 'Transaction Summary',
      description: 'Aggregated transaction data',
      icon: BarChart3,
      color: 'yellow'
    },
    {
      id: 'location-summary',
      name: 'Location Summary',
      description: 'Warehouse capacity and utilization',
      icon: MapPin,
      color: 'teal'
    }
  ];

  const generateReport = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');
      let endpoint = '';
      const params = new URLSearchParams();

      // Add date range for applicable reports
      if (['movement', 'transaction-summary'].includes(selectedReport)) {
        if (dateRange.start) params.append('start_date', dateRange.start);
        if (dateRange.end) params.append('end_date', dateRange.end);
      }

      // Add additional filters based on report type
      switch (selectedReport) {
        case 'stock-levels':
          endpoint = '/reports/stock-levels';
          if (additionalFilters.location_id) params.append('location_id', additionalFilters.location_id);
          if (additionalFilters.category_id) params.append('category_id', additionalFilters.category_id);
          if (additionalFilters.stock_status) params.append('stock_status', additionalFilters.stock_status);
          break;
        case 'low-stock':
          endpoint = '/reports/low-stock';
          if (additionalFilters.urgency) params.append('urgency', additionalFilters.urgency);
          break;
        case 'valuation':
          endpoint = '/reports/valuation';
          params.append('group_by', additionalFilters.group_by);
          break;
        case 'movement':
          endpoint = '/reports/movement';
          break;
        case 'transaction-summary':
          endpoint = '/reports/transaction-summary';
          params.append('group_by', additionalFilters.group_by === 'category' ? 'product' : additionalFilters.group_by);
          break;
        case 'location-summary':
          endpoint = '/reports/location-summary';
          break;
        default:
          endpoint = '/reports/stock-levels';
      }

      const queryString = params.toString();
      const url = `${process.env.NEXT_PUBLIC_API_URL}${endpoint}${queryString ? '?' + queryString : ''}`;

      console.log('Fetching report from:', url);

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Report response:', response.data);
      setReportData(response.data);
    } catch (error: any) {
      console.error('Error generating report:', error);
      setError(error.response?.data?.message || error.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData || !reportData.data || reportData.data.length === 0) {
      alert('No data to export');
      return;
    }

    const reportName = reportTypes.find(r => r.id === selectedReport)?.name || 'Report';
    
    // Convert data to CSV format
    const headers = Object.keys(reportData.data[0]);
    const csvContent = [
      headers.join(','),
      ...reportData.data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle values that might contain commas
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportName.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    if (!reportData) {
      alert('No data to export');
      return;
    }

    const reportName = reportTypes.find(r => r.id === selectedReport)?.name || 'Report';
    const jsonContent = JSON.stringify(reportData, null, 2);
    
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportName.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderReportPreview = () => {
    if (!reportData || !reportData.data || reportData.data.length === 0) {
      return (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No data available for this report</p>
          <p className="text-sm text-gray-500 mt-2">
            {error ? error : 'Click "Generate Report" to fetch data'}
          </p>
        </div>
      );
    }

    const data = reportData.data;
    const firstRow = data[0];
    const columns = Object.keys(firstRow);

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-700">
              {columns.map((col) => (
                <th key={col} className="text-left py-3 px-4 text-sm font-semibold text-gray-300">
                  {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 100).map((row, index) => (
              <tr key={index} className="border-b border-dark-700/50 hover:bg-dark-700/30">
                {columns.map((col) => {
                  const value = row[col];
                  let displayValue = value;

                  // Format specific column types
                  if (col.includes('value') || col.includes('cost')) {
                    displayValue = typeof value === 'number' 
                      ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : value;
                  } else if (col.includes('date') || col.includes('_at')) {
                    displayValue = value ? new Date(value).toLocaleDateString() : '';
                  } else if (typeof value === 'number') {
                    displayValue = value.toLocaleString();
                  } else if (col.includes('percentage') || col.includes('percent')) {
                    displayValue = typeof value === 'number' ? `${value.toFixed(1)}%` : value;
                  }

                  return (
                    <td key={col} className="py-3 px-4 text-sm text-white">
                      {displayValue ?? '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 100 && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Showing first 100 of {data.length} records. Export to view all.
          </p>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-gray-400 mt-1">
            Generate and export comprehensive inventory reports
          </p>
        </div>

        {/* Report Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((report) => {
            const Icon = report.icon;
            const isSelected = selectedReport === report.id;
            
            return (
              <button
                key={report.id}
                onClick={() => {
                  setSelectedReport(report.id);
                  setReportData(null);
                  setError('');
                }}
                className={`p-6 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-dark-700 bg-dark-800 hover:border-dark-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4`}
                    style={{ backgroundColor: `rgba(66, 103, 179, 0.1)` }}>
                    <Icon className="w-6 h-6 text-primary-400" />
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {report.name}
                </h3>
                <p className="text-sm text-gray-400">
                  {report.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Report Configuration */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Report Configuration
          </h2>

          <div className="space-y-4">
            {/* Date Range (for movement and summary reports) */}
            {['movement', 'transaction-summary'].includes(selectedReport) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}

            {/* Low Stock Urgency Filter */}
            {selectedReport === 'low-stock' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Urgency Level
                </label>
                <select
                  value={additionalFilters.urgency}
                  onChange={(e) => setAdditionalFilters({ ...additionalFilters, urgency: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Levels</option>
                  <option value="critical">Critical Only</option>
                  <option value="low">Low Only</option>
                </select>
              </div>
            )}

            {/* Valuation Group By */}
            {selectedReport === 'valuation' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Group By
                </label>
                <select
                  value={additionalFilters.group_by}
                  onChange={(e) => setAdditionalFilters({ ...additionalFilters, group_by: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="category">Category</option>
                  <option value="location">Location</option>
                  <option value="both">Category & Location</option>
                </select>
              </div>
            )}

            {/* Transaction Summary Group By */}
            {selectedReport === 'transaction-summary' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Group By
                </label>
                <select
                  value={additionalFilters.group_by}
                  onChange={(e) => setAdditionalFilters({ ...additionalFilters, group_by: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="type">Transaction Type</option>
                  <option value="product">Product</option>
                  <option value="location">Location</option>
                  <option value="user">User</option>
                </select>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Generate Button */}
            <div>
              <button
                onClick={generateReport}
                disabled={loading}
                className="w-full px-4 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 mr-2" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Export Options */}
          {reportData && reportData.data && reportData.data.length > 0 && (
            <div className="pt-6 border-t border-dark-700 mt-6">
              <h3 className="text-lg font-semibold text-white mb-4">Export Options</h3>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={exportToCSV}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center"
                >
                  <FileSpreadsheet className="w-5 h-5 mr-2" />
                  Export to CSV
                </button>

                <button
                  onClick={exportToJSON}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center"
                >
                  <FileCode className="w-5 h-5 mr-2" />
                  Export to JSON
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Report Summary */}
        {reportData && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Report Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-dark-700 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Total Records</p>
                <p className="text-2xl font-bold text-white">
                  {reportData.total_records?.toLocaleString() || reportData.data?.length?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="bg-dark-700 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Generated At</p>
                <p className="text-lg font-medium text-white">
                  {reportData.generated_at ? new Date(reportData.generated_at).toLocaleString() : new Date().toLocaleString()}
                </p>
              </div>
              <div className="bg-dark-700 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Report Type</p>
                <p className="text-lg font-medium text-white">
                  {reportTypes.find(r => r.id === selectedReport)?.name}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Report Preview */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Report Preview</h2>
          {renderReportPreview()}
        </div>
      </div>
    </DashboardLayout>
  );
}
