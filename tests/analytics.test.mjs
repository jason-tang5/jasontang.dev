import test from 'node:test';
import assert from 'node:assert/strict';
import { analytics, validateEvent, summarize, summarizePlaces, queries, place, visitorId, visitorsIn } from '../worker/analytics.mjs';
const event = { visit: 'abcd123456', name: 'snake-score', value: 12 };
const request = (path, options) => new Request(`https://jasontang.dev${path}`, options);
test('validates event schema and rejects malformed or personal data', () => {
  assert.deepEqual(validateEvent(event).doubles, [12]);
  for (const patch of [{ name: 'unknown' }, { visit: 'email@example.com' }, { detail: '<script>' }, { value: '12' }, { value: -1 }, { value: Infinity }, { value: 1000001 }, { device: 'tablet' }, { referrer: 'host/path?email=x' }]) assert.equal(validateEvent({ ...event, ...patch }), null);
});
test('records same-origin events and handles invalid payloads and missing storage', async () => {
  const points = [];
  const env = { EVENTS: { writeDataPoint: p => points.push(p) } };
  const post = (body, origin = 'https://jasontang.dev') => request('/api/event', { method: 'POST', headers: { Origin: origin }, body });
  assert.equal((await analytics(post(JSON.stringify(event)), env)).status, 204);
  assert.equal(points.length, 1);
  assert.equal((await analytics(post(JSON.stringify(event), 'https://elsewhere.test'), env)).status, 403);
  assert.equal((await analytics(post('x'), env)).status, 400);
  assert.equal((await analytics(post('x'.repeat(1001)), env)).status, 413);
  assert.equal((await analytics(post(JSON.stringify(event)), {})).status, 503);
  assert.equal((await analytics(request('/api/event'), env)).status, 405);
});
const rows = [
  { name: 'visit', count: '3', total: '0', device: 'phone', referrer: '' },
  { name: 'visit', count: '2', total: '0', device: 'desktop', referrer: 'example.com' },
  { name: 'snake-score', count: 9, total: 60, maximum: 14 },
  { name: 'snake-score', count: 3, total: 10, maximum: 7 },
  { name: '2048-score', count: 2, total: 5000, maximum: 4000 },
  { name: '2048-win', count: 1, total: 0, maximum: 0 },
  { name: 'breakout-complete', count: 4, total: 0 },
  { name: 'breakout-win', count: 2, total: 101 },
  { name: 'minesweeper-win', count: 3, total: 0 },
  { name: 'mail-error', count: 2, detail: 'email', total: 0 },
  { name: 'balloon-pop', count: 6, total: 0 },
  { name: 'koi-feed', count: 11, total: 0 },
];
test('summary separates game completions from per-visit funnel and uses maximum score', () => {
  const result = summarize(rows, [{ day: '2026-09-26 00:00:00', visits: '5' }]);
  assert.equal(result.visitors, 5);
  assert.equal(result.snakeHighScore, 14);
  assert.equal(result.twenty48HighScore, 4000);
  assert.equal(result.twenty48Wins, 1);
  assert.equal(result.balloonsPopped, 6);
  assert.equal(result.koiFed, 11);
  assert.equal(result.breakoutWins, 4);
  assert.equal(result.minesweeperWins, 3);
  assert.equal(result.breakout.averageWinSeconds, 51);
  assert.equal(result.funnel[3].count, 2);
  assert.equal(result.referrers[0].label, 'direct');
  assert.equal(result.daily[0].day, '2026-09-26');
  assert.equal(summarize([]).snakeHighScore, 0);
});
test('the summary route returns everything and rejects invalid periods and methods', async () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: 'test', ANALYTICS_TOKEN: 'secret' };
  let calls = 0;
  const options = { fetcher: async (_url, init) => {
    calls++;
    assert.equal(init.headers.Authorization, 'Bearer secret');
    if (init.body.includes('GROUP BY country')) return Response.json({ data: [{ country: 'CA', region: 'Ontario', city: 'Toronto', visits: '5' }] });
    return Response.json({ data: init.body.includes('GROUP BY day') ? [] : rows });
  } };
  const result = await (await analytics(request('/api/analytics'), env, options)).json();
  assert.equal(calls, 3);
  assert.deepEqual(result.cities, [{ label: 'Toronto, Ontario', country: 'CA', count: 5 }]);
  assert.equal(result.visitors, 5);
  assert.equal(result.mail.errors[0].count, 2);
  assert.equal(result.referrers[0].label, 'direct');
  assert.equal((await analytics(request('/api/analytics?days=0'), env, options)).status, 400);
  assert.equal((await analytics(request('/api/analytics?days=all'), env, options)).status, 400);
  assert.equal((await analytics(request('/api/analytics', { method: 'POST' }), env, options)).status, 405);
  assert.equal((await analytics(request('/api/analytics'), {}, options)).status, 503);
  assert.throws(() => queries('30 OR 1=1'), RangeError);
  assert.match(queries(30).events, /MAX\(double1\)/);
});

