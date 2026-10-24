<script setup>
// the figures in the analytics post (blog.mjs), swapped in by blog-figures.mjs: an
// event's trip from a click to the analytics window, the events a visit sends, rows
// turning into the summary, the pixel pie, and counters that never go backwards.
// they run the worker's own validateEvent, queries and summarize, the real PixelPie
// and createOptimisticStats, so they can't drift from the site. nothing here is sent
// anywhere: the event figure copies analytics.js's rules instead of calling track()
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import RetroIcon from './RetroIcon.vue';
import PixelPie from './PixelPie.vue';
import { validateEvent, queries, summarize, periods, eventNames } from '../../worker/analytics.mjs';
import { createOptimisticStats } from '../optimistic-stats.mjs';
import '../post-figures.css';

const props = defineProps({
  figure: { type: String, required: true },
  caption: { type: String, default: '' },
  number: { type: Number, default: 0 },
});

const descriptions = {
  journey: 'An event’s trip in steps. The browser posts it to the Worker, which checks it and writes it to both the Durable Object for live numbers and Analytics Engine for history. The Analytics window then reads the history through the SQL API and the live numbers from the Durable Object.',
  event: 'A pretend visit. Buttons load the page, click, open windows and win a game, and a log shows each event the browser would send and what the Worker keeps from it.',
  summary: 'A table of raw events, grouped the way the SQL query groups them and turned into the numbers the Analytics window shows. A switch keeps only one visit in four to show how sampled data is scaled back up.',
  pie: 'The pixel pie chart from the Analytics window with sliders for each slice. Pointing at a pixel shows the angle maths that picks its slice.',
  floors: 'A simulation of a counter shown three ways: only what the server says, the server plus your changes, and the site’s floors. Winning, losing the event and other visitors change the numbers over time, drawn as three lines.',
};

