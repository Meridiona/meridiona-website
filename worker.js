import { createClerkClient } from '@clerk/backend';
import { verifyWebhook } from '@clerk/backend/webhooks';

// NOTE: the actual desktop-app sign-in is email+OTP, entirely inside the
// Tauri webview (ui/app/setup/signin/EmailCodeForm.tsx, via tauri-plugin-clerk
// talking straight to Clerk's API) — it never reaches this Worker. The routes
// below (/auth/callback, /auth/exchange) are a legacy Google-SSO browser relay
// for a Rust command (tray/src-tauri/src/commands/clerk_signin.rs) that no
// longer exists in the app; kept only because nothing currently proves it's
// safe to delete. Do not hang new sign-in logic off them — see /webhooks/clerk
// below instead, which is what the app's actual sign-in flow can reach.
// Routed by hostname so none of the rest of this file's logic is touched.
const AUTH_HOSTNAME = 'auth.meridiona.com';
// Clerk's Account Portal for the Meridian app: the real, hosted Google
// sign-in page. NOT a secret, just config; update once production has its
// own Account Portal domain (see the Meridian repo's setup-wizard plan).
const ACCOUNT_PORTAL_URL = 'https://touching-unicorn-15.accounts.dev';
// One-time exchange token TTL, long enough for the browser round-trip
// through Google + Clerk, short enough that a leaked/logged URL is useless
// within minutes.
const AUTH_TOKEN_TTL_SECONDS = 120;

const WRITING_META = {
  '/writing/velocity-visibility': {
    title: 'Your velocity went up. Your visibility went down. · Meridiona',
    description: 'AI tools made everyone faster, but the faster you go, the less you can reconstruct about how the work got done. Why the record of your work has to keep pace with it.',
    canonical: 'https://meridiona.com/writing/velocity-visibility',
  },
  '/writing/eval-loop': {
    title: 'More context made my classifier worse, not better · Meridiona',
    description: 'A post-eval workflow that turns LLM classifier failures into a machine-maintained taxonomy, and why removing a context limit made accuracy worse, not better.',
    canonical: 'https://meridiona.com/writing/eval-loop',
  },
  '/writing': {
    title: 'Writing · Meridiona',
    description: 'Technical essays and field notes on AI, engineering, and building intelligent organisations.',
    canonical: 'https://meridiona.com/writing',
  },
};

// Single source of truth for the nav is the <nav> block in index.html; writing
// pages hold a `<!--NAV-->` placeholder instead of duplicating the markup.
// This pulls it live off '/' and rewrites the handful of in-page anchors
// (index.html uses "#top"/"#why"/"#faq") into path-rooted links that work from
// any /writing/* URL, plus marks the Writing nav item active.
const NAV_RE = /<nav class="nav" role="navigation" aria-label="Main">[\s\S]*?<\/nav>/;
let cachedNav = null;
async function canonicalWritingNav(env, origin) {
  if (cachedNav) return cachedNav;
  const home = await env.ASSETS.fetch(new Request(`${origin}/`));
  const match = (await home.text()).match(NAV_RE);
  if (!match) return null;
  cachedNav = match[0]
    .replace('href="#top"', 'href="/"')
    .replace('href="#why"', 'href="/#why"')
    .replace('href="#faq"', 'href="/#faq"')
    .replace('<a href="/writing" class="nav__link">Writing</a>', '<a href="/writing" class="nav__link" style="color:var(--ink)">Writing</a>');
  return cachedNav;
}

// The product waitlist (the "Join the waitlist" section above the footer on
// index.html). Distinct from /subscribe's `source: 'waitlist'`, which only ever
// meant "ping me when my OS ships", this one collects a real lead profile.
const PROFESSIONS = ['pm', 'investor', 'dev', 'founder', 'other'];
// Resend Contact Properties must be registered once before they can be set on a
// contact (POST https://api.resend.com/contact-properties, type "string"),
// unregistered keys are rejected outright. These are the keys this Worker sets;
// see README/`docs` for the one-time curl. resendContact() degrades gracefully
// if they're missing rather than dropping a signup.
const WAITLIST_PROPERTIES = ['profession', 'profession_other', 'phone', 'linkedin', 'comment', 'signup_source', 'os'];
// The free-text "anything else?" box. Capped well under any property-size limit;
// the notification email carries the same text, so nothing is lost either way.
const COMMENT_MAX = 500;
const WAITLIST_NOTIFY_TO = 'company@meridiona.com';
// Must be on a domain verified for sending in Resend, or /emails 403s.
const WAITLIST_NOTIFY_FROM = 'Meridian Waitlist <waitlist@meridiona.com>';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Desktop-app sign-ins, driven by Clerk webhooks (see handleClerkWebhook).
const LOGIN_NOTIFY_TO = 'company@meridiona.com';
const LOGIN_NOTIFY_FROM = 'Meridian Sign-ins <notify@meridiona.com>';
// Sent from company@ rather than a hello@/info@/news@-style prefix — those
// are known Gmail Promotions-tab triggers, and company@ is also a real inbox
// we read, so replies don't need a separate reply_to override either.
const WELCOME_EMAIL_FROM = 'Meridian <company@meridiona.com>';
// How close a session's created_at has to be to its user's created_at to call
// it "just signed up" rather than "logging back in", purely for the notify
// email's wording — the welcome email itself doesn't need this, it's driven
// by the dedicated user.created event, which only ever fires once per user.
const NEW_USER_WINDOW_MS = 5 * 60 * 1000;

