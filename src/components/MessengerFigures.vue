<script setup>
// the figures in the fishbowl writeup (content.mjs, figures), drawn like the pond: a
// grid of little squares with letters in them (figure-pixels.js), the lobby a tank of water
// with a koi living in it that swims by the pond's own rules (figure-koi.js), and every
// message a labelled node moving between things, green when it's saved and red when it's
// turned down. fig 1 has two visitors chatting through the lobby, fig 2 the lobby
// sleeping between messages while every socket stays open, fig 3 the checks a message
// swims through on its way in, and fig 4 a resend after a dropped connection. the rules
// follow worker/chat-room.mjs and worker/chat-rules.mjs, and fig 3 uses the real
// profanity filter from names.mjs
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { profane } from '../names.mjs';
import { reducedMotion, useInView } from '../in-view.js';
import { createSwimmer, rest, swimToward, wander } from '../figure-koi.js';
import { CELL, pixelCanvas, wrap } from '../figure-pixels.js';
import { theme } from '../theme.js';

const props = defineProps({ figure: { type: String, required: true } });

// each figure is a little simulation stepped every frame while it's on screen. it moves
// on when its messages and koi get somewhere, not on a timetable.
// with reduced motion it runs to the end at once and shows that frame
const tick = ref(0);
const playing = ref(false);
const root = ref(null);
const inView = useInView(root);
let sim;
let raf, last;
let held = false; // paused with the button, so scrolling back doesn't start it again
function build() { sim = { lobby: lobbySim, sleep: sleepSim, checks: checksSim, retry: retrySim }[props.figure](); tick.value++; }
function frame(now) {
  const dt = last === undefined ? 0 : Math.min(0.05, (now - last) / 1000);
  last = now;
  sim.step(dt);
  tick.value++;
  raf = requestAnimationFrame(frame);
}
function play() { if (playing.value) return; playing.value = true; last = undefined; raf = requestAnimationFrame(frame); }
function pause() { playing.value = false; cancelAnimationFrame(raf); }
function toggle() { held = playing.value; if (playing.value) pause(); else play(); }
function restart() { build(); held = false; play(); }
function finish() { for (let i = 0; i < 4000 && !sim.done; i++) sim.step(1 / 30); tick.value++; }
watch(inView, on => { if (reducedMotion() || held) return; if (on) play(); else pause(); });
onMounted(() => { if (reducedMotion()) finish(); });
onBeforeUnmount(() => cancelAnimationFrame(raf));
// a fresh copy each frame, so the text around the figure keeps up with it
const view = computed(() => (tick.value, { ...sim.view() }));

// the figure's canvas, cols × rows squares, redrawn after each step
const sizes = { lobby: [64, 32], sleep: [64, 34], checks: [64, 16], retry: [64, 33] };
const [COLS, ROWS] = sizes[props.figure];
const canvas = ref(null);
let px;
watch([tick, theme, canvas], () => {
  if (!canvas.value) return;
  px ??= pixelCanvas(canvas.value, COLS, ROWS);
  if (px.begin(theme.value === 'dark')) paint[props.figure](px, sim.view());
}, { flush: 'post' });

const clamp01 = p => Math.min(1, Math.max(0, p));
const col = x => Math.floor(x / CELL);
// a square tank, from square (c0, r0) to (c1, r1), with its middle and edges in px
function tank(c0, r0, c1, r1) {
  return { c0, r0, c1, r1, cx: (c0 + c1 + 1) / 2 * CELL, cy: (r0 + r1 + 1) / 2 * CELL, left: c0 * CELL, right: (c1 + 1) * CELL, top: r0 * CELL, bottom: (r1 + 1) * CELL };
}
// a message node ({ x, y, to }) slides straight toward to at speed px a second. true
// once it's there
const NODE = 200;
function slide(p, dt, speed = NODE) {
  const dx = p.to.x - p.x, dy = p.to.y - p.y, d = Math.hypot(dx, dy), go = speed * dt;
  if (d <= go) { p.x = p.to.x; p.y = p.to.y; return true; }
  p.x += dx / d * go;
  p.y += dy / d * go;
  return false;
}
// the koi living in a tank: one small and two tiny, spread about its middle
function school(t, small) {
  return [small, small * 0.65, small * 0.65].map((length, i) => createSwimmer(length, t.cx + (i - 1) * small * 0.5, t.cy + 20 + i * 10, i % 2 ? 0 : Math.PI, { pace: 0.25 }));
}
// a tank's name and what's going on in it, stacked over its top edge
const labelRow = (px, i) => 0.3 + i * (px.step > 1 ? 2.1 : 1.2);
// a chat window: a title bar, the messages in it newest at the bottom, and its typing box
function chatWindow(px, c0, r0, c1, r1, title, log, box, { error = false, caret = false, status = '' } = {}) {
  const width = c1 - c0 - 1;
  const letters = px.fits(width) - 1;
  px.box(c0, r0, c1, r1);
  px.text(c0 + 1, r0 + 1, title, 'titleText', { fill: 'title', span: width });
  const lines = log.flatMap(m => [{ str: `${m.name} says:`, ink: m.own ? 'own' : 'who' }, ...wrap(m.text, letters).map(str => ({ str, bold: false }))]);
  const room = Math.floor(((box === null ? r1 - 2 : r1 - 6) - (r0 + 3)) / px.step);
  lines.slice(-room).forEach((l, i) => px.text(c0 + 1, r0 + 3 + i * px.step, l.str, l.ink ?? 'text', { bold: l.bold ?? true }));
  if (box !== null) {
    px.box(c0 + 1, r1 - 5, c1 - 1, r1 - 3, { edge: error ? 'bad' : 'line' });
    const shown = [...box].slice(-(letters - 3)).join('');
    px.text(c0 + 2, r1 - 4, shown + (caret ? '|' : ''), 'text', { bold: false });
    if (error) px.text(c0 + 1, r1 - 1, 'Keep it friendly!', 'warnText', { fill: 'warn', span: width });
  }
  if (status) px.text(c0 + 2, r1 - 2, status, 'dim');
}

