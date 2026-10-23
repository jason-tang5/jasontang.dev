<script setup>
// the figures in the liftlens writeup (content.mjs, figures): a real clean on video with
// the app's joint angles and bar speed for it alongside, the plate finder's
// circle check with a circle you can drag around, and three ways to get bar speed out
// of the same noisy track. the numbers follow lift-lens/backend (metrics.py,
// plate_tracking.py), drawn at 140 px a metre
import { computed, onBeforeUnmount, ref } from 'vue';
import { angles, clip, speed } from '../liftlens-clip.mjs';
defineProps({ figure: { type: String, required: true } });

// ---- angles: a real clean on video, with liftlens's numbers for it alongside ----
// the video already has the app's skeleton and bar path drawn on. the charts and readouts
// follow its playback, from the analysis in liftlens-clip.mjs
const videoUrl = new URL('../../assets/projects/liftlens-clean.mp4', import.meta.url).href;
const posterUrl = new URL('../../assets/projects/liftlens-clean-poster.jpg', import.meta.url).href;
const video = ref(null);
const now = ref(clip.start);
const playing = ref(false);
// the value at time t, straight between the samples either side, or null where there's none
function sampleAt(rows, col, t) {
  const i = rows.findIndex(r => r[0] >= t);
  if (i <= 0) return rows[Math.max(0, i)]?.[col] ?? null;
  const a = rows[i - 1], b = rows[i];
  if (a[col] === null || b[col] === null) return a[col] ?? b[col];
  return a[col] + (b[col] - a[col]) * (t - a[0]) / (b[0] - a[0]);
}
const angleDefs = [
  { name: 'Knee', col: 1, color: 'var(--ll-knee)' },
  { name: 'Hip', col: 2, color: 'var(--ll-hip)' },
  { name: 'Elbow', col: 3, color: 'var(--ll-elbow)' },
];
const readouts = computed(() => angleDefs.map(d => ({ ...d, value: sampleAt(angles, d.col, now.value) })));
const speedNow = computed(() => sampleAt(speed, 1, now.value));

// the charts run from the start of the clip to the end
const CW = 200, CH = 70;
const cx = t => 4 + (t - clip.start) / (clip.end - clip.start) * (CW - 8);
const inClip = rows => rows.filter(r => r[0] >= clip.start && r[0] <= clip.end);
const angleLines = angleDefs.map(d => ({
  ...d,
  points: inClip(angles).filter(r => r[d.col] !== null).map(r => `${cx(r[0]).toFixed(1)},${(CH - 6 - r[d.col] / 180 * (CH - 18)).toFixed(1)}`).join(' '),
}));
const VLO = -0.5, VHI = 2;
const vy = v => CH - 6 - (Math.min(VHI, Math.max(VLO, v)) - VLO) / (VHI - VLO) * (CH - 18);
const speedLine = inClip(speed).map(r => `${cx(r[0]).toFixed(1)},${vy(r[1]).toFixed(1)}`).join(' ');

// the video loops the lift itself, skipping the summary the export ends on
let frame = 0;
function follow() {
  const v = video.value;
  if (!v) return;
  if (v.currentTime >= clip.end || v.currentTime < clip.start - 0.05) v.currentTime = clip.start;
  now.value = v.currentTime;
  frame = requestAnimationFrame(follow);
}
function play() {
  const v = video.value;
  if (!v) return;
  if (!v.paused) { v.pause(); return; }
  v.play().catch(() => {});
}
function seek(event) {
  const v = video.value;
  if (!v) return;
  v.pause();
  v.currentTime = now.value = Number(event.target.value);
}
function started() { playing.value = true; cancelAnimationFrame(frame); frame = requestAnimationFrame(follow); }
function stopped() { playing.value = false; cancelAnimationFrame(frame); if (video.value) now.value = video.value.currentTime; }
function loaded() {
  const v = video.value;
  v.currentTime = clip.start;
  // with reduced motion it waits on the first frame until you press play
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) v.play().catch(() => {});
}
onBeforeUnmount(() => cancelAnimationFrame(frame));