// Always resolves to the newest release's asset; no version to bump in code.
// Filenames must match the meridian repo's actual CI-published asset names
// exactly (release.yml), or /dl 404s against a real GitHub redirect.
const DOWNLOAD_URL = 'https://github.com/Meridiona/meridian/releases/latest/download/Meridian-aarch64.dmg';
// The Windows NSIS installer, published to the same release by the meridian
// repo's windows-release CI job under this stable name.
const DOWNLOAD_URL_WINDOWS = 'https://github.com/Meridiona/meridian/releases/latest/download/Meridian-x86_64-setup.exe';

// Which release asset a download request resolves to. `?os=windows` selects the
// installer; anything else (including no param) stays on the macOS DMG, so every
// existing /dl link keeps working unchanged.
function downloadTarget(os) {
  return os === 'windows'
    ? { url: DOWNLOAD_URL_WINDOWS, asset: 'Meridian-x86_64-setup.exe', platform: 'windows' }
    : { url: DOWNLOAD_URL, asset: 'Meridian-aarch64.dmg', platform: 'macos' };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const response = await handle(request, url, env, ctx);
    return withSecurityHeaders(response, url);
  },
};

async function handle(request, url, env, ctx) {
    // www to apex, 301, preserving path + query; one canonical host.
    if (url.hostname === 'www.meridiona.com') {
      url.hostname = 'meridiona.com';
      return Response.redirect(url.toString(), 301);
    }

    // Google-SSO relay, isolated by hostname, never touches the routes below.
    if (url.hostname === AUTH_HOSTNAME) {
      if (url.pathname === '/auth/callback') return handleAuthCallback(request, url, env);
      if (url.pathname === '/auth/exchange') return handleAuthExchange(url, env);
      // Clerk-initiated, not browser-initiated — the one thing on this
      // hostname the actual (in-app, email+OTP) sign-in flow can reach, since
      // Clerk itself calls it server-to-server on every real user/session
      // event regardless of how the app authenticated them.
      if (url.pathname === '/webhooks/clerk' && request.method === 'POST') return handleClerkWebhook(request, env, ctx);
      return json({ error: 'not found' }, 404);
    }

    // Direct file download: log attribution (OS, geo, referrer, source) then redirect to GitHub.
    // `?os=windows` serves the installer; absent/anything else serves the DMG.
    if (url.pathname === '/dl') {
      const target = downloadTarget(url.searchParams.get('os'));
      ctx.waitUntil(trackDownload(request, url, env, target));
      return new Response(null, {
        status: 302,
        headers: {
          'Location': target.url,
          // Never cache the redirect, or repeat downloads skip the Worker and go uncounted.
          'Cache-Control': 'no-store',
        },
      });
    }

    // Download landing page: auto-starts the file download (via /dl) and offers a
    // waitlist signup. Works even when opened cold from a shared link elsewhere.
    if (url.pathname === '/download') {
      return downloadPage(env, url);
    }

    const isWritingPage = url.pathname === '/writing' || url.pathname.startsWith('/writing/');
    if (isWritingPage && env.ASSETS) {
      try {
        const base = await env.ASSETS.fetch(new Request(`${url.origin}${url.pathname}`));
        let html = await base.text();

        const meta = WRITING_META[url.pathname] || WRITING_META[url.pathname.replace(/\/$/, '')];
        if (meta) {
          html = html
            .replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`)
            .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${meta.description}">`)
            .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${meta.title}">`)
            .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${meta.description}">`)
            .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${meta.canonical}">`)
            .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${meta.title}">`)
            .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${meta.description}">`)
            .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${meta.canonical}">`);
        }

        // The nav lives only in index.html; writing pages carry a `<!--NAV-->`
        // placeholder instead of their own copy, so there's one source of truth
        // to edit rather than five drifting duplicates.
        const nav = await canonicalWritingNav(env, url.origin);
        if (nav) html = html.replace('<!--NAV-->', nav);

        return new Response(html, {
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'public, max-age=300',
          },
        });
      } catch {
        // fall through to default asset serving
      }
    }

    if (url.pathname === '/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }

    if (url.pathname === '/waitlist' && request.method === 'POST') {
      return handleWaitlist(request, env);
    }

    return env.ASSETS.fetch(request);
}

