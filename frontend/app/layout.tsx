import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SettingsProvider } from '@/hooks/useSettings';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vilagio Inventory System',
  description: 'Comprehensive inventory management for Vilagio Technologies Ltd.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