const root = ref(null);
const visible = ref(false);
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let observer;
onMounted(() => {
  if (typeof IntersectionObserver !== 'function') { visible.value = true; return; }
  observer = new IntersectionObserver(([entry]) => { visible.value = entry.isIntersecting; });
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());

// ---- journey: from a click to the analytics window ----
const nodes = {
  browser: { name: 'Your browser', icon: 'computer', code: 'analytics.js' },
  worker: { name: 'Worker', icon: 'chip', code: '/api/event' },
  engine: { name: 'Analytics Engine', icon: 'chart', code: 'EVENTS' },
  object: { name: 'Durable Object', icon: 'notebook', code: 'LIVE_STATS' },
  window: { name: 'Analytics window', icon: 'chart', code: 'Analytics.vue' },
  api: { name: 'Worker', icon: 'chip', code: '/api/analytics' },
};
const journey = [
  { on: ['browser'], title: 'First click', text: 'Nothing is sent while the page just sits there. The first click, tap or key press makes a random visit id, kept only in memory, and sends a visit event.' },
  { on: ['browser', 'worker'], path: 'browser-worker', title: 'POST /api/event', text: 'navigator.sendBeacon posts a small JSON body: the visit id, the event name, a detail slug and a number. Beacons still go out while the page is closing.' },
  { on: ['worker'], title: 'Check it', text: `The Origin has to be jasontang.dev, the body under 1000 bytes, the name one of ${eventNames.length} known events, every field shaped like a slug and the number at most a million. A wrong Origin gets a 403, a body that’s too big a 413, and anything else a 400.` },
  { on: ['worker', 'object'], path: 'worker-object', title: 'Live numbers', text: 'The event goes to the Durable Object first. It bumps the all-time counters, marks the visit as online and keeps the Snake leaderboard. Heartbeats and leaves stop here.' },
  { on: ['worker', 'engine'], path: 'worker-engine', title: 'History', text: 'writeDataPoint stores the event in Analytics Engine: the visit as the index, five text fields and one number. It doesn’t wait for a reply.' },
  { on: ['window', 'api'], path: 'window-api', title: 'Open Analytics', text: 'The window asks for /api/analytics?days=30 for history, and /api/stats for the live numbers. It asks again every 30 seconds while it’s open.' },
  { on: ['api', 'engine'], path: 'api-engine', title: 'Two SQL queries', text: 'The Worker runs two queries against the Analytics Engine SQL API: every event grouped by name, detail, device and referrer, and visits per day. summarize() turns the rows into the numbers on screen.' },
  { on: ['api', 'object'], path: 'api-object', title: 'The scoreboard', text: 'The live numbers come straight from the Durable Object: all-time totals, who’s online now, and the leaderboards.' },
  { on: ['window'], title: 'On screen', text: 'Your own events are shown straight away, before the server knows about them, as floors the server’s numbers can only raise. That’s the last figure.' },
];
const journeyStep = ref(0);
const journeyNow = computed(() => journey[journeyStep.value]);
let journeyTimer;
let journeyTouched = false;
// plays itself while it's on screen, until someone presses a button. it stays quiet
// for screen readers while it plays, so they aren't read a new step every few seconds
const journeyPlaying = ref(false);
watch(visible, on => {
  clearInterval(journeyTimer);
  journeyPlaying.value = false;
  if (!on || reduced || journeyTouched || props.figure !== 'journey') return;
  journeyPlaying.value = true;
  journeyTimer = setInterval(() => { journeyStep.value = (journeyStep.value + 1) % journey.length; }, 3600);
});
onBeforeUnmount(() => clearInterval(journeyTimer));
function journeyGo(step) {
  journeyTouched = true;
  journeyPlaying.value = false;
  clearInterval(journeyTimer);
  journeyStep.value = step;
}
// the wires are drawn from where the boxes really are, so they meet the edges at any
// width. each one points the way the request goes
const mapBox = ref(null);
const wireBox = ref({ width: 300, height: 150, wires: [] });
const wireEnds = [
  ['browser', 'worker'], ['worker', 'engine'], ['worker', 'object'],
  ['window', 'api'], ['api', 'engine'], ['api', 'object'],
];
function measureWires() {
  const map = mapBox.value;
  if (!map) return;
  const outer = map.getBoundingClientRect();
  const box = id => {
    const r = map.querySelector(`.af-at-${id}`).getBoundingClientRect();
    return { left: r.left - outer.left, right: r.right - outer.left, mid: (r.top + r.bottom) / 2 - outer.top };
  };
  const wires = wireEnds.map(([from, to]) => {
    const a = box(from);
    const b = box(to);
    // same row: straight across. otherwise corner to corner, a little off the middle
    const tilt = Math.abs(a.mid - b.mid) < 4 ? 0 : Math.sign(b.mid - a.mid) * 10;
    return { id: `${from}-${to}`, d: `M${(a.right + 2).toFixed(1)} ${(a.mid + tilt).toFixed(1)}L${(b.left - 3).toFixed(1)} ${(b.mid - tilt).toFixed(1)}` };
  });
  wireBox.value = { width: outer.width, height: outer.height, wires };
}
let wireObserver;
onBeforeUnmount(() => wireObserver?.disconnect());

// ---- event: what one visit sends ----
// the same rules as analytics.js: nothing until the first press, events before then wait
const eventLog = ref([]);
const waiting = ref([]);
const visit = ref(null);
const loaded = ref(false);
const closed = ref(false);
// the window in the address (#app=blog) when the page loaded, sent with the visit
const entry = ref('');
const sentOnce = new Set();
const randomVisit = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => (b % 36).toString(36)).join('');
function send(event) {
  const body = { visit: visit.value, ...event };
  const point = validateEvent(body);
  const live = !['heartbeat', 'leave'].includes(body.name);
  eventLog.value = [{ id: sentCount++, body, point, live, object: objectNote(body.name) }, ...eventLog.value].slice(0, 8);
}
let sentCount = 0;
// the json as sent, with a space after each comma so long lines can wrap there
const spaced = value => JSON.stringify(value, null, 1).replace(/\n\s*/g, ' ').replace(/([[{]) | ([\]}])/g, '$1$2');
// what live-stats.mjs does with each event, before it goes on to analytics engine
const objectCounters = { 'minesweeper-win': 'minesweeperWins', 'breakout-complete': 'breakoutWins', 'reversi-lose': 'clippyWins', 'reversi-win': 'clippyLosses', '2048-win': 'twenty48Wins' };
function objectNote(name) {
  if (name === 'visit') return 'counts a visitor and marks the visit online';
  if (name === 'heartbeat') return 'keeps the visit marked online';
  if (name === 'leave') return 'takes the visit off “online now”';
  if (objectCounters[name]) return `adds one to ${objectCounters[name]}`;
  return 'has no counter for it';
}
function pageLoad() {
  eventLog.value = [];
  waiting.value = [];
  visit.value = null;
  entry.value = '';
  sentOnce.clear();
  loaded.value = true;
  closed.value = false;
}
function track(name, detail = '', value = 0, once = false) {
  if (!loaded.value || closed.value) return;
  const key = `${name}:${detail}`;
  if (once && sentOnce.has(key)) return;
  if (once) sentOnce.add(key);
  const event = { name, detail: String(detail).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80), value };
  if (visit.value) send(event);
  else waiting.value = [...waiting.value, event];
}
function firstPress() {
  if (!loaded.value || closed.value || visit.value) return;
  visit.value = randomVisit();
  // the device is measured the same way as analytics.js, the referrer is made up
  const phone = typeof matchMedia === 'function' && matchMedia('(max-width: 700px)').matches;
  send({ name: 'visit', detail: entry.value, device: phone ? 'phone' : 'desktop', referrer: 'github.com' });
  for (const event of waiting.value) send(event);
  waiting.value = [];
}
const actions = [
  { label: 'Open Contact', run: () => { firstPress(); track('open', 'contact', 0, true); } },
  { label: 'Beat Minesweeper', run: () => { firstPress(); track('minesweeper-win'); } },
  { label: 'Read a post', run: () => { firstPress(); track('blog-post', 'How the Analytics Work', 0, true); } },
  { label: '30 s pass', run: () => { if (visit.value) send({ name: 'heartbeat' }); } },
  // pagehide sends a leave, then the page is gone until it's loaded again
  { label: 'Close the tab', run: () => { if (visit.value) send({ name: 'leave' }); closed.value = true; } },
  { label: 'Forge an event', run: () => { if (visit.value) send({ name: 'free-money', detail: '<script>', value: 1e9 }); } },
];
// a window that opens itself (a link to #app=blog) counts before any press, then waits
function autoOpen() {
  entry.value = 'blog';
  track('open', 'blog', 0, true);
}

