import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ChatRoom } from '../worker/chat-room.mjs';
import { replyAsClippy, siteFacts } from '../worker/clippy.mjs';
import { chat, localChat } from '../worker/chat.mjs';
import { DAY, RETENTION, hash, nicknameError, messageError } from '../worker/chat-rules.mjs';

function setup(ai) {
  const tasks = [];
  const botEnv = ai ? { AI: ai } : {};
  const db = new DatabaseSync(':memory:');
  const sockets = []; let alarm = null;
  const ctx = { waitUntil: task => tasks.push(task), getWebSockets: () => sockets, storage: {
    sql: { exec(query, ...args) { const statement = db.prepare(query); return statement.columns().length ? statement.all(...args) : (statement.run(...args), []); } },
    transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (err) { db.exec('ROLLBACK'); throw err; } },
    getAlarm: async () => alarm, setAlarm: async value => { alarm = value; },
  } };
  let room = new ChatRoom(ctx, botEnv);
  const call = (path, data = {}) => room.fetch(new Request(`https://chat${path}`, { method: 'POST', body: JSON.stringify(data) }));
  const env = { CHAT_LOCAL: '1', CHAT_ROOM: { idFromName: name => name, get: () => ({ fetch: request => room.fetch(request) }) } };
  async function join(nickname = 'visitor', admin = false) {
    const tokenHash = await hash(crypto.randomUUID());
    const response = await call('/join', { nickname, tokenHash, admin });
    assert.equal(response.status, 200, await response.clone().text());
    const session = room.session(tokenHash);
    const ws = { readyState: 1, data: { id: session.id, nickname: session.nickname, admin: Boolean(session.admin), seen: Date.now() }, events: [],
      deserializeAttachment() { return this.data; }, serializeAttachment(data) { this.data = data; },
      send(raw) { this.events.push(JSON.parse(raw)); }, close(code) { this.readyState = 3; this.code = code; } };
    sockets.push(ws);
    return { tokenHash, session, ws };
  }
  return { ctx, env, join, call, tasks, get room() { return room; }, restart() { room = new ChatRoom(ctx, botEnv); }, sockets };
}
const send = (room, ws, text, clientId = crypto.randomUUID()) => { room.webSocketMessage(ws, JSON.stringify({ type: 'send', text, clientId })); return clientId; };
const gatewayRequest = (path, { method = 'GET', data, cookie = '', origin = 'http://127.0.0.1:8787', host = origin } = {}) => new Request(`${host}${path}`, { method, headers: { Origin: origin, Cookie: cookie }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });

test('nickname and text rules reject impersonation and count Unicode characters', () => {
  assert.equal(nicknameError('Jason'), 'nickname-reserved');
  assert.equal(nicknameError('Jason', true), null);
  assert.equal(nicknameError('ADMIN', true), 'nickname-reserved');
  assert.equal(nicknameError('two words'), 'nickname-invalid');
  assert.equal(messageError('  '), 'empty');
  assert.equal(messageError('you are a sh1t'), 'profanity');
  assert.equal(messageError('the assassin in scunthorpe'), null);
  assert.equal(nicknameError('fuuuck_you'), 'nickname-profanity');
  assert.equal(messageError('🙂'.repeat(250)), null);
  assert.equal(messageError('🙂'.repeat(251)), 'too-long');
  assert.equal(messageError('<img src=x onerror=alert(1)>'), null);
});

test('messages broadcast to two visitors; retry IDs do not duplicate stored messages', async () => {
  const s = setup(); const a = await s.join('alice'); const b = await s.join('bob');
  const id = send(s.room, a.ws, 'hello');
  assert.equal(b.ws.events.at(-1).text, 'hello');
  assert.equal(a.ws.events.at(-1).type, 'ack');
  assert.equal(b.ws.events.at(-1).clientId, undefined);
  send(s.room, a.ws, 'hello', id);
  assert.equal(s.room.one('SELECT COUNT(*) AS n FROM messages').n, 1);
  assert.equal(a.ws.events.at(-1).type, 'ack');
});

