<script setup>
// the figures in the mini ml framework writeup (content.mjs, figures): the mnist mlp
// training on real test digits while the cuda and cpu backends race, one layer as a network
// and as W·a + b, the backward pass through (x·w + x)·(x + w) one gradient at a time, the tiled matmul kernel loading its
// tiles into shared memory phase by phase, sgd, momentum, rmsprop and adam rolling down four
// loss surfaces, and where pytorch and keras put adam's epsilon. the rules follow
// ml-framework/crates/minitorch (autograd.rs, cuda.rs, optim.rs)
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { reducedMotion, useInView } from '../in-view.js';
// preview is the projects folder's card: fig 1 alone in a 600 × 375 frame, no buttons,
// playing only while the card is on screen
const props = defineProps({ figure: { type: String, required: true }, preview: Boolean });

const fmt = v => (Number.isInteger(v) ? String(v) : v.toFixed(1));

// a walkthrough you can step by hand or play: play ticks every ms and stops at the last step,
// and stepping or jumping by hand pauses it
function stepper(step, count, ms) {
  const playing = ref(false);
  let timer;
  const atEnd = () => step.value >= count() - 1;
  function pause() { playing.value = false; clearTimeout(timer); }
  function tick() { timer = setTimeout(() => { step.value++; if (atEnd()) pause(); else tick(); }, ms); }
  function play() { if (atEnd()) step.value = 0; playing.value = true; tick(); }
  onBeforeUnmount(() => clearTimeout(timer));
  return { playing, toggle: () => (playing.value ? pause() : play()), go: n => { pause(); step.value = n; } };
}

// ---- train: the 784-256-128-10 mlp learning mnist ----
// one real test digit per class, thresholded. each row of 28 pixels is 7 hex digits
const digits = [
  { label: 7, bits: '000000000000000000000000000000000000000000000000001c000003fff80017ffc0000018000001800000300000070000006000000e000000c000001c000001800000380000070000006000000e000001c000001c000003c00000380000000000' },
  { label: 2, bits: '000000000000000000000003f000007f80000ffc0000e1c0000c3800000380000078000007000000f000001e000001c000003c0000038000007800000f000000e000000e003c00ffffe00ffffc007ff0000000000000000000000000000000000000' },
  { label: 1, bits: '0000000000000000000000000000000040000004000000c000000c00000080000018000001800000180000030000003000000700000060000006000000e000000e000000c000000c000001c000001c00000180000000000000000000000000000000' },
  { label: 0, bits: '000000000000000000000000000000070000007000000f000001f800003fe00007ff00007e70000fc3c000f01c000e01c000c01e001c01c001c03c001c0f8001c1f8001cff0001fff0000ffc00007f000001c0000000000000000000000000000000' },
  { label: 4, bits: '000000000000000000000000000000000000010000003018000300800030180006018000c018000c0380018030001807000180700018060001c3e0000ffe000000e000000e000000e000000e000000e000000e000000800000000000000000000000' },
  { label: 9, bits: '000000000000000000000000000000000000000000000c000001c000003e000007f800007f8000063c000043c0000e3c000067c00007ee00003ce00001870000003000000380000018000001c000000c000000600000060000002000000000000000' },
  { label: 5, bits: '000000000000000000000000000000000200000ff80007ff80007ff80047c0000c000001c0000038000003000000700000078000007e800007ffe0001fff00001ff00001ef00000ff00000fe000007c0000010000000000000000000000000000000' },
  { label: 6, bits: '000000000000000000000001c000003c000007000000700000060000006000000e000000c0fe000c1fe000c7c6001cf06001ce06001dc06001dc06001ce0c001c71c001c078000e3e00007fc00001f00000000000000000000000000000000000000' },
  { label: 3, bits: '000000000000000000000000000000c000003f000007f8000039e000070f000060780006038000623c00027fc00007ff00003ffc000003e000000f0006007000700380070038003c1f8001fff00007fe00000a000000000000000000000000000000' },
  { label: 8, bits: '0000000000000000000000000000000000000000000007f80001ffe0003f0f00078070007007000300f000383e0001c7c0000ff00000f800007f80003fb8000fc38000fbf80007ff00001fe000000000000000000000000000000000000000000000' },
];
// one 3 × 3 square per lit pixel, all in one path
const digitPath = d => {
  let path = '';
  for (let r = 0; r < 28; r++) {
    const row = parseInt(d.bits.slice(r * 7, r * 7 + 7), 16);
    for (let c = 0; c < 28; c++) if (row & (1 << (27 - c))) path += `M${8 + c * 3} ${22 + r * 3}h3v3h-3z`;
  }
  return path;
};
// a few sample neurons stand in for each layer
const layers = [{ x: 124, n: 9 }, { x: 182, n: 8 }, { x: 240, n: 6 }];
const dotY = (n, i) => 67 + (i - (n - 1) / 2) * 10.5;
const outY = d => 12 + d * 11;
// what each column is, under it
const columns = [
  { x: 50, name: 'image', size: '28 × 28' }, { x: 124, name: 'input', size: '784' },
  { x: 182, name: 'hidden', size: '256' }, { x: 240, name: 'hidden', size: '128' }, { x: 305.5, name: 'output', size: '10' },
];
// the wires between each pair of columns, one path each: digit to 784, 784 to 256,
// 256 to 128, 128 to the 10 outputs
const wires = (() => {
  const column = l => Array.from({ length: l.n }, (_, i) => [l.x, dotY(l.n, i)]);
  const from = [Array.from({ length: 5 }, (_, i) => [93, 36 + i * 14]), ...layers.map(column)];
  const to = [...layers.map(column), Array.from({ length: 10 }, (_, d) => [300, outY(d) + 5])];
  return from.map((a, k) => a.flatMap(([x1, y1]) => to[k].map(([x2, y2]) => `M${x1} ${y1}L${x2} ${y2}`)).join(''));
})();
// a made up but steady activation for each sample neuron, so every digit lights its own pattern
const activation = (d, l, i) => 0.3 + 0.7 * (((Math.sin(d * 12.9898 + l * 78.233 + i * 37.719) * 43758.5453) % 1) + 1) % 1;

// from a real run: examples/mnist.rs --device cuda --epochs 10, seed 0, batch 128, adam 1e-3
const losses = [0.2670, 0.0996, 0.0671, 0.0504, 0.0429, 0.0300, 0.0237, 0.0223, 0.0191, 0.0171];
const accs = [96.34, 96.78, 97.57, 97.35, 97.61, 97.79, 97.89, 97.89, 97.79, 97.79];
// seconds per epoch on the rtx 4080 laptop, from the readme
const GPU = 0.18, CPU = 2.83, EPOCHS = 10;
// training plays back slowed down: the gpu's 1.8 s takes 14 s here, then it holds
// on the result for a few seconds and starts over
const SPEED = (GPU * EPOCHS) / 14;
const CYCLE = 2400, HOLD = 3500, END = (GPU * EPOCHS / SPEED) * 1000;
const clock = ref(0);
const playing = ref(false);
const sim = computed(() => Math.min(GPU * EPOCHS, clock.value / 1000 * SPEED));
const gpuEpochs = computed(() => Math.min(EPOCHS, sim.value / GPU + 1e-9));
const cpuEpochs = computed(() => Math.min(EPOCHS, sim.value / CPU));
const trained = computed(() => Math.floor(gpuEpochs.value));
const finished = computed(() => trained.value >= EPOCHS);
const sample = computed(() => digits[Math.floor(clock.value / CYCLE) % digits.length]);
// how far this batch is through forward, loss, backward and adam. -1 once training's done
const batchPhase = computed(() => (finished.value ? -1 : (clock.value % CYCLE) / CYCLE));
// the four parts of every batch, each ending at that fraction of it. their colours are the wires'
const stages = [
  { id: 'fwd', name: 'Forward', until: 0.45 }, { id: 'loss', name: 'Loss', until: 0.55 },
  { id: 'back', name: 'Backward', until: 0.9 }, { id: 'step', name: 'Adam step', until: 1 },
];
const stageIndex = computed(() => (finished.value ? -1 : stages.findIndex(s => batchPhase.value < s.until)));
const stageNote = computed(() => {
  if (finished.value) return `Done. ${accs[EPOCHS - 1]}% right on the 10,000 test digits.`;
  const l = sample.value.label;
  return [
    `A ${l} goes in, one digit of a batch of 128.`,
    `The loss is −log of the chance it gave ${l}.`,
    'Gradients flow back to every weight.',
    'Adam nudges all 235,146 weights.',
  ][stageIndex.value];
});
// column j lights as the forward pass reaches it: 1 to 3 are the hidden layers, 4 the outputs
const layerOn = j => batchPhase.value < 0 || batchPhase.value >= j * 0.1;
const wireClass = k => {
  const f = batchPhase.value;
  return { fwd: f >= k * 0.1 + 0.05 && f < 0.5, back: f >= 0.5 + (3 - k) * 0.1 && f < 0.9, step: f >= 0.9 };
};
// the label's bar is e^-loss, the geometric mean of the probability the model gave the
// right answer that epoch. untrained, it's a guess out of 10
const pLabel = computed(() => (trained.value ? Math.exp(-losses[trained.value - 1]) : 0.1));
// the loss chart: epochs 1 to 10 across, 0 to 0.3 up. the whole run is a faint guide and
// the epochs done so far draw over it
const lossX = e => 30 + e * 18.5, lossY = l => 50 - l / 0.3 * 42;
const lossPts = losses.map((l, e) => [lossX(e), lossY(l)]);
const lossGuide = lossPts.map(p => p.join(',')).join(' ');
const lossLine = computed(() => lossPts.slice(0, trained.value).map(p => p.join(',')).join(' '));

let raf, last;
function frame(now) {
  if (last !== undefined) clock.value += now - last;
  last = now;
  if (clock.value > END + HOLD) clock.value = 0;
  raf = requestAnimationFrame(frame);
}
function play() {
  playing.value = true;
  last = undefined;
  if (clock.value >= END) clock.value = 0;
  raf = requestAnimationFrame(frame);
}
function stop() { playing.value = false; cancelAnimationFrame(raf); }
function restart() { clock.value = 0; if (!playing.value) play(); }
const root = ref(null);
const inView = props.preview ? useInView(root) : null;
if (inView) watch(inView, on => { if (reducedMotion()) return; if (on) play(); else stop(); });
onMounted(() => {
  if (props.figure !== 'train') return;
  // with reduced motion it opens on the finished run and only moves if you press play
  if (reducedMotion()) clock.value = END;
  else if (!props.preview) play();
});
onBeforeUnmount(() => cancelAnimationFrame(raf));

