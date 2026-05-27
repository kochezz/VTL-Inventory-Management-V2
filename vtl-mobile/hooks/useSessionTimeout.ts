import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

const BACKGROUND_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const BACKGROUND_TIMESTAMP_KEY = 'vtl_background_at';

export function useSessionTimeout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout, isAuthenticated } = useAuthStore();

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // ── Core logout function ──────────────────────────────────────────────────
  const performSessionLogout = useCallback(
    async (reason: string) => {
      console.log('Session timeout:', reason);

      // Clear inactivity timer
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }

      // Clear background timestamp
      await SecureStore.deleteItemAsync(BACKGROUND_TIMESTAMP_KEY).catch(() => {});

      // Clear React Query cache
      queryClient.clear();

      // Call auth store logout (clears tokens + state)
      await logout();

      // Navigate to session-expired screen (auto-redirects to login after 2.5 s)
      router.replace('/(auth)/session-expired');
    },
    [logout, queryClient, router],
  );

  // ── Inactivity timer management ───────────────────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    if (!isAuthenticated) return;

    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    inactivityTimer.current = setTimeout(() => {
      performSessionLogout('inactivity_timeout');
    }, INACTIVITY_TIMEOUT_MS);
  }, [isAuthenticated, performSessionLogout]);

  // ── App state change handler ──────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const previousState = appState.current;
      appState.current = nextState;

      if (previousState === 'active' && nextState === 'background') {
        // App going to background — record timestamp
        const timestamp = Date.now().toString();
        await SecureStore.setItemAsync(BACKGROUND_TIMESTAMP_KEY, timestamp);

        // Pause inactivity timer while backgrounded
        if (inactivityTimer.current) {
          clearTimeout(inactivityTimer.current);
          inactivityTimer.current = null;
        }
      }

      if (nextState === 'active') {
        // App returning to foreground — check how long it was backgrounded
        try {
          const timestampStr = await SecureStore.getItemAsync(BACKGROUND_TIMESTAMP_KEY);

          if (timestampStr) {
            const backgroundedAt = parseInt(timestampStr, 10);
            const elapsed = Date.now() - backgroundedAt;

            // Clean up the stored timestamp
            await SecureStore.deleteItemAsync(BACKGROUND_TIMESTAMP_KEY);

            if (elapsed >= BACKGROUND_TIMEOUT_MS) {
              // Been in background too long — logout
              await performSessionLogout('background_timeout');
              return;
            }
          }
        } catch (e) {
          console.error('Session check error:', e);
        }

        // App returned within timeout — restart inactivity timer
        resetInactivityTimer();
      }
    };

    // Start inactivity timer on mount
    resetInactivityTimer();

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [isAuthenticated, performSessionLogout, resetInactivityTimer]);

  // Expose resetInactivityTimer so screens can signal activity
  return { resetInactivityTimer };
}

// ── Lightweight hook for signalling user activity in individual screens ──────
// Import and call this in frequently-used screens to reset the inactivity timer.
export function useActivitySignal() {
  const { resetInactivityTimer } = useSessionTimeout();
  return resetInactivityTimer;
}
