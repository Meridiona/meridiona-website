const WRITING_META = {
  '/writing/eval-loop': {
    title: 'More context made my classifier worse, not better — Meridiona',
    description: 'A post-eval workflow that turns LLM classifier failures into a machine-maintained taxonomy — and why removing a context limit made accuracy worse, not better.',
    canonical: 'https://meridiona.com/writing/eval-loop',
    hash: '#writing-eval-loop',
  },
  '/writing': {
    title: 'Writing — Meridiona',
    description: 'Technical essays and field notes on AI, engineering, and building intelligent organisations.',
    canonical: 'https://meridiona.com/writing',
    hash: '#writing',
  },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const meta = WRITING_META[url.pathname] || WRITING_META[url.pathname.replace(/\/$/, '')];
    if (meta) {
      // Return a self-contained shell with correct metadata for crawlers/HN.
      // JS redirects the user to the SPA hash route so the essay renders.
      const hashUrl = `${url.origin}/${meta.hash}`;
      const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8">
<title>${meta.title}</title>
<meta name="description" content="${meta.description}">
<link rel="canonical" href="${meta.canonical}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;background:#F4F2EC}</style>
<script>location.replace(${JSON.stringify(hashUrl)})</script>
</head><body></body></html>`;
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
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
