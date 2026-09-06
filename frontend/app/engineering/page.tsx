'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';

export default function EngineeringPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Engineering</h1>
          <p className="text-gray-400 mt-1">
            Work orders, asset register, and PM scheduling are coming in a future release.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