// ---- layer: four pixels into three neurons, drawn as a network and as W·a + b ----
// made up weights, picked so one neuron's sum comes out negative and relu zeroes it
const layerW = [[0.6, 0.4, -0.5, 0.3], [-0.8, 0.5, 0.9, -0.4], [0.2, -0.6, 0.4, 0.7]];
const layerB = [-0.2, 0.1, 0];
const pixels = ref([1, 0.5, 0, 1]);
const picked = ref(0);
const num = v => String(Math.round(v * 100) / 100);
const zs = computed(() => layerW.map((row, j) => row.reduce((s, w, k) => s + w * pixels.value[k], layerB[j])));
const outs = computed(() => zs.value.map(z => Math.max(0, z)));
// clicking a pixel steps its brightness through 0, 0.5 and 1
function cyclePixel(k) { pixels.value = pixels.value.map((v, i) => (i === k ? (v === 1 ? 0 : v + 0.5) : v)); }
const pixelY = k => 30 + k * 38, neuronY = j => 49 + j * 38;
// a weight's edge is navy when positive and orange when negative, thicker the bigger it is
const weightEdges = computed(() => layerW.flatMap((row, j) => row.map((w, k) => ({
  j, k, w, d: `M42 ${pixelY(k)}L133 ${neuronY(j)}`, on: j === picked.value,
}))));
// the matrix side: W's rows line up with b and out, a stands beside them as a column
const cellW = 24, cellH = 22, rowY = j => 50 + j * cellH, colY = k => 39 + k * cellH;
const wFill = w => (w < 0 ? `rgba(232, 163, 61, ${0.6 * -w})` : `rgba(91, 132, 255, ${0.5 * w})`);
const grey = v => `rgb(${v * 255}, ${v * 255}, ${v * 255})`;
// the picked neuron's weights, written on its edges a third of the way from the pixels
const weightLabels = computed(() => layerW[picked.value].map((w, k) => ({
  k, w, x: 71, y: pixelY(k) + 0.32 * (neuronY(picked.value) - pixelY(k)) + 3,
})));
// the receipt: what each pixel adds to the picked neuron's sum, then the bias, the sum and relu.
// each bar grows from the middle, right when it pushes the sum up and left when it pulls it down
const receipt = computed(() => {
  const j = picked.value;
  return {
    terms: layerW[j].map((w, k) => ({ k, a: pixels.value[k], w, v: w * pixels.value[k] })),
    b: layerB[j], z: zs.value[j], out: outs.value[j],
  };
});
const bar = v => {
  const w = `${Math.min(1, Math.abs(v)) * 50}%`;
  return v < 0 ? { right: '50%', width: w } : { left: '50%', width: w };
};

// ---- graph: y = (x·w + x)·(x + w), at x = 4 and w = 2 ----
const X = 4, W = 2;
const step = ref(0);
const vals = computed(() => {
  const v = X, a = v * W, b = a + v, c = v + W;
  return { x: v, w: W, a, b, c, y: b * c };
});
// each step lights some edges and may give a gradient contribution to a leaf, x or w
const steps = computed(() => {
  const { x: v, b, c } = vals.value;
  const top = { y: 1, b: c, c: b };
  return [
    { note: `Forward. x = ${fmt(v)} and w = ${W}.`, show: ['x', 'w'], edges: ['in-x', 'in-w'] },
    { note: `a = x · w = ${fmt(v * W)}.`, show: ['a'], edges: ['x-a', 'w-a'] },
    { note: `b = a + x = ${fmt(b)}. x is used a second time.`, show: ['b'], edges: ['a-b', 'x-b'] },
    { note: `c = x + w = ${fmt(c)}. A third use of x, and a second of w.`, show: ['c'], edges: ['x-c', 'w-c'] },
    { note: `y = b · c = ${fmt(b * c)}.`, show: ['y'], edges: ['b-y', 'c-y', 'out'] },
    { note: 'Backward. Seed dy/dy = 1 and walk the graph in reverse.', back: ['out'], grads: { y: 1 } },
    { note: `mul sends gradient × the other input: 1 × c = ${fmt(c)} to b…`, back: ['b-y'], grads: { y: 1, b: c } },
    { note: `…and 1 × b = ${fmt(b)} to c.`, back: ['c-y'], grads: top },
    { note: `add passes its gradient straight through: ${fmt(b)} to x…`, back: ['x-c'], grads: top, give: { x: b } },
    { note: `…and ${fmt(b)} to w.`, back: ['w-c'], grads: top, give: { w: b } },
    { note: `b is an add too: ${fmt(c)} to a…`, back: ['a-b'], grads: { ...top, a: c } },
    { note: `…and ${fmt(c)} to x.`, back: ['x-b'], grads: { ...top, a: c }, give: { x: c } },
    { note: `a is a mul: ${fmt(c)} × w = ${fmt(c * W)} to x…`, back: ['x-a'], grads: { ...top, a: c }, give: { x: c * W } },
    { note: `…and ${fmt(c)} × x = ${fmt(c * v)} to w.`, back: ['w-a'], grads: { ...top, a: c }, give: { w: c * v } },
  ];
});
// steps before this one are the forward pass
const BACKWARD = 5;
const at = computed(() => steps.value[step.value]);
const sofar = computed(() => steps.value.slice(0, step.value + 1));
// what each leaf's gradient holds so far: every contribution added up
const contributions = leaf => sofar.value.filter(s => s.give?.[leaf] !== undefined).map(s => s.give[leaf]);
const gradOf = leaf => {
  const c = contributions(leaf);
  return c.length ? c.reduce((a, b) => a + b) : null;
};
const nodeGrad = id => (id === 'x' || id === 'w' ? gradOf(id) : at.value.grads?.[id] ?? null);
const done = computed(() => step.value === steps.value.length - 1);
// dy/dx = (w + 1)(2x + w) and dy/dw = x(x + 2w + 1)
const leaves = computed(() => [
  { id: 'x', right: (W + 1) * (2 * X + W), formula: '(w + 1)(2x + w)' },
  { id: 'w', right: X * (X + 2 * W + 1), formula: 'x(x + 2w + 1)' },
]);
const shown = id => step.value >= BACKWARD || sofar.value.some(s => s.show?.includes(id));
const lit = id => step.value >= BACKWARD || sofar.value.some(s => s.edges?.includes(id));
// one column per depth: the inputs, then a and c, then b, then y. x's second use arcs over a
const nodes = {
  x: { x: 50, y: 88 },
  w: { x: 50, y: 160 },
  a: { x: 150, y: 88, op: 'x · w' },
  c: { x: 150, y: 160, op: 'x + w' },
  b: { x: 250, y: 88, op: 'a + x' },
  y: { x: 340, y: 124, op: 'b · c' },
};
// each edge stops short of the circles at both ends, so its arrowhead fits either way round:
// toward y in the forward pass, back toward the inputs in the backward pass
const HEAD = 7;
// pulls one end of an edge in by HEAD, so the line stops where its arrowhead starts and the
// arrowhead, drawn out from there, puts its tip back at the circle
function trim(d, atStart) {
  const n = d.match(/-?[\d.]+/g).map(Number);
  const pts = n.filter((_, i) => i % 2 === 0).map((x, i) => [x, n[i * 2 + 1]]);
  const [i, toward] = atStart ? [0, 1] : [pts.length - 1, pts.length - 2];
  const [p, q] = [pts[i], pts[toward]];
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  pts[i] = [p[0] + (q[0] - p[0]) / len * HEAD, p[1] + (q[1] - p[1]) / len * HEAD].map(v => Math.round(v * 10) / 10);
  return pts.length === 3 ? `M${pts[0]} Q${pts[1]} ${pts[2]}` : `M${pts[0]} L${pts[1]}`;
}
const edges = [
  { id: 'in-x', d: 'M14 88 L34 88' },
  { id: 'in-w', d: 'M14 160 L34 160' },
  { id: 'x-a', d: 'M66 88 L134 88' },
  { id: 'x-c', d: 'M63 97 L137 151' },
  { id: 'x-b', d: 'M63 78 Q150 10 237 78' },
  { id: 'w-a', d: 'M63 151 L137 97' },
  { id: 'w-c', d: 'M66 160 L134 160' },
  { id: 'a-b', d: 'M166 88 L234 88' },
  { id: 'b-y', d: 'M265 94 L325 118' },
  { id: 'c-y', d: 'M166 157 L324 127' },
  { id: 'out', d: 'M356 124 L390 124' },
].map(e => ({ id: e.id, fwd: trim(e.d, false), back: trim(e.d, true) }));
const edgePath = e => (step.value >= BACKWARD ? e.back : e.fwd);
// the edges this step sends a value forward along, or a gradient back along
const flowing = computed(() => {
  const ids = at.value.back ?? at.value.edges ?? [];
  return edges.filter(e => ids.includes(e.id)).map(e => ({ id: e.id, d: edgePath(e), back: !!at.value.back }));
});
// the node this step works on: the one it computes going forward, or the one an edge hands
// its gradient to going back
const working = id => (step.value < BACKWARD
  ? !!at.value.show?.includes(id)
  : (at.value.back ?? []).some(e => (e === 'out' ? 'y' : e.split('-')[0]) === id));
const { playing: graphPlaying, toggle: toggleGraph, go: goGraph } = stepper(step, () => steps.value.length, 1300);

// ---- tiles: C = A · B, 8 × 8, in 2 × 2 tiles (the real kernel uses 16 × 16) ----
const N = 8, T = 2, phases = N / T;
const out = ref([0, 0]);
const tStep = ref(0);
// the walkthrough: one answer, the block's strips, the reads without tiles, one step per
// phase, then the total. phase is negative before the tiled steps and phases at the end
const PHASE0 = 3, TLAST = PHASE0 + phases;
const phase = computed(() => tStep.value - PHASE0);
const cell = 11, GY = 30;
const grids = { a: { x: 10, label: 'A' }, b: { x: 122, label: 'B' }, c: { x: 234, label: 'C' } };
// reads from main memory. without tiles, each of the block's T² threads reads a whole row
// of A and column of B on its own. tiled, each phase loads two tiles once for everyone
const naive = 2 * N * T * T, tiled = 2 * T * T * phases;
const tiledSoFar = computed(() => 2 * T * T * Math.min(phases, Math.max(0, phase.value + 1)));
const loading = computed(() => phase.value >= 0 && phase.value < phases);
function pick(i, j) { out.value = [i, j]; }
const cellClass = (m, r, c) => {
  const [bi, bj] = [out.value[0] * T, out.value[1] * T];
  const inRows = Math.floor(r / T) === out.value[0], inCols = Math.floor(c / T) === out.value[1];
  const one = tStep.value === 0;
  if (m === 'c') return { pickable: true, now: one ? r === bi && c === bj : inRows && inCols };
  // what this block needs: one row or column for the single answer, T of them after
  if (!(m === 'a' ? (one ? r === bi : inRows) : (one ? c === bj : inCols))) return {};
  // the phase that loads this cell's tile
  const k = Math.floor((m === 'a' ? c : r) / T);
  return { need: true, now: loading.value && k === phase.value, seen: phase.value >= 0 && k < phase.value };
};
// the top left corner of the tile of A and of B in shared memory this phase
const tileAt = computed(() => ({
  a: [grids.a.x + phase.value * T * cell, GY + out.value[0] * T * cell],
  b: [grids.b.x + out.value[1] * T * cell, GY + phase.value * T * cell],
}));
const slots = { a: 132, b: 180 };
const SLOT_Y = 134;
const tileNote = computed(() => {
  const p = phase.value;
  if (tStep.value === 0) return `Each number in C comes from one row of A and one column of B: multiply them pair by pair and add it all up. That’s ${2 * N} numbers to read for one answer.`;
  if (tStep.value === 1) return `On the GPU, a team of ${T * T} threads works out a ${T} × ${T} patch of C together. Between them they need ${T} rows of A and ${T} columns of B.`;
  if (tStep.value === 2) return `The simple way: every thread fetches its own row and column from main memory. That’s ${T * T} × ${2 * N} = ${naive} reads, and each number gets fetched ${T} times by different threads.`;
  if (p < phases) return `Tiled, step ${p + 1} of ${phases}: the team copies one ${T} × ${T} tile of A and one of B into shared memory, a small fast store right next to the cores. That’s ${2 * T * T} reads, and every thread does its multiplying from there.`;
  return `Each number was fetched once and shared by the team: ${tiled} reads instead of ${naive}. The real kernel uses 16 × 16 tiles, so every fetch is reused 16 times and it reads 16× less.`;
});
// the patch of C fills in as each phase adds its share of the sums
const cFill = (r, c) => {
  const inPatch = Math.floor(r / T) === out.value[0] && Math.floor(c / T) === out.value[1];
  return inPatch && loading.value ? { fillOpacity: 0.25 + 0.75 * (phase.value + 1) / phases } : null;
};
const range = Array.from({ length: N }, (_, i) => i);
const tileRange = Array.from({ length: T }, (_, i) => i);
const { playing: tilesPlaying, toggle: toggleTiles, go: goTiles } = stepper(tStep, () => TLAST + 1, 2200);

