<script setup>
// the figures in the durable object post (blog.mjs), swapped in by blog-figures.mjs:
// two wins at once with and without one coordinator, the four sqlite tables taking
// requests, who counts as online, the rolling leaderboards, and the trade-off. the
// tables are a small copy of worker/live-stats.mjs run in the page (there's no sqlite
// here), with the same statements, rules and limits
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import RetroIcon from './RetroIcon.vue';
import BlogGraphic from './BlogGraphic.vue';
import { cleanName } from '../names.mjs';
import '../post-figures.css';

const props = defineProps({
  figure: { type: String, required: true },
  caption: { type: String, default: '' },
  number: { type: Number, default: 0 },
});

const descriptions = {
  race: 'Two visitors win at the same moment. With two separate functions that each read the count and write it back, one win is lost. With one Durable Object the requests go through one at a time and both count.',
  tables: 'The four SQLite tables inside the Durable Object. Buttons send visits, heartbeats, wins and Snake scores, and show the SQL each one runs and the rows it changes.',
  online: 'Four visitors on a timeline with their heartbeats and leaves. A clock slider shows who counts as online at each moment: anyone heard from in the last 90 seconds.',
  boards: 'Snake scores spread over a year, with a slider for today. The 7, 30, 90 and 365 day boards and the all-time board update as the windows slide past old scores.',
  choice: 'A comparison of Supabase and a single Durable Object for this site: a database first with the rules spread over separate systems, or a coordinator first with every rule in one place, at the cost of one location, no SQL console and being tied to Cloudflare.',
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

// ---- race: two wins at the same moment ----
// each step says who's acting (act), what each visitor sees (va, vb) and what the
// code handling each request is doing (ha, hb). a visitor's text stays until a
// later step changes it
const raceModes = {
  functions: {
    label: 'Two functions',
    middle: 'Two separate functions',
    store: 'in a shared database',
    steps: [
      { act: 'ab', count: 40, text: 'Two visitors beat Minesweeper at the same moment. Each request lands on its own copy of a function that reads the count, adds one and writes it back.' },
      { act: 'a', ha: 'reads 40', count: 40, text: 'A’s function reads the count: 40.' },
      { act: 'b', ha: 'has 40', hb: 'reads 40', count: 40, text: 'B’s function reads the count before A has written anything back. Also 40.' },
      { act: 'a', ha: 'writes 41', hb: 'has 40', count: 41, text: 'A adds one and writes 41.' },
      { act: 'b', ha: 'done', hb: 'writes 41', count: 41, bad: true, text: 'B adds one to the 40 it read and also writes 41. Two wins, one counted. This is a lost update.' },
    ],
  },
  object: {
    label: 'One Durable Object',
    middle: 'One Durable Object',
    store: 'in the object’s SQLite',
    steps: [
      { act: 'ab', ha: 'in line', hb: 'in line', count: 40, text: 'The same two wins. Both requests go to the one object named site, wherever they came from.' },
      { act: 'a', ha: 'running', hb: 'waiting', count: 40, text: 'The object handles one request at a time. B waits in line while A runs.' },
      { act: 'a', ha: 'value+1', hb: 'waiting', va: 'gets 41', count: 41, text: 'A’s upsert adds one: 41. Its response is read from the same tables straight after, so it can’t disagree with them.' },
      { act: 'b', ha: 'done', hb: 'value+1', va: 'gets 41', vb: 'gets 42', count: 42, text: 'Then B’s runs on the new value: 42.' },
      { act: '', ha: 'done', hb: 'done', va: 'gets 41', vb: 'gets 42', count: 42, good: true, text: 'Both counted. Clearing old sessions, saving scores and trimming the leaderboard all run in the same line, so none of them can trip over each other either.' },
    ],
  },
};
const raceMode = ref('functions');
const raceStep = ref(0);
const race = computed(() => raceModes[raceMode.value].steps[raceStep.value]);
const raceTotal = computed(() => raceModes[raceMode.value].steps.length);
const raceSees = computed(() => Object.fromEntries(['a', 'b'].map(v => [v,
  raceModes[raceMode.value].steps.slice(0, raceStep.value + 1).map(s => s[`v${v}`]).filter(Boolean).at(-1) ?? 'win'])));
// plays both versions in turn while it's on screen, until someone takes over
const racePlaying = ref(!reduced);
let raceTimer;
function raceTick() {
  if (raceStep.value < raceTotal.value - 1) raceStep.value++;
  else {
    raceMode.value = raceMode.value === 'functions' ? 'object' : 'functions';
    raceStep.value = 0;
  }
}
watch([visible, racePlaying], ([on, playing]) => {
  clearInterval(raceTimer);
  if (on && playing && props.figure === 'race') raceTimer = setInterval(raceTick, 2600);
});
onBeforeUnmount(() => clearInterval(raceTimer));
function raceGo(step, mode = raceMode.value) {
  racePlaying.value = false;
  raceMode.value = mode;
  raceStep.value = step;
}

// ---- tables: a copy of LiveStats, one request at a time ----
const day = 86400000;
const dayOf = time => new Date(time).toISOString().slice(0, 10);
const start = Date.UTC(2026, 8, 28, 12, 0, 0);
const visitors = [
  { id: 'k3v9x2m0qa', label: 'Visitor A', player: 'q7w2e9r4t1y6' },
  { id: 'p8d1z5c7fh', label: 'Visitor B', player: 'm4n8b2v6c1x3' },
  { id: 'r2t6y0u4ib', label: 'Visitor C', player: 'z9x7c5v3b1n2' },
];
const who = ref(0);
const snakeName = ref('ACE');
const snakeScore = ref(24);
const db = ref(null);
const lastRun = ref(null);
function freshDb() {
  return {
    now: start,
    totals: [{ name: 'visitors', value: 1204 }, { name: 'minesweeperWins', value: 40 }],
    sessions: [{ id: 'j5k1l9h3g7', seen: start - 20000 }],
    scores: [{ id: 'a1s2d3f4g5h6', score: 31, name: 'JT' }],
    daily_scores: [{ id: 'a1s2d3f4g5h6', day: dayOf(start - 3 * day), score: 31, name: 'JT' }],
  };
}
function resetTables() {
  db.value = freshDb();
  lastRun.value = null;
}
const counters = { 'minesweeper-win': 'minesweeperWins', 'breakout-complete': 'breakoutWins', 'reversi-lose': 'clippyWins', 'reversi-win': 'clippyLosses', '2048-win': 'twenty48Wins' };
// runs one request against the tables, like LiveStats.fetch. returns what ran, and
// marks the rows it touched
function request(body) {
  // plain json in and out, the tables are small and vue's proxies can't be cloned
  const d = JSON.parse(JSON.stringify(db.value));
  const ran = [];
  const touched = { totals: new Set(), sessions: new Set(), scores: new Set(), daily_scores: new Set() };
  const gone = { sessions: [], scores: [], daily_scores: [] };
  const bump = name => {
    const row = d.totals.find(r => r.name === name);
    if (row) row.value++;
    else d.totals.push({ name, value: 1 });
    touched.totals.add(name);
  };
  const { name, visit, value, player, playerId } = body ?? {};
  if (body) {
    if (name === 'visit') {
      ran.push(`INSERT INTO totals VALUES ('visitors', 1) ON CONFLICT(name) DO UPDATE SET value=value+1`);
      bump('visitors');
    }
    if (name === 'visit' || name === 'heartbeat') {
      ran.push(`INSERT INTO sessions VALUES ('${visit}', ${d.now}) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen`);
      const row = d.sessions.find(r => r.id === visit);
      if (row) row.seen = d.now;
      else d.sessions.push({ id: visit, seen: d.now });
      touched.sessions.add(visit);
    }
    if (name === 'leave') {
      ran.push(`DELETE FROM sessions WHERE id='${visit}'`);
      gone.sessions.push(...d.sessions.filter(r => r.id === visit));
      d.sessions = d.sessions.filter(r => r.id !== visit);
    }
    if (counters[name]) {
      ran.push(`INSERT INTO totals VALUES ('${counters[name]}', 1) ON CONFLICT(name) DO UPDATE SET value=value+1`);
      bump(counters[name]);
    }
    if (name === 'snake-score' && Number.isInteger(value) && value > 0 && value <= 1000) {
      const id = playerId;
      const playerName = cleanName(player) || null;
      const keep = (table, match, row) => {
        const found = d[table].find(match);
        if (found) Object.assign(found, { score: Math.max(found.score, row.score), name: row.name });
        else d[table].push(row);
        touched[table].add(JSON.stringify([row.id, row.day ?? '']));
      };
      ran.push(`INSERT INTO scores (id, score, name) VALUES ('${id}', ${value}, ${playerName ? `'${playerName}'` : 'NULL'}) ON CONFLICT(id) DO UPDATE SET score=MAX(score, excluded.score), name=excluded.name`);
      keep('scores', r => r.id === id, { id, score: value, name: playerName });
      const today = dayOf(d.now);
      ran.push(`INSERT INTO daily_scores (id, day, score, name) VALUES ('${id}', '${today}', ${value}, ${playerName ? `'${playerName}'` : 'NULL'}) ON CONFLICT(id, day) DO UPDATE SET score=MAX(score, excluded.score), name=excluded.name`);
      keep('daily_scores', r => r.id === id && r.day === today, { id, day: today, score: value, name: playerName });
      const cutoff = dayOf(d.now - 366 * day);
      ran.push(`DELETE FROM daily_scores WHERE day < '${cutoff}'`);
      gone.daily_scores.push(...d.daily_scores.filter(r => r.day < cutoff));
      d.daily_scores = d.daily_scores.filter(r => r.day >= cutoff);
      ran.push(`DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY score DESC, id LIMIT 100)`);
    } else if (name === 'snake-score') {
      ran.push('-- a score outside 1 to 1000 is ignored');
    }
  }
  // every request, reads too, sweeps out anyone not heard from in 90 seconds
  const cutoff = d.now - 90000;
  ran.push(`DELETE FROM sessions WHERE seen < ${cutoff}  -- 90 s before now`);
  ran.push('-- then 7 SELECTs build the response: totals, the top 10, four day windows, COUNT(*) sessions');
  gone.sessions.push(...d.sessions.filter(r => r.seen < cutoff));
  d.sessions = d.sessions.filter(r => r.seen >= cutoff);
  const totals = Object.fromEntries(d.totals.map(r => [r.name, r.value]));
  const best = [...d.scores].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 10);
  const response = {
    visitors: totals.visitors ?? 0,
    minesweeperWins: totals.minesweeperWins ?? 0,
    online: d.sessions.length,
    leaderboard: best.map((r, i) => ({ rank: i + 1, player: cleanName(r.name) || `Player ${r.id.slice(0, 6).toUpperCase()}`, score: r.score })),
  };
  db.value = d;
  lastRun.value = { body, ran, touched, gone, response };
}
const me = computed(() => visitors[who.value]);
const tableActions = [
  { label: 'Visit', run: () => request({ name: 'visit', visit: me.value.id }) },
  { label: 'Heartbeat', run: () => request({ name: 'heartbeat', visit: me.value.id }) },
  { label: 'Leave', run: () => request({ name: 'leave', visit: me.value.id }) },
  { label: 'Beat Minesweeper', run: () => request({ name: 'minesweeper-win', visit: me.value.id }) },
  { label: 'GET /api/stats', run: () => request(null) },
];
function sendScore() {
  request({ name: 'snake-score', visit: me.value.id, value: snakeScore.value, player: snakeName.value, playerId: me.value.player });
}
function wait(seconds) {
  db.value = { ...db.value, now: db.value.now + seconds * 1000 };
  lastRun.value = { ran: [`-- ${seconds} seconds pass. nothing runs until the next request`], touched: {}, gone: {}, response: null, waited: true };
}
const nameError = computed(() => (snakeName.value && !cleanName(snakeName.value) ? 'Not allowed, it’ll be saved without a name' : ''));
const clock = computed(() => db.value && new Date(db.value.now).toISOString().slice(11, 19));
const isNew = (table, key) => lastRun.value?.touched?.[table]?.has(key);
const goneRows = table => lastRun.value?.gone?.[table] ?? [];
// a short line for screen readers, rather than reading every statement out
const tableStatus = computed(() => {
  const run = lastRun.value;
  if (!run) return '';
  if (run.waited) return `Clock is now ${clock.value} UTC. Nothing ran.`;
  const statements = run.ran.filter(line => !line.startsWith('--')).length;
  const r = run.response;
  return `${statements} statements ran. Response: ${r.visitors} visitors, ${r.minesweeperWins} Minesweeper wins, ${r.online} online.`;
});

