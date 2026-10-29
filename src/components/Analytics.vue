<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import RetroIcon from './RetroIcon.vue';
import PixelPie from './PixelPie.vue';
import Leaderboard from './Leaderboard.vue';
import { boardKeys, useLiveStats } from '../live-stats.js';
import { read, save, storageRevision } from '../storage.js';
import { onLocalAnalytics } from '../local-analytics.js';
import { historySnapshots as snapshots } from '../analytics-history.js';
const { data: live, error: liveError, refresh } = useLiveStats();
// one period for the whole window: the cards, the history, the pie and the snake
// cartridge all follow it. cloudflare keeps about 90 days of history, so that's the
// furthest back it goes
const periods = [7, 30, 90];
const savedDays = Number(read('analytics-period', '30'));
const days = ref(periods.includes(savedDays) ? savedDays : 30);
const data = ref(snapshots.get(days.value).value());
const busy = ref(false);
const error = ref('');
let request = 0;
let pollTimer;
let reconcileTimer;
const stopLocal = onLocalAnalytics(() => {
  data.value = snapshots.get(days.value).value();
  if (!reconcileTimer) reconcileTimer = setTimeout(() => {
    reconcileTimer = null;
    load(true);
  }, 1000);
});
const number = value => Number(value || 0).toLocaleString();
// the window is split into win95 tabs
const tabs = [
  { id: 'scoreboard', label: 'Scoreboard' },
  { id: 'behind', label: 'Behind the scenes' },
];
const tab = ref(read('analytics-tab', 'scoreboard'));
const current = computed(() => tabs.some(t => t.id === tab.value) ? tab.value : 'scoreboard');
function pick(id) {
  reread.value++;
  tab.value = id;
  save('analytics-tab', id);
}
// left and right arrows move between tabs, like a real tab strip
function step(event, by) {
  const list = tabs;
  const next = list[(list.findIndex(t => t.id === current.value) + by + list.length) % list.length];
  pick(next.id);
  event.currentTarget.parentElement.querySelector(`[data-tab="${next.id}"]`)?.focus();
}
// the cards up top, for the chosen period. the counts come from the site history
// (a dash while it loads or if it can't), the snake score from that period's leaderboard
const cards = computed(() => {
  if (!live.value && !data.value) return [];
  const s = data.value || {};
  const games = (s.clippyWins || 0) + (s.clippyLosses || 0);
  const count = value => data.value ? number(value) : '—';
  return [
    { group: 'games', label: 'Minesweeper beaten', value: count(s.minesweeperWins), icon: 'mine' },
    { group: 'games', label: 'Breakout finished', value: count(s.breakoutWins), icon: 'game' },
    { group: 'games', label: 'Highest Snake score', value: number(Math.max(live.value?.[boardKeys[days.value]]?.[0]?.score || 0, s.snakeHighScore || 0)), icon: 'snake' },
    { group: 'games', label: 'Clippy win-lose', value: data.value ? `${number(s.clippyWins)}-${number(s.clippyLosses)}` : '—', icon: 'reversi',
      note: games ? `Clippy wins ${Math.round(s.clippyWins / games * 100)}%` : 'No games yet' },
    { group: 'games', label: 'Highest 2048 score', value: count(s.twenty48HighScore), icon: '2048' },
    { group: 'fun', label: 'Balloons popped', value: count(s.balloonsPopped), icon: 'balloon' },
    { group: 'fun', label: 'Fish fed', value: count(s.koiFed), icon: 'koi' },
    { group: 'fishbowl', label: 'Fishbowl messages sent', value: count(s.chatMessages), icon: 'koi' },
    { group: 'fishbowl', label: 'Tokens burnt by Clippy', value: count(s.tokensBurnt), icon: 'chip', note: 'on Workers AI' },
  ];
});
// the cards sit in groups, the games across the top and the smaller groups side by
// side under them
const groupTitles = { games: 'Games', fun: 'Just for fun', fishbowl: 'Fishbowl' };
const grouped = list => Object.entries(groupTitles)
  .map(([id, title]) => ({ id, title, cards: list.filter(card => card.group === id) }))
  .filter(group => group.cards.length);
