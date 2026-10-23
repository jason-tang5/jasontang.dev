<script setup>
// the figures in the fpga 2048 writeup (content.mjs, figures), redrawn from the
// ece241 slides as things to poke at: the board as one 64-bit register, the two
// step slide played one step at a time, and the one-hot keyboard fsm driven by
// wasd. the tiles use the vga's 3-bit colours from twenty48.mjs
import { computed, onBeforeUnmount, ref } from 'vue';
import { emptyBoard, slideLine, tileColor, tileInk, toRegister, value } from '../twenty48.mjs';
defineProps({ figure: { type: String, required: true } });

// ---- register: every tile is 4 bits of one 64-bit register ----
const board = ref([1, 0, 1, 0, 0, 2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 11]);
const focus = ref(10);
const bits = computed(() => board.value.map(p => p.toString(2).padStart(4, '0')));
// click a tile to double it, past 2048 it empties
function bump(i) {
  focus.value = i;
  const next = [...board.value];
  next[i] = next[i] >= 11 ? 0 : next[i] + 1;
  board.value = next;
}
function shuffle() {
  board.value = board.value.map(() => (Math.random() < 0.45 ? 0 : 1 + Math.floor(Math.random() * 11)));
}
const focusRange = computed(() => `[${focus.value * 4 + 3}:${focus.value * 4}]`);
// the 16 nibbles laid out like the board, so each one sits where its tile does
const nibbles = computed(() => bits.value.map((b, i) => ({ i, b })));

