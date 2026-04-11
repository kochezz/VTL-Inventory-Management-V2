'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  MapPin, 
  TrendingUp, 
  FileText, 
  Settings, 
  LogOut,
  Users,
  Factory,
  ClipboardCheck,
  Building2,
  ShoppingCart,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  FlaskConical,
  BadgeDollarSign
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  roles: string[];
}

const navigation: NavItem[] = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'qa', 'staff', 'viewer', 'operator', 'ceo', 'cfo', 'sales']
  },
  { 
    name: 'Products', 
    href: '/products', 
    icon: Package,
    roles: ['admin', 'manager', 'qa', 'staff', 'viewer', 'operator', 'ceo', 'cfo', 'sales']
  },
  { 
    name: 'Inventory', 
    href: '/inventory', 
    icon: MapPin,
    roles: ['admin', 'manager', 'qa', 'staff', 'operator', 'ceo', 'cfo', 'sales']
  },
  { 
    name: 'Production', 
    href: '/production', 
    icon: Factory,
    roles: ['admin', 'manager', 'qa', 'staff', 'operator', 'ceo', 'cfo']
  },
  { 
    name: 'Vendor Management', 
    href: '/vendor-management/suppliers', 
    icon: Building2,
    roles: ['admin', 'manager', 'qa', 'staff', 'ceo', 'cfo', 'sales'] 
  },
  { 
    name: 'Customers (CRM)', 
    href: '/vendor-management/customers', 
    icon: Users,
    roles: ['admin', 'manager', 'sales', 'staff', 'ceo', 'cfo'] 
  },
  { 
    name: 'Purchase Orders', 
    href: '/vendor-management/purchase-orders', 
    icon: ShoppingCart,
    roles: ['admin', 'manager', 'qa', 'staff', 'ceo', 'cfo', 'sales'] 
  },
  { 
    name: 'Goods Receipts', 
    href: '/vendor-management/goods-receipts', 
    icon: PackageCheck,
    roles: ['admin', 'manager', 'warehouse', 'staff', 'ceo', 'cfo', 'sales'] 
  },
  { 
    name: 'QC Lab', 
    href: '/lab', 
    icon: FlaskConical,
    roles: ['admin', 'manager', 'qa'] 
  },
  { 
    name: 'Sales / POS', 
    href: '/sales/pos', 
    icon: ShoppingBag,
    roles: ['admin', 'manager', 'sales', 'staff'] 
  },
  { 
    name: 'Global Pricing', 
    href: '/pricing', 
    icon: BadgeDollarSign,
    roles: ['admin', 'ceo', 'cfo'] 
  },
  { 
    name: 'Quality (QMS)', 
    href: '/qms', 
    icon: ShieldCheck,
    roles: ['admin', 'manager', 'qa', 'engineering', 'operator', 'ceo', 'cfo', 'sales'] 
  },
  { 
    name: 'Analytics', 
    href: '/analytics', 
    icon: TrendingUp,
    roles: ['admin', 'manager', 'qa', 'staff', 'ceo', 'cfo']
  },
  { 
    name: 'Reports', 
    href: '/reports', 
    icon: FileText,
    roles: ['admin', 'manager', 'qa', 'ceo', 'cfo', 'sales']
  },
  { 
    name: 'Production Reports', 
    href: '/production-reports', 
    icon: ClipboardCheck,
    roles: ['admin', 'manager', 'qa', 'operator', 'ceo', 'cfo']
  },
  { 
    name: 'Users', 
    href: '/users', 
    icon: Users,
    roles: ['admin']
  },
  { 
    name: 'Settings', 
    href: '/settings', 
    icon: Settings,
    roles: ['admin']
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const allowedNavItems = navigation.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-900 border-r border-dark-800 transform transition-transform duration-200 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-6 border-b border-dark-800">
            <img
              src="/logo-white.png"
              alt="Vilagio"
              className="h-12 w-auto"
            />
          </div>

          {/* User Info */}
          <div 
            onClick={() => router.push('/profile')}
            className="px-6 py-4 border-b border-dark-800 cursor-pointer hover:bg-dark-800 transition-colors group relative"
          >
            <div className="flex items-center">
              <div className="w-10 h-10 bg-primary-500/10 rounded-full flex items-center justify-center group-hover:bg-primary-500/20 transition-colors">
                <span className="text-primary-400 font-medium text-sm">
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-primary-400 transition-colors">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-xs text-gray-400 capitalize">
                  {user?.role?.replace('_', ' ') || 'Role'}
                </p>
              </div>
            </div>
            <div className="absolute top-4 right-4 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Edit
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {allowedNavItems.map((item) => {
              // Highlight if we are on the exact path OR a true sub-path (e.g., /production/123)
              // The addition of the '/' in startsWith prevents /production-reports from triggering /production
              const isActive = pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false);
              
              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </button>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-dark-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-200 ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-dark-900 border-b border-dark-800">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}