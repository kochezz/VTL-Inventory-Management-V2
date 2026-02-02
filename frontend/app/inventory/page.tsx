'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Package, 
  TruckIcon,
  ArrowRightLeft,
  Settings,
  History,
  AlertCircle
} from 'lucide-react';
import ReceiveForm from '@/components/inventory/ReceiveForm';
import IssueForm from '@/components/inventory/IssueForm';
import TransferForm from '@/components/inventory/TransferForm';
import AdjustmentForm from '@/components/inventory/AdjustmentForm';
import TransactionHistory from '@/components/inventory/TransactionHistory';

type TabType = 'receive' | 'issue' | 'transfer' | 'adjustment' | 'history';

export default function InventoryPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('receive');
  const [refreshHistory, setRefreshHistory] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleTransactionSuccess = () => {
    // Refresh history when a transaction is created
    setRefreshHistory(prev => prev + 1);
    // Switch to history tab to show the new transaction
    setActiveTab('history');
  };

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

  const tabs = [
    {
      id: 'receive' as TabType,
      label: 'Receive',
      icon: TruckIcon,
      description: 'Receive inventory from suppliers',
      color: 'green'
    },
    {
      id: 'issue' as TabType,
      label: 'Issue',
      icon: Package,
      description: 'Issue materials to production',
      color: 'blue'
    },
    {
      id: 'transfer' as TabType,
      label: 'Transfer',
      icon: ArrowRightLeft,
      description: 'Move stock between locations',
      color: 'purple'
    },
    {
      id: 'adjustment' as TabType,
      label: 'Adjustment',
      icon: Settings,
      description: 'Adjust stock quantities',
      color: 'yellow'
    },
    {
      id: 'history' as TabType,
      label: 'History',
      icon: History,
      description: 'View transaction history',
      color: 'gray'
    }
  ];

  const currentTab = tabs.find(tab => tab.id === activeTab);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Package className="w-8 h-8 text-primary-400" />
            Inventory Management
          </h1>
          <p className="text-gray-400 mt-1">
            Manage stock movements, receipts, and adjustments
          </p>
        </div>

        {/* User Role Notice */}
        {user && (
          <div className="bg-primary-500/10 border border-primary-500/20 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-primary-400">
                Logged in as <span className="font-semibold">{user.full_name}</span> ({user.role})
              </p>
              <p className="text-xs text-gray-400 mt-1">
                All transactions will be recorded under your account
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
          {/* Tab Headers */}
          <div className="border-b border-dark-700">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 min-w-[140px] px-6 py-4 flex flex-col items-center gap-2 transition-all ${
                      isActive
                        ? 'bg-dark-700 border-b-2 border-primary-500'
                        : 'hover:bg-dark-750'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${
                      isActive ? 'text-primary-400' : 'text-gray-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      isActive ? 'text-white' : 'text-gray-400'
                    }`}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Description */}
          {currentTab && (
            <div className="bg-dark-900 px-6 py-3 border-b border-dark-700">
              <p className="text-sm text-gray-400">{currentTab.description}</p>
            </div>
          )}

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'receive' && (
              <ReceiveForm 
                token={token!} 
                onSuccess={handleTransactionSuccess}
              />
            )}
            
            {activeTab === 'issue' && (
              <IssueForm 
                token={token!} 
                onSuccess={handleTransactionSuccess}
              />
            )}
            
            {activeTab === 'transfer' && (
              <TransferForm 
                token={token!} 
                onSuccess={handleTransactionSuccess}
              />
            )}
            
            {activeTab === 'adjustment' && (
              <AdjustmentForm 
                token={token!} 
                onSuccess={handleTransactionSuccess}
              />
            )}
            
            {activeTab === 'history' && (
              <TransactionHistory 
                token={token!}
                refreshTrigger={refreshHistory}
              />
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <TruckIcon className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Today's Receipts</p>
                <p className="text-xl font-bold text-white">0</p>
              </div>
            </div>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Today's Issues</p>
                <p className="text-xl font-bold text-white">0</p>
              </div>
            </div>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Today's Transfers</p>
                <p className="text-xl font-bold text-white">0</p>
              </div>
            </div>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Today's Adjustments</p>
                <p className="text-xl font-bold text-white">0</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