test('rate limits and duplicate suppression survive hibernation and apply across tabs', async () => {
  const s = setup(); const a = await s.join();
  send(s.room, a.ws, 'first'); s.restart();
  const secondTab = { ...a.ws, data: { ...a.ws.data }, events: [] };
  s.sockets.push(secondTab);
  send(s.room, secondTab, 'second');
  assert.equal(secondTab.events.at(-1).code, 'rate-limited');
  s.room.sql.exec("UPDATE sessions SET sent='[]' WHERE id=?", a.session.id);
  send(s.room, a.ws, 'first');
  assert.equal(a.ws.events.at(-1).code, 'duplicate');
  const times = Array.from({ length: 20 }, (_, i) => Date.now() - 59000 + i * 2500);
  s.room.sql.exec('UPDATE sessions SET sent=? WHERE id=?', JSON.stringify(times), a.session.id);
  s.restart(); send(s.room, a.ws, 'third');
  assert.equal(a.ws.events.at(-1).code, 'rate-limited');
});

test('moderation deletes live, mutes, bans, unbans and disables sending', async () => {
  const s = setup(); const a = await s.join('alice'); const b = await s.join('bob');
  send(s.room, a.ws, 'remove me'); const message = s.room.one('SELECT * FROM messages');
  await s.call('/admin/delete', { id: message.id });
  assert.equal(b.ws.events.at(-1).type, 'deleted');
  assert.equal(s.room.message(s.room.one('SELECT * FROM messages')).text, '[message removed by administrator]');
  const overview = await (await s.call('/admin/overview')).json();
  assert.equal(overview.messages[0].original, 'remove me');
  await s.call('/admin/moderate', { id: a.session.id, action: 'mute', minutes: 10 });
  send(s.room, a.ws, 'muted'); assert.equal(a.ws.events.at(-1).code, 'muted');
  await s.call('/admin/moderate', { id: a.session.id, action: 'ban' });
  assert.equal(a.ws.code, 4403);
  assert.equal(s.room.connect(a.tokenHash).status, 403);
  await s.call('/admin/moderate', { id: a.session.id, action: 'unban' });
  assert.equal(s.room.session(a.tokenHash).banned, 0);
  await s.call('/admin/settings', { chatEnabled: false, slowModeSeconds: 5 });
  send(s.room, b.ws, 'offline'); assert.equal(b.ws.events.at(-1).code, 'chat-disabled');
});

test('names are unique while online; owner identity and presence are server-controlled', async () => {
  const s = setup(); const a = await s.join('alice');
  assert.equal((await s.call('/join', { nickname: 'ALICE', tokenHash: 'new' })).status, 409);
  assert.equal((await s.call('/join', { nickname: 'Admin', tokenHash: 'new' })).status, 400);
  s.sockets.push(a.ws);
  assert.equal(s.room.online().length, 1);
  const owner = await s.join('anything', true);
  assert.equal(owner.session.nickname, 'Jason');
  assert.equal((await s.call('/admin/moderate', { id: owner.session.id, action: 'ban' })).status, 403);
});

test('an offline session whose name was taken is prompted to choose a new nickname', async () => {
  const s = setup(); const old = await s.join('Alice');
  old.ws.close(1000);
  s.room.sql.exec('UPDATE sessions SET created=? WHERE id=?', Date.now() - 120000, old.session.id);
  await s.join('alice');
  const state = await (await s.call('/session', { tokenHash: old.tokenHash })).json();
  assert.equal(state.you, null); assert.equal(state.joinError, 'nickname-taken');
});

test('expiry and scheduled cleanup remove old data; joins do not postpone cleanup', async () => {
  const s = setup(); const a = await s.join();
  const scheduled = await s.ctx.storage.getAlarm();
  await s.call('/admit', { ip: 'ip' });
  assert.equal(await s.ctx.storage.getAlarm(), scheduled);
  send(s.room, a.ws, 'old message');
  s.room.sql.exec('UPDATE messages SET at=?', Date.now() - RETENTION - DAY);
  s.room.sql.exec('UPDATE sessions SET expires=?', Date.now() - 1);
  await s.room.alarm();
  assert.equal(s.room.one('SELECT COUNT(*) AS n FROM messages').n, 0);
  assert.equal(s.room.session(a.tokenHash), undefined);
  assert.equal(a.ws.code, 4401);
});

test('malformed and oversized frames cannot write messages or crash the room', async () => {
  const s = setup(); const a = await s.join();
  for (const frame of ['null', '{', '3', '{}', JSON.stringify({ type: 'send', text: [], clientId: 'x' })]) s.room.webSocketMessage(a.ws, frame);
  assert.equal(s.room.one('SELECT COUNT(*) AS n FROM messages').n, 0);
  s.room.webSocketMessage(a.ws, 'x'.repeat(4097)); assert.equal(a.ws.code, 1009);
});