// ---- online: who counts, on a clock ----
// each visitor's events, in seconds. a heartbeat goes every 30 s while the tab is
// showing, hiding it sends a leave, and a dropped connection just goes quiet
const lanes = [
  { label: 'At a desk', events: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300].map(t => ({ t, kind: t ? 'heartbeat' : 'visit' })) },
  { label: 'Closes the tab', events: [{ t: 40, kind: 'visit' }, { t: 70, kind: 'heartbeat' }, { t: 100, kind: 'heartbeat' }, { t: 130, kind: 'heartbeat' }, { t: 150, kind: 'leave' }] },
  { label: 'Locks the phone', events: [{ t: 20, kind: 'visit' }, { t: 50, kind: 'heartbeat' }, { t: 80, kind: 'heartbeat' }, { t: 100, kind: 'leave' }, { t: 200, kind: 'heartbeat' }, { t: 230, kind: 'heartbeat' }, { t: 260, kind: 'heartbeat' }, { t: 290, kind: 'heartbeat' }] },
  { label: 'Loses signal', events: [{ t: 10, kind: 'visit' }, { t: 40, kind: 'heartbeat' }, { t: 70, kind: 'heartbeat' }, { t: 100, kind: 'heartbeat' }, { t: 130, kind: 'heartbeat' }] },
];
const onlineAt = ref(170);
const laneState = computed(() => lanes.map(lane => {
  const last = lane.events.filter(e => e.t <= onlineAt.value).at(-1);
  if (!last) return { ...lane, state: 'not here yet', on: false };
  if (last.kind === 'leave') return { ...lane, state: `left at ${last.t} s, row deleted`, on: false };
  const age = onlineAt.value - last.t;
  if (age > 90) return { ...lane, state: `quiet since ${last.t} s, swept out`, on: false };
  return { ...lane, state: `heard ${age} s ago`, on: true };
}));
const onlineCount = computed(() => laneState.value.filter(l => l.on).length);
const onlineTicks = [0, 60, 120, 180, 240, 300];
const pct = t => `${t / 300 * 100}%`;
// play runs the clock at 30 seconds a second, driven by frames so it stays smooth
let onlineFrame;
const onlinePlaying = ref(false);
function stopOnline() {
  onlinePlaying.value = false;
  cancelAnimationFrame(onlineFrame);
}
function playOnline() {
  if (onlinePlaying.value) return stopOnline();
  onlinePlaying.value = true;
  let at = onlineAt.value >= 300 ? 0 : onlineAt.value;
  let last = performance.now();
  const frame = now => {
    at = Math.min(300, at + (now - last) * 0.03);
    last = now;
    onlineAt.value = Math.round(at);
    if (at >= 300) stopOnline();
    else onlineFrame = requestAnimationFrame(frame);
  };
  onlineFrame = requestAnimationFrame(frame);
}
watch(visible, on => { if (!on) stopOnline(); });
onBeforeUnmount(() => cancelAnimationFrame(onlineFrame));

