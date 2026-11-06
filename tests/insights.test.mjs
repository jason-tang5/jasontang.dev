import test from 'node:test';
import assert from 'node:assert/strict';
import { insights, insightQueries, journeys, retention, openedFrom } from '../worker/insights.mjs';

const row = (visit, detail, at, weight = 1) => ({ visit, detail, at: `2026-11-06 10:${at}`, weight });
test('journeys are the windows in the order they opened, top paths first', () => {
  const result = journeys([
    row('a', 'about', '00:00'), row('a', 'projects', '00:10'),
    row('b', 'projects', '00:00'), row('b', 'about', '00:10'),
    row('c', 'about', '00:00'), row('c', 'resume', '00:05'),
    row('d', 'about', '00:00'), row('d', 'sticky-1', '00:01'), row('d', 'sticky-2', '00:02'),
    row('d', 'music', '00:03'), row('d', 'games', '00:04'), row('d', 'blog', '00:05'),
  ]);
  // the about me the site opened itself is left off the front, so b, which opened
  // projects first, and c, which opened only about me after it, differ from a
  assert.equal(result.opened, 4);
  assert.deepEqual(result.paths.map(p => p.path), [['projects'], ['projects', 'about'], ['resume'], ['stickies', 'music', 'games', 'blog']]);
  assert.equal(result.paths[0].count, 1);
  // sticky notes fold into one step, and past four windows the rest is "more"
  assert.equal(result.paths.find(p => p.more), undefined);
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
    if (init.body.includes('blob10 AS via')) return Response.json({ data: [{ via: 'desktop', detail: 'resume', opens: 2 }] });
    return Response.json({ data: init.body.includes('blob9 AS visitor') ? [{ visitor: 'a', day: '2026-11-02 00:00:00' }] : [row('a', 'resume', '00:00')] });
  };
  const req = path => new Request(`https://jasontang.dev${path}`);
  const result = await (await insights(req('/api/insights?days=30'), env, { fetcher })).json();
  assert.equal(calls.length, 3);
  assert.deepEqual(result.openedFrom, [{ via: 'desktop', count: 2, windows: [{ id: 'resume', count: 2 }] }]);
  assert.deepEqual(result.journeys, { opened: 1, paths: [{ path: ['resume'], more: false, count: 1 }] });
  assert.equal(result.retention[0].visitors, 1);
  assert.equal(result.complete, true);
  assert.equal((await insights(req('/api/insights?days=5'), env, { fetcher })).status, 400);
  assert.equal((await insights(req('/api/insights'), {}, { fetcher })).status, 503);
  assert.throws(() => insightQueries('30 OR 1=1'), RangeError);
});

test('opened from counts each source, biggest first, with its top windows', () => {
  const result = openedFrom([
    { via: 'about', detail: 'projects', opens: 5 }, { via: 'about', detail: 'resume', opens: 3 },
    { via: 'about', detail: 'contact', opens: 2 }, { via: 'about', detail: 'music', opens: 1 },
    { via: 'desktop', detail: 'sticky-1', opens: 2 }, { via: 'desktop', detail: 'sticky-2', opens: 2 }, { via: 'desktop', detail: 'games', opens: 3 },
  ]);
  assert.deepEqual(result.map(s => [s.via, s.count]), [['about', 11], ['desktop', 7]]);
  assert.deepEqual(result[0].windows.map(w => w.id), ['projects', 'resume', 'contact']);
  assert.deepEqual(result[1].windows, [{ id: 'stickies', count: 4 }, { id: 'games', count: 3 }]);
});
