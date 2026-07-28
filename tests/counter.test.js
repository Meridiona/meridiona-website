/**
 * Unit tests for the public live-counter Durable Object (counter.js) —
 * the seed-on-first-access value, the public read path, and the
 * bearer-token-gated increment path. worker.js's routing just forwards
 * `/api/counter*` verbatim to this class's `fetch`, so exercising the DO
 * directly covers the real behavior without needing a live Workers runtime.
 *
 * Run with: node tests/counter.test.js
 */

import { Counter } from '../counter.js';

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
  };
}
// ─────────────────────────────────────────────────────────────────────────────

// A minimal in-memory stand-in for Durable Object transactional storage —
// just enough of the get/put surface Counter uses.
function fakeState() {
  const store = new Map();
  return { storage: { async get(key) { return store.get(key); }, async put(key, value) { store.set(key, value); } } };
}

const SECRET = 'test-shared-secret';

console.log('Seed + public GET');
await test('first-ever GET seeds and returns 100', async () => {
  const counter = new Counter(fakeState(), { COUNTER_INCREMENT_SECRET: SECRET });
  const res = await counter.fetch(new Request('https://meridiona.com/api/counter'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.count).toBe(100);
});
await test('GET is public — no Authorization header required', async () => {
  const counter = new Counter(fakeState(), { COUNTER_INCREMENT_SECRET: SECRET });
  const res = await counter.fetch(new Request('https://meridiona.com/api/counter'));
  expect(res.status).toBe(200);
});
await test('GET responses are CORS-open for the public landing page', async () => {
  const counter = new Counter(fakeState(), { COUNTER_INCREMENT_SECRET: SECRET });
  const res = await counter.fetch(new Request('https://meridiona.com/api/counter'));
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
});
await test('a repeat GET does not mutate the stored count', async () => {
  const state = fakeState();
  const counter = new Counter(state, { COUNTER_INCREMENT_SECRET: SECRET });
  await counter.fetch(new Request('https://meridiona.com/api/counter'));
  const res = await counter.fetch(new Request('https://meridiona.com/api/counter'));
  const body = await res.json();
  expect(body.count).toBe(100);
});

console.log('\nGated POST increment');
await test('POST without a token is rejected with 401', async () => {
  const counter = new Counter(fakeState(), { COUNTER_INCREMENT_SECRET: SECRET });
  const res = await counter.fetch(new Request('https://meridiona.com/api/counter/increment', { method: 'POST' }));
  expect(res.status).toBe(401);
});
await test('POST with the wrong token is rejected with 401', async () => {
  const counter = new Counter(fakeState(), { COUNTER_INCREMENT_SECRET: SECRET });
  const res = await counter.fetch(new Request('https://meridiona.com/api/counter/increment', {
    method: 'POST',
    headers: { Authorization: 'Bearer nope' },
  }));
  expect(res.status).toBe(401);
});
await test('POST with the correct bearer token increments by 1', async () => {
  const state = fakeState();
  const counter = new Counter(state, { COUNTER_INCREMENT_SECRET: SECRET });
  await counter.fetch(new Request('https://meridiona.com/api/counter')); // seeds to 100
  const res = await counter.fetch(new Request('https://meridiona.com/api/counter/increment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}` },
  }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.count).toBe(101);
});
await test('two increments in a row compound', async () => {
  const state = fakeState();
  const counter = new Counter(state, { COUNTER_INCREMENT_SECRET: SECRET });
  const opts = { method: 'POST', headers: { Authorization: `Bearer ${SECRET}` } };
  await counter.fetch(new Request('https://meridiona.com/api/counter/increment', opts));
  const res = await counter.fetch(new Request('https://meridiona.com/api/counter/increment', opts));
  const body = await res.json();
  expect(body.count).toBe(102);
});
await test('POST is rejected if no secret is configured at all', async () => {
  const counter = new Counter(fakeState(), {});
  const res = await counter.fetch(new Request('https://meridiona.com/api/counter/increment', {
    method: 'POST',
    headers: { Authorization: 'Bearer anything' },
  }));
  expect(res.status).toBe(401);
});
await test('an unsupported method is rejected with 405', async () => {
  const counter = new Counter(fakeState(), { COUNTER_INCREMENT_SECRET: SECRET });
  const res = await counter.fetch(new Request('https://meridiona.com/api/counter', { method: 'DELETE' }));
  expect(res.status).toBe(405);
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