// ---- boards: windows sliding over a year of scores ----
// day 0 is the first day on the chart. each entry is a player's best that day
const scoreDays = [
  { id: 'ace', name: 'ACE', day: 4, score: 88 },
  { id: 'bob', name: 'BOB', day: 60, score: 61 },
  { id: 'ace', name: 'ACE', day: 120, score: 47 },
  { id: 'cat', name: 'CAT', day: 210, score: 55 },
  { id: 'dee', name: 'DEE', day: 300, score: 39 },
  { id: 'bob', name: 'BOB', day: 330, score: 44 },
  { id: 'eve', name: 'EVE', day: 372, score: 36 },
  { id: 'cat', name: 'CAT', day: 390, score: 29 },
  { id: 'fox', name: 'FOX', day: 395, score: 33 },
  { id: 'dee', name: 'DEE', day: 398, score: 21 },
];
const today = ref(400);
const span = 420;
const boardDays = [
  { key: 7, label: '7 days', color: 'var(--bar-1)' },
  { key: 30, label: '30 days', color: 'var(--bar-3)' },
  { key: 90, label: '90 days', color: 'var(--bar-5)' },
  { key: 365, label: '1 year', color: 'var(--bar-7)' },
];
// the same rule as since() in live-stats.mjs: day > today - n, then each player's best
const since = n => {
  const best = new Map();
  for (const s of scoreDays) {
    if (s.day > today.value || s.day <= today.value - n) continue;
    if (!best.has(s.id) || best.get(s.id).score < s.score) best.set(s.id, s);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 10);
};
const boards = computed(() => [
  ...boardDays.map(b => ({ ...b, rows: since(b.key) })),
  // all time is the scores table, a player's best ever, kept for the top 100
  { key: 'all', label: 'All time', color: 'var(--bar-6)', rows: since(Infinity) },
]);
const pruned = computed(() => scoreDays.filter(s => s.day <= today.value && s.day < today.value - 366));
// the chart is drawn in real pixels, so its text stays the same size at any width
const chartBox = ref(null);
const chartW = ref(600);
let chartObserver;
onMounted(() => {
  if (props.figure !== 'boards' || typeof ResizeObserver !== 'function' || !chartBox.value) return;
  chartObserver = new ResizeObserver(([entry]) => { chartW.value = Math.max(240, Math.round(entry.contentRect.width)); });
  chartObserver.observe(chartBox.value);
});
onBeforeUnmount(() => chartObserver?.disconnect());
const chart = { label: 58, top: 22, plot: 58, rows: 5, row: 15, axis: 22 };
chart.windows = chart.top + chart.plot + 10;
chart.h = chart.windows + chart.rows * chart.row + chart.axis;
const bx = d => chart.label + d / span * (chartW.value - chart.label - 12);
const by = score => chart.top + chart.plot - score / 100 * chart.plot;
const dayTicks = [0, 100, 200, 300, 400];
const dotState = s => (s.day > today.value ? 'future' : s.day < today.value - 366 ? 'pruned' : '');