// ---- fig 1, lobby: nemo and dory chat through the room. each message leaves its box
// for the lobby, where the koi looks it over. dory's bad word goes back to dory's box,
// gets fixed and is sent again ----
const lobbyTank = tank(20, 6, 43, 30);
const lobbyWindows = { nemo: { name: 'Nemo', cols: [0, 17] }, dory: { name: 'Dory', cols: [46, 63] } };
const winX = who => (lobbyWindows[who].cols[0] + lobbyWindows[who].cols[1] + 1) / 2 * CELL;
// where a message leaves from (the typing box) and lands (the chat log) in a window
const boxAt = who => ({ x: winX(who), y: 26 * CELL });
const logAt = who => ({ x: winX(who), y: 12 * CELL });
const beats = [
  { who: 'nemo', text: 'glub glub?' },
  { who: 'dory', text: 'glub glub glub!' },
  { who: 'dory', text: 'glub glub sh1t', rejected: true },
  { who: 'dory', keep: 'glub glub ', text: 'glub glub blub' },
  { who: 'nemo', text: 'blub blub, glub glub glub' },
];
const KEY = 0.055;
// what's in each box when a beat starts, so an edit can backspace to what it keeps
{
  let box = { nemo: '', dory: '' };
  for (const b of beats) { b.before = box[b.who]; b.keep ??= ''; box = { ...box, [b.who]: b.rejected ? b.text : '' }; }
}
function typed(b, n) {
  const deletes = b.before.length - b.keep.length;
  if (n < deletes) return b.before.slice(0, b.before.length - n);
  return b.text.slice(0, b.keep.length + Math.min(b.text.length - b.keep.length, n - deletes));
}
function lobbySim() {
  const fresh = () => ({
    time: 0, at: 0, beat: 0, stage: 'wait', box: { nemo: '', dory: '' }, error: { nemo: false, dory: false }, logs: { nemo: [], dory: [] }, nodes: [], room: 'idle', saved: 0, note: 'Two visitors in the lobby.',
    koi: school(lobbyTank, 220),
  });
  let s = fresh();
  const name = who => lobbyWindows[who].name;
  const middle = { x: lobbyTank.cx, y: lobbyTank.cy - 20 };
  const roam = { cx: lobbyTank.cx, cy: lobbyTank.cy, r: 95 };
  return {
    get done() { return s.stage === 'end'; },
    step(dt) {
      s.time += dt;
      const b = beats[s.beat];
      const since = s.time - s.at;
      const next = stage => { s.stage = stage; s.at = s.time; };
      // the small koi goes to look each message over, and the tiny ones carry on
      s.koi.forEach((k, i) => { if (i || s.stage !== 'check') wander(k, dt, roam); });
      if (s.stage === 'wait' && since > 0.5) next('typing');
      else if (s.stage === 'typing') {
        s.error[b.who] = false;
        const keys = (b.before.length - b.keep.length) + (b.text.length - b.keep.length);
        const n = Math.floor(since / KEY);
        s.box[b.who] = typed(b, n);
        s.note = `${name(b.who)} is typing.`;
        if (n > keys + 4) {
          s.box[b.who] = '';
          s.nodes = [{ ...boxAt(b.who), to: middle, ink: 'accent', label: b.text }];
          s.note = 'Sent over the WebSocket to the lobby.';
          next('in');
        }
      } else if (s.stage === 'in') {
        if (slide(s.nodes[0], dt)) {
          s.room = 'check';
          s.note = 'The lobby checks it…';
          next('check');
        }
      } else if (s.stage === 'check') {
        const p = s.nodes[0];
        const there = swimToward(s.koi[0], p.x, p.y + 14, dt);
        if (since > 0.8 && (there || since > 2.5)) {
          if (b.rejected) {
            s.room = 'bad';
            Object.assign(p, { ink: 'bad', to: boxAt(b.who), who: b.who, bad: true });
            s.note = 'That’s a bad word, so it’s turned down and sent back to Dory only.';
          } else {
            s.room = 'saved';
            s.saved++;
            s.nodes = ['nemo', 'dory'].map(who => ({ ...p, ink: 'good', to: logAt(who), who }));
            s.note = 'Saved to SQLite and sent to everyone in the room, Nemo and Dory both.';
          }
          next('out');
        }
      } else if (s.stage === 'out') {
        for (const p of s.nodes) {
          if (p.home || !slide(p, dt)) continue;
          p.home = true;
          if (p.bad) { s.box[p.who] = b.text; s.error[p.who] = true; } else s.logs[p.who] = [...s.logs[p.who], b].slice(-4);
        }
        s.nodes = s.nodes.filter(p => !p.home);
        if (!s.nodes.length) {
          s.note = b.rejected ? 'Dory’s message is back in the box to fix. Nemo never saw it.' : 'Delivered.';
          next('hold');
        }
      } else if (s.stage === 'hold' && since > 0.9) {
        s.room = 'idle';
        if (s.beat < beats.length - 1) { s.beat++; next('typing'); } else { s.note = 'One message turned down, four delivered.'; next('end'); }
      } else if (s.stage === 'end' && since > 2.5) s = fresh();
    },
    view: () => s,
  };
}
const roomInk = { idle: 'line', check: 'accent', saved: 'good', bad: 'bad' };
function paintLobby(px, v) {
  for (const [who, w] of Object.entries(lobbyWindows)) {
    const log = v.logs[who].map(m => ({ name: lobbyWindows[m.who].name, text: m.text, own: m.who === who }));
    chatWindow(px, w.cols[0], 1, w.cols[1], 30, w.name, log, v.box[who], { error: v.error[who], caret: Math.floor(v.time / 0.45) % 2 === 0 && !v.error[who] && v.box[who] });
  }
  const b = lobbyTank;
  px.text(col(b.cx), labelRow(px, 0), 'lobby', 'text', { centre: true, bold: true });
  px.text(col(b.cx), labelRow(px, 1), `${v.saved} saved`, 'dim', { centre: true });
  const verdict = { bad: '✗ bad word', saved: '✓ saved', check: 'checking…' }[v.room];
  if (verdict) px.text(col(b.cx), labelRow(px, 2), verdict, roomInk[v.room], { centre: true, bold: true });
  px.tank(b, roomInk[v.room]);
  for (const k of v.koi) px.koi(k, { within: b });
  for (const p of v.nodes) px.node(p.x, p.y, p.label, p.ink, { max: 16 });
}