// ---- datapath: the block diagram from the slides, redrawn. pick a block to light
// up the buses into and out of it ----
const blocks = {
  rom: { name: 'Sprite ROMs', x: 40, y: 14, w: 70, h: 40, lines: ['ROM'],
    text: 'Each tile, 2 up to 2048, is a little picture kept in on-chip memory. It is read out one pixel at a time from an x and y count (XC, YC) on every clock.' },
  mux11: { name: 'mux11to1', x: 40, y: 96, w: 70, h: 176, lines: ['mux', '11 to 1'],
    text: 'Picks which tile to draw. SW[7:4] chooses one of the 11 sprite memories, and its 3-bit colour goes straight to the VGA adapter.' },
  mux16: { name: 'mux16to1, dual output', x: 160, y: 104, w: 90, h: 70, lines: ['mux16to1', 'dual output'],
    text: 'Turns a cell number, SW[3:0] from 0 to 15, into that cell’s top-left corner on the screen: a 7-bit x and a 6-bit y.' },
  xreg: { name: 'x_reg', x: 290, y: 96, w: 62, h: 34, lines: ['x_reg'],
    text: 'Holds the tile’s x while it is drawn. KEY3 loads it, so a tile only moves when you press the button.' },
  yreg: { name: 'y_reg', x: 290, y: 148, w: 62, h: 34, lines: ['y_reg'],
    text: 'Holds the tile’s y, loaded by KEY3 along with x_reg.' },
  col: { name: 'Column counter', x: 392, y: 96, w: 76, h: 34, lines: ['column', 'counter'],
    text: 'Steps across the tile one pixel at a time, adding its count to x_reg for every pixel plotted.' },
  row: { name: 'Row counter', x: 392, y: 148, w: 76, h: 34, lines: ['row', 'counter'],
    text: 'Moves down a row each time the column counter wraps, adding to y_reg. Together they sweep the whole tile.' },
  vga: { name: 'VGA adapter', x: 504, y: 96, w: 86, h: 96, lines: ['VGA', 'adapter'],
    text: 'Takes an x, a y and a 3-bit colour and plots that pixel into the 160 × 120 frame buffer, on the 50 MHz clock whenever plot is high.' },
  board: { name: 'board', x: 150, y: 246, w: 70, h: 38, lines: ['board'],
    text: 'The 64-bit register holding the whole game, 4 bits a tile (Fig. 1). Its reset is wired to the same switch lines that feed the two muxes.' },
  disp: { name: 'board_display', x: 262, y: 246, w: 96, h: 38, lines: ['board_', 'display'],
    text: 'Splits the register into 4-bit tiles, board[0:3] up to board[60:63], and sends six of them on to the hex displays.' },
  hex: { name: 'hex7seg', x: 400, y: 240, w: 70, h: 50, lines: ['hex7seg'],
    text: 'Turns each 4-bit tile into the 7 segments of a HEX display, HEX5 to HEX0, so we could read the board register straight off the FPGA while debugging.' },
};
// each bus: its path, its width, and the blocks at either end
const buses = [
  { d: 'M75 54V96', label: '11 sprites', lx: 20, ly: 80, ends: ['rom', 'mux11'] },
  { d: 'M100 60V96', label: 'SW[7:4] /4', lx: 104, ly: 66, ends: ['mux11'] },
  { d: 'M110 230H486V178H504', label: 'colour /3', lx: 270, ly: 226, ends: ['mux11', 'vga'] },
  { d: 'M205 70V104', label: 'SW[3:0] /4', lx: 209, ly: 76, ends: ['mux16'] },
  { d: 'M250 120H290', label: 'x /7', lx: 267, ly: 116, ends: ['mux16', 'xreg'] },
  { d: 'M250 160H270V165H290', label: 'y /6', lx: 272, ly: 176, ends: ['mux16', 'yreg'] },
  { d: 'M321 80V96', label: 'KEY3', lx: 325, ly: 80, ends: ['xreg'] },
  { d: 'M321 182V200', label: 'KEY3', lx: 325, ly: 206, ends: ['yreg'] },
  { d: 'M352 113H392', label: '/7', lx: 364, ly: 109, ends: ['xreg', 'col'] },
  { d: 'M352 165H392', label: '/6', lx: 364, ly: 161, ends: ['yreg', 'row'] },
  { d: 'M468 113H504', label: 'x /7', lx: 474, ly: 109, ends: ['col', 'vga'] },
  { d: 'M468 165H504', label: 'y /6', lx: 474, ly: 161, ends: ['row', 'vga'] },
  { d: 'M530 78V96M566 78V96', label: 'CLOCK_50  plot', lx: 514, ly: 74, ends: ['vga'] },
  // reset leaves the top of the board and splits to join both switch buses
  { d: 'M185 246V238M140 238H262M140 238V86H100M262 238V92H205', label: 'reset', lx: 266, ly: 214, ends: ['board', 'mux11', 'mux16'] },
  { d: 'M220 265H262', label: '/64', lx: 230, ly: 261, ends: ['board', 'disp'] },
  { d: 'M358 256H400M358 265H400M358 274H400', label: '6 × /4', lx: 364, ly: 252, ends: ['disp', 'hex'] },
  { d: 'M470 250H492M470 258H492M470 266H492M470 274H492M470 282H492', label: 'HEX5-0 /7', lx: 496, ly: 269, ends: ['hex'] },
];
const tileNames = ['2', '4', '8', '16', '32', '64', '128', '256', '512', '1024', '2048'];
const pickedBlock = ref('vga');
const block = computed(() => blocks[pickedBlock.value]);

// ---- slide: combine, then compact ----
const row = ref([1, 0, 1, 0]);
const dir = ref('right');
// every frame of the slide: which cells are being looked at and what happens
const frames = computed(() => {
  const cells = [...row.value];
  // walk from the side the tiles are pushed toward
  const order = dir.value === 'right' ? [3, 2, 1, 0] : [0, 1, 2, 3];
  const out = [{ cells: [...cells], look: [], note: `Slide ${dir.value}. Start from the ${dir.value} end.` }];
  const filled = order.filter(i => cells[i]);
  for (let k = 0; k < filled.length; k++) {
    const a = filled[k], b = filled[k + 1];
    if (b === undefined) { out.push({ cells: [...cells], look: [a], note: `${value(cells[a])} has nothing left to pair with.` }); break; }
    if (cells[a] === cells[b]) {
      out.push({ cells: [...cells], look: [a, b], note: `Compare ${value(cells[a])} and ${value(cells[b])}, skipping gaps: equal.` });
      cells[a] += 1;
      cells[b] = 0;
      out.push({ cells: [...cells], look: [a], note: `Combine into ${value(cells[a])}.`, hit: true });
      k++;
    } else out.push({ cells: [...cells], look: [a, b], note: `Compare ${value(cells[a])} and ${value(cells[b])}: different, move on.` });
  }
  const ordered = order.map(i => row.value[i]);
  const done = slideLine(ordered).powers;
  const final = Array(4);
  order.forEach((i, k) => { final[i] = done[k]; });
  out.push({ cells: final, look: [], note: `Compact everything to the ${dir.value}. Done.`, done: true });
  return out;
});
const step = ref(0);
const frame = computed(() => frames.value[Math.min(step.value, frames.value.length - 1)]);
function newRow() {
  do row.value = Array.from({ length: 4 }, () => (Math.random() < 0.35 ? 0 : 1 + Math.floor(Math.random() * 3)));
  while (row.value.filter(Boolean).length < 2);
  step.value = 0;
}
function setDir(d) {
  if (dir.value === d) return;
  dir.value = d;
  step.value = 0;
}

