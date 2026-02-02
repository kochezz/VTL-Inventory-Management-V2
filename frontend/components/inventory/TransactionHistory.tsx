'use client';

import { useState, useEffect } from 'react';
import { History, Filter, Download, Search, Calendar, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';

interface Transaction {
  transaction_id: string;
  transaction_number: string;
  transaction_date: string;
  transaction_type_name: string;
  sku: string;
  product_name: string;
  quantity: number;
  uom: string;
  from_location_code: string | null;
  from_location_name: string | null;
  to_location_code: string | null;
  to_location_name: string | null;
  performed_by_name: string;
  notes: string | null;
}

interface TransactionHistoryProps {
  token: string;
  refreshTrigger: number;
}

export default function TransactionHistory({ token, refreshTrigger }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const itemsPerPage = 20;

  useEffect(() => {
    fetchTransactions();
  }, [refreshTrigger, currentPage]);

  const fetchTransactions = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.append('limit', itemsPerPage.toString());
      params.append('offset', ((currentPage - 1) * itemsPerPage).toString());
      
      if (filterType) params.append('transaction_type', filterType);
      if (filterStartDate) params.append('start_date', filterStartDate);
      if (filterEndDate) params.append('end_date', filterEndDate);

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/transactions?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTransactions(response.data.transactions);
      setTotal(response.data.total);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      setError(error.response?.data?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    fetchTransactions();
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setFilterType('');
    setFilterSearch('');
    setFilterStartDate('');
    setFilterEndDate('');
    setCurrentPage(1);
    fetchTransactions();
  };

  // Export to CSV function
  const handleExport = () => {
    const csvHeaders = [
      'Transaction #',
      'Date',
      'Type',
      'Product',
      'SKU',
      'Quantity',
      'UOM',
      'From Location',
      'To Location',
      'Performed By',
      'Notes'
    ];

    const csvRows = filteredTransactions.map(txn => [
      txn.transaction_number,
      new Date(txn.transaction_date).toLocaleString(),
      txn.transaction_type_name,
      txn.product_name,
      txn.sku,
      txn.quantity,
      txn.uom,
      txn.from_location_code || '-',
      txn.to_location_code || '-',
      txn.performed_by_name,
      txn.notes || '-'
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
    return colors[type.toLowerCase()] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const totalPages = Math.ceil(total / itemsPerPage);

  // Filter transactions by search term
  const filteredTransactions = transactions.filter(txn => {
    if (!filterSearch) return true;
    const searchLower = filterSearch.toLowerCase();
    return (
      txn.transaction_number.toLowerCase().includes(searchLower) ||
      txn.sku.toLowerCase().includes(searchLower) ||
      txn.product_name.toLowerCase().includes(searchLower) ||
      txn.from_location_code?.toLowerCase().includes(searchLower) ||
      txn.to_location_code?.toLowerCase().includes(searchLower) ||
      txn.performed_by_name.toLowerCase().includes(searchLower)
    );
  });

  if (loading && transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Search by transaction #, product, SKU, location..."
            className="w-full pl-10 pr-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Filter Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg text-white flex items-center gap-2 transition-colors"
        >
          <Filter className="w-5 h-5" />
          Filters
          {(filterType || filterStartDate || filterEndDate) && (
            <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
          )}
        </button>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={filteredTransactions.length === 0}
          className="px-4 py-2.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg text-white flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-dark-700 border border-dark-600 rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Transaction Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Transaction Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Types</option>
                <option value="receive">Receive</option>
                <option value="issue">Issue</option>
                <option value="transfer">Transfer</option>
                <option value="adjustment">Adjustment</option>
                <option value="return">Return</option>
                <option value="damage">Damage</option>
              </select>
            </div>

            {/* Start Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* End Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              Apply Filters
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Summary */}
      <div className="text-sm text-gray-400">
        Showing {filteredTransactions.length} of {total} transactions
        {(filterType || filterStartDate || filterEndDate) && (
          <span className="ml-2 text-primary-400">(filtered)</span>
        )}
      </div>

      {/* Transactions Table */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Transaction #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  User
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No transactions found</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {filterSearch || filterType || filterStartDate || filterEndDate
                        ? 'Try adjusting your filters'
                        : 'Create your first transaction to see it here'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((txn) => (
                  <tr key={txn.transaction_id} className="hover:bg-dark-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-primary-400">{txn.transaction_number}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-300">{formatDate(txn.transaction_date)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTransactionTypeColor(txn.transaction_type_name)}`}>
                        {txn.transaction_type_name.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-white font-medium">{txn.product_name}</p>
                        <p className="text-gray-400 text-xs">{txn.sku}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-white font-medium">
                        {txn.quantity.toLocaleString()} {txn.uom}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {txn.from_location_code && (
                          <p className="text-gray-400">
                            From: <span className="text-white">{txn.from_location_code}</span>
                          </p>
                        )}
                        {txn.to_location_code && (
                          <p className="text-gray-400">
                            To: <span className="text-white">{txn.to_location_code}</span>
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-300">{txn.performed_by_name}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-dark-900 px-6 py-4 flex items-center justify-between border-t border-dark-700">
            <p className="text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 bg-dark-700 hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed border border-dark-600 rounded-lg text-white flex items-center gap-2 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 bg-dark-700 hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed border border-dark-600 rounded-lg text-white flex items-center gap-2 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
