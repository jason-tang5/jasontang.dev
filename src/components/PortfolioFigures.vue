<script setup>
// the figures in the portfolio project's writeup (content.mjs, figures): this
// desktop in miniature, left idle so a cursor wanders around opening things, a table of the apps on this desktop that opens each one, a diagram of
// how the site is wired up on cloudflare that you click through, and tiles with
// the live scoreboard from /api/stats. each is a small win95 panel
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AsciiImage from './AsciiImage.vue';
import RetroIcon from './RetroIcon.vue';
import { useLiveStats } from '../live-stats.js';
import { registry } from '../registry.js';
// preview is the desktop on its projects card, where it already fills the 600 by 375 frame
defineProps({ figure: { type: String, required: true }, preview: Boolean });
const emit = defineEmits(['open']);

// ---- desktop: the site in miniature. a cursor opens a window, drags it, closes
// it and moves on, only while the figure is on screen ----
const deskIcons = ['about', 'resume', 'projects', 'blog', 'analytics', 'contact', 'games', 'funstuff'];
// every position is a percentage of the little screen
const iconAt = k => ({ x: 3 + Math.floor(k / 5) * 12, y: 3 + (k % 5) * 18 });
const scenes = [
  { id: 'contact', kind: 'arcade', x: 36, y: 10, w: 36, h: 66 },
  { id: 'games', kind: 'folder', x: 34, y: 16, w: 46, h: 48, items: ['snake', 'minesweeper', 'reversi', '2048'] },
  { id: 'blog', kind: 'text', x: 32, y: 8, w: 50, h: 64 },
  { id: 'about', kind: 'about', x: 38, y: 14, w: 46, h: 56 },
];
const mini = ref({ cursor: { x: 60, y: 60 }, selected: null, win: null, grab: false, click: false });
const deskStage = ref(null);
// the desktop's own ascii sunset plays behind the icons, only while the figure is on screen
const sunsetUrl = new URL('../../assets/vaporwave-sunset.mp4', import.meta.url).href;
const sunsetPoster = new URL('../../assets/vaporwave-sunset-poster.png', import.meta.url).href;
const deskOnScreen = ref(false);
const clock = ref('');
const tick = () => { clock.value = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
let deskTimers = [], sceneIndex = 0, running = false, observer, clockTimer;
const later = (ms, fn) => deskTimers.push(setTimeout(fn, ms));
function click() {
  mini.value.click = true;
  later(160, () => { mini.value.click = false; });
}
function playScene() {
  const scene = scenes[sceneIndex++ % scenes.length];
  const icon = iconAt(deskIcons.indexOf(scene.id));
  const m = mini.value;
  m.cursor = { x: icon.x + 5, y: icon.y + 7 };
  later(900, () => { click(); m.selected = scene.id; });
  later(1150, () => { click(); m.win = { ...scene }; });
  // over to the title bar, then drag the window a little way
  later(2300, () => { m.cursor = { x: m.win.x + m.win.w * 0.4, y: m.win.y + 3 }; });
  later(3100, () => { m.grab = true; });
  later(3250, () => {
    const dx = scene.x > 35 ? -8 : 8, dy = 6;
    m.win = { ...m.win, x: m.win.x + dx, y: m.win.y + dy };
    m.cursor = { x: m.cursor.x + dx, y: m.cursor.y + dy };
  });
  later(4100, () => { m.grab = false; });
  later(5000, () => { m.cursor = { x: m.win.x + m.win.w - 2.5, y: m.win.y + 3 }; });
  later(5800, () => { click(); m.win = null; m.selected = null; });
  later(6400, () => { m.cursor = { x: m.cursor.x - 6, y: m.cursor.y + 10 }; });
  later(7200, playScene);
}
function start() {
  if (running) return;
  running = true;
  playScene();
}
function stop() {
  running = false;
  deskTimers.forEach(clearTimeout);
  deskTimers = [];
  mini.value.grab = false;
}
onMounted(() => {
  tick();
  clockTimer = setInterval(tick, 15000);
  // held still with reduced motion: one window left open where the cursor put it
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !deskStage.value) {
    deskOnScreen.value = true;
    mini.value.win = { ...scenes[0] };
    mini.value.cursor = { x: 50, y: 50 };
    return;
  }
  if (!('IntersectionObserver' in window)) {
    deskOnScreen.value = true;
    return start();
  }
  observer = new IntersectionObserver(([entry]) => {
    deskOnScreen.value = entry.isIntersecting;
    if (entry.isIntersecting) start();
    else stop();
  });
  observer.observe(deskStage.value);
});
onBeforeUnmount(() => { stop(); observer?.disconnect(); clearInterval(clockTimer); });
const pct = ({ x, y, w, h }) => ({ left: `${x}%`, top: `${y}%`, ...(w && { width: `${w}%`, height: `${h}%` }) });

