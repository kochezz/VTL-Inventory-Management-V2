'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import useIdleTimeout from '@/hooks/useIdleTimeout';

/**
 * SessionGuard — mounted once in the root layout.
 * Handles the 10-minute idle session timeout for EVERY page in the app,
 * regardless of which layout (DashboardLayout, HRLayout, etc.) is active.
 * Renders nothing visible until the warning threshold is reached.
 */
export default function SessionGuard() {
  const { isAuthenticated, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]     = useState(60);

  const expireSession = useCallback(() => {
    logout();
    window.location.replace('/login');
  }, [logout]);

  const handleIdle = useCallback(() => {
    setShowWarning(true);
    setCountdown(60);
  }, []);

  // Only arm the timeout when the user is logged in.
  // Passing undefined disables the hook on the login page.
  useIdleTimeout({
    timeoutMs: isAuthenticated ? 9 * 60 * 1000 : undefined,
    onIdle: handleIdle,
  });

  // Countdown: tick every second, expire at zero
  useEffect(() => {
    if (!showWarning) return;
    if (countdown <= 0) {
      setShowWarning(false);
      expireSession();
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showWarning, countdown, expireSession]);

  const dismiss = useCallback(() => {
    setShowWarning(false);
    setCountdown(60);
  }, []);

  // No modal — render nothing
  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <div className="bg-dark-800 border border-amber-500/50 rounded-xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center">

        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
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
          {String(countdown).padStart(2, '0')}s
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={dismiss}
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
  );
}