import { useEffect, useState, useCallback, useRef } from 'react';
import { getPendingCount, getPendingPunches, markSynced, markError } from '../db.js';
import { syncPunches } from '../api.js';

export default function SyncBanner({ deviceCode }) {
  const [count,         setCount]         = useState(0);
  const [syncing,       setSyncing]       = useState(false);
  const [syncErr,       setSyncErr]       = useState('');
  const [rejectedCount, setRejectedCount] = useState(0);
  const syncingRef = useRef(false);  // stable ref avoids stale-closure guard issues

  const refreshCount = useCallback(async () => {
    try { setCount(await getPendingCount()); } catch (_) {}
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current || !deviceCode || !navigator.onLine) return;
    const pending = await getPendingPunches();
    if (!pending.length) { await refreshCount(); return; }

    syncingRef.current = true;
    setSyncing(true);
    setSyncErr('');

    try {
      const res = await syncPunches({ device_code: deviceCode, punches: pending });
      let newRejected = 0;
      for (const r of res.results) {
        if (r.status === 'accepted' || r.status === 'duplicate') {
          await markSynced(r.client_uuid);
        } else {
          // rejected_no_credential or any other server rejection — leave pending queue
          await markError(r.client_uuid, r.message || 'sync rejected');
          if (r.status === 'rejected_no_credential') newRejected++;
        }
      }
      if (newRejected > 0) setRejectedCount(n => n + newRejected);
    } catch (err) {
      // Server returned an error response (4xx/5xx) or network failure.
      // Make the failure visible so the cause can be diagnosed.
      setSyncErr(err.message || 'Sync failed — check server');
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refreshCount();
    }
  }, [deviceCode, refreshCount]);

  useEffect(() => {
    refreshCount();
    const tick = setInterval(sync, 30_000);
    window.addEventListener('online', sync);
    return () => {
      clearInterval(tick);
      window.removeEventListener('online', sync);
    };
  }, [refreshCount, sync]);

  const visible = count > 0 || syncErr || rejectedCount > 0;
  if (!visible) return null;

  return (
    <div className="sync-banner">
      {syncing ? (
        'Syncing offline punches...'
      ) : syncErr ? (
        <>
          <span>Sync failed: {syncErr}</span>
          <button className="sync-now-btn" onClick={() => { setSyncErr(''); sync(); }}>
            Retry
          </button>
        </>
      ) : rejectedCount > 0 && count === 0 ? (
        <>
          <span>{rejectedCount} punch{rejectedCount !== 1 ? 'es' : ''} rejected — no PIN credential</span>
          <button className="sync-now-btn" onClick={() => setRejectedCount(0)}>
            Dismiss
          </button>
        </>
      ) : (
        <>
          {count} punch{count !== 1 ? 'es' : ''} pending sync
          {rejectedCount > 0 && (
            <span style={{ fontSize: 13, opacity: 0.8 }}>
              ({rejectedCount} rejected)
            </span>
          )}
          <button className="sync-now-btn" onClick={sync} disabled={syncing}>
            Sync Now
          </button>
        </>
      )}
    </div>
  );
}
