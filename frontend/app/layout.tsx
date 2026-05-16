import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SettingsProvider } from '@/hooks/useSettings';
import AuthProvider from '@/components/AuthProvider';
import SessionGuard from '@/components/SessionGuard';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VTL ERP Management System Version 1.0',
  description: 'Vilagio Trading Limited Enterprise Resource Planning & Quality Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <SettingsProvider>
            {/* SessionGuard sits here — above all page layouts.
                It arms the 10-minute idle timeout on every authenticated
                page regardless of which layout (DashboardLayout, HRLayout,
                or any future layout) renders below it. */}
            <SessionGuard />
            {children}
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}