// ---- plate: the circle check from setup_plate. the plate is 450 mm, 31.5 px here ----
const floor = 176;
const wrist = [110, 145];
const circles = [{ x: 110, y: 145, r: 31.5 }, { x: 266, y: 66, r: 26 }];
const knee = [168, 118];
const presets = {
  plate: { label: 'The plate', x: 110, y: 145, r: 31.5 },
  near: { label: 'Close miss', x: 124, y: 136, r: 34 },
  knee: { label: 'A knee', x: knee[0], y: knee[1], r: 18 },
  rack: { label: 'Racked plate', x: 266, y: 66, r: 26 },
};
const cand = ref({ ...presets.near });
const RIM = Array.from({ length: 72 }, (_, i) => i * Math.PI / 36);
const RADIAL = Array.from({ length: 7 }, (_, i) => 0.88 + i * 0.04);
// an angle has support when some sample along its short radial line sits on a real
// circle's edge and that edge runs across the line rather than along it
const ticks = computed(() => {
  const { x, y, r } = cand.value;
  return RIM.map(a => {
    const c = Math.cos(a), s = Math.sin(a);
    const hit = circles.some(C => {
      const f = RADIAL.map(k => Math.hypot(x + c * k * r - C.x, y + s * k * r - C.y) - C.r);
      const i = f.findIndex((v, j) => Math.abs(v) < 1 || (j && Math.sign(v) !== Math.sign(f[j - 1])));
      if (i < 0) return false;
      const px = x + c * RADIAL[i] * r - C.x, py = y + s * RADIAL[i] * r - C.y;
      return Math.abs(px * c + py * s) / Math.hypot(px, py) > 0.6;
    });
    return { a, hit, inner: [x + c * r * 0.88, y + s * r * 0.88], outer: [x + c * r * 1.12, y + s * r * 1.12] };
  });
});
const support = computed(() => ticks.value.filter(t => t.hit).length / ticks.value.length);
const checks = computed(() => {
  const { x, y, r } = cand.value;
  const bottom = y + r - floor;
  return [
    { label: 'Half the rim has an edge', ok: support.value >= 0.5, value: `${Math.round(support.value * 100)}%` },
    { label: 'Level with the wrists', ok: Math.abs(wrist[1] - y) <= 0.8 * r && Math.abs(wrist[0] - x) <= 3 * r },
    { label: 'Resting on the floor', ok: bottom >= -0.6 * r && bottom <= 1.2 * r },
  ];
});
const accepted = computed(() => checks.value.every(c => c.ok));
const plateSvg = ref(null);
let dragging = null;
function toSvg(event) {
  const pt = plateSvg.value.createSVGPoint();
  pt.x = event.clientX; pt.y = event.clientY;
  return pt.matrixTransform(plateSvg.value.getScreenCTM().inverse());
}
function grab(event) {
  const p = toSvg(event);
  dragging = [p.x - cand.value.x, p.y - cand.value.y];
  event.currentTarget.setPointerCapture(event.pointerId);
}
function drag(event) {
  if (!dragging) return;
  const p = toSvg(event);
  cand.value = { ...cand.value, x: Math.round(Math.min(310, Math.max(10, p.x - dragging[0]))), y: Math.round(Math.min(190, Math.max(10, p.y - dragging[1]))) };
}
function release() { dragging = null; }
function nudge(event) {
  const step = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[event.key];
  if (!step) return;
  event.preventDefault();
  cand.value = { ...cand.value, x: cand.value.x + step[0], y: cand.value.y + step[1] };
}