// ---- fsm: blank, one hot key state, gap, back to blank ----
const states = {
  blank: { label: 'blank', code: '0000', x: 160, y: 20 },
  up: { label: 'UP', code: '0001', x: 40, y: 82, key: 'W', scan: '1D' },
  left: { label: 'LEFT', code: '0010', x: 120, y: 82, key: 'A', scan: '1C' },
  down: { label: 'DOWN', code: '0100', x: 200, y: 82, key: 'S', scan: '1B' },
  right: { label: 'RIGHT', code: '1000', x: 280, y: 82, key: 'D', scan: '23' },
  gap: { label: 'gap', code: '1111', x: 160, y: 144 },
};
const keys = ['up', 'left', 'down', 'right'];
const state = ref('blank');
const edge = ref('');
const log = ref('Press W, A, S or D.');
let timers = [];
function press(id) {
  timers.forEach(clearTimeout);
  const s = states[id];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  // the ps/2 keyboard sends a make code, then f0 and the code again when the key comes up
  state.value = id; edge.value = `blank-${id}`; log.value = `${s.key} down: scan code ${s.scan}. blank → ${s.label}, keyVal = ${s.code}.`;
  at(700, () => { state.value = 'gap'; edge.value = `${id}-gap`; log.value = `${s.key} up: F0 ${s.scan}. The extra break code parks it in gap (1111).`; });
  at(1400, () => { state.value = 'blank'; edge.value = 'gap-blank'; log.value = 'Update: the board has moved, back to blank (0000).'; });
  at(2000, () => { edge.value = ''; });
}
const fsmKeys = { w: 'up', a: 'left', s: 'down', d: 'right', ArrowUp: 'up', ArrowLeft: 'left', ArrowDown: 'down', ArrowRight: 'right' };
function fsmKey(event) {
  const id = fsmKeys[event.key] || fsmKeys[event.key.toLowerCase?.()];
  if (!id || event.repeat) return;
  event.preventDefault();
  press(id);
}
onBeforeUnmount(() => timers.forEach(clearTimeout));
const lit = name => edge.value === name;
</script>

