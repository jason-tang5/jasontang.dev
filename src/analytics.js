// anonymous visit analytics, read back in the analytics window (Analytics.vue).
// each page load gets a random id kept only in memory: no cookies, nothing stored,
// nothing personal. nothing is sent until the first click, tap or key press, which
// keeps bots and link previews out of the numbers. the worker side is
// worker/analytics.mjs, which lists every event name.

import { localAnalytics } from './local-analytics.js';
import { sourceName } from '../worker/analytics.mjs';
// only the real site counts, so local testing doesn't show up in the numbers
const live = location.hostname === 'jasontang.dev';

let visit = null;
const waiting = [];
const sentOnce = new Set();

function send(event) {
  const body = JSON.stringify({ visit, ...event });
  if (navigator.sendBeacon?.('/api/event', body)) return;
  fetch('/api/event', { method: 'POST', body, keepalive: true }).catch(() => {});
}

function start() {
  if (visit) return;
  visit = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => (b % 36).toString(36)).join('');
  // a link can name its own source (jasontang.dev/?ref=resume), which wins over the
  // referrer since most apps don't send one. otherwise it's the referring site
  const query = new URLSearchParams(location.search);
  let referrer = (query.get('ref') || query.get('utm_source') || '').toLowerCase().replace(/[^a-z0-9.-]/g, '-');
  if (!referrer) try {
    const host = document.referrer && new URL(document.referrer).hostname;
    if (host && host !== location.hostname) referrer = host;
  } catch {
    // no referrer
  }
  referrer = sourceName(referrer).slice(0, 80);
  const entry = new URLSearchParams(location.hash.slice(1)).get('app') || '';
  const event = {
    name: 'visit',
    detail: /^[a-z0-9-]{1,80}$/.test(entry) ? entry : '',
    device: matchMedia('(max-width: 700px)').matches ? 'phone' : 'desktop',
    referrer,
  };
  localAnalytics(event);
  send(event);
  for (const event of waiting.splice(0)) send(event);
}

if (live) {
  setInterval(() => { if (visit && !document.hidden) send({ name: 'heartbeat' }); }, 30000);
  document.addEventListener('visibilitychange', () => { if (visit) send({ name: document.hidden ? 'leave' : 'heartbeat' }); });
  addEventListener('pagehide', () => { if (visit) send({ name: 'leave' }); });
  for (const type of ['pointerdown', 'keydown']) addEventListener(type, start, { once: true, capture: true });
}

// records an event. detail is a short lowercase slug, value a number. extra is
// anything else the live scoreboard needs, like the snake player's name
export function track(name, detail = '', value = 0, extra = {}) {
  const event = { ...extra, name, detail: String(detail).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80), value };
  localAnalytics(event);
  if (!live) return;
  if (visit) send(event);
  else waiting.push(event);
}

// the same, but at most once per visit for this name and detail. the funnel counts
// visitors, so opening contact twice still counts once
export function trackOnce(name, detail = '', value = 0) {
  const key = `${name}:${detail}`;
  if (sentOnce.has(key)) return;
  sentOnce.add(key);
  track(name, detail, value);
}