// Applies a baseline of security headers to every response this Worker returns
// (HSTS, CSP, clickjacking/MIME-sniffing protection, etc; see ShipCheck's
// "Fix Before Launch" security findings). CSP is relaxed with 'unsafe-inline'
// for style/script only on routes that are known to render inline <style>/
// <script> (the /download and auth.meridiona.com interstitial pages); every
// other route (the static site, /writing/*, /subscribe, /dl) has none, so it
// gets the strict policy.
function withSecurityHeaders(response, url) {
  const needsInlineHtml = url.pathname === '/download' || url.hostname === AUTH_HOSTNAME;
  const scriptSrc = needsInlineHtml ? "script-src 'self' 'unsafe-inline' https://us-assets.i.posthog.com https://*.i.posthog.com"
    : "script-src 'self' https://us-assets.i.posthog.com https://*.i.posthog.com";
  const csp = [
    "default-src 'self'",
    scriptSrc,
    // 'unsafe-inline' here (regardless of route) because the static markup uses inline style="..." attributes throughout
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.i.posthog.com https://*.posthog.com",
    // The hidden #dl-frame iframe (site.js's download modal) points at /dl,
    // which 302s to github.com and then to GitHub's release-asset CDN;
    // frame-src is checked against every hop of that redirect chain, not just
    // the initial same-origin request, so both hosts must be allowed or the
    // browser silently kills the download partway through.
    "frame-src 'self' https://github.com https://*.githubusercontent.com",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  const headers = new Headers(response.headers);
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('Content-Security-Policy', csp);
  headers.set('X-Frame-Options', 'SAMEORIGIN'); // not DENY: index.html and demo.html embed /demo.html in a same-origin <iframe>
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Trims an untrusted string field to a sane maximum. Over-long input is cut
// rather than rejected: a pasted LinkedIn URL with tracking junk on the end
// shouldn't cost someone their signup.
function field(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

// The "ping me about updates" email capture behind the download modal and the
// /download interstitial. Fire-and-forget by design on the client side: the
// download has already started by the time this is called, so site.js doesn't
// wait on the result.
// Exported for tests/waitlist.test.js, which drives it against a stubbed fetch.
export async function handleSubscribe(request, env) {
  let email, source, os, phone;
  try {
    const body = await request.json();
    email = (body.email || '').trim().toLowerCase();
    // 'download' = already has (or is getting) the Mac build; 'waitlist' = waiting on an
    // unreleased OS. Anything else/missing falls back to the shared audience below.
    source = body.source === 'download' || body.source === 'waitlist' ? body.source : null;
    os = ['mac', 'windows', 'linux'].includes(body.os) ? body.os : null;
    // Optional; a malformed value is dropped rather than failing the whole signup.
    phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 32) : '';
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  if (!email || !EMAIL_RE.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  const segmentId =
    (source === 'download' && env.RESEND_AUDIENCE_ID_DOWNLOAD) ||
    (source === 'waitlist' && env.RESEND_AUDIENCE_ID_WAITLIST) ||
    env.RESEND_AUDIENCE_ID;

  // OS and phone used to be smuggled through last_name/first_name because
  // Resend had nowhere else to put them. Resend's Nov-2025 contacts release
  // added real Contact Properties (see WAITLIST_PROPERTIES), so they now go
  // where they belong, which also stops a /waitlist signup from clobbering
  // a real name with a phone number, contacts being global by email.
  const properties = { signup_source: source || 'download-modal' };
  if (os) properties.os = os;
  if (/^[+\d][\d\s()-]{4,30}$/.test(phone)) properties.phone = phone;

  const result = await resendContact(env, { email, unsubscribed: false, properties }, segmentId);
  if (!result.ok) {
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }

  return json({ success: true });
}

// The product-waitlist signup behind index.html's "Join the waitlist" section.
// Unlike /subscribe (fire-and-forget: the download already started, so a failed
// write is invisible and tolerable), a failure here loses a lead outright, so
// this awaits both writes and reports the real outcome to the form.
// Exported for tests/waitlist.test.js, which drives it against a stubbed fetch.
export async function handleWaitlist(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const name = field(body.name, 120);
  const email = field(body.email, 200).toLowerCase();
  const profession = field(body.profession, 40).toLowerCase();
  const professionOther = field(body.professionOther, 120);
  const phone = field(body.phone, 32);
  const linkedin = field(body.linkedin, 300);
  const comment = field(body.comment, COMMENT_MAX);

  if (!name) return json({ error: 'Please tell us your name.' }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  if (!PROFESSIONS.includes(profession)) return json({ error: 'Please pick what you do.' }, 400);
  if (profession === 'other' && !professionOther) {
    return json({ error: 'Tell us what you do so we know who we’re talking to.' }, 400);
  }
  if (linkedin && !/^(https?:\/\/)?([\w-]+\.)?linkedin\.com\/[\w\-./%?=&]+$/i.test(linkedin)) {
    return json({ error: 'That doesn’t look like a LinkedIn URL.' }, 400);
  }

  // Split on the first space so broadcasts can greet {{FIRST_NAME}} properly; a
  // single-word name just leaves last_name empty.
  const space = name.indexOf(' ');
  const firstName = space === -1 ? name : name.slice(0, space);
  const lastName = space === -1 ? '' : name.slice(space + 1).trim();

  // Only fields that were actually filled in. An empty value here would be a
  // real write on a resubmit: blanking the LinkedIn URL someone gave us the
  // first time, and it's also what a rejected empty string would cost: the
  // fallback in resendContact() drops the whole properties map, not one key.
  const properties = { profession, signup_source: 'site-waitlist' };
  if (profession === 'other') properties.profession_other = professionOther;
  if (phone) properties.phone = phone;
  if (linkedin) properties.linkedin = linkedin;
  if (comment) properties.comment = comment;

  const contact = {
    email,
    first_name: firstName,
    last_name: lastName,
    unsubscribed: false,
    properties,
  };

  // Both in flight at once, and the signup counts as saved if *either* lands:
  // the Resend contact is the list, the notification email is the paper trail.
  // Only losing both is a real failure worth showing the user.
  const [contactResult, notified] = await Promise.all([
    resendContact(env, contact, env.RESEND_AUDIENCE_ID_PRODUCT_WAITLIST || env.RESEND_AUDIENCE_ID),
    notifyWaitlistSignup(env, { name, email, profession, professionOther, phone, linkedin, comment }),
  ]);

  if (!contactResult.ok && !notified) {
    return json({ error: 'Something went wrong on our end. Please try again.' }, 500);
  }
  return json({ success: true });
}

// Creates or updates a Resend contact. Two failure modes are handled rather
// than surfaced: an existing contact (PATCH it, so a resubmit refreshes the
// profile instead of 409ing), and an account where WAITLIST_PROPERTIES haven't
// been registered yet (retry bare, so the email address is still captured).
async function resendContact(env, contact, segmentId) {
  const payload = { ...contact };
  if (segmentId) payload.segments = [segmentId];

  let result = await postResendContact(env, payload);

  if (result.exists) {
    return patchResendContact(env, payload);
  }
  if (!result.ok && result.propertyError && payload.properties) {
    console.error(`Resend rejected contact properties, retrying without them. Register these once via POST /contact-properties: ${WAITLIST_PROPERTIES.join(', ')}.`, result.detail);
    delete payload.properties;
    result = await postResendContact(env, payload);
    if (result.exists) return { ok: true };
  }
  if (!result.ok) console.error('Resend contact error:', result.status, result.detail);
  return result;
}

async function postResendContact(env, payload) {
  try {
    const res = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };

    const err = await res.json().catch(() => ({}));
    const detail = JSON.stringify(err);
    if (res.status === 409 || err.name === 'already_exists') return { ok: false, exists: true, detail };
    return {
      ok: false,
      status: res.status,
      detail,
      // 422/400 with "property" in the message is the unregistered-key case.
      propertyError: (res.status === 422 || res.status === 400) && /propert/i.test(detail),
    };
  } catch (err) {
    console.error('Resend contact fetch error:', err);
    return { ok: false, status: 0, detail: String(err) };
  }
}

// Contacts are addressable by email as well as id, so no lookup round-trip.
// `unsubscribed` is deliberately dropped: it's fine to set on creation, but
// sending it on an update would silently re-subscribe someone who had opted
// out. `segments` isn't settable here either; an existing contact keeps the
// segments it already had.
async function patchResendContact(env, payload) {
  const { email, segments, unsubscribed, ...updates } = payload;
  try {
    const res = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (res.ok) return { ok: true };
    const detail = JSON.stringify(await res.json().catch(() => ({})));
    console.error('Resend contact update error:', res.status, detail);
    // The contact exists either way, which is most of what we wanted; only the
    // refreshed profile is lost, so don't fail the signup over it.
    return { ok: true, stale: true, detail };
  } catch (err) {
    console.error('Resend contact update fetch error:', err);
    return { ok: false, status: 0, detail: String(err) };
  }
}

// Emails the new lead to the team inbox. Requires a Resend-verified sending
// domain for WAITLIST_NOTIFY_FROM; returns false (rather than throwing) if that
// isn't set up, leaving the contact write as the record.
async function notifyWaitlistSignup(env, lead) {
  const label = lead.profession === 'other' ? `Other: ${lead.professionOther}` : lead.profession.toUpperCase();
  const rows = [
    ['Name', lead.name],
    ['Email', lead.email],
    ['Profession', label],
    ['Phone', lead.phone || 'N/A'],
    ['LinkedIn', lead.linkedin || 'N/A'],
    ['Comment', lead.comment || 'N/A'],
  ];
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: WAITLIST_NOTIFY_FROM,
        to: [WAITLIST_NOTIFY_TO],
        reply_to: lead.email,
        subject: `Waitlist: ${lead.name} (${label})`,
        text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
      }),
    });
    if (res.ok) return true;
    console.error('Resend notification error:', res.status, JSON.stringify(await res.json().catch(() => ({}))));
    return false;
  } catch (err) {
    console.error('Resend notification fetch error:', err);
    return false;
  }
}

