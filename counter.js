// Durable Object backing the public "N updates logged and counting" live
// badge on the landing page (index.html's #live-counter-section, driven by
// assets/js/site.js's LiveCounter poller). One fixed global instance
// (env.COUNTER.idFromName("global") in worker.js) — this is a single
// site-wide counter, not per-user, per-account, or per-session.
//
// GET  — publicly readable, no auth, returns { count }. Never mutates state.
// POST — the only mutation path; increments by 1 and returns the new count.
//        Requires `Authorization: Bearer <COUNTER_INCREMENT_SECRET>` (a
//        `wrangler secret`, see wrangler.jsonc) so only real Meridian
//        clients can bump it. Missing/wrong token → 401.
//
// On first-ever access the persisted value is seeded to SEED_VALUE — there's
// no real history to backfill, so this is an agreed arbitrary starting point.
const SEED_VALUE = 100;

export class Counter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method === 'GET') {
      const count = await this.readCount();
      return json({ count }, 200);
    }
    if (request.method === 'POST') {
      if (!isAuthorized(request, this.env)) {
        return json({ error: 'unauthorized' }, 401);
      }
      const count = await this.incrementCount();
      return json({ count }, 200);
    }
    return json({ error: 'method not allowed' }, 405);
  }

  // Reads the persisted count, seeding it to SEED_VALUE on first-ever access.
  async readCount() {
    const stored = await this.state.storage.get('count');
    if (typeof stored === 'number') return stored;
    await this.state.storage.put('count', SEED_VALUE);
    return SEED_VALUE;
  }

  async incrementCount() {
    const next = (await this.readCount()) + 1;
    await this.state.storage.put('count', next);
    return next;
  }
}

// Public, read-anywhere endpoint — the landing page JS fetches this
// same-origin in production, but CORS is opened wide so the badge also
// works from previews/other hosts without a config change.
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// Constant-time compare so a wrong guess's response time can't be used to
// learn how many leading characters it got right.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(request, env) {
  if (!env.COUNTER_INCREMENT_SECRET) return false;
  const auth = request.headers.get('Authorization') || '';
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token) return false;
  return timingSafeEqual(token, env.COUNTER_INCREMENT_SECRET);
}