<template>
  <figure v-if="figure === 'register'" class="fx-figure">
    <figcaption><strong>Fig. 1</strong> The whole board is one 64-bit register, with 4 bits per tile. Click a tile to double it.</figcaption>
    <div class="fx-panel fx-register">
      <div class="fx-board" role="group" aria-label="Board">
        <button v-for="(p, i) in board" :key="i" class="fx-tile" :class="{ picked: focus === i }"
          :style="{ background: p ? tileColor(p) : '#000', color: tileInk(p) }"
          :aria-label="`Cell ${i}: ${p ? value(p) : 'empty'}, bits ${bits[i]}`"
          @click="bump(i)" @focus="focus = i" @mouseenter="focus = i">{{ p ? value(p) : '' }}</button>
      </div>
      <div class="fx-nibbles" aria-hidden="true">
        <span v-for="n in nibbles" :key="n.i" :class="{ picked: focus === n.i }" @mouseenter="focus = n.i">
          <b>{{ n.b }}</b><small>{{ n.i * 4 + 3 }}</small>
        </span>
      </div>
      <div class="fx-reg">
        <p class="fx-readout" aria-live="polite">
          <code>board{{ focusRange }} = {{ bits[focus] }}</code>
          <span>cell {{ focus }} → {{ board[focus] ? `2^${board[focus]} = ${value(board[focus])}` : 'empty' }}</span>
        </p>
        <p class="fx-hex"><code>64'h{{ toRegister(board) }}</code></p>
        <button class="raised fx-button" @click="shuffle">Random board</button>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'datapath'" class="fx-figure">
    <figcaption><strong>Fig. 2</strong> The drawing datapath, from our block diagram. Pick a block to see what it does and where it goes.</figcaption>
    <div class="fx-panel">
      <div class="fx-schematic">
        <svg viewBox="0 0 600 296" shape-rendering="crispEdges" role="group" aria-label="Block diagram">
          <g class="fx-buses" aria-hidden="true">
            <g v-for="(b, i) in buses" :key="i" :class="{ lit: b.ends.includes(pickedBlock) }">
              <path :d="b.d"/>
              <text :x="b.lx" :y="b.ly">{{ b.label }}</text>
            </g>
          </g>
          <g class="fx-inputs" aria-hidden="true">
            <text v-for="(t, i) in tileNames" :key="t" x="36" :y="112 + i * 15" text-anchor="end">{{ t }}</text>
            <path v-for="(t, i) in tileNames" :key="`w${t}`" :d="`M38 ${109 + i * 15}H40`"/>
            <text x="36" y="24" text-anchor="end">XC</text><text x="36" y="36" text-anchor="end">YC</text><text x="36" y="48" text-anchor="end">clk</text>
          </g>
          <g v-for="(b, id) in blocks" :key="id" class="fx-block" :class="{ on: pickedBlock === id }" role="button" tabindex="0" :aria-label="b.name" :aria-pressed="pickedBlock === id"
            @click="pickedBlock = id" @keydown.enter.space.prevent="pickedBlock = id">
            <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h"/>
            <text v-for="(l, i) in b.lines" :key="i" :x="b.x + b.w / 2" :y="b.y + b.h / 2 + 4 + (i - (b.lines.length - 1) / 2) * 12">{{ l }}</text>
          </g>
        </svg>
      </div>
      <div class="fx-detail" aria-live="polite"><strong>{{ block.name }}</strong><p>{{ block.text }}</p></div>
    </div>
  </figure>

  <figure v-else-if="figure === 'slide'" class="fx-figure">
    <figcaption><strong>Fig. 3</strong> The two-step slide: combine equal tiles, then compact.</figcaption>
    <div class="fx-panel">
      <div class="fx-row" :class="{ done: frame.done }">
        <span v-for="(p, i) in frame.cells" :key="i" class="fx-tile" :class="{ look: frame.look.includes(i), hit: frame.hit && frame.look.includes(i) }"
          :style="{ background: p ? tileColor(p) : '#000', color: tileInk(p) }">{{ p ? value(p) : '' }}</span>
        <span class="fx-arrow" aria-hidden="true">{{ dir === 'right' ? '→' : '←' }}</span>
      </div>
      <p class="fx-note" aria-live="polite"><b>{{ Math.min(step, frames.length - 1) + 1 }}/{{ frames.length }}</b> {{ frame.note }}</p>
      <div class="fx-buttons">
        <button class="raised fx-button" :disabled="step === 0" @click="step--">Back</button>
        <button class="raised fx-button" :disabled="step >= frames.length - 1" @click="step++">Step</button>
        <button class="raised fx-button" @click="newRow">New row</button>
        <span class="fx-toggle" role="group" aria-label="Slide direction">
          <button v-for="d in ['left', 'right']" :key="d" class="raised fx-button" :class="{ pressed: dir === d }" :aria-pressed="dir === d" @click="setDir(d)">{{ d === 'left' ? 'Left' : 'Right' }}</button>
        </span>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'fsm'" class="fx-figure">
    <figcaption><strong>Fig. 4</strong> The keyboard FSM, with one one-hot state per key and a gap state for the extra break code. Press W, A, S or D.</figcaption>
    <div class="fx-panel" tabindex="0" aria-label="Keyboard FSM. Press W, A, S or D." @keydown="fsmKey">
      <svg class="fx-fsm" viewBox="0 0 320 166" shape-rendering="crispEdges" aria-hidden="true">
        <g class="fx-edges">
          <path v-for="k in keys" :key="`in-${k}`" :class="{ lit: lit(`blank-${k}`) }" :d="`M160 32 L${states[k].x} 70`"/>
          <path v-for="k in keys" :key="`out-${k}`" :class="{ lit: lit(`${k}-gap`) }" :d="`M${states[k].x} 94 L160 132`"/>
          <path :class="{ lit: lit('gap-blank') }" d="M190 144 H312 V20 H190"/>
        </g>
        <g v-for="(s, id) in states" :key="id" class="fx-state" :class="{ on: state === id }">
          <rect :x="s.x - 30" :y="s.y - 12" width="60" height="24" rx="10"/>
          <text :x="s.x" :y="s.y - 1">{{ s.label }}</text>
          <text class="fx-code" :x="s.x" :y="s.y + 8">{{ s.code }}</text>
        </g>
        <text class="fx-edge-label" x="252" y="14">update</text>
        <text class="fx-edge-label" x="34" y="130">released</text>
      </svg>
      <div class="fx-keys">
        <button v-for="k in keys" :key="k" class="raised fx-key" :class="{ pressed: state === k }" :aria-label="`Press ${states[k].key}`" @click="press(k)">{{ states[k].key }}</button>
      </div>
      <p class="fx-note" aria-live="polite">{{ log }}</p>
    </div>
  </figure>
