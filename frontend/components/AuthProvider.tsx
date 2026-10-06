'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize, isInitializing } = useAuth();

  useEffect(() => {
    // Initialize auth ONCE here
    initialize();
  }, [initialize]);

  // Session J: gates on isInitializing (the one-time bootstrap), not
  // isLoading -- isLoading also flips true/false on every login() call, and
  // gating this unmount/remount on it wiped LoginPage's local state (email,
  // password, and any just-set error message) on every login attempt.
  if (isInitializing) {
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
