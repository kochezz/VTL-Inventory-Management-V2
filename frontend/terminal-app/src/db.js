import { openDB } from 'idb';

// SECURITY FLAG — offline PIN bypass
// ─────────────────────────────────────────────────────────────────────────────
// When the network is unavailable, punches are queued locally without a
// server-side PIN check. The worker's identity (user_id) comes from the
// /identify call, which DID reach the server. The /sync endpoint trusts the
// terminal's device_code + IP rather than validating per-punch PINs.
//
// PINs are NEVER written to IndexedDB or localStorage. Only user_id,
// punch metadata, and the captured photo are stored.
//
// Safer alternative: after a successful online PIN verify, the server issues
// a short-lived HMAC session token (e.g., valid 30 s, scoped to user_id).
// Queue the token with the offline punch entry. /sync verifies the HMAC
// instead of unconditionally trusting the terminal. This approach prevents
// an attacker with physical terminal access from forging offline punches for
// arbitrary workers without first passing online PIN verification.
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME    = 'vtl-terminal-v1';
const DB_VERSION = 1;
const STORE      = 'pendingPunches';

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE, { keyPath: 'client_uuid' });
      store.createIndex('status', 'status');
    },
  });
}

export async function queuePunch(punch) {
  const db = await getDB();
  await db.put(STORE, { ...punch, status: 'pending', queued_at: new Date().toISOString() });
}

export async function getPendingPunches() {
  const db = await getDB();
  return db.getAllFromIndex(STORE, 'status', 'pending');
}

export async function markSynced(client_uuid) {
  const db = await getDB();
  const item = await db.get(STORE, client_uuid);
  if (item) await db.put(STORE, { ...item, status: 'synced', synced_at: new Date().toISOString() });
}

export async function markError(client_uuid, error_message) {
  const db = await getDB();
  const item = await db.get(STORE, client_uuid);
  if (item) await db.put(STORE, { ...item, status: 'error', error_message });
}

export async function getPendingCount() {
  const db = await getDB();
  return db.countFromIndex(STORE, 'status', 'pending');
}