// ---- fig 2, sleep: the room is only in memory while there's something to do. between
// bursts it hibernates, every socket stays open, and anything kept in a variable is gone ----
const SIM = 40, RATE = 3.2, IDLE = 10;
const people = ['Nemo', 'Dory', 'Marlin', 'Gill'];
const sends = [[2, 0], [4, 1], [5.5, 0], [7, 3], [22, 2], [23.5, 1], [25, 0], [26.5, 1]].map(([t, who]) => ({ t, who }));
const sleepTank = tank(18, 4, 39, 25);
const personY = i => (5 + i * 6) * CELL + CELL / 2;
const socketEnd = sleepTank.left;
const tx = t => 15 + t / SIM * 610;
function sleepSim() {
  const fresh = () => ({
    t: 0, wait: 0, sent: 0, nodes: [], landed: [], spans: [], inMemory: 0,
    // the room's own koi, swimming about while it's awake and resting on the bottom
    // while it sleeps
    room: school(sleepTank, 200),
  });
  let s = fresh();
  const inTank = { cx: sleepTank.cx, cy: sleepTank.cy, r: 85 };
  const bed = i => ({ x: sleepTank.cx + (i - 1) * 60, y: sleepTank.bottom - 30 });
  const awake = () => s.spans.length > 0 && s.t < s.spans.at(-1)[1];
  const count = list => people.map((name, i) => ({ name, n: list.filter(l => l.who === i).length })).filter(p => p.n);
  return {
    get done() { return s.t >= SIM; },
    step(dt) {
      if (s.t >= SIM) { s.wait += dt; if (s.wait > 2.5) s = fresh(); return; }
      s.t = Math.min(SIM, s.t + dt * RATE);
      while (s.sent < sends.length && sends[s.sent].t <= s.t) {
        const { who } = sends[s.sent++];
        s.nodes.push({ who, x: 100, y: personY(who), to: { x: socketEnd + 30, y: sleepTank.cy }, fade: 1 });
      }
      for (const p of s.nodes) {
        // in the tank it joins the room and fades away
        if (p.landed) { p.fade -= dt / 0.5; continue; }
        if (!slide(p, dt, 160)) continue;
        p.landed = true;
        s.landed.push({ t: s.t, who: p.who });
        // a message wakes the room, and each one keeps it up IDLE seconds longer
        const span = s.spans.at(-1);
        if (span && s.t <= span[1]) span[1] = s.t + IDLE; else s.spans.push([s.t, s.t + IDLE]);
      }
      s.nodes = s.nodes.filter(p => p.fade > 0);
      if (awake()) {
        s.inMemory += dt * RATE;
        for (const k of s.room) wander(k, dt, inTank);
      } else s.room.forEach((k, i) => { if (swimToward(k, bed(i).x, bed(i).y, dt * 0.6)) rest(k, dt); });
    },
    view() {
      const on = awake();
      const woke = s.spans.at(-1)?.[0];
      return {
        ...s, awake: on,
        memory: on ? count(s.landed.filter(l => l.t >= woke)) : null,
        sqlite: count(s.landed),
        spans: s.spans.map(([a, b]) => [a, Math.min(b, s.t)]),
      };
    },
  };
}
function paintSleep(px, v) {
  people.forEach((name, i) => {
    const row = col(personY(i));
    px.line(100, personY(i), socketEnd, sleepTank.cy, 'line');
    px.box(0, row - 1, 9, row + 1);
    px.text(5, row, name, 'text', { centre: true });
  });
  px.text(0, 27, '4 sockets open the whole time', 'text');
  const b = sleepTank;
  px.text(col(b.cx), labelRow(px, 0), 'lobby', 'text', { centre: true, bold: true });
  px.text(col(b.cx), labelRow(px, 1), v.awake ? 'awake, in memory' : 'hibernating', 'dim', { centre: true });
  px.tank(b, v.awake ? 'good' : 'line', { dim: v.awake ? 1 : 0.5 });
  for (let c = b.c0 + 1; c < b.c1; c++) px.cell(c, b.r1 - 1, 'gravel', c % 3 ? 'o' : '.', 'dim', 0.8);
  for (const k of v.room) px.koi(k, { within: b });
  if (!v.awake) {
    const [k] = v.room;
    for (let z = 1; z <= 3; z++) px.cell(col(k.x) + 1 + z, col(k.y) - 2 - z - Math.floor((v.t + v.wait) % 3), null, 'z', 'dim', 1 - z * 0.2);
  }
  for (const p of v.nodes) px.node(p.x, p.y, people[p.who][0], 'accent', { alpha: clamp01(p.fade) });
  // what the room remembers: a variable, gone while it sleeps, and SQLite, kept
  px.box(42, 4, 63, 13, { alpha: v.memory ? 1 : 0.55 });
  px.text(44, 5, 'In a variable', 'text', { bold: true });
  if (!v.memory) px.text(44, 5 + px.step * 1.5, px.fits(19) >= 20 ? 'gone while it sleeps' : 'gone', 'dim');
  (v.memory ?? []).forEach((p, i) => px.text(44 + (i % 2) * 10, 5 + px.step * (1.5 + Math.floor(i / 2)), `${p.name} ${p.n}`, 'text', { bold: false }));
  px.box(42, 15, 63, 24);
  px.text(44, 16, 'In SQLite', 'text', { bold: true });
  v.sqlite.forEach((p, i) => px.text(44 + (i % 2) * 10, 16 + px.step * (1.5 + Math.floor(i / 2)), `${p.name} ${p.n}`, 'text', { bold: false }));
  // the timeline: when the room was awake, each message, and now
  for (let c = col(tx(0)); c <= col(tx(SIM)); c++) px.cell(c, 30, null, '-', 'line');
  for (const [a, b2] of v.spans) for (let c = col(tx(a)); c <= col(tx(b2)); c++) px.cell(c, 30, 'accent', null, null, 0.35);
  for (const m of sends) for (let r = 29; r <= 31; r++) px.cell(col(tx(m.t)), r, null, '|', v.t >= m.t ? 'accent' : 'line', v.t >= m.t ? 1 : 0.6);
  for (let r = 28; r <= 32; r++) px.cell(col(tx(v.t)), r, null, '|', 'text');
  px.text(1, 33, '0 s', 'dim');
  px.text(59, 33, `${SIM} s`, 'dim');
}

