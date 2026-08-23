/**
 * Unit tests for guardPublicPost — the abuse guard on /subscribe and /waitlist.
 *
 * These two routes are unauthenticated, publicly discoverable, and each call
 * spends Resend quota and sending reputation. The guard exists because a sibling
 * Worker with exactly that shape (the hf.meridiona.com HuggingFace proxy) was
 * found by scanners and driven to 173k requests in one day, exhausting the
 * account-wide free-plan cap and taking meridiona.com offline.
 *
 * The properties worth pinning are the ones whose failure is SILENT:
 *   1. it fails OPEN — a KV outage must never block a real signup;
 *   2. it stops WRITING once an IP is over the limit, because KV writes are the
 *      scarce resource (1,000/day on the free plan) and a limiter that spends a
 *      write per hostile request is itself a denial of service;
 *   3. a missing Origin header is allowed — privacy extensions strip it, and a
 *      silently-rejected signup is worse than an unthrottled one.
 *
 * Run with: node tests/rate-limit.test.js
 */

import { guardPublicPost } from '../worker.js';

// ─── Minimal test harness (mirrors tests/waitlist.test.js) ───────────────────
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
    toBeNull() {
      if (val !== null) throw new Error(`Expected null, got ${JSON.stringify(val)}`);
    },
  };
}

// An in-memory stand-in for the AUTH_TOKENS namespace that counts operations, so
// a test can assert on writes and not merely on the verdict.
function kv({ failOn = null } = {}) {
  const store = new Map();
  const ops = { get: 0, put: 0 };
  return {
    ops,
    store,
    async get(k) {
      ops.get++;
      if (failOn === 'get') throw new Error('KV unavailable');
      return store.has(k) ? store.get(k) : null;
    },
    async put(k, v) {
      ops.put++;
      if (failOn === 'put') throw new Error('KV unavailable');
      store.set(k, v);
    },
  };
}

const req = (headers = {}) => new Request('https://meridiona.com/subscribe', { method: 'POST', headers });
const fromIp = (ip, origin = 'https://meridiona.com') =>
  req({ 'CF-Connecting-IP': ip, ...(origin ? { Origin: origin } : {}) });

console.log('\nUnder the limit, nothing is blocked');
await test('allows the first request and records it', async () => {
  const AUTH_TOKENS = kv();
  expect(await guardPublicPost(fromIp('1.1.1.1'), { AUTH_TOKENS }, 'sub', 3)).toBeNull();
  expect(AUTH_TOKENS.ops.put).toBe(1);
});

await test('allows exactly `limit` requests before refusing', async () => {
  const AUTH_TOKENS = kv();
  const env = { AUTH_TOKENS };
  for (let i = 0; i < 3; i++) {
    expect(await guardPublicPost(fromIp('1.1.1.1'), env, 'sub', 3)).toBeNull();
  }
  const blocked = await guardPublicPost(fromIp('1.1.1.1'), env, 'sub', 3);
  expect(blocked.status).toBe(429);
});

console.log('\nThe write budget is the thing being protected');
await test('spends no further writes once an IP is over the limit', async () => {
  const AUTH_TOKENS = kv();
  const env = { AUTH_TOKENS };
  for (let i = 0; i < 3; i++) await guardPublicPost(fromIp('9.9.9.9'), env, 'sub', 3);
  const writesAfterFillingTheBucket = AUTH_TOKENS.ops.put;
  // The abusive case: keep hammering long past the ceiling.
  for (let i = 0; i < 50; i++) await guardPublicPost(fromIp('9.9.9.9'), env, 'sub', 3);
  // A limiter that wrote per request would burn 1/20th of the free daily KV
  // write budget on this loop alone, and hand an attacker a second lever.
  expect(AUTH_TOKENS.ops.put).toBe(writesAfterFillingTheBucket);
});

console.log('\nBuckets and callers are isolated');
await test('a different IP has its own budget', async () => {
  const env = { AUTH_TOKENS: kv() };
  for (let i = 0; i < 3; i++) await guardPublicPost(fromIp('1.1.1.1'), env, 'sub', 3);
  expect(await guardPublicPost(fromIp('2.2.2.2'), env, 'sub', 3)).toBeNull();
});

await test('a different route has its own budget', async () => {
  const env = { AUTH_TOKENS: kv() };
  for (let i = 0; i < 3; i++) await guardPublicPost(fromIp('1.1.1.1'), env, 'sub', 3);
  // Exhausting /subscribe must not lock the same person out of /waitlist.
  expect(await guardPublicPost(fromIp('1.1.1.1'), env, 'wl', 3)).toBeNull();
});

console.log('\nOrigin handling');
await test('rejects a present-but-foreign Origin outright', async () => {
  const env = { AUTH_TOKENS: kv() };
  const res = await guardPublicPost(fromIp('1.1.1.1', 'https://evil.example'), env, 'sub', 3);
  expect(res.status).toBe(403);
  // Free defence: refused before touching KV at all.
  expect(env.AUTH_TOKENS.ops.get).toBe(0);
});

await test('allows a missing Origin, because extensions strip it', async () => {
  const env = { AUTH_TOKENS: kv() };
  expect(await guardPublicPost(fromIp('1.1.1.1', null), env, 'sub', 3)).toBeNull();
});

await test('allows www, which 301s to the apex', async () => {
  const env = { AUTH_TOKENS: kv() };
  expect(await guardPublicPost(fromIp('1.1.1.1', 'https://www.meridiona.com'), env, 'sub', 3)).toBeNull();
});

console.log('\nIt fails open, always');
await test('a KV read failure allows the request', async () => {
  const env = { AUTH_TOKENS: kv({ failOn: 'get' }) };
  expect(await guardPublicPost(fromIp('1.1.1.1'), env, 'sub', 3)).toBeNull();
});

await test('a KV write failure allows the request', async () => {
  const env = { AUTH_TOKENS: kv({ failOn: 'put' }) };
  expect(await guardPublicPost(fromIp('1.1.1.1'), env, 'sub', 3)).toBeNull();
});

await test('no KV binding at all allows the request', async () => {
  expect(await guardPublicPost(fromIp('1.1.1.1'), {}, 'sub', 3)).toBeNull();
});

await test('no client IP (off-platform) allows the request', async () => {
  const env = { AUTH_TOKENS: kv() };
  expect(await guardPublicPost(req({ Origin: 'https://meridiona.com' }), env, 'sub', 3)).toBeNull();
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
