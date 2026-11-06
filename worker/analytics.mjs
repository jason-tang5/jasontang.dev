import { liveStats } from './live-stats.mjs';
// visitor analytics, stored in workers analytics engine (the EVENTS binding in
// wrangler.jsonc). the site sends small anonymous events (src/analytics.js):
//
//   POST /api/event              { visit, name, detail, value, device, referrer }
//   GET  /api/analytics          the summary for the analytics window, public
//
// a visit is a random id made per page load and kept in memory, so there are no
// cookies. the worker adds two things to each visit, and never stores the ip itself:
//   where it came from, the country, region and city cloudflare works out from the
//   connection (request.cf)
//   who it was, umami's way: a hash of a secret salt, the month, the ip and the
//   browser, so one person counts once a month (visitorId below)
// the summary is built with the analytics engine sql api, which needs CLOUDFLARE_ACCOUNT_ID (a var) and ANALYTICS_TOKEN (a secret,
// an api token with account analytics read). kept apart from the worker so it can
// be tested in plain node, and scripts/analytics-report.mjs reuses it for writeups.
export const dataset = 'jasontang_events';

// every event the site sends. anything else is ignored
export const eventNames = [
  'heartbeat', 'leave',
  'snake-score', // score reached during play
  'minesweeper-win', // each completed board
  'breakout-complete', // each completed board, including replays
  'reversi-win', // beat clippy at reversi
  'reversi-lose', // clippy won
  '2048-win', // made the 2048 tile, once per game
  '2048-score', // a finished 2048 game (game over or restarted). value is the score
  'visit', // first interaction of a page load. detail is the window it opened on
  'open', // a window opened. detail is its app id
  'blog-post', // a blog post read. detail is its slug
  'breakout-start', // started playing breakout
  'breakout-lose', // lost the ball. value is how many times this visit
  'breakout-win', // cleared the board. value is seconds from the first start
  'breakout-mercy', // three losses in a row opened mail anyway
  'email-click', // clicked the email revealed by breakout
  'mail-error', // the mail form refused to send. detail is the field
  'mail-sent',
  'mail-failed',
  'balloon-pop', // popped one of the about window's balloons
  'koi-feed', // dropped a handful of food in a koi pond
];
// written by the chat room itself (worker/chat-room.mjs), never accepted from the page:
//   chat-message    a visitor's message in the fishbowl
//   clippy-tokens   one of clippy's workers ai replies. value is the tokens it took

// a visit's source, shortened so the same site counts once: www.google.com and
// google.com are both google.com, and the link wrappers instagram and facebook use
// (l.instagram.com, lm.facebook.com) count as the site itself. t.co is x's
export function sourceName(source = '') {
  const name = String(source).toLowerCase().replace(/^(www|m|l|lm)\./, '');
  return name === 't.co' ? 'x.com' : name;
}

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
});

const slug = /^[a-z0-9-]{0,80}$/;

// checks an event from the site. returns the data point to write, or null
export function validateEvent(body) {
  if (!body || typeof body !== 'object') return null;
  const { visit, name, detail = '', value = 0, device = '', referrer = '' } = body;
  if (typeof visit !== 'string' || !/^[a-z0-9]{8,24}$/.test(visit)) return null;
  if (!eventNames.includes(name)) return null;
  if (typeof detail !== 'string' || !slug.test(detail)) return null;
  if (!['', 'phone', 'desktop'].includes(device)) return null;
  if (typeof referrer !== 'string' || !/^[a-z0-9.-]{0,80}$/.test(referrer)) return null;
  if (typeof value !== 'number') return null;
  const number = value;
  if (!Number.isFinite(number) || number < 0 || number > 1e6) return null;
  return {
    // the visit is the index so sampling keeps or drops whole visits together
    indexes: [visit],
    blobs: [name, detail, visit, device, referrer],
    doubles: [number],
  };
}

// a visit's country code, region and city from cloudflare, blank when it doesn't know
export function place(cf = {}) {
  const clean = value => (typeof value === 'string' ? value.trim().slice(0, 80) : '');
  const country = clean(cf?.country).toUpperCase();
  return [/^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : '', clean(cf?.region), clean(cf?.city)];
}

// the same person on the same browser gets the same id all month, and a new one
// the next. it's a one-way hash, cut short, made with VISITOR_SALT (a secret, falling
// back to ANALYTICS_TOKEN), so the ip can't be read back out of it. blank when there's
// no salt or no ip
export async function visitorId(request, env, now = new Date()) {
  const salt = env.VISITOR_SALT || env.ANALYTICS_TOKEN;
  const ip = request.headers.get('CF-Connecting-IP');
  if (!salt || !ip) return '';
  const month = now.toISOString().slice(0, 7);
  const input = [salt, month, ip, request.headers.get('User-Agent') || ''].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest).slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
}