// ---- fig 3, checks: a message runs down a track past each of the lobby's checks in
// turn, stopping at the one that turns it down, or on into the lobby's tank ----
const gates = [
  { label: ['250', 'chars'], why: 'Messages can be up to 250 characters.' },
  { label: ['No bad', 'words'], why: 'Keep it friendly! That message wasn’t sent.' },
  { label: ['Slow', 'mode'], why: 'Slow down! Please wait before sending another message.' },
  { label: ['20 a', 'minute'], why: 'Slow down! Please wait before sending another message.' },
  { label: ['Not a', 'repeat'], why: 'You already sent that message. Say something new!' },
];
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
// a fish with a lot to say, past the 250 character limit
const longOne = `${'glub '.repeat(52)}blub?`;
const demo = run([
  { text: 'glub glub!', at: 600 },
  { text: 'glub glub!', at: 2200 },
  { text: 'glub glub!', at: 5400 },
  { text: 'glub sh1t glub', at: 8600 },
  { text: longOne, at: 11800 },
  { text: 'blub blub, glub', at: 15000 },
]);
const DEMO_END = 19000;
// the checks stand nine squares apart along the track, with the lobby's tank at its end
const LANE = 45;
const colX = i => (4.5 + i * 9) * CELL;
const savedTank = tank(45, 0, 63, 15);
const mine = ref(false);
const draft = ref('');
function checksSim(own = false) {
  const s = {
    time: 0, messages: own ? [] : demo.map(m => ({ ...m })), nodes: [], settled: [], flashes: [],
    koi: school(savedTank, 150),
  };
  const restartDemo = () => Object.assign(s, { time: 0, messages: demo.map(m => ({ ...m })), settled: [], flashes: [] });
  return {
    get done() { return !own && s.time >= 18000 && !s.nodes.length; },
    // your own message, judged against the ones you've already sent
    send(text) {
      const judged = run([...s.messages.map(({ text: t, at }) => ({ text: t, at })), { text, at: s.time }]);
      s.messages = judged.map((m, i) => ({ ...m, spawned: s.messages[i]?.spawned })).slice(-12);
    },
    step(dt) {
      s.time += dt * 1000;
      for (const k of s.koi) wander(k, dt, { cx: savedTank.cx, cy: savedTank.cy + 10, r: 35 });
      for (const m of s.messages) {
        if (m.spawned || s.time < m.at) continue;
        m.spawned = true;
        s.nodes.push({ m, x: -40, y: LANE, to: { x: colX(0), y: LANE }, next: 0, state: 'move', fade: 1 });
      }
      for (const p of s.nodes) {
        const { m } = p;
        if (p.state === 'move') {
          // up to each gate in turn, stopping at the one that turns it down, or on into
          // the saved tank
          if (!slide(p, dt, 160)) continue;
          if (p.next === gates.length) {
            p.state = 'saved';
            s.settled.push(m);
            s.flashes.push({ gate: gates.length, at: s.time, ok: true });
          } else if (p.next === m.gate) {
            Object.assign(p, { state: 'stopped', at: s.time });
            s.settled.push(m);
            s.flashes.push({ gate: m.gate, at: s.time });
          } else {
            s.flashes.push({ gate: p.next, at: s.time, ok: true });
            p.next++;
            p.to = p.next === gates.length ? { x: savedTank.cx, y: LANE } : { x: colX(p.next), y: LANE };
          }
        } else if (p.state === 'stopped') {
          if (s.time - p.at > 600) { p.state = 'back'; p.to = { x: p.x - 60, y: LANE }; }
        } else if (p.state === 'back') {
          slide(p, dt, 60);
          p.fade -= dt / 1;
        } else if (p.state === 'saved') p.fade -= dt / 0.9;
      }
      s.nodes = s.nodes.filter(p => p.fade > 0);
      s.flashes = s.flashes.filter(fl => s.time - fl.at < (fl.ok ? 700 : 1400));
      if (!own && s.time > DEMO_END && !s.nodes.length) restartDemo();
    },
    view() {
      const state = i => {
        const flash = s.flashes.findLast(fl => fl.gate === i);
        if (flash) return flash.ok ? 'good' : 'bad';
        return s.nodes.some(p => p.state === 'move' && p.next === i) ? 'accent' : '';
      };
      return { koi: s.koi, nodes: s.nodes, settled: s.settled.slice(-4).reverse(), gates: [...gates.map((_, i) => state(i)), state(gates.length)] };
    },
  };
}
const nodeInk = p => (p.state === 'saved' ? 'good' : p.state === 'move' ? 'accent' : 'bad');
function paintChecks(px, v) {
  // the track, each check standing beside it, and the lobby's tank at its end
  const lane = col(LANE);
  for (let c = 0; c < savedTank.c0; c++) px.cell(c, lane, null, '-', 'line', 0.7);
  gates.forEach((g, i) => {
    const state = v.gates[i];
    const ink = state || 'line';
    const cx = col(colX(i));
    for (let row = lane - 1; row <= lane + 1; row++) px.cell(cx, row, null, '|', ink);
    px.cell(cx, lane + 2, null, ':', ink, 0.7);
    px.box(cx - 4, lane + 3, cx + 4, 14, { edge: ink });
    // lit up as a message gets there, green as it passes and red where it's turned back
    const words = state && state !== 'accent' ? state : 'text';
    const mid = (lane + 4 + 13) / 2, gap = px.step * 1.1;
    g.label.forEach((line, j) => px.text(cx, mid + (j - (g.label.length - 1) / 2) * gap, line, words, { centre: true }));
  });
  const t = savedTank;
  px.tank(t, v.gates[gates.length] || 'line');
  px.text(col(t.cx), 1.5, 'lobby', 'text', { centre: true });
  for (const k of v.koi) px.koi(k, { within: t });
  for (const p of v.nodes) px.node(p.x, p.y, p.m.text, nodeInk(p), { alpha: clamp01(p.fade), max: 8 });
}
function tryOne() {
  if (!draft.value.trim()) return;
  // your own messages run on the real clock, so the slow mode and repeat checks are real
  if (!mine.value) { mine.value = true; sim = checksSim(true); }
  sim.send(draft.value);
  draft.value = '';
  held = false;
  play();
}
function backToDemo() { mine.value = false; restart(); }

