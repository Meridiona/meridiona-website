export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
