'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Users, ClipboardCheck, GraduationCap, BarChart3, Home } from 'lucide-react';

interface HRLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const HR_ALLOWED_ROLES = [
  'admin', 'hr_admin', 'hr_manager', 'ceo', 'manager',
  'production_manager', 'warehouse_manager',
];

const subNavLinks = [
  { label: 'Dashboard',   href: '/hr',             icon: Home },
  { label: 'Employees',   href: '/hr/employees',   icon: Users },
  { label: 'Onboarding',  href: '/hr/onboarding',  icon: GraduationCap },
  { label: 'Reviews',     href: '/hr/reviews',     icon: ClipboardCheck },
  { label: 'Performance', href: '/hr/performance', icon: BarChart3 },
];

export default function HRLayout({ children, title, subtitle }: HRLayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.role && !HR_ALLOWED_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, user?.role, router]);

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Page header */}
      <div className="bg-dark-800 border-b border-dark-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="bg-dark-900 border-b border-dark-700 px-6">
        <nav className="flex">
          {subNavLinks.map(({ label, href, icon: Icon }) => {
            const isActive =
              href === '/hr'
                ? pathname === '/hr'
                : pathname === href || (pathname?.startsWith(`${href}/`) ?? false);

            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'text-primary-400 border-primary-400'
                    : 'text-gray-400 hover:text-white border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page content */}
      <div>{children}</div>
    </div>
  );
}