test('join admission limits persist across object recreation', async () => {
  const s = setup();
  // checking admission alone, like a failed captcha, never uses up an attempt
  for (let i = 0; i < 20; i++) assert.equal((await s.call('/admit', { ip: 'one-ip' })).status, 200);
  for (let i = 0; i < 10; i++) assert.equal((await s.call('/join', { nickname: `guest${i}x`, tokenHash: await hash(crypto.randomUUID()), ip: 'one-ip' })).status, 200);
  s.restart(); assert.equal((await s.call('/admit', { ip: 'one-ip' })).status, 429);
  assert.equal((await s.call('/admit', { ip: 'another-ip' })).status, 200);
});

test('gateway issues HttpOnly sessions, never exposes tokens, and rejects cross-origin writes', async () => {
  const s = setup(); const opts = { verify: async () => false };
  const joined = await chat(gatewayRequest('/api/chat/join', { method: 'POST', data: { nickname: 'guest' } }), s.env, opts);
  assert.equal(joined.status, 200);
  const cookie = joined.headers.get('Set-Cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  assert.equal((await joined.json()).token, undefined);
  const state = await (await chat(gatewayRequest('/api/chat/session', { cookie }), s.env, opts)).json();
  assert.equal(state.you.nickname, 'guest'); assert.equal(state.adminAuthorized, false);
  const cross = gatewayRequest('/api/chat/join', { method: 'POST', data: { nickname: 'bad' }, host: 'http://127.0.0.1:8787', origin: 'https://other.test' });
  assert.equal((await chat(cross, s.env, opts)).status, 403);
  assert.equal((await chat(gatewayRequest('/api/admin/chat/overview'), s.env, opts)).status, 401);
});

test('production fails closed without Turnstile and ignores local admin bypass', async () => {
  const s = setup(); const env = { ...s.env, CHAT_DEV_ADMIN_TOKEN: 'a'.repeat(32) };
  const request = gatewayRequest('/api/chat/join', { method: 'POST', origin: 'https://jasontang.dev', cookie: `chat_dev_admin=${'a'.repeat(32)}`, data: { nickname: 'Jason' } });
  assert.equal(localChat(request, env), false);
  assert.equal((await chat(request, env, { verify: async () => false })).status, 503);
  const admin = gatewayRequest('/api/admin/chat/overview', { origin: 'https://jasontang.dev', cookie: `chat_dev_admin=${'a'.repeat(32)}` });
  assert.equal((await chat(admin, env, { verify: async () => false })).status, 401);
});

test('production verifies Turnstile hostname and action and sets Secure cookies', async () => {
  const s = setup(); const env = { ...s.env, TURNSTILE_SITE_KEY: 'public', TURNSTILE_SECRET: 'private', TURNSTILE_HOSTNAMES: 'jasontang.dev' };
  const request = () => gatewayRequest('/api/chat/join', { method: 'POST', origin: 'https://jasontang.dev', data: { nickname: 'visitor', turnstileToken: 'test' } });
  const options = result => ({ verify: async () => false, fetcher: async () => Response.json(result) });
  assert.equal((await chat(request(), env, options({ success: true, hostname: 'evil.test', action: 'chat-join' }))).status, 403);
  assert.equal((await chat(request(), env, options({ success: true, hostname: 'jasontang.dev', action: 'wrong' }))).status, 403);
  const response = await chat(request(), env, options({ success: true, hostname: 'jasontang.dev', action: 'chat-join' }));
  assert.equal(response.status, 200); assert.match(response.headers.get('Set-Cookie'), /Secure;/);
});

test('Turnstile accepts only strict success, the expected action and production hostname', async () => {
  const invalid = [null, {}, { success: 'true' }, { success: 1 }, { success: false },
    { success: true, hostname: 'localhost', action: 'chat-join' },
    { success: true, hostname: 'jasontang.dev', action: 'contact' }];
  for (const result of invalid) {
    const s = setup(); const env = { ...s.env, TURNSTILE_SITE_KEY: 'public', TURNSTILE_SECRET: 'private', TURNSTILE_HOSTNAMES: 'jasontang.dev' };
    const response = await chat(gatewayRequest('/api/chat/join', { method: 'POST', origin: 'https://jasontang.dev', data: { nickname: 'visitor', turnstileToken: 'test' } }), env,
      { verify: async () => false, fetcher: async () => Response.json(result) });
    assert.equal(response.status, 403);
    assert.equal(s.room.one('SELECT COUNT(*) AS n FROM sessions').n, 0);
  }
});

test('Turnstile rejects empty and oversized tokens before calling Siteverify', async () => {
  for (const turnstileToken of [undefined, '', '  ', 42, 'x'.repeat(2049)]) {
    const s = setup(); const env = { ...s.env, TURNSTILE_SITE_KEY: 'public', TURNSTILE_SECRET: 'private', TURNSTILE_HOSTNAMES: 'jasontang.dev' };
    const response = await chat(gatewayRequest('/api/chat/join', { method: 'POST', origin: 'https://jasontang.dev', data: { nickname: 'visitor', turnstileToken } }), env,
      { verify: async () => false, fetcher: async () => { assert.fail('Siteverify should not be called'); } });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Set-Cookie'), null);
  }
});

test('Turnstile requires a deployment-specific hostname configuration', async () => {
  for (const TURNSTILE_HOSTNAMES of ['', 'other.example', 'jasontang.dev,localhost', 'jasontang.dev,127.0.0.1']) {
    const s = setup(); const env = { ...s.env, TURNSTILE_SITE_KEY: 'public', TURNSTILE_SECRET: 'private', TURNSTILE_HOSTNAMES };
    const response = await chat(gatewayRequest('/api/chat/session', { origin: 'https://jasontang.dev' }), env, { verify: async () => false });
    assert.equal((await response.json()).ready, false);
  }
});

test('Siteverify transport failures cannot create a session', async () => {
  for (const fetcher of [async () => { throw new Error('timeout'); }, async () => new Response('bad gateway', { status: 502 }), async () => new Response('invalid JSON')]) {
    const s = setup(); const env = { ...s.env, TURNSTILE_SITE_KEY: 'public', TURNSTILE_SECRET: 'private', TURNSTILE_HOSTNAMES: 'jasontang.dev' };
    const response = await chat(gatewayRequest('/api/chat/join', { method: 'POST', origin: 'https://jasontang.dev', data: { nickname: 'visitor', turnstileToken: 'test' } }), env, { verify: async () => false, fetcher });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.equal(s.room.one('SELECT COUNT(*) AS n FROM sessions').n, 0);
  }
});

test('Siteverify runs server-side with form encoding and replay rejection gates session creation', async () => {
  const s = setup(); const env = { ...s.env, TURNSTILE_SITE_KEY: 'public', TURNSTILE_SECRET: 'private', TURNSTILE_HOSTNAMES: 'jasontang.dev' };
  let used = false;
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(options.body.get('secret'), 'private');
    assert.equal(options.body.get('response'), 'one-use-token');
    assert.ok(options.signal instanceof AbortSignal);
    if (used) return Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    used = true;
    return Response.json({ success: true, hostname: 'jasontang.dev', action: 'chat-join' });
  };
  const request = () => gatewayRequest('/api/chat/join', { method: 'POST', origin: 'https://jasontang.dev', data: { nickname: 'visitor', turnstileToken: 'one-use-token' } });
  assert.equal((await chat(request(), env, { verify: async () => false, fetcher })).status, 200);
  assert.equal((await chat(request(), env, { verify: async () => false, fetcher })).status, 403);
  assert.equal(s.room.one('SELECT COUNT(*) AS n FROM sessions').n, 1);
  const state = await (await chat(gatewayRequest('/api/chat/session', { origin: 'https://jasontang.dev' }), env, { verify: async () => false })).json();
  assert.equal(state.siteKey, 'public');
  assert.equal(JSON.stringify(state).includes('private'), false);
});