test('sticky note windows are added together into one row', () => {
  const result = summarize([
    { name: 'open', detail: 'about', count: 3, total: 0 },
    { name: 'open', detail: 'sticky-28cb688e-5697-4ef6-945d-46413ffcfe6f', count: 2, total: 0 },
    { name: 'open', detail: 'sticky-11111111-2222-3333-4444-555555555555', count: 2, total: 0 },
    { name: 'open', detail: 'stickies', count: 1, total: 0 },
  ]);
  assert.deepEqual(result.windows, [{ label: 'sticky notes', count: 4 }, { label: 'about', count: 3 }, { label: 'stickies', count: 1 }]);
});

test('chat messages and clippy tokens are summarized, but the page cannot send them', () => {
  const rows = [
    { name: 'chat-message', detail: '', device: '', referrer: '', count: 4, total: 0, maximum: 0 },
    { name: 'clippy-tokens', detail: '', device: '', referrer: '', count: 2, total: 310, maximum: 160 },
  ];
  const s = summarize(rows);
  assert.equal(s.chatMessages, 4);
  assert.equal(s.tokensBurnt, 310);
  assert.equal(validateEvent({ visit: 'abcdefgh12', name: 'clippy-tokens', value: 1e6 }), null);
});
test('sources fold www, link wrappers and t.co into one name each', () => {
  const visit = (referrer, count) => ({ name: 'visit', count, total: 0, device: 'desktop', referrer });
  const result = summarize([visit('www.google.com', 2), visit('google.com', 1), visit('l.instagram.com', 4), visit('t.co', 1), visit('resume', 1), visit('', 5)]);
  assert.deepEqual(result.referrers, [
    { label: 'direct', count: 5 }, { label: 'instagram.com', count: 4 }, { label: 'google.com', count: 3 },
    { label: 'x.com', count: 1 }, { label: 'resume', count: 1 },
  ]);
});

test('visits get their location from cloudflare, never from the page', async () => {
  const points = [];
  const env = { EVENTS: { writeDataPoint: p => points.push(p) } };
  const post = (body, cf) => {
    const req = request('/api/event', { method: 'POST', headers: { Origin: 'https://jasontang.dev', 'CF-Connecting-IP': '203.0.113.7', 'User-Agent': 'test' }, body: JSON.stringify(body) });
    Object.defineProperty(req, 'cf', { value: cf });
    return req;
  };
  env.VISITOR_SALT = 'salt';
  await analytics(post({ visit: 'abcd123456', name: 'visit', country: 'FR', visitor: 'forged' }, { country: 'CA', region: 'Ontario', city: 'Toronto' }), env);
  await analytics(post({ visit: 'abcd123456', name: 'open', detail: 'music' }, { country: 'CA', region: 'Ontario', city: 'Toronto' }), env);
  assert.deepEqual(points[0].blobs.slice(5, 8), ['CA', 'Ontario', 'Toronto']);
  assert.match(points[0].blobs[8], /^[0-9a-f]{16}$/);
  assert.ok(!points[0].blobs.join('|').includes('203.0.113.7'));
  // an open has no place or visitor id, only the empty slots before its via
  assert.deepEqual(points[1].blobs.slice(5, 9), ["", "", "", ""]);
  assert.deepEqual(place(undefined), ['', '', '']);
  assert.deepEqual(place({ country: 'XX', city: 'x'.repeat(200) }), ['', '', 'x'.repeat(80)]);
});
test('places are counted by country, region and city, leaving out visits with no place', () => {
  const result = summarizePlaces([
    { country: 'CA', region: 'Ontario', city: 'Toronto', visits: 3 },
    { country: 'CA', region: 'Ontario', city: 'Waterloo', visits: 1 },
    { country: 'GB', region: 'England', city: 'London', visits: 2 },
    { country: 'CA', region: 'Ontario', city: 'London', visits: 1 },
    { country: '', region: '', city: '', visits: 4 },
  ]);
  assert.deepEqual(result.countries, [{ label: 'Canada', country: 'CA', count: 5 }, { label: 'United Kingdom', country: 'GB', count: 2 }]);
  assert.deepEqual(result.regions[0], { label: 'Ontario, Canada', country: 'CA', count: 5 });
  assert.deepEqual(result.cities.map(c => c.label), ['Toronto, Ontario', 'London, England', 'Waterloo, Ontario', 'London, Ontario']);
});