// your own scores, kept in this browser by each game
// Storage writes in this tab and storage events from other tabs invalidate these
// immediately. Refresh/tab changes also reread values written outside the wrapper.
const reread = ref(0);
const yourMines = computed(() => {
  storageRevision.value;
  reread.value;
  return ['Beginner', 'Intermediate', 'Expert'].map(level => ({ level, wins: Number(read(`minesweeper-wins-${level.toLowerCase()}`, '0')) || 0 }));
});
const yourCards = computed(() => {
  storageRevision.value;
  reread.value;
  const you = Number(read('reversi-you', '0')) || 0, clippy = Number(read('reversi-clippy', '0')) || 0;
  return [
    { group: 'games', label: 'Minesweeper games beaten', value: number(yourMines.value.reduce((sum, l) => sum + l.wins, 0)), icon: 'mine', levels: yourMines.value },
    { group: 'games', label: 'Your Snake best', value: number(read('snake-best', '0')), icon: 'snake' },
    { group: 'games', label: 'Your 2048 best', value: number(read('2048-best', '0')), icon: '2048' },
    { group: 'fun', label: 'Balloons you popped', value: number(read('balloons-popped', '0')), icon: 'balloon' },
    { group: 'fun', label: 'Times you fed the fish', value: number(read('koi-fed', '0')), icon: 'koi' },
    { group: 'games', label: 'You vs Clippy', value: `${you}-${clippy}`, icon: 'reversi', note: you + clippy ? `You win ${Math.round(you / (you + clippy) * 100)}%` : 'No games yet' },
    { group: 'fishbowl', label: 'Fishbowl messages you sent', value: number(read('chat-sent', '0')), icon: 'koi' },
    { group: 'fishbowl', label: 'Tokens you burnt', value: number(read('clippy-tokens', '0')), icon: 'chip', note: 'asking Clippy' },
  ];
});
// the same kind of cards for the behind the scenes numbers, over the chosen period
const behindCards = computed(() => data.value ? [
  { label: 'Messages sent', value: number(data.value.mail.sent), icon: 'mail' },
  { label: 'Breakout balls lost', value: number(data.value.breakout.losses), icon: 'game' },
  { label: 'Seconds to win Breakout', value: data.value.breakout.averageWinSeconds ?? '—', icon: 'games', note: 'on average' },
] : []);
const daily = computed(() => {
  const counts = new Map(data.value?.daily.map(row => [row.day, row.visits]) || []);
  const all = Array.from({ length: days.value }, (_, i) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days.value + 1 + i);
    const day = date.toISOString().slice(0, 10);
    return { day, visits: counts.get(day) || 0 };
  });
  // start at the first day anyone visited, so a short history spreads across the
  // whole chart instead of bunching up on the right behind a run of empty days
  const first = all.findIndex(row => row.visits);
  return first > 0 ? all.slice(first) : all;
});
const peak = computed(() => Math.max(1, ...daily.value.map(row => row.visits)));
const sections = computed(() => data.value ? [
  // the last number is the section's bar color, --bar-1 to --bar-7 below
  ['Windows opened', data.value.windows, 3],
  ['Breakout funnel', data.value.funnel, 7], ['Mail errors', data.value.mail.errors, 2],
] : []);
async function get(url) {
  const response = await fetch(url, { redirect: 'error', cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not load analytics.');
  return result;
}
function setDays(value) {
  if (days.value === value) return;
  days.value = value;
  save('analytics-period', String(value));
  data.value = snapshots.get(value).value();
  load();
}
async function load(background = false) {
  if (background && busy.value) return;
  const id = ++request;
  const period = days.value;
  const snapshot = snapshots.get(period);
  const revision = snapshot.revision;
  reread.value++;
  if (!background) busy.value = true;
  error.value = '';
  try {
    const result = await get(`/api/analytics?days=${period}`);
    if (id === request) data.value = snapshot.accept(result, revision);
  }
  catch { if (id === request) error.value = 'Site history is unavailable right now. Please try again later.'; }
  if (id === request) busy.value = false;
}
onMounted(() => {
  load();
  pollTimer = setInterval(() => { if (!document.hidden) load(true); }, 30000);
});
onBeforeUnmount(() => {
  request++;
  stopLocal();
  clearInterval(pollTimer);
  clearTimeout(reconcileTimer);
});
</script>

<template>
  <div class="app-layout">
    <div class="toolbar analytics-toolbar">
      <div class="analytics-periods" role="group" aria-label="Period">
        <span>Last</span>
        <button v-for="value in periods" :key="value" class="raised" :class="{ pressed: days === value }" :aria-pressed="days === value" :disabled="busy" @click="setDays(value)">{{ value }} days</button>
      </div>
      <button class="raised analytics-refresh" :disabled="busy" @click="refresh(); load()">
        <!-- the same arrow circle as the restart buttons in contact and reversi -->
        <svg class="spin-icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true"><path d="M4 1h4v1H4zM9 1h1v1H9zM2 2h2v1H2zM8 2h2v1H8zM2 3h1v1H2zM7 3h3v1H7zM1 4h1v4H1zM10 6h1v2h-1zM2 8h1v1H2zM9 8h1v1H9zM2 9h2v1H2zM8 9h2v1H8zM4 10h4v1H4z"/></svg>
        Refresh
      </button>
    </div>
    <div class="analytics-tabs" role="tablist" aria-label="Analytics">
      <button v-for="t in tabs" :id="`analytics-tab-${t.id}`" :key="t.id" :data-tab="t.id" role="tab" :aria-selected="current === t.id" :aria-controls="`analytics-panel-${t.id}`" :tabindex="current === t.id ? 0 : -1"
        @click="pick(t.id)" @keydown.right.prevent="step($event, 1)" @keydown.left.prevent="step($event, -1)">{{ t.label }}</button>
    </div>
    <main :id="`analytics-panel-${current}`" class="content-scroll document pixel-headings fancy-dividers analytics-page" role="tabpanel" :aria-labelledby="`analytics-tab-${current}`" :aria-busy="busy">
      <template v-if="current === 'scoreboard'">
        <h1>Scoreboard, last {{ days }} days</h1>
        <p v-if="liveError && !live" role="status">{{ liveError }}</p>
        <p v-else-if="!live" role="status">Loading scores...</p>
        <template v-if="cards.length">
          <div class="card-groups">
            <section v-for="group in grouped(cards)" :key="group.id" class="card-group" :class="{ wide: group.id === 'games' }">
              <h3>{{ group.title }}</h3>
              <div class="score-cards">
                <section v-for="card in group.cards" :key="card.label" class="score-card">
                  <RetroIcon :name="card.icon"/>
                  <strong>{{ card.value }}</strong>
                  <span>{{ card.label }}</span>
                  <small v-if="card.note">{{ card.note }}</small>
                </section>
              </div>
            </section>
          </div>
          <div class="visit-banner">
            <section><RetroIcon name="person"/><div><strong>{{ data ? number(data.visitors) : '—' }}</strong><span>visits in {{ days }} days</span></div></section>
            <section><span class="online-dot" aria-hidden="true"/><div><strong>{{ live ? number(live.online) : '—' }}</strong><span>online now</span></div></section>
          </div>
        </template>
          <h2>Your scores</h2>
          <div class="card-groups">
            <section v-for="group in grouped(yourCards)" :key="group.id" class="card-group" :class="{ wide: group.id === 'games' }">
              <h3>{{ group.title }}</h3>
              <div class="score-cards">
                <section v-for="card in group.cards" :key="card.label" class="score-card">
                  <RetroIcon :name="card.icon"/>
                  <strong>{{ card.value }}</strong>
                  <span>{{ card.label }}</span>
                  <small v-if="card.note">{{ card.note }}</small>
                  <ul v-if="card.levels" class="level-counts">
                    <li v-for="l in card.levels" :key="l.level"><span>{{ l.level }}</span><b>{{ number(l.wins) }}</b></li>
                  </ul>
                </section>
              </div>
            </section>
          </div>
        <p v-if="busy" role="status">Loading site history...</p>
        <p v-else-if="error" role="status">{{ error }}</p>
        <template v-if="data">
          <section class="visitor-history">
          <h2>Visitors by day</h2>
          <p class="analytics-note"><strong>{{ number(data.visitors) }}</strong> visits in the last {{ days }} days</p>
          <p v-if="!data.visitors">No visits recorded yet. The next adventure starts with a click.</p>
          <div class="analytics-chart" role="img" :aria-label="`Daily visits over the last ${days} days. Peak: ${peak === 1 && !data.visitors ? 0 : peak}.`">
            <div v-for="row in daily" :key="row.day" class="analytics-column" :title="`${row.day}: ${number(row.visits)} visits`">
              <span :style="{ height: `${row.visits / peak * 100}%` }"/>
            </div>
          </div>
          <!-- a week or less gets a date under every bar, more just the two ends -->
          <div v-if="daily.length <= 7" class="analytics-axis each"><span v-for="row in daily" :key="row.day">{{ row.day.slice(5) }}</span></div>
          <div v-else class="analytics-axis"><span>{{ daily[0].day }}</span><span>{{ daily.at(-1).day }} (UTC)</span></div>
          </section>
        </template>
          <div class="history-row">
          <section>
          <h2>Boards cleared</h2>
          <PixelPie v-if="data" :rows="[{ label: 'Minesweeper', count: data.minesweeperWins }, { label: 'Breakout', count: data.breakoutWins }]" label="Boards cleared"/>
          </section>
          <section>
          <h2>Snake leaderboard</h2>
          <Leaderboard class="analytics-cart" :tuckable="false" :period="days" :choices="periods" @update:period="setDays"/>
          </section>
          </div>
      </template>
      <template v-else>
        <h1>Behind the scenes</h1>
        <p v-if="busy" role="status">Loading...</p>
        <p v-else-if="error" role="status">{{ error }}</p>
        <template v-if="data">
          <div class="score-cards three">
            <section v-for="card in behindCards" :key="card.label" class="score-card">
              <RetroIcon :name="card.icon"/>
              <strong>{{ card.value }}</strong>
              <span>{{ card.label }}</span>
              <small v-if="card.note">{{ card.note }}</small>
            </section>
          </div>
          <h2>Devices</h2>
          <PixelPie :rows="data.devices" label="Devices"/>
          <section v-for="[title, rows, color] in sections" :key="title">
            <h2>{{ title }}</h2><p v-if="!rows.length">No events yet.</p>
            <div v-for="row in rows" :key="row.label" class="analytics-bar-row" :style="{ '--bar': `var(--bar-${color})` }">
              <div><span>{{ row.label || 'Unknown' }}{{ row.label === 'sticky notes' ? '*' : '' }}</span><strong>{{ number(row.count) }}</strong></div>
              <div class="analytics-bar"><span :style="{ width: `${row.count / Math.max(1, ...rows.map(r => r.count)) * 100}%` }"/></div>
            </div>
            <p v-if="rows.some(row => row.label === 'sticky notes')" class="analytics-note">*Every sticky note is its own window, so they're added together here.</p>
          </section>
        </template>
      </template>
    </main>
  </div>
</template>

<style scoped>
.analytics-toolbar { flex-wrap: wrap; gap: 8px; font-family: 'Pixel MS Sans Serif', Tahoma, sans-serif; }
.analytics-toolbar .raised { font: inherit; color: var(--ink); text-decoration: none; }
.analytics-periods { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.analytics-periods span { margin-right: 4px; }
.analytics-periods .pressed { font-weight: bold; background: var(--hilite); }
/* win95 tab strip: the selected tab stands taller and joins the page below it */
.analytics-tabs { display: flex; gap: 2px; padding: 6px 6px 0; margin-bottom: -2px; position: relative; z-index: 1; overflow-x: auto; flex-shrink: 0; }
.analytics-tabs button {
  font: 13px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--ink); white-space: nowrap; cursor: pointer;
  padding: 4px 12px 3px; margin-top: 3px; background: var(--surface);
  border: 2px solid; border-bottom: 0; border-color: var(--light) var(--edge) transparent var(--light);
  box-shadow: inset -1px 0 var(--shadow), inset 1px 1px var(--hilite);
}
.analytics-tabs button[aria-selected="true"] { margin-top: 0; padding-bottom: 6px; font-weight: bold; background: var(--paper); }
.analytics-tabs button:focus-visible { outline: 1px dotted var(--ink); outline-offset: -5px; }
.analytics-page { border-top: 2px solid var(--light); }
.visit-banner { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0 0 12px; }
.visit-banner section {
  display: flex; align-items: center; justify-content: center; gap: 14px; padding: 14px 10px; min-width: 0;
  background: var(--d-page-alt, #fffdf2); border: 2px solid var(--d-line, #000); box-shadow: 4px 4px 0 var(--d-line, #000);
  font-family: 'Pixel MS Sans Serif', Tahoma, sans-serif;
}
.visit-banner .retro-icon { width: 40px; height: 40px; flex: none; }
.visit-banner strong { display: block; font: bold 40px/1.1 'Pixel MS Sans Serif', monospace; color: var(--d-link, #000080); }
.visit-banner span { font-size: 14px; }
/* a square green light that blinks like a modem */
.online-dot { width: 20px; height: 20px; flex: none; background: #1baf7a; border: 2px solid var(--d-line, #000); animation: online-blink 1.2s steps(1) infinite; }
@keyframes online-blink { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .online-dot { animation: none; } }
.score-cards.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
/* the games across the full width, and the smaller groups two to a row under them.
   each group's cards share its width evenly */
.card-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; margin: 12px 0; }
.card-group { display: flex; flex-direction: column; }
.card-group.wide { grid-column: 1 / -1; }
.card-group h3 { margin: 0; font: bold 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
/* groups side by side end level, their cards stretched to the taller one */
.card-group .score-cards { flex: 1; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); margin: 8px 0 10px; }
.level-counts { list-style: none; margin: 4px 0 0; padding: 0; width: 100%; max-width: 150px; font-size: 11px; }
.level-counts li { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; border-top: 1px dotted var(--d-line, #999); }
/* visitors by day and boards cleared side by side, stacked on a phone */
.history-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; align-items: start; margin-top: 12px; }
.history-row .pixel-pie { flex-direction: column; align-items: flex-start; }
/* the boards cleared pie matches the cartridge beside it: 240px, ten screen pixels a pie pixel */
.history-row .pixel-pie :deep(svg) { width: min(100%, 240px); height: auto; aspect-ratio: 1; }
.history-row .pixel-pie :deep(figcaption) { width: min(100%, 240px); max-width: none; flex: none; }
/* stacked on a phone, the pie and the cartridge each sit in the middle of their row */
@media (max-width: 700px) {
  .history-row { grid-template-columns: minmax(0, 1fr); }
  .history-row .pixel-pie { align-items: center; }
  .history-row .analytics-cart { margin-inline: auto; }
}
.analytics-refresh { display: inline-flex; align-items: center; gap: 6px; }
.analytics-refresh svg { width: 16px; height: 16px; fill: currentColor; }
.score-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 12px 0; }
.score-card {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px; text-align: center; min-width: 0;
  background: var(--d-page-alt, #fffdf2); border: 2px solid var(--d-line, #000); box-shadow: 4px 4px 0 var(--d-line, #000);
  font-family: 'Pixel MS Sans Serif', Tahoma, sans-serif; image-rendering: pixelated;
}
.score-card svg { width: 32px; height: 32px; }
.score-card strong { font: bold 28px/1.2 'Pixel MS Sans Serif', monospace; color: var(--d-link, #000080); overflow-wrap: anywhere; }
.score-card span { font-size: 12px; }
.score-card small { font-size: 11px; color: var(--muted); }
.analytics-note { font-size: 12px; color: var(--muted); }
/* the bars share the width, each with a little space either side of it */
.analytics-chart { display: flex; align-items: stretch; gap: 2px; height: 144px; border-left: 2px solid #555; border-bottom: 2px solid #555; padding: 8px 4px 0; background: repeating-linear-gradient(to top, var(--d-rule, #ddd) 0 1px, transparent 1px 32px); }
.analytics-column { flex: 1; min-width: 0; display: flex; align-items: flex-end; justify-content: center; }
.analytics-column span { width: 90%; background: repeating-linear-gradient(to top, #008080 0 6px, var(--paper) 6px 8px); }
.analytics-axis { display: flex; justify-content: space-between; font: 10px/2 monospace; gap: 8px; }
/* lined up under the bars: the same spacing and padding as the chart */
.analytics-axis.each { gap: 2px; padding: 0 4px 0 6px; }
.analytics-axis.each span { flex: 1; min-width: 0; text-align: center; white-space: nowrap; }
.analytics-bar-row { margin: 14px 0; }
.analytics-bar-row > div:first-child { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
.analytics-page { --bar-1: #2a78d6; --bar-2: #eb6834; --bar-3: #1baf7a; --bar-4: #eda100; --bar-5: #e87ba4; --bar-6: #8a8a8a; --bar-7: #4a3aa7; }
:root[data-theme="dark"] .analytics-page { --bar-1: #3987e5; --bar-2: #d95926; --bar-3: #199e70; --bar-4: #c98500; --bar-5: #d55181; --bar-6: #77777c; --bar-7: #9085e9; }
.analytics-bar { height: 16px; background: var(--d-rule, #eee); margin-top: 4px; }
.analytics-bar span { display: block; height: 100%; background: repeating-linear-gradient(to right, var(--bar) 0 6px, transparent 6px 8px); }
.analytics-table { width: 100%; text-align: left; font-size: 12px; }
.analytics-table td, .analytics-table th { border-bottom: 1px solid #ddd; }
@media (max-width: 560px) {
  .score-cards, .score-cards.three, .card-group .score-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .card-groups { grid-template-columns: minmax(0, 1fr); }
  /* an odd card out at the end takes the whole row */
  .card-group .score-cards > :last-child:nth-child(odd) { grid-column: 1 / -1; }
}
@media (max-width: 400px) { .analytics-page { padding: 18px 14px; } }
</style>