// ---- fig 4, retry: the ack is lost when the connection drops, so the browser sends
// again with the same retry id ----
const withIds = ref(true);
const retryTank = tank(30, 4, 63, 31);
const WIRE_Y = 165;
const BROWSER = 180; // the browser window's right edge
const wireEnd = retryTank.left;
// where each saved copy sits in the lobby
const slot = i => ({ x: retryTank.cx, y: WIRE_Y - 15 + i * 40 });
function retrySim() {
  const ids = withIds.value;
  const fresh = () => ({
    time: 0, at: 0, stage: 'start', nodes: [], kept: [], splashes: [], broken: false, status: '', note: 'A visitor on a train.',
    koi: school(retryTank, 230),
  });
  let s = fresh();
  const tag = ids ? '7f3a' : 'msg';
  const send = to => ({ x: BROWSER + 20, y: WIRE_Y, to, label: tag, ink: 'accent' });
  const ack = () => ({ x: wireEnd + 20, y: WIRE_Y, to: { x: BROWSER + 20, y: WIRE_Y }, label: 'ack', ink: 'good' });
  const splash = (x, y) => s.splashes.push({ x, y, age: 0 });
  const roam = { cx: retryTank.cx, cy: retryTank.cy + 30, r: 100 };
  return {
    get done() { return s.stage === 'end'; },
    step(dt) {
      s.time += dt;
      const since = s.time - s.at;
      const next = stage => { s.stage = stage; s.at = s.time; };
      for (const k of s.koi) wander(k, dt, roam);
      for (const sp of s.splashes) sp.age += dt;
      s.splashes = s.splashes.filter(sp => sp.age < 1.2);
      const p = s.nodes[0];
      if (s.stage === 'start' && since > 0.6) {
        s.nodes = [send(slot(0))];
        s.status = 'Sending…';
        s.note = ids ? 'Send “glub glub, brb” with retry ID 7f3a.' : 'Send “glub glub, brb”.';
        next('send');
      } else if (s.stage === 'send' && slide(p, dt)) {
        s.kept.push({ ...p, label: ids ? '7f3a' : 'row 1', ink: 'good' });
        s.nodes = [];
        s.note = 'The lobby saves it and sends it to everyone.';
        next('saved');
      } else if (s.stage === 'saved' && since > 0.9) {
        s.nodes = [ack()];
        s.note = 'It sends an ack back…';
        next('ack');
      } else if (s.stage === 'ack') {
        slide(p, dt);
        if (p.x < (BROWSER + wireEnd) / 2) {
          splash(p.x, p.y);
          s.nodes = [];
          s.broken = true;
          s.note = 'The connection drops before the ack gets back.';
          next('dropped');
        }
      } else if (s.stage === 'dropped' && since > 1.3) {
        s.status = 'Reconnecting…';
        s.note = 'Still “sending…”, so the browser reconnects…';
        next('reconnect');
      } else if (s.stage === 'reconnect' && since > 1.3) {
        s.broken = false;
        // with an id it heads for the copy that's already saved, without one for a new row
        s.nodes = [send(ids ? slot(0) : slot(1))];
        s.note = 'and sends the same message again.';
        next('resend');
      } else if (s.stage === 'resend' && slide(p, dt)) {
        s.nodes = [];
        if (ids) {
          splash(p.x, p.y);
          s.note = 'Retry ID 7f3a is already saved, so it just acks.';
        } else {
          s.kept.push({ ...p, label: 'row 2', ink: 'bad' });
          s.note = 'Without an ID, it looks new, so it’s saved again.';
        }
        next('again');
      } else if (s.stage === 'again' && since > 0.8) {
        s.nodes = [ack()];
        next('ack2');
      } else if (s.stage === 'ack2' && slide(p, dt)) {
        s.nodes = [];
        s.status = 'Sent';
        s.note = ids ? 'Acked. One message, even though it was sent twice.' : 'Acked, but everyone now sees it twice.';
        next('end');
      } else if (s.stage === 'end' && since > 3.5) s = fresh();
    },
    view: () => ({ ...s, rows: s.kept.length }),
  };
}
function paintRetry(px, v) {
  chatWindow(px, 0, 6, 17, 26, 'Dory', v.rows ? [{ name: 'Dory', text: 'glub glub, brb', own: true }] : [], null, { status: v.status });
  const mid = (BROWSER + wireEnd) / 2;
  if (v.broken) {
    px.line(BROWSER, WIRE_Y, mid - 20, WIRE_Y, 'line', { dashed: true });
    px.line(mid + 20, WIRE_Y, wireEnd, WIRE_Y, 'line', { dashed: true });
    px.cell(col(mid), col(WIRE_Y), null, 'X', 'bad');
  } else px.line(BROWSER, WIRE_Y, wireEnd, WIRE_Y, 'line', { dashed: true });
  const b = retryTank;
  const ink = v.rows === 2 ? 'bad' : v.rows ? 'good' : 'line';
  px.text(col(b.cx), labelRow(px, 0), 'lobby', 'text', { centre: true, bold: true });
  px.text(col(b.cx), labelRow(px, 1), `${v.rows} saved`, 'dim', { centre: true });
  px.tank(b, ink);
  for (const k of v.koi) px.koi(k, { within: b });
  // the second copy saved without a retry id is the duplicate, so it's the red one
  for (const k of v.kept) px.node(k.x, k.y, k.label, k.ink);
  for (const p of v.nodes) px.node(p.x, p.y, p.label, p.ink);
  for (const sp of v.splashes) for (const lag of [0, 0.25]) if (sp.age >= lag) px.ring(sp.x, sp.y, 8 + (sp.age - lag) * 50, 'accent', clamp01(1 - (sp.age - lag) / 0.9));
}