// ---- choice: the trade-off ----
const choice = {
  template: 'comparison', title: 'Supabase or one Durable Object', items: [
    { label: 'Supabase', text: 'A hosted Postgres database with realtime bolted on. Validation would live in a separate function, and fan-out in Realtime watching the table, so a rule like “delete stale sessions, then count” spans two systems.', note: 'Database first · SQL dashboard · portable Postgres' },
    { label: 'One Durable Object', text: 'A single-threaded coordinator with SQLite attached. Every rule runs in one place, in order, next to the data, on the same domain as the site. Idle, it costs next to nothing.', note: 'Coordinator first · one location · no SQL console · Cloudflare only' },
  ],
};
// the comparison's title is the figure's caption, since the post doesn't give one
const figCaption = computed(() => props.caption || (props.figure === 'choice' ? choice.title : ''));

onMounted(() => {
  if (props.figure === 'tables') resetTables();
});
</script>

<template>
  <figure ref="root" class="pf-figure" :class="`bf-fig-${figure}`">
    <figcaption v-if="figCaption || number">
      <strong v-if="number">Fig. {{ number }}</strong> {{ figCaption }}
    </figcaption>
    <p class="sr-only">{{ descriptions[figure] }}</p>

    <!-- lead: two wins at once -->
    <div v-if="figure === 'race'" class="pf-panel">
      <div class="bf-race" :class="raceMode" aria-hidden="true">
        <div v-for="v in ['a', 'b']" :key="v" class="bf-visitor" :class="[`bf-v${v}`, { on: race.act.includes(v) && raceStep === 0 }]">
          <RetroIcon name="person" /><strong>{{ v.toUpperCase() }}</strong>
          <code>{{ raceSees[v] }}</code>
        </div>
        <template v-if="raceMode === 'functions'">
          <div v-for="v in ['a', 'b']" :key="v" class="bf-fn" :class="[`bf-h${v}`, { on: race.act === v }]">
            <RetroIcon name="chip" /><span>function {{ v.toUpperCase() }}</span>
            <code>{{ race[`h${v}`] ?? '·' }}</code>
          </div>
        </template>
        <div v-else class="bf-fn bf-one">
          <span class="bf-one-head"><RetroIcon name="chip" /><span>Durable Object <code>site</code></span></span>
          <small>one request at a time</small>
          <span v-for="v in ['a', 'b']" :key="v" class="bf-queue" :class="{ on: race.act === v }"><strong>{{ v.toUpperCase() }}</strong><code>{{ race[`h${v}`] }}</code></span>
        </div>
        <div class="bf-store" :class="{ bad: race.bad, good: race.good }">
          <RetroIcon name="notebook" />
          <span>minesweeperWins</span>
          <small>{{ raceModes[raceMode].store }}</small>
          <strong>{{ race.count }}</strong>
          <em v-if="race.bad">should be 42</em>
          <em v-else-if="race.good">both counted</em>
        </div>
      </div>
      <div class="pf-detail" :aria-live="racePlaying ? 'off' : 'polite'">
        <strong><b>{{ raceStep + 1 }}/{{ raceTotal }}</b> {{ raceModes[raceMode].middle }}</strong>
        <p>{{ race.text }}</p>
      </div>
      <div class="pf-buttons">
        <button class="raised pf-button" :disabled="raceStep === 0" @click="raceGo(raceStep - 1)">Back</button>
        <button class="raised pf-button" :disabled="raceStep >= raceTotal - 1" @click="raceGo(raceStep + 1)">Next</button>
        <button class="raised pf-button" @click="racePlaying = !racePlaying">{{ racePlaying ? 'Pause' : 'Play' }}</button>
        <span class="pf-toggle" role="group" aria-label="Backend">
          <button v-for="(m, id) in raceModes" :key="id" class="raised pf-button" :class="{ pressed: raceMode === id }" :aria-pressed="raceMode === id" @click="raceGo(0, id)">{{ m.label }}</button>
        </span>
      </div>
    </div>

    <!-- tables: the durable object's sqlite -->
    <div v-else-if="figure === 'tables' && db" class="pf-panel">
      <div class="pf-controls">
        <div class="pf-control">
          <span id="bf-who">Sent by</span>
          <span class="pf-toggle" role="group" aria-labelledby="bf-who">
            <button v-for="(v, i) in visitors" :key="v.id" class="raised pf-button" :class="{ pressed: who === i }" :aria-pressed="who === i" @click="who = i">{{ v.label }}</button>
          </span>
        </div>
        <div class="pf-control">
          <span id="bf-clock">Clock <b>{{ clock }} UTC</b></span>
          <span class="pf-toggle" role="group" aria-labelledby="bf-clock">
            <button class="raised pf-button" @click="wait(30)">+30 s</button>
            <button class="raised pf-button" @click="wait(120)">+2 min</button>
          </span>
        </div>
        <button class="raised pf-button" @click="resetTables">Reset</button>
      </div>
      <div class="pf-control bf-sends">
        <span id="bf-send">Send a request</span>
        <span class="bf-send-row" role="group" aria-labelledby="bf-send">
          <button v-for="a in tableActions" :key="a.label" class="raised pf-button" @click="a.run">{{ a.label }}</button>
        </span>
      </div>
      <div class="pf-controls bf-snake">
        <div class="pf-control">
          <label for="bf-name">Snake name</label>
          <input id="bf-name" v-model="snakeName" class="inset" maxlength="12" autocomplete="off" :aria-describedby="nameError ? 'bf-name-error' : undefined">
        </div>
        <div class="pf-control">
          <label for="bf-score">Score <b>{{ snakeScore }}</b></label>
          <input id="bf-score" v-model.number="snakeScore" class="pf-range bf-score" type="range" min="1" max="99">
        </div>
        <button class="raised pf-button" @click="sendScore">Save score</button>
        <span v-if="nameError" id="bf-name-error" class="pf-note bf-name-error">{{ nameError }}</span>
      </div>
      <pre v-if="lastRun" class="pf-code bf-ran"><span v-for="(line, i) in lastRun.ran" :key="i" :class="{ dim: line.startsWith('--') || line.startsWith('DELETE FROM sessions WHERE seen') }">{{ line }}
