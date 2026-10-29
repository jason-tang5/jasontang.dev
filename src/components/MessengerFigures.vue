<script setup>
// the figures in the msn messenger writeup (content.mjs, figures): two visitors chatting
// through the lobby, the room sleeping between messages while every socket stays open,
// the checks a message runs through on its way in, and a resend after a dropped
// connection. the rules follow worker/chat-room.mjs and worker/chat-rules.mjs, and fig 3
// uses the real profanity filter from names.mjs
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { profane } from '../names.mjs';
import { reducedMotion, useInView } from '../in-view.js';
// preview is the projects folder's card: fig 1 alone in a 600 × 375 frame, no buttons,
// playing only while the card is on screen
const props = defineProps({ figure: { type: String, required: true }, preview: Boolean });

// every figure here is an animation on one clock in ms. it loops, pauses, and with
// reduced motion it opens on a finished frame and only moves if you press play
const clock = ref(0);
const playing = ref(false);
const lengths = {};
let raf, last;
function frame(now) {
  if (last !== undefined) clock.value += now - last;
  last = now;
  const end = lengths[props.figure];
  if (end && clock.value > end) clock.value = 0;
  raf = requestAnimationFrame(frame);
}
function play() { playing.value = true; last = undefined; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
function pause() { playing.value = false; cancelAnimationFrame(raf); }
function toggle() { if (playing.value) pause(); else play(); }
function restart() { clock.value = 0; if (!playing.value) play(); }
const still = {};
const root = ref(null);
const inView = props.preview ? useInView(root) : null;
if (inView) watch(inView, on => { if (reducedMotion()) return; if (on) play(); else pause(); });
onMounted(() => {
  if (reducedMotion()) clock.value = still[props.figure] ?? 0;
  else if (!props.preview) play();
});
onBeforeUnmount(() => cancelAnimationFrame(raf));
const ease = p => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const clamp01 = p => Math.min(1, Math.max(0, p));

// ---- lobby: alice and bob chat through the room. bob's bad word comes back to his box,
// he fixes it and sends again ----
const KEY = 55, UP = 520, CHECK = 420, DOWN = 520, HOLD = 900;
const beats = [
  { who: 'alice', text: 'hey! anyone here?' },
  { who: 'bob', text: 'hi! cool site' },
  { who: 'bob', text: 'this is sh1t', rejected: true },
  { who: 'bob', keep: 'this is ', text: 'this is sick' },
  { who: 'alice', text: 'haha thanks, welcome in' },
];
// when each beat starts and how long its typing takes, with an edit deleting back to
// what it keeps first
let at = 500, box = { alice: '', bob: '' };
const timeline = beats.map(b => {
  const before = box[b.who];
  const keep = b.keep ?? '';
  const keys = (before.length - keep.length) + (b.text.length - keep.length);
  const t = { ...b, before, keep, start: at, sent: at + keys * KEY + 250 };
  t.checked = t.sent + UP + CHECK;
  t.done = t.checked + DOWN;
  box = { ...box, [b.who]: b.rejected ? b.text : '' };
  at = t.done + HOLD;
  return t;
});
lengths.lobby = at + 2200;
still.lobby = at;
// what's in a box partway through typing: backspacing to what it keeps, then typing on
function typed(t, now) {
  const n = Math.floor((now - t.start) / KEY);
  const deletes = t.before.length - t.keep.length;
  if (n < deletes) return t.before.slice(0, t.before.length - n);
  return t.text.slice(0, t.keep.length + Math.min(t.text.length - t.keep.length, n - deletes));
}
const lobby = computed(() => {
  const now = clock.value;
  const view = { alice: { log: [], box: '', error: false }, bob: { log: [], box: '', error: false }, packets: [], room: 'idle', saved: 0, stage: 'Two visitors in the lobby.' };
  for (const t of timeline) {
    if (now < t.start) break;
    const me = view[t.who];
    me.error = false;
    if (now < t.sent) { me.box = typed(t, now); view.stage = `${t.who === 'alice' ? 'Alice' : 'Bob'} is typing.`; continue; }
    me.box = '';
    if (now < t.sent + UP) {
      view.packets = [{ from: t.who, to: 'room', p: (now - t.sent) / UP, bad: false }];
      view.stage = 'Sent over the WebSocket to the lobby.';
    } else if (now < t.checked) {
      view.room = 'check';
      view.packets = [];
      view.stage = t.rejected ? 'The lobby checks it… that’s a bad word.' : 'The lobby checks it and saves it to SQLite.';
      if (t.rejected) view.room = 'bad';
    } else if (now < t.done) {
      const p = (now - t.checked) / DOWN;
      view.packets = t.rejected ? [{ from: 'room', to: t.who, p, bad: true }] : ['alice', 'bob'].map(to => ({ from: 'room', to, p, bad: false }));
      view.room = t.rejected ? 'bad' : 'saved';
      view.stage = t.rejected ? 'Turned down, so it goes back to Bob only.' : 'Sent to everyone in the room, Alice and Bob both.';
    } else {
      view.packets = [];
      if (t.rejected) { me.box = t.text; me.error = true; view.stage = 'Bob’s message is back in his box to fix. Alice never saw it.'; } else {
        view.alice.log.push(t); view.bob.log.push(t);
        view.stage = 'Delivered.';
      }
    }
    if (!t.rejected && now >= t.checked) view.saved++;
  }
  if (now >= at) view.stage = 'One message turned down, four delivered. All of it in about ten seconds.';
  for (const who of ['alice', 'bob']) view[who].log = view[who].log.slice(-4);
  return view;
});
// where a packet is on the wire between a window and the room
const wireX = { alice: 116, room: [150, 210], bob: 244 };
function packetX({ from, to, p }) {
  const a = from === 'room' ? (to === 'alice' ? wireX.room[0] : wireX.room[1]) : wireX[from];
  const b = to === 'room' ? (from === 'alice' ? wireX.room[0] : wireX.room[1]) : wireX[to];
  return a + (b - a) * ease(clamp01(p));
}
const windows = [{ who: 'alice', name: 'Alice', x: 4 }, { who: 'bob', name: 'Bob', x: 244 }];
// the preview's frame is squarer than the writeup's column, so its chat windows run
// taller by this much, with the wires and the room staying halfway down them
const grow = props.preview ? 56 : 0;
const mid = grow / 2;
const caret = computed(() => Math.floor(clock.value / 450) % 2 === 0);
const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ---- sleep: the room is only in memory while there's something to do. between bursts
// it hibernates, every socket stays open, and anything kept in a variable is gone ----
const SIM = 40, RATE = 3.2, IDLE = 10, HOP = 0.9;
const people = ['Alice', 'Bob', 'Cora', 'Dev'];
const sends = [[2, 0], [4, 1], [5.5, 0], [7, 3], [22, 2], [23.5, 1], [25, 0], [26.5, 1]].map(([t, who]) => ({ t, who }));
lengths.sleep = (SIM / RATE) * 1000 + 2500;
still.sleep = (SIM / RATE) * 1000;
// awake from a message landing until IDLE seconds after the last one
const awakeSpans = [];
for (const s of sends) {
  const land = s.t + HOP;
  const span = awakeSpans.at(-1);
  if (span && land <= span[1]) span[1] = land + IDLE; else awakeSpans.push([land, land + IDLE]);
}
const sleep = computed(() => {
  const t = Math.min(SIM, clock.value / 1000 * RATE);
  const awake = awakeSpans.some(([a, b]) => t >= a && t < b);
  const woke = awakeSpans.filter(([a]) => a <= t).at(-1)?.[0];
  const landed = sends.filter(s => s.t + HOP <= t);
  // sent counts for the last minute, kept two ways: SQLite has all of them, a variable
  // only has what landed since the room last woke up
  const count = list => people.map((name, i) => ({ name, n: list.filter(s => s.who === i).length })).filter(p => p.n);
  const memory = awake ? count(landed.filter(s => s.t + HOP >= woke)) : null;
  const inMemory = awakeSpans.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(t, b) - a), 0);
  return {
    t, awake, memory, sqlite: count(landed), inMemory,
    flying: sends.filter(s => t >= s.t && t < s.t + HOP).map(s => ({ who: s.who, p: (t - s.t) / HOP })),
  };
});
const sleepY = i => 26 + i * 30;
const tx = t => 10 + t / SIM * 340;

