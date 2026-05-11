import { useCallback, useEffect, useRef } from 'react';

interface UseIdleTimeoutOptions {
  timeoutMs?: number;
  onIdle: () => void;
}

export default function useIdleTimeout({
  timeoutMs = 10 * 60 * 1000,
  onIdle,
}: UseIdleTimeoutOptions): void {
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventRef = useRef<number>(0);

  const resetTimer = useCallback(() => {
    const now = Date.now();
    if (now - lastEventRef.current < 500) return;
    lastEventRef.current = now;

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onIdle, timeoutMs);
  }, [timeoutMs, onIdle]);

  useEffect(() => {
    const events = [
      'mousemove', 'mousedown', 'keydown',
      'touchstart', 'touchmove', 'scroll', 'click',
    ] as const;

    timerRef.current = setTimeout(onIdle, timeoutMs);
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer, timeoutMs, onIdle]);
}