// ---- apps: what's on the desktop ----
const apps = [
  { id: 'contact', what: 'Breakout in an arcade cabinet. Clear the bricks to reveal my email and unlock Mail.', how: 'Canvas, Web Audio' },
  { id: 'snake', what: 'A handheld with a world leaderboard over 7 days, 30 days and all time.', how: 'Durable Object, name filter' },
  { id: 'minesweeper', what: 'The Windows 98 one, with three sizes that turn sideways to fit a phone.', how: 'Vue' },
  { id: 'reversi', what: 'Play against Clippy, who judges corners, mobility and position.', how: 'Heuristic bot' },
  { id: 'music', what: 'An album on a CD player, with a stereo display that dances along.', how: 'Spotify iFrame API, canvas' },
  { id: 'blog', what: 'Posts I write and edit from the site itself.', how: 'Workers KV, Cloudflare Access' },
  { id: 'analytics', what: 'Visits, wins and the leaderboard, over 7, 30 or 90 days.', how: 'Analytics Engine SQL' },
  { id: 'stickies', what: 'Notes you can drag around the desktop. They stay in your browser.', how: 'localStorage' },
];

// ---- stack: how a click travels ----
const nodes = {
  browser: { name: 'Your browser', icon: 'computer', route: 'jasontang.dev',
    text: 'The desktop, every window and every game run here, built with Vue and Vite. Sticky notes, settings and your best scores stay in this browser.' },
  worker: { name: 'Cloudflare Worker', icon: 'chip', route: 'worker/index.js',
    text: 'One small worker answers every request. Anything under /api goes to the service below it; everything else is the static site.' },
  assets: { name: 'Static assets', icon: 'document', route: 'GET /*, *.mp4',
    text: 'The built site, served from Cloudflare’s edge. Videos pass through the worker, which cuts out byte ranges so Safari will play them.' },
  email: { name: 'Email Routing', icon: 'mail', route: 'POST /api/contact',
    text: 'Messages from the Mail window are checked, then emailed to me. Mail only unlocks after you beat Breakout.' },
  kv: { name: 'Workers KV', icon: 'notebook', route: '/api/blog, /api/admin',
    text: 'Blog posts, readable by anyone. Writing goes through Cloudflare Access, and the worker checks the Access token itself too.' },
  stats: { name: 'Durable Object', icon: 'snake', route: 'GET /api/stats',
    text: 'One SQLite database keeps the running totals, who is online in the last 90 seconds, and every player’s best Snake score by day.' },
  events: { name: 'Analytics Engine', icon: 'chart', route: 'POST /api/event',
    text: 'Anonymous events with no cookies, read back with SQL for the Analytics window. Nothing is sent until your first click.' },
};
const services = ['assets', 'email', 'kv', 'stats', 'events'];
const picked = ref('worker');
const active = computed(() => nodes[picked.value]);
// the path lights up down to whatever is picked
const lit = computed(() => ({ top: picked.value !== 'browser', bottom: services.includes(picked.value) }));