// ---- checks: what a message runs through on its way in, in the lobby's order ----
const gates = [
  { label: '250 characters', why: 'Messages can be up to 250 characters.' },
  { label: 'Friendly', why: 'Keep it friendly! That message wasn’t sent.' },
  { label: 'Slow mode', why: 'Slow down! Please wait before sending another message.' },
  { label: '20 a minute', why: 'Slow down! Please wait before sending another message.' },
  { label: 'Not a repeat', why: 'You already sent that message. Say something new!' },
];
const STEP = 380;
// which gate turns a message down, or gates.length when it's saved. the same rules as
// worker/chat-rules.mjs and the room: 250 characters, the word filter, 3 seconds since
// the last message, 20 in a minute, and none of the last three sent again
function judge(text, at, saved) {
  const clean = text.trim();
  if (!clean || [...clean].length > 250) return 0;
  if (profane(clean)) return 1;
  const last = saved.at(-1);
  if (last && at - last.at < 3000) return 2;
  if (saved.filter(s => at - s.at < 60000).length >= 20) return 3;
  if (saved.slice(-3).some(s => s.text.trim() === clean)) return 4;
  return gates.length;
}
function run(list) {
  const saved = [];
  return list.map(m => {
    const gate = judge(m.text, m.at, saved);
    if (gate === gates.length) saved.push(m);
    return { ...m, gate };
  });
}
const longOne = 'I just wanted to say that this is honestly one of the coolest portfolio sites I have ever seen in my entire life and I have seen a lot of them, the games, the music, the little sounds, all of it, and I could keep going for a while, so I will, because there is no limit… right?';
const demo = run([
  { text: 'hi everyone!', at: 600 },
  { text: 'hi everyone!', at: 2200 },
  { text: 'hi everyone!', at: 5400 },
  { text: 'this game is sh1t', at: 8600 },
  { text: longOne, at: 11800 },
  { text: 'ok, love the site', at: 15000 },
]);
lengths.checks = 19000;
still.checks = 18000;
const mine = ref([]);
const draft = ref('');
const runs = computed(() => (mine.value.length ? mine.value : demo));
function tryOne() {
  if (!draft.value.trim()) return;
  // your own messages run on the real clock, so the slow mode and repeat checks are real
  if (!mine.value.length) { clock.value = 0; lengths.checks = Infinity; }
  if (!playing.value) play();
  mine.value = run([...mine.value.map(({ text, at }) => ({ text, at })), { text: draft.value, at: clock.value }]).slice(-12);
  draft.value = '';
}
function backToDemo() { mine.value = []; lengths.checks = 19000; clock.value = 0; if (!playing.value) play(); }
// how far through the gates a message is: it walks one gate a step and stops at the one
// that turns it down
const chips = computed(() => runs.value.filter(m => clock.value >= m.at && clock.value < m.at + (Math.min(m.gate, gates.length) + 1) * STEP + 1600).map(m => {
  const walked = (clock.value - m.at) / STEP;
  return { ...m, pos: Math.min(walked, m.gate + 0.5), stopped: walked >= m.gate + 0.5 };
}));
const settled = computed(() => runs.value.filter(m => clock.value >= m.at + (m.gate + 0.5) * STEP).slice(-4).reverse());
const gateState = i => {
  const here = chips.value.filter(c => c.stopped && c.gate === i);
  if (here.length) return 'no';
  return chips.value.some(c => Math.floor(c.pos) === i) ? 'on' : '';
};