// ---- epsilon: one adam step with a steady gradient g, as in the test fixtures ----
const LR = 0.01, B2 = 0.999, EPS = 1e-8;
const gExp = ref(-6);
const tChoices = [1, 10, 100, 1000, 10000];
const tIndex = ref(0);
const t = computed(() => tChoices[tIndex.value]);
const g = computed(() => 10 ** gExp.value);
// with a steady gradient, the bias corrected m and sqrt(v) are both g. pytorch adds
// eps after the correction, keras before, which is eps / sqrt(1 - b2^t) after it
const keraEps = computed(() => EPS / Math.sqrt(1 - B2 ** t.value));
const torchStep = computed(() => LR * g.value / (g.value + EPS));
const kerasStep = computed(() => LR * g.value / (g.value + keraEps.value));
const gap = computed(() => Math.abs(torchStep.value - kerasStep.value) / torchStep.value);
const sci = v => {
  const e = Math.floor(Math.log10(v));
  const m = v / 10 ** e;
  return `${m.toFixed(m < 9.95 ? 2 : 1)}e${e}`;
};
const pct = v => (v < 0.0001 ? `${(v * 1e6).toFixed(1)} ppm` : v < 0.01 ? `${(v * 100).toFixed(3)}%` : `${(v * 100).toFixed(1)}%`);
// the chart: gradient size from 1e-10 to 1e-2 across on a log scale, and each framework's
// step as a share of lr up. a step is half of lr where the gradient equals that epsilon
const EX = e => 44 + (e + 10) / 8 * 344, EY = s => 134 - s * 120;
const stepCurve = eps => Array.from({ length: 81 }, (_, i) => {
  const e = -10 + i / 10, v = 10 ** e;
  return `${EX(e).toFixed(1)},${EY(v / (v + eps)).toFixed(1)}`;
}).join(' ');
const torchCurve = stepCurve(EPS);
const kerasCurve = computed(() => stepCurve(keraEps.value));
// drag across the chart to pick the gradient, snapped to the slider's half decades
const epsChart = ref(null);
function pickGradient(e) {
  if (e.type === 'pointermove' && !e.buttons) return;
  const r = epsChart.value.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * 400;
  gExp.value = Math.max(-10, Math.min(-2, Math.round(((x - 44) / 344 * 8 - 10) * 2) / 2));
}

// ---- optim: four optimizers rolling down the same loss surface ----
// momentum is the sgd in optim.rs and adam is its adam, plain sgd and rmsprop fill out the
// family. each keeps one learning rate on every surface, the way you'd pick it once and train
const opts = [
  { id: 'sgd', name: 'SGD', lr: 0.2, rule: 'w −= lr·g' },
  { id: 'mom', name: 'Momentum', lr: 0.04, rule: 'v = 0.9v + g,  w −= lr·v' },
  { id: 'rms', name: 'RMSProp', lr: 0.03, rule: 's = 0.9s + 0.1g²,  w −= lr·g / √s' },
  { id: 'adam', name: 'Adam', lr: 0.05, rule: 'Momentum’s v over RMSProp’s √s,  w −= lr·v / √s' },
];
const bump = (x, y, cx, cy, s) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s);
// a wide bowl with a small dip at (-0.6, 0.6) and a deep valley at (0.9, -0.5)
const dips = [[0.25, -0.6, 0.6, 0.2], [1.2, 0.9, -0.5, 0.4]];
// each surface: the loss and its gradient, how far x and y reach, where every ball starts,
// and the lowest points, which a ball has to reach to count as done
const surfaces = {
  ravine: {
    name: 'Ravine', f: (x, y) => 0.04 * x * x + 4.5 * y * y, g: (x, y) => [0.08 * x, 9 * y],
    span: [2, 1], start: [-1.8, 0.7], mins: [[0, 0]],
    note: 'Steep side to side, almost flat along the floor, and one learning rate can’t suit both. SGD bounces between the walls and crawls along the floor. RMSProp and Adam divide each direction by its own gradient size, so they head almost straight for the bottom.',
  },
  saddle: {
    name: 'Saddle', f: (x, y) => 0.1 * x * x - 0.1 * y * y + 0.05 * y ** 4, g: (x, y) => [0.2 * x, -0.2 * y + 0.2 * y ** 3],
    span: [1, 1.6], start: [0.9, 0.002], mins: [[0, 1], [0, -1]],
    note: 'Every ball starts balanced on a ridge, where the slope off it is nearly zero. SGD and Momentum hardly move until they finally tip over. RMSProp and Adam divide by the gradient’s size, so even a tiny slope gets a full step.',
  },
  valleys: {
    name: 'Two valleys',
    f: (x, y) => 0.1 * (x * x + y * y) - dips.reduce((a, [d, cx, cy, s]) => a + d * bump(x, y, cx, cy, s), 0),
    g: (x, y) => dips.reduce(([gx, gy], [d, cx, cy, s]) => {
      const e = 2 * d * bump(x, y, cx, cy, s) / s;
      return [gx + e * (x - cx), gy + e * (y - cy)];
    }, [0.2 * x, 0.2 * y]),
    span: [2, 2], start: [-1.8, 1.5], mins: [[0.871, -0.484]],
    note: 'A small dip sits between the start and the deep valley. Only Momentum carries enough speed to roll through it. Adam has momentum too, but its steps stay near the learning rate, so it can’t build up speed and settles in the dip with the rest.',
  },
  bowl: {
    name: 'Bowl', f: (x, y) => 0.5 * (x * x + y * y), g: (x, y) => [x, y],
    span: [2, 2], start: [1.6, 1.3], mins: [[0, 0]],
    note: 'A plain round bowl, where plain SGD is hard to beat. Momentum overshoots and has to circle back, and RMSProp and Adam take about the same size step the whole way, so they don’t speed up on the steep part.',
  },
};
const MAX_STEPS = 220;
// the whole run up front: every position, and the step it reached a lowest point and stayed
function descend(s, o) {
  const p = [...s.start], a = [0, 0], b = [0, 0], path = [[...p]];
  let doneAt = null;
  for (let t = 1; t <= MAX_STEPS; t++) {
    const g = s.g(p[0], p[1]);
    for (let i = 0; i < 2; i++) {
      if (o.id === 'sgd') p[i] -= o.lr * g[i];
      else if (o.id === 'mom') { a[i] = 0.9 * a[i] + g[i]; p[i] -= o.lr * a[i]; }
      else if (o.id === 'rms') { b[i] = 0.9 * b[i] + 0.1 * g[i] ** 2; p[i] -= o.lr * g[i] / (Math.sqrt(b[i]) + 1e-8); }
      else {
        a[i] = 0.9 * a[i] + 0.1 * g[i];
        b[i] = 0.999 * b[i] + 0.001 * g[i] ** 2;
        p[i] -= o.lr * (a[i] / (1 - 0.9 ** t)) / (Math.sqrt(b[i] / (1 - 0.999 ** t)) + 1e-8);
      }
    }
    path.push([...p]);
    doneAt = s.mins.some(([mx, my]) => Math.hypot(p[0] - mx, p[1] - my) < 0.08) ? doneAt ?? t : null;
  }
  return { path, doneAt };
}
const surfaceId = ref('ravine');
const surface = computed(() => surfaces[surfaceId.value]);
const runs = computed(() => Object.fromEntries(opts.map(o => [o.id, descend(surface.value, o)])));
const hidden = ref({});
const shownOpts = computed(() => opts.filter(o => !hidden.value[o.id]));
// the run ends a moment after the last shown ball arrives, or at MAX_STEPS if one never does
const endStep = computed(() => {
  const d = shownOpts.value.map(o => runs.value[o.id].doneAt);
  return d.length && d.every(v => v !== null) ? Math.min(MAX_STEPS, Math.max(...d) + 8) : MAX_STEPS;
});
const oStep = ref(0);
const oFinished = computed(() => oStep.value >= endStep.value);
const arrived = o => runs.value[o.id].doneAt !== null && oStep.value >= runs.value[o.id].doneAt;
const status = o => (arrived(o) ? `✓ step ${runs.value[o.id].doneAt}` : oFinished.value ? 'stuck' : 'rolling');
const best = computed(() => {
  if (!oFinished.value) return null;
  const done = shownOpts.value.filter(o => runs.value[o.id].doneAt !== null);
  return done.length ? done.reduce((a, b) => (runs.value[b.id].doneAt < runs.value[a.id].doneAt ? b : a)).id : null;
});
function showOpt(id, on) { hidden.value = { ...hidden.value, [id]: !on }; }

