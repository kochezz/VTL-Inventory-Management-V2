import { useCallback, useEffect, useRef } from 'react';

interface UseIdleTimeoutOptions {
  // Pass undefined to disable the hook (e.g. when the user is not authenticated).
  // Any numeric value in milliseconds arms the idle timer.
  timeoutMs?: number;
  onIdle: () => void;
}

export default function useIdleTimeout({
  timeoutMs,
  onIdle,
}: UseIdleTimeoutOptions): void {
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventRef = useRef<number>(0);

  const resetTimer = useCallback(() => {
    // Throttle: ignore events fired within 500ms of the last one
    const now = Date.now();
    if (now - lastEventRef.current < 500) return;
    lastEventRef.current = now;

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (timeoutMs !== undefined) {
      timerRef.current = setTimeout(onIdle, timeoutMs);
    }
  }, [timeoutMs, onIdle]);

  useEffect(() => {
    // Disabled: timeoutMs is undefined — clear any running timer and do nothing.
    if (timeoutMs === undefined) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const events = [
      'mousemove', 'mousedown', 'keydown',
      'touchstart', 'touchmove', 'scroll', 'click',
    ] as const;

    // Arm the timer immediately on mount / when timeoutMs becomes defined
    timerRef.current = setTimeout(onIdle, timeoutMs);
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer, timeoutMs, onIdle]);
}