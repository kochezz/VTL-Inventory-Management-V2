'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Package, TrendingUp, AlertCircle, Users } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  const stats = [
    {
      name: 'Total Products',
      value: '88',
      icon: Package,
      change: '+12%',
      changeType: 'positive',
    },
    {
      name: 'Low Stock Items',
      value: '12',
      icon: AlertCircle,
      change: '+3',
      changeType: 'negative',
    },
    {
      name: 'Total Value',
      value: '$124,590',
      icon: TrendingUp,
      change: '+8%',
      changeType: 'positive',
    },
    {
      name: 'Active Users',
      value: '24',
      icon: Users,
      change: '+2',
      changeType: 'positive',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">
            Welcome back, {user?.full_name}!
          </h1>
          <p className="text-gray-400 mt-1">
            Here's what's happening with your inventory today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.name}
                className="bg-dark-800 border border-dark-700 rounded-xl p-6 hover:border-primary-500/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">{stat.name}</p>
                    <p className="text-2xl font-bold text-white mt-2">
                      {stat.value}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary-500/10 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary-400" />
                  </div>
                </div>
                <div className="mt-4">
                  <span
                    className={`text-sm font-medium ${
                      stat.changeType === 'positive'
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">vs last month</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button className="px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors">
              Add New Product
            </button>
            <button className="px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors">
              Record Transaction
            </button>
            <button className="px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors">
              Generate Report
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
          <div className="space-y-4">
            <p className="text-gray-400 text-center py-8">
              No recent activity to display
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