test('Clippy is reserved, opt-in, server identified, and duplicate retries never run AI twice', async () => {
  let resolve, calls = 0;
  const s = setup({ run: () => { calls++; return new Promise(done => { resolve = done; }); } });
  assert.equal(nicknameError('CLIPPY', true), 'nickname-reserved');
  const a = await s.join('alice'); const b = await s.join('bob');
  send(s.room, a.ws, 'hello'); assert.equal(calls, 0);
  s.room.sql.exec("UPDATE sessions SET sent='[]'");
  const id = send(s.room, a.ws, '@Clippy hello');
  assert.equal(calls, 1); assert.equal(s.room.clippyState().thinking, true);
  send(s.room, a.ws, '@Clippy hello', id); assert.equal(calls, 1);
  send(s.room, b.ws, '@Clippy another question');
  assert.equal(b.ws.events.at(-1).code, 'clippy-busy');
  resolve({ response: 'Hello from your friendly paperclip!' }); await Promise.all(s.tasks);
  const reply = b.ws.events.find(event => event.bot);
  assert.equal(reply.nickname, 'Clippy'); assert.equal(reply.admin, false);
  assert.equal(reply.text, 'Hello from your friendly paperclip!');
  s.restart(); assert.equal(s.room.clippyState().thinking, false);
  assert.equal(s.room.one('SELECT requests FROM clippy_usage').requests, 1);
  assert.equal(s.room.message(s.room.one("SELECT * FROM messages WHERE nickname='Clippy'")).bot, true);
});