async function record(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) return json({ error: 'Forbidden.' }, 403);

  // sendBeacon posts text/plain, so read the body as text
  const text = await request.text();
  if (text.length > 1000) return json({ error: 'Too large.' }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const point = validateEvent(body);
  if (!point) return json({ error: 'Invalid event.' }, 400);
  // the visitor id only ever comes from here, whatever the page sent
  const visitor = body.name === 'visit' ? await visitorId(request, env) : '';
  if (body.name === 'visit') point.blobs.push(...place(request.cf), visitor);
  if (env.LIVE_STATS) await liveStats(env).fetch(new Request('https://stats/', { method: 'POST', body: JSON.stringify({ ...body, visitor }) }));
  if (body.name === 'heartbeat' || body.name === 'leave') return new Response(null, { status: 204 });
  if (!env.EVENTS) return json({ error: 'Analytics is not configured.' }, 503);
  env.EVENTS.writeDataPoint(point);
  return new Response(null, { status: 204 });
}

// ---- the summary ----

// the analytics engine keeps about three months, so 90 days is as far back as it goes
export const periods = [7, 30, 90];

export function queries(days) {
  if (!periods.includes(days)) throw new RangeError('Pick 7, 30 or 90 days.');
  const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;
  // unique visitors in a group: the different visitor ids, plus visits from before ids
  // were recorded (blob9 blank), which can only count as one visitor each (visitorsIn)
  const visitors = `count(DISTINCT blob9) AS ids, countIf(blob9 = '') AS blankRows, sumIf(_sample_interval, blob9 = '') AS blankVisits`;
  return {
    events: `SELECT blob1 AS name, blob2 AS detail, blob4 AS device, blob5 AS referrer,
      SUM(_sample_interval) AS count, SUM(_sample_interval * double1) AS total, MAX(double1) AS maximum, ${visitors}
      FROM ${dataset} WHERE ${since}
      GROUP BY name, detail, device, referrer FORMAT JSON`,
    daily: `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, SUM(_sample_interval) AS visits, ${visitors}
      FROM ${dataset} WHERE ${since} AND blob1 = 'visit'
      GROUP BY day ORDER BY day FORMAT JSON`,
    places: `SELECT blob6 AS country, blob7 AS region, blob8 AS city, SUM(_sample_interval) AS visits, ${visitors}
      FROM ${dataset} WHERE ${since} AND blob1 = 'visit'
      GROUP BY country, region, city FORMAT JSON`,
  };
}