// ---- summary: rows in, numbers out ----
// a made-up month: 48 visits, each one a list of events, from a seeded random so
// the numbers stay put between reloads
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
const fakeVisits = (() => {
  const rand = seeded(7);
  const referrers = ['', '', '', 'github.com', 'linkedin.com', 'google.com'];
  return Array.from({ length: 48 }, (_, i) => {
    const visitId = `visit${String(i).padStart(3, '0')}`;
    const device = rand() < 0.35 ? 'phone' : 'desktop';
    const events = [{ name: 'visit', detail: '', device, referrer: referrers[Math.floor(rand() * referrers.length)] }];
    if (rand() < 0.55) {
      events.push({ name: 'open', detail: 'contact' });
      if (rand() < 0.7) {
        events.push({ name: 'breakout-start' });
        const won = rand() < 0.4;
        if (won) events.push({ name: 'breakout-win', value: 40 + Math.floor(rand() * 120) });
        if (!won && rand() < 0.5) events.push({ name: 'breakout-mercy' });
        if (won && rand() < 0.3) events.push({ name: 'email-click' });
        if (rand() < 0.5) {
          events.push({ name: 'open', detail: 'mail' });
          if (rand() < 0.4) events.push({ name: 'mail-sent' });
        }
      }
    }
    if (rand() < 0.3) events.push({ name: 'minesweeper-win' });
    return { visit: visitId, events };
  });
})();
const sampled = ref(false);
const summaryDays = ref(30);
// grouped like the events query: one row per name, detail, device and referrer, with
// count = SUM(_sample_interval), total = SUM(_sample_interval * double1)
const summaryRows = computed(() => {
  const interval = sampled.value ? 4 : 1;
  const kept = fakeVisits.filter((_, i) => !sampled.value || i % 4 === 0);
  const groups = new Map();
  for (const v of kept) {
    for (const e of v.events) {
      const row = { name: e.name, detail: e.detail || '', device: e.device || '', referrer: e.referrer || '' };
      const key = JSON.stringify(row);
      if (!groups.has(key)) groups.set(key, { ...row, count: 0, total: 0, maximum: 0 });
      const g = groups.get(key);
      g.count += interval;
      g.total += interval * (e.value || 0);
      g.maximum = Math.max(g.maximum, e.value || 0);
    }
  }
  return { rows: [...groups.values()], kept: kept.length, stored: kept.reduce((n, v) => n + v.events.length, 0), interval };
});
const truth = computed(() => summarize(fakeVisits.flatMap(v => v.events.map(e => ({ name: e.name, detail: e.detail || '', device: e.device || '', referrer: e.referrer || '', count: 1, total: e.value || 0, maximum: e.value || 0 })))));
const summary = computed(() => summarize(summaryRows.value.rows));
const summarySql = computed(() => queries(summaryDays.value).events.replace(/\n\s+/g, '\n  '));
const funnelMax = computed(() => Math.max(1, ...summary.value.funnel.map(f => f.count)));

// ---- pie: the real pixel pie, with a pixel inspector ----
const pieRows = ref([
  { label: 'direct', count: 42 },
  { label: 'github.com', count: 18 },
  { label: 'linkedin.com', count: 11 },
  { label: 'google.com', count: 6 },
  { label: 'x.com', count: 3 },
  { label: 'news.ycombinator.com', count: 2 },
]);
const pieBox = ref(null);
const pixel = ref({ x: 16, y: 6 });
// summarize() sorts the referrers biggest first, so the pie gets them that way too.
// the sliders keep their own order
const pieSorted = computed(() => [...pieRows.value].sort((a, b) => b.count - a.count));
// the same maths as PixelPie.vue, for the pixel being pointed at
const pieSlices = computed(() => {
  const rows = pieSorted.value.filter(row => row.count > 0);
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((sum, row) => sum + row.count, 0);
  if (rest) top.push({ label: 'Other', count: rest });
  const total = top.reduce((sum, row) => sum + row.count, 0);
  let start = 0;
  return top.map((row, i) => {
    const slice = { label: row.label, color: `var(--bar-${rest && i === top.length - 1 ? 6 : i + 1})`, start, end: start + row.count / total };
    start = slice.end;
    return slice;
  });
});
const inspected = computed(() => {
  const { x, y } = pixel.value;
  const dx = x + 0.5 - 12;
  const dy = y + 0.5 - 12;
  const distance = Math.hypot(dx, dy);
  const turn = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1;
  const where = distance > 12 ? 'outside' : distance > 12 - 1.2 || !pieSlices.value.length ? 'ring' : 'slice';
  const slice = where === 'slice' ? (pieSlices.value.find(s => turn < s.end) || pieSlices.value.at(-1)) : null;
  return { x, y, dx, dy, distance, turn, where, slice };
});
// dx and dy with a real minus sign
const signed = n => (n < 0 ? `−${-n}` : `${n}`);
function pointPixel(event) {
  const svg = pieBox.value?.querySelector('svg');
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / rect.width * 24);
  const y = Math.floor((event.clientY - rect.top) / rect.height * 24);
  measurePie();
  if (x >= 0 && y >= 0 && x < 24 && y < 24) pixel.value = { x, y };
}
function pieKeys(event) {
  const [dx, dy] = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[event.key] ?? [];
  if (dx === undefined) return;
  event.preventDefault();
  pixel.value = { x: Math.min(23, Math.max(0, pixel.value.x + dx)), y: Math.min(23, Math.max(0, pixel.value.y + dy)) };
}
// the pie sits beside its legend, so the marker is placed from where the svg really is
const svgBox = ref({ left: 0, top: 0, size: 192 });
function measurePie() {
  const svg = pieBox.value?.querySelector('svg');
  if (!svg) return;
  const outer = pieBox.value.getBoundingClientRect();
  const rect = svg.getBoundingClientRect();
  svgBox.value = { left: rect.left - outer.left, top: rect.top - outer.top, size: rect.width };
}
const markerStyle = computed(() => {
  const cell = svgBox.value.size / 24;
  return { left: `${svgBox.value.left + pixel.value.x * cell}px`, top: `${svgBox.value.top + pixel.value.y * cell}px`, width: `${cell}px`, height: `${cell}px` };
});
let pieObserver;
onBeforeUnmount(() => pieObserver?.disconnect());

