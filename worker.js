const WRITING_META = {
  '/writing/velocity-visibility': {
    title: 'Your velocity went up. Your visibility went down. — Meridiona',
    description: 'AI tools made everyone faster — but the faster you go, the less you can reconstruct about how the work got done. Why the record of your work has to keep pace with it.',
    canonical: 'https://meridiona.com/writing/velocity-visibility',
  },
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

    // Direct file download: log attribution (OS, geo, referrer, source) then redirect to GitHub.
    if (url.pathname === '/dl') {
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

    // Download landing page: auto-starts the file download (via /dl) and offers a
    // waitlist signup. Works even when opened cold from a shared link elsewhere.
    if (url.pathname === '/download') {
      return downloadPage(env, url);
    }

    const meta = WRITING_META[url.pathname] || WRITING_META[url.pathname.replace(/\/$/, '')];
    if (meta && env.ASSETS) {
      try {
        const base = await env.ASSETS.fetch(new Request(`${url.origin}/`));
        let html = await base.text();
        html = html
          .replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`)
          .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${meta.description}">`)
          .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${meta.title}">`)
          .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${meta.description}">`)
          .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${meta.canonical}">`)
          .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${meta.title}">`)
          .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${meta.description}">`)
          .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${meta.canonical}">`);
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

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: 'Please enter a valid email address.' }, 400);
      }

      const audienceId =
        (source === 'download' && env.RESEND_AUDIENCE_ID_DOWNLOAD) ||
        (source === 'waitlist' && env.RESEND_AUDIENCE_ID_WAITLIST) ||
        env.RESEND_AUDIENCE_ID;

      // Resend contacts only have email/first_name/last_name/properties, and "properties"
      // rejects unregistered keys (see the os-tag revert above) - so last_name carries the
      // OS tag and first_name carries the optional phone number, both just along for the ride.
      const contact = { email, unsubscribed: false };
      if (os) contact.last_name = os.charAt(0).toUpperCase() + os.slice(1);
      if (/^[+\d][\d\s()-]{4,30}$/.test(phone)) contact.first_name = phone;

      try {
        const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contact),
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

// Interstitial download page. Auto-triggers the real file download through /dl
// (which handles attribution), and offers an optional waitlist signup via /subscribe.
function downloadPage(env, url) {
  const q = url.searchParams;
  // Sanitize reflected params (defense against XSS in the reflected HTML/JS).
  const ref = (q.get('ref') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  const did = (q.get('did') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
  const key = env.POSTHOG_KEY || '';
  const host = env.POSTHOG_HOST || 'https://us.i.posthog.com';

  const dlParams = new URLSearchParams();
  if (ref) dlParams.set('ref', ref);
  if (did) dlParams.set('did', did);
  const dlPath = '/dl' + (dlParams.toString() ? `?${dlParams}` : '');

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Downloading Meridian — Meridiona</title>
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
    <svg viewBox="0 0 384 512" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
    Meridian for Mac
  </span>
  <h1>Your download is starting…</h1>
  <p class="sub">macOS · Apple silicon · free</p>

  <p class="label">Want to hear about updates?</p>
  <form id="sub-form">
    <div class="form-row">
      <input id="sub-email" type="email" placeholder="you@company.com" required autocomplete="email" aria-label="Email address">
    </div>
    <p class="phone-hint">📱 Got a number? (optional) So we can text you when we ship fixes, ask what broke, or just say thanks — never spam.</p>
    <div class="form-row">
      <select id="sub-phone-code" aria-label="Country code"></select>
      <input id="sub-phone" type="tel" placeholder="55 5123 4567" aria-label="Phone number (optional)">
    </div>
    <button type="submit">Join →</button>
  </form>
  <p class="msg mono" id="sub-msg">New releases and the occasional note. No spam.</p>

  <div class="divider"></div>
  <p class="fallback">Download didn't start? <a href="${dlPath}" id="dl-fallback">Get Meridian.dmg</a>.</p>
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
    fetch('/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,source:'download',os:'mac',phone:phone})})
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
