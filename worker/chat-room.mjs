import { DAY, RETENTION, removedText, json, failure, nicknameError, messageError } from './chat-rules.mjs';

// One room, separate from the portfolio's analytics object. Every mutation below
// is synchronous SQL, so a send cannot interleave with a mute or another send.
export class ChatRoom {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, nickname TEXT NOT NULL,
      admin INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL, created INTEGER NOT NULL,
      muted_until INTEGER NOT NULL DEFAULT 0, banned INTEGER NOT NULL DEFAULT 0,
      sent TEXT NOT NULL DEFAULT '[]')`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
      session_id TEXT NOT NULL, client_id TEXT NOT NULL, nickname TEXT NOT NULL,
      admin INTEGER NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0, UNIQUE(session_id, client_id))`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS chat_recent ON messages(at)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS chat_session_recent ON messages(session_id, seq DESC)');
    this.sql.exec(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL, slow INTEGER NOT NULL)`);
    this.sql.exec('INSERT OR IGNORE INTO settings VALUES (1, 1, 3)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS joins (ip TEXT PRIMARY KEY, attempts TEXT NOT NULL, at INTEGER NOT NULL)');
  }
  rows(query, ...args) { return [...this.sql.exec(query, ...args)]; }
  one(query, ...args) { return this.rows(query, ...args)[0]; }
  settings() {
    const row = this.one('SELECT * FROM settings WHERE id=1');
    return { chatEnabled: Boolean(row.enabled), slowModeSeconds: row.slow };
  }
  session(tokenHash) {
    return this.one('SELECT * FROM sessions WHERE token_hash=? AND expires>?', tokenHash || '', Date.now());
  }
  person(session) { return { nickname: session.nickname, admin: Boolean(session.admin) }; }
  async scheduleCleanup() {
    if (await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(Date.now() + DAY);
  }
  sockets() { return this.ctx.getWebSockets().filter(ws => ws.readyState === 1); }
  online() {
    const people = new Map();
    for (const ws of this.sockets()) {
      const data = ws.deserializeAttachment();
      if (data && data.seen > Date.now() - 90000) people.set(data.id, { nickname: data.nickname, admin: data.admin });
    }
    return [...people.values()].sort((a, b) => a.nickname.localeCompare(b.nickname));
  }
  send(ws, data) { try { ws.send(JSON.stringify(data)); } catch { try { ws.close(1011, 'Connection lost'); } catch {} } }
  broadcast(data) { for (const ws of this.sockets()) this.send(ws, data); }
  presence() { this.broadcast({ type: 'presence', online: this.online() }); }
  message(row) {
    return { id: row.id, seq: row.seq, nickname: row.nickname, admin: Boolean(row.admin),
      text: row.deleted ? removedText : row.text, at: row.at, deleted: Boolean(row.deleted) };
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    // The public Worker constructs these requests; no room route is exposed directly.
    if (path === '/socket') return this.connect(request.headers.get('X-Chat-Session'));
    const body = await request.json();
    const now = Date.now();
    if (path === '/session') {
      const session = this.session(body.tokenHash);
      const conflict = session && this.sockets().some(ws => { const person = ws.deserializeAttachment(); return person.id !== session.id && person.nickname.toLowerCase() === session.nickname.toLowerCase(); });
      return json({ you: session && !conflict ? this.person(session) : null, banned: Boolean(session?.banned), joinError: conflict ? 'nickname-taken' : null, settings: this.settings() });
    }
    if (path === '/admit') {
      const attempts = JSON.parse(this.one('SELECT attempts FROM joins WHERE ip=?', body.ip)?.attempts || '[]').filter(t => t > now - 600000);
      if (attempts.length >= 5) return failure('join-limited', 429);
      attempts.push(now);
      this.sql.exec('INSERT INTO joins VALUES (?, ?, ?) ON CONFLICT(ip) DO UPDATE SET attempts=excluded.attempts, at=excluded.at', body.ip, JSON.stringify(attempts), now);
      await this.scheduleCleanup();
      return json({ ok: true });
    }
    if (path === '/join') {
      if (!this.settings().chatEnabled) return failure('chat-disabled', 403);
      if (this.session(body.previousHash)?.banned) return failure('banned', 403);
      if (this.one('SELECT COUNT(*) AS n FROM sessions').n >= 5000) return failure('room-full', 503);
      let nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
      if (body.admin) nickname = 'Jason';
      if (!nickname) nickname = `guest${crypto.randomUUID().slice(0, 6)}`;
      const error = nicknameError(nickname, body.admin);
      if (error) return failure(error);
      // Reserve a name while its session is online or completing the join handshake.
      const existing = this.rows('SELECT id, token_hash, created FROM sessions WHERE nickname=? COLLATE NOCASE AND expires>?', nickname, now);
      const connected = new Set(this.sockets().map(ws => ws.deserializeAttachment()?.id));
      if (existing.some(s => s.token_hash !== body.previousHash && (connected.has(s.id) || s.created > now - 60000))) return failure('nickname-taken', 409);
      const old = this.session(body.previousHash);
      if (old?.muted_until > now) return failure('muted', 403, { until: old.muted_until });
      if (old) { this.disconnect(old.id, 4401, 'Signed out'); this.sql.exec('DELETE FROM sessions WHERE id=?', old.id); }
      this.sql.exec('INSERT INTO sessions (id, token_hash, nickname, admin, expires, created) VALUES (?, ?, ?, ?, ?, ?)',
        crypto.randomUUID(), body.tokenHash, nickname, body.admin ? 1 : 0, now + RETENTION, now);
      await this.scheduleCleanup();
      return json({ nickname });
    }
    if (path === '/leave') {
      const session = this.session(body.tokenHash);
      if (session) {
        this.disconnect(session.id, 4401, 'Signed out');
        // Keep muted/banned rows until expiry; leaving must not erase a sanction.
        if (!session.banned && session.muted_until <= now) this.sql.exec('DELETE FROM sessions WHERE id=?', session.id);
      }
      return json({ ok: true });
    }
    if (path === '/admin/overview') {
      return json({ settings: this.settings(), online: this.online(),
        messages: this.rows('SELECT * FROM messages ORDER BY seq DESC LIMIT 100').map(r => ({ ...this.message(r), original: r.text, sessionId: r.session_id })),
        sessions: this.rows('SELECT id, nickname, banned, muted_until AS mutedUntil FROM sessions ORDER BY created DESC LIMIT 100') });
    }
    if (path === '/admin/settings') {
      if (typeof body.chatEnabled !== 'boolean' || !Number.isInteger(body.slowModeSeconds) || body.slowModeSeconds < 3 || body.slowModeSeconds > 60) return failure('invalid-settings');
      this.sql.exec('UPDATE settings SET enabled=?, slow=? WHERE id=1', body.chatEnabled ? 1 : 0, body.slowModeSeconds);
      this.broadcast({ type: 'settings', ...this.settings() });
      return json({ ok: true });
    }
    if (path === '/admin/delete') {
      const message = this.one('SELECT * FROM messages WHERE id=?', body.id);
      if (!message) return failure('not-found', 404);
      this.sql.exec('UPDATE messages SET deleted=1 WHERE id=?', body.id);
      this.broadcast({ type: 'deleted', id: body.id });
      return json({ ok: true });
    }
    if (path === '/admin/moderate') {
      const session = this.one('SELECT * FROM sessions WHERE id=?', body.id);
      if (!session) return failure('not-found', 404);
      if (session.admin) return failure('admin-protected', 403);
      if (body.action === 'mute' && [10, 60].includes(body.minutes)) {
        const until = now + body.minutes * 60000;
        this.sql.exec('UPDATE sessions SET muted_until=? WHERE id=?', until, body.id);
        for (const ws of this.sockets()) if (ws.deserializeAttachment()?.id === body.id) this.send(ws, { type: 'error', code: 'muted', until });
      } else if (['ban', 'unban'].includes(body.action)) {
        this.sql.exec('UPDATE sessions SET banned=? WHERE id=?', body.action === 'ban' ? 1 : 0, body.id);
        if (body.action === 'ban') this.disconnect(body.id, 4403, 'Banned');
      } else return failure('invalid-action');
      return json({ ok: true });
    }
    return failure('not-found', 404);
  }
  connect(tokenHash) {
    const session = this.session(tokenHash);
    if (!session) return failure('join-required', 401);
    if (session.banned) return failure('banned', 403);
    const sockets = this.sockets();
    if (sockets.length >= 200 || sockets.filter(ws => ws.deserializeAttachment()?.id === session.id).length >= 4) return failure('room-full', 429);
    if (sockets.some(ws => { const s = ws.deserializeAttachment(); return s.id !== session.id && s.nickname.toLowerCase() === session.nickname.toLowerCase(); })) return failure('nickname-taken', 409);
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: session.id, nickname: session.nickname, admin: Boolean(session.admin), seen: Date.now() });
    this.send(server, { type: 'welcome', you: this.person(session), settings: this.settings(),
      history: this.rows('SELECT * FROM messages ORDER BY seq DESC LIMIT 50').reverse().map(r => this.message(r)), online: this.online() });
    if (!sockets.some(ws => ws.deserializeAttachment()?.id === session.id)) this.broadcast({ type: 'system', text: `${session.nickname} has joined the conversation.` });
    this.presence();
    return new Response(null, { status: 101, webSocket: client });
  }
  disconnect(id, code, reason) {
    for (const ws of this.sockets()) if (ws.deserializeAttachment()?.id === id) { this.send(ws, { type: 'error', code: code === 4403 ? 'banned' : 'join-required' }); ws.close(code, reason); }
    this.presence();
  }
  webSocketMessage(ws, raw) {
    let clientId;
    const error = (code, extra = {}) => this.send(ws, { type: 'error', code, clientId, ...extra });
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 4096) { ws.close(1009, 'Message too large'); return; }
    let data;
    try { data = JSON.parse(raw); } catch { error('invalid-message'); return; }
    if (!data || typeof data !== 'object') { error('invalid-message'); return; }
    const attachment = ws.deserializeAttachment();
    const session = this.one('SELECT * FROM sessions WHERE id=? AND expires>?', attachment?.id || '', Date.now());
    if (!session) { error('join-required'); ws.close(4401, 'Session expired'); return; }
    if (session.banned) { error('banned'); ws.close(4403, 'Banned'); return; }
    const now = Date.now();
    // Bound even invalid frames and pings, without writing to SQLite on each one.
    const frames = (attachment.frames || []).filter(t => t > now - 10000);
    if (frames.length >= 30) { ws.close(1008, 'Too many requests'); return; }
    ws.serializeAttachment({ ...attachment, frames: [...frames, now], seen: now });
    if (data.type === 'ping') { this.send(ws, { type: 'pong' }); return; }
    if (data.type !== 'send' || typeof data.clientId !== 'string' || !/^[\w-]{1,64}$/.test(data.clientId)) { error('invalid-message'); return; }
    clientId = data.clientId;
    const existing = this.one('SELECT * FROM messages WHERE session_id=? AND client_id=?', session.id, clientId);
    if (existing) { this.send(ws, { type: 'ack', clientId, message: this.message(existing) }); return; }
    const settings = this.settings();
    if (!settings.chatEnabled) { error('chat-disabled'); return; }
    if (session.muted_until > now) { error('muted', { until: session.muted_until }); return; }
    const invalid = messageError(data.text);
    if (invalid) { error(invalid); return; }
    const sent = JSON.parse(session.sent).filter(t => t > now - 60000);
    const wait = Math.max(sent.length >= 20 ? sent[0] + 60000 - now : 0, sent.length ? sent.at(-1) + settings.slowModeSeconds * 1000 - now : 0);
    if (wait > 0) { error('rate-limited', { retryAfter: Math.ceil(wait / 1000) }); return; }
    const text = data.text.trim();
    if (this.rows('SELECT text FROM messages WHERE session_id=? ORDER BY seq DESC LIMIT 3', session.id).some(m => m.text === text)) { error('duplicate'); return; }
    const id = crypto.randomUUID();
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('INSERT INTO messages (id, session_id, client_id, nickname, admin, text, at) VALUES (?, ?, ?, ?, ?, ?, ?)', id, session.id, clientId, session.nickname, session.admin, text, now);
      this.sql.exec('UPDATE sessions SET sent=? WHERE id=?', JSON.stringify([...sent, now]), session.id);
    });
    const message = this.message(this.one('SELECT * FROM messages WHERE id=?', id));
    this.broadcast({ type: 'message', ...message });
    this.send(ws, { type: 'ack', clientId, message });
  }
  webSocketClose(ws) { try { ws.close(1000, 'Connection closed'); } catch {} this.depart(ws); }
  webSocketError(ws) { try { ws.close(1011, 'Connection lost'); } catch {} this.depart(ws); }
  depart(ws) {
    const data = ws.deserializeAttachment();
    if (data && !this.sockets().some(other => other !== ws && other.deserializeAttachment()?.id === data.id)) this.broadcast({ type: 'system', text: `${data.nickname} has left the conversation.` });
    this.presence();
  }
  async alarm() {
    const now = Date.now();
    this.sql.exec('DELETE FROM messages WHERE at<?', now - RETENTION);
    this.sql.exec('DELETE FROM sessions WHERE expires<?', now);
    this.sql.exec('DELETE FROM joins WHERE at<?', now - 600000);
    for (const ws of this.sockets()) if (!this.one('SELECT id FROM sessions WHERE id=?', ws.deserializeAttachment()?.id || '')) ws.close(4401, 'Session expired');
    if (this.one('SELECT COUNT(*) AS n FROM sessions').n || this.one('SELECT COUNT(*) AS n FROM messages').n) await this.ctx.storage.setAlarm(now + DAY);
  }
}