// Picks the address a Clerk UserJSON payload actually treats as primary,
// falling back to the first on record — Clerk lets a user hold several, and
// the webhook payload gives no shortcut for "the one that matters".
function primaryEmail(user) {
  if (!user) return null;
  const match = user.email_addresses?.find((e) => e.id === user.primary_email_address_id);
  return match?.email_address || user.email_addresses?.[0]?.email_address || null;
}

// Sign-up is email+OTP only (EmailCodeForm.tsx never collects a name), so
// Clerk's first_name is always null — this guesses one from the address's
// local part instead. Trailing digits and separator-delimited suffixes are
// stripped so "akarsh.kumar@…"/"akarsh+test@…" both read as "Akarsh"; returns
// null (not a raw local part) when nothing legible is left, e.g. "01@…".
function guessNameFromEmail(email) {
  const local = email?.split('@')[0];
  if (!local) return null;
  const first = local.split(/[._+-]/)[0].replace(/\d+$/, '');
  if (!first) return null;
  return first[0].toUpperCase() + first.slice(1).toLowerCase();
}

// Pings the team inbox on every real sign-in, so a login isn't just a silent
// event nobody sees. Called via ctx.waitUntil from handleClerkWebhook — never
// blocks the webhook response Clerk is waiting on.
async function notifyLogin(env, { email, userId, isNewUser }) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: LOGIN_NOTIFY_FROM,
        to: [LOGIN_NOTIFY_TO],
        subject: `${isNewUser ? 'New sign-up' : 'Sign-in'}: ${email || userId}`,
        text: `${email || '(no email on record)'}\nClerk user id: ${userId}\n${isNewUser ? 'First time signing in.' : 'Returning user.'}`,
      }),
    });
    if (!res.ok) console.error('Resend login-notify error:', res.status, JSON.stringify(await res.json().catch(() => ({}))));
  } catch (err) {
    console.error('Resend login-notify fetch error:', err);
  }
}