watch(withIds, () => restart());

const paint = { lobby: paintLobby, sleep: paintSleep, checks: paintChecks, retry: paintRetry };
build();
</script>

<template>
  <figure ref="root" class="mf-figure">
    <figcaption v-if="figure === 'lobby'"><strong>Fig. 1</strong> A message through the lobby.</figcaption>
    <figcaption v-else-if="figure === 'sleep'"><strong>Fig. 2</strong> The lobby sleeping between messages.</figcaption>
    <figcaption v-else-if="figure === 'checks'"><strong>Fig. 3</strong> The checks before a message is saved.</figcaption>
    <figcaption v-else><strong>Fig. 4</strong> A message sent again after a dropped connection.</figcaption>
    <div class="mf-panel">
      <canvas ref="canvas" class="mf-pond" :style="{ aspectRatio: `${COLS} / ${ROWS}` }" role="img"
        :aria-label="figure === 'sleep' ? (view.awake ? 'The lobby is awake' : 'The lobby is asleep, sockets still open') : figure === 'checks' ? 'Messages swimming through the lobby’s checks' : view.note"/>

      <template v-if="figure === 'lobby'">
        <p class="mf-note" aria-live="polite">{{ view.note }}</p>
        <div class="mf-buttons">
          <button class="raised mf-button" @click="toggle">{{ playing ? 'Pause' : 'Play' }}</button>
          <button class="raised mf-button" @click="restart">Restart</button>
        </div>
      </template>

      <template v-else-if="figure === 'sleep'">
        <dl class="mf-readout">
          <div><dt>Connected</dt><dd>{{ view.t.toFixed(0) }}<small>s</small></dd></div>
          <div><dt>In memory</dt><dd>{{ view.inMemory.toFixed(0) }}<small>s</small></dd></div>
          <div><dt>Room</dt><dd class="word">{{ view.awake ? 'Awake' : 'Asleep' }}</dd></div>
        </dl>
        <div class="mf-buttons">
          <button class="raised mf-button" @click="toggle">{{ playing ? 'Pause' : 'Play' }}</button>
          <button class="raised mf-button" @click="restart">Restart</button>
        </div>
      </template>

      <template v-else-if="figure === 'checks'">
        <ul class="mf-results" aria-live="polite">
          <li v-if="!view.settled.length" class="mf-empty">Each message shows up here with what happened to it.</li>
          <li v-for="m in view.settled" :key="m.at" :class="{ ok: m.gate === gates.length }">
            <b>{{ m.gate === gates.length ? '✓' : '✗' }}</b><span class="mf-quote">“{{ m.text.length > 34 ? `${m.text.slice(0, 33)}…` : m.text }}”</span>
            <span class="mf-why">{{ m.gate === gates.length ? 'Saved and sent to everyone.' : gates[m.gate].why }}</span>
          </li>
        </ul>
        <form class="mf-try" @submit.prevent="tryOne">
          <input v-model="draft" maxlength="300" placeholder="Try a message…" aria-label="Try a message">
          <button class="raised mf-button" type="submit">Send</button>
          <button v-if="mine" class="raised mf-button" type="button" @click="backToDemo">Demo</button>
        </form>
      </template>

      <template v-else>
        <p class="mf-note" aria-live="polite">{{ view.note }}</p>
        <div class="mf-chat">
          <span class="mf-chat-title">What everyone sees</span>
          <p v-for="i in view.rows" :key="i" :class="{ dupe: i === 2 }"><b>Dory says:</b> glub glub, brb</p>
          <p v-if="!view.rows" class="dim">Nothing yet.</p>
        </div>
        <div class="mf-buttons">
          <span class="mf-toggle" role="group" aria-label="Retry IDs">
            <button class="raised mf-button" :class="{ pressed: withIds }" :aria-pressed="withIds" @click="withIds = true">With retry IDs</button>
            <button class="raised mf-button" :class="{ pressed: !withIds }" :aria-pressed="!withIds" @click="withIds = false">Without</button>
          </span>
          <button class="raised mf-button" @click="toggle">{{ playing ? 'Pause' : 'Play' }}</button>
        </div>
      </template>
    </div>
  </figure>
