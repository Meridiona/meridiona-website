/**
 * Unit tests for the post-download welcome email (worker.js's /subscribe
 * handler → sendDownloadWelcomeEmail). Covers the pure helpers directly and
 * the /subscribe route end-to-end against a faked `fetch` (no real network,
 * no live Resend key needed).
 *
 * Run with: node tests/welcome-email.test.js
 */

import worker, { displayNameFromEmail, welcomeEmailContent } from '../worker.js';

// ─── Minimal test harness (mirrors tests/auth-relay.test.js) ──────────────────
let passed = 0, failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}
function expect(val) {
  return {
    toBe(expected) {
      if (val !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toBeTruthy() {
      if (!val) throw new Error(`Expected truthy, got ${JSON.stringify(val)}`);
    },
    toContain(needle) {
      if (!val.includes(needle)) throw new Error(`Expected ${JSON.stringify(val)} to contain ${JSON.stringify(needle)}`);
    },
  };
}
// ─────────────────────────────────────────────────────────────────────────────

// A fake `env.ASSETS` binding — /subscribe never falls through to it, but
// `handle()` reaches for it if a route doesn't match, so it must exist.
function fakeAssets() {
  return { fetch: async () => new Response('not found', { status: 404 }) };
}

// Stands in for `waitUntil` — runs the promise inline so the test can await
// the fire-and-forget welcome-email send instead of racing it.
function syncCtx() {
  return { waitUntil: (p) => p };
}

console.log('displayNameFromEmail');
await test('titlecases a plain local-part', async () => {
  expect(displayNameFromEmail('sathvik@meridiona.com')).toBe('Sathvik');
});
await test('picks the name segment around dots/underscores/plus tags', async () => {
  expect(displayNameFromEmail('sathvik.k99@gmail.com')).toBe('Sathvik');
  expect(displayNameFromEmail('k99+meridian@gmail.com')).toBe('Meridian');
});
await test('falls back to "there" for role inboxes', async () => {
  expect(displayNameFromEmail('hello@company.com')).toBe('there');
  expect(displayNameFromEmail('info@company.com')).toBe('there');
});
await test('falls back to "there" when nothing name-like is found', async () => {
  expect(displayNameFromEmail('12345@company.com')).toBe('there');
});

console.log('\nwelcomeEmailContent');
await test('produces a short, personalized subject/body', async () => {
  const { subject, html, text } = welcomeEmailContent('Sathvik');
  expect(subject).toBeTruthy();
  expect(html).toContain('Sathvik');
  expect(text).toContain('Sathvik');
  expect(html).toContain('Meridian');
});

console.log('\n/subscribe → welcome email');
await test('sends the welcome email only for source "download"', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    if (String(url).includes('/audiences/')) return new Response(JSON.stringify({ id: 'c1' }), { status: 200 });
    if (String(url).includes('/emails')) return new Response(JSON.stringify({ id: 'e1' }), { status: 200 });
    return new Response('{}', { status: 200 });
  };
  try {
    const env = { RESEND_API_KEY: 'test-key', RESEND_AUDIENCE_ID_DOWNLOAD: 'aud_1', ASSETS: fakeAssets() };
    const req = new Request('https://meridiona.com/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'sathvik@meridiona.com', source: 'download', os: 'mac' }),
    });
    const resp = await worker.fetch(req, env, syncCtx());
    expect(resp.status).toBe(200);

    const emailCall = calls.find((c) => c.url.includes('/emails'));
    expect(emailCall).toBeTruthy();
    const sentBody = JSON.parse(emailCall.opts.body);
    expect(sentBody.to).toBe('sathvik@meridiona.com');
    expect(sentBody.subject).toBeTruthy();
    expect(sentBody.html).toContain('Sathvik');
  } finally {
    globalThis.fetch = realFetch;
  }
});
await test('does not send a welcome email for waitlist signups', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ id: 'c1' }), { status: 200 });
  };
  try {
    const env = { RESEND_API_KEY: 'test-key', RESEND_AUDIENCE_ID_WAITLIST: 'aud_2', ASSETS: fakeAssets() };
    const req = new Request('https://meridiona.com/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'someone@example.com', source: 'waitlist', os: 'windows' }),
    });
    const resp = await worker.fetch(req, env, syncCtx());
    expect(resp.status).toBe(200);
    expect(calls.some((u) => u.includes('/emails'))).toBe(false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
