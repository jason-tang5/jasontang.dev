<script setup>
// Spotify exposes playback state, not audio samples: these are simulated displays.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { read, save } from '../storage.js';
import { buzz } from '../haptics.js';

const props = defineProps({ playing: Boolean });
// the fold switch in the header tucks the display away to just that strip. the cd
// player resizes its window to match when it hears the fold event
const emit = defineEmits(['fold']);
const modes = ['bars', 'wave', 'scope'];
const savedMode = read('cd-display', 'bars');
const mode = ref(modes.includes(savedMode) ? savedMode : 'bars');
const folded = ref(read('cd-display-folded', 'no') === 'yes');
const canvas = ref(null);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const levels = new Float32Array(20);
const peaks = new Float32Array(20);
let frame = 0;
let observer;
let visible = true;
let visibilityObserver;
let lastTime = 0;
let energy = props.playing ? 1 : 0;
let ripples = [];
let wake = 0;

function choose(value) {
  mode.value = value;
  save('cd-display', value);
  buzz(8);
  render(performance.now());
}
function toggleFold() {
  folded.value = !folded.value;
  save('cd-display-folded', folded.value ? 'yes' : 'no');
  buzz(8);
  emit('fold', folded.value);
  if (folded.value) stop();
  else {
    wake = performance.now();
    start();
  }
}
function ripple(event) {
  const rect = canvas.value.getBoundingClientRect();
  const x = event.detail === 0 ? 0.5 : (event.clientX - rect.left) / rect.width;
  ripples.push({ x: Math.max(0, Math.min(1, x)), time: performance.now() });
  ripples = ripples.slice(-5);
  buzz(8);
  start();
}
function render(now) {
  const el = canvas.value;
  if (!el || !el.width || !el.height) return;
  const ctx = el.getContext('2d');
  const w = el.width, h = el.height;
  const dt = Math.min(50, now - (lastTime || now - 16));
  lastTime = now;
  energy += ((props.playing ? 1 : 0) - energy) * (1 - Math.exp(-dt / 220));
  const still = reducedMotion.matches;
  const t = still ? 0 : now / 1000;
  const amplitude = still ? (props.playing ? 0.65 : 0) : energy;
  ctx.fillStyle = '#090e10';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#172326';
  for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 12) ctx.fillRect(x, y, 1, 1);
  ripples = still ? [] : ripples.filter(r => now - r.time < 850);
  const pulse = x => ripples.reduce((sum, r) => {
    const age = (now - r.time) / 850;
    return sum + Math.exp(-Math.pow((Math.abs(x - r.x) - age * 0.8) * 18, 2)) * (1 - age);
  }, 0);

  if (mode.value === 'bars') {
    const gap = 2, bw = Math.max(2, Math.floor((w - 12) / 20) - gap);
    const left = Math.floor((w - 20 * (bw + gap) + gap) / 2);
    const rows = Math.max(2, Math.floor((h - 10) / 5));
    for (let i = 0; i < 20; i++) {
      const target = Math.min(1, 0.035 + amplitude * (0.4 + 0.2 * Math.sin(t * 4 + i * 0.7) + 0.16 * Math.sin(t * 7 - i * 0.3)) + pulse(i / 19) * 0.65);
      levels[i] += (target - levels[i]) * (still ? 1 : 1 - Math.exp(-dt / (target > levels[i] ? 45 : 150)));
      peaks[i] = Math.max(levels[i], peaks[i] - dt / 1700);
      const lit = Math.round(levels[i] * rows);
      const hue = (280 + i * 320 / 19) % 360;
      for (let row = 0; row < rows; row++) {
        const x = left + i * (bw + gap), y = h - 5 - (row + 1) * 5;
        ctx.fillStyle = row < lit ? `hsl(${hue} 78% 57%)` : '#182326';
        ctx.fillRect(x, y, bw, 3);
        if (row < lit) {
          ctx.fillStyle = `hsl(${hue} 85% 76%)`;
          ctx.fillRect(x, y, Math.max(1, bw / 3 | 0), 1);
        }
      }
      ctx.fillStyle = '#d8f1df';
      ctx.fillRect(left + i * (bw + gap), h - 5 - Math.max(1, Math.ceil(peaks[i] * rows)) * 5, bw, 1);
    }
  } else {
    ctx.fillStyle = mode.value === 'wave' ? '#83e5ac' : '#ffc36c';
    const mid = h / 2;
    for (let x = 4; x < w - 4; x += 2) {
      const u = x / w;
      const signal = mode.value === 'wave'
        ? Math.sin(u * 24 - t * 4) * (0.55 + 0.3 * Math.sin(u * 9 + t * 2)) + 0.15 * Math.sin(u * 65 + t * 6)
        : Math.sin(u * 16 - t * 3) * Math.sin(u * 5 + t * 0.8);
      const y = Math.round(mid + signal * (amplitude * h * 0.36) + Math.sin(u * 40 - t * 10) * pulse(u) * h * 0.22);
      ctx.fillRect(x, y, 2, 2);
      ctx.globalAlpha = 0.15;
      ctx.fillRect(x, y + 3, 2, 2);
      ctx.globalAlpha = 1;
    }
  }
  // A subtle sweep when the display wakes; tap rings are shared by all modes.
  if (!still && now - wake < 450) {
    ctx.fillStyle = '#d4ffe522';
    ctx.fillRect(Math.round((now - wake) / 450 * w), 0, 3, h);
  }
  for (const r of ripples) {
    const age = (now - r.time) / 850;
    ctx.strokeStyle = `rgba(190,235,215,${(1 - age) * 0.45})`;
    ctx.strokeRect(Math.round(r.x * w - age * w / 2), Math.round(h / 2 - age * h / 2), Math.round(age * w), Math.round(age * h));
  }
}
function loop(now) {
  frame = 0;
  render(now);
  if (!reducedMotion.matches && (props.playing || energy > 0.005 || ripples.length)) start();
}
function start() {
  if (!frame && !folded.value && visible && !document.hidden) frame = requestAnimationFrame(loop);
}
function stop() { cancelAnimationFrame(frame); frame = 0; }
function resize() {
  const el = canvas.value;
  // Render on a deliberately small pixel grid, then scale it with crisp edges.
  el.width = Math.max(1, Math.round(el.clientWidth / 2));
  el.height = Math.max(1, Math.round(el.clientHeight / 2));
  render(performance.now());
}
function visibility() { if (document.hidden) stop(); else start(); }
function motionChange() { stop(); start(); }
watch(() => props.playing, playing => { if (playing) wake = performance.now(); start(); });
onMounted(() => {
  observer = new ResizeObserver(resize);
  observer.observe(canvas.value);
  visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start(); else stop();
  });
  visibilityObserver.observe(canvas.value);
  document.addEventListener('visibilitychange', visibility);
  reducedMotion.addEventListener('change', motionChange);
  resize();
  start();
  if (folded.value) emit('fold', true);
});
onBeforeUnmount(() => {
  stop();
  observer?.disconnect();
  visibilityObserver?.disconnect();
  document.removeEventListener('visibilitychange', visibility);
  reducedMotion.removeEventListener('change', motionChange);
});
</script>

