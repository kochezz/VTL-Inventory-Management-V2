'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'staff', 'viewer'] },
    { name: 'Products', href: '/products', icon: Package, roles: ['admin', 'manager', 'staff', 'viewer'] },
    { name: 'Inventory', href: '/inventory', icon: ClipboardList, roles: ['admin', 'manager', 'staff'] },
    { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['admin', 'manager'] },
    { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
  ];

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-dark-800 overflow-y-auto border-r border-dark-700">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 bg-dark-900 border-b border-dark-700">
            <Image
              src="/logo-white.png"
              alt="Vilagio"
              width={120}
              height={48}
              className="h-12 w-auto"
              priority
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = false; // You can implement active route detection
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                    isActive
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-300 hover:bg-dark-700 hover:text-white'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </a>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="flex-shrink-0 border-t border-dark-700">
            <div className="flex items-center px-4 py-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {user?.role || 'Role'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-2 text-gray-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 flex">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-dark-900 bg-opacity-75"
              onClick={() => setSidebarOpen(false)}
            ></div>

            {/* Sidebar */}
            <div className="relative flex w-full max-w-xs flex-1 flex-col bg-dark-800">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                >
                  <X className="h-6 w-6 text-white" />
                </button>
              </div>

              {/* Logo */}
              <div className="flex items-center justify-center h-16 px-4 bg-dark-900 border-b border-dark-700">
                <Image
                  src="/logo-white.png"
                  alt="Vilagio"
                  width={120}
                  height={48}
                  className="h-12 w-auto"
                  priority
                />
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {filteredNavigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.name}
                      href={item.href}
                      className="flex items-center px-4 py-3 text-sm font-medium text-gray-300 rounded-lg hover:bg-dark-700 hover:text-white transition-all"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </a>
                  );
                })}
              </nav>

              {/* User Profile */}
              <div className="flex-shrink-0 border-t border-dark-700">
                <div className="flex items-center px-4 py-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
                      {user?.full_name?.charAt(0) || 'U'}
                    </div>
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {user?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {user?.role || 'Role'}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="ml-2 p-2 text-gray-400 hover:text-red-400 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top Bar */}
        <div className="sticky top-0 z-10 flex h-16 flex-shrink-0 bg-dark-800 border-b border-dark-700">
          <button
            type="button"
            className="px-4 text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex flex-1 justify-between px-4 lg:px-8">
            <div className="flex flex-1">
              <div className="flex w-full lg:ml-0">
                <div className="relative w-full max-w-lg">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    className="block w-full rounded-lg border-0 bg-dark-700 py-2 pl-10 pr-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 sm:text-sm"
                    placeholder="Search products, inventory..."
                    type="search"
                  />
                </div>
              </div>
            </div>
            <div className="ml-4 flex items-center lg:ml-6">
              <button
                type="button"
                className="rounded-full bg-dark-700 p-2 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <Bell className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