</template>

<style scoped>
.mf-figure { margin: 18px 0 22px; font-family: 'Pixel MS Sans Serif', Tahoma, sans-serif; }
.mf-figure figcaption { margin-bottom: 8px; font-size: 12px; color: var(--muted); }
.mf-figure figcaption strong { color: var(--ink); margin-right: 4px; }
/* sunken like the other figures. the figure itself is one canvas of squares and
   letters, the pond's look, with its words and buttons under it */
.mf-panel {
  --sunk-edge: var(--shadow);
  --mf-line: #9db4cf; --mf-text: #23344e; --mf-dim: #6f8194; --mf-log: #fff; --mf-good: #1baf7a; --mf-bad: #c0392b;
  padding: 12px; background: var(--paper); border: 2px solid; border-color: var(--edge) var(--sunk-edge) var(--sunk-edge) var(--edge); box-shadow: inset 1px 1px var(--shadow);
}
:root[data-theme="dark"] .mf-panel {
  --sunk-edge: var(--light);
  --mf-line: #3d4f68; --mf-text: #d3deec; --mf-dim: #8a9bb0; --mf-log: #131922; --mf-bad: #e05a4a;
}
.mf-pond { display: block; width: 100%; max-width: 680px; margin: 0 auto; }
.mf-button { padding: 3px 10px; font: 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--ink); }
.mf-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.mf-toggle { display: inline-flex; flex-wrap: wrap; }
.mf-note { min-height: 1.4em; margin: 8px 0 0; font-size: 13px; line-height: 1.4; }