<template>
  <!-- the slot takes whatever height is left, so the panel inside can snap down to its header -->
  <div class="cd-visualizer-slot" :class="{ folded }">
  <section class="cd-visualizer raised" aria-label="TANGO stereo display">
    <div class="cd-visualizer-heading">
      <span class="cd-visualizer-screw" aria-hidden="true"/>
      <!-- the same red maker's badge as the contact cabinet and the snake handheld -->
      <strong><span class="arcade-badge cd-visualizer-badge">TANGO</span> <span class="cd-visualizer-model">STEREO DISPLAY</span></strong>
      <span class="cd-visualizer-state"><i :class="{ on: playing }" aria-hidden="true"/>{{ playing ? 'PLAY' : 'PAUSED' }}</span>
      <button class="cd-visualizer-fold" :aria-expanded="!folded" :aria-label="folded ? 'Show stereo display' : 'Hide stereo display'" @click="toggleFold"><i :class="{ on: !folded }" aria-hidden="true"/>{{ folded ? 'SHOW' : 'HIDE' }}</button>
      <span class="cd-visualizer-screw" aria-hidden="true"/>
    </div>
    <button class="cd-visualizer-screen inset" aria-label="Send a ripple through the visualizer" @click="ripple">
      <canvas ref="canvas" aria-hidden="true"/>
      <span class="cd-visualizer-hint" aria-hidden="true">TAP TO RIPPLE</span>
    </button>
    <div class="cd-visualizer-controls" role="group" aria-label="Visualizer display mode">
      <button v-for="value in modes" :key="value" class="raised" :class="{ pressed: mode === value }" :aria-pressed="mode === value" @click="choose(value)">{{ value.toUpperCase() }}</button>
      <span class="cd-visualizer-vents" aria-hidden="true"/>
    </div>
  </section>
  </div>
</template>