// Welcomes a brand-new Clerk user. Driven by user.created, which fires
// exactly once per user no matter how they authenticated, so no separate
// dedup/freshness check is needed here the way a login-triggered path would.
async function sendWelcomeEmail(env, email, name) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: WELCOME_EMAIL_FROM,
        to: [email],
        // Plain and factual on purpose — "Welcome to the family"-style
        // phrasing reads as marketing copy to Gmail's Promotions classifier
        // (confirmed: it landed in Promotions with that subject).
        subject: name ? `You're signed in, ${name}` : "You're signed in to Meridian",
        text: [
          name ? `Hey ${name},` : 'Hey,',
          '',
          "Thanks for signing in, and honestly, just thanks for giving us a shot in the first place.",
          '',
          "We know letting something new into your day isn't nothing, so we don't take it lightly. If anything ever feels off, confusing, or just not quite right, tell us, we genuinely want to hear it. And if something about it makes your day even a little easier, we'd love to hear that too.",
          '',
          "Reply to this email any time. A real person reads these, not a bot.",
          '',
          'Glad you\'re here.',
          '',
          'The Meridian team',
        ].join('\n'),
      }),
    });
    if (!res.ok) console.error('Resend welcome-email error:', res.status, JSON.stringify(await res.json().catch(() => ({}))));
  } catch (err) {
    console.error('Resend welcome-email fetch error:', err);
  }
}

// The single source of truth for "someone signed in" — Clerk calls this
// server-to-server on every real user/session event, so it's the one place
// in this Worker that reliably sees a sign-in regardless of which client
// (desktop app, web, any future surface) or sign-in method (email+OTP today)
// Clerk used. Signature verification is mandatory: this endpoint is public,
// and an unverified POST here would let anyone trigger arbitrary "welcome"/
// "login" emails.
async function handleClerkWebhook(request, env, ctx) {
  let evt;
  try {
    evt = await verifyWebhook(request, { signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET });
  } catch (err) {
    console.error('Clerk webhook verification failed:', err);
    return json({ error: 'invalid signature' }, 400);
  }

  if (evt.type === 'user.created') {
    const email = primaryEmail(evt.data);
    // Prefer a real first_name if sign-up ever collects one; email+OTP today
    // never does, so this is guessNameFromEmail's fallback in practice.
    const name = evt.data.first_name?.trim() || guessNameFromEmail(email);
    if (email) ctx.waitUntil(sendWelcomeEmail(env, email, name));
    else console.error('Clerk user.created with no email on record:', evt.data.id);
  } else if (evt.type === 'session.created') {
    const user = evt.data.user;
    const email = primaryEmail(user);
    const isNewUser = !!user && evt.data.created_at - user.created_at < NEW_USER_WINDOW_MS;
    ctx.waitUntil(notifyLogin(env, { email, userId: evt.data.user_id, isNewUser }));
  }

  return json({ received: true });
}

