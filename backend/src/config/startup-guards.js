'use strict';

// Session J. Render sets RENDER=true in every service's environment
// automatically (confirmed Render platform behavior, not something this repo
// sets) -- a reliable signal this process is running on Render, as opposed
// to a local dev/test box. MOCK_EMAIL_TRANSPORT=true must never run there:
// it silently swallows every real email send (receipts, digests, approval
// notifications) into an in-memory log instead of actually sending, which
// in production would look like working code that quietly never notifies
// anyone. Takes an env object (defaulting to process.env) so it's testable
// without mutating the real process environment.
function assertNotMockEmailOnRender(env = process.env) {
  if (env.MOCK_EMAIL_TRANSPORT === 'true' && env.RENDER) {
    throw new Error(
      'Refusing to boot: MOCK_EMAIL_TRANSPORT=true while running on Render ' +
      '(RENDER env var is set). This would silently swallow every real email ' +
      "send. Unset MOCK_EMAIL_TRANSPORT in Render's environment config for this service."
    );
  }
}

module.exports = { assertNotMockEmailOnRender };