// heights scaled to 0 to H so every surface fills the same box
const GRID = 28, H = 0.75;
const mesh = computed(() => {
  const { f, span } = surface.value;
  const z = [];
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= GRID; i++) {
    z.push([]);
    for (let j = 0; j <= GRID; j++) {
      const v = f((j / GRID * 2 - 1) * span[0], (i / GRID * 2 - 1) * span[1]);
      z[i].push(v);
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
  }
  const height = (x, y) => H * (f(x, y) - lo) / (hi - lo);
  return { z: z.map(row => row.map(v => H * (v - lo) / (hi - lo))), height };
});
// the camera orbits the middle of the box: yaw turns it, pitch tilts it toward looking down
const cam = { yaw: -0.65, pitch: 0.6 };
let view = { w: 0, h: 0 };
function project(X, Y, Z) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const xr = X * cy - Y * sy, yr = X * sy + Y * cy, z = Z - H / 2;
  const up = z * cp + yr * sp, depth = yr * cp - z * sp;
  const k = 4 / (4 + depth), s = Math.min(view.w * 0.3, view.h * 0.5);
  return [view.w / 2 + xr * k * s, view.h * 0.54 - up * k * s, depth, k * s];
}
// light from up and to the left, fixed to the surface so the shading turns with it
const LIGHT = (() => { const l = [-0.5, -0.6, 0.8], n = Math.hypot(...l); return l.map(v => v / n); })();
const rgb = hex => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map(c => c + c).join('') : h;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
};
// the same colors the other figures use, read fresh each draw so a theme switch carries over:
// the cells of fig 4 for the surface, tinted navy where the loss is low
function palette(el) {
  const css = getComputedStyle(el);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    ink: v('--ink', '#171717'), muted: v('--muted', '#555'), line: v('--d-line', '#bbb'),
    high: rgb(v('--d-page-alt', '#fffdf2')), low: rgb(dark ? '#2c3566' : '#b9c3ea'),
    balls: { sgd: '#c0392b', mom: '#e8a33d', rms: dark ? '#8ca0ff' : '#000080', adam: '#1baf7a' },
  };
}
const canvasEl = ref(null), viewEl = ref(null);
function drawOptim() {
  const canvas = canvasEl.value;
  if (!canvas || !view.w) return;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio || 1;
  const pal = palette(canvas);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);
  const { z, height } = mesh.value;
  const { span } = surface.value;
  const toBox = (x, y) => [Math.max(-1, Math.min(1, x / span[0])), Math.max(-1, Math.min(1, y / span[1]))];
  const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  // the axes go in first so the surface covers whatever's behind it
  ctx.strokeStyle = pal.muted;
  ctx.lineWidth = 1;
  const axes = [[[-1.25, 0, 0], [1.25, 0, 0], 'w₁'], [[0, -1.25, 0], [0, 1.25, 0], 'w₂'], [[0, 0, 0], [0, 0, H + 0.45], 'loss']];
  for (const [a, b] of axes) line(project(...a), project(...b));
  // painter's algorithm: every quad, trail dot, ball and goal ring sorted far to near
  const items = [];
  const step = 2 / GRID;
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const X = -1 + j * step, Y = -1 + i * step;
      const c = [[X, Y, z[i][j]], [X + step, Y, z[i][j + 1]], [X + step, Y + step, z[i + 1][j + 1]], [X, Y + step, z[i + 1][j]]];
      const pts = c.map(p => project(...p));
      // the normal from the quad's two diagonals
      const d1 = [step, step, c[2][2] - c[0][2]], d2 = [-step, step, c[3][2] - c[1][2]];
      const n = [d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0]];
      const shade = Math.max(0, (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / Math.hypot(...n));
      const t = Math.sqrt((c[0][2] + c[1][2] + c[2][2] + c[3][2]) / 4 / H), lit = 0.84 + 0.16 * shade;
      const fill = pal.low.map((lo, k) => (lo + (pal.high[k] - lo) * t) * lit | 0);
      items.push({ d: (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4, pts, fill: `rgb(${fill})` });
    }
  }
  const onSurface = (x, y, lift) => { const [X, Y] = toBox(x, y); return project(X, Y, height(x, y) + lift); };
  for (const [mx, my] of surface.value.mins) {
    const p = onSurface(mx, my, 0.01);
    items.push({ d: p[2] - 0.03, ring: p });
  }
  for (const o of shownOpts.value) {
    const path = runs.value[o.id].path;
    const last = Math.min(oStep.value, path.length - 1);
    for (let t = 0; t <= last; t++) {
      const p = onSurface(path[t][0], path[t][1], t === last ? 0.04 : 0.012);
      items.push({ d: p[2] - (t === last ? 0.06 : 0.03), dot: p, color: pal.balls[o.id], ball: t === last, r: (t === last ? 0.045 : 0.014) * p[3] });
    }
  }
  items.sort((a, b) => b.d - a.d);
  for (const it of items) {
    if (it.pts) {
      ctx.fillStyle = it.fill;
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      it.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (it.ring) {
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(it.ring[0], it.ring[1], 0.06 * it.ring[3], 0.06 * it.ring[3] * Math.sin(cam.pitch), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.arc(it.dot[0], it.dot[1], Math.max(1.5, it.r), 0, Math.PI * 2);
      ctx.fill();
      // the ball itself gets an outline, like the nodes in fig 2
      if (it.ball) { ctx.strokeStyle = pal.ink; ctx.lineWidth = 1; ctx.stroke(); }
    }
  }
  ctx.fillStyle = pal.muted;
  ctx.font = '10px "Courier New", monospace';
  ctx.textAlign = 'center';
  for (const [, b, label] of axes) { const p = project(...b); ctx.fillText(label, p[0], p[1] - 5); }
}
let drawQueued = false;
function requestDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; drawOptim(); });
}
watch([oStep, surfaceId, hidden], requestDraw);

// steps play back at a steady rate, so a slow optimizer visibly takes longer
const RATE = 24;
const oPlaying = ref(false);
let oRaf, oLast, oClock = 0, userPaused = false;
function oFrame(now) {
  if (oLast !== undefined) oClock += (now - oLast) / 1000;
  oLast = now;
  oStep.value = Math.min(endStep.value, Math.floor(oClock * RATE));
  if (oFinished.value) { oPlaying.value = false; return; }
  oRaf = requestAnimationFrame(oFrame);
}
function playOptim() {
  if (oFinished.value) oStep.value = 0;
  oClock = oStep.value / RATE;
  oLast = undefined;
  oPlaying.value = true;
  userPaused = false;
  cancelAnimationFrame(oRaf);
  oRaf = requestAnimationFrame(oFrame);
}
function pauseOptim() { oPlaying.value = false; cancelAnimationFrame(oRaf); }
function toggleOptim() { if (oPlaying.value) { pauseOptim(); userPaused = true; } else playOptim(); }
function restartOptim() { oStep.value = 0; playOptim(); }
function pickSurface(id) {
  surfaceId.value = id;
  if (reducedMotion()) { pauseOptim(); oStep.value = endStep.value; } else restartOptim();
}
// drag to orbit. on a touchscreen only sideways drags turn it, so the page still scrolls
let drag = null;
function grab(e) { drag = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }
function turn(e) {
  if (!drag) return;
  cam.yaw -= (e.clientX - drag.x) * 0.01;
  if (e.pointerType === 'mouse') cam.pitch = Math.max(0.2, Math.min(1.3, cam.pitch + (e.clientY - drag.y) * 0.01));
  drag = { x: e.clientX, y: e.clientY };
  requestDraw();
}
function release() { drag = null; }
const optimRoot = ref(null);
const optimInView = props.figure === 'optim' ? useInView(optimRoot) : null;
if (optimInView) {
  watch(optimInView, on => {
    if (!on) { if (oPlaying.value) { pauseOptim(); userPaused = false; } return; }
    if (!reducedMotion() && !userPaused && !oFinished.value && !oPlaying.value) playOptim();
  });
}
let resizer, themeWatch;
onMounted(() => {
  if (props.figure !== 'optim') return;
  themeWatch = new MutationObserver(requestDraw);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  // with reduced motion it opens on the finished race and only moves if you press play
  if (reducedMotion()) oStep.value = endStep.value;
  resizer = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    const dpr = devicePixelRatio || 1;
    view = { w: width, h: height };
    canvasEl.value.width = Math.round(width * dpr);
    canvasEl.value.height = Math.round(height * dpr);
    drawOptim();
  });
  resizer.observe(viewEl.value);
});
onBeforeUnmount(() => { cancelAnimationFrame(oRaf); resizer?.disconnect(); themeWatch?.disconnect(); });
</script>

