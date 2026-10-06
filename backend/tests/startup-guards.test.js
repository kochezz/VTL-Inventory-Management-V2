'use strict';

// Session J. Pure unit tests, no server/DB needed -- assertNotMockEmailOnRender
// takes an env object instead of reading process.env directly specifically so
// this doesn't need to mutate the real process environment to test it.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertNotMockEmailOnRender } = require('../src/config/startup-guards');

test('throws when MOCK_EMAIL_TRANSPORT=true and RENDER is set', () => {
  assert.throws(
    () => assertNotMockEmailOnRender({ MOCK_EMAIL_TRANSPORT: 'true', RENDER: 'true' }),
    /Refusing to boot/
  );
});

test('does not throw when MOCK_EMAIL_TRANSPORT=true and RENDER is unset (local test server)', () => {
  assert.doesNotThrow(() => assertNotMockEmailOnRender({ MOCK_EMAIL_TRANSPORT: 'true' }));
});

test('does not throw when RENDER is set but MOCK_EMAIL_TRANSPORT is unset (normal production boot)', () => {
  assert.doesNotThrow(() => assertNotMockEmailOnRender({ RENDER: 'true' }));
});

test('does not throw when neither is set (plain local dev)', () => {
  assert.doesNotThrow(() => assertNotMockEmailOnRender({}));
});

test("does not throw when MOCK_EMAIL_TRANSPORT is a non-'true' string", () => {
  // Matches the same strict string-equality convention used everywhere else
  // this flag is checked (notification-service.js, the three schedulers).
  assert.doesNotThrow(() => assertNotMockEmailOnRender({ MOCK_EMAIL_TRANSPORT: 'yes', RENDER: 'true' }));
});

test('defaults to process.env when no argument is passed', () => {
  const before = { MOCK_EMAIL_TRANSPORT: process.env.MOCK_EMAIL_TRANSPORT, RENDER: process.env.RENDER };
  try {
    delete process.env.MOCK_EMAIL_TRANSPORT;
    delete process.env.RENDER;
    assert.doesNotThrow(() => assertNotMockEmailOnRender());

    process.env.MOCK_EMAIL_TRANSPORT = 'true';
    process.env.RENDER = 'true';
    assert.throws(() => assertNotMockEmailOnRender(), /Refusing to boot/);
  } finally {
    if (before.MOCK_EMAIL_TRANSPORT === undefined) delete process.env.MOCK_EMAIL_TRANSPORT;
    else process.env.MOCK_EMAIL_TRANSPORT = before.MOCK_EMAIL_TRANSPORT;
    if (before.RENDER === undefined) delete process.env.RENDER;
    else process.env.RENDER = before.RENDER;
  }
});