// ---- smooth: one clean's bar height at 60 fps with a pixel or so of noise ----
const DT = 1 / 60;
const PX = 140;
const bump = (t, mu, s) => Math.exp(-(((t - mu) / s) ** 2) / 2);
const times = Array.from({ length: 61 }, (_, i) => i * DT);
const truth = times.map(t => 1.05 * bump(t, 0.32, 0.12) + 1.75 * bump(t, 0.7, 0.065));
const seed = ref(7);
// a small seeded generator so the same noise comes back each time the figure opens
function noise(n) {
  let s = n * 9301 + 49297;
  const next = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return () => Math.sqrt(-2 * Math.log(next() || 1e-9)) * Math.cos(2 * Math.PI * next());
}
const heights = computed(() => {
  const n = noise(seed.value);
  let h = 0;
  return truth.map((v, i) => { if (i) h += (truth[i - 1] + v) / 2 * DT * PX; return h + n() * 1.2; });
});
const methods = {
  raw: { label: 'Frame to frame', note: 'Every pixel of noise becomes a spike, since it’s divided by a 60th of a second.' },
  average: { label: 'Moving average', note: 'Averaging the last 9 frames calms it down, but the peak comes out lower and late.' },
  fit: { label: 'Curve fit', note: 'A curve fit to the 50 ms either side of each point keeps the peak where it was, with little noise.' },
};
const method = ref('fit');
const estimate = computed(() => {
  const y = heights.value;
  const raw = y.map((v, i) => (i ? (v - y[i - 1]) / DT / PX : 0));
  if (method.value === 'raw') return raw;
  if (method.value === 'average') return raw.map((_, i) => { const w = raw.slice(Math.max(1, i - 8), i + 1); return w.length ? w.reduce((a, b) => a + b) / w.length : 0; });
  // least squares fit of a + b dt + c dt^2 over the window, solved with the normal equations
  return y.map((_, i) => {
    let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, r0 = 0, r1 = 0, r2 = 0;
    for (let j = Math.max(0, i - 3); j <= Math.min(y.length - 1, i + 3); j++) {
      const d = (j - i) * DT;
      s0 += 1; s1 += d; s2 += d * d; s3 += d ** 3; s4 += d ** 4;
      r0 += y[j]; r1 += y[j] * d; r2 += y[j] * d * d;
    }
    const m = [[s0, s1, s2], [s1, s2, s3], [s2, s3, s4]];
    const det = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const withCol = [[s0, r0, s2], [s1, r1, s3], [s2, r2, s4]];
    return det(withCol) / det(m) / PX;
  });
});
const W = 300, H = 130, VMIN = -1.5, VMAX = 3.5;
const sx = t => 30 + t * (W - 40);
const sy = v => 10 + (VMAX - v) / (VMAX - VMIN) * (H - 30);
const line = vs => vs.map((v, i) => `${sx(times[i]).toFixed(1)},${sy(Math.max(VMIN, Math.min(VMAX, v))).toFixed(1)}`).join(' ');
const peakOf = vs => vs.reduce((best, v, i) => (v > best.v ? { v, i } : best), { v: -Infinity, i: 0 });
const truePeak = peakOf(truth);
const estPeak = computed(() => peakOf(estimate.value));
const lag = computed(() => Math.round((estPeak.value.i - truePeak.i) * DT * 1000));
</script>