// runs one query against the analytics engine sql api
export async function sql(query, { accountId, token, fetcher = fetch }) {
  const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: query,
  });
  if (!response.ok) throw new Error(`analytics query failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  return (await response.json()).data ?? [];
}

// each sticky note is its own window with a random id (sticky-<uuid>), so they're
// added together into one row instead of a row per note
export const stickyNotes = 'sticky notes';
function foldStickies(opens) {
  const folded = new Map();
  for (const [label, count] of opens) {
    const key = label.startsWith('sticky-') ? stickyNotes : label;
    folded.set(key, (folded.get(key) || 0) + count);
  }
  return folded;
}

// visits with no referrer and no ?ref= are direct: typed in, bookmarked, or opened
// from an app that doesn't say where it came from
function foldSources(referrers) {
  const folded = new Map();
  for (const [label, count] of referrers) {
    const key = sourceName(label) || 'direct';
    folded.set(key, (folded.get(key) || 0) + count);
  }
  return folded;
}

const sortedEntries = map => [...map].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));

// a country code as its name, US is United States
let regionNames;
export function countryName(code) {
  if (!code) return 'Unknown';
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
}

// a row's unique visitors. count(DISTINCT) counts a blank id as one more value, so
// that's taken off and the blank visits added back one each. rows without the id
// columns fall back to their visits
export function visitorsIn(row) {
  if (row.ids === undefined) return Number(row.visits ?? row.count) || 0;
  return Math.max(0, Number(row.ids) - (Number(row.blankRows) > 0 ? 1 : 0)) + (Number(row.blankVisits) || 0);
}

// visitors by country, by region and by city, each biggest first. a region or city
// carries what it's in, so two Londons stay apart. visits from before locations were
// recorded, or that cloudflare couldn't place, are left out of that list. every row
// keeps its country code for the flag beside it. counts are unique visitors
export function summarizePlaces(places = []) {
  const countries = new Map(), regions = new Map(), cities = new Map();
  const add = (map, label, code, count) => {
    const row = map.get(label) || { label, country: code, count: 0 };
    row.count += count;
    map.set(label, row);
  };
  for (const row of places) {
    const count = visitorsIn(row);
    const code = row.country || '';
    const country = code ? countryName(code) : '';
    if (country) add(countries, country, code, count);
    if (row.region) add(regions, [row.region, country].filter(Boolean).join(', '), code, count);
    if (row.city) add(cities, [row.city, row.region || country].filter(Boolean).join(', '), code, count);
  }
  const sorted = map => [...map.values()].sort((a, b) => b.count - a.count).map(row => ({ ...row, count: Math.round(row.count) }));
  return { countries: sorted(countries), regions: sorted(regions), cities: sorted(cities) };
}

// turns the raw rows into what the analytics window and the report show
export function summarize(rows, daily = [], places = []) {
  const count = new Map();
  const total = new Map();
  const by = (name, key) => {
    const map = new Map();
    for (const row of rows) if (row.name === name) map.set(row[key] || '', (map.get(row[key] || '') || 0) + Number(row.count));
    return map;
  };
  const visitorsBy = key => {
    const map = new Map();
    for (const row of rows) if (row.name === 'visit') map.set(row[key] || '', (map.get(row[key] || '') || 0) + visitorsIn(row));
    return map;
  };
  for (const row of rows) {
    count.set(row.name, (count.get(row.name) || 0) + Number(row.count));
    total.set(row.name, (total.get(row.name) || 0) + Number(row.total));
  }
  const n = name => Math.round(count.get(name) || 0);
  const visitors = n('visit');
  const opens = by('open', 'detail');
  const wins = n('breakout-win');

  return {
    visitors,
    snakeHighScore: Math.max(0, ...rows.filter(row => row.name === 'snake-score').map(row => Number(row.maximum) || 0)),
    twenty48HighScore: Math.max(0, ...rows.filter(row => row.name === '2048-score').map(row => Number(row.maximum) || 0)),
    twenty48Wins: n('2048-win'),
    balloonsPopped: n('balloon-pop'),
    koiFed: n('koi-feed'),
    chatMessages: n('chat-message'),
    tokensBurnt: Math.round(total.get('clippy-tokens') || 0),
    minesweeperWins: n('minesweeper-win'),
    breakoutWins: n('breakout-complete'),
    // reversi-lose is clippy winning, reversi-win is clippy losing
    clippyWins: n('reversi-lose'),
    clippyLosses: n('reversi-win'),
    // visitors per day and per source are unique visitors, like the banner
    daily: daily.map(row => ({ day: String(row.day).slice(0, 10), visits: Math.round(visitorsIn(row)) })),
    windows: sortedEntries(foldStickies(opens)),
    blogPosts: sortedEntries(by('blog-post', 'detail')),
    devices: sortedEntries(by('visit', 'device')),
    referrers: sortedEntries(foldSources(visitorsBy('referrer'))),
    // one person is one place in a month, so adding the places up counts each once
    uniqueVisitors: Math.round(places.reduce((sum, row) => sum + visitorsIn(row), 0)),
    ...summarizePlaces(places),
    // each step is counted once per visit on the site, so they're visitors
    funnel: [
      { label: 'Visited the site', count: visitors },
      { label: 'Opened Contact', count: Math.round(opens.get('contact') || 0) },
      { label: 'Started Breakout', count: n('breakout-start') },
      { label: 'Cleared the board', count: wins },
      { label: 'Unlocked Mail by losing 3 times', count: n('breakout-mercy') },
      { label: 'Clicked the revealed email', count: n('email-click') },
      { label: 'Opened Mail', count: Math.round(opens.get('mail') || 0) },
      { label: 'Sent a message', count: n('mail-sent') },
    ],
    breakout: {
      losses: n('breakout-lose'),
      averageWinSeconds: wins ? Math.round((total.get('breakout-win') || 0) / wins) : null,
    },
    mail: {
      errors: sortedEntries(by('mail-error', 'detail')),
      sent: n('mail-sent'),
      failed: n('mail-failed'),
    },
  };
}

async function summary(request, env, fetcher) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.ANALYTICS_TOKEN) {
    return json({ error: 'Analytics isn’t set up yet: ANALYTICS_TOKEN is missing.' }, 503);
  }
  const days = Number(new URL(request.url).searchParams.get('days') ?? 30);
  if (!periods.includes(days)) return json({ error: 'Pick 7, 30 or 90 days.' }, 400);

  try {
    const options = { accountId: env.CLOUDFLARE_ACCOUNT_ID, token: env.ANALYTICS_TOKEN, fetcher };
    const q = queries(days);
    const [rows, daily, places] = await Promise.all([sql(q.events, options), sql(q.daily, options), sql(q.places, options)]);
    return json({ days, ...summarize(rows, daily, places) });
  } catch (error) {
    console.error(error);
    return json({ error: 'Couldn’t load analytics right now.' }, 502);
  }
}

export function analytics(request, env, { fetcher = fetch } = {}) {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/event') return record(request, env);
  return summary(request, env, fetcher);
}