test('Clippy daily cap persists and missing binding does not fake an AI reply', async () => {
  const s = setup({ run: async () => { throw new Error('must not run'); } });
  const a = await s.join();
  s.room.sql.exec('UPDATE clippy_usage SET day=?, requests=500', new Date().toISOString().slice(0, 10));
  s.restart(); send(s.room, a.ws, '@Clippy hi');
  assert.equal(a.ws.events.at(-1).code, 'clippy-limit');
  assert.equal(s.room.one('SELECT COUNT(*) AS n FROM messages').n, 0);
  const offline = setup(); const b = await offline.join();
  send(offline.room, b.ws, '@Clippy hi'); assert.equal(b.ws.events.at(-1).code, 'clippy-offline');
});

test('Clippy respects moderation while AI is in flight', async () => {
  for (const action of ['delete', 'mute', 'disable']) {
    let resolve;
    const s = setup({ run: () => new Promise(done => { resolve = done; }) });
    const a = await s.join(); send(s.room, a.ws, '@Clippy hi');
    if (action === 'delete') await s.call('/admin/delete', { id: s.room.one('SELECT id FROM messages').id });
    if (action === 'mute') await s.call('/admin/moderate', { id: a.session.id, action: 'mute', minutes: 10 });
    if (action === 'disable') await s.call('/admin/settings', { chatEnabled: false, slowModeSeconds: 3 });
    resolve({ response: 'This answer must be suppressed.' }); await Promise.all(s.tasks);
    assert.equal(s.room.one("SELECT COUNT(*) AS n FROM messages WHERE nickname='Clippy'").n, 0);
    assert.equal(s.room.clippyState().thinking, false);
  }
});

test('AI errors and filtered output release thinking state with a safe public fallback', async () => {
  for (const run of [async () => { throw new Error('quota'); }, async () => ({ response: 'you are a sh1t' })]) {
    const s = setup({ run }); const a = await s.join(); send(s.room, a.ws, '@Clippy hi');
    await Promise.all(s.tasks);
    assert.equal(s.room.clippyState().thinking, false);
    assert.match(s.room.one("SELECT text FROM messages WHERE nickname='Clippy'").text, /taking a break/);
    assert.equal(a.ws.events.at(-1).failed, true);
  }
});

test('Clippy can finish a longer reply without increasing the visitor message limit', async () => {
  const text = 'You can play Reversi against me in the website’s Reversi game. ' + 'Try to take corners and leave your opponent fewer legal moves. '.repeat(5);
  const s = setup({ run: async () => ({ response: text }) });
  const a = await s.join(); send(s.room, a.ws, '@Clippy how do I play?');
  await Promise.all(s.tasks);
  assert.equal(s.room.one("SELECT text FROM messages WHERE nickname='Clippy'").text, text.trim());
  assert.equal(messageError(text), 'too-long');
});

test('Clippy trims oversized or token-limited replies at a complete sentence', async () => {
  const answer = async result => replyAsClippy({ run: async () => result }, '@Clippy hello');
  assert.equal(await answer({ response: 'Here is a complete thought. ' + 'unfinished '.repeat(150) }), 'Here is a complete thought.');
  assert.equal(await answer({ response: 'Here is a complete thought. And another incom', choices: [{ finish_reason: 'length' }] }), 'Here is a complete thought.');
  assert.match(await answer({ response: 'unfinished '.repeat(150) }), /more specific question\?/);
});

