/**
 * Unit tests for the product-waitlist signup (POST /waitlist in worker.js).
 *
 * Everything Resend-facing is driven against a stubbed global fetch, so these
 * assert the two things that actually matter and can't be seen from the
 * structural suite: that a submission is validated before it's stored, and that
 * it lands in Resend in the shape Resend expects (custom Contact Properties,
 * not the first_name/last_name smuggling /subscribe used before Nov 2025).
 *
 * Run with: node tests/waitlist.test.js
 */

import { handleWaitlist } from '../worker.js';

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
    toContain(needle) {
      if (!String(val).includes(needle)) throw new Error(`Expected ${JSON.stringify(val)} to contain ${JSON.stringify(needle)}`);
    },
  };
}
// ─────────────────────────────────────────────────────────────────────────────

const ENV = {
  RESEND_API_KEY: 're_test_key',
  RESEND_AUDIENCE_ID_PRODUCT_WAITLIST: 'seg_waitlist',
};

const VALID = {
  name: 'Ada Lovelace',
  email: 'Ada@Example.com',
  profession: 'dev',
  phone: '+1 (201) 555-0123',
  linkedin: 'https://linkedin.com/in/ada',
};

// Records every outbound Resend call and replies with whatever the test asked
// for, keyed by URL substring. Restored by each caller via restoreFetch().
let calls = [];
const realFetch = globalThis.fetch;
function stubFetch(responder) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    const body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), method: (init && init.method) || 'GET', body });
    const reply = responder(String(url), body, init);
    const { status = 200, json: payload = {} } = reply || {};
    return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
  };
}
function restoreFetch() { globalThis.fetch = realFetch; }
const ok = () => ({ status: 200, json: { id: 'ct_1' } });
const post = (body) => handleWaitlist(new Request('https://meridiona.com/waitlist', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}), ENV);
const callTo = (needle) => calls.find((c) => c.url.includes(needle));

console.log('\nValidation (nothing is stored until the payload is sane)');
for (const [label, payload, expectedFragment] of [
  ['missing name', { ...VALID, name: '   ' }, 'your name'],
  ['malformed email', { ...VALID, email: 'ada@' }, 'valid email'],
  ['unknown profession', { ...VALID, profession: 'wizard' }, 'pick what you do'],
  ['"other" with no detail', { ...VALID, profession: 'other', professionOther: '' }, 'Tell us what you do'],
  ['non-LinkedIn URL', { ...VALID, linkedin: 'https://evil.example.com/in/ada' }, 'LinkedIn'],
]) {
  await test(`rejects ${label} without calling Resend`, async () => {
    stubFetch(ok);
    const res = await post(payload);
    restoreFetch();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(expectedFragment);
    expect(calls.length).toBe(0);
  });
}

await test('rejects a body that is not JSON at all', async () => {
  stubFetch(ok);
  const res = await handleWaitlist(new Request('https://meridiona.com/waitlist', { method: 'POST', body: 'nope' }), ENV);
  restoreFetch();
  expect(res.status).toBe(400);
  expect(calls.length).toBe(0);
});

console.log('\nResend contact payload');
await test('sends every collected field, with the extras as custom properties', async () => {
  stubFetch(ok);
  const res = await post(VALID);
  restoreFetch();
  expect(res.status).toBe(200);
  expect((await res.json()).success).toBe(true);

  const contact = callTo('/contacts');
  expect(contact.method).toBe('POST');
  // Email is normalized to lowercase so a resubmit with different casing is the
  // same contact, not a duplicate.
  expect(contact.body.email).toBe('ada@example.com');
  expect(contact.body.first_name).toBe('Ada');
  expect(contact.body.last_name).toBe('Lovelace');
  expect(contact.body.properties.profession).toBe('dev');
  expect(contact.body.properties.phone).toBe('+1 (201) 555-0123');
  expect(contact.body.properties.linkedin).toBe('https://linkedin.com/in/ada');
  expect(contact.body.properties.signup_source).toBe('site-waitlist');
  expect(contact.body.segments[0]).toBe('seg_waitlist');
});