// ---- retry: the ack is lost when the connection drops, so the browser sends again
// with the same retry id ----
const withIds = ref(true);
const retrySteps = [
  { at: 400, text: 'Send “brb, train’s here” with retry ID 7f3a.' },
  { at: 1600, text: 'The lobby saves it and sends it to everyone.' },
  { at: 2500, text: 'The connection drops before the ack gets back.' },
  { at: 3700, text: 'Still “sending…”, so the browser reconnects…' },
  { at: 5000, text: 'and sends the same message again.' },
  { at: 6300, text: '' },
  { at: 7300, text: '' },
];
lengths.retry = 11000;
still.retry = 9000;
const retry = computed(() => {
  const now = clock.value;
  const step = retrySteps.filter(s => now >= s.at).length;
  const p = i => clamp01((now - retrySteps[i].at) / 900);
  const twice = !withIds.value && step >= 6;
  return {
    step,
    p,
    note: step === 0 ? 'A visitor on a train.' : step >= 6
      ? (withIds.value ? (step >= 7 ? 'Acked. One message, even though it was sent twice.' : 'Retry ID 7f3a is already saved, so it just acks.') : (step >= 7 ? 'Acked, but everyone now sees it twice.' : 'Without an ID, it looks new, so it’s saved again.'))
      : retrySteps[step - 1].text,
    rows: twice ? 2 : step >= 2 ? 1 : 0,
    status: step >= 7 ? 'Sent' : step >= 4 ? 'Reconnecting…' : step >= 1 ? 'Sending…' : '',
  };
});
// the arrows between the two lanes, top to bottom
const lane = { you: 64, room: 296 };
const arrows = [
  { step: 1, y: 40, from: 'you', label: 'send · 7f3a' },
  { step: 3, y: 72, from: 'room', label: 'ack', lost: true },
  { step: 5, y: 112, from: 'you', label: 'send · 7f3a' },
  { step: 7, y: 144, from: 'room', label: 'ack' },
];
const arrowEnd = a => {
  const [x1, x2] = a.from === 'you' ? [lane.you, lane.room] : [lane.room, lane.you];
  const p = retry.value.p(a.step - 1);
  return { x1, x2: x1 + (x2 - x1) * (a.lost ? Math.min(p, 0.5) : p), shown: retry.value.step >= a.step };
};
</script>