</span></pre>
      <p v-else class="pf-note bf-ran">Send something to see the statements it runs.</p>
      <p class="sr-only" aria-live="polite">{{ tableStatus }}</p>
      <div class="bf-tables">
        <div class="pf-scroll">
          <table class="pf-table">
            <caption>totals</caption>
            <thead><tr><th>name</th><th>value</th></tr></thead>
            <tbody><tr v-for="r in db.totals" :key="r.name" :class="{ new: isNew('totals', r.name) }"><td>{{ r.name }}</td><td>{{ r.value }}</td></tr></tbody>
          </table>
        </div>
        <div class="pf-scroll">
          <table class="pf-table">
            <caption>sessions ({{ db.sessions.length }} online)</caption>
            <thead><tr><th>id</th><th>seen</th></tr></thead>
            <tbody>
              <tr v-for="r in db.sessions" :key="r.id" :class="{ new: isNew('sessions', r.id) }"><td>{{ r.id }}</td><td>{{ Math.round((db.now - r.seen) / 1000) }} s ago</td></tr>
              <tr v-for="r in goneRows('sessions')" :key="`gone-${r.id}`" class="gone"><td>{{ r.id }}</td><td>deleted</td></tr>
              <tr v-if="!db.sessions.length && !goneRows('sessions').length" class="empty"><td colspan="2">nobody</td></tr>
            </tbody>
          </table>
        </div>
        <div class="pf-scroll">
          <table class="pf-table">
            <caption>scores</caption>
            <thead><tr><th>id</th><th>score</th><th>name</th></tr></thead>
            <tbody><tr v-for="r in db.scores" :key="r.id" :class="{ new: isNew('scores', JSON.stringify([r.id, ''])) }"><td>{{ r.id.slice(0, 6) }}…</td><td>{{ r.score }}</td><td>{{ r.name ?? 'NULL' }}</td></tr></tbody>
          </table>
        </div>
        <div class="pf-scroll">
          <table class="pf-table">
            <caption>daily_scores</caption>
            <thead><tr><th>id</th><th>day</th><th>score</th><th>name</th></tr></thead>
            <tbody><tr v-for="r in db.daily_scores" :key="r.id + r.day" :class="{ new: isNew('daily_scores', JSON.stringify([r.id, r.day])) }"><td>{{ r.id.slice(0, 6) }}…</td><td>{{ r.day }}</td><td>{{ r.score }}</td><td>{{ r.name ?? 'NULL' }}</td></tr></tbody>
          </table>
        </div>
      </div>
      <div v-if="lastRun?.response" class="pf-detail">
        <strong>Response</strong> <code>200, part of the JSON</code>
        <pre class="pf-code bf-response">{{ JSON.stringify(lastRun.response) }}</pre>
      </div>
    </div>

    <!-- online: the 90 second rule -->
    <div v-else-if="figure === 'online'" class="pf-panel">
      <div class="bf-online" role="img" :aria-label="`At ${onlineAt} seconds, ${onlineCount} of 4 visitors count as online. ${laneState.map(l => `${l.label}: ${l.state}`).join('. ')}.`">
        <div v-for="lane in laneState" :key="lane.label" class="bf-lane" :class="{ on: lane.on }">
          <div class="bf-lane-head"><i />{{ lane.label }}<span>{{ lane.state }}</span></div>
          <div class="bf-track">
            <span v-if="lane.on" class="bf-window" :style="{ left: pct(Math.max(0, onlineAt - 90)), width: pct(onlineAt - Math.max(0, onlineAt - 90)) }" />
            <span v-for="e in lane.events" :key="e.t" class="bf-ev" :class="[e.kind, { past: e.t <= onlineAt }]" :style="{ left: pct(e.t) }" />
            <span class="bf-now" :style="{ left: pct(onlineAt) }" />
          </div>
        </div>
        <div class="bf-axis">
          <span v-for="t in onlineTicks" :key="t" :style="{ left: pct(t) }">{{ t }} s</span>
        </div>
      </div>
      <div class="pf-controls bf-online-controls">
        <div class="pf-control">
          <label for="bf-online-at">Clock <b>{{ onlineAt }} s</b></label>
          <input id="bf-online-at" v-model.number="onlineAt" class="pf-range bf-wide" type="range" min="0" max="300" :aria-valuetext="`${onlineAt} seconds, ${onlineCount} online`" @pointerdown="stopOnline" @keydown="stopOnline">
        </div>
        <button class="raised pf-button" @click="playOnline">{{ onlinePlaying ? 'Stop' : 'Play' }}</button>
      </div>
      <div class="pf-detail">
        <strong>{{ onlineCount }} online now</strong> <code>SELECT COUNT(*) FROM sessions</code>
        <p class="bf-legend" aria-hidden="true">
          <span><i class="bf-ev visit past" />visit</span>
          <span><i class="bf-ev heartbeat past" />heartbeat</span>
          <span><i class="bf-ev leave past" />leave</span>
          <span><i class="bf-window" />last 90 s</span>
        </p>
        <p>A visitor counts if they were heard from inside the shaded 90 seconds and haven’t left since. Heartbeats go every 30 seconds while the tab is showing.</p>
      </div>
    </div>

    <!-- boards: sliding windows -->
    <div v-else-if="figure === 'boards'" class="pf-panel">
      <div ref="chartBox" class="bf-days">
        <svg :viewBox="`0 0 ${chartW} ${chart.h}`" :width="chartW" :height="chart.h" role="img" :aria-label="`Ten Snake scores over ${span} days, today at day ${today}. ${boardDays.map(b => b.label).join(', ')} windows reach back from today.`">
          <line :x1="bx(0)" :x2="bx(span)" :y1="chart.top + chart.plot" :y2="chart.top + chart.plot" class="bf-baseline" />
          <g v-for="(b, i) in boards" :key="b.key" :transform="`translate(0 ${chart.windows + i * chart.row})`">
            <text x="6" :y="chart.row / 2" class="bf-row-label">{{ b.label }}</text>
            <rect :x="bx(b.key === 'all' ? 0 : Math.max(0, today - b.key))" :width="Math.max(2, bx(today) - bx(b.key === 'all' ? 0 : Math.max(0, today - b.key)))" y="2" :height="chart.row - 4" :style="{ fill: b.color }" class="bf-span" />
          </g>
          <g :transform="`translate(0 ${chart.h - 6})`">
            <text v-for="t in dayTicks" :key="t" :x="bx(t)" y="0" class="bf-tick" :text-anchor="t ? 'middle' : 'start'">{{ t ? t : 'day 0' }}</text>
          </g>
          <line :x1="bx(today)" :x2="bx(today)" :y1="chart.top - 4" :y2="chart.windows + chart.rows * chart.row" class="bf-now" />
          <text :x="bx(today)" :y="chart.top - 8" class="bf-today" :text-anchor="bx(today) > chartW - 40 ? 'end' : bx(today) < chart.label + 30 ? 'start' : 'middle'">today</text>
          <circle v-for="(s, i) in scoreDays" :key="i" :cx="bx(s.day)" :cy="by(s.score)" r="4" class="bf-score-dot" :class="dotState(s)"><title>{{ s.name }}: {{ s.score }} on day {{ s.day }}</title></circle>
        </svg>
      </div>
      <div class="pf-controls">
        <div class="pf-control">
          <label for="bf-today">Today is day <b>{{ today }}</b></label>
          <input id="bf-today" v-model.number="today" class="pf-range bf-wide" type="range" :min="0" :max="span" :aria-valuetext="`day ${today}`">
        </div>
      </div>
      <div class="bf-boards">
        <section v-for="b in boards" :key="b.key" class="bf-board" :style="{ '--swatch': b.color }">
          <h4><i />{{ b.label }}</h4>
          <ol>
            <li v-for="r in b.rows.slice(0, 3)" :key="r.id"><span>{{ r.name }}</span><b>{{ r.score }}</b></li>
            <li v-if="!b.rows.length" class="empty">no scores</li>
          </ol>
        </section>
      </div>
      <p class="pf-note">
        Each board is one query over daily_scores: every row newer than the window, each player’s best (the top 3 of 10 shown). Nothing moves a score off a board. The window slides past it.
        <template v-if="pruned.length"> {{ pruned.length }} {{ pruned.length === 1 ? 'row is' : 'rows are' }} older than 366 days (hollow) and {{ pruned.length === 1 ? 'goes' : 'go' }} the next time a score is saved. All time reads the scores table instead, so ACE’s 88 stays.</template>
      </p>
    </div>

    <!-- choice -->
    <BlogGraphic v-else-if="figure === 'choice'" :graphic="choice" class="bf-choice" />
  </figure>
