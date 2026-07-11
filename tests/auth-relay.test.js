/**
 * Unit tests for the Google-SSO relay (auth.meridiona.com) — the pure/testable
 * parts of worker.js's /auth/* routes: port validation and the token
 * mint/exchange logic against a fake KV. `handleAuthCallback`'s Clerk-network
 * path (authenticateRequest, users.getUser) is NOT covered here — it needs a
 * live Clerk instance, same reasoning the Meridian repo's own OAuth flows
 * apply to their network-dependent halves.
 *
 * Run with: node tests/auth-relay.test.js
 */

import { isValidLoopbackPort, handleAuthExchange } from '../worker.js';

// ─── Minimal test harness (mirrors tests/responsive.test.js) ──────────────────
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
    toBeFalsy() {
      if (val) throw new Error(`Expected falsy, got ${JSON.stringify(val)}`);
    },
  };
}
// ─────────────────────────────────────────────────────────────────────────────

// A minimal in-memory stand-in for Workers KV — just enough of the
// get/put/delete surface handleAuthExchange uses, with TTL enforced manually
// (real KV expires lazily; we emulate that by checking an explicit deadline).
function fakeKv() {
  const store = new Map();
  return {
    async put(key, value, opts) {
      const expiresAt = opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null;
      store.set(key, { value, expiresAt });
    },
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async delete(key) {
      store.delete(key);
    },
    size() {
      return store.size;
    },
  };
}

console.log('Port validation');
await test('accepts a real ephemeral port', () => {
  expect(isValidLoopbackPort('54321')).toBeTruthy();
});
await test('rejects missing port', () => {
  expect(isValidLoopbackPort(null)).toBeFalsy();
  expect(isValidLoopbackPort('')).toBeFalsy();
});
await test('rejects non-numeric input', () => {
  expect(isValidLoopbackPort('abc')).toBeFalsy();
  expect(isValidLoopbackPort('80; DROP TABLE')).toBeFalsy();
});
await test('rejects well-known/reserved ports below 1024', () => {
  expect(isValidLoopbackPort('80')).toBeFalsy();
  expect(isValidLoopbackPort('1023')).toBeFalsy();
});
await test('rejects out-of-range ports above 65535', () => {
  expect(isValidLoopbackPort('65536')).toBeFalsy();
  expect(isValidLoopbackPort('999999')).toBeFalsy();
});
await test('accepts the boundary values', () => {
  expect(isValidLoopbackPort('1024')).toBeTruthy();
  expect(isValidLoopbackPort('65535')).toBeTruthy();
});

console.log('\nToken exchange');
await test('redeems a freshly minted token exactly once', async () => {
  const kv = fakeKv();
  await kv.put('tok-1', JSON.stringify({ email: 'a@b.com', userId: 'user_1' }), { expirationTtl: 120 });

  const first = await handleAuthExchange(new URL('https://auth.meridiona.com/auth/exchange?token=tok-1'), { AUTH_TOKENS: kv });
  expect(first.status).toBe(200);
  const body = await first.json();
  expect(body.email).toBe('a@b.com');
  expect(body.userId).toBe('user_1');

  // Single-use: the same token must not redeem twice.
  const second = await handleAuthExchange(new URL('https://auth.meridiona.com/auth/exchange?token=tok-1'), { AUTH_TOKENS: kv });
  expect(second.status).toBe(400);
});
await test('rejects an unknown token', async () => {
  const kv = fakeKv();
  const resp = await handleAuthExchange(new URL('https://auth.meridiona.com/auth/exchange?token=never-issued'), { AUTH_TOKENS: kv });
  expect(resp.status).toBe(400);
});
await test('rejects a missing token param', async () => {
  const kv = fakeKv();
  const resp = await handleAuthExchange(new URL('https://auth.meridiona.com/auth/exchange'), { AUTH_TOKENS: kv });
  expect(resp.status).toBe(400);
});
await test('an expired token is treated as invalid', async () => {
  const kv = fakeKv();
  await kv.put('tok-expired', JSON.stringify({ email: 'a@b.com', userId: 'user_1' }), { expirationTtl: -1 });
  const resp = await handleAuthExchange(new URL('https://auth.meridiona.com/auth/exchange?token=tok-expired'), { AUTH_TOKENS: kv });
  expect(resp.status).toBe(400);
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