<template>
  <figure v-if="figure === 'angles'" class="ll-figure">
    <figcaption><strong>Fig. 1</strong> A power clean, filmed from the side. Each angle comes from three keypoints, and the graphs follow the video.</figcaption>
    <div class="ll-panel ll-angles">
      <div class="ll-cam">
        <video ref="video" class="ll-video" :src="videoUrl" :poster="posterUrl" muted playsinline preload="auto"
          aria-label="A power clean with LiftLens's skeleton and bar path drawn on"
          @loadedmetadata="loaded" @play="started" @pause="stopped" @seeked="now = video.currentTime"/>
      </div>
      <div class="ll-side">
        <dl class="ll-stats">
          <div v-for="a in readouts" :key="a.name">
            <dt><i :style="{ background: a.color }" aria-hidden="true"/>{{ a.name }}</dt>
            <dd>{{ a.value === null ? '—' : `${Math.round(a.value)}°` }}</dd>
          </div>
          <div>
            <dt><i class="bar" aria-hidden="true"/>Bar speed</dt>
            <dd>{{ speedNow === null ? '—' : speedNow.toFixed(2) }}<small>m/s</small></dd>
          </div>
        </dl>
        <div class="ll-charts" aria-hidden="true">
          <svg :viewBox="`0 0 ${CW} ${CH}`">
            <text x="4" y="9">Joint angles</text>
            <polyline v-for="l in angleLines" :key="l.name" :points="l.points" :style="{ stroke: l.color }"/>
            <line class="ll-cursor" :x1="cx(now)" :x2="cx(now)" y1="12" :y2="CH - 4"/>
          </svg>
          <svg :viewBox="`0 0 ${CW} ${CH}`">
            <text x="4" y="9">Bar speed, m/s</text>
            <line class="ll-zero" x1="4" :x2="CW - 4" :y1="vy(0)" :y2="vy(0)"/>
            <polyline class="ll-speed" :points="speedLine"/>
            <line class="ll-cursor" :x1="cx(now)" :x2="cx(now)" y1="12" :y2="CH - 4"/>
          </svg>
        </div>
        <div class="ll-transport">
          <button class="raised ll-button" @click="play">{{ playing ? 'Pause' : 'Play' }}</button>
          <input :value="now" class="ll-scrub" type="range" :min="clip.start" :max="clip.end" step="0.01" aria-label="Point in the lift" @input="seek">
          <code>{{ (now - clip.start).toFixed(1) }} / {{ (clip.end - clip.start).toFixed(1) }} s</code>
        </div>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'plate'" class="ll-figure">
    <figcaption><strong>Fig. 2</strong> Finding the plate at setup. Drag the dashed circle. Green ticks mark parts of the outline that line up with a real edge.</figcaption>
    <div class="ll-panel">
      <svg ref="plateSvg" class="ll-scene" viewBox="0 0 320 200" @pointermove="drag" @pointerup="release" @pointercancel="release">
        <rect class="ll-ground" x="0" :y="floor + 2" width="320" :height="200 - floor - 2"/>
        <g class="ll-rack" aria-hidden="true"><rect x="290" y="30" width="8" height="148"/><rect x="232" y="90" width="66" height="5"/></g>
        <g aria-hidden="true">
          <circle v-for="(c, i) in circles" :key="i" class="ll-real" :cx="c.x" :cy="c.y" :r="c.r"/>
          <circle v-for="(c, i) in circles" :key="`h${i}`" class="ll-hub" :cx="c.x" :cy="c.y" r="3"/>
          <polyline class="ll-bone thin" :points="`138,${floor} ${knee[0]},${knee[1]} 120,96 150,52`"/>
          <polyline class="ll-bone thin" :points="`150,52 ${wrist[0] + 8},100 ${wrist[0]},${wrist[1]}`"/>
          <circle v-for="(p, i) in [[138, floor], knee, [120, 96], [150, 52], wrist]" :key="`k${i}`" class="ll-key" :cx="p[0]" :cy="p[1]" r="3"/>
          <text class="ll-tag" :x="knee[0] + 8" :y="knee[1] - 4">knee</text>
          <text class="ll-tag" :x="wrist[0] - 30" :y="wrist[1] - 36">wrists</text>
          <text class="ll-tag" x="142" :y="floor - 4">ankle</text>
        </g>
        <g aria-hidden="true">
          <line v-for="(t, i) in ticks" :key="i" class="ll-tick" :class="{ hit: t.hit }" :x1="t.inner[0]" :y1="t.inner[1]" :x2="t.outer[0]" :y2="t.outer[1]"/>
        </g>
        <circle class="ll-cand" :class="{ ok: accepted }" :cx="cand.x" :cy="cand.y" :r="cand.r" tabindex="0" role="slider"
          aria-label="Candidate circle, arrow keys move it" :aria-valuetext="`${Math.round(support * 100)}% rim support`"
          @pointerdown="grab" @keydown="nudge"/>
      </svg>
      <div class="ll-controls">
        <label class="ll-radius">Radius <input v-model.number="cand.r" type="range" min="12" max="48" step="0.5"></label>
        <span class="ll-toggle" role="group" aria-label="Try a circle">
          <button v-for="(p, id) in presets" :key="id" class="raised ll-button" @click="cand = { ...p }">{{ p.label }}</button>
        </span>
      </div>
      <ul class="ll-checks" aria-live="polite">
        <li v-for="c in checks" :key="c.label" :class="{ ok: c.ok }"><b>{{ c.ok ? '✓' : '✗' }}</b> {{ c.label }}<template v-if="c.value"> ({{ c.value }})</template></li>
        <li class="ll-verdict" :class="{ ok: accepted }">{{ accepted ? 'Taken as the plate' : 'Rejected' }}</li>
      </ul>
    </div>
  </figure>

  <figure v-else-if="figure === 'smooth'" class="ll-figure">
    <figcaption><strong>Fig. 3</strong> Bar speed through one clean, calculated three ways from the same jittery track. The dashed line is the true speed. The curve fit uses 50 ms either side of each point.</figcaption>
    <div class="ll-panel">
      <svg class="ll-chart" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`${methods[method].label}: peak ${estPeak.v.toFixed(2)} m/s`">
        <line v-for="v in [-1, 0, 1, 2, 3]" :key="v" class="ll-grid" :class="{ zero: v === 0 }" :x1="sx(0)" :x2="sx(1)" :y1="sy(v)" :y2="sy(v)"/>
        <text v-for="v in [-1, 0, 1, 2, 3]" :key="`l${v}`" class="ll-axis" :x="sx(0) - 5" :y="sy(v) + 3" text-anchor="end">{{ v }}</text>
        <text v-for="t in [0, 0.5, 1]" :key="`t${t}`" class="ll-axis" :x="sx(t)" :y="H - 6" text-anchor="middle">{{ t }} s</text>
        <text class="ll-axis" x="4" y="12">m/s</text>
        <polyline class="ll-truth" :points="line(truth)"/>
        <polyline class="ll-est" :points="line(estimate)"/>
        <circle class="ll-peak" :cx="sx(times[estPeak.i])" :cy="sy(Math.min(VMAX, estPeak.v))" r="3.5"/>
      </svg>
      <p class="ll-note" aria-live="polite">
        <b>Peak {{ estPeak.v.toFixed(2) }} m/s</b>, true {{ truePeak.v.toFixed(2) }} m/s,
        {{ lag === 0 ? 'right on time' : `${Math.abs(lag)} ms ${lag > 0 ? 'late' : 'early'}` }}. {{ methods[method].note }}
      </p>
      <div class="ll-buttons">
        <span class="ll-toggle" role="group" aria-label="Method">
          <button v-for="(m, id) in methods" :key="id" class="raised ll-button" :class="{ pressed: method === id }" :aria-pressed="method === id" @click="method = id">{{ m.label }}</button>
        </span>
        <button class="raised ll-button" @click="seed++">New noise</button>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.ll-figure { margin: 18px 0 22px; font-family: 'Pixel MS Sans Serif', Tahoma, sans-serif; container-type: inline-size; }