// Validates the `port` query param the desktop app passed through the whole
// flow; it's what we redirect the browser back to, so it must be a real
// ephemeral TCP port, not attacker-controlled input reflected into a redirect.
// Exported for tests/auth-relay.test.js (the Clerk-dependent handlers below
// aren't unit-tested; they need a live Clerk instance).
export function isValidLoopbackPort(raw) {
  if (!raw || !/^\d{1,5}$/.test(raw)) return false;
  const n = Number(raw);
  return n >= 1024 && n <= 65535;
}

// The Meridian desktop app's Google-SSO handoff. Landed on by the browser
// after the user signs in on Clerk's Account Portal (the primary domain);
// this hostname is registered as a Clerk satellite domain, so
// `authenticateRequest` with `satelliteAutoSync: true` completes the
// handshake and syncs the session here automatically. See
// tray/src-tauri/src/commands/clerk_signin.rs for the desktop side.
async function handleAuthCallback(request, url, env) {
  const port = url.searchParams.get('port');
  const state = url.searchParams.get('state');
  if (!isValidLoopbackPort(port)) return json({ error: 'invalid or missing port' }, 400);
  if (!state) return json({ error: 'missing state' }, 400);

  const clerkClient = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  });
  const requestState = await clerkClient.authenticateRequest(request, {
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    authorizedParties: [ACCOUNT_PORTAL_URL, `https://${AUTH_HOSTNAME}`],
    isSatellite: true,
    domain: AUTH_HOSTNAME,
    satelliteAutoSync: true,
    signInUrl: `${ACCOUNT_PORTAL_URL}/sign-in`,
  });

  // Mid-handshake: Clerk needs one more round-trip to finish syncing the
  // session from the primary domain. Forward its headers verbatim (they
  // carry the redirect that continues the dance); we'll see this same
  // request again once it completes.
  if (requestState.status === 'handshake') {
    return new Response(null, { status: 307, headers: requestState.headers });
  }

  if (!requestState.isAuthenticated) {
    // Not signed in yet (e.g. this URL was opened directly, or the handshake
    // came back empty), send them to sign in, preserving our own callback
    // URL as the post-sign-in redirect so they land back here.
    const callbackUrl = `https://${AUTH_HOSTNAME}${url.pathname}?${url.searchParams.toString()}`;
    const signInUrl = `${ACCOUNT_PORTAL_URL}/sign-in?redirect_url=${encodeURIComponent(callbackUrl)}`;
    return Response.redirect(signInUrl, 302);
  }

  const auth = requestState.toAuth();
  const user = await clerkClient.users.getUser(auth.userId);
  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) {
    console.error('Clerk user has no primary email:', auth.userId);
    return json({ error: 'signed-in user has no email address' }, 500);
  }

  const token = crypto.randomUUID();
  await env.AUTH_TOKENS.put(
    token,
    JSON.stringify({ email, userId: auth.userId }),
    { expirationTtl: AUTH_TOKEN_TTL_SECONDS },
  );

  const finish = new URL(`http://127.0.0.1:${port}/finish`);
  finish.searchParams.set('token', token);
  finish.searchParams.set('state', state);
  return Response.redirect(finish.toString(), 302);
}

// Server-to-server redemption of the one-time token minted above; called by
// the desktop app's loopback listener, never by the browser. Single-use: the
// token is deleted on first successful read, so a leaked/logged callback URL
// (which only the browser and the desktop app ever see) can't be replayed.
// Exported for tests/auth-relay.test.js (exercised against a fake KV).
export async function handleAuthExchange(url, env) {
  const token = url.searchParams.get('token');
  if (!token) return json({ error: 'missing token' }, 400);
  const raw = await env.AUTH_TOKENS.get(token);
  if (!raw) return json({ error: 'invalid or expired token' }, 400);
  await env.AUTH_TOKENS.delete(token);
  const data = JSON.parse(raw);
  return json({ email: data.email, userId: data.userId });
}

