import test from 'node:test';
import assert from 'node:assert/strict';
import { insights, insightQueries, walkFunnels, journeys, retention, funnels } from '../worker/insights.mjs';

const row = (visit, name, detail, at, weight = 1) => ({ visit, name, detail, at: `2026-11-06 10:${at}`, weight });
const visitsOf = rows => {
  const map = new Map();
  for (const r of rows) {
    const v = map.get(r.visit) || { weight: r.weight, events: [] };
    v.events.push({ name: r.name, detail: r.detail || '', at: r.at });
    map.set(r.visit, v);
  }
  return [...map.values()];
};

test('funnel steps only count when they happen in order, and any listed event fills a step', () => {
  const visits = visitsOf([
    // a went all the way, getting past breakout by losing three times
    row('a', 'visit', '', '00:00'), row('a', 'open', 'contact', '00:10'), row('a', 'breakout-start', '', '00:20'),
    row('a', 'breakout-mercy', '', '01:00'), row('a', 'open', 'mail', '01:10'), row('a', 'mail-sent', '', '02:00'),
    // b opened mail before contact, so the funnel stops at contact
    row('b', 'visit', '', '00:00'), row('b', 'open', 'mail', '00:05'), row('b', 'open', 'contact', '00:10'),
    // c stands in for three visits that only looked
    row('c', 'visit', '', '00:00', 3),
  ]);
  const contact = walkFunnels(visits).find(f => f.id === 'contact');
  assert.deepEqual(contact.steps.map(s => s.count), [5, 2, 1, 1, 1, 1]);
});

test('journeys are the windows in the order they opened, top paths first', () => {
  const visits = visitsOf([
    row('a', 'open', 'about', '00:00'), row('a', 'open', 'projects', '00:10'),
    row('b', 'open', 'projects', '00:10'), row('b', 'open', 'about', '00:00'),
    row('c', 'open', 'about', '00:00'), row('c', 'open', 'resume', '00:05'),
    row('d', 'open', 'about', '00:00'), row('d', 'open', 'sticky-1', '00:01'), row('d', 'open', 'sticky-2', '00:02'),
    row('d', 'open', 'music', '00:03'), row('d', 'open', 'games', '00:04'), row('d', 'open', 'blog', '00:05'),
    row('e', 'visit', '', '00:00'),
  ]);
  const result = journeys(visits);
  assert.equal(result.opened, 4);
  assert.deepEqual(result.paths[0], { path: ['about', 'projects'], more: false, count: 2 });
  // sticky notes fold into one step, and past four windows the rest is "more"
  assert.deepEqual(result.paths.find(p => p.more), { path: ['about', 'stickies', 'music', 'games'], more: true, count: 1 });
});

test('retention groups visitors by their first week and counts the weeks they came back', () => {
  const now = Date.parse('2026-11-30T12:00:00Z');
  const result = retention([
    // week of nov 2: one comes back the next week, one never does
    { visitor: 'a', day: '2026-11-02 00:00:00' }, { visitor: 'a', day: '2026-11-10 00:00:00' },
    { visitor: 'b', day: '2026-11-03 00:00:00' },
    // week of nov 23: too recent to have a week 1 yet
    { visitor: 'c', day: '2026-11-25 00:00:00' },
  ], now);
  assert.deepEqual(result[0], { week: '2026-11-02', visitors: 2, weeks: [2, 1, 0, 0, null] });
  assert.deepEqual(result[1], { week: '2026-11-23', visitors: 1, weeks: [1, null, null, null, null] });
});

test('the insights route checks its period and reads both queries', async () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: 'test', ANALYTICS_TOKEN: 'secret' };
  const calls = [];
  const fetcher = async (_url, init) => {
    calls.push(init.body);
    return Response.json({ data: init.body.includes('blob9 AS visitor') ? [{ visitor: 'a', day: '2026-11-02 00:00:00' }] : [row('a', 'visit', '', '00:00')] });
  };
  const req = path => new Request(`https://jasontang.dev${path}`);
  const result = await (await insights(req('/api/insights?days=30'), env, { fetcher })).json();
  assert.equal(calls.length, 2);
  assert.equal(result.funnels.length, funnels.length);
  assert.equal(result.funnels[0].steps[0].count, 1);
  assert.equal(result.retention[0].visitors, 1);
  assert.equal(result.complete, true);
  assert.equal((await insights(req('/api/insights?days=5'), env, { fetcher })).status, 400);
  assert.equal((await insights(req('/api/insights'), {}, { fetcher })).status, 503);
  assert.throws(() => insightQueries('30 OR 1=1'), RangeError);
});