.ll-figure figcaption { margin-bottom: 8px; font-size: 12px; color: var(--muted); }
.ll-figure figcaption strong { color: var(--ink); margin-right: 4px; }
/* sunken like the other figures, grey bottom right edge so the corner shows on white */
.ll-panel { --sunk-edge: var(--shadow); padding: 12px; background: var(--paper); border: 2px solid; border-color: var(--edge) var(--sunk-edge) var(--sunk-edge) var(--edge); box-shadow: inset 1px 1px var(--shadow); }
:root[data-theme="dark"] .ll-panel { --sunk-edge: var(--light); }
.ll-button { padding: 3px 10px; font: 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--ink); }
.ll-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
.ll-toggle { display: inline-flex; flex-wrap: wrap; gap: 0; }
.ll-note { min-height: 2.8em; margin: 10px 0 8px; font-size: 13px; line-height: 1.4; }

/* fig 1: the video beside its readouts and the rep's charts. they follow the site's
   theme, and in dark mode take the app's own dark dashboard colours */
.ll-angles {
  --ll-tile: var(--d-page-alt, #fffdf2); --ll-edge: var(--d-line, #999); --ll-text: var(--ink); --ll-dim: var(--muted);
  --ll-knee: #000080; --ll-hip: #8a3fc7; --ll-elbow: #c46a00; --ll-bar: #138a5f;
  display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr); gap: 12px; align-items: start;
}
:root[data-theme="dark"] .ll-angles {
  --ll-tile: #1b1c1f; --ll-edge: #303136; --ll-text: #f4f4f5; --ll-dim: #989ba4;
  --ll-knee: #c6f36b; --ll-hip: #b49bff; --ll-elbow: #ffb35c; --ll-bar: #c6f36b;
}
.ll-video { display: block; width: 100%; max-height: 460px; aspect-ratio: 9 / 16; object-fit: contain; margin: 0 auto; }
.ll-side { display: grid; gap: 8px; }
.ll-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 0; }
.ll-stats > div { padding: 6px 8px; background: var(--ll-tile); border: 1px solid var(--ll-edge); color: var(--ll-text); }
.ll-stats dt { display: flex; align-items: center; gap: 5px; font: 11px Tahoma, sans-serif; color: var(--ll-dim); }
.ll-stats dt i { width: 7px; height: 7px; border-radius: 50%; }
.ll-stats dt i.bar { background: var(--ll-bar); border-radius: 0; }
.ll-stats dd { margin: 2px 0 0; font: bold 20px 'Courier New', monospace; }
.ll-stats dd small { margin-left: 4px; font: 11px Tahoma, sans-serif; color: var(--ll-dim); }
.ll-charts { display: grid; gap: 6px; }
.ll-charts svg { display: block; width: 100%; background: var(--ll-tile); border: 1px solid var(--ll-edge); }
.ll-charts text { font: 7px Tahoma, sans-serif; fill: var(--ll-dim); }
.ll-charts polyline { fill: none; stroke-width: 1.5; stroke-linejoin: round; }
.ll-charts .ll-speed { stroke: var(--ll-bar); }
.ll-zero { stroke: var(--ll-edge); }
.ll-cursor { stroke: var(--ll-text); stroke-width: 1; opacity: .6; }
.ll-transport { display: flex; align-items: center; gap: 8px; }
.ll-transport code { flex: none; font: 11px 'Courier New', monospace; color: var(--muted); }
.ll-scrub { flex: 1; min-width: 0; margin: 0; }
@container (max-width: 420px) { .ll-angles { grid-template-columns: minmax(0, 1fr); } .ll-video { max-height: 360px; } }