// ---- floors: three ways to show a counter that's changing on both ends ----
// a pretend server and network, on a pretend clock that runs while it's on screen
const lag = ref(6);
const dropNext = ref(false);
const speed = ref(2);
const paused = ref(false);
const simTime = ref(0);
const history = ref([]);
const floorLog = ref([]);
let sim;
function resetFloors() {
  const clock = { t: 0 };
  sim = {
    clock,
    server: 40,
    // every win that really happened, including ones still on the way or lost
    happened: 40,
    // the site's way, run by the real module on the pretend clock
    floors: createOptimisticStats(() => clock.t * 1000),
    // the naive way: every response plus your own changes, for the same 90 seconds
    snapshot: null,
    mine: [],
    posts: [],
    polls: [],
    nextPoll: 0,
  };
  sim.snapshot = { minesweeperWins: sim.server };
  sim.floors.accept({ minesweeperWins: sim.server });
  simTime.value = 0;
  history.value = [];
  floorLog.value = [];
  sample();
}
const shown = () => ({
  server: sim.snapshot.minesweeperWins,
  naive: sim.snapshot.minesweeperWins + sim.mine.filter(at => sim.clock.t - at < 90).length,
  floor: sim.floors.value().minesweeperWins,
  truth: sim.happened,
});
const current = ref({ server: 40, naive: 40, floor: 40, truth: 40 });
function sample() {
  current.value = shown();
  history.value = [...history.value, { t: sim.clock.t, ...current.value }].filter(p => p.t >= sim.clock.t - 120);
}
function note(text) {
  floorLog.value = [{ id: `${sim.clock.t}-${floorLog.value.length}`, t: sim.clock.t, text }, ...floorLog.value].slice(0, 5);
}
function poll(reason, wait = 0) {
  // a request leaves after wait seconds, sees the server as it is then and lands
  // half a second later. like live-stats.js it keeps the revision from when it left
  sim.polls.push({ leaves: sim.clock.t + wait, reason });
}
function win() {
  const t = sim.clock.t;
  sim.happened += 1;
  sim.floors.apply({ name: 'minesweeper-win' });
  sim.mine.push(t);
  if (dropNext.value) {
    note('You won. The event was lost on the way.');
    dropNext.value = false;
  } else {
    sim.posts.push({ at: t + lag.value });
    note(`You won. The event reaches the server in ${lag.value} s.`);
  }
  // the site refreshes a second after a local event
  poll('after your win', 1);
  sample();
}
function someoneElse() {
  sim.server += 1;
  sim.happened += 1;
  note('Someone else won. Only the server knows so far.');
  sample();
}
function tick(dt) {
  sim.clock.t += dt;
  simTime.value = sim.clock.t;
  for (const post of sim.posts.filter(p => p.at <= sim.clock.t)) {
    sim.server += 1;
    note('Your event reached the server.');
  }
  sim.posts = sim.posts.filter(p => p.at > sim.clock.t);
  for (const request of sim.polls.filter(p => p.at === undefined && p.leaves <= sim.clock.t)) {
    Object.assign(request, { at: sim.clock.t + 0.5, value: sim.server, revision: sim.floors.revision });
  }
  for (const reply of sim.polls.filter(p => p.at !== undefined && p.at <= sim.clock.t)) {
    sim.snapshot = { minesweeperWins: reply.value };
    const before = sim.floors.value().minesweeperWins;
    const after = sim.floors.accept({ minesweeperWins: reply.value }, reply.revision).minesweeperWins;
    note(`A poll (${reply.reason}) said ${reply.value}. Floors show ${after}${after > reply.value ? ', held up by your win' : before > after ? ', the server won after 90 s' : ''}.`);
  }
  sim.polls = sim.polls.filter(p => p.at === undefined || p.at > sim.clock.t);
  if (sim.clock.t >= sim.nextPoll) {
    poll('every 30 s');
    sim.nextPoll = sim.clock.t + 30;
  }
  sample();
}
let floorTimer;
function runFloors() {
  clearInterval(floorTimer);
  if (props.figure !== 'floors' || !visible.value || paused.value) return;
  floorTimer = setInterval(() => tick(0.25 * speed.value), 250);
}
watch([visible, paused, speed], runFloors);
onBeforeUnmount(() => clearInterval(floorTimer));
// when lines agree they lie on top of each other, so each is thinner than the one
// under it and they all still show
const series = [
  { key: 'server', label: 'Server only', color: 'var(--bar-6)', width: 8 },
  { key: 'naive', label: 'Server + your changes', color: 'var(--bar-2)', width: 5 },
  { key: 'floor', label: 'Floors (the site)', color: 'var(--bar-1)', width: 2.5 },
];
const chart = computed(() => {
  const points = history.value;
  if (!points.length) return { lines: [], ticks: [], min: 0, max: 1, start: 0 };
  const values = points.flatMap(p => series.map(s => p[s.key]).concat(p.truth));
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  // whole numbers only, five at most
  const step = Math.max(1, Math.ceil((max - min) / 4));
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push({ value: v, y: 100 - (v - min) / (max - min) * 100 });
  const start = Math.max(0, simTime.value - 120);
  const x = t => (t - start) / 120 * 300;
  const y = v => 100 - (v - min) / (max - min) * 100;
  const path = key => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p[key]).toFixed(1)}`).join('');
  return { lines: [...series, { key: 'truth', color: 'var(--ink)', width: 1.5, dash: true }].map(s => ({ ...s, d: path(s.key) })), ticks, min, max, start };
});

onMounted(() => {
  if (props.figure === 'floors') resetFloors();
  if (props.figure === 'journey') {
    measureWires();
    if (typeof ResizeObserver === 'function') {
      wireObserver = new ResizeObserver(measureWires);
      wireObserver.observe(mapBox.value);
    }
  }
  if (props.figure === 'pie') {
    measurePie();
    if (typeof ResizeObserver === 'function') {
      pieObserver = new ResizeObserver(measurePie);
      pieObserver.observe(pieBox.value);
    }
  }
});
</script>

<template>
  <figure ref="root" class="pf-figure" :class="`af-fig-${figure}`">
    <figcaption v-if="caption || number">
      <strong v-if="number">Fig. {{ number }}</strong> {{ caption }}
    </figcaption>
    <p class="sr-only">{{ descriptions[figure] }}</p>

    <!-- lead: the whole trip -->
    <div v-if="figure === 'journey'" class="pf-panel">
      <div ref="mapBox" class="af-map" aria-hidden="true">
        <div v-for="(n, id) in nodes" :key="id" class="af-node" :class="[`af-at-${id}`, { on: journeyNow.on.includes(id) }]">
          <!-- paths only break after a slash -->
          <RetroIcon :name="n.icon" /><strong>{{ n.name }}</strong><code><template v-for="(part, i) in n.code.split(/(?<=\/)/)" :key="i">{{ part }}<wbr></template></code>
        </div>
        <svg class="af-wires" :viewBox="`0 0 ${wireBox.width} ${wireBox.height}`">
          <defs>
            <marker id="af-tip" class="af-tip" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L6 3L0 6z" /></marker>
            <marker id="af-tip-on" class="af-tip on" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L6 3L0 6z" /></marker>
          </defs>
          <path v-for="w in wireBox.wires" :key="w.id" :d="w.d" :class="{ on: journeyNow.path === w.id }" :marker-end="journeyNow.path === w.id ? 'url(#af-tip-on)' : 'url(#af-tip)'" />
        </svg>
        <span class="af-lane-label top">writing</span>
        <span class="af-lane-label bottom">reading</span>
      </div>
      <div class="pf-detail" :aria-live="journeyPlaying ? 'off' : 'polite'">
        <strong><b>{{ journeyStep + 1 }}/{{ journey.length }}</b> {{ journeyNow.title }}</strong>
        <p>{{ journeyNow.text }}</p>
      </div>
      <div class="pf-buttons">
        <button class="raised pf-button" :disabled="journeyStep === 0" @click="journeyGo(journeyStep - 1)">Back</button>
        <button class="raised pf-button" :disabled="journeyStep === journey.length - 1" @click="journeyGo(journeyStep + 1)">Next</button>
        <button class="raised pf-button" :disabled="journeyStep === 0" @click="journeyGo(0)">Reset</button>
      </div>
    </div>

    <!-- event: a pretend visit -->
    <div v-else-if="figure === 'event'" class="pf-panel">
      <div class="pf-buttons af-actions">
        <button class="raised pf-button" @click="pageLoad">{{ loaded ? 'Reload the page' : 'Load the page' }}</button>
        <button class="raised pf-button" :disabled="!loaded || closed || visit !== null || entry !== ''" @click="autoOpen">A link opens Blog</button>
        <button v-for="a in actions" :key="a.label" class="raised pf-button" :disabled="!loaded || closed" @click="a.run">{{ a.label }}</button>
      </div>
      <dl class="pf-dl af-state">
        <dt>Visit id</dt><dd><code v-if="visit">{{ visit }}</code><template v-else>{{ loaded ? 'none yet, nobody has pressed anything' : 'no page loaded' }}</template></dd>
        <dt>Waiting</dt><dd>{{ waiting.length ? waiting.map(e => `${e.name} ${e.detail}`.trim()).join(', ') : 'nothing' }}</dd>
      </dl>
      <p v-if="closed" class="pf-note">The tab is closed. Reload the page for a new visit.</p>
      <ol class="af-log" aria-live="polite" aria-label="Events sent, newest first">
        <li v-if="!eventLog.length" class="empty">{{ loaded ? 'Nothing sent yet. Press any button to make the first interaction.' : 'Load the page to start.' }}</li>
        <li v-for="e in eventLog" :key="e.id">
          <pre class="pf-code"><b>POST /api/event</b> {{ spaced(e.body) }}</pre>
          <p v-if="!e.point" class="pf-bad">400 Invalid event. Nothing is stored or counted.</p>
          <template v-else>
            <p><span class="pf-good">204.</span> The Durable Object {{ e.object }}{{ e.live ? ', then Analytics Engine stores:' : '. Nothing goes to Analytics Engine.' }}</p>
            <dl v-if="e.live" class="af-point">
              <dt>indexes</dt><dd><code>{{ spaced(e.point.indexes) }}</code></dd>
              <dt>blobs</dt><dd><code>{{ spaced(e.point.blobs) }}</code></dd>
              <dt>doubles</dt><dd><code>{{ spaced(e.point.doubles) }}</code></dd>
            </dl>
          </template>
        </li>
      </ol>
    </div>

    <!-- summary: rows to numbers -->
    <div v-else-if="figure === 'summary'" class="pf-panel">
      <div class="pf-controls">
        <div class="pf-control">
          <span id="af-period">Period</span>
          <span class="pf-toggle" role="group" aria-labelledby="af-period">
            <button v-for="d in periods" :key="d" class="raised pf-button" :class="{ pressed: summaryDays === d }" :aria-pressed="summaryDays === d" @click="summaryDays = d">{{ d }} days</button>
          </span>
        </div>
        <div class="pf-control">
          <span id="af-sampling">Stored</span>
          <span class="pf-toggle" role="group" aria-labelledby="af-sampling">
            <button class="raised pf-button" :class="{ pressed: !sampled }" :aria-pressed="!sampled" @click="sampled = false">Every visit</button>
            <button class="raised pf-button" :class="{ pressed: sampled }" :aria-pressed="sampled" @click="sampled = true">1 visit in 4</button>
          </span>
        </div>
      </div>
      <pre class="pf-code af-sql">{{ summarySql }}</pre>
      <p class="pf-note">{{ summaryRows.stored }} events from {{ summaryRows.kept }} visits stored{{ sampled ? `, each with _sample_interval = ${summaryRows.interval}` : '' }}, grouped into {{ summaryRows.rows.length }} rows:</p>
      <div class="pf-scroll af-rows">
        <table class="pf-table">
          <thead><tr><th>name</th><th>detail</th><th>device</th><th>referrer</th><th>count</th><th>total</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in summaryRows.rows.slice(0, 8)" :key="i"><td>{{ r.name }}</td><td>{{ r.detail }}</td><td>{{ r.device }}</td><td>{{ r.referrer }}</td><td class="af-num">{{ r.count }}</td><td class="af-num">{{ r.total }}</td></tr>
            <tr v-if="summaryRows.rows.length > 8" class="empty"><td colspan="6">…and {{ summaryRows.rows.length - 8 }} more</td></tr>
          </tbody>
        </table>
      </div>
      <div class="pf-pair af-out">
        <div>
          <h4>summarize() → Breakout funnel</h4>
          <ul class="pf-bars" style="--bar: var(--bar-7)">
            <li v-for="(f, i) in summary.funnel" :key="f.label">
              <span :title="f.label">{{ f.label }}</span>
              <span><i :style="{ width: `${f.count / funnelMax * 100}%` }" /></span>
              <b>{{ f.count }}<small v-if="sampled" class="af-true"> / {{ truth.funnel[i].count }}</small></b>
            </li>
          </ul>
        </div>
        <div>
          <h4>…and the cards</h4>
          <dl class="pf-dl">
            <dt>Visitors</dt><dd>{{ summary.visitors }}<span v-if="sampled" class="af-true"> (really {{ truth.visitors }})</span></dd>
            <dt>Minesweeper beaten</dt><dd>{{ summary.minesweeperWins }}<span v-if="sampled" class="af-true"> (really {{ truth.minesweeperWins }})</span></dd>
            <dt>Avg Breakout win</dt><dd>{{ summary.breakout.averageWinSeconds === null ? 'no wins kept' : `${summary.breakout.averageWinSeconds} s` }}<span v-if="sampled" class="af-true"> (really {{ truth.breakout.averageWinSeconds }} s)</span></dd>
            <dt>Devices</dt><dd>{{ summary.devices.map(d => `${d.label} ${d.count}`).join(', ') }}<span v-if="sampled" class="af-true"> (really {{ truth.devices.map(d => `${d.label} ${d.count}`).join(', ') }})</span></dd>
          </dl>
        </div>
      </div>
      <p v-if="sampled" class="pf-note">Sampled counts are estimates: each kept row stands in for {{ summaryRows.interval }}. The grey numbers are the real totals.</p>
    </div>

    <!-- pie: the real pixel pie -->
    <div v-else-if="figure === 'pie'" class="pf-panel">
      <div class="af-pie-layout">
        <div ref="pieBox" class="af-pie" tabindex="0" aria-label="Point at a pixel, or use the arrow keys" @pointermove="pointPixel" @pointerdown="pointPixel" @keydown="pieKeys">
          <PixelPie :rows="pieSorted" label="Referrers" />
          <i class="af-marker" :style="markerStyle" aria-hidden="true" />
        </div>
        <div class="af-sliders">
          <div v-for="row in pieRows" :key="row.label" class="pf-control af-slider">
            <label :for="`af-pie-${row.label}`">{{ row.label }} <b>{{ row.count }}</b></label>
            <input :id="`af-pie-${row.label}`" v-model.number="row.count" class="pf-range" type="range" min="0" max="60">
          </div>
        </div>
      </div>
      <div class="pf-detail" aria-live="polite">
        <strong>Pixel {{ inspected.x }}, {{ inspected.y }}</strong>
        <dl class="pf-dl">
          <dt>From the middle</dt><dd>dx {{ signed(inspected.dx) }}, dy {{ signed(inspected.dy) }}, distance {{ inspected.distance.toFixed(2) }} of 12</dd>
          <template v-if="inspected.where === 'slice'">
            <dt>Angle</dt><dd><code>atan2(dx, −dy) / 2π</code> = {{ (inspected.turn * 100).toFixed(1) }}% of the way round from the top</dd>
            <dt>Slice</dt><dd><i class="af-swatch" :style="{ background: inspected.slice.color }" />{{ inspected.slice.label }}, which runs from {{ (inspected.slice.start * 100).toFixed(1) }}% to {{ (inspected.slice.end * 100).toFixed(1) }}%</dd>
          </template>
          <template v-else>
            <dt>Result</dt><dd>{{ inspected.where === 'ring' ? 'Within 1.2 pixels of the edge, so it’s part of the outline ring' : 'Further than 12 from the middle, so it’s left empty' }}</dd>
          </template>
        </dl>
      </div>
    </div>

    <!-- floors: never backwards -->
    <div v-else-if="figure === 'floors'" class="pf-panel">
      <div class="af-counters">
        <div v-for="s in series" :key="s.key" class="af-counter" :style="{ '--bar': s.color }">
          <span>{{ s.label }}</span>
          <strong>{{ current[s.key] }}</strong>
          <small :class="current[s.key] === current.truth ? 'pf-good' : current[s.key] > current.truth ? 'pf-bad' : ''">
            {{ current[s.key] === current.truth ? 'right' : current[s.key] > current.truth ? `${current[s.key] - current.truth} too many` : `${current.truth - current[s.key]} behind` }}
          </small>
        </div>
      </div>
      <div class="af-plot">
        <!-- the scale is html so the numbers don't stretch with the chart -->
        <div class="af-axis" aria-hidden="true">
          <span v-for="t in chart.ticks" :key="t.value" :style="{ top: `${(t.y + 4) / 108 * 100}%` }">{{ t.value }}</span>
        </div>
        <svg class="af-chart" viewBox="0 -4 300 108" preserveAspectRatio="none" role="img" :aria-label="`Minesweeper wins over the last two pretend minutes. Server only ${current.server}, server plus your changes ${current.naive}, floors ${current.floor}, really ${current.truth}.`">
          <path v-for="t in chart.ticks" :key="t.value" class="af-grid" :d="`M0 ${t.y.toFixed(1)}H300`" vector-effect="non-scaling-stroke" />
          <path v-for="l in chart.lines" :key="l.key" :d="l.d" :style="{ stroke: l.color, strokeWidth: l.width }" :stroke-dasharray="l.dash ? '4 3' : null" vector-effect="non-scaling-stroke" />
        </svg>
        <div class="af-time" aria-hidden="true"><span>{{ Math.round(chart.start) }} s</span><span>{{ Math.round(chart.start) + 120 }} s</span></div>
      </div>
      <p class="pf-note af-chart-key">
        <span v-for="s in series" :key="s.key"><i :style="{ background: s.color }" />{{ s.label }}</span>
        <span><i class="truth" />What’s really true</span>
        <span class="af-clock">Clock {{ simTime.toFixed(0) }} s</span>
      </p>
      <div class="pf-buttons">
        <button class="raised pf-button" @click="win">Win Minesweeper</button>
        <button class="raised pf-button" @click="someoneElse">Someone else wins</button>
        <button class="raised pf-button" :class="{ pressed: dropNext }" :aria-pressed="dropNext" @click="dropNext = !dropNext">Lose the next event</button>
        <button class="raised pf-button" :class="{ pressed: paused }" :aria-pressed="paused" @click="paused = !paused">{{ paused ? 'Paused' : 'Pause' }}</button>
        <button class="raised pf-button" @click="resetFloors">Reset</button>
      </div>
      <div class="pf-controls af-floor-controls">
        <div class="pf-control">
          <label for="af-lag">Event takes <b>{{ lag }} s</b> to reach the server</label>
          <input id="af-lag" v-model.number="lag" class="pf-range" type="range" min="0" max="40">
        </div>
        <div class="pf-control">
          <span id="af-speed">Clock</span>
          <span class="pf-toggle" role="group" aria-labelledby="af-speed">
            <button v-for="s in [1, 2, 5]" :key="s" class="raised pf-button" :class="{ pressed: speed === s }" :aria-pressed="speed === s" @click="speed = s">×{{ s }}</button>
          </span>
        </div>
      </div>
      <ol class="af-floor-log" aria-live="polite">
        <li v-for="l in floorLog" :key="l.id"><code>{{ l.t.toFixed(1) }} s</code> {{ l.text }}</li>
      </ol>
    </div>
  </figure>
</template>

<style scoped>
/* journey: writing along the top, reading along the bottom */
.af-map { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: auto auto; gap: 44px 18%; padding: 14px 0; }
.af-node { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 4px; font-size: 12px; text-align: center; color: var(--ink); background: var(--d-page-alt, #fffdf2); border: 2px solid var(--d-line, #000); }
.af-node svg { width: 26px; height: 26px; }
.af-node strong { line-height: 1.2; }
.af-node code { overflow-wrap: normal; line-height: 1.25; }
.af-node.on { background: var(--navy, #000080); color: #fff; border-color: var(--navy, #000080); }
.af-node.on code { color: #dfe3ff; }
.af-at-browser { grid-area: 1 / 1; }
.af-at-worker { grid-area: 1 / 2; }
.af-at-engine { grid-area: 1 / 3; }
.af-at-window { grid-area: 2 / 1; }
.af-at-api { grid-area: 2 / 2; }
.af-at-object { grid-area: 2 / 3; }
.af-wires { position: absolute; inset: 0; width: 100%; height: 100%; }
.af-wires { overflow: visible; }
.af-wires > path { fill: none; stroke: var(--muted); stroke-width: 2; stroke-dasharray: 4 4; opacity: .55; }
.af-wires > path.on { stroke: var(--bar-3); opacity: 1; stroke-width: 3; animation: af-flow .6s linear infinite; }
.af-tip path { fill: var(--muted); opacity: .55; }
.af-tip.on path { fill: var(--bar-3); opacity: 1; }
@keyframes af-flow { to { stroke-dashoffset: -8; } }
.af-lane-label { position: absolute; left: 0; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
.af-lane-label.top { top: 0; }
.af-lane-label.bottom { bottom: 0; }
@container (max-width: 460px) {
  .af-map { gap: 34px 22px; }
  .af-node { padding: 6px 2px; font-size: 11px; }
  .af-node code { font-size: 10px; }
}

/* event: the log of sends */
.af-actions { margin: 0 0 10px; }
.af-state { margin-bottom: 10px; font-size: 12px; }
.af-log { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.af-log li { padding-bottom: 8px; border-bottom: 1px dotted var(--d-line, #999); }
.af-log li.empty { color: var(--muted); font: 13px Tahoma, sans-serif; border: 0; }
.af-log p { margin: 4px 0 0; font: 12px/1.5 Tahoma, sans-serif; overflow-wrap: anywhere; }
.af-log .pf-code { font-size: 11px; }
.af-log .pf-code b { color: var(--muted); font-weight: normal; }
.af-point { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1px 8px; margin: 4px 0 0 12px; font: 11px/1.5 'Courier New', monospace; }
.af-point dt { color: var(--muted); }
.af-point dd { margin: 0; overflow-wrap: anywhere; }

/* summary */
.af-sql { margin-bottom: 8px; font-size: 11px; }
.af-rows { margin: 6px 0 12px; }
.af-out { margin-top: 4px; }
.af-out .pf-bars li { grid-template-columns: minmax(0, 11em) minmax(0, 1fr) 4.5em; }
/* the funnel's longer steps wrap instead of being cut off */
.af-out .pf-bars li > span:first-child { white-space: normal; line-height: 1.25; }
.af-num { text-align: right !important; }
.af-true { color: var(--muted); font-weight: normal; }

/* pie: a bigger pie with a marker on the pixel being looked at */
.af-pie-layout { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
.af-pie { position: relative; outline-offset: 2px; touch-action: none; }
.af-pie:focus-visible { outline: 1px dotted var(--ink); }
.af-swatch { display: inline-block; width: 10px; height: 10px; margin-right: 5px; vertical-align: -1px; border: 1px solid var(--ink); }
.af-pie :deep(.pixel-pie) { margin: 0; }
.af-pie :deep(.pixel-pie svg) { width: 192px; height: 192px; cursor: crosshair; }
.af-marker { position: absolute; outline: 2px solid var(--ink); pointer-events: none; }
.af-sliders { display: grid; gap: 6px; flex: 1; min-width: 180px; }
.af-slider label { font-size: 12px; }

/* floors */
.af-counters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.af-counter { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; text-align: center; background: var(--d-page-alt, #fffdf2); border: 2px solid var(--d-line, #000); box-shadow: inset 0 -4px var(--bar); font-size: 11px; }
.af-counter strong { font: bold 28px/1.1 'Pixel MS Sans Serif', monospace; color: var(--ink); }
.af-counter small { min-height: 1.2em; font-size: 11px; }
.af-plot { position: relative; margin-top: 10px; padding-left: 26px; }
.af-axis { position: absolute; left: 0; top: 0; width: 22px; height: 120px; font: 10px 'Courier New', monospace; color: var(--muted); text-align: right; }
.af-axis span { position: absolute; right: 0; transform: translateY(-50%); }
.af-chart { display: block; width: 100%; height: 120px; background: var(--paper); border: 1px solid var(--d-rule, #ccc); box-sizing: border-box; }
.af-chart path { fill: none; stroke-width: 2; stroke-linejoin: round; }
.af-chart path.af-grid { stroke: var(--d-rule, #ccc); stroke-width: 1; }
.af-time { display: flex; justify-content: space-between; margin-top: 2px; font: 10px 'Courier New', monospace; color: var(--muted); }
.af-clock { margin-left: auto; font-family: 'Courier New', monospace; color: var(--ink); }
.af-chart-key { display: flex; flex-wrap: wrap; gap: 4px 12px; }
.af-chart-key span { display: inline-flex; align-items: center; gap: 4px; }
.af-chart-key i { width: 12px; height: 4px; }
.af-chart-key i.truth { height: 0; border-top: 2px dashed var(--ink); }
.af-floor-controls { margin: 10px 0 0; }
.af-floor-log { margin: 10px 0 0; padding: 0; list-style: none; font: 12px/1.5 Tahoma, sans-serif; min-height: 5em; }
.af-floor-log code { margin-right: 6px; }
@container (max-width: 420px) { .af-counter strong { font-size: 22px; } }

@media (prefers-reduced-motion: reduce) { .af-wires path.on { animation: none; } }
</style>