test('Clippy receives public-room history with speaker identity and no duplicate current question', async () => {
  const requests = [];
  const s = setup({ run: async (_, input) => { requests.push(input.messages); return { response: 'Open Games, then Reversi.' }; } });
  const alice = await s.join('Alice'); const bob = await s.join('Bob');
  send(s.room, bob.ws, 'I enjoy board games.');
  send(s.room, alice.ws, '@Clippy which game should we try?');
  await Promise.all(s.tasks);
  assert.deepEqual(JSON.parse(requests[0][1].content), { speaker: 'Bob', text: 'I enjoy board games.' });
  s.restart();
  s.room.sql.exec("UPDATE sessions SET sent='[]'");
  s.room.sql.exec('UPDATE clippy_usage SET last_at=0');
  send(s.room, bob.ws, '@Clippy where do I find that?');
  await Promise.all(s.tasks);
  const context = requests[1].slice(1);
  assert.deepEqual(context.map(entry => entry.role), ['user', 'user', 'assistant', 'user']);
  assert.equal(JSON.parse(context[1].content).speaker, 'Alice');
  assert.equal(context[2].content, 'Open Games, then Reversi.');
  assert.deepEqual(JSON.parse(context.at(-1).content), { speaker: 'Bob', text: 'where do I find that?' });
  await s.call('/admin/delete', { id: s.room.one("SELECT id FROM messages WHERE text='I enjoy board games.'").id });
  assert.equal(s.room.clippyHistory(99999).some(entry => entry.content.includes('I enjoy board games.')), false);
});

test('Clippy gets live site stats in his prompt, loaded once per five minutes', async () => {
  const prompts = []; let loads = 0;
  const s = setup({ run: async (_, input) => { prompts.push(input.messages[0].content); return { response: 'Lots!' }; } });
  s.room.env.LIVE_STATS = { idFromName: name => name, get: () => ({ fetch: async () => { loads++; return Response.json({ visitors: 4321, online: 2, clippyWins: 9, clippyLosses: 3, leaderboard: [{ player: 'ALICE', score: 77 }] }); } }) };
  const alice = await s.join('Alice');
  send(s.room, alice.ws, '@Clippy how many visitors?');
  await Promise.all(s.tasks);
  assert.match(prompts[0], /4,321 visits/);
  assert.match(prompts[0], /Clippy has won 9 games and lost 3/);
  assert.match(prompts[0], /Snake all-time high score: 77 by ALICE/);
  assert.match(prompts[0], /In Fishbowl right now: Alice/);
  s.room.sql.exec("UPDATE sessions SET sent='[]'");
  s.room.sql.exec('UPDATE clippy_usage SET last_at=0');
  send(s.room, alice.ws, '@Clippy and now?');
  await Promise.all(s.tasks);
  assert.equal(loads, 1);
});

test('Clippy memory keeps only recent messages within both limits and excludes expired content', () => {
  const s = setup();
  const insert = (index, text, at = Date.now()) => s.room.sql.exec('INSERT INTO messages (id, session_id, client_id, nickname, admin, text, at) VALUES (?, ?, ?, ?, 0, ?, ?)', String(index), 'bot:clippy', String(index), 'Clippy', text, at);
  for (let i = 0; i < 25; i++) insert(i, `Message ${i}.`);
  insert(25, 'Expired message.', Date.now() - RETENTION - 1000);
  const history = s.room.clippyHistory(99999);
  assert.equal(history.length, 20);
  assert.equal(history[0].content, 'Message 5.');
  assert.equal(history.at(-1).content, 'Message 24.');
  // A snapshot must not include messages that arrived after the addressed question.
  assert.equal(s.room.clippyHistory(3).length, 2);
  for (let i = 26; i < 36; i++) insert(i, 'x'.repeat(999));
  const bounded = s.room.clippyHistory(99999);
  assert.equal(bounded.length, 6);
  assert.ok(bounded.reduce((sum, entry) => sum + [...entry.content].length, 0) <= 6000);
});

test('messages and Clippy tokens are counted for analytics, and the asker hears their tokens', async () => {
  const points = [];
  const s = setup({ run: async () => ({ choices: [{ message: { content: 'Try Games, then Snake.' } }], usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 } }) });
  s.room.env.EVENTS = { writeDataPoint: point => points.push(point) };
  const a = await s.join('Alice'); const b = await s.join('Bob');
  send(s.room, a.ws, '@Clippy what should I play?');
  await Promise.all(s.tasks);
  assert.deepEqual(points.map(p => [p.blobs[0], p.doubles[0]]), [['chat-message', 0], ['clippy-tokens', 150]]);
  assert.deepEqual(a.ws.events.filter(e => e.type === 'tokens'), [{ type: 'tokens', tokens: 150 }]);
  assert.equal(b.ws.events.some(e => e.type === 'tokens'), false);
});

test('Clippy knows the 90 day messenger messages and Workers AI tokens', () => {
  const facts = siteFacts({ recent: { visitors: 10, daily: [], chatMessages: 1234, tokensBurnt: 56789 } });
  assert.match(facts, /1,234 messages sent/);
  assert.match(facts, /56,789 Workers AI tokens/);
});