</template>

<style scoped>
.fx-figure { margin: 18px 0 22px; font-family: 'Pixel MS Sans Serif', Tahoma, sans-serif; }
.fx-figure figcaption { margin-bottom: 8px; font-size: 12px; color: var(--muted); }
.fx-figure figcaption strong { color: var(--ink); margin-right: 4px; }
/* sunken like a pressed button, but the bottom right edge is grey instead of white
   so the corner still shows on the white page (dark mode uses the light edge) */
.fx-panel { --sunk-edge: var(--shadow); padding: 12px; background: var(--paper); border: 2px solid; border-color: var(--edge) var(--sunk-edge) var(--sunk-edge) var(--edge); box-shadow: inset 1px 1px var(--shadow); }
:root[data-theme="dark"] .fx-panel { --sunk-edge: var(--light); }
.fx-panel:focus-visible { outline: 1px dotted var(--ink); outline-offset: -4px; }
.fx-button { padding: 3px 10px; font: 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--ink); }

/* the tiles, in the vga's colours on a black board with white lines */
.fx-tile {
  display: grid; place-items: center; aspect-ratio: 1; min-width: 0; padding: 0; border: 0;
  font: bold 12px 'Courier New', monospace; cursor: var(--classic-pointer, pointer);
}
.fx-tile:focus-visible { outline: 2px dotted #fff; outline-offset: -4px; }

/* fig 1 */
/* the board beside its register, the readout under both. the register is a square
   the size of the board, a nibble for each of its tiles, and the two grow with the
   figure up to 300px each so a big preview pane isn't left mostly empty */
.fx-register { display: grid; grid-template-columns: repeat(2, minmax(0, 300px)); grid-template-areas: 'board nibbles' 'reg reg'; gap: 12px 16px; align-items: start; }
.fx-register .fx-board { grid-area: board; }
.fx-register .fx-nibbles { grid-area: nibbles; }
.fx-register .fx-reg { grid-area: reg; }
.fx-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; padding: 2px; background: #e6eeff; border: 2px solid #000; }
.fx-board .fx-tile { font-size: clamp(8px, 4cqi, 20px); }
.fx-board .fx-tile.picked { box-shadow: inset 0 0 0 2px #000, inset 0 0 0 4px #fff; }
.fx-nibbles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 3px; aspect-ratio: 1; }
.fx-nibbles span { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2px 0; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); }
.fx-nibbles span.picked { background: var(--navy, #000080); color: #fff; border-color: var(--navy, #000080); }
.fx-nibbles b { font: clamp(10px, 2.8cqi, 16px) 'Courier New', monospace; letter-spacing: -.5px; }
.fx-nibbles small { font: clamp(8px, 1.8cqi, 11px) 'Courier New', monospace; opacity: .7; }
.fx-readout { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0 0 4px; font-size: 13px; }
.fx-readout code, .fx-hex code { font: bold 12px 'Courier New', monospace; color: var(--d-link, #000080); }
.fx-hex { margin: 0 0 10px; overflow-wrap: anywhere; }
@container (max-width: 220px) { .fx-register { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'board' 'nibbles' 'reg'; } }
.fx-figure { container-type: inline-size; }

/* fig 3 */
.fx-row { display: grid; grid-template-columns: repeat(4, minmax(0, 64px)) auto; gap: 2px; align-items: center; justify-content: center; }
.fx-row .fx-tile { cursor: default; font-size: 16px; border: 2px solid #e6eeff; outline: 2px solid #000; transition: transform .15s; }
.fx-row .fx-tile.look { border-color: #1baf7a; transform: translateY(-4px); }
.fx-row .fx-tile.hit { animation: fx-pop .3s steps(3); }
.fx-row.done .fx-tile { border-color: #1baf7a; }
@keyframes fx-pop { 50% { transform: translateY(-4px) scale(1.15); } }
.fx-arrow { margin-left: 8px; font: bold 22px 'Courier New', monospace; color: var(--muted); }
.fx-note { min-height: 2.8em; margin: 12px 0 8px; font-size: 13px; line-height: 1.4; }
.fx-note b { margin-right: 6px; font: bold 11px 'Courier New', monospace; color: var(--muted); }
.fx-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
/* the slide direction is a pair, like the ascii / normal toggle: the one in use stays pressed in */
.fx-toggle { display: inline-flex; gap: 0; }

/* fig 2: the schematic scrolls sideways on a phone rather than shrinking unreadably */
.fx-schematic { overflow-x: auto; }
.fx-schematic svg { display: block; width: 100%; min-width: 540px; }
.fx-buses path, .fx-inputs path { fill: none; stroke: var(--muted); stroke-width: 2; }
.fx-buses text, .fx-inputs text { fill: var(--muted); font: 8px 'Courier New', monospace; }
.fx-buses .lit path { stroke: #1baf7a; stroke-width: 3; }
.fx-buses .lit text { fill: var(--ink); font-weight: bold; }
.fx-block { cursor: var(--classic-pointer, pointer); outline: none; }
.fx-block rect { fill: #d2c1a6; stroke: var(--ink); stroke-width: 2; }
.fx-block text { fill: #1b1b1b; font: bold 10px 'Pixel MS Sans Serif', Tahoma, sans-serif; text-anchor: middle; pointer-events: none; }
.fx-block:hover rect { fill: #e2d4bd; }
.fx-block:focus-visible rect { stroke-dasharray: 3 2; }
.fx-block.on rect { fill: var(--navy, #000080); }
.fx-block.on text { fill: #fff; }
.fx-detail { margin-top: 10px; padding: 8px 10px; background: var(--d-page-alt, #fffdf2); border: 2px solid var(--d-line, #000); box-shadow: 3px 3px 0 var(--d-line, #000); }
.fx-detail strong { font-size: 13px; }
.fx-detail p { margin: 4px 0 0; font-size: 13px; line-height: 1.5; }

/* fig 4 */
.fx-fsm { display: block; width: 100%; max-width: 480px; margin: 0 auto; }
.fx-edges path { fill: none; stroke: var(--d-line, #888); stroke-width: 2; stroke-dasharray: 4 3; }
.fx-edges path.lit { stroke: #1baf7a; stroke-dasharray: none; stroke-width: 3; }
.fx-state rect { fill: var(--d-page-alt, #fffdf2); stroke: var(--ink); stroke-width: 2; }
.fx-state text { fill: var(--ink); font: bold 10px 'Pixel MS Sans Serif', Tahoma, sans-serif; text-anchor: middle; }
.fx-state .fx-code { font: 8px 'Courier New', monospace; fill: var(--muted); }
.fx-state.on rect { fill: var(--navy, #000080); }
.fx-state.on text { fill: #fff; }
.fx-edge-label { fill: var(--muted); font: 8px 'Courier New', monospace; }
.fx-keys { display: flex; justify-content: center; gap: 6px; margin-top: 8px; }
.fx-key { width: 38px; height: 34px; padding: 0; font: bold 14px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--ink); }
.fx-key.pressed { background: var(--navy, #000080); color: #fff; }
@media (prefers-reduced-motion: reduce) { .fx-row .fx-tile { transition: none; } .fx-row .fx-tile.hit { animation: none; } }
</style>