<template>
  <figure v-if="figure === 'lobby'" ref="root" class="mf-figure" :class="{ 'mf-preview': preview }">
    <figcaption><strong>Fig. 1</strong> A message through the lobby.</figcaption>
    <div class="mf-panel">
      <svg class="mf-scene" :viewBox="`0 0 360 ${150 + grow}`" role="img" :aria-label="lobby.stage">
        <g v-for="w in windows" :key="w.who" :transform="`translate(${w.x}, 4)`">
          <rect class="mf-win" width="112" :height="142 + grow"/>
          <rect class="mf-title" width="112" height="13"/>
          <text class="mf-title-text" x="5" y="9.5">{{ w.name }} · Messenger</text>
          <rect class="mf-log" x="4" y="17" width="104" :height="84 + grow"/>
          <g v-for="(m, i) in lobby[w.who].log" :key="m.start" :transform="`translate(8, ${27 + i * 19})`">
            <text class="mf-who" :class="{ own: m.who === w.who }">{{ m.who === 'alice' ? 'Alice' : 'Bob' }} says:</text>
            <text class="mf-said" y="9">{{ short(m.text, 24) }}</text>
          </g>
          <rect class="mf-box" :class="{ bad: lobby[w.who].error }" x="4" :y="105 + grow" width="104" height="18"/>
          <text class="mf-said" x="8" :y="117 + grow">{{ short(lobby[w.who].box, 22) }}<tspan v-if="caret && !lobby[w.who].error && lobby[w.who].box" class="mf-caret">|</tspan></text>
          <g v-if="lobby[w.who].error" :transform="`translate(0, ${grow})`">
            <rect class="mf-warn" x="4" y="126" width="104" height="12"/>
            <text class="mf-warn-text" x="8" y="134.5">Keep it friendly!</text>
          </g>
        </g>
        <line class="mf-wire" x1="116" x2="150" :y1="74 + mid" :y2="74 + mid"/>
        <line class="mf-wire" x1="210" x2="244" :y1="74 + mid" :y2="74 + mid"/>
        <g class="mf-room" :class="lobby.room" :transform="`translate(0, ${mid})`">
          <rect x="150" y="38" width="60" height="72" rx="2"/>
          <text class="mf-room-name" x="180" y="52" text-anchor="middle">lobby</text>
          <text class="mf-room-sub" x="180" y="61" text-anchor="middle">Durable Object</text>
          <path class="mf-db" d="M166 70v18c0 3 6 5 14 5s14-2 14-5V70c0 3-6 5-14 5s-14-2-14-5zM166 70c0-3 6-5 14-5s14 2 14 5-6 5-14 5-14-2-14-5z"/>
          <text class="mf-room-sub" x="180" y="86" text-anchor="middle">{{ lobby.saved }} saved</text>
          <text class="mf-verdict" x="180" y="104" text-anchor="middle">{{ lobby.room === 'bad' ? '✗ bad word' : lobby.room === 'saved' ? '✓ saved' : lobby.room === 'check' ? 'checking…' : '' }}</text>
        </g>
        <circle v-for="(pk, i) in lobby.packets" :key="i" class="mf-packet" :class="{ bad: pk.bad }" :cx="packetX(pk)" :cy="74 + mid" r="4"/>
      </svg>
      <p class="mf-note" aria-live="polite">{{ lobby.stage }}</p>
      <div class="mf-buttons">
        <button class="raised mf-button" @click="toggle">{{ playing ? 'Pause' : 'Play' }}</button>
        <button class="raised mf-button" @click="restart">Restart</button>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'sleep'" class="mf-figure">
    <figcaption><strong>Fig. 2</strong> The lobby sleeping between messages.</figcaption>
    <div class="mf-panel">
      <svg class="mf-scene" viewBox="0 0 360 172" role="img" :aria-label="sleep.awake ? 'The lobby is awake' : 'The lobby is asleep, sockets still open'">
        <g v-for="(name, i) in people" :key="name">
          <line class="mf-socket" :x1="58" :x2="150" :y1="sleepY(i)" y2="70"/>
          <rect class="mf-person" x="8" :y="sleepY(i) - 9" width="50" height="18" rx="2"/>
          <text class="mf-person-name" x="33" :y="sleepY(i) + 3" text-anchor="middle">{{ name }}</text>
        </g>
        <circle v-for="(f, i) in sleep.flying" :key="i" class="mf-packet" :cx="58 + (150 - 58) * ease(f.p)" :cy="sleepY(f.who) + (70 - sleepY(f.who)) * ease(f.p)" r="3.5"/>
        <g class="mf-room" :class="sleep.awake ? 'saved' : 'asleep'">
          <rect x="150" y="40" width="64" height="60" rx="2"/>
          <text class="mf-room-name" x="182" y="58" text-anchor="middle">lobby</text>
          <text class="mf-room-sub" x="182" y="70" text-anchor="middle">{{ sleep.awake ? 'in memory' : 'hibernating' }}</text>
          <text v-if="!sleep.awake" class="mf-zzz" x="182" y="88" text-anchor="middle">z z z</text>
          <text v-else class="mf-room-sub" x="182" y="88" text-anchor="middle">awake</text>
        </g>
        <text class="mf-small" x="104" y="134" text-anchor="middle">4 sockets open the whole time</text>
        <g transform="translate(228, 18)">
          <rect class="mf-store" :class="{ gone: !sleep.memory }" width="126" height="54"/>
          <text class="mf-store-title" x="6" y="11">In a variable</text>
          <text v-if="!sleep.memory" class="mf-small" x="6" y="30">gone while it sleeps</text>
          <text v-for="(p, i) in sleep.memory ?? []" :key="p.name" class="mf-small" :x="6 + (i % 2) * 60" :y="26 + Math.floor(i / 2) * 11">{{ p.name }}: {{ p.n }} sent</text>
          <rect class="mf-store" y="62" width="126" height="54"/>
          <text class="mf-store-title" x="6" y="73">In SQLite</text>
          <text v-for="(p, i) in sleep.sqlite" :key="p.name" class="mf-small" :x="6 + (i % 2) * 60" :y="88 + Math.floor(i / 2) * 11">{{ p.name }}: {{ p.n }} sent</text>
        </g>
        <g transform="translate(0, 146)">
          <line class="mf-axis" :x1="tx(0)" :x2="tx(SIM)" y1="10" y2="10"/>
          <rect v-for="([a, b], i) in awakeSpans" :key="i" class="mf-span" :x="tx(a)" y="5" :width="Math.max(0, tx(Math.min(b, sleep.t)) - tx(a))" height="10" :style="{ display: sleep.t > a ? '' : 'none' }"/>
          <line v-for="(s, i) in sends" :key="`s${i}`" class="mf-tick" :class="{ on: sleep.t >= s.t }" :x1="tx(s.t)" :x2="tx(s.t)" y1="2" y2="18"/>
          <line class="mf-cursor" :x1="tx(sleep.t)" :x2="tx(sleep.t)" y1="0" y2="20"/>
          <text class="mf-small" :x="tx(0)" y="26">0 s</text>
          <text class="mf-small" :x="tx(SIM)" y="26" text-anchor="end">{{ SIM }} s</text>
        </g>
      </svg>
      <dl class="mf-readout">
        <div><dt>Connected</dt><dd>{{ sleep.t.toFixed(0) }}<small>s</small></dd></div>
        <div><dt>In memory</dt><dd>{{ sleep.inMemory.toFixed(0) }}<small>s</small></dd></div>
        <div><dt>Room</dt><dd class="word">{{ sleep.awake ? 'Awake' : 'Asleep' }}</dd></div>
      </dl>
      <div class="mf-buttons">
        <button class="raised mf-button" @click="toggle">{{ playing ? 'Pause' : 'Play' }}</button>
        <button class="raised mf-button" @click="restart">Restart</button>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'checks'" class="mf-figure">
    <figcaption><strong>Fig. 3</strong> The checks before a message is saved.</figcaption>
    <div class="mf-panel">
      <div class="mf-track" aria-hidden="true">
        <div v-for="(g, i) in gates" :key="g.label" class="mf-gate" :class="gateState(i)">{{ g.label }}</div>
        <div class="mf-gate saved" :class="{ on: chips.some(c => c.gate === gates.length && c.stopped) }">Saved</div>
        <span v-for="c in chips" :key="c.at" class="mf-chip" :class="{ bad: c.stopped && c.gate < gates.length, good: c.stopped && c.gate === gates.length }"
          :style="{ left: `calc(${(c.pos + 0.5) / (gates.length + 1) * 100}% - 7px)` }"/>
      </div>
      <ul class="mf-results" aria-live="polite">
        <li v-for="m in settled" :key="m.at" :class="{ ok: m.gate === gates.length }">
          <b>{{ m.gate === gates.length ? '✓' : '✗' }}</b><span class="mf-quote">“{{ short(m.text, 34) }}”</span>
          <span class="mf-why">{{ m.gate === gates.length ? 'Saved and sent to everyone.' : gates[m.gate].why }}</span>
        </li>
      </ul>
      <form class="mf-try" @submit.prevent="tryOne">
        <input v-model="draft" maxlength="300" placeholder="Try a message…" aria-label="Try a message">
        <button class="raised mf-button" type="submit">Send</button>
        <button v-if="mine.length" class="raised mf-button" type="button" @click="backToDemo">Demo</button>
      </form>
    </div>
  </figure>

  <figure v-else-if="figure === 'retry'" class="mf-figure">
    <figcaption><strong>Fig. 4</strong> A message sent again after a dropped connection.</figcaption>
    <div class="mf-panel">
      <svg class="mf-scene" viewBox="0 0 360 170" role="img" :aria-label="retry.note">
        <text class="mf-room-name" :x="lane.you" y="12" text-anchor="middle">Your browser</text>
        <text class="mf-room-name" :x="lane.room" y="12" text-anchor="middle">Lobby</text>
        <line class="mf-lane" :x1="lane.you" :x2="lane.you" y1="18" y2="160"/>
        <line class="mf-lane" :x1="lane.room" :x2="lane.room" y1="18" y2="160"/>
        <g v-for="a in arrows" :key="a.step" :style="{ opacity: arrowEnd(a).shown ? 1 : 0 }">
          <line class="mf-arrow" :class="{ lost: a.lost }" :x1="arrowEnd(a).x1" :x2="arrowEnd(a).x2" :y1="a.y" :y2="a.y"/>
          <path v-if="!a.lost" class="mf-head" :d="a.from === 'you' ? `M${arrowEnd(a).x2} ${a.y}l-6 -3.5v7z` : `M${arrowEnd(a).x2} ${a.y}l6 -3.5v7z`"/>
          <text class="mf-small" :x="(lane.you + lane.room) / 2" :y="a.y - 5" text-anchor="middle">{{ a.label }}</text>
          <text v-if="a.lost && retry.p(a.step - 1) >= 0.5" class="mf-lost" :x="(lane.you + lane.room) / 2" :y="a.y + 4" text-anchor="middle">✕</text>
        </g>
        <text v-if="retry.step >= 4" class="mf-small dim" :x="lane.you + 8" y="94">reconnecting…</text>
        <g v-if="retry.step >= 2" :transform="`translate(${lane.room + 6}, 46)`"><rect class="mf-row" width="54" height="12"/><text class="mf-small" x="4" y="9">row 1 · 7f3a</text></g>
        <g v-if="retry.step >= 6" :transform="`translate(${lane.room + 6}, 118)`">
          <rect class="mf-row" :class="withIds ? 'same' : 'dupe'" width="54" height="12"/>
          <text class="mf-small" x="4" y="9">{{ withIds ? 'have 7f3a' : 'row 2 · new' }}</text>
        </g>
      </svg>
      <p class="mf-note" aria-live="polite">{{ retry.note }}</p>
      <div class="mf-chat">
        <span class="mf-chat-title">What everyone sees</span>
        <p v-for="i in retry.rows" :key="i" :class="{ dupe: i === 2 }"><b>Dev says:</b> brb, train’s here</p>
        <p v-if="!retry.rows" class="dim">Nothing yet.</p>
        <span v-if="retry.status" class="mf-status">{{ retry.status }}</span>
      </div>
      <div class="mf-buttons">
        <span class="mf-toggle" role="group" aria-label="Retry IDs">
          <button class="raised mf-button" :class="{ pressed: withIds }" :aria-pressed="withIds" @click="withIds = true; restart()">With retry IDs</button>
          <button class="raised mf-button" :class="{ pressed: !withIds }" :aria-pressed="!withIds" @click="withIds = false; restart()">Without</button>
        </span>
        <button class="raised mf-button" @click="toggle">{{ playing ? 'Pause' : 'Play' }}</button>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.mf-figure { margin: 18px 0 22px; font-family: 'Pixel MS Sans Serif', Tahoma, sans-serif; container-type: inline-size; }
