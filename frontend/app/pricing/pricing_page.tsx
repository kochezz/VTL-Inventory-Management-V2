'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import PricingManager from '@/components/admin/PricingManager';

export default function PricingPage() {
  return (
    <DashboardLayout>
      <PricingManager />
    </DashboardLayout>
  );
}