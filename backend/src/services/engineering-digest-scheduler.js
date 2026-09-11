// ============================================================================
// backend/src/services/engineering-digest-scheduler.js
// Mirrors pm-scheduler.js and qms-scheduler.js's setInterval pattern.
// Register in server.js:
//   const engineeringDigestScheduler = require('./src/services/engineering-digest-scheduler');
//   engineeringDigestScheduler.start();
// ============================================================================

const EngineeringEmailService = require('./engineering-email-service');

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function runDailyDigest() {
  console.log('🔧 [Engineering Digest Scheduler] Running daily digest check...');
  await EngineeringEmailService.sendDailyDigest();
}

function start() {
  console.log('🔧 [Engineering Digest Scheduler] Starting — will run every 24h.');

  // Staggered further than QMS (10s) and PM (15s) schedulers, so all three
  // don't hit the DB pool at the same instant on a cold start.
  setTimeout(async () => {
    await runDailyDigest();
  }, 20_000);

  setInterval(async () => {
    await runDailyDigest();
  }, INTERVAL_MS);
}

module.exports = { start, runDailyDigest };