// ---- live: the scoreboard right now ----
const { data: live, error } = useLiveStats();
const number = value => Number(value || 0).toLocaleString();
const tiles = computed(() => {
  const s = live.value;
  const show = value => (s ? value : '—');
  return [
    { label: 'Total visits', value: show(number(s?.visitors)), icon: 'person', app: 'analytics' },
    { label: 'Online now', value: show(number(s?.online)), icon: 'computer', app: 'analytics', dot: true },
    { label: 'Snake high score', value: show(number(s?.snakeHighScore)), icon: 'snake', app: 'snake' },
    { label: 'Minesweeper boards beaten', value: show(number(s?.minesweeperWins)), icon: 'mine', app: 'minesweeper' },
    { label: 'Breakout boards cleared', value: show(number(s?.breakoutWins)), icon: 'game', app: 'contact' },
    { label: 'Clippy wins-losses', value: show(`${number(s?.clippyWins)}-${number(s?.clippyLosses)}`), icon: 'reversi', app: 'reversi' },
  ];
});
</script>

<template>
  <figure v-if="figure === 'desktop'" class="pf-figure" :class="{ 'pf-preview': preview }">
    <div ref="deskStage" class="pf-mini pf-frame">
      <div class="pf-mini-desk">
        <AsciiImage class="pf-mini-wall" :columns="150" :source="sunsetUrl" :poster="sunsetPoster" media-type="video"
          description="" :enabled="true" :visible="deskOnScreen" aria-hidden="true"/>
        <button v-for="(id, k) in deskIcons" :key="id" class="pf-mini-icon" :class="{ picked: mini.selected === id }" :style="pct(iconAt(k))"
          :title="`Open ${registry[id].label}`" @click="emit('open', id)">
          <RetroIcon :name="registry[id].icon"/><span>{{ registry[id].label }}</span>
        </button>
        <div v-if="mini.win" :key="mini.win.id" class="pf-mini-win" :class="{ grab: mini.grab }" :style="pct(mini.win)" aria-hidden="true">
          <div class="pf-mini-title"><RetroIcon :name="registry[mini.win.id].icon"/><span>{{ registry[mini.win.id].label }}</span><i>×</i></div>
          <div class="pf-mini-body" :class="mini.win.kind">
            <template v-if="mini.win.kind === 'arcade'">
              <div class="pf-mini-crt">
                <b v-for="n in 24" :key="n" :style="{ background: ['#ff5c5c', '#ffb13b', '#ffe066', '#5ccf7a'][Math.floor((n - 1) / 6)] }"/>
                <em class="ball"/><em class="paddle"/>
              </div>
            </template>
            <template v-else-if="mini.win.kind === 'folder'">
              <span v-for="id in mini.win.items" :key="id"><RetroIcon :name="registry[id].icon"/>{{ registry[id].label }}</span>
            </template>
            <template v-else-if="mini.win.kind === 'about'">
              <RetroIcon name="person"/><div><i/><i/><i/><i class="short"/></div>
            </template>
            <template v-else><i class="head"/><i/><i/><i/><i class="short"/><i/><i/><i class="short"/></template>
          </div>
        </div>
        <svg class="pf-mini-cursor" :class="{ click: mini.click }" :style="pct(mini.cursor)" viewBox="0 0 12 19" shape-rendering="crispEdges" aria-hidden="true">
          <path d="M0 0h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1H7v1h1v2h1v2H8v1H6v-1H5v-2H4v-2H3v1H2v1H1v1H0z" fill="#000"/>
          <path d="M1 2h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1H6v1h1v2h1v2H6v-2H5v-2H4v-1H3v1H2v1H1z" fill="#fff"/>
        </svg>
      </div>
      <div class="pf-mini-bar" aria-hidden="true">
        <span class="pf-mini-start raised"><RetroIcon name="computer"/>Start</span>
        <span v-if="mini.win" class="pf-mini-task"><RetroIcon :name="registry[mini.win.id].icon"/>{{ registry[mini.win.id].label }}</span>
        <span class="pf-mini-clock">{{ clock }}</span>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'apps'" class="pf-figure">
    <figcaption><strong>Fig. 1</strong> What’s on the desktop. Pick an app to open it.</figcaption>
    <div class="pf-table-wrap pf-frame">
      <table class="pf-table">
        <thead><tr><th scope="col">App</th><th scope="col">What it does</th><th scope="col">Under the hood</th></tr></thead>
        <tbody>
          <tr v-for="a in apps" :key="a.id" @click="emit('open', a.id)">
            <th scope="row">
              <button class="pf-open" :title="`Open ${registry[a.id].label}`" @click.stop="emit('open', a.id)">
                <RetroIcon :name="registry[a.id].icon"/><span>{{ registry[a.id].label }}</span>
              </button>
            </th>
            <td>{{ a.what }}<small class="pf-how-inline">{{ a.how }}</small></td>
            <td class="pf-how">{{ a.how }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>

  <figure v-else-if="figure === 'stack'" class="pf-figure">
    <figcaption><strong>Fig. 2</strong> How a click travels through the site. Pick a box to see what it handles.</figcaption>
    <div class="pf-stack pf-frame">
      <button class="pf-node raised" :class="{ pressed: picked === 'browser' }" :aria-pressed="picked === 'browser'" @click="picked = 'browser'">
        <RetroIcon :name="nodes.browser.icon"/><span>{{ nodes.browser.name }}</span>
      </button>
      <div class="pf-wire" :class="{ lit: lit.top }" aria-hidden="true"><i/></div>
      <button class="pf-node raised" :class="{ pressed: picked === 'worker' }" :aria-pressed="picked === 'worker'" @click="picked = 'worker'">
        <RetroIcon :name="nodes.worker.icon"/><span>{{ nodes.worker.name }}</span>
      </button>
      <div class="pf-wire" :class="{ lit: lit.bottom }" aria-hidden="true"><i/></div>
      <fieldset class="pf-edge">
        <legend>Cloudflare</legend>
        <button v-for="id in services" :key="id" class="pf-node raised" :class="{ pressed: picked === id }" :aria-pressed="picked === id" @click="picked = id">
          <RetroIcon :name="nodes[id].icon"/><span>{{ nodes[id].name }}</span>
        </button>
      </fieldset>
      <div class="pf-detail" aria-live="polite">
        <strong>{{ active.name }}</strong>
        <code>{{ active.route }}</code>
        <p>{{ active.text }}</p>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'live'" class="pf-figure">
    <figcaption>
      <strong>Fig. 3</strong> This site, right now.
      <span class="pf-live"><i aria-hidden="true"/>{{ error && !live ? 'No signal' : 'Live, every 30 seconds' }}</span>
    </figcaption>
    <div class="pf-tiles">
      <button v-for="t in tiles" :key="t.label" class="pf-tile" :title="`Open ${registry[t.app].label}`" @click="emit('open', t.app)">
        <RetroIcon :name="t.icon"/>
        <strong><i v-if="t.dot" class="pf-dot" aria-hidden="true"/>{{ t.value }}</strong>
        <span>{{ t.label }}</span>
      </button>
    </div>
  </figure>
</template>

<style scoped>
.pf-figure { container-type: inline-size; margin: 18px 0 22px; font-family: 'Pixel MS Sans Serif', Tahoma, sans-serif; }
.pf-figure figcaption { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin-bottom: 8px; font-size: 12px; color: var(--muted); }
.pf-figure figcaption strong { color: var(--ink); }
/* sunken like a pressed button, but the bottom right edge is grey instead of white
   so the corner still shows on the white page (dark mode uses the light edge) */
.pf-frame { --sunk-edge: var(--shadow); border: 2px solid; border-color: var(--edge) var(--sunk-edge) var(--sunk-edge) var(--edge); box-shadow: inset 1px 1px var(--shadow); }
:root[data-theme="dark"] .pf-frame { --sunk-edge: var(--light); }

/* fig 1: the desktop shrunk into a 16:10 screen, sized off the figure's width */
.pf-mini { display: flex; flex-direction: column; aspect-ratio: 16 / 10; overflow: hidden; background: var(--desktop, #008080); user-select: none; }
.pf-mini-desk { position: relative; flex: 1; isolation: isolate; }
/* the sunset sits over the teal at .88, the way it does on the real desktop */
.pf-mini-wall { position: absolute; inset: 0; z-index: -1; opacity: .88; pointer-events: none; }
.pf-mini-icon {
  position: absolute; display: flex; flex-direction: column; align-items: center; gap: 2px; width: 10%; padding: 2px 0; border: 0; background: none;
  font: max(7px, 1.6cqw)/1.1 'Pixel MS Sans Serif', Tahoma, sans-serif; color: #fff; text-shadow: 1px 1px 0 #000; cursor: var(--classic-pointer, pointer);
}
.pf-mini-icon svg { width: max(16px, 4.6cqw); height: max(16px, 4.6cqw); }
.pf-mini-icon span { padding: 0 2px; white-space: nowrap; }
.pf-mini-icon.picked span { background: var(--navy, #000080); outline: 1px dotted #fff; }
.pf-mini-icon:focus-visible span { outline: 1px dotted #fff; }
.pf-mini-win {
  position: absolute; display: flex; flex-direction: column; background: #c0c0c0; border: 2px solid; border-color: #dfdfdf #000 #000 #dfdfdf;
  box-shadow: inset 1px 1px #fff, inset -1px -1px #808080; transition: left .7s, top .7s; animation: pf-open .25s steps(4);
}
.pf-mini-win.grab { box-shadow: inset 1px 1px #fff, inset -1px -1px #808080, 0 0 0 1px #000; }
@keyframes pf-open { from { transform: scale(.2); opacity: 0; } }
.pf-mini-title { display: flex; align-items: center; gap: 3px; margin: 2px; padding: 1px 2px; background: linear-gradient(90deg, #000080, #1084d0); color: #fff; font: bold max(7px, 1.5cqw) 'Pixel MS Sans Serif', Tahoma, sans-serif; }
.pf-mini-title svg { width: max(9px, 2cqw); height: max(9px, 2cqw); }
.pf-mini-title span { flex: 1; overflow: hidden; white-space: nowrap; }
.pf-mini-title i { display: grid; place-items: center; width: max(9px, 2cqw); height: max(8px, 1.8cqw); background: #c0c0c0; color: #000; font: bold max(7px, 1.4cqw)/1 sans-serif; font-style: normal; box-shadow: inset -1px -1px #000, inset 1px 1px #fff; }
.pf-mini-body { flex: 1; min-height: 0; margin: 0 2px 2px; padding: 5%; overflow: hidden; background: #fff; box-shadow: inset 1px 1px #808080; }
.pf-mini-body i { display: block; height: max(3px, .8cqw); margin-bottom: max(3px, .9cqw); background: #c8c8c8; }
.pf-mini-body i.short { width: 60%; }
.pf-mini-body i.head { width: 45%; height: max(5px, 1.4cqw); background: #000080; }
.pf-mini-body.about { display: flex; gap: 6%; align-items: flex-start; }
.pf-mini-body.about svg { width: 28%; height: auto; flex: none; }
.pf-mini-body.about div { flex: 1; }
.pf-mini-body.folder { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 4%; font: max(7px, 1.4cqw) 'Pixel MS Sans Serif', Tahoma, sans-serif; color: #000; }
.pf-mini-body.folder span { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 21%; }
.pf-mini-body.folder svg { width: 70%; height: auto; }
.pf-mini-body.arcade { padding: 3px; background: #1a1a1f; }
.pf-mini-crt { position: relative; display: grid; grid-template-columns: repeat(6, 1fr); align-content: start; gap: 2px; height: 100%; padding: 6%; box-sizing: border-box; background: #000; border-radius: 6%; }
.pf-mini-crt b { height: max(3px, .9cqw); }
.pf-mini-crt em { position: absolute; background: #fff; }
.pf-mini-crt .paddle { bottom: 8%; left: 30%; width: 26%; height: max(3px, .8cqw); animation: pf-paddle 2.4s steps(12) infinite alternate; }
.pf-mini-crt .ball { width: max(3px, .9cqw); aspect-ratio: 1; animation: pf-ball 2.4s steps(24) infinite alternate; }
@keyframes pf-paddle { from { left: 8%; } to { left: 64%; } }
@keyframes pf-ball { 0% { left: 20%; top: 80%; } 50% { left: 55%; top: 45%; } 100% { left: 78%; top: 82%; } }
.pf-mini-cursor { position: absolute; z-index: 2; width: max(8px, 1.9cqw); height: auto; margin: -1px 0 0 -1px; pointer-events: none; transition: left .7s ease-in-out, top .7s ease-in-out; }
.pf-mini-cursor.click { transform: scale(.85); transform-origin: 0 0; }
.pf-mini-bar {
  display: flex; align-items: center; gap: 4px; height: max(16px, 5.4cqw); padding: 2px; box-sizing: border-box; background: #c0c0c0; border-top: 1px solid #fff;
  font: max(7px, 1.5cqw) 'Pixel MS Sans Serif', Tahoma, sans-serif; color: #000;
}
.pf-mini-bar svg { width: max(9px, 2.4cqw); height: max(9px, 2.4cqw); }
.pf-mini-start, .pf-mini-task { display: flex; align-items: center; gap: 3px; height: 100%; padding: 0 4px; box-sizing: border-box; font-weight: bold; box-shadow: inset -1px -1px #000, inset 1px 1px #fff; }
.pf-mini-task { width: 26%; font-weight: normal; overflow: hidden; white-space: nowrap; box-shadow: inset 1px 1px #000, inset -1px -1px #fff; background: #dfdfdf; }
.pf-mini-clock { margin-left: auto; height: 100%; display: flex; align-items: center; padding: 0 6px; box-shadow: inset 1px 1px #808080, inset -1px -1px #fff; }

/* fig 2: a win95 list view */
.pf-table-wrap { overflow-x: auto; background: var(--paper); }
.pf-table { width: 100%; min-width: 460px; table-layout: auto; border-collapse: collapse; font-size: 12px; }
.pf-table thead th {
  position: sticky; top: 0; padding: 3px 8px; text-align: left; font-weight: normal; white-space: nowrap;
  background: var(--surface); border: 1px solid; border-color: var(--light) var(--shadow) var(--shadow) var(--light);
}
.pf-table tbody tr { cursor: var(--classic-pointer, pointer); }
.pf-table tbody tr:nth-child(even) { background: var(--d-page-alt, #fffdf2); }
.pf-table tbody tr:hover { background: var(--navy, #000080); color: #fff; }
.pf-table tbody tr:hover .pf-how { color: #dfe3ff; }
.pf-table td, .pf-table tbody th { padding: 5px 8px; vertical-align: top; text-align: left; font-weight: normal; border-bottom: 1px dotted var(--d-line, #999); }
.pf-how { color: var(--muted); white-space: nowrap; }
.pf-how-inline { display: none; margin-top: 3px; color: var(--muted); font-size: 11px; }
.pf-table tbody tr:hover .pf-how-inline { color: #dfe3ff; }
/* narrow, the third column moves under the description so nothing scrolls sideways */
@container (max-width: 520px) {
  .pf-table { min-width: 0; }
  .pf-table th:nth-child(3), .pf-table .pf-how { display: none; }
  .pf-how-inline { display: block; }
}
.pf-open { display: inline-flex; align-items: center; gap: 6px; padding: 0; border: 0; background: none; color: inherit; font: bold 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; white-space: nowrap; cursor: inherit; }
.pf-open svg { width: 20px; height: 20px; flex: none; }
.pf-open:focus-visible { outline: 1px dotted currentColor; outline-offset: 2px; }

/* fig 3: boxes joined by wires, the path to the picked box lit up */
.pf-stack { display: flex; flex-direction: column; align-items: center; padding: 14px 12px; background: var(--paper); }
.pf-node {
  display: inline-flex; flex-direction: column; align-items: center; gap: 4px; min-width: 120px; padding: 8px 10px;
  font: 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--ink); cursor: var(--classic-pointer, pointer);
}
.pf-node svg { width: 28px; height: 28px; }
.pf-node.pressed { background: var(--navy, #000080); color: #fff; font-weight: bold; }
.pf-wire { position: relative; width: 4px; height: 26px; background: repeating-linear-gradient(to bottom, var(--d-line, #888) 0 4px, transparent 4px 8px); }
.pf-wire.lit { background: repeating-linear-gradient(to bottom, #1baf7a 0 4px, transparent 4px 8px); }
/* a packet runs down a lit wire */
.pf-wire.lit i { position: absolute; left: -2px; width: 8px; height: 8px; background: #1baf7a; box-shadow: 0 0 0 1px var(--d-line, #000); animation: pf-packet 1s steps(4) infinite; }
@keyframes pf-packet { from { top: -4px; } to { top: 22px; } }
.pf-edge {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; width: 100%; box-sizing: border-box;
  margin: 0; padding: 10px; border: 2px dashed var(--d-line, #888);
}
.pf-edge legend { padding: 0 6px; font-size: 11px; letter-spacing: 1px; color: var(--muted); }
.pf-edge .pf-node { min-width: 0; }
.pf-detail { width: 100%; box-sizing: border-box; margin-top: 12px; padding: 8px 10px; background: var(--d-page-alt, #fffdf2); border: 2px solid var(--d-line, #000); box-shadow: 3px 3px 0 var(--d-line, #000); }
.pf-detail strong { margin-right: 8px; font-size: 13px; }
.pf-detail code { font: 11px 'Courier New', monospace; color: var(--d-link, #000080); }
.pf-detail p { margin: 6px 0 0; font: 13px/1.5 inherit; }

/* fig 4: score cards like the analytics window's */
.pf-live { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; }
.pf-live i, .pf-dot { display: inline-block; width: 8px; height: 8px; background: #1baf7a; border: 1px solid var(--d-line, #000); animation: pf-blink 1.2s steps(1) infinite; }
.pf-dot { margin-right: 6px; vertical-align: middle; }
@keyframes pf-blink { 50% { opacity: .35; } }
.pf-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.pf-tile {
  display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; padding: 12px 6px; text-align: center;
  background: var(--d-page-alt, #fffdf2); border: 2px solid var(--d-line, #000); box-shadow: 4px 4px 0 var(--d-line, #000);
  color: var(--ink); font-family: 'Pixel MS Sans Serif', Tahoma, sans-serif; cursor: var(--classic-pointer, pointer);
  transition: transform .08s, box-shadow .08s;
}
.pf-tile svg { width: 32px; height: 32px; }
.pf-tile strong { font: bold 24px/1.2 'Pixel MS Sans Serif', monospace; color: var(--d-link, #000080); overflow-wrap: anywhere; }
.pf-tile span { font-size: 12px; }
@media (hover: hover) { .pf-tile:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 var(--d-line, #000); } }
.pf-tile:active { transform: translate(3px, 3px); box-shadow: 1px 1px 0 var(--d-line, #000); }
.pf-tile:focus-visible { outline: 1px dotted var(--ink); outline-offset: 3px; }
@media (max-width: 560px) { .pf-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (prefers-reduced-motion: reduce) {
  .pf-wire.lit i, .pf-live i, .pf-dot, .pf-mini-win, .pf-mini-crt em { animation: none; }
  .pf-wire.lit i { top: 9px; }
}
</style>