/* fig 2's readouts */
.mf-readout { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 10px 0 0; }
.mf-readout > div { padding: 5px 8px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); }
.mf-readout dt { font: 11px Tahoma, sans-serif; color: var(--muted); }
.mf-readout dd { margin: 2px 0 0; font: bold 17px 'Courier New', monospace; }
.mf-readout dd.word { font-size: 15px; }
.mf-readout dd small { margin-left: 4px; font: 11px Tahoma, sans-serif; color: var(--muted); }

/* fig 3's results and the box to try your own */
.mf-results { min-height: 92px; margin: 8px 0 0; padding: 0; list-style: none; font-size: 12px; }
.mf-results li { display: grid; grid-template-columns: 14px minmax(0, auto) minmax(0, 1fr); gap: 6px; padding: 3px 0; color: var(--ink); }
.mf-results b { color: var(--mf-bad); }
.mf-results li.ok b { color: var(--mf-good); }
.mf-quote { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
.mf-why, .mf-empty { color: var(--muted); }
.mf-results li.mf-empty { display: block; }
.mf-try { display: flex; gap: 6px; margin-top: 8px; }
.mf-try input { flex: 1; min-width: 0; padding: 3px 6px; font: 12px Tahoma, sans-serif; color: var(--ink); background: var(--paper); border: 2px solid; border-color: var(--shadow) var(--light) var(--light) var(--shadow); }
@media (max-width: 520px) {
  .mf-results li { grid-template-columns: 14px minmax(0, 1fr); }
  .mf-why { grid-column: 2; }
}

/* fig 4's chat as everyone sees it */
.mf-chat { position: relative; margin-top: 8px; padding: 8px 10px; min-height: 52px; background: var(--mf-log); border: 1px solid var(--mf-line); font: 12px Tahoma, sans-serif; color: var(--mf-text); }
.mf-chat p { margin: 4px 0 0; }
.mf-chat p.dupe { color: var(--mf-bad); }
.mf-chat .dim { color: var(--mf-dim); }
.mf-chat-title { font-size: 10px; color: var(--mf-dim); }
</style>
