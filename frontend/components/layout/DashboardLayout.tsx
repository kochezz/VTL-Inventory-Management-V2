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
  BadgeDollarSign,
  ChevronDown,
  ChevronRight,
  FolderTree,
  BarChart3,
  Calendar,
  Network,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import useIdleTimeout from '@/hooks/useIdleTimeout';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  roles: string[];
  children?: { name: string; href: string; roles: string[] }[];
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'qa', 'staff', 'viewer', 'super_viewer', 'operator', 'ceo', 'cfo', 'sales', 'engineering']
  },
  {
    name: 'Products',
    href: '/products',
    icon: Package,
    roles: ['admin', 'manager', 'qa', 'staff', 'viewer', 'super_viewer', 'operator', 'ceo', 'cfo', 'sales']
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
    roles: ['admin', 'manager', 'qa', 'engineering', 'operator', 'ceo', 'cfo', 'sales', 'staff', 'super_viewer'],
    children: [
      {
        name: 'Document Register',
        href: '/qms/documents',
        roles: ['admin', 'manager', 'qa', 'engineering', 'operator', 'ceo', 'cfo', 'sales', 'staff', 'super_viewer'],
      },
      {
        name: 'Compliance Dashboard',
        href: '/qms/compliance',
        roles: ['admin', 'manager', 'qa', 'ceo', 'cfo'],
      },
      {
        name: 'Review Calendar',
        href: '/qms/review-calendar',
        roles: ['admin', 'manager', 'qa', 'ceo', 'cfo', 'engineering'],
      },
      {
        name: 'Document Hierarchy',
        href: '/qms/hierarchy',
        roles: ['admin', 'manager', 'qa', 'ceo', 'cfo', 'engineering'],
      },
    ],
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: TrendingUp,
    roles: ['admin', 'manager', 'qa', 'staff', 'ceo', 'cfo'],
    children: [
      {
        name: 'Business Intelligence',
        href: '/analytics',
        roles: ['admin', 'manager', 'qa', 'staff', 'ceo', 'cfo'],
      },
      {
        name: 'Sales Analytics',
        href: '/sales/analytics',
        roles: ['admin', 'manager', 'ceo', 'cfo'],
      },
    ],
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
    name: 'HR Module',
    href: '/hr',
    icon: Users,
    roles: ['admin', 'hr_admin', 'hr_manager', 'ceo', 'manager', 'production_manager', 'warehouse_manager']
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['admin']
  },
];