</template>

<style scoped>
/* race: each visitor's request, what handles it, and the stored count. wide, the
   two requests are rows that meet at the count. narrow, they're columns that drop
   into it */
.bf-race { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.1fr) minmax(0, 1fr); grid-template-areas: "va ha store" "vb hb store"; gap: 8px 26px; align-items: stretch; }
.bf-race.object { grid-template-areas: "va one store" "vb one store"; }
.bf-va { grid-area: va; }
.bf-vb { grid-area: vb; }
.bf-ha { grid-area: ha; }
.bf-hb { grid-area: hb; }
.bf-one { grid-area: one; }
.bf-store { grid-area: store; }
.bf-visitor, .bf-fn { position: relative; }
/* the arrow from each box to the next */
.bf-visitor::after, .bf-fn::after { content: ''; position: absolute; top: 50%; left: calc(100% + 9px); margin-top: -5px; border: 5px solid transparent; border-left: 7px solid var(--muted); border-right: 0; }
.bf-visitor { display: grid; grid-template-columns: auto auto minmax(0, 1fr); align-items: center; gap: 6px; padding: 6px 8px; font-size: 12px; background: var(--d-page-alt, #fffdf2); border: 2px solid var(--d-line, #000); transition: box-shadow .2s, border-color .2s; }
.bf-visitor svg { width: 20px; height: 20px; }
.bf-visitor code { text-align: right; overflow-wrap: anywhere; }
.bf-fn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 6px 4px; font-size: 12px; text-align: center; background: var(--surface); border: 2px solid; border-color: var(--light) var(--edge) var(--edge) var(--light); color: var(--ink); transition: box-shadow .2s; }
.bf-fn > svg, .bf-one-head svg { width: 20px; height: 20px; }
.bf-fn code { min-height: 1.2em; }
.bf-visitor.on, .bf-fn.on, .bf-queue.on { border-color: var(--navy, #000080); box-shadow: 3px 3px 0 var(--navy, #000080); }
:root[data-theme="dark"] :is(.bf-visitor.on, .bf-fn.on, .bf-queue.on) { border-color: #8f9bff; box-shadow: 3px 3px 0 #8f9bff; }
.bf-one { gap: 4px; padding: 8px; }
.bf-one-head { display: flex; align-items: center; gap: 5px; }
.bf-one small, .bf-store small { color: var(--muted); font-size: 11px; }
.bf-queue { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; width: 100%; max-width: 12em; padding: 2px 6px; background: var(--paper); border: 1px solid var(--d-rule, #ccc); transition: box-shadow .2s; }
.bf-store { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 10px 4px; font-size: 12px; text-align: center; background: var(--paper); border: 2px solid var(--d-line, #000); transition: box-shadow .2s, border-color .2s; }
.bf-store svg { width: 24px; height: 24px; }
.bf-store strong { font: bold 30px/1.1 'Pixel MS Sans Serif', monospace; color: var(--ink); }
.bf-store em { font-style: normal; font-weight: bold; }
.bf-store.bad { border-color: var(--pf-bad); box-shadow: 3px 3px 0 var(--pf-bad); }
.bf-store.bad em { color: var(--pf-bad); }
.bf-store.good { border-color: var(--pf-good); box-shadow: 3px 3px 0 var(--pf-good); }
.bf-store.good em { color: var(--pf-good); }
@container (max-width: 480px) {
  .bf-race { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "va vb" "ha hb" "store store"; gap: 22px 8px; }
  .bf-race.object { grid-template-areas: "va vb" "one one" "store store"; }
  .bf-visitor::after, .bf-fn::after { top: calc(100% + 8px); left: 50%; margin: 0 0 0 -5px; border: 5px solid transparent; border-top: 7px solid var(--muted); border-bottom: 0; }
  .bf-store { padding: 6px 4px; }
}

/* tables */
.bf-sends { margin-bottom: 12px; }
.bf-send-row { display: flex; flex-wrap: wrap; gap: 6px; }
.bf-snake { margin-bottom: 10px; }
.bf-snake input.inset { width: 8em; padding: 3px 5px; font: 12px Tahoma, sans-serif; text-transform: uppercase; background: var(--paper); color: var(--ink); }
.bf-score { width: 130px; }
.bf-name-error { flex-basis: 100%; margin: -4px 0 0; color: var(--pf-bad); }
.bf-ran { margin: 0 0 10px; font-size: 11px; }
.bf-ran span { display: block; }
.bf-tables { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.bf-response { margin-top: 6px; font-size: 11px; }
@container (max-width: 520px) { .bf-tables { grid-template-columns: minmax(0, 1fr); } }

/* online: a lane per visitor, its label over its track */
.bf-online { padding: 8px 14px 4px; background: var(--paper); border: 1px solid var(--d-rule, #ccc); }
.bf-lane + .bf-lane { margin-top: 6px; }
.bf-lane-head { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; font-size: 12px; color: var(--muted); }
.bf-lane.on .bf-lane-head { color: var(--ink); font-weight: bold; }
.bf-lane-head i { width: 10px; height: 10px; border: 1px solid var(--d-line, #000); background: var(--surface); }
.bf-lane.on .bf-lane-head i { background: #1baf7a; }
.bf-lane-head span { font: 12px Tahoma, sans-serif; color: var(--muted); }
.bf-track { position: relative; height: 16px; }
.bf-track::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; border-top: 1px solid var(--d-rule, #ccc); }
.bf-window { position: absolute; top: 2px; bottom: 2px; background: rgb(27 175 122 / .25); border-left: 1px solid #1baf7a; }
.bf-ev { position: absolute; top: 50%; width: 7px; height: 7px; transform: translate(-50%, -50%); border-radius: 50%; background: var(--paper); border: 1px solid var(--muted); }
.bf-ev.visit { width: 10px; height: 10px; }
.bf-ev.leave { border-radius: 0; width: 7px; height: 9px; }
.bf-ev.past { background: #1baf7a; border-color: var(--d-line, #000); }
.bf-ev.visit.past { background: var(--navy, #000080); }
:root[data-theme="dark"] .bf-ev.visit.past { background: #8f9bff; }
.bf-ev.leave.past { background: var(--pf-bad); }
.bf-track .bf-now { position: absolute; top: -3px; bottom: -3px; border-left: 1px dashed var(--ink); }
.bf-axis { position: relative; height: 16px; margin-top: 4px; border-top: 1px solid var(--d-rule, #ccc); font: 10px Tahoma, sans-serif; color: var(--muted); }
.bf-axis span { position: absolute; top: 2px; transform: translateX(-50%); white-space: nowrap; }
.bf-axis span:first-child { transform: none; }
.bf-axis span:last-child { transform: translateX(-100%); }
.bf-online-controls { margin: 10px 0 0; }
.bf-wide { width: 260px; }
.pf-detail p.bf-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--muted); }
.bf-legend span { display: inline-flex; align-items: center; gap: 5px; }
.bf-legend .bf-ev { position: static; transform: none; }
.bf-legend .bf-window { position: static; display: inline-block; width: 16px; height: 9px; }

/* boards */
.bf-days { margin-bottom: 10px; background: var(--paper); border: 1px solid var(--d-rule, #ccc); overflow: hidden; }
.bf-days svg { display: block; }
.bf-baseline { stroke: var(--d-rule, #ccc); }
.bf-span { opacity: .55; }
.bf-row-label { font: 11px Tahoma, sans-serif; fill: var(--muted); dominant-baseline: middle; }
.bf-tick { font: 10px Tahoma, sans-serif; fill: var(--muted); }
.bf-today { font: bold 11px Tahoma, sans-serif; fill: var(--ink); }
.bf-days .bf-now { stroke: var(--ink); stroke-width: 1; stroke-dasharray: 3 2; }
.bf-score-dot { fill: var(--bar-2); stroke: var(--d-line, #000); stroke-width: 1; }
.bf-score-dot.future { fill: none; stroke: var(--d-rule, #ccc); }
.bf-score-dot.pruned { fill: var(--paper); stroke: var(--muted); stroke-dasharray: 2 1.5; }
.bf-boards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.bf-board { padding: 6px; background: var(--d-page-alt, #fffdf2); border: 2px solid var(--d-line, #000); min-width: 0; }
.bf-board h4 { display: flex; align-items: center; gap: 5px; margin: 0 0 4px; font: bold 11px 'Pixel MS Sans Serif', Tahoma, sans-serif; }
.bf-board h4 i { flex: none; width: 10px; height: 10px; background: var(--swatch); opacity: .8; border: 1px solid var(--d-line, #000); }
.bf-board ol { margin: 0; padding: 0 0 0 18px; font: 11px 'Courier New', monospace; }
.bf-board li span { margin-right: 4px; }
.bf-board li.empty { list-style: none; margin-left: -18px; color: var(--muted); font-style: italic; }
@container (max-width: 520px) { .bf-boards { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@container (max-width: 280px) { .bf-boards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

/* choice: the figure caption carries the comparison's title */
.bf-choice { margin: 0; }
.bf-choice > :deep(figcaption) { display: none; }

@media (prefers-reduced-motion: reduce) {
  .bf-visitor, .bf-fn, .bf-queue, .bf-store { transition: none; }
}
</style>
