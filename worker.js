const WRITING_META = {
  '/writing/eval-loop': {
    title: 'More context made my classifier worse, not better — Meridiona',
    description: 'A post-eval workflow that turns LLM classifier failures into a machine-maintained taxonomy — and why removing a context limit made accuracy worse, not better.',
    canonical: 'https://meridiona.com/writing/eval-loop',
  },
  '/writing': {
    title: 'Writing — Meridiona',
    description: 'Technical essays and field notes on AI, engineering, and building intelligent organisations.',
    canonical: 'https://meridiona.com/writing',
  },
};

// Always resolves to the newest release's asset — no version to bump in code.
const DOWNLOAD_URL = 'https://github.com/Meridiona/meridian/releases/latest/download/Meridian.dmg';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // App download: log attribution (OS, geo, referrer, source) then redirect to GitHub.
    if (url.pathname === '/dl' || url.pathname === '/download') {
      ctx.waitUntil(trackDownload(request, url, env));
      return new Response(null, {
        status: 302,
        headers: {
          'Location': DOWNLOAD_URL,
          // Never cache the redirect, or repeat downloads skip the Worker and go uncounted.
          'Cache-Control': 'no-store',
        },
      });
    }

    const meta = WRITING_META[url.pathname] || WRITING_META[url.pathname.replace(/\/$/, '')];
    if (meta && env.ASSETS) {
      try {
        const base = await env.ASSETS.fetch(new Request(`${url.origin}/`));
        let html = await base.text();
        html = html
          .replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`)
          .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${meta.description}">`)
          .replace('</head>', `<link rel="canonical" href="${meta.canonical}"></head>`);
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
      let email;
      try {
        const body = await request.json();
        email = (body.email || '').trim().toLowerCase();
      } catch {
        return json({ error: 'Invalid request.' }, 400);
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: 'Please enter a valid email address.' }, 400);
      }

      try {
        const res = await fetch(`https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, unsubscribed: false }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          // Already subscribed — treat as success
          if (res.status === 409 || err.name === 'already_exists') {
            return json({ success: true });
          }
          console.error('Resend error:', res.status, JSON.stringify(err));
          return json({ error: 'Something went wrong. Please try again.' }, 500);
        }
      } catch (err) {
        console.error('Resend fetch error:', err);
        return json({ error: 'Something went wrong. Please try again.' }, 500);
      }

      return json({ success: true });
    }

    return env.ASSETS.fetch(request);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Fire a server-side PostHog event for every download that flows through /dl.
// No-op until POSTHOG_KEY is configured (wrangler secret / var), so the site is
// safe to ship before analytics is set up.
async function trackDownload(request, url, env) {
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
    asset: 'Meridian.dmg',
    platform: 'macos',
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