<template>
  <figure v-if="figure === 'train'" ref="root" class="mm-figure" :class="{ 'mm-preview': preview }">
    <figcaption><strong>Fig. 1</strong> Training the 784-256-128-10 MLP on MNIST. Real test digits go forward, gradients come back, Adam steps, and the GPU races the CPU through 10 epochs.</figcaption>
    <div class="mm-panel">
      <svg class="mm-net" viewBox="0 0 380 150" aria-hidden="true">
        <rect class="mm-digit-bg" x="7" y="21" width="86" height="86"/>
        <path class="mm-digit" :d="digitPath(sample)"/>
        <path v-for="(d, k) in wires" :key="k" class="mm-wires" :class="wireClass(k)" :d="d"/>
        <g v-for="(l, j) in layers" :key="j">
          <circle v-for="i in l.n" :key="i" class="mm-neuron" :class="{ on: layerOn(j + 1) }" :cx="l.x" :cy="dotY(l.n, i - 1)" r="3.5"
            :style="{ opacity: layerOn(j + 1) ? activation(sample.label, j, i) : 1 }"/>
        </g>
        <g v-for="d in 10" :key="d" class="mm-out" :class="{ target: d - 1 === sample.label && layerOn(4.5) }">
          <rect x="300" :y="outY(d - 1)" width="11" height="10"/>
          <text x="305.5" :y="outY(d - 1) + 8">{{ d - 1 }}</text>
          <rect class="mm-prob" x="315" :y="outY(d - 1) + 2.5" :width="layerOn(4) ? 34 * (d - 1 === sample.label ? pLabel : (1 - pLabel) / 9) : 0" height="5"/>
          <text v-if="d - 1 === sample.label && layerOn(4)" class="mm-pct" :x="318 + 34 * pLabel" :y="outY(d - 1) + 8">{{ Math.round(pLabel * 100) }}%</text>
        </g>
        <g v-for="c in columns" :key="c.x" class="mm-col">
          <text :x="c.x" y="134">{{ c.name }}</text>
          <text class="mm-layer" :x="c.x" y="146">{{ c.size }}</text>
        </g>
      </svg>
      <div class="mm-stage">
        <ol class="mm-phases" aria-label="Each batch">
          <li v-for="(s, i) in stages" :key="s.id" :class="[s.id, { on: stageIndex === i }]"><span>{{ s.name }}</span></li>
        </ol>
        <p>{{ stageNote }}</p>
      </div>
      <div class="mm-race">
        <span>GPU</span><span class="mm-bar"><i :style="{ width: `${gpuEpochs * 10}%` }"/></span><code>{{ Math.floor(gpuEpochs) }}/10 epochs</code>
        <span>CPU</span><span class="mm-bar cpu"><i :style="{ width: `${cpuEpochs * 10}%` }"/></span><code>{{ Math.floor(cpuEpochs) }}/10 epochs</code>
      </div>
      <div class="mm-curve">
        <svg viewBox="0 0 220 64" aria-hidden="true">
          <path class="mm-axis" d="M30 6V50H202"/>
          <text class="mm-tick" x="27" y="11" text-anchor="end">0.3</text>
          <text class="mm-tick" x="27" y="52" text-anchor="end">0</text>
          <text class="mm-tick" x="2" y="31">loss</text>
          <text v-for="e in [1, 5, 10]" :key="e" class="mm-tick" :x="lossX(e - 1)" y="61" text-anchor="middle">{{ e }}</text>
          <text class="mm-tick" x="150" y="61" text-anchor="middle">epoch</text>
          <polyline class="mm-guide" :points="lossGuide"/>
          <polyline :points="lossLine"/>
          <circle v-for="(p, e) in lossPts.slice(0, trained)" :key="e" :cx="p[0]" :cy="p[1]" :r="e === trained - 1 ? 3 : 1.6"/>
        </svg>
        <p>
          <template v-if="trained">Epoch {{ trained }} · loss <code>{{ losses[trained - 1].toFixed(4) }}</code> · test accuracy <code>{{ accs[trained - 1] }}%</code></template>
          <template v-else>Epoch 0 · untrained, so a guess out of 10</template>
          <br><small>{{ sim.toFixed(2) }} s on an RTX 4080 laptop GPU. One CPU thread needs {{ (CPU * EPOCHS).toFixed(1) }} s for all 10 epochs, about 16× longer.</small>
        </p>
      </div>
      <div class="mm-buttons">
        <button class="raised mm-button" @click="playing ? stop() : play()">{{ playing ? 'Pause' : 'Play' }}</button>
        <button class="raised mm-button" @click="restart">Restart</button>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'layer'" class="mm-figure">
    <figcaption><strong>Fig. 2</strong> What one layer computes, shrunk to four pixels and three neurons. Each neuron weighs every pixel, adds them up with a bias, and keeps the total only if it’s positive, a step called ReLU. Stacking the weights into a matrix does every neuron at once.</figcaption>
    <div class="mm-panel">
      <p class="mm-part"><b>① One neuron.</b> Click a neuron to follow it, or a pixel to change how bright it is.</p>
      <div class="mm-layer-views">
        <svg class="mm-layer-net" viewBox="0 0 180 168" role="group" aria-label="The layer as a network">
          <text class="mm-head" x="30" y="10">pixels</text>
          <text class="mm-head" x="148" y="10">neurons</text>
          <path v-for="e in weightEdges" :key="`${e.j}-${e.k}`" class="mm-weight" :class="{ neg: e.w < 0, on: e.on }" :d="e.d" :stroke-width="0.6 + 2.6 * Math.abs(e.w)"/>
          <g v-for="l in weightLabels" :key="l.k" class="mm-wlabel" :class="{ neg: l.w < 0 }">
            <rect :x="l.x - 13" :y="l.y - 9" width="26" height="12"/>
            <text :x="l.x" :y="l.y">{{ num(l.w) }}</text>
          </g>
          <g v-for="(v, k) in pixels" :key="k" class="mm-pixel" role="button" tabindex="0" :aria-label="`Pixel ${k + 1}, brightness ${num(v)}`"
            @click="cyclePixel(k)" @keydown.enter.space.prevent="cyclePixel(k)">
            <rect x="18" :y="pixelY(k) - 12" width="24" height="24" :style="{ fill: grey(v) }"/>
            <text x="30" :y="pixelY(k) + 4" :class="{ dark: v > 0.6 }">{{ num(v) }}</text>
          </g>
          <g v-for="(o, j) in outs" :key="j" class="mm-pick" :class="{ on: j === picked }" role="button" tabindex="0" :aria-label="`Neuron ${j + 1}, output ${num(o)}`" :aria-pressed="j === picked"
            @click="picked = j" @keydown.enter.space.prevent="picked = j">
            <circle cx="148" :cy="neuronY(j)" r="15"/>
            <text x="148" :y="neuronY(j) + 4">{{ num(o) }}</text>
          </g>
        </svg>
        <table class="mm-receipt" aria-live="polite">
          <caption>The highlighted neuron</caption>
          <tbody>
            <tr v-for="t in receipt.terms" :key="t.k">
              <th>pixel {{ t.k + 1 }}</th><td>{{ num(t.a) }} × {{ num(t.w) }}</td><td class="n">{{ num(t.v) }}</td>
              <td class="mm-rbar"><i :class="{ neg: t.v < 0 }" :style="bar(t.v)"/></td>
            </tr>
            <tr>
              <th>bias</th><td/><td class="n">{{ num(receipt.b) }}</td>
              <td class="mm-rbar"><i :class="{ neg: receipt.b < 0 }" :style="bar(receipt.b)"/></td>
            </tr>
            <tr class="sum">
              <th>sum</th><td/><td class="n">{{ num(receipt.z) }}</td>
              <td class="mm-rbar"><i :class="{ neg: receipt.z < 0 }" :style="bar(receipt.z)"/></td>
            </tr>
            <tr class="out">
              <th>output</th><td colspan="3">{{ receipt.z > 0 ? 'positive, so ReLU keeps it:' : 'negative, so ReLU makes it' }} <b>{{ num(receipt.out) }}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul class="mm-legend" aria-label="Key">
        <li><i class="pos"/>positive weight</li>
        <li><i class="negw"/>negative weight</li>
        <li>thicker line = bigger weight</li>
      </ul>
      <p class="mm-part"><b>② The whole layer at once.</b> Write each neuron’s weights as one row and you get the matrix W. Multiplying W by the pixels works out every neuron’s sum in one go, which is the matrix multiply the GPU section makes fast.</p>
      <div class="mm-layer-views">
        <svg class="mm-layer-eq" viewBox="0 20 250 112" role="group" aria-label="The layer as W times a plus b">
          <text class="mm-head" x="52" y="32">weights W</text>
          <text class="mm-head" x="128" y="32">pixels</text>
          <text class="mm-head" x="170" y="32">bias</text>
          <text class="mm-head" x="226" y="32">output</text>
          <template v-for="(row, j) in layerW" :key="j">
            <g v-for="(w, k) in row" :key="k" class="mm-mcell mm-pick-row" :class="{ on: j === picked }" @click="picked = j">
              <rect :x="4 + k * cellW" :y="rowY(j)" :width="cellW" :height="cellH" :style="{ fill: wFill(w) }"/>
              <text :x="16 + k * cellW" :y="rowY(j) + 15">{{ num(w) }}</text>
            </g>
          </template>
          <g v-for="(v, k) in pixels" :key="k" class="mm-mcell">
            <rect x="116" :y="colY(k)" :width="cellW" :height="cellH" :style="{ fill: grey(v) }"/>
            <text x="128" :y="colY(k) + 15" :class="v < 0.6 ? 'light' : 'dark'">{{ num(v) }}</text>
          </g>
          <g v-for="(b, j) in layerB" :key="j" class="mm-mcell" :class="{ on: j === picked }">
            <rect x="158" :y="rowY(j)" :width="cellW" :height="cellH"/>
            <text x="170" :y="rowY(j) + 15">{{ num(b) }}</text>
          </g>
          <g v-for="(o, j) in outs" :key="j" class="mm-mcell" :class="{ on: j === picked }">
            <rect x="214" :y="rowY(j)" :width="cellW" :height="cellH"/>
            <text x="226" :y="rowY(j) + 15">{{ num(o) }}</text>
          </g>
          <text class="mm-op" x="108" y="90">·</text>
          <text class="mm-op" x="149" y="89">+</text>
          <text class="mm-relu" x="197" y="78">ReLU</text>
          <path class="mm-relu-arrow" d="M188 84h16M200 80l4 4-4 4"/>
        </svg>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'graph'" class="mm-figure">
    <figcaption><strong>Fig. 3</strong> The forward and backward pass through y = (x·w + x)·(x + w). x feeds three operations and w feeds two, so their gradients have to be added up.</figcaption>
    <div class="mm-panel">
      <svg class="mm-graph" viewBox="0 0 400 204" aria-hidden="true">
        <defs>
          <marker id="mm-arrow" viewBox="0 0 6 6" refX="0.75" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L6 3L0 6z"/></marker>
          <marker id="mm-arrow-lit" viewBox="0 0 6 6" refX="0.75" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L6 3L0 6z"/></marker>
          <marker id="mm-arrow-fwd" viewBox="0 0 6 6" refX="0.75" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L6 3L0 6z"/></marker>
          <marker id="mm-arrow-back" viewBox="0 0 6 6" refX="0.75" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L6 3L0 6z"/></marker>
        </defs>
        <g class="mm-pass" :class="{ on: step < BACKWARD }">
          <text x="90" y="12">Forward pass</text>
          <path d="M60 22H120M115 19L120 22L115 25"/>
        </g>
        <g class="mm-pass back" :class="{ on: step >= BACKWARD }">
          <text x="310" y="12">Backward pass</text>
          <path d="M340 22H280M285 19L280 22L285 25"/>
        </g>
        <text class="mm-key" x="290" y="196"><tspan class="mm-val">= value</tspan><tspan dx="10" class="mm-grad">grad = dy/d(node)</tspan></text>
        <g class="mm-edges">
          <path v-for="e in edges" :key="e.id" :d="edgePath(e)" :class="{ lit: lit(e.id) }" :marker-end="step >= BACKWARD ? null : lit(e.id) ? 'url(#mm-arrow-lit)' : 'url(#mm-arrow)'" :marker-start="step >= BACKWARD ? 'url(#mm-arrow-lit)' : null"/>
        </g>
        <g class="mm-flow">
          <template v-for="e in flowing" :key="`${step}-${e.id}`">
            <path :d="e.d" :class="{ back: e.back }" pathLength="1"/>
            <path class="mm-flow-head" :d="e.d" :marker-end="e.back ? null : 'url(#mm-arrow-fwd)'" :marker-start="e.back ? 'url(#mm-arrow-back)' : null"/>
          </template>
        </g>
        <g v-for="(n, id) in nodes" :key="id" class="mm-node" :class="{ on: shown(id), now: working(id), back: step >= BACKWARD }">
          <text v-if="n.op" class="mm-expr" :x="n.x" :y="n.y - 20">{{ n.op }}</text>
          <circle :cx="n.x" :cy="n.y" r="14"/>
          <text class="mm-name" :x="n.x" :y="n.y + 4">{{ id }}</text>
          <text v-if="shown(id)" class="mm-val" :x="n.x" :y="n.y + 27">= {{ fmt(vals[id]) }}</text>
          <text v-if="nodeGrad(id) !== null" class="mm-grad" :x="n.x" :y="n.y + 37">grad {{ fmt(nodeGrad(id)) }}</text>
        </g>
      </svg>
      <ol class="mm-track" aria-label="Steps">
        <li v-for="(s, i) in steps" :key="i">
          <button :class="{ back: i >= BACKWARD, on: i === step, past: i < step }" :aria-label="`Step ${i + 1}`" :aria-current="i === step ? 'step' : null" @click="goGraph(i)"/>
        </li>
      </ol>
      <p class="mm-note" aria-live="polite"><b>{{ step + 1 }}/{{ steps.length }}</b> {{ at.note }}</p>
      <div class="mm-ledger">
        <p v-for="leaf in leaves" :key="leaf.id" class="mm-sum">
          <span>{{ leaf.id }}.grad =</span>
          <template v-if="contributions(leaf.id).length">
            <code>{{ contributions(leaf.id).map(c => (c < 0 ? `(${fmt(c)})` : fmt(c))).join(' + ') }}</code>
            <b v-if="contributions(leaf.id).length > 1">= {{ fmt(gradOf(leaf.id)) }}</b>
          </template>
          <code v-else>—</code>
          <span v-if="done" class="mm-check">✓ matches {{ leaf.formula }} = {{ fmt(leaf.right) }}</span>
        </p>
      </div>
      <div class="mm-buttons">
        <button class="raised mm-button" @click="toggleGraph">{{ graphPlaying ? 'Pause' : 'Play' }}</button>
        <button class="raised mm-button" :disabled="step === 0" @click="goGraph(step - 1)">Back</button>
        <button class="raised mm-button" :disabled="done" @click="goGraph(step + 1)">Step</button>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'tiles'" class="mm-figure">
    <figcaption><strong>Fig. 4</strong> Why the matmul kernel works in tiles. Step through it, or click another 2 × 2 patch of C to follow that one.</figcaption>
    <div class="mm-panel">
      <div class="mm-scroll">
        <svg class="mm-tiles" viewBox="0 0 334 182" role="group" aria-label="Matrices">
          <text class="mm-mem" x="167" y="9">GPU main memory: big, but slow to read</text>
          <g v-for="(gd, m) in grids" :key="m">
            <text class="mm-label" :x="gd.x + N * cell / 2" y="24">{{ gd.label }}</text>
            <template v-for="r in range" :key="r">
              <rect v-for="c in range" :key="c" class="mm-cell" :class="cellClass(m, r, c)" :style="m === 'c' ? cFill(r, c) : null"
                :x="gd.x + c * cell" :y="GY + r * cell" :width="cell - 1" :height="cell - 1"
                @click="m === 'c' && pick(Math.floor(r / T), Math.floor(c / T))"/>
            </template>
          </g>
          <text class="mm-op" x="106" :y="GY + 50">·</text>
          <text class="mm-op" x="218" :y="GY + 50">=</text>
          <g class="mm-shared" :class="{ on: loading }">
            <rect class="mm-shelf" x="64" y="126" width="206" height="52"/>
            <text class="mm-mem" x="167" y="173">shared memory: small, but fast</text>
            <template v-if="loading">
              <path v-for="(s, m) in slots" :key="m" class="mm-load"
                :d="`M${tileAt[m][0] + cell} ${tileAt[m][1] + T * cell}L${s + cell - 1} ${SLOT_Y - 2}`"/>
            </template>
            <template v-for="(s, m) in slots" :key="m">
              <template v-for="r in tileRange" :key="r">
                <rect v-for="c in tileRange" :key="c" class="mm-cell" :class="{ now: loading }"
                  :x="s + c * cell" :y="SLOT_Y + r * cell" :width="cell - 1" :height="cell - 1"/>
              </template>
            </template>
            <text class="mm-op small" x="166" :y="SLOT_Y + 16">·</text>
          </g>
        </svg>
      </div>
      <ul class="mm-legend" aria-label="Key">
        <li><i class="need"/>needed for this patch</li>
        <li><i class="now"/>in shared memory now</li>
        <li><i class="seen"/>already used</li>
        <li><i class="out"/>the patch of C</li>
      </ul>
      <ol class="mm-track" aria-label="Steps">
        <li v-for="i in TLAST + 1" :key="i">
          <button :class="{ back: i - 1 >= PHASE0 && i - 1 < TLAST, on: i - 1 === tStep, past: i - 1 < tStep }" :aria-label="`Step ${i}`" :aria-current="i - 1 === tStep ? 'step' : null" @click="goTiles(i - 1)"/>
        </li>
      </ol>
      <p class="mm-note" aria-live="polite"><b>{{ tStep + 1 }}/{{ TLAST + 1 }}</b> {{ tileNote }}</p>
      <div v-if="tStep >= 2" class="mm-bars">
        <span>Without tiles</span><span class="mm-bar slow"><i style="width: 100%"/></span><code>{{ naive }} reads</code>
        <span>Tiled</span><span class="mm-bar tiled"><i :style="{ width: `${tiledSoFar / naive * 100}%` }"/></span><code>{{ tiledSoFar }} reads</code>
      </div>
      <div class="mm-buttons">
        <button class="raised mm-button" @click="toggleTiles">{{ tilesPlaying ? 'Pause' : 'Play' }}</button>
        <button class="raised mm-button" :disabled="tStep === 0" @click="goTiles(tStep - 1)">Back</button>
        <button class="raised mm-button" :disabled="tStep === TLAST" @click="goTiles(tStep + 1)">Step</button>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'optim'" ref="optimRoot" class="mm-figure">
    <figcaption><strong>Fig. 5</strong> SGD, Momentum, RMSProp and Adam rolling down the same loss from the same spot, each with one learning rate it keeps on every surface. Drag to turn it.</figcaption>
    <div class="mm-panel">
      <span class="mm-toggle mm-surfaces" role="group" aria-label="Loss surface">
        <button v-for="(s, id) in surfaces" :key="id" class="raised mm-button" :class="{ pressed: surfaceId === id }" :aria-pressed="surfaceId === id" @click="pickSurface(id)">{{ s.name }}</button>
      </span>
      <div ref="viewEl" class="mm-view">
        <canvas ref="canvasEl" role="img" :aria-label="`${surface.name} loss surface with the optimizers' paths`"
          @pointerdown="grab" @pointermove="turn" @pointerup="release" @pointercancel="release"/>
      </div>
      <p class="mm-note" aria-live="polite"><b>step {{ oStep }}</b> {{ surface.note }}</p>
      <div class="mm-rules">
        <div v-for="o in opts" :key="o.id" class="mm-rule" :class="{ best: best === o.id }">
          <label class="mm-check-box">
            <input type="checkbox" :checked="!hidden[o.id]" @change="showOpt(o.id, $event.target.checked)">
            <i :class="o.id"/>{{ o.name }}
          </label>
          <code class="mm-formula">{{ o.rule }}</code>
          <code class="mm-status" :class="{ done: arrived(o), stuck: oFinished && !arrived(o) }">{{ hidden[o.id] ? '' : status(o) }}</code>
        </div>
      </div>
      <div class="mm-buttons">
        <button class="raised mm-button" @click="toggleOptim">{{ oPlaying ? 'Pause' : 'Play' }}</button>
        <button class="raised mm-button" @click="restartOptim">Restart</button>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'epsilon'" class="mm-figure">
    <figcaption><strong>Fig. 6</strong> One Adam step on a weight with a steady gradient, the way PyTorch and Keras each add epsilon (1e-8).</figcaption>
    <div class="mm-panel">
      <div class="mm-sliders">
        <label>Gradient size g <code>{{ sci(g) }}</code><input v-model.number="gExp" type="range" min="-10" max="-2" step="0.5" aria-label="Gradient size"></label>
        <label>Adam step t <code>{{ t }}</code><input v-model.number="tIndex" type="range" min="0" :max="tChoices.length - 1" step="1" aria-label="Step number"></label>
      </div>
      <svg ref="epsChart" class="mm-eps" viewBox="0 0 400 162" aria-hidden="true" @pointerdown="pickGradient" @pointermove="pickGradient">
        <path class="mm-gridline" :d="`M44 ${EY(1)}H388M44 ${EY(0.5)}H388`"/>
        <path class="mm-axis" d="M44 10V134H388"/>
        <text class="mm-tick" x="4" y="8">step ÷ lr</text>
        <text v-for="s in [0, 0.5, 1]" :key="s" class="mm-tick" x="40" :y="EY(s) + 3" text-anchor="end">{{ s }}</text>
        <text v-for="e in [-10, -8, -6, -4, -2]" :key="e" class="mm-tick" :x="EX(e)" y="146" text-anchor="middle">1e{{ e }}</text>
        <text class="mm-tick" x="216" y="159" text-anchor="middle">gradient size, log scale</text>
        <path class="mm-eps-mark" :d="`M${EX(-8)} ${EY(0.5)}V134`"/>
        <path class="mm-eps-mark keras" :d="`M${EX(Math.log10(keraEps))} ${EY(0.5)}V134`"/>
        <text class="mm-eps-name" :x="EX(-8) - 4" y="128" text-anchor="end">ε</text>
        <text class="mm-eps-name keras" :x="EX(Math.log10(keraEps)) + 4" y="128">εₖ</text>
        <polyline class="mm-curve-torch" :points="torchCurve"/>
        <polyline class="mm-curve-keras" :points="kerasCurve"/>
        <path class="mm-now-line" :d="`M${EX(gExp)} 10V134`"/>
        <circle class="mm-dot-torch" :cx="EX(gExp)" :cy="EY(torchStep / LR)" r="4"/>
        <circle class="mm-dot-keras" :cx="EX(gExp)" :cy="EY(kerasStep / LR)" r="4"/>
        <g class="mm-eps-key">
          <path class="mm-curve-torch" d="M300 104h16"/><text x="320" y="107">PyTorch</text>
          <path class="mm-curve-keras" d="M300 118h16"/><text x="320" y="121">Keras</text>
        </g>
      </svg>
      <div class="mm-readout">
        <span class="torch">PyTorch</span><code>lr · m / (√v + ε)</code><b>{{ sci(torchStep) }}</b>
        <span class="keras">Keras</span><code>lr · m / (√v + εₖ), εₖ = ε / √(1 − β₂ᵗ) = {{ sci(keraEps) }}</code><b>{{ sci(kerasStep) }}</b>
      </div>
      <p class="mm-note" aria-live="polite">
        The steps differ by <b>{{ pct(gap) }}</b> <span class="mm-badge" :class="{ bad: gap > 1e-4 }">{{ gap > 1e-4 ? '✗ outside' : '✓ inside' }} the 1e-4 test tolerance</span>
        {{ gap > 1e-4 ? 'Keras adds ε before the bias correction, which works out to a bigger εₖ after it, so its curve sits to the right and tiny gradients early in training get a smaller step.' : 'Once the gradient dwarfs both epsilons, or t is large enough that εₖ shrinks back to ε, they agree.' }}
      </p>
    </div>
  </figure>
