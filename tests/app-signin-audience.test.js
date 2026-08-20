/**
 * Unit tests for addAppUserToAudience — the Clerk-webhook path that puts
 * someone who actually installed and signed into the desktop app into the
 * download audience.
 *
 * Driven against a stubbed global fetch, same harness as tests/waitlist.test.js.
 * The webhook handler that calls it can't be unit-tested (verifyWebhook needs a
 * live Clerk signing secret), so this is the largest unit the Resend behaviour
 * is assertable on.
 *
 * The two properties worth protecting here are both invisible from the outside
 * and both silently destructive if they regress:
 *   1. it must never send `unsubscribed`, or an automatic background write would
 *      resubscribe someone who opted out;
 *   2. it must never send `properties`, or a PATCH would overwrite a contact's
 *      real provenance (signup_source/os/phone/profession from the website
 *      forms) with nothing.
 *
 * Run with: node tests/app-signin-audience.test.js
 */

import { addAppUserToAudience } from '../worker.js';

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
    toBeUndefined() {
      if (val !== undefined) throw new Error(`Expected undefined, got ${JSON.stringify(val)}`);
    },
    toContain(needle) {
      if (!String(val).includes(needle)) throw new Error(`Expected ${JSON.stringify(val)} to contain ${JSON.stringify(needle)}`);
    },
  };
}

const ENV = {
  RESEND_API_KEY: 're_test',
  RESEND_AUDIENCE_ID_DOWNLOAD: 'seg_download',
  RESEND_AUDIENCE_ID: 'seg_shared',
};

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
const created = () => ({ status: 200, json: { id: 'ct_1' } });
// Requests are matched on URL/method so a test can distinguish the three calls
// this path can make: POST /contacts, PATCH /contacts/{email}, and
// POST /contacts/{email}/segments/{id}.
const isSegmentAdd = (url) => /\/segments\//.test(url);
const contactCalls = () => calls.filter((c) => !isSegmentAdd(c.url));
const segmentCalls = () => calls.filter((c) => isSegmentAdd(c.url));
// What Resend answers when the address is already a contact — the common case,
// since most app users signed up on the website first. `postResendContact`
// detects it on either a 409 or `name: 'already_exists'`; using the documented
// error name keeps this honest about which branch is being exercised.
const alreadyExists = () => ({ status: 409, json: { name: 'already_exists', message: 'Contact already exists' } });

console.log('\nA new app user becomes a contact in the download audience');
await test('creates the contact against the download audience', async () => {
  stubFetch(created);
  await addAppUserToAudience(ENV, 'ada@example.com');
  restoreFetch();

  const create = contactCalls()[0];
  expect(create.url).toContain('api.resend.com/contacts');
  expect(create.method).toBe('POST');
  expect(create.body.email).toBe('ada@example.com');
  // Resend wants segments as objects, not bare ids — a plain string 422s.
  expect(create.body.segments[0].id).toBe('seg_download');
});

await test('asserts segment membership explicitly, even for a fresh contact', async () => {
  stubFetch(created);
  await addAppUserToAudience(ENV, 'ada@example.com');
  restoreFetch();

  // Redundant on the create path (the POST already carried `segments`), and
  // kept anyway: it is the ONLY thing that works on the far more common
  // already-a-contact path, and one extra idempotent call is a cheaper price
  // than two divergent code paths.
  const seg = segmentCalls()[0];
  expect(seg.method).toBe('POST');
  expect(seg.url).toContain('/contacts/ada%40example.com/segments/seg_download');
});

console.log('\nThe two things that must never be sent');
await test('never sends `unsubscribed`, so it cannot undo an opt-out', async () => {
  stubFetch(created);
  await addAppUserToAudience(ENV, 'ada@example.com');
  restoreFetch();
  // Signing into an app expresses no marketing consent. /subscribe and
  // /waitlist send `unsubscribed: false` because the user just submitted a
  // form; this path has no such moment, and `resendContact` PATCHes with
  // whatever it is handed.
  expect(calls[0].body.unsubscribed).toBeUndefined();
});

await test('never sends `properties`, so it cannot erase real provenance', async () => {
  stubFetch(created);
  await addAppUserToAudience(ENV, 'ada@example.com');
  restoreFetch();
  // Contacts are global by email, so this address may already carry
  // signup_source/os/phone/profession from a website form. A PATCH with a
  // thinner properties map would overwrite them.
  expect(calls[0].body.properties).toBeUndefined();
});

console.log('\nAn existing contact is updated, not duplicated or failed');
await test('falls through to PATCH when the contact already exists', async () => {
  stubFetch((url, _body, init) => ((init && init.method) === 'PATCH' ? created() : alreadyExists()));
  await addAppUserToAudience(ENV, 'ada@example.com');
  restoreFetch();

  const [create, patch] = contactCalls();
  expect(create.method).toBe('POST');
  expect(patch.method).toBe('PATCH');
  // Addressed by email, so no id lookup round-trip.
  expect(patch.url).toContain('ada%40example.com');
  // The PATCH must be just as bare as the POST — this is the write that would
  // actually clobber an existing profile.
  expect(patch.body.unsubscribed).toBeUndefined();
  expect(patch.body.properties).toBeUndefined();

  // THE POINT OF THIS WHOLE CHANGE. `patchResendContact` strips `segments`,
  // because Resend's PATCH /contacts does not accept it — so without the
  // explicit segment call an existing contact would never join the audience,
  // and the feature would silently work only for users who had never visited
  // the website. Which is the minority.
  const seg = segmentCalls()[0];
  expect(seg.method).toBe('POST');
  expect(seg.url).toContain('/contacts/ada%40example.com/segments/seg_download');
});

console.log('\nConfiguration edge cases');
await test('falls back to the shared audience when no download audience is set', async () => {
  stubFetch(created);
  await addAppUserToAudience({ ...ENV, RESEND_AUDIENCE_ID_DOWNLOAD: undefined }, 'ada@example.com');
  restoreFetch();
  expect(contactCalls()[0].body.segments[0].id).toBe('seg_shared');
  expect(segmentCalls()[0].url).toContain('/segments/seg_shared');
});

await test('writes nothing at all when no audience is configured', async () => {
  stubFetch(created);
  await addAppUserToAudience(
    { RESEND_API_KEY: 're_test' },
    'ada@example.com',
  );
  restoreFetch();
  // A contact with no segment would be invisible in Resend's UI — worse than
  // not writing it, because it looks like the feature worked.
  expect(calls.length).toBe(0);
});

await test('a Resend failure is swallowed, never thrown at the webhook', async () => {
  stubFetch(() => ({ status: 500, json: { message: 'boom' } }));
  // Must not reject: this runs under ctx.waitUntil, and a throw there can
  // surface as a failed webhook delivery and make Clerk retry the whole event.
  await addAppUserToAudience(ENV, 'ada@example.com');
  restoreFetch();
  // And it must not push on to the segment call after failing to establish the
  // contact — that would only produce a second, noisier error.
  expect(contactCalls().length).toBe(1);
  expect(segmentCalls().length).toBe(0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
