'use strict';

// Pure guard logic, deliberately kept in its own file with NO module-load-
// time side effects (unlike test-helper.js, which calls this at the top of
// its own file so every real test gets it automatically). Kept separate so
// db-safety-guard.test.js can require just this and exercise the logic
// directly with fake inputs, without triggering the real check against the
// actual .env/.env.test files -- which would abort the whole test run
// before that meta-test ever got to run, on any machine where .env.test
// isn't configured yet.

const fs = require('fs');
const dotenv = require('dotenv');

function extractHost(connectionString) {
  if (!connectionString) return null;
  try {
    return new URL(connectionString).host;
  } catch {
    return null;
  }
}

// Throws unless it can positively confirm testDatabaseUrl's host differs
// from the host in prodEnvFilePath's own DATABASE_URL. Every failure mode
// (missing test URL, unparseable test URL, missing/unreadable prod env
// file, unparseable prod URL, or a host match) throws -- "can't prove it's
// safe" and "confirmed unsafe" are treated identically: refuse to run.
function assertDatabaseIsNotProduction(testDatabaseUrl, prodEnvFilePath) {
  const testHost = extractHost(testDatabaseUrl);
  if (!testHost) {
    throw new Error(
      'SAFETY GUARD: DATABASE_URL is not set (or is not a valid connection string) -- ' +
      'refusing to run tests. Check that .env.test exists and TEST_HELPER is loading it.'
    );
  }

  if (!fs.existsSync(prodEnvFilePath)) {
    throw new Error(
      `SAFETY GUARD: cannot find ${prodEnvFilePath} to confirm the test database isn't ` +
      `production -- refusing to run tests rather than assume it's safe.`
    );
  }
  const prodEnv = dotenv.parse(fs.readFileSync(prodEnvFilePath));
  const prodHost = extractHost(prodEnv.DATABASE_URL);
  if (!prodHost) {
    throw new Error(
      `SAFETY GUARD: ${prodEnvFilePath} has no valid DATABASE_URL to compare against -- ` +
      `refusing to run tests rather than assume it's safe.`
    );
  }

  if (prodHost === testHost) {
    throw new Error(
      `SAFETY GUARD: the test database host ("${testHost}") is the same as production's ` +
      `("${prodHost}", from ${prodEnvFilePath}). Refusing to run tests -- this would write ` +
      `to and delete from production data. Point .env.test at a separate Neon branch.`
    );
  }
}

module.exports = { assertDatabaseIsNotProduction, extractHost };
