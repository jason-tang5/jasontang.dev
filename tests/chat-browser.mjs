// Tests the actual Worker + SQLite + WebSockets, with isolated local storage.
// Run npm run build first. No production services or credentials are used.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const portFinder = createServer();
await new Promise(resolve => portFinder.listen(0, '127.0.0.1', resolve));
const port = portFinder.address().port;
await new Promise(resolve => portFinder.close(resolve));
const base = `http://127.0.0.1:${port}`;
const token = crypto.randomUUID();
const output = resolve('tmp/chat-qa'); await mkdir(output, { recursive: true });
const worker = spawn(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'dev', '--config', 'wrangler.chat-local.jsonc',
  '--ip', '127.0.0.1', '--port', String(port), '--persist-to', resolve('tmp/chat-tests', crypto.randomUUID()), '--var', `CHAT_DEV_ADMIN_TOKEN:${token}`],
{ windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
let logs = ''; worker.stdout.on('data', b => { logs += b; }); worker.stderr.on('data', b => { logs += b; });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(`${base}/api/chat/session`)).ok) { ready = true; break; } } catch {}
    if (worker.exitCode !== null) throw new Error(logs);
    await delay(200);
  }
  assert.ok(ready, logs);
  browser = await chromium.launch({ headless: true });
  const errors = [];
  async function visitor(owner = false, viewport = { width: 1280, height: 900 }) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => {
      localStorage.setItem('jt-desktop:tip', 'dismissed');
      localStorage.setItem('jt-desktop:starter-note', 'done');
      window.__chatSockets = [];
      const Original = window.WebSocket;
      window.WebSocket = class extends Original { constructor(...args) { super(...args); window.__chatSockets.push(this); } };
    });
    if (owner) await context.addCookies([{ name: 'chat_dev_admin', value: token, url: base, httpOnly: true }]);
    const page = await context.newPage(); page.on('pageerror', err => errors.push(err.message));
    await page.goto(`${base}/#app=chat`);
    const app = page.locator('[data-window="chat"]');
    await expect(app.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
    return { context, page, app };
  }
  const alice = await visitor();
  await alice.app.screenshot({ path: `${output}/sign-in.png` });
  async function join(visitor, name) {
    await visitor.app.getByLabel('Your display name').fill(name);
    await visitor.app.getByRole('button', { name: 'Sign in to the room' }).click();
    await expect(visitor.app.locator('.msn-identity')).toContainText('Connected');
  }
  await join(alice, 'Alice');
  const bob = await visitor(); await join(bob, 'Bob');
  await expect(alice.app.locator('.msn-people')).toContainText('Bob');
  const send = async (visitor, text) => { await visitor.app.getByLabel('Your message').fill(text); await visitor.app.getByRole('button', { name: 'Send', exact: true }).click(); };
  await send(alice, 'Hey! Welcome to the little corner of the internet.');
  await expect(bob.app.getByRole('log')).toContainText('Hey! Welcome');
  const html = '<img src=x onerror="window.chatXss=true">';
  await send(bob, html);
  await expect(alice.app.getByRole('log')).toContainText(html);
  assert.equal(await alice.page.evaluate(() => window.chatXss), undefined);
  await expect(alice.app.getByRole('log').locator('img')).toHaveCount(0);
  await send(bob, 'A little too fast');
  await expect(bob.app.getByRole('alert')).toContainText('Slow down');
  await expect(bob.app.locator('.msn-pending')).toContainText('not sent');
  await bob.app.getByRole('button', { name: 'Edit message' }).click();
  await bob.app.getByLabel('Your message').fill('An unfinished thought');
  await bob.page.evaluate(() => window.__chatSockets.at(-1).close());
  await expect(bob.app.locator('.msn-identity')).toContainText('Reconnecting');
  await expect(bob.app.locator('.msn-identity')).toContainText('Connected', { timeout: 15000 });
  await expect(bob.app.getByLabel('Your message')).toHaveValue('An unfinished thought');
  await alice.page.reload();
  await expect(alice.app.locator('.msn-identity')).toContainText('Alice');
  await expect(alice.app.locator('.msn-identity')).toContainText('Connected');
  await expect(alice.app.getByRole('log')).toContainText(html);
  const cookies = await alice.context.cookies();
  assert.ok(cookies.find(c => c.name === 'chat_session')?.httpOnly);
  await alice.app.screenshot({ path: `${output}/conversation.png` });

  const owner = await visitor(true);
  await owner.app.getByRole('button', { name: 'Moderation', exact: true }).click();
  const moderation = owner.app.getByRole('region', { name: 'Chat moderation' });
  await expect(moderation).toContainText('Hey! Welcome');
  const row = moderation.locator('.msn-admin-row').filter({ hasText: html });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(alice.app.getByRole('log')).toContainText('[message removed by administrator]');
  await expect(bob.app.getByRole('log')).not.toContainText(html);
  await row.getByRole('button', { name: 'Mute 10m', exact: true }).click();
  await expect(bob.app.getByRole('alert')).toContainText('muted');
  await owner.app.getByRole('button', { name: 'Disable chat', exact: true }).click();
  await expect(alice.app.locator('.msn-offline')).toBeVisible();
  await owner.app.getByRole('button', { name: 'Enable chat', exact: true }).click();
  await expect(alice.app.locator('.msn-offline')).toHaveCount(0);
  await row.getByRole('button', { name: 'Ban', exact: true }).click();
  await expect(bob.app.getByRole('heading', { name: 'This session is banned.' })).toBeVisible();
  await moderation.screenshot({ path: `${output}/moderation.png` });
  const unauthorized = await alice.context.request.get(`${base}/api/admin/chat/overview`);
  assert.equal(unauthorized.status(), 401);
  const forbidden = await alice.context.request.post(`${base}/api/chat/leave`, { headers: { Origin: 'https://other.example' }, data: {} });
  assert.equal(forbidden.status(), 403);

  await alice.page.setViewportSize({ width: 390, height: 844 });
  await expect(alice.app.getByLabel('Your message')).toBeVisible();
  const overflow = await alice.app.locator('.messenger').evaluate(el => el.scrollWidth > el.clientWidth);
  assert.equal(overflow, false);
  await alice.app.screenshot({ path: `${output}/mobile.png` });
  await alice.app.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(alice.app.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
  await alice.app.screenshot({ path: `${output}/mobile-sign-in.png` });
  assert.deepEqual(errors, []);
  console.log('PASS: real WebSocket delivery, history, sessions, reconnect, text safety, rate limits, deletion, mute, ban, kill switch, admin auth, origin checks, mobile layout and sign-out.');
  console.log(`Screenshots: ${output}`);
} catch (err) { console.error(logs.slice(-8000)); throw err; }
finally {
  await browser?.close();
  if (worker.exitCode === null) {
    if (process.platform === 'win32') { try { execFileSync('taskkill', ['/PID', String(worker.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch {} }
    else { try { process.kill(-worker.pid, 'SIGTERM'); } catch {} }
  }
}
