'use strict';

// Proves the "tests must never run against production" guard actually
// works, using fake temp files -- NOT the real .env/.env.test. Deliberately
// requires only tests/helpers/db-safety-guard.js, not test-helper.js: the
// real guard runs automatically at test-helper.js's module-load time and
// would abort the whole run before this file ever executed if .env.test
// weren't configured yet, which is exactly the scenario this suite needs
// to be able to prove the guard works IN even before a real Neon test
// branch exists.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { assertDatabaseIsNotProduction, extractHost } = require('./helpers/db-safety-guard');

function tempEnvFile(contents) {
  const file = path.join(os.tmpdir(), `db-safety-guard-test-${Date.now()}-${Math.random().toString(36).slice(2)}.env`);
  fs.writeFileSync(file, contents);
  return file;
}

test('extractHost pulls the host out of a real Neon-style connection string', () => {
  assert.equal(
    extractHost('postgresql://user:pass@ep-cold-forest-ahaxbjlu-pooler.c-3.us-east-1.aws.neon.tech/db?sslmode=require'),
    'ep-cold-forest-ahaxbjlu-pooler.c-3.us-east-1.aws.neon.tech'
  );
});

test('extractHost returns null for garbage input', () => {
  assert.equal(extractHost('not a url'), null);
  assert.equal(extractHost(undefined), null);
});

test('throws when the test DB host matches the production host', () => {
  const prodEnv = tempEnvFile('DATABASE_URL=postgresql://user:pass@ep-cold-forest-abc123-pooler.c-3.us-east-1.aws.neon.tech/vilagio_inventory\n');
  try {
    assert.throws(
      () => assertDatabaseIsNotProduction(
        'postgresql://user:pass@ep-cold-forest-abc123-pooler.c-3.us-east-1.aws.neon.tech/vilagio_inventory',
        prodEnv
      ),
      /SAFETY GUARD.*same as production/
    );
  } finally {
    fs.unlinkSync(prodEnv);
  }
});

test('does not throw when the test DB host differs from production (real test-branch shape)', () => {
  const prodEnv = tempEnvFile('DATABASE_URL=postgresql://user:pass@ep-cold-forest-abc123-pooler.c-3.us-east-1.aws.neon.tech/vilagio_inventory\n');
  try {
    assert.doesNotThrow(() =>
      assertDatabaseIsNotProduction(
        'postgresql://user:pass@ep-different-branch-xyz789.c-3.us-east-1.aws.neon.tech/vilagio_inventory',
        prodEnv
      )
    );
  } finally {
    fs.unlinkSync(prodEnv);
  }
});

test('throws when testDatabaseUrl is missing or unparseable', () => {
  const prodEnv = tempEnvFile('DATABASE_URL=postgresql://user:pass@prod-host.neon.tech/db\n');
  try {
    assert.throws(() => assertDatabaseIsNotProduction(undefined, prodEnv), /DATABASE_URL is not set/);
    assert.throws(() => assertDatabaseIsNotProduction('not a url', prodEnv), /DATABASE_URL is not set/);
  } finally {
    fs.unlinkSync(prodEnv);
  }
});

test('throws when the production env file does not exist', () => {
  const missingPath = path.join(os.tmpdir(), 'this-file-does-not-exist.env');
  assert.throws(
    () => assertDatabaseIsNotProduction('postgresql://user:pass@some-host.neon.tech/db', missingPath),
    /cannot find .* to confirm/
  );
});

test('throws when the production env file has no DATABASE_URL', () => {
  const prodEnv = tempEnvFile('SOME_OTHER_VAR=hello\n');
  try {
    assert.throws(
      () => assertDatabaseIsNotProduction('postgresql://user:pass@some-host.neon.tech/db', prodEnv),
      /no valid DATABASE_URL/
    );
  } finally {
    fs.unlinkSync(prodEnv);
  }
});
