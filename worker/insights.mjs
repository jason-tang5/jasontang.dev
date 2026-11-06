// the analytics window's insights tab: funnels, journeys and retention, served at
// GET /api/insights?days=30. apart from the main summary so the window only asks for
// them while the tab is open. nothing new is recorded for these, they're other ways of
// reading the same events (worker/analytics.mjs):
//
//   funnels    a few paths through the site, and how many visits reach each step in
//              order, so the drop-off between steps shows where people give up
//   journeys   the windows each visit opened, in order, and the most common paths
//   retention  visitors grouped by the week they first came, and how many came back
//              in the weeks after. visitor ids are new each month, so a visitor coming
//              back across the turn of a month looks like someone new
//
// the visit rows are one per visit, event and detail, with the first time that visit
// did it. sampling keeps or drops whole visits, so a kept visit's whole path is there,
// weighted by how many visits it stands in for
import { dataset, periods, sql } from './analytics.mjs';

// each step is any one of its events, [name] or [name, detail]
export const funnels = [
  {
    id: 'contact',
    title: 'Getting in touch',
    steps: [
      { label: 'Visited the site', events: [['visit']] },
      { label: 'Opened Contact', events: [['open', 'contact']] },
      { label: 'Started Breakout', events: [['breakout-start']] },
      { label: 'Got past Breakout', events: [['breakout-win'], ['breakout-mercy']] },
      { label: 'Opened Mail', events: [['open', 'mail']] },
      { label: 'Sent a message', events: [['mail-sent']] },
    ],
  },
  {
    id: 'hiring',
    title: 'Hiring',
    steps: [
      { label: 'Visited the site', events: [['visit']] },
      { label: 'Opened Projects', events: [['open', 'projects']] },
      { label: 'Opened Resume', events: [['open', 'resume']] },
      { label: 'Opened Contact', events: [['open', 'contact']] },
    ],
  },
  {
    id: 'reading',
    title: 'Reading',
    steps: [
      { label: 'Visited the site', events: [['visit']] },
      { label: 'Opened Blog', events: [['open', 'blog']] },
      { label: 'Read a post', events: [['blog-post']] },
    ],
  },
];

// enough for a lot more traffic than the site gets. past it, the oldest visits drop out
export const rowLimit = 50000;
// a journey is its first few windows, the rest shown as more
export const journeyLength = 4;
// retention looks this many weeks past the first
export const retentionWeeks = 4;

export function insightQueries(days) {
  if (!periods.includes(days)) throw new RangeError('Pick 7, 30 or 90 days.');
  const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;
  const names = [...new Set(['open', ...funnels.flatMap(f => f.steps.flatMap(s => s.events.map(([name]) => name)))])];
  return {
    visits: `SELECT blob3 AS visit, blob1 AS name, blob2 AS detail, min(timestamp) AS at, max(_sample_interval) AS weight
      FROM ${dataset} WHERE ${since} AND blob1 IN (${names.map(n => `'${n}'`).join(', ')})
      GROUP BY visit, name, detail ORDER BY at DESC LIMIT ${rowLimit} FORMAT JSON`,
    returns: `SELECT blob9 AS visitor, toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day
      FROM ${dataset} WHERE ${since} AND blob1 = 'visit' AND blob9 != ''
      GROUP BY visitor, day LIMIT ${rowLimit} FORMAT JSON`,
  };
}

// the rows gathered into visits, each with its events
function byVisit(rows) {
  const visits = new Map();
  for (const row of rows) {
    const visit = visits.get(row.visit) || { weight: Number(row.weight) || 1, events: [] };
    // the timestamps are all "YYYY-MM-DD hh:mm:ss", so they sort as text
    visit.events.push({ name: row.name, detail: row.detail || '', at: String(row.at) });
    visits.set(row.visit, visit);
  }
  return [...visits.values()];
}

// how many visits reach each step of each funnel
export function walkFunnels(visits) {
  return funnels.map(({ id, title, steps }) => {
    const counts = steps.map(() => 0);
    for (const { weight, events } of visits) {
      let after = '';
      for (const [i, step] of steps.entries()) {
        const times = events
          .filter(e => e.at >= after && step.events.some(([name, detail]) => e.name === name && (detail === undefined || e.detail === detail)))
          .map(e => e.at)
          .sort();
        if (!times.length) break;
        counts[i] += weight;
        after = times[0];
      }
    }
    return { id, title, steps: steps.map((step, i) => ({ label: step.label, count: Math.round(counts[i]) })) };
  });
}

// the most common orders windows get opened in. every sticky note is its own window,
// so they all count as the sticky notes app
export function journeys(visits, top = 10) {
  const paths = new Map();
  let opened = 0;
  for (const { weight, events } of visits) {
    const windows = events
      .filter(e => e.name === 'open' && e.detail)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map(e => (e.detail.startsWith('sticky-') ? 'stickies' : e.detail))
      .filter((id, i, list) => id !== list[i - 1]);
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
    const [rows, returns] = await Promise.all([sql(q.visits, options), sql(q.returns, options)]);
    const visits = byVisit(rows);
    return json({
      days,
      funnels: walkFunnels(visits),
      journeys: journeys(visits),
      retention: retention(returns, now),
      complete: rows.length < rowLimit && returns.length < rowLimit,
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Couldn’t load insights right now.' }, 502);
  }
}