.mf-figure figcaption { margin-bottom: 8px; font-size: 12px; color: var(--muted); }
.mf-figure figcaption strong { color: var(--ink); margin-right: 4px; }
/* sunken like the other figures, with messenger's blues for the windows and the room.
   dark mode swaps them for the chat window's night blues */
.mf-panel {
  --sunk-edge: var(--shadow);
  --mf-win: #eef3fa; --mf-title: #3a6ea5; --mf-log: #fff; --mf-line: #9db4cf; --mf-text: #23344e; --mf-dim: #6f8194;
  --mf-room: #e3edf9; --mf-good: #1baf7a; --mf-bad: #c0392b; --mf-warn: #fff6d9; --mf-warn-text: #765b2e; --mf-packet: #2f74c0;
  padding: 12px; background: var(--paper); border: 2px solid; border-color: var(--edge) var(--sunk-edge) var(--sunk-edge) var(--edge); box-shadow: inset 1px 1px var(--shadow);
}
:root[data-theme="dark"] .mf-panel {
  --sunk-edge: var(--light);
  --mf-win: #1b222d; --mf-title: #24426b; --mf-log: #131922; --mf-line: #3d4f68; --mf-text: #d3deec; --mf-dim: #8a9bb0;
  --mf-room: #1d2a3c; --mf-warn: #3a3018; --mf-warn-text: #ecd9a6; --mf-packet: #7fb2ea;
}
.mf-button { padding: 3px 10px; font: 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--ink); }
.mf-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.mf-toggle { display: inline-flex; flex-wrap: wrap; }
.mf-note { min-height: 1.4em; margin: 8px 0 0; font-size: 13px; line-height: 1.4; }
.mf-scene { display: block; width: 100%; max-width: 620px; margin: 0 auto; }
.mf-scene text { font-family: Tahoma, sans-serif; }
/* the card preview: exactly the frame, the scene taking whatever the status line leaves */
.mf-preview .mf-panel { box-sizing: border-box; display: flex; flex-direction: column; height: 375px; }
.mf-preview .mf-scene { flex: 1; min-height: 0; max-width: none; }
.mf-preview .mf-note { flex: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mf-preview .mf-buttons { display: none; }

/* fig 1 */
.mf-win { fill: var(--mf-win); stroke: var(--mf-line); }
.mf-title { fill: var(--mf-title); }
.mf-title-text { font-size: 7px; font-weight: bold; fill: #fff; }
.mf-log { fill: var(--mf-log); stroke: var(--mf-line); stroke-width: .6; }
.mf-who { font-size: 6px; fill: #315e91; }
.mf-who.own { fill: #507b38; }
:root[data-theme="dark"] .mf-who { fill: #83b3e8; }
:root[data-theme="dark"] .mf-who.own { fill: #94cf74; }
.mf-said { font-size: 7px; fill: var(--mf-text); }
.mf-caret { fill: var(--mf-packet); }
.mf-box { fill: var(--mf-log); stroke: var(--mf-line); }
.mf-box.bad { stroke: var(--mf-bad); }
.mf-warn { fill: var(--mf-warn); }
.mf-warn-text { font-size: 6.5px; fill: var(--mf-warn-text); }
.mf-wire { stroke: var(--mf-line); stroke-width: 2; stroke-dasharray: 3 2; }
.mf-room rect { fill: var(--mf-room); stroke: var(--mf-line); stroke-width: 1.2; transition: fill .2s, stroke .2s; }
.mf-room.check rect { stroke: var(--mf-packet); }
.mf-room.saved rect { stroke: var(--mf-good); }
.mf-room.bad rect { stroke: var(--mf-bad); }
.mf-room.asleep rect { opacity: .55; }
.mf-room-name { font-size: 8px; font-weight: bold; fill: var(--mf-text); }
.mf-room-sub { font-size: 6px; fill: var(--mf-dim); }
.mf-db { fill: var(--mf-log); stroke: var(--mf-dim); stroke-width: .8; }
.mf-verdict { font-size: 6.5px; font-weight: bold; fill: var(--mf-dim); }
.mf-room.saved .mf-verdict { fill: var(--mf-good); }
.mf-room.bad .mf-verdict { fill: var(--mf-bad); }
.mf-packet { fill: var(--mf-packet); stroke: var(--paper); stroke-width: 1; }
.mf-packet.bad { fill: var(--mf-bad); }

/* fig 2 */
.mf-socket { stroke: var(--mf-line); stroke-width: 1.2; }
.mf-person { fill: var(--mf-win); stroke: var(--mf-line); }
.mf-person-name { font-size: 7px; fill: var(--mf-text); }
.mf-zzz { font-size: 9px; font-weight: bold; fill: var(--mf-dim); letter-spacing: 1px; }
.mf-small { font-size: 6.5px; fill: var(--mf-text); }
.mf-small.dim { fill: var(--mf-dim); font-style: italic; }
.mf-store { fill: var(--mf-log); stroke: var(--mf-line); }
.mf-store.gone { stroke-dasharray: 3 2; opacity: .7; }
.mf-store-title { font-size: 7px; font-weight: bold; fill: var(--mf-text); }
.mf-axis { stroke: var(--mf-line); }
.mf-span { fill: var(--mf-packet); opacity: .3; }
.mf-tick { stroke: var(--mf-dim); stroke-width: 1; opacity: .4; }
.mf-tick.on { stroke: var(--mf-packet); opacity: 1; stroke-width: 1.5; }
.mf-cursor { stroke: var(--ink); stroke-width: 1; }
.mf-readout { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 10px 0 0; }
.mf-readout > div { padding: 5px 8px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); }
.mf-readout dt { font: 11px Tahoma, sans-serif; color: var(--muted); }
.mf-readout dd { margin: 2px 0 0; font: bold 17px 'Courier New', monospace; }
.mf-readout dd.word { font-size: 15px; }
.mf-readout dd small { margin-left: 4px; font: 11px Tahoma, sans-serif; color: var(--muted); }

/* fig 3: the gates in a row, with a chip for each message walking through them */
.mf-track { position: relative; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; padding: 22px 0 6px; }
.mf-gate { padding: 6px 2px; text-align: center; font: 10px Tahoma, sans-serif; color: var(--mf-text); background: var(--mf-room); border: 1px solid var(--mf-line); transition: background .15s, border-color .15s; overflow-wrap: anywhere; }
.mf-gate.on { border-color: var(--mf-packet); }
.mf-gate.no { background: var(--mf-bad); border-color: var(--mf-bad); color: #fff; }
.mf-gate.saved.on { background: var(--mf-good); border-color: var(--mf-good); color: #fff; }
.mf-chip { position: absolute; top: 4px; width: 14px; height: 12px; background: var(--mf-packet); border: 1px solid var(--paper); border-radius: 2px; }
.mf-chip.bad { background: var(--mf-bad); }
.mf-chip.good { background: var(--mf-good); }
.mf-results { min-height: 92px; margin: 8px 0 0; padding: 0; list-style: none; font-size: 12px; }
.mf-results li { display: grid; grid-template-columns: 14px minmax(0, auto) minmax(0, 1fr); gap: 6px; padding: 3px 0; color: var(--ink); }
.mf-results b { color: var(--mf-bad); }
.mf-results li.ok b { color: var(--mf-good); }
.mf-quote { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
.mf-why { color: var(--muted); }
.mf-try { display: flex; gap: 6px; margin-top: 8px; }
.mf-try input { flex: 1; min-width: 0; padding: 3px 6px; font: 12px Tahoma, sans-serif; color: var(--ink); background: var(--paper); border: 2px solid; border-color: var(--shadow) var(--light) var(--light) var(--shadow); }
@container (max-width: 460px) {
  .mf-gate { font-size: 8px; }
  .mf-results li { grid-template-columns: 14px minmax(0, 1fr); }
  .mf-why { grid-column: 2; }
}

/* fig 4 */
.mf-lane { stroke: var(--mf-line); stroke-width: 1.5; stroke-dasharray: 4 3; }
.mf-arrow { stroke: var(--mf-packet); stroke-width: 1.8; }
.mf-arrow.lost { stroke: var(--mf-bad); }
.mf-head { fill: var(--mf-packet); }
.mf-lost { font-size: 12px; font-weight: bold; fill: var(--mf-bad); }
.mf-row { fill: var(--mf-room); stroke: var(--mf-good); }
.mf-row.same { stroke: var(--mf-good); stroke-dasharray: 2 1.5; }
.mf-row.dupe { stroke: var(--mf-bad); }
.mf-chat { position: relative; margin-top: 8px; padding: 8px 10px; min-height: 52px; background: var(--mf-log); border: 1px solid var(--mf-line); font: 12px Tahoma, sans-serif; color: var(--mf-text); }
.mf-chat p { margin: 4px 0 0; }
.mf-chat p.dupe { color: var(--mf-bad); }
.mf-chat .dim { color: var(--mf-dim); }
.mf-chat-title { font-size: 10px; color: var(--mf-dim); }
.mf-status { position: absolute; top: 8px; right: 10px; font-size: 10px; color: var(--mf-dim); }
@media (prefers-reduced-motion: reduce) { .mf-room rect, .mf-gate { transition: none; } }
</style>
