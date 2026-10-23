export { LiveStats } from './live-stats.mjs';
export { ChatRoom } from './chat-room.mjs';
import { chat } from './chat.mjs';
import { liveStats } from './live-stats.mjs';
// cloudflare worker for jasontang.dev. everything is the static site in dist/,
// except /api/*: /api/contact emails the mail window's messages to me through
// cloudflare email routing (the SEND_EMAIL binding in wrangler.jsonc), and
// /api/blog/* + /api/admin/* (blog.mjs) let me write blog posts and paste images from the site.
// videos also come through here so safari gets the range requests it needs (video.mjs),
// and /api/event + /api/analytics count visits for the analytics window (analytics.mjs)
import { EmailMessage } from 'cloudflare:email';
import { buildEmail, validate } from './contact.mjs';
import { blog } from './blog.mjs';
import { video } from './video.mjs';
import { analytics } from './analytics.mjs';

const to = 'jasontcanada@gmail.com';
const from = 'contact@jasontang.dev';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

async function contact(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  // only accept messages sent from the site itself
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Forbidden.' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const result = validate(body);
  if (!result.ok) return json({ error: result.error }, 400);
  if (result.spam) return json({ ok: true });

  try {
    const raw = buildEmail(result.data, { from, to, id: crypto.randomUUID() });
    await env.SEND_EMAIL.send(new EmailMessage(from, to, raw));
  } catch (error) {
    console.error('sending failed', error);
    return json({ error: 'Couldn’t send right now. Try emailing me directly.' }, 502);
  }

  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/chat/') || pathname.startsWith('/api/admin/chat/')) return chat(request, env);
    if (pathname === '/api/stats') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      if (!env.LIVE_STATS) return json({ error: 'Stats unavailable.' }, 503);
      return liveStats(env).fetch(new Request('https://stats/'));
    }
    if (pathname === '/api/contact') return contact(request, env);
    if (pathname === '/api/analytics' || pathname === '/api/event') return analytics(request, env);
    if (pathname === '/api/blog' || pathname.startsWith('/api/blog/') || pathname.startsWith('/api/admin/')) return blog(request, env);
    if (pathname.endsWith('.mp4')) return video(request, env);
    return env.ASSETS.fetch(request);
  },
};