/* fig 2 */
.ll-scene .ll-bone { stroke: var(--ink); stroke-width: 4; fill: none; opacity: 1; }
.ll-scene .ll-bone.thin { stroke-width: 3; opacity: .55; }
.ll-hub { fill: var(--ink); stroke: none; }
.ll-scene .ll-key { fill: #e8a33d; stroke: var(--ink); stroke-width: 1; opacity: 1; }
.ll-scene { display: block; width: 100%; max-width: 480px; margin: 0 auto; touch-action: none; }
.ll-ground { fill: var(--d-page-alt, #fffdf2); stroke: var(--muted); stroke-width: 1; }
.ll-rack rect { fill: var(--muted); opacity: .5; }
.ll-real { fill: rgba(0, 0, 0, .08); stroke: var(--ink); stroke-width: 3; }
:root[data-theme="dark"] .ll-real { fill: rgba(255, 255, 255, .08); }
.ll-tag { font: 8px 'Courier New', monospace; fill: var(--muted); }
.ll-tick { stroke: var(--muted); stroke-width: 1.5; opacity: .45; }
.ll-tick.hit { stroke: #1baf7a; stroke-width: 2.5; opacity: 1; }
.ll-cand { fill: rgba(232, 163, 61, .12); stroke: #c0392b; stroke-width: 1.5; stroke-dasharray: 4 3; cursor: grab; outline: none; }
.ll-cand.ok { stroke: #1baf7a; }
.ll-cand:focus-visible { stroke-width: 2.5; }
.ll-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 10px; font-size: 12px; }
.ll-radius { display: inline-flex; align-items: center; gap: 6px; }
.ll-checks { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 10px 0 0; padding: 0; list-style: none; font-size: 12px; }
.ll-checks li { color: #c0392b; }
.ll-checks li.ok { color: var(--ink); }
.ll-checks li.ok b { color: #1baf7a; }
.ll-verdict { padding: 0 6px; font-weight: bold; background: #c0392b; color: #fff !important; }
.ll-verdict.ok { background: #1baf7a; }

/* fig 3 */
.ll-chart { display: block; width: 100%; max-width: 520px; margin: 0 auto; }
.ll-grid { stroke: var(--d-line, #ccc); stroke-width: 1; opacity: .5; }
.ll-grid.zero { opacity: 1; }
.ll-axis { font: 8px 'Courier New', monospace; fill: var(--muted); }
.ll-truth { fill: none; stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 4 3; }
.ll-est { fill: none; stroke: var(--navy, #000080); stroke-width: 2; stroke-linejoin: round; }
:root[data-theme="dark"] .ll-est { stroke: #8ca0ff; }
.ll-peak { fill: #e8a33d; stroke: var(--ink); stroke-width: 1; }
</style>