</template>

<style scoped>
.mm-figure { margin: 18px 0 22px; font-family: 'Pixel MS Sans Serif', Tahoma, sans-serif; container-type: inline-size; }
.mm-figure figcaption { margin-bottom: 8px; font-size: 12px; color: var(--muted); }
.mm-figure figcaption strong { color: var(--ink); margin-right: 4px; }
.mm-panel { --sunk-edge: var(--shadow); padding: 12px; background: var(--paper); border: 2px solid; border-color: var(--edge) var(--sunk-edge) var(--sunk-edge) var(--edge); box-shadow: inset 1px 1px var(--shadow); }
:root[data-theme="dark"] .mm-panel { --sunk-edge: var(--light); }
.mm-button { padding: 3px 10px; font: 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--ink); }
.mm-buttons { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.mm-toggle { display: inline-flex; gap: 0; }
.mm-check-box { display: inline-flex; align-items: center; gap: 4px; margin-left: 4px; font-size: 12px; }
.mm-note { min-height: 2.8em; margin: 10px 0 8px; font-size: 13px; line-height: 1.45; }
.mm-note > b:first-child { margin-right: 6px; font: bold 11px 'Courier New', monospace; color: var(--muted); }
.mm-note code, .mm-sum code, .mm-sliders code, .mm-bars code { font: bold 12px 'Courier New', monospace; color: var(--d-link, #000080); }

/* fig 1: the network, the race, and the loss curve */
.mm-net { display: block; width: 100%; max-width: 600px; margin: 0 auto; }
.mm-col text { font: bold 10px 'Pixel MS Sans Serif', Tahoma, sans-serif; fill: var(--ink); text-anchor: middle; }
.mm-pct, .mm-out.target .mm-pct { font: bold 9px 'Courier New', monospace; fill: #1baf7a; text-anchor: start; }
.mm-digit-bg { fill: #000; }
.mm-digit { fill: #fff; }
.mm-layer { font: 9px 'Courier New', monospace; fill: var(--muted); text-anchor: middle; }
.mm-wires { fill: none; stroke: var(--d-line, #bbb); stroke-width: .4; opacity: .5; transition: stroke .15s, opacity .15s; }
.mm-wires.fwd { stroke: var(--navy, #000080); opacity: .8; }
.mm-wires.back { stroke: #1baf7a; stroke-width: .7; opacity: 1; }
.mm-wires.step { stroke: #e8a33d; opacity: 1; }
.mm-neuron { fill: var(--d-page-alt, #fffdf2); stroke: var(--muted); stroke-width: 1; transition: fill .15s; }
.mm-neuron.on { fill: var(--navy, #000080); stroke: var(--navy, #000080); }
.mm-out rect:first-child { fill: var(--d-page-alt, #fffdf2); stroke: var(--muted); stroke-width: 1; }
.mm-out text { font: bold 9px 'Courier New', monospace; fill: var(--ink); text-anchor: middle; }
.mm-out.target rect:first-child { fill: #1baf7a; stroke: #1baf7a; }
.mm-out.target text { fill: #fff; }
.mm-prob { fill: var(--navy, #000080); transition: width .3s; }
.mm-out.target .mm-prob { fill: #1baf7a; }
:root[data-theme="dark"] .mm-wires.fwd { stroke: #8ca0ff; }
:root[data-theme="dark"] .mm-neuron.on { fill: #8ca0ff; stroke: #8ca0ff; }
:root[data-theme="dark"] .mm-out:not(.target) .mm-prob { fill: #8ca0ff; }
/* the four parts of a batch as a row of chips, lit one at a time in their wires' colours */
.mm-stage { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 8px 0 10px; }
.mm-stage p { margin: 0; font-size: 13px; }
.mm-phases { display: flex; flex-wrap: wrap; gap: 2px; margin: 0; padding: 0; list-style: none; font-size: 11px; }
.mm-phases li { --c: var(--navy, #000080); display: flex; align-items: center; }
.mm-phases li:not(:last-child)::after { content: '→'; margin: 0 2px; color: var(--muted); }
.mm-phases span { padding: 1px 6px; border: 1px solid var(--d-line, #999); color: var(--muted); }
.mm-phases li.on span { color: #fff; background: var(--c); border-color: var(--c); }
.mm-phases li.loss { --c: #c0392b; }
.mm-phases li.back { --c: #1baf7a; }
.mm-phases li.step { --c: #e8a33d; }
:root[data-theme="dark"] .mm-phases li.fwd { --c: #5b6fd6; }
.mm-race { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px 10px; align-items: center; font-size: 12px; }
.mm-race code { font: bold 12px 'Courier New', monospace; color: var(--d-link, #000080); }
.mm-race .mm-bar.cpu i { background: #e8a33d; }
.mm-curve { display: grid; grid-template-columns: minmax(150px, 220px) minmax(0, 1fr); gap: 12px; align-items: center; margin: 10px 0; font-size: 12px; }
.mm-curve svg { display: block; width: 100%; max-width: 300px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); }
.mm-curve polyline { fill: none; stroke: #1baf7a; stroke-width: 2; }
.mm-curve polyline.mm-guide { stroke: var(--d-line, #bbb); stroke-width: 1; stroke-dasharray: 2 2; }
.mm-curve circle { fill: #1baf7a; }
.mm-axis { fill: none; stroke: var(--muted); stroke-width: 1; }
.mm-tick { font: 8px 'Courier New', monospace; fill: var(--muted); }
.mm-curve p { margin: 0; line-height: 1.45; }
.mm-curve code { font: bold 12px 'Courier New', monospace; color: var(--d-link, #000080); }
.mm-curve small { color: var(--muted); }
@container (max-width: 420px) { .mm-curve { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .mm-wires, .mm-neuron, .mm-prob, .mm-bar i { transition: none; } }
/* the card preview: exactly the frame, the network on top and the race beside the loss
   curve under it */
.mm-preview .mm-panel { box-sizing: border-box; display: grid; grid-template: minmax(0, 1fr) auto auto / minmax(0, 1fr) minmax(0, 1fr); column-gap: 14px; height: 375px; }
.mm-preview .mm-net { grid-column: 1 / -1; width: 100%; height: 100%; max-width: none; }
.mm-preview .mm-stage { grid-column: 1 / -1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mm-preview .mm-race { row-gap: 12px; }
.mm-preview .mm-race .mm-bar { height: 22px; }
.mm-preview .mm-curve { grid-template-columns: minmax(0, 1fr); gap: 4px; margin: 0; }
.mm-preview .mm-curve svg { height: 56px; }
.mm-preview .mm-curve p { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mm-preview .mm-curve small, .mm-preview .mm-curve br, .mm-preview .mm-buttons { display: none; }

/* fig 2: the network and the matrices side by side, or stacked on a phone */
.mm-layer-views { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px 24px; }
.mm-layer-net { display: block; width: min(100%, 200px); }
.mm-layer-eq { display: block; width: min(100%, 300px); }
.mm-head { font: bold 10px 'Pixel MS Sans Serif', Tahoma, sans-serif; fill: var(--ink); text-anchor: middle; }
.mm-weight { fill: none; stroke: #5b84ff; opacity: .15; transition: opacity .15s; }
.mm-weight.neg { stroke: #e8a33d; }
.mm-weight.on { opacity: 1; }
.mm-pixel, .mm-pick, .mm-pick-row { cursor: var(--classic-pointer, pointer); outline: none; }
.mm-pixel rect { stroke: var(--muted); stroke-width: 1; }
.mm-pixel text, .mm-pick text, .mm-mcell text { font: bold 9px 'Courier New', monospace; text-anchor: middle; }
.mm-pixel text { fill: #fff; }
.mm-pixel text.dark { fill: #000; }
.mm-pixel:focus-visible rect, .mm-pick:focus-visible circle { stroke: var(--ink); stroke-width: 2; stroke-dasharray: 2 2; outline: none; }
.mm-pick circle { fill: var(--d-page-alt, #fffdf2); stroke: var(--muted); stroke-width: 2; }
.mm-pick.on circle { stroke: var(--ink); stroke-width: 3; }
.mm-pick text { fill: var(--ink); }
.mm-mcell rect { fill: var(--d-page-alt, #fffdf2); stroke: var(--d-line, #bbb); stroke-width: .75; }
.mm-mcell text { fill: var(--ink); }
.mm-mcell text.light { fill: #fff; }
.mm-mcell text.dark { fill: #000; }
.mm-mcell.on rect { stroke: var(--ink); stroke-width: 1.5; }
.mm-part { margin: 0 0 8px; font-size: 13px; line-height: 1.45; }
.mm-part + .mm-layer-views { margin-bottom: 4px; }
.mm-legend + .mm-part { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--d-line, #ccc); }
/* the picked neuron's weights sit on its edges in small boxes, so the lines don't cross them out */
.mm-wlabel rect { fill: var(--paper); stroke: #5b84ff; stroke-width: 1; }
.mm-wlabel text { font: bold 9px 'Courier New', monospace; fill: #3a5fd9; text-anchor: middle; }
.mm-wlabel.neg rect { stroke: #e8a33d; }
.mm-wlabel.neg text { fill: #c47f17; }
:root[data-theme="dark"] .mm-wlabel text { fill: #8ca0ff; }
:root[data-theme="dark"] .mm-wlabel.neg text { fill: #e8a33d; }
.mm-legend .pos { background: #5b84ff; }
.mm-legend .negw { background: #e8a33d; }
/* the receipt: one row per pixel's share of the sum, then the bias, the sum and the output */
.mm-receipt { border-collapse: collapse; font-size: 12px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); }
.mm-receipt caption { padding: 0 0 4px; font-weight: bold; text-align: left; }
.mm-receipt th, .mm-receipt td { padding: 3px 8px; text-align: left; font-weight: normal; white-space: nowrap; }
.mm-receipt th { color: var(--muted); }
.mm-receipt td { font: 12px 'Courier New', monospace; }
.mm-receipt td.n { text-align: right; font-weight: bold; }
.mm-receipt tr.sum { border-top: 1px solid var(--ink); }
.mm-receipt tr.sum th, .mm-receipt tr.out th { color: var(--ink); font-weight: bold; }
.mm-receipt tr.out td { font: 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; }
.mm-receipt tr.out b { font: bold 13px 'Courier New', monospace; }
.mm-rbar { position: relative; width: 70px; }
.mm-rbar::before { content: ''; position: absolute; left: 50%; top: 2px; bottom: 2px; border-left: 1px solid var(--d-line, #bbb); }
.mm-rbar i { position: absolute; top: 5px; bottom: 5px; background: #5b84ff; }
.mm-rbar i.neg { background: #e8a33d; }
.mm-relu { font: 9px 'Courier New', monospace; fill: var(--muted); text-anchor: middle; }
.mm-relu-arrow { fill: none; stroke: var(--muted); stroke-width: 1.2; }
@media (prefers-reduced-motion: reduce) { .mm-weight { transition: none; } }

/* fig 3 */
.mm-graph { display: block; width: 100%; max-width: 528px; margin: 0 auto; }
.mm-edges path { fill: none; stroke: var(--d-line, #888); stroke-width: 2; stroke-dasharray: 4 3; }
.mm-edges path.lit { stroke: var(--ink); stroke-dasharray: none; }
#mm-arrow path { fill: var(--d-line, #888); }
#mm-arrow-lit path { fill: var(--ink); }
/* the edges of the current step draw themselves in: forward from the tail, backward from the head */
.mm-flow path { fill: none; stroke: var(--navy, #000080); stroke-width: 3; stroke-dasharray: 1 1; animation: mm-draw .6s ease-out both; }
.mm-flow path.back { stroke: #1baf7a; animation-name: mm-undraw; }
:root[data-theme="dark"] .mm-flow path:not(.back):not(.mm-flow-head) { stroke: #8ca0ff; }
@keyframes mm-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes mm-undraw { from { stroke-dashoffset: -1; } to { stroke-dashoffset: 0; } }
/* the arrowhead it reaches fills in the same colour as the line lands: the head going
   forward, the tail going backward. same stroke width as the edge, so it covers its arrowhead */
.mm-flow path.mm-flow-head { stroke: none; stroke-width: 2; stroke-dasharray: none; animation: mm-head .15s .45s both; }
#mm-arrow-fwd path { fill: var(--navy, #000080); }
#mm-arrow-back path { fill: #1baf7a; }
:root[data-theme="dark"] #mm-arrow-fwd path { fill: #8ca0ff; }
@keyframes mm-head { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mm-flow path, .mm-flow path.mm-flow-head { animation: none; } }
.mm-pass text { fill: var(--muted); font: bold 10px 'Pixel MS Sans Serif', Tahoma, sans-serif; text-anchor: middle; }
.mm-pass path { fill: none; stroke: var(--muted); stroke-width: 1.5; }
.mm-pass.on text { fill: var(--ink); }
.mm-pass.on path { stroke: var(--ink); }
.mm-pass.back.on text { fill: #1baf7a; }
.mm-pass.back.on path { stroke: #1baf7a; }
.mm-node circle { fill: var(--d-page-alt, #fffdf2); stroke: var(--muted); stroke-width: 2; }
.mm-node.on circle { stroke: var(--ink); }
/* the node this step works on fills in the pass's colour */
.mm-node.now circle { fill: var(--navy, #000080); stroke: var(--navy, #000080); }
.mm-node.now.back circle { fill: #1baf7a; stroke: #1baf7a; }
.mm-node.now .mm-name { fill: #fff; }
:root[data-theme="dark"] .mm-node.now:not(.back) circle { fill: #5b6fd6; stroke: #5b6fd6; }
.mm-node text { fill: var(--ink); font: bold 11px 'Pixel MS Sans Serif', Tahoma, sans-serif; text-anchor: middle; }
.mm-node .mm-expr { font: 10px 'Courier New', monospace; }
.mm-graph .mm-val { font: bold 10px 'Courier New', monospace; fill: var(--muted); }
.mm-graph .mm-grad { font: bold 10px 'Courier New', monospace; fill: #1baf7a; }
.mm-key { text-anchor: middle; }
.mm-ledger { padding: 6px 10px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); margin-bottom: 10px; }
.mm-sum { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; margin: 0; font-size: 13px; }
.mm-sum + .mm-sum { margin-top: 4px; }
.mm-check { font-weight: bold; color: #1baf7a; }

/* a walkthrough's steps as a row of segments: done ones faded, the current one solid.
   forward steps are navy and backward ones green. click one to jump there */
.mm-track { display: flex; gap: 3px; margin: 10px 0 0; padding: 0; list-style: none; }
.mm-track li { flex: 1; }
.mm-track button { --c: var(--navy, #000080); display: block; width: 100%; height: 12px; padding: 0; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); cursor: var(--classic-pointer, pointer); }
.mm-track button.back { --c: #1baf7a; }
.mm-track button.past { background: var(--c); border-color: var(--c); opacity: .4; }
.mm-track button.on { background: var(--c); border-color: var(--ink); }
:root[data-theme="dark"] .mm-track button:not(.back) { --c: #5b6fd6; }

/* fig 4: scrolls sideways on a phone rather than shrinking to dots */
.mm-scroll { overflow-x: auto; }
.mm-tiles { display: block; width: 100%; min-width: 320px; max-width: 560px; margin: 0 auto; }
.mm-label { font: bold 11px 'Pixel MS Sans Serif', Tahoma, sans-serif; fill: var(--ink); text-anchor: middle; }
.mm-op { font: bold 18px 'Courier New', monospace; fill: var(--muted); text-anchor: middle; }
.mm-op.small { font-size: 14px; }
.mm-mem { font: 10px 'Courier New', monospace; fill: var(--muted); text-anchor: middle; }
.mm-shelf { fill: none; stroke: var(--d-line, #999); stroke-width: 1; stroke-dasharray: 3 2; }
.mm-shared.on .mm-shelf { stroke: #1baf7a; }
.mm-load { fill: none; stroke: #1baf7a; stroke-width: 1.2; stroke-dasharray: 3 2; }
.mm-cell { fill: var(--d-page-alt, #fffdf2); stroke: var(--d-line, #bbb); stroke-width: .5; }
.mm-cell.need { fill: #dde3f7; }
:root[data-theme="dark"] .mm-cell.need:not(.now):not(.seen) { fill: #2c3566; }
.mm-cell.seen { fill: #b9e6d4; }
.mm-cell.now { fill: #1baf7a; }
.mm-cell.pickable { cursor: var(--classic-pointer, pointer); }
.mm-cell.pickable:hover { stroke: var(--ink); stroke-width: 1; }
/* the key under the matrices, one swatch per cell colour */
.mm-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; margin: 8px 0 0; padding: 0; list-style: none; font-size: 11px; color: var(--muted); }
.mm-legend li { display: flex; align-items: center; gap: 5px; }
.mm-legend i { width: 10px; height: 10px; border: 1px solid var(--d-line, #bbb); }
.mm-legend .need { background: #dde3f7; }
.mm-legend .now { background: #1baf7a; }
.mm-legend .seen { background: #b9e6d4; }
.mm-legend .out { background: var(--navy, #000080); }
:root[data-theme="dark"] .mm-legend .need { background: #2c3566; }
:root[data-theme="dark"] .mm-legend .out, :root[data-theme="dark"] .mm-cell.pickable.now { background: #5b6fd6; fill: #5b6fd6; }
.mm-bars + .mm-buttons { margin-top: 10px; }
:root[data-theme="dark"] .mm-legend .seen { background: #245c48; }
.mm-cell.pickable.now { fill: var(--navy, #000080); }
:root[data-theme="dark"] .mm-cell.seen { fill: #245c48; }

/* fig 5: the surface is drawn in the cells and lines of fig 4 */
.mm-surfaces { display: flex; flex-wrap: wrap; margin-bottom: 4px; }
.mm-view { aspect-ratio: 16 / 10; max-width: 560px; margin: 0 auto; }
.mm-view canvas { display: block; width: 100%; height: 100%; cursor: var(--classic-pointer, grab); touch-action: pan-y; }
.mm-rules { display: grid; gap: 4px; margin-bottom: 10px; font-size: 12px; }
.mm-rule { display: grid; grid-template-columns: 9.5em minmax(0, 1fr) 6.5em; gap: 2px 10px; align-items: center; }
.mm-rule .mm-check-box { margin-left: 0; white-space: nowrap; }
.mm-rule.best .mm-check-box { font-weight: bold; }
.mm-rule i { display: inline-block; flex: none; width: 9px; height: 9px; border: 1px solid var(--ink); border-radius: 50%; }
.mm-rule i.sgd { background: #c0392b; }
.mm-rule i.mom { background: #e8a33d; }
.mm-rule i.rms { background: #000080; }
.mm-rule i.adam { background: #1baf7a; }
:root[data-theme="dark"] .mm-rule i.rms { background: #8ca0ff; }
.mm-formula { font: 12px 'Courier New', monospace; color: var(--muted); overflow-wrap: anywhere; }
.mm-status { font: bold 12px 'Courier New', monospace; color: var(--muted); text-align: right; }
.mm-status.done { color: #1baf7a; }
.mm-status.stuck { color: #c0392b; }
@container (max-width: 420px) {
  .mm-rule { grid-template-columns: minmax(0, 1fr) auto; }
  .mm-formula { grid-row: 2; grid-column: 1 / -1; margin: 0 0 4px 22px; }
}

/* fig 6 */
.mm-sliders { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px 16px; margin-bottom: 10px; font-size: 12px; }
.mm-sliders label { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; align-items: center; }
.mm-sliders input { grid-column: 1 / -1; width: 100%; }
.mm-bars { display: grid; grid-template-columns: auto minmax(0, 1fr) 72px; gap: 6px 10px; align-items: center; font-size: 12px; }
.mm-bar { height: 14px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); }
.mm-bar i { display: block; height: 100%; background: var(--navy, #000080); }
.mm-bar.keras i { background: #e8a33d; }
:root[data-theme="dark"] .mm-bar i { background: #8ca0ff; }
:root[data-theme="dark"] .mm-bar.keras i { background: #e8a33d; }
.mm-bar.slow i, :root[data-theme="dark"] .mm-bar.slow i { background: #e8a33d; }
.mm-bar.tiled i, :root[data-theme="dark"] .mm-bar.tiled i { background: #1baf7a; transition: width .3s; }
.mm-bars + .mm-note { margin-top: 10px; }
.mm-eps { display: block; width: 100%; max-width: 560px; margin: 0 auto 8px; cursor: var(--classic-pointer, pointer); touch-action: pan-y; }
.mm-gridline { fill: none; stroke: var(--d-line, #ddd); stroke-width: .5; stroke-dasharray: 2 2; }
.mm-eps .mm-tick { font-size: 10px; }
.mm-curve-torch, .mm-curve-keras { fill: none; stroke: var(--navy, #000080); stroke-width: 2; }
.mm-curve-keras { stroke: #e8a33d; }
.mm-dot-torch { fill: var(--navy, #000080); }
.mm-dot-keras { fill: #e8a33d; }
.mm-eps-mark { fill: none; stroke: var(--navy, #000080); stroke-width: 1; stroke-dasharray: 2 2; opacity: .6; }
.mm-eps-mark.keras { stroke: #e8a33d; }
.mm-eps-name { font: bold 11px 'Courier New', monospace; fill: var(--navy, #000080); }
.mm-eps-name.keras { fill: #e8a33d; }
.mm-now-line { stroke: var(--ink); stroke-width: 1; opacity: .5; }
.mm-eps-key text { font: 11px 'Pixel MS Sans Serif', Tahoma, sans-serif; fill: var(--ink); }
:root[data-theme="dark"] .mm-curve-torch, :root[data-theme="dark"] .mm-eps-mark:not(.keras) { stroke: #8ca0ff; }
:root[data-theme="dark"] .mm-dot-torch, :root[data-theme="dark"] .mm-eps-name:not(.keras) { fill: #8ca0ff; }
.mm-readout { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 4px 10px; align-items: baseline; font-size: 12px; }
.mm-readout span { font-weight: bold; }
.mm-readout span.torch { color: var(--d-link, #000080); }
.mm-readout span.keras { color: #c47f17; }
.mm-readout code { font: 11px 'Courier New', monospace; color: var(--muted); overflow-wrap: anywhere; }
.mm-readout b { font: bold 12px 'Courier New', monospace; }
.mm-badge { display: inline-block; margin: 0 4px; padding: 0 5px; font-size: 11px; font-weight: bold; color: #fff; background: #1baf7a; }
.mm-badge.bad { background: #c0392b; }
</style>