const subIcons: Record<string, any> = {
  '/qms/documents':       FolderTree,
  '/qms/compliance':      BarChart3,
  '/qms/review-calendar': Calendar,
  '/qms/hierarchy':       Network,
  '/analytics':           TrendingUp,
  '/sales/analytics':     BarChart3,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(60);

  // ── FIX: Robust path checking helpers to handle parent/child mismatches ──
  const isActive = (href: string) =>
    pathname === href || (pathname?.startsWith(`${href}/`) ?? false);

  const isParentActive = (item: NavItem) =>
    isActive(item.href) ||
    (item.children?.some(c => isActive(c.href)) ?? false);

  // ── Auto-expand logic using the robust helpers ──
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    navigation.forEach(item => {
      if (item.children && isParentActive(item)) {
        init[item.href] = true;
      }
    });
    return init;
  });

  // ── FIX: Self-contained session expiry — clears auth then redirects ──────
  // logout() from useAuth clears Zustand state + localStorage but does NOT
  // redirect. Without an explicit router.push('/login') the page stays
  // mounted with no token, causing the "inactive crash" appearance.
  // Using window.location.replace (not router.push) guarantees the redirect
  // fires even if the component is mid-unmount and the router hook is stale.
  const expireSession = useCallback(() => {
    logout();
    window.location.replace('/login');
  }, [logout]);

  // ── Session idle timeout ─────────────────────────────────────────────────
  const handleIdle = useCallback(() => {
    setShowIdleWarning(true);
    setWarningCountdown(60);
  }, []);

  useIdleTimeout({ timeoutMs: 9 * 60 * 1000, onIdle: handleIdle });

  useEffect(() => {
    if (!showIdleWarning) return;

    // Countdown reached zero — session has expired
    if (warningCountdown <= 0) {
      setShowIdleWarning(false);
      expireSession();   // FIX: was logout() with no redirect
      return;
    }

    const timer = setTimeout(
      () => setWarningCountdown(c => c - 1),
      1000
    );
    return () => clearTimeout(timer);
  }, [showIdleWarning, warningCountdown, expireSession]);

  const dismissIdleWarning = useCallback(() => {
    setShowIdleWarning(false);
    setWarningCountdown(60);
  }, []);
  // ── End session idle timeout ─────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  useEffect(() => {
    navigation.forEach(item => {
      if (item.children && isParentActive(item)) {
        setExpanded(prev => ({ ...prev, [item.href]: true }));
      }
    });
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleGroup = (href: string) => {
    setExpanded(prev => ({ ...prev, [href]: !prev[href] }));
  };

  const allowedNavItems = navigation.filter(item =>
    user?.role && item.roles.includes(user.role)
  );

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-dark-950 flex">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-900 border-r border-dark-800 transform transition-transform duration-200 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">

          <div className="flex items-center justify-center h-16 px-6 border-b border-dark-800">
            <img src="/logo-white.png" alt="Vilagio" className="h-12 w-auto"/>
          </div>

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

          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {allowedNavItems.map((item) => {

              if (item.children) {
                const parentActive = isParentActive(item);
                const isOpen       = expanded[item.href] ?? false;

                const allowedChildren = item.children.filter(c =>
                  user?.role && c.roles.includes(user.role)
                );
                if (allowedChildren.length === 0) return null;

                return (
                  <div key={item.href}>
                    <button
                      onClick={() => {
                        if (!isParentActive(item)) {
                          router.push(item.href);
                        }
                        toggleGroup(item.href);
                      }}
                      className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                        parentActive
                          ? 'bg-primary-500/15 text-primary-400'
                          : 'text-gray-400 hover:text-white hover:bg-dark-800'
                      }`}
                    >
                      <item.icon className="w-5 h-5 mr-3 flex-shrink-0"/>
                      <span className="flex-1 text-left">{item.name}</span>
                      {isOpen
                        ? <ChevronDown className="w-4 h-4 flex-shrink-0 opacity-60"/>
                        : <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-60"/>
                      }
                    </button>

                    {isOpen && (
                      <div className="ml-4 mt-1 space-y-1 border-l border-dark-700 pl-3">
                        {allowedChildren.map(child => {
                          const SubIcon = subIcons[child.href];
                          const childActive = isActive(child.href);
                          return (
                            <button
                              key={child.href}
                              onClick={() => router.push(child.href)}
                              className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                                childActive
                                  ? 'bg-primary-500 text-white'
                                  : 'text-gray-400 hover:text-white hover:bg-dark-800'
                              }`}
                            >
                              {SubIcon && <SubIcon className="w-4 h-4 mr-2.5 flex-shrink-0"/>}
                              {child.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const active = isActive(item.href);
              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    active
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3"/>
                  {item.name}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-dark-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3"/>
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className={`flex-1 transition-all duration-200 ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <header className="sticky top-0 z-40 bg-dark-900 border-b border-dark-800">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </span>
            </div>
          </div>
        </header>
        <main className="p-6">
          {children}
        </main>
      </div>

      {/* ── Idle Session Warning Modal ───────────────────────────────────────── */}
      {showIdleWarning && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-dark-800 border border-amber-500/50 rounded-xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-amber-400"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Session About to Expire
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              You have been inactive for 9 minutes. For security, your session
              will automatically log out in:
            </p>
            <div className="text-5xl font-bold text-amber-400 mb-6 font-mono">
              {String(warningCountdown).padStart(2, '0')}s
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={dismissIdleWarning}
                className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg transition-colors"
              >
                I&apos;m Still Here — Continue
              </button>
              <button
                onClick={expireSession}
                className="w-full px-6 py-3 bg-dark-900 hover:bg-dark-700 text-gray-400 hover:text-white rounded-lg transition-colors text-sm border border-dark-600"
              >
                Log Out Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}