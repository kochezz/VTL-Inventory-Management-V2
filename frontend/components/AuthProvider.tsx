'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize, isLoading } = useAuth();

  useEffect(() => {
    // Initialize auth ONCE here
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
