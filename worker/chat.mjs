import { verifyAccess } from './access.mjs';
import { json, failure, hash } from './chat-rules.mjs';

export const localChat = (request, env) => env.CHAT_LOCAL === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
function token(request) { return /(?:^|;\s*)chat_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie') || '')?.[1] || ''; }
async function body(request) {
  if (Number(request.headers.get('Content-Length')) > 4096) throw new Error('too-large');
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new Error('too-large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid');
  return data;
}

export async function chat(request, env, { verify = verifyAccess, fetcher = fetch } = {}) {
  const url = new URL(request.url);
  const local = localChat(request, env);
  const origin = local ? url.origin : (env.CHAT_ORIGIN || 'https://jasontang.dev');
  if (url.origin !== origin) return failure('forbidden', 403);
  if (!env.CHAT_ROOM) return failure('unavailable', 503);
  const room = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('lobby'));
  const call = (path, data = {}) => room.fetch(new Request(`https://chat${path}`, { method: 'POST', body: JSON.stringify(data) }));
  const tokenHash = token(request) ? await hash(token(request)) : '';
  const isAdmin = async () => {
    const devToken = /(?:^|;\s*)chat_dev_admin=([\w-]+)(?:;|$)/.exec(request.headers.get('Cookie') || '')?.[1];
    if (local && env.CHAT_DEV_ADMIN_TOKEN?.length >= 32 && devToken === env.CHAT_DEV_ADMIN_TOKEN) return true;
    return Boolean(await verify(request, env));
  };
  const expectedHostnames = new Set(String(env.TURNSTILE_HOSTNAMES || '').split(',').map(host => host.trim()).filter(Boolean));
  const ready = local || Boolean(env.TURNSTILE_SITE_KEY?.trim() && env.TURNSTILE_SECRET?.trim()
    && expectedHostnames.has(url.hostname)
    && ![...expectedHostnames].some(host => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)));
  const cookie = (value, age) => `chat_session=${value}; HttpOnly; ${local && url.protocol === 'http:' ? '' : 'Secure; '}SameSite=Strict; Path=/api/; Max-Age=${age}`;
  const admin = url.pathname.startsWith('/api/admin/chat/');
  if (admin) {
    if (!await isAdmin()) return failure('unauthorized', 401);
    const action = url.pathname.slice('/api/admin/chat/'.length);
    if (action === 'login' && request.method === 'GET') return Response.redirect(new URL('/#app=chat', url).href, 302);
    if (action === 'overview' && request.method === 'GET') return call('/admin/overview');
    if (request.method !== 'POST') return failure('method-not-allowed', 405);
    if (request.headers.get('Origin') !== origin) return failure('forbidden', 403);
    if (!['settings', 'delete', 'moderate'].includes(action)) return failure('not-found', 404);
    try { return await call(`/admin/${action}`, await body(request)); } catch { return failure('invalid-request'); }
  }
  if (url.pathname === '/api/chat/session' && request.method === 'GET') {
    const state = await (await call('/session', { tokenHash })).json();
    return json({ ...state, ready, local, siteKey: local ? null : env.TURNSTILE_SITE_KEY || null, adminAuthorized: await isAdmin() });
  }
  if (url.pathname === '/api/chat/socket') {
    if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return failure('upgrade-required', 426);
    if (request.headers.get('Origin') !== origin) return failure('forbidden', 403);
    if (!ready) return failure('unavailable', 503);
    return room.fetch(new Request('https://chat/socket', { headers: { Upgrade: 'websocket', 'X-Chat-Session': tokenHash } }));
  }
  if (!['/api/chat/join', '/api/chat/leave'].includes(url.pathname)) return failure('not-found', 404);
  if (request.method !== 'POST') return failure('method-not-allowed', 405);
  if (request.headers.get('Origin') !== origin) return failure('forbidden', 403);
  if (url.pathname === '/api/chat/leave') {
    await call('/leave', { tokenHash });
    return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  }
  if (!ready) return failure('unavailable', 503);
  let data;
  try { data = await body(request); } catch { return failure('invalid-request'); }
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const ipHash = await hash(`${env.TURNSTILE_SECRET || 'local'}:${new Date().toISOString().slice(0, 10)}:${ip}`);
  const owner = await isAdmin();
  if (!owner) {
    const admitted = await call('/admit', { ip: ipHash });
    if (!admitted.ok) return admitted;
  }
  if (!local) {
    if (typeof data.turnstileToken !== 'string' || !data.turnstileToken.trim() || data.turnstileToken.length > 2048) return failure('captcha-failed', 403);
    try {
      const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: data.turnstileToken, remoteip: ip }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return failure('captcha-unavailable', 503);
      const result = await response.json();
      if (result?.success !== true || !expectedHostnames.has(result.hostname) || result.hostname !== url.hostname || result.action !== 'chat-join') return failure('captcha-failed', 403);
    } catch { return failure('captcha-unavailable', 503); }
  }
  const value = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
  const response = await call('/join', { nickname: data.nickname, tokenHash: await hash(value), previousHash: tokenHash, admin: owner, ip: owner ? null : ipHash });
  if (!response.ok) return response;
  return json(await response.json(), 200, { 'Set-Cookie': cookie(value, 2592000) });
}
