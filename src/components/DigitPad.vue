<script setup>
// draw a digit and the mlp from the mini ml framework guesses it as you go (digit-net.mjs).
// the pad is a 28 × 28 grid of big pixels: the pen draws smooth ink underneath, and each
// square eases toward how much ink covers it, flashing cyan as it lights up and fading
// out when cleared. beside it, the 28 × 28 the network actually gets, its guess, and a
// bar for each digit. a trash can in the pad's corner wipes it. in the digit guesser in
// games and on the mini ml writeup
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { guessDigit, loadNet, toMnist } from '../digit-net.mjs';
import { reducedMotion } from '../in-view.js';

const weightsUrl = new URL('../../assets/projects/mini-ml-mnist.bin', import.meta.url).href;
// the ink is drawn at 10 pixels a square
const GRID = 28, CELL = 10, SIZE = GRID * CELL;
const view = ref(null);
const seen = ref(null);
const net = ref(null);
const netError = ref(false);
const probs = ref(null);
const topDigit = computed(() => (probs.value ? probs.value.indexOf(Math.max(...probs.value)) : null));

let ink, inkCtx;
// per square: how lit it should be, how lit it's drawn, and how much flash is left
const target = new Float32Array(GRID * GRID);
const shown = new Float32Array(GRID * GRID);
const heat = new Float32Array(GRID * GRID);
let frame = 0, dirty = false, drawing = false, lastPoint = null;

// how much ink covers each square, and the network's guess for the drawing
function readInk() {
  const { data } = inkCtx.getImageData(0, 0, SIZE, SIZE);
  const gray = new Uint8ClampedArray(SIZE * SIZE);
  for (let i = 0; i < gray.length; i++) gray[i] = data[i * 4];
  target.fill(0);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    target[Math.floor(y / CELL) * GRID + Math.floor(x / CELL)] += gray[y * SIZE + x] / 255 / (CELL * CELL);
  }
  const image = toMnist(gray, SIZE);
  showSeen(image);
  probs.value = image && net.value ? guessDigit(net.value, image) : null;
}

// drawn at the pad's real size on screen, so the 1 pixel gaps between squares come out
// even however big the pad is
function paint() {
  const canvas = view.value;
  const px = Math.max(GRID * 2, Math.round(canvas.clientWidth * (window.devicePixelRatio || 1)));
  if (canvas.width !== px) canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  const at = k => Math.round(k * px / GRID);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, px, px);
  for (let i = 0; i < GRID * GRID; i++) {
    const v = shown[i], h = heat[i] * v;
    // unlit squares stay faintly visible, so the pad reads as a grid of pixels
    const r = Math.round(14 + v * (255 - 14) - h * (255 - 0x5d));
    const g = Math.round(14 + v * (255 - 14) - h * (255 - 0xe5));
    const b = Math.round(18 + v * (255 - 18) - h * (255 - 0xee));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    const x = i % GRID, y = Math.floor(i / GRID);
    ctx.fillRect(at(x), at(y), at(x + 1) - at(x) - 1, at(y + 1) - at(y) - 1);
  }
}

// one frame: read new ink if there is any, ease every square toward its target, and
// keep going until they've all settled
function tick() {
  frame = 0;
  if (!view.value) return;
  if (dirty) { dirty = false; readInk(); }
  const still = reducedMotion();
  let moving = false;
  for (let i = 0; i < shown.length; i++) {
    const rise = target[i] - shown[i];
    if (rise > 0.25) heat[i] = 1;
    shown[i] = still ? target[i] : shown[i] + rise * 0.35;
    heat[i] = still ? 0 : Math.max(0, heat[i] - 0.06);
    if (Math.abs(target[i] - shown[i]) > 0.005 || heat[i] > 0) moving = true;
  }
  paint();
  if (moving) frame = requestAnimationFrame(tick);
}
const queue = () => { if (!frame) frame = requestAnimationFrame(tick); };

// the 28 × 28 the network gets
function showSeen(image) {
  const ctx = seen.value?.getContext('2d');
  if (!ctx) return;
  const out = ctx.createImageData(GRID, GRID);
  for (let i = 0; i < GRID * GRID; i++) {
    const v = Math.round((image?.[i] ?? 0) * 255);
    out.data.set([v, v, v, 255], i * 4);
  }
  ctx.putImageData(out, 0, 0);
}

function padPoint(event) {
  const r = view.value.getBoundingClientRect();
  return [(event.clientX - r.left) / r.width * SIZE, (event.clientY - r.top) / r.height * SIZE];
}
function stroke(to) {
  inkCtx.beginPath();
  inkCtx.moveTo(...(lastPoint ?? to));
  inkCtx.lineTo(...to);
  inkCtx.stroke();
  lastPoint = to;
  dirty = true;
  queue();
}
function penDown(event) {
  if (event.button > 0) return;
  drawing = true;
  lastPoint = null;
  view.value.setPointerCapture(event.pointerId);
  stroke(padPoint(event));
}
function penMove(event) { if (drawing) stroke(padPoint(event)); }
function penUp() { drawing = false; lastPoint = null; }