await test('a single-word name leaves last_name empty rather than duplicating it', async () => {
  stubFetch(ok);
  await post({ ...VALID, name: 'Ada' });
  restoreFetch();
  expect(callTo('/contacts').body.first_name).toBe('Ada');
  expect(callTo('/contacts').body.last_name).toBe('');
});

await test('"other" carries the free-text role through to profession_other', async () => {
  stubFetch(ok);
  await post({ ...VALID, profession: 'other', professionOther: 'Analytical engine programmer' });
  restoreFetch();
  const props = callTo('/contacts').body.properties;
  expect(props.profession).toBe('other');
  expect(props.profession_other).toBe('Analytical engine programmer');
});

await test('a picked profession does not carry a stale "other" value', async () => {
  stubFetch(ok);
  await post({ ...VALID, profession: 'pm', professionOther: 'leftover text' });
  restoreFetch();
  expect(callTo('/contacts').body.properties.profession_other).toBe('');
});

console.log('\nTeam notification');
await test('emails the lead to the team inbox, replying to the signup address', async () => {
  stubFetch(ok);
  await post(VALID);
  restoreFetch();
  const email = callTo('/emails');
  expect(email.method).toBe('POST');
  expect(email.body.to[0]).toBe('company@meridiona.com');
  expect(email.body.reply_to).toBe('ada@example.com');
  expect(email.body.subject).toContain('Ada Lovelace');
  expect(email.body.text).toContain('linkedin.com/in/ada');
});

console.log('\nFailure handling (a lead must not be silently dropped)');
await test('an existing contact is updated rather than 409ing the signup', async () => {
  stubFetch((url, body, init) =>
    url.includes('/contacts') && (!init || init.method === 'POST')
      ? { status: 409, json: { name: 'already_exists' } }
      : ok());
  const res = await post(VALID);
  restoreFetch();
  expect(res.status).toBe(200);
  const patch = calls.find((c) => c.method === 'PATCH');
  expect(patch.url).toContain('/contacts/ada%40example.com');
  expect(patch.body.properties.profession).toBe('dev');
  // Sending unsubscribed on an update would resubscribe someone who opted out.
  expect('unsubscribed' in patch.body).toBe(false);
});

await test('unregistered contact properties fall back to a bare contact, keeping the email', async () => {
  let attempt = 0;
  stubFetch((url) => {
    if (!url.includes('/contacts')) return ok();
    attempt++;
    return attempt === 1
      ? { status: 422, json: { message: 'Unknown contact property: profession' } }
      : ok();
  });
  const res = await post(VALID);
  restoreFetch();
  expect(res.status).toBe(200);
  const contactCalls = calls.filter((c) => c.url.includes('/contacts'));
  expect(contactCalls.length).toBe(2);
  expect('properties' in contactCalls[1].body).toBe(false);
  expect(contactCalls[1].body.email).toBe('ada@example.com');
});

await test('the signup still succeeds when only the notification email lands', async () => {
  stubFetch((url) => (url.includes('/emails') ? ok() : { status: 500, json: { message: 'boom' } }));
  const res = await post(VALID);
  restoreFetch();
  expect(res.status).toBe(200);
});

await test('the signup still succeeds when only the contact write lands', async () => {
  stubFetch((url) => (url.includes('/emails') ? { status: 403, json: { message: 'domain not verified' } } : ok()));
  const res = await post(VALID);
  restoreFetch();
  expect(res.status).toBe(200);
});

await test('only a total failure is reported back to the form', async () => {
  stubFetch(() => ({ status: 500, json: { message: 'boom' } }));
  const res = await post(VALID);
  restoreFetch();
  expect(res.status).toBe(500);
  expect((await res.json()).error).toContain('try again');
});

await test('a thrown network error is caught rather than 500ing the Worker', async () => {
  calls = [];
  globalThis.fetch = async () => { throw new Error('network down'); };
  const res = await post(VALID);
  restoreFetch();
  expect(res.status).toBe(500);
  expect((await res.json()).error).toContain('try again');
});

console.log('\n' + '─'.repeat(50));
console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
