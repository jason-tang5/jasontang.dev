<script setup>
// the figures in the mini ml framework writeup (content.mjs, figures): the mnist mlp
// training on real test digits while the cuda and cpu backends race, the backward
// pass through x·x + x one gradient at a time, the tiled matmul kernel loading its
// tiles phase by phase, and where pytorch and keras put adam's epsilon. the rules
// follow ml-framework/crates/minitorch (autograd.rs, cuda.rs, optim.rs)
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { reducedMotion, useInView } from '../in-view.js';
// preview is the projects folder's card: fig 1 alone in a 600 × 375 frame, no buttons,
// playing only while the card is on screen
const props = defineProps({ figure: { type: String, required: true }, preview: Boolean });

const fmt = v => (Number.isInteger(v) ? String(v) : v.toFixed(1));

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
const layers = [{ x: 124, n: 9, size: 784 }, { x: 182, n: 8, size: 256 }, { x: 240, n: 6, size: 128 }];
const dotY = (n, i) => 68 + (i - (n - 1) / 2) * 10.5;
const outY = d => 18 + d * 10;
// the wires between each pair of columns, one path each: digit to 784, 784 to 256,
// 256 to 128, 128 to the 10 outputs
const wires = (() => {
  const column = l => Array.from({ length: l.n }, (_, i) => [l.x, dotY(l.n, i)]);
  const from = [Array.from({ length: 5 }, (_, i) => [93, 36 + i * 14]), ...layers.map(column)];
  const to = [...layers.map(column), Array.from({ length: 10 }, (_, d) => [300, outY(d) + 4.5])];
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
const CYCLE = 1600, HOLD = 3500, END = (GPU * EPOCHS / SPEED) * 1000;
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
const stage = computed(() => {
  const f = batchPhase.value;
  if (f < 0) return 'Done.';
  return f < 0.45 ? 'Forward pass.' : f < 0.55 ? 'Cross-entropy loss.' : f < 0.9 ? 'Backward pass.' : 'Adam step.';
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
const lossLine = computed(() => losses.slice(0, trained.value).map((l, e) => `${e * 100 / 9},${28 - l / 0.3 * 26}`).join(' '));

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

// ---- graph: y = x·x + x ----
const x = ref(3);
const overwrite = ref(false);
const step = ref(0);
// each step lights some edges and may add a gradient contribution to x
const steps = computed(() => {
  const v = x.value;
  return [
    { note: `Forward. x = ${fmt(v)}.`, show: ['x'] },
    { note: `a = x · x = ${fmt(v * v)}. Both of mul’s inputs are x, so x gets two edges into it.`, show: ['x', 'a'], edges: ['x-a1', 'x-a2'] },
    { note: `y = a + x = ${fmt(v * v + v)}. That’s a third edge out of x.`, show: ['x', 'a', 'y'], edges: ['a-y', 'x-y'] },
    { note: 'Backward. Seed dy/dy = 1 and walk the graph in reverse.', show: ['x', 'a', 'y'], grads: { y: 1 } },
    { note: 'add passes its gradient straight through: 1 to a.', back: ['a-y'], grads: { y: 1, a: 1 } },
    { note: 'and 1 to x.', back: ['x-y'], grads: { y: 1, a: 1 }, give: 1 },
    { note: `mul sends gradient × the other input to each input: 1 × ${fmt(v)} = ${fmt(v)} down the first edge…`, back: ['x-a1'], grads: { y: 1, a: 1 }, give: v },
    { note: `…and ${fmt(v)} down the second.`, back: ['x-a2'], grads: { y: 1, a: 1 }, give: v },
  ];
});
const at = computed(() => steps.value[step.value]);
// what x's gradient holds so far: every contribution added, or only the last one
const contributions = computed(() => steps.value.slice(0, step.value + 1).filter(s => s.give !== undefined).map(s => s.give));
const xGrad = computed(() => {
  const c = contributions.value;
  if (!c.length) return null;
  return overwrite.value ? c[c.length - 1] : c.reduce((a, b) => a + b);
});
const done = computed(() => step.value === steps.value.length - 1);
const right = computed(() => 2 * x.value + 1);
const shown = id => step.value >= 3 || at.value.show.includes(id);
const lit = id => step.value >= 3 || at.value.edges?.includes(id);
const back = id => at.value.back?.includes(id);
const nodes = {
  x: { x: 50, y: 92, label: 'x', value: () => x.value },
  a: { x: 170, y: 36, label: 'mul', sub: 'a = x · x', value: () => x.value * x.value },
  y: { x: 290, y: 92, label: 'add', sub: 'y = a + x', value: () => x.value * x.value + x.value },
};
const edges = [
  { id: 'x-a1', d: 'M70 82 Q100 30 146 32' },
  { id: 'x-a2', d: 'M72 92 Q120 70 148 44' },
  { id: 'x-y', d: 'M74 98 H266' },
  { id: 'a-y', d: 'M194 40 Q250 44 272 78' },
];
function setX(v) { x.value = v; }

// ---- tiles: C = A · B, 8 × 8, in 2 × 2 tiles (the real kernel uses 16 × 16) ----
const N = 8, T = 2, phases = N / T;
const out = ref([1, 2]);
const phase = ref(0);
const transposed = ref(false);
const cell = 11;
const grids = { a: { x: 10, label: 'A' }, b: { x: 122, label: 'B' }, c: { x: 234, label: 'C' } };
// which tile of each matrix is in shared memory this phase. with the transpose flag
// the kernel wants Bᵀ's tile (k, j), which is B's tile (j, k) read across instead of down
const aTile = computed(() => [out.value[0], phase.value]);
const bTile = computed(() => (transposed.value ? [out.value[1], phase.value] : [phase.value, out.value[1]]));
// every phase loads two tiles. without tiles, each of the block's T² threads reads a
// whole row of A and column of B on its own
const loads = computed(() => ({ sofar: 2 * T * T * (phase.value + 1), tiled: 2 * T * T * phases, naive: 2 * N * T * T }));
function pick(i, j) { out.value = [i, j]; phase.value = 0; }
const inTile = (r, c, t) => Math.floor(r / T) === t[0] && Math.floor(c / T) === t[1];
const seenTile = (r, c, matrix) => {
  for (let k = 0; k < phase.value; k++) {
    const t = matrix === 'a' ? [out.value[0], k] : transposed.value ? [out.value[1], k] : [k, out.value[1]];
    if (inTile(r, c, t)) return true;
  }
  return false;
};
const cellClass = (m, r, c) => {
  if (m === 'c') return { now: inTile(r, c, out.value), pickable: true };
  const t = m === 'a' ? aTile.value : bTile.value;
  return { now: inTile(r, c, t), seen: seenTile(r, c, m) };
};
const range = Array.from({ length: N }, (_, i) => i);

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
</script>

<template>
  <figure v-if="figure === 'train'" ref="root" class="mm-figure" :class="{ 'mm-preview': preview }">
    <figcaption><strong>Fig. 1</strong> Training the 784-256-128-10 MLP on MNIST. Real test digits go forward, gradients come back, Adam steps, and the GPU races the CPU through 10 epochs.</figcaption>
    <div class="mm-panel">
      <svg class="mm-net" viewBox="0 0 360 132" aria-hidden="true">
        <rect class="mm-digit-bg" x="7" y="21" width="86" height="86"/>
        <path class="mm-digit" :d="digitPath(sample)"/>
        <text class="mm-layer" x="50" y="121">28 × 28</text>
        <path v-for="(d, k) in wires" :key="k" class="mm-wires" :class="wireClass(k)" :d="d"/>
        <g v-for="(l, j) in layers" :key="j">
          <circle v-for="i in l.n" :key="i" class="mm-neuron" :class="{ on: layerOn(j + 1) }" :cx="l.x" :cy="dotY(l.n, i - 1)" r="3.5"
            :style="{ opacity: layerOn(j + 1) ? activation(sample.label, j, i) : 1 }"/>
          <text class="mm-layer" :x="l.x" y="121">{{ l.size }}</text>
        </g>
        <g v-for="d in 10" :key="d" class="mm-out" :class="{ target: d - 1 === sample.label && layerOn(4.5) }">
          <rect x="300" :y="outY(d - 1)" width="10" height="9"/>
          <text x="305" :y="outY(d - 1) + 7">{{ d - 1 }}</text>
          <rect class="mm-prob" x="313" :y="outY(d - 1) + 2" :width="layerOn(4) ? 40 * (d - 1 === sample.label ? pLabel : (1 - pLabel) / 9) : 0" height="5"/>
        </g>
        <text class="mm-layer" x="305" y="128">10</text>
      </svg>
      <p class="mm-note mm-stage"><b>{{ stage }}</b>
        <template v-if="finished">Trained to {{ accs[EPOCHS - 1] }}% on the 10,000 test digits.</template>
        <template v-else>One digit, a {{ sample.label }}, out of a batch of 128.</template>
      </p>
      <div class="mm-race">
        <span>CUDA</span><span class="mm-bar"><i :style="{ width: `${gpuEpochs * 10}%` }"/></span><code>{{ Math.floor(gpuEpochs) }}/10 · {{ GPU }} s</code>
        <span>CPU</span><span class="mm-bar cpu"><i :style="{ width: `${cpuEpochs * 10}%` }"/></span><code>{{ Math.floor(cpuEpochs) }}/10 · {{ CPU }} s</code>
      </div>
      <div class="mm-curve">
        <svg viewBox="-2 0 104 30" preserveAspectRatio="none" aria-hidden="true"><polyline :points="lossLine"/></svg>
        <p>
          <template v-if="trained">Epoch {{ trained }} · loss <code>{{ losses[trained - 1].toFixed(4) }}</code> · test acc <code>{{ accs[trained - 1] }}%</code></template>
          <template v-else>Epoch 0 · untrained, a guess out of 10</template>
          <br><small>{{ sim.toFixed(2) }} s of GPU time. The CPU takes {{ (CPU * EPOCHS).toFixed(1) }} s for the same 10 epochs, about 16× longer.</small>
        </p>
      </div>
      <div class="mm-buttons">
        <button class="raised mm-button" @click="playing ? stop() : play()">{{ playing ? 'Pause' : 'Play' }}</button>
        <button class="raised mm-button" @click="restart">Restart</button>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'graph'" class="mm-figure">
    <figcaption><strong>Fig. 2</strong> The backward pass through y = x·x + x. Three gradients reach x, and they have to be added up.</figcaption>
    <div class="mm-panel">
      <svg class="mm-graph" viewBox="0 0 340 128" aria-hidden="true">
        <defs><marker id="mm-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z"/></marker></defs>
        <g class="mm-edges">
          <path v-for="e in edges" :key="e.id" :d="e.d" :class="{ lit: lit(e.id), back: back(e.id) }" marker-end="url(#mm-arrow)"/>
        </g>
        <g v-for="(n, id) in nodes" :key="id" class="mm-node" :class="{ on: shown(id), hot: id === 'x' && at.give !== undefined }">
          <rect :x="n.x - 30" :y="n.y - 15" width="60" height="30"/>
          <text :x="n.x" :y="n.sub ? n.y - 2 : n.y + 4">{{ n.label }}</text>
          <text v-if="n.sub" class="mm-sub" :x="n.x" :y="n.y + 9">{{ n.sub }}</text>
          <text v-if="shown(id)" class="mm-val" :x="n.x" :y="n.y + 27">= {{ fmt(n.value()) }}</text>
          <text v-if="id === 'x' ? xGrad !== null : at.grads?.[id] !== undefined" class="mm-grad" :x="n.x" :y="n.y - 21">
            grad {{ id === 'x' ? fmt(xGrad) : at.grads[id] }}
          </text>
        </g>
      </svg>
      <p class="mm-sum" aria-live="polite">
        <span>x.grad =</span>
        <template v-if="contributions.length">
          <code>{{ overwrite ? fmt(contributions[contributions.length - 1]) : contributions.map(c => (c < 0 ? `(${fmt(c)})` : fmt(c))).join(' + ') }}</code>
          <b v-if="contributions.length > 1 && !overwrite">= {{ fmt(xGrad) }}</b>
        </template>
        <code v-else>—</code>
        <span v-if="done" class="mm-check" :class="{ bad: xGrad !== right }">{{ xGrad === right ? `✓ matches 2x + 1 = ${fmt(right)}` : `✗ should be 2x + 1 = ${fmt(right)}` }}</span>
      </p>
      <p class="mm-note" aria-live="polite"><b>{{ step + 1 }}/{{ steps.length }}</b> {{ at.note }}</p>
      <div class="mm-buttons">
        <button class="raised mm-button" :disabled="step === 0" @click="step--">Back</button>
        <button class="raised mm-button" :disabled="done" @click="step++">Step</button>
        <span class="mm-toggle" role="group" aria-label="x">
          <button v-for="v in [-2, 1, 3]" :key="v" class="raised mm-button" :class="{ pressed: x === v }" :aria-pressed="x === v" @click="setX(v)">x = {{ v }}</button>
        </span>
        <label class="mm-check-box"><input v-model="overwrite" type="checkbox"> Overwrite instead of add</label>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'tiles'" class="mm-figure">
    <figcaption><strong>Fig. 3</strong> The tiled matmul. Each block of C loads one tile of A and one of B into shared memory per phase. Click a block of C.</figcaption>
    <div class="mm-panel">
      <div class="mm-scroll">
        <svg class="mm-tiles" viewBox="0 0 334 112" role="group" aria-label="Matrices">
          <g v-for="(gd, m) in grids" :key="m">
            <text class="mm-label" :x="gd.x + N * cell / 2" y="10">{{ m === 'b' && transposed ? 'B, read as Bᵀ' : gd.label }}</text>
            <template v-for="r in range" :key="r">
              <rect v-for="c in range" :key="c" class="mm-cell" :class="cellClass(m, r, c)"
                :x="gd.x + c * cell" :y="16 + r * cell" :width="cell - 1" :height="cell - 1"
                @click="m === 'c' && pick(Math.floor(r / T), Math.floor(c / T))"/>
            </template>
          </g>
          <text class="mm-op" x="106" y="64">·</text>
          <text class="mm-op" x="218" y="64">=</text>
        </svg>
      </div>
      <p class="mm-note" aria-live="polite">
        <b>Phase {{ phase + 1 }}/{{ phases }}</b>
        Block ({{ out[0] }}, {{ out[1] }}) of C adds A’s tile ({{ aTile[0] }}, {{ aTile[1] }}) times
        {{ transposed ? `B’s tile (${bTile[0]}, ${bTile[1]}), read across` : `B’s tile (${bTile[0]}, ${bTile[1]})` }}.
        Reads from GPU memory: <b>{{ loads.sofar }}</b> so far, {{ loads.tiled }} for the whole block, against {{ loads.naive }} without tiles. With the real 16 × 16 tiles it’s 16 times fewer.
      </p>
      <div class="mm-buttons">
        <button class="raised mm-button" :disabled="phase === 0" @click="phase--">Back</button>
        <button class="raised mm-button" :disabled="phase === phases - 1" @click="phase++">Next phase</button>
        <label class="mm-check-box"><input v-model="transposed" type="checkbox"> Transpose flag on B (backward pass)</label>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'epsilon'" class="mm-figure">
    <figcaption><strong>Fig. 4</strong> One Adam step on a weight with a steady gradient, the way PyTorch and Keras each add epsilon (1e-8).</figcaption>
    <div class="mm-panel">
      <div class="mm-sliders">
        <label>Gradient <code>{{ sci(g) }}</code><input v-model.number="gExp" type="range" min="-10" max="-2" step="0.5" aria-label="Gradient size"></label>
        <label>Step t <code>{{ t }}</code><input v-model.number="tIndex" type="range" min="0" :max="tChoices.length - 1" step="1" aria-label="Step number"></label>
      </div>
      <div class="mm-bars">
        <span>PyTorch</span><span class="mm-bar"><i :style="{ width: `${torchStep / LR * 100}%` }"/></span><code>{{ sci(torchStep) }}</code>
        <span>Keras</span><span class="mm-bar keras"><i :style="{ width: `${kerasStep / LR * 100}%` }"/></span><code>{{ sci(kerasStep) }}</code>
      </div>
      <p class="mm-note" aria-live="polite">
        Keras’s epsilon works out to <code>{{ sci(keraEps) }}</code> here. The steps differ by <b>{{ pct(gap) }}</b>,
        {{ gap > 1e-4 ? 'outside' : 'inside' }} the 1e-4 tolerance the PyTorch tests use.
        {{ gap > 1e-4 ? 'Tiny gradients early in training are where they part ways.' : 'Once the gradient dwarfs epsilon, they agree.' }}
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
.mm-net { display: block; width: 100%; max-width: 560px; margin: 0 auto; }
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
.mm-out text { font: bold 7px 'Courier New', monospace; fill: var(--ink); text-anchor: middle; }
.mm-out.target rect:first-child { fill: #1baf7a; stroke: #1baf7a; }
.mm-out.target text { fill: #fff; }
.mm-prob { fill: var(--navy, #000080); transition: width .3s; }
.mm-out.target .mm-prob { fill: #1baf7a; }
:root[data-theme="dark"] .mm-wires.fwd { stroke: #8ca0ff; }
:root[data-theme="dark"] .mm-neuron.on { fill: #8ca0ff; stroke: #8ca0ff; }
:root[data-theme="dark"] .mm-out:not(.target) .mm-prob { fill: #8ca0ff; }
.mm-stage { min-height: 0; margin: 6px 0 8px; }
.mm-stage > b:first-child { margin-right: 4px; font: bold 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--ink); }
.mm-race { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px 10px; align-items: center; font-size: 12px; }
.mm-race code { font: bold 12px 'Courier New', monospace; color: var(--d-link, #000080); }
.mm-race .mm-bar.cpu i { background: #e8a33d; }
.mm-curve { display: grid; grid-template-columns: minmax(70px, 140px) minmax(0, 1fr); gap: 10px; align-items: center; margin: 10px 0; font-size: 12px; }
.mm-curve svg { width: 100%; height: 40px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); }
.mm-curve polyline { fill: none; stroke: #1baf7a; stroke-width: 2; vector-effect: non-scaling-stroke; }
.mm-curve p { margin: 0; line-height: 1.45; }
.mm-curve code { font: bold 12px 'Courier New', monospace; color: var(--d-link, #000080); }
.mm-curve small { color: var(--muted); }
@container (max-width: 380px) { .mm-curve { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .mm-wires, .mm-neuron, .mm-prob { transition: none; } }
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

/* fig 2 */
.mm-graph { display: block; width: 100%; max-width: 480px; margin: 0 auto; }
.mm-edges path { fill: none; stroke: var(--d-line, #888); stroke-width: 2; stroke-dasharray: 4 3; }
.mm-edges path.lit { stroke: var(--ink); stroke-dasharray: none; }
.mm-edges path.back { stroke: #1baf7a; stroke-width: 3; stroke-dasharray: none; }
#mm-arrow path { fill: var(--d-line, #888); }
.mm-node rect { fill: var(--d-page-alt, #fffdf2); stroke: var(--muted); stroke-width: 2; }
.mm-node.on rect { stroke: var(--ink); }
.mm-node.hot rect { fill: var(--navy, #000080); }
.mm-node.hot > text:not(.mm-val):not(.mm-grad) { fill: #fff; }
.mm-node text { fill: var(--ink); font: bold 10px 'Pixel MS Sans Serif', Tahoma, sans-serif; text-anchor: middle; }
.mm-node .mm-sub { font: 8px 'Courier New', monospace; }
.mm-node .mm-val { font: bold 9px 'Courier New', monospace; fill: var(--muted); }
.mm-node .mm-grad { font: bold 9px 'Courier New', monospace; fill: #1baf7a; }
.mm-sum { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; margin: 10px 0 0; font-size: 13px; }
.mm-check { font-weight: bold; color: #1baf7a; }
.mm-check.bad { color: #c0392b; }

/* fig 3: scrolls sideways on a phone rather than shrinking to dots */
.mm-scroll { overflow-x: auto; }
.mm-tiles { display: block; width: 100%; min-width: 320px; max-width: 560px; margin: 0 auto; }
.mm-label { font: bold 9px 'Pixel MS Sans Serif', Tahoma, sans-serif; fill: var(--ink); text-anchor: middle; }
.mm-op { font: bold 18px 'Courier New', monospace; fill: var(--muted); text-anchor: middle; }
.mm-cell { fill: var(--d-page-alt, #fffdf2); stroke: var(--d-line, #bbb); stroke-width: .5; }
.mm-cell.seen { fill: #b9e6d4; }
.mm-cell.now { fill: #1baf7a; }
.mm-cell.pickable { cursor: var(--classic-pointer, pointer); }
.mm-cell.pickable.now { fill: var(--navy, #000080); }
:root[data-theme="dark"] .mm-cell.seen { fill: #245c48; }

/* fig 4 */
.mm-sliders { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px 16px; margin-bottom: 10px; font-size: 12px; }
.mm-sliders label { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; align-items: center; }
.mm-sliders input { grid-column: 1 / -1; width: 100%; }
.mm-bars { display: grid; grid-template-columns: auto minmax(0, 1fr) 72px; gap: 6px 10px; align-items: center; font-size: 12px; }
.mm-bar { height: 14px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); }
.mm-bar i { display: block; height: 100%; background: var(--navy, #000080); }
.mm-bar.keras i { background: #e8a33d; }
:root[data-theme="dark"] .mm-bar i { background: #8ca0ff; }
:root[data-theme="dark"] .mm-bar.keras i { background: #e8a33d; }
</style>