function clear() {
  inkCtx.fillStyle = '#000';
  inkCtx.fillRect(0, 0, SIZE, SIZE);
  dirty = true;
  queue();
}
defineExpose({ clear });

let resize;
onMounted(() => {
  resize = new ResizeObserver(() => paint());
  resize.observe(view.value);
  ink = document.createElement('canvas');
  ink.width = ink.height = SIZE;
  inkCtx = ink.getContext('2d', { willReadFrequently: true });
  inkCtx.strokeStyle = '#fff';
  inkCtx.lineWidth = 20;
  inkCtx.lineCap = inkCtx.lineJoin = 'round';
  clear();
  loadNet(weightsUrl).then(layers => { net.value = layers; dirty = true; queue(); }, () => { netError.value = true; });
});
onBeforeUnmount(() => { cancelAnimationFrame(frame); resize?.disconnect(); });
</script>

<template>
  <div class="digit-pad">
    <div class="dp-pad-wrap">
      <canvas ref="view" class="dp-pad" role="img" aria-label="Drawing pad. Draw a digit from 0 to 9."
        @pointerdown="penDown" @pointermove="penMove" @pointerup="penUp" @pointercancel="penUp"/>
      <button class="dp-clear" title="Clear the pad" aria-label="Clear the pad" @click="clear">
        <svg viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 2h10v1H1zM2 3h1v8H2zM9 3h1v8H9zM3 10h6v1H3zM5 4h1v5H5zM7 4h1v5H7zM4 0h4v1H4z"/></svg>
      </button>
    </div>
    <div class="dp-side">
      <div class="dp-seen">
        <canvas ref="seen" :width="GRID" :height="GRID" aria-hidden="true"/>
        <p class="dp-guess" aria-live="polite">
          <template v-if="netError">Couldn’t load the network.</template>
          <template v-else-if="topDigit === null">{{ net ? 'Draw a digit' : 'Loading…' }}</template>
          <template v-else><b>{{ topDigit }}</b><small>{{ Math.round(probs[topDigit] * 100) }}% sure</small></template>
        </p>
      </div>
      <ol class="dp-bars" aria-label="How likely each digit is">
        <li v-for="d in 10" :key="d" :class="{ best: topDigit === d - 1 }">
          <span>{{ d - 1 }}</span><i><em :style="{ width: `${(probs?.[d - 1] ?? 0) * 100}%` }"/></i><code>{{ probs ? `${Math.round(probs[d - 1] * 100)}%` : '' }}</code>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
/* the pad on the left, --pad-size wide (the games window sets it from its own size),
   and the network's side beside it. when they don't fit side by side, the side wraps
   under the pad */
.digit-pad { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: center; }
.dp-pad-wrap { position: relative; flex: none; }
.dp-pad { display: block; width: var(--pad-size, 224px); height: var(--pad-size, 224px); box-sizing: border-box; background: #000; border: 2px solid; border-color: var(--edge) var(--light) var(--light) var(--edge); touch-action: none; cursor: crosshair; }
/* the trash can sits in the pad's top right corner, dim until you point at it */
.dp-clear { position: absolute; top: 8px; right: 8px; display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; background: none; color: #fff; opacity: .45; cursor: pointer; transition: opacity .12s; }
.dp-clear:hover, .dp-clear:focus-visible { opacity: 1; }
.dp-clear:focus-visible { outline: 1px dotted #fff; }
.dp-clear svg { width: 20px; height: 20px; fill: currentColor; }
.dp-side { flex: 1; min-width: 150px; max-width: 260px; display: grid; gap: 12px; }
.dp-seen { display: flex; align-items: center; gap: 12px; }
.dp-seen canvas { width: 70px; height: 70px; image-rendering: pixelated; border: 1px solid var(--d-line, #999); }
.dp-guess { display: grid; margin: 0; font-size: 12px; color: var(--ink); }
.dp-guess b { font: bold 48px/1 'Courier New', monospace; color: var(--d-link, #000080); }
.dp-guess small { font-size: 11px; color: var(--muted); }
.dp-bars { display: grid; gap: 3px; margin: 0; padding: 0; list-style: none; }
/* the writeup's own list and paragraph spacing stays out */
.dp-bars li { margin: 0; padding: 0; line-height: 1.2; display: grid; grid-template-columns: 12px minmax(0, 1fr) 34px; align-items: center; gap: 6px; font: 12px 'Courier New', monospace; color: var(--ink); }
.dp-bars i { height: 12px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); }
.dp-bars em { display: block; height: 100%; background: var(--muted); transition: width .12s; }
.dp-bars li.best { font-weight: bold; }
.dp-bars li.best em { background: #1baf7a; }
.dp-bars code { font: inherit; color: var(--muted); text-align: right; }
@media (prefers-reduced-motion: reduce) { .dp-bars em { transition: none; } }
</style>
