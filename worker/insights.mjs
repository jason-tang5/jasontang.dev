// the analytics window's insights tab: journeys and retention, served at
// GET /api/insights?days=30. apart from the main summary so the window only asks for
// them while the tab is open. nothing new is recorded for these, they're other ways of
// reading the same events (worker/analytics.mjs):
//
//   journeys   the windows each visit opened, in order, and the most common paths.
//              the rows are one per visit and window, with the first time it opened.
//              sampling keeps or drops whole visits, so a kept visit's whole path is
//              there, weighted by how many visits it stands in for
//   opened from  where windows get opened from: the desktop, the start menu, a link
//              in another window and so on, with the windows each one opens most
//   retention  visitors grouped by the week they first came, and how many came back
//              in the weeks after. visitor ids are new each month, so a visitor coming
//              back across the turn of a month looks like someone new
import { dataset, periods, sql } from './analytics.mjs';

// enough for a lot more traffic than the site gets. past it, the oldest visits drop out
export const rowLimit = 50000;
// a journey is its first few windows, the rest shown as more
export const journeyLength = 4;
// retention looks this many weeks past the first
export const retentionWeeks = 4;

export function insightQueries(days) {
  if (!periods.includes(days)) throw new RangeError('Pick 7, 30 or 90 days.');
  const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;
  return {
    opens: `SELECT blob3 AS visit, blob2 AS detail, min(timestamp) AS at, max(_sample_interval) AS weight
      FROM ${dataset} WHERE ${since} AND blob1 = 'open'
      GROUP BY visit, detail ORDER BY at DESC LIMIT ${rowLimit} FORMAT JSON`,
    // opens from before via was recorded have none, and are left out
    sources: `SELECT blob10 AS via, blob2 AS detail, SUM(_sample_interval) AS opens
      FROM ${dataset} WHERE ${since} AND blob1 = 'open' AND blob10 != ''
      GROUP BY via, detail FORMAT JSON`,
    returns: `SELECT blob9 AS visitor, toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day
      FROM ${dataset} WHERE ${since} AND blob1 = 'visit' AND blob9 != ''
      GROUP BY visitor, day LIMIT ${rowLimit} FORMAT JSON`,
  };
}

// the most common orders windows get opened in. every sticky note is its own window,
// so they all count as the sticky notes app. the site opens about me itself on a fresh
// visit, and visits from before that stopped being counted start with it, so a journey
// that starts with about me starts after it
export function journeys(rows, top = 10) {
  const visits = new Map();
  for (const row of rows) {
    if (!row.detail) continue;
    const visit = visits.get(row.visit) || { weight: Number(row.weight) || 1, opens: [] };
    // the timestamps are all "YYYY-MM-DD hh:mm:ss", so they sort as text
    visit.opens.push({ id: row.detail.startsWith('sticky-') ? 'stickies' : row.detail, at: String(row.at) });
    visits.set(row.visit, visit);
  }
  const paths = new Map();
  let opened = 0;
  for (const { weight, opens } of visits.values()) {
    const windows = opens
      .sort((a, b) => a.at.localeCompare(b.at))
      .map(open => open.id)
      .filter((id, i, list) => id !== list[i - 1])
      .filter((id, i) => !(i === 0 && id === 'about'));
    if (!windows.length) continue;
    opened += weight;
    const path = windows.slice(0, journeyLength);
    const more = windows.length > journeyLength;
    const key = `${path.join('>')}${more ? '>…' : ''}`;
    const entry = paths.get(key) || { path, more, count: 0 };
    entry.count += weight;
    paths.set(key, entry);
  }
  const list = [...paths.values()].sort((a, b) => b.count - a.count).slice(0, top).map(p => ({ ...p, count: Math.round(p.count) }));
  return { opened: Math.round(opened), paths: list };
}

// each place windows get opened from, most first, with its top windows
export function openedFrom(rows, top = 3) {
  const sources = new Map();
  for (const row of rows) {
    const count = Number(row.opens) || 0;
    const id = row.detail?.startsWith('sticky-') ? 'stickies' : row.detail;
    const source = sources.get(row.via) || { via: row.via, count: 0, windows: new Map() };
    source.count += count;
    source.windows.set(id, (source.windows.get(id) || 0) + count);
    sources.set(row.via, source);
  }
  return [...sources.values()]
    .sort((a, b) => b.count - a.count)
    .map(s => ({
      via: s.via,
      count: Math.round(s.count),
      windows: [...s.windows].sort((a, b) => b[1] - a[1]).slice(0, top).map(([id, count]) => ({ id, count: Math.round(count) })),
    }));
}

const dayMs = 86400000;
const dayNumber = day => Math.floor(Date.parse(`${String(day).slice(0, 10)}T00:00:00Z`) / dayMs);
// the monday of a day's week, as a day number
const mondayOf = n => n - ((new Date(n * dayMs).getUTCDay() + 6) % 7);

// visitors by the week they first came, and how many of them came back each week
// after. a week that hasn't happened yet for a cohort is null
export function retention(rows, now = Date.now()) {
  const today = Math.floor(now / dayMs);
  const seen = new Map();
  for (const { visitor, day } of rows) {
    if (!visitor) continue;
    const days = seen.get(visitor) || [];
    days.push(dayNumber(day));
    seen.set(visitor, days);
  }
  const cohorts = new Map();
  for (const days of seen.values()) {
    const first = Math.min(...days);
    const week = mondayOf(first);
    const cohort = cohorts.get(week) || { week, visitors: 0, weeks: Array(retentionWeeks + 1).fill(0) };
    cohort.visitors++;
    const back = new Set(days.map(d => Math.floor((d - first) / 7)));
    for (let k = 0; k <= retentionWeeks; k++) if (back.has(k)) cohort.weeks[k]++;
    cohorts.set(week, cohort);
  }
  return [...cohorts.values()]
    .sort((a, b) => a.week - b.week)
    .map(c => ({
      week: new Date(c.week * dayMs).toISOString().slice(0, 10),
      visitors: c.visitors,
      // a week counts from the cohort's first day, so its last visitors reach week k on
      // the sunday plus 7k days
      weeks: c.weeks.map((n, k) => (c.week + 6 + k * 7 <= today || k === 0 ? n : null)),
    }));
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export async function insights(request, env, { fetcher = fetch, now = Date.now() } = {}) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.ANALYTICS_TOKEN) return json({ error: 'Analytics isn’t set up yet: ANALYTICS_TOKEN is missing.' }, 503);
  const days = Number(new URL(request.url).searchParams.get('days') ?? 30);
  if (!periods.includes(days)) return json({ error: 'Pick 7, 30 or 90 days.' }, 400);
  try {
    const options = { accountId: env.CLOUDFLARE_ACCOUNT_ID, token: env.ANALYTICS_TOKEN, fetcher };
    const q = insightQueries(days);
    const [opens, sources, returns] = await Promise.all([sql(q.opens, options), sql(q.sources, options), sql(q.returns, options)]);
    return json({
      days,
      journeys: journeys(opens),
      openedFrom: openedFrom(sources),
      retention: retention(returns, now),
      complete: opens.length < rowLimit && returns.length < rowLimit,
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Couldn’t load insights right now.' }, 502);
  }
}
