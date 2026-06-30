import { useEffect, useState, useCallback } from 'react';
import { getPendingCount, getPendingPunches, markSynced, markError } from '../db.js';
import { syncPunches } from '../api.js';

export default function SyncBanner({ deviceCode }) {
  const [count,   setCount]   = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    try { setCount(await getPendingCount()); } catch (_) {}
  }, []);

  const sync = useCallback(async () => {
    if (syncing || !deviceCode || !navigator.onLine) return;
    const pending = await getPendingPunches();
    if (!pending.length) return;
    setSyncing(true);
    try {
      const res = await syncPunches({ device_code: deviceCode, punches: pending });
      for (const r of res.results) {
        if (r.status === 'accepted' || r.status === 'duplicate') {
          await markSynced(r.client_uuid);
        } else {
          await markError(r.client_uuid, r.error || 'sync error');
        }
      }
    } catch (_) {
      // Still offline — will retry on the next 'online' event
    } finally {
      setSyncing(false);
      await refreshCount();
    }
  }, [syncing, deviceCode, refreshCount]);

  useEffect(() => {
    refreshCount();
    const tick = setInterval(refreshCount, 30_000);
    window.addEventListener('online', sync);
    return () => {
      clearInterval(tick);
      window.removeEventListener('online', sync);
    };
  }, [refreshCount, sync]);

  if (count === 0) return null;

  return (
    <div className="sync-banner">
      {syncing
        ? 'Syncing offline punches...'
        : `${count} punch${count !== 1 ? 'es' : ''} pending sync`}
    </div>
  );
}