test('a visitor id is the same all month for one ip and browser, and changes otherwise', async () => {
  const req = (ip, ua = 'firefox') => new Request('https://jasontang.dev/api/event', { headers: { 'CF-Connecting-IP': ip, 'User-Agent': ua } });
  const env = { VISITOR_SALT: 'salt' };
  const early = new Date('2026-11-01T00:00:00Z'), late = new Date('2026-11-30T23:59:00Z'), next = new Date('2026-12-01T00:00:00Z');
  const id = await visitorId(req('203.0.113.7'), env, early);
  assert.equal(await visitorId(req('203.0.113.7'), env, late), id);
  assert.notEqual(await visitorId(req('203.0.113.7'), env, next), id);
  assert.notEqual(await visitorId(req('203.0.113.8'), env, early), id);
  assert.notEqual(await visitorId(req('203.0.113.7', 'chrome'), env, early), id);
  assert.notEqual(await visitorId(req('203.0.113.7'), { VISITOR_SALT: 'other' }, early), id);
  assert.equal(await visitorId(req('203.0.113.7'), {}, early), '');
  assert.equal(await visitorId(new Request('https://jasontang.dev/'), env, early), '');
});
test('unique visitors count each id once and each visit from before ids once', () => {
  assert.equal(visitorsIn({ visits: 9, ids: 3, blankRows: 0, blankVisits: 0 }), 3);
  // two real ids plus the blank one, and four old visits with no id
  assert.equal(visitorsIn({ visits: 10, ids: 3, blankRows: 4, blankVisits: 4 }), 6);
  assert.equal(visitorsIn({ visits: 5 }), 5);
  const result = summarize([], [], [
    { country: 'CA', region: 'Ontario', city: 'Toronto', visits: 9, ids: 3, blankRows: 0, blankVisits: 0 },
    { country: '', region: '', city: '', visits: 200, ids: 1, blankRows: 200, blankVisits: 200 },
  ]);
  assert.equal(result.uniqueVisitors, 203);
  assert.deepEqual(result.countries, [{ label: 'Canada', country: 'CA', count: 3 }]);
});

test('sources and days count unique visitors, and the page cannot pick its own id', async () => {
  const result = summarize(
    [{ name: 'visit', detail: '', device: 'desktop', referrer: 'github.com', count: 9, total: 0, ids: 2, blankRows: 0, blankVisits: 0 }],
    [{ day: '2026-11-06 00:00:00', visits: 9, ids: 2, blankRows: 0, blankVisits: 0 }],
  );
  assert.deepEqual(result.referrers, [{ label: 'github.com', count: 2 }]);
  assert.deepEqual(result.daily, [{ day: '2026-11-06', visits: 2 }]);
  const sent = [];
  const env = { VISITOR_SALT: 'salt', EVENTS: { writeDataPoint() {} }, LIVE_STATS: { idFromName: () => 'site', get: () => ({ fetch: async r => { sent.push(await r.json()); return new Response(null); } }) } };
  const req = request('/api/event', { method: 'POST', headers: { Origin: 'https://jasontang.dev', 'CF-Connecting-IP': '203.0.113.7' }, body: JSON.stringify({ visit: 'abcd123456', name: 'visit', visitor: 'ffffffffffffffff' }) });
  await analytics(req, env);
  assert.match(sent[0].visitor, /^[0-9a-f]{16}$/);
  assert.notEqual(sent[0].visitor, 'ffffffffffffffff');
});

test('an open keeps where it came from in its own blob, and nothing else does', () => {
  const open = validateEvent({ visit: 'abcd123456', name: 'open', detail: 'projects', via: 'about' });
  assert.equal(open.blobs.length, 10);
  assert.equal(open.blobs[9], 'about');
  assert.equal(validateEvent({ visit: 'abcd123456', name: 'open', detail: 'projects' }).blobs[9], '');
  assert.equal(validateEvent({ visit: 'abcd123456', name: 'snake-score', value: 3, via: 'about' }).blobs.length, 5);
  assert.equal(validateEvent({ visit: 'abcd123456', name: 'open', detail: 'projects', via: '<b>' }), null);
});