// Interstitial download page. Auto-triggers the real file download through /dl
// (which handles attribution), and offers an optional waitlist signup via /subscribe.
function downloadPage(env, url) {
  const q = url.searchParams;
  // Sanitize reflected params (defense against XSS in the reflected HTML/JS).
  const ref = (q.get('ref') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  const did = (q.get('did') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
  const key = env.POSTHOG_KEY || '';
  const host = env.POSTHOG_HOST || 'https://us.i.posthog.com';

  // `?os=windows` renders the Windows installer copy/link; anything else (including
  // no param) stays on the macOS DMG, matching downloadTarget()'s default in /dl.
  const isWindows = q.get('os') === 'windows';
  const target = downloadTarget(isWindows ? 'windows' : 'mac');

  const dlParams = new URLSearchParams();
  if (ref) dlParams.set('ref', ref);
  if (did) dlParams.set('did', did);
  if (isWindows) dlParams.set('os', 'windows');
  const dlPath = '/dl' + (dlParams.toString() ? `?${dlParams}` : '');

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Downloading Meridian for ${isWindows ? 'Windows' : 'Mac'} · Meridiona</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
  :root{--paper:#F4F2EC;--ink:#161413;--ink-3:#6b665f;--ink-4:#8a857d;--accent:#C9442B;--line:rgba(22,20,19,0.12)}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;background:var(--paper);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;
    display:flex;align-items:center;justify-content:center;padding:24px;-webkit-font-smoothing:antialiased}
  .card{max-width:460px;width:100%;text-align:center}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  .badge{display:inline-flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.06em;
    text-transform:uppercase;color:var(--ink-4)}
  h1{font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.12;margin:18px 0 8px;letter-spacing:-.01em}
  .sub{font-size:14px;color:var(--ink-3);margin:0 0 30px}
  .label{font-size:14px;color:var(--ink);margin:0 0 12px}
  form{display:flex;flex-direction:column;gap:8px;max-width:390px;margin:0 auto}
  .form-row{display:flex;gap:8px}
  .phone-hint{font-size:11px;color:var(--ink-4);margin:0;text-align:left}
  input,select{flex:1;padding:12px 16px;border-radius:999px;border:1px solid var(--line);
    background:#fff;font-size:14px;color:var(--ink);outline:none}
  select{flex:0 0 116px;padding:12px 8px;font-size:12.5px}
  input:focus,select:focus{border-color:var(--ink)}
  button{padding:12px 20px;border-radius:999px;border:0;background:var(--ink);color:var(--paper);
    font-size:14px;cursor:pointer;white-space:nowrap}
  button:hover{opacity:.9}
  .msg{min-height:1.3em;margin-top:12px;font-size:12px;color:var(--ink-4)}
  .divider{margin:28px auto;height:1px;width:56px;background:var(--line)}
  .fallback{font-size:12px;color:var(--ink-4);margin:0}
  .fallback a{color:var(--accent)}
</style>
</head>
<body>
<div class="card">
  <span class="badge mono">
    ${isWindows
      ? '<svg viewBox="0 0 448 512" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z"/></svg>'
      : '<svg viewBox="0 0 384 512" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>'}
    Meridian for ${isWindows ? 'Windows' : 'Mac'}
  </span>
  <h1>Your download is starting…</h1>
  <p class="sub">${isWindows ? 'Windows 10/11 · 64-bit' : 'macOS · Apple silicon'} · free</p>

  <p class="label">Want to hear about updates?</p>
  <form id="sub-form">
    <div class="form-row">
      <input id="sub-email" type="email" placeholder="you@company.com" required autocomplete="email" aria-label="Email address">
    </div>
    <p class="phone-hint">📱 Got a number? (optional) So we can text you when we ship fixes, ask what broke, or just say thanks. Never spam.</p>
    <div class="form-row">
      <select id="sub-phone-code" aria-label="Country code"></select>
      <input id="sub-phone" type="tel" placeholder="55 5123 4567" aria-label="Phone number (optional)">
    </div>
    <button type="submit">Join →</button>
  </form>
  <p class="msg mono" id="sub-msg">New releases and the occasional note. No spam.</p>

  <div class="divider"></div>
  <p class="fallback">Download didn't start? <a href="${dlPath}" id="dl-fallback">Get ${target.asset}</a>.</p>
</div>

<iframe id="dl-frame" style="display:none" title="download" aria-hidden="true"></iframe>
<script>
(function(){
  var DL = ${JSON.stringify(dlPath)};
  var KEY = ${JSON.stringify(key)};
  var HOST = ${JSON.stringify(host)};
  var REF = ${JSON.stringify(ref)};
  if (KEY) {
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init(KEY,{api_host:HOST,defaults:"2026-05-30",person_profiles:"identified_only"});
    try{ posthog.capture('download_page_viewed',{ref:REF}); }catch(e){}
  }
  function startDownload(){
    var url = DL;
    try {
      if (window.posthog && posthog.get_distinct_id && url.indexOf('did=')===-1) {
        var d = posthog.get_distinct_id();
        if (d) url += (url.indexOf('?')===-1?'?':'&') + 'did=' + encodeURIComponent(d);
      }
    } catch(e){}
    var frame = document.getElementById('dl-frame');
    if (frame) frame.src = url;
    var fb = document.getElementById('dl-fallback');
    if (fb) fb.setAttribute('href', url);
  }
  // Small delay so PostHog can boot and set a distinct_id before we fire /dl.
  setTimeout(startDownload, 400);

  var COUNTRY_CODES = [
    ['+1','US/Canada','201 555 0123'],['+44','UK','7911 123456'],['+91','India','98765 43210'],
    ['+61','Australia','412 345 678'],['+49','Germany','1512 3456789'],['+33','France','6 12 34 56 78'],
    ['+81','Japan','90 1234 5678'],['+82','South Korea','10 1234 5678'],['+86','China','131 2345 6789'],
    ['+65','Singapore','8123 4567'],['+971','UAE','50 123 4567'],['+31','Netherlands','6 12345678'],
    ['+34','Spain','612 345 678'],['+39','Italy','312 345 6789'],['+46','Sweden','70 123 45 67'],
    ['+41','Switzerland','78 123 45 67'],['+52','Mexico','55 1234 5678'],['+55','Brazil','11 91234 5678'],
    ['+27','South Africa','71 123 4567'],['+64','New Zealand','21 123 4567'],['+63','Philippines','917 123 4567'],
    ['+62','Indonesia','812 3456 789'],['+92','Pakistan','301 2345678'],['+880','Bangladesh','1712 345678']
  ];
  var COUNTRY_CODE_PLACEHOLDERS = {};
  COUNTRY_CODES.forEach(function(c){ COUNTRY_CODE_PLACEHOLDERS[c[0]] = c[2]; });
  var codeSelect = document.getElementById('sub-phone-code');
  var phoneInput = document.getElementById('sub-phone');
  codeSelect.innerHTML = COUNTRY_CODES.map(function(c){ return '<option value="' + c[0] + '">' + c[0] + ' ' + c[1] + '</option>'; }).join('');
  phoneInput.placeholder = COUNTRY_CODE_PLACEHOLDERS[codeSelect.value] || '';
  codeSelect.addEventListener('change', function(){
    phoneInput.placeholder = COUNTRY_CODE_PLACEHOLDERS[codeSelect.value] || '';
  });

  var form = document.getElementById('sub-form');
  var msg = document.getElementById('sub-msg');
  form.addEventListener('submit', function(ev){
    ev.preventDefault();
    var email = document.getElementById('sub-email').value.trim();
    var phoneDigits = document.getElementById('sub-phone').value.trim();
    var phone = phoneDigits ? (codeSelect.value + ' ' + phoneDigits) : '';
    msg.textContent = 'Joining…';
    fetch('/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,source:'download',os:${JSON.stringify(isWindows ? 'windows' : 'mac')},phone:phone})})
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
      .then(function(res){
        if(res.ok && res.j && res.j.success){
          msg.textContent = "You're on the list. Talk soon.";
          form.style.display='none';
          if(window.posthog){ try{ posthog.capture('waitlist_signup',{ref:REF, source:'download_page'}); }catch(e){} }
        } else {
          msg.textContent = (res.j && res.j.error) ? res.j.error : 'Something went wrong. Please try again.';
        }
      })
      .catch(function(){ msg.textContent = 'Something went wrong. Please try again.'; });
  });
})();
</script>
</body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' },
  });
}

// Fire a server-side PostHog event for every download that flows through /dl.
// No-op until POSTHOG_KEY is configured (wrangler secret / var), so the site is
// safe to ship before analytics is set up.
async function trackDownload(request, url, env, target = downloadTarget(url.searchParams.get('os'))) {
  const key = env.POSTHOG_KEY;
  if (!key) return;

  const host = env.POSTHOG_HOST || 'https://us.i.posthog.com';
  const ua = request.headers.get('User-Agent') || '';
  const cf = request.cf || {};
  const q = url.searchParams;

  // ?ref= (or utm_source) is the deterministic channel tag you control (hn/reddit/…).
  const ref = q.get('ref') || q.get('utm_source') || null;
  // Reuse the browser's PostHog id if the button passed it, so the server event
  // joins the same person/session; otherwise keep it person-less and anonymous.
  const did = q.get('did');

  const properties = {
    $lib: 'meridiona-worker',
    $current_url: url.href,
    $os: parseOS(ua),
    $browser: parseBrowser(ua),
    $raw_user_agent: ua,
    $referrer: request.headers.get('Referer') || '$direct',
    ref,
    utm_source: q.get('utm_source') || null,
    utm_medium: q.get('utm_medium') || null,
    utm_campaign: q.get('utm_campaign') || null,
    $geoip_country_name: cf.country || null,
    $geoip_city_name: cf.city || null,
    $geoip_subdivision_1_name: cf.region || null,
    $geoip_time_zone: cf.timezone || null,
    asset: target.asset,
    platform: target.platform,
  };
  if (!did) properties.$process_person_profile = false;

  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event: 'app_download',
        distinct_id: did || crypto.randomUUID(),
        properties,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error('PostHog capture failed:', err);
  }
}

function parseOS(ua) {
  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'Mac OS X';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

function parseBrowser(ua) {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'Unknown';
}
