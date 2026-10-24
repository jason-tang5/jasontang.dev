<script setup>
// the figures in the liftlens writeup (content.mjs, figures): a real clean on video with
// the app's joint angles and bar speed for it alongside, the plate finder's
// circle check with a circle you can drag around, and three ways to get bar speed out
// of the same noisy track. the numbers follow lift-lens/backend (metrics.py,
// plate_tracking.py), drawn at 140 px a metre
import { computed, onBeforeUnmount, ref } from 'vue';
import { angles, clip, speed } from '../liftlens-clip.mjs';
// compact is the about page's fig 1: when it's narrow it keeps the video beside the
// readouts and leaves out the charts, so it doesn't run down the whole page
defineProps({ figure: { type: String, required: true }, compact: Boolean });

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
// a lifter at setup facing left, side on: shins against the bar, shoulders just over it,
// straight arms down to the bar. the near plate hides the shins
const wrist = [110, 145];
const knee = [92, 110];
const ankle = [136, 168];
const joints = { ankle, knee, hip: [158, 96], shoulder: [104, 56], wrist };
const circles = [{ x: 110, y: 145, r: 31.5 }, { x: 266, y: 66, r: 26 }];
const presets = {
  plate: { label: 'The plate', x: 110, y: 145, r: 31.5 },
  near: { label: 'Close miss', x: 124, y: 136, r: 34 },
  knee: { label: 'A knee', x: knee[0], y: knee[1], r: 18 },
  rack: { label: 'Racked plate', x: 266, y: 66, r: 26 },
};
const cand = ref({ ...presets.plate });
const isPreset = p => cand.value.x === p.x && cand.value.y === p.y && cand.value.r === p.r;
const RIM = Array.from({ length: 48 }, (_, i) => i * Math.PI / 24);
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

// ---- smooth: one clean's bar height at 60 fps with about a pixel of noise ----
const DT = 1 / 60;
const PX = 140;
const bump = (t, mu, s) => Math.exp(-(((t - mu) / s) ** 2) / 2);
// tracked from a little before the chart to a little after, so the moving average's
// warm-up and the fit's one-sided windows at the ends stay off it
const times = Array.from({ length: 79 }, (_, i) => -0.15 + i * DT);
const shown = times.map((t, i) => i).filter(i => times[i] > -1e-9 && times[i] < 1 + 1e-9);
const truth = times.map(t => 1.05 * bump(t, 0.32, 0.12) + 1.75 * bump(t, 0.7, 0.085));
const seed = ref(10);
// a small seeded generator so the same noise comes back each time the figure opens
function noise(n) {
  let s = n * 9301 + 49297;
  const next = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return () => Math.sqrt(-2 * Math.log(next() || 1e-9)) * Math.cos(2 * Math.PI * next());
}
const heights = computed(() => {
  const n = noise(seed.value);
  let h = 0;
  return truth.map((v, i) => { if (i) h += (truth[i - 1] + v) / 2 * DT * PX; return h + n(); });
});
const methods = {
  raw: { label: 'Frame to frame', note: 'Every pixel of noise becomes a spike, since it’s divided by a 60th of a second.' },
  average: { label: 'Moving average', note: 'Averaging the last 9 frames calms it down, but the peak always comes out late, and usually lower.' },
  fit: { label: 'Curve fit', note: 'A curve fit to the 50 ms either side of each point lands close to the true peak, with little noise.' },
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
// the plot area, with the frame-to-frame spikes clipped at its edges
const W = 300, H = 130, VMIN = -1, VMAX = 3;
const plot = { x: 26, y: 18, w: W - 34, h: H - 38 };
const sx = t => plot.x + t * plot.w;
const sy = v => plot.y + (VMAX - v) / (VMAX - VMIN) * plot.h;
const line = vs => shown.map(i => `${sx(times[i]).toFixed(1)},${sy(vs[i]).toFixed(1)}`).join(' ');
const peakOf = vs => shown.reduce((best, i) => (vs[i] > best.v ? { v: vs[i], i } : best), { v: -Infinity, i: 0 });
const truePeak = peakOf(truth);
const estPeak = computed(() => peakOf(estimate.value));
const lag = computed(() => Math.round((estPeak.value.i - truePeak.i) * DT * 1000));

// ---- reps: the clean's bar speed beside a made-up slower rep, in seconds or in percent ----
// the slower rep is the same clean stretched 30% longer, at a 30% lower speed so the bar
// still travels as far. lifting off is where speed first shows, the catch where it hits zero
const repRows = speed.filter(r => r[0] >= -0.05 && r[0] <= 1.09);
const reps = [1, 1.3].map((stretch, i) => {
  const rows = repRows.map(r => [(r[0] - repRows[0][0]) * stretch, r[1] / stretch]);
  return { name: i ? 'A slower rep' : 'This clean', cls: i ? 'b' : 'a', rows, length: rows.at(-1)[0], peak: Math.max(...rows.map(r => r[1])) };
});
const RW = 300, RH = 130, RLO = -0.4, RHI = 1.4, RSEC = 1.5;
const rplot = { x: 26, y: 18, w: RW - 34, h: RH - 38 };
const ry = v => rplot.y + (RHI - v) / (RHI - RLO) * rplot.h;
// 0 is seconds, 1 is percent of the rep. switching slides between the two
const stretched = ref(0);
const percent = ref(false);
let morph = 0;
function setPercent(on) {
  percent.value = on;
  cancelAnimationFrame(morph);
  const from = stretched.value, to = on ? 1 : 0;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { stretched.value = to; return; }
  const start = performance.now();
  const step = now => {
    const k = Math.min(1, (now - start) / 600);
    stretched.value = from + (to - from) * (k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    if (k < 1) morph = requestAnimationFrame(step);
  };
  morph = requestAnimationFrame(step);
}
onBeforeUnmount(() => cancelAnimationFrame(morph));
const rx = (t, length) => rplot.x + ((1 - stretched.value) * t / RSEC + stretched.value * t / length) * rplot.w;
const repLines = computed(() => reps.map(r => ({ ...r, points: r.rows.map(([t, v]) => `${rx(t, r.length).toFixed(1)},${ry(v).toFixed(1)}`).join(' ') })));
const STEPS = Array.from({ length: 101 }, (_, i) => rplot.x + i / 100 * rplot.w);

// ---- hips: the same clean from the floor to the knee, knee opening against hip opening ----
// the rows from lift-off until the bar passes the knee. the video follows the slider
const hipRows = angles.filter(r => r[0] <= 0.39);
const [hipT0, knee0, hip0] = hipRows[0];
const hipT1 = hipRows.at(-1)[0];
const hipVideo = ref(null);
const hipNow = ref(hipT1);
const hipPlaying = ref(false);
const opened = computed(() => ({ knee: sampleAt(angles, 1, hipNow.value) - knee0, hip: sampleAt(angles, 2, hipNow.value) - hip0 }));
// the chart puts the knee's opening across and the hip's up, the same scale both ways,
// so opening together would be the dashed diagonal
const HS = 150, HLO = -5, HHI = 50;
const hx = d => 22 + (d - HLO) / (HHI - HLO) * (HS - 30);
const hy = d => HS - 18 - (d - HLO) / (HHI - HLO) * (HS - 30);
const hipPath = hipRows.map(r => `${hx(r[1] - knee0).toFixed(1)},${hy(r[2] - hip0).toFixed(1)}`).join(' ');
const hipSoFar = computed(() => [...hipRows.filter(r => r[0] < hipNow.value).map(r => [r[1] - knee0, r[2] - hip0]), [opened.value.knee, opened.value.hip]]
  .map(([k, h]) => `${hx(k).toFixed(1)},${hy(h).toFixed(1)}`).join(' '));
let hipFrame = 0;
function hipShow(t) {
  hipNow.value = t;
  if (hipVideo.value) hipVideo.value.currentTime = Math.max(0, t);
}
// plays the stretch at quarter speed, from the floor again if it's already at the knee
function hipPlay() {
  const v = hipVideo.value;
  if (!v) return;
  if (!v.paused) { v.pause(); return; }
  if (hipNow.value >= hipT1 - 0.01) hipShow(hipT0);
  v.playbackRate = 0.25;
  v.play().catch(() => {});
}
function hipFollow() {
  const v = hipVideo.value;
  if (!v) return;
  if (v.currentTime >= hipT1) { v.pause(); hipNow.value = hipT1; return; }
  hipNow.value = Math.max(hipT0, v.currentTime);
  hipFrame = requestAnimationFrame(hipFollow);
}
function hipStarted() { hipPlaying.value = true; cancelAnimationFrame(hipFrame); hipFrame = requestAnimationFrame(hipFollow); }
function hipStopped() { hipPlaying.value = false; cancelAnimationFrame(hipFrame); }
function hipSeek(event) { hipVideo.value?.pause(); hipShow(Number(event.target.value)); }
onBeforeUnmount(() => cancelAnimationFrame(hipFrame));
</script>

<template>
  <figure v-if="figure === 'angles'" class="ll-figure" :class="{ 'll-compact': compact }">
    <!-- the about page puts its own caption here -->
    <figcaption><slot name="caption"><strong>Fig. 1</strong> A power clean, filmed from the side. Each angle comes from three keypoints, and the graphs follow the video.</slot></figcaption>
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
          <!-- the charts stretch to fill their box, so the titles sit on top in html
               and the strokes keep their width, or both would squash with them -->
          <div class="ll-chart-box">
            <span>Joint angles</span>
            <svg :viewBox="`0 0 ${CW} ${CH}`" preserveAspectRatio="none">
              <polyline v-for="l in angleLines" :key="l.name" :points="l.points" :style="{ stroke: l.color }" vector-effect="non-scaling-stroke"/>
              <line class="ll-cursor" :x1="cx(now)" :x2="cx(now)" y1="12" :y2="CH - 4" vector-effect="non-scaling-stroke"/>
            </svg>
          </div>
          <div class="ll-chart-box">
            <span>Bar speed, m/s</span>
            <svg :viewBox="`0 0 ${CW} ${CH}`" preserveAspectRatio="none">
              <line class="ll-zero" x1="4" :x2="CW - 4" :y1="vy(0)" :y2="vy(0)" vector-effect="non-scaling-stroke"/>
              <polyline class="ll-speed" :points="speedLine" vector-effect="non-scaling-stroke"/>
              <line class="ll-cursor" :x1="cx(now)" :x2="cx(now)" y1="12" :y2="CH - 4" vector-effect="non-scaling-stroke"/>
            </svg>
          </div>
        </div>
        <div class="ll-transport">
          <button class="raised ll-button" @click="play">{{ playing ? 'Pause' : 'Play' }}</button>
          <input :value="now" class="ll-scrub" type="range" :min="clip.start" :max="clip.end" step="0.01" aria-label="Point in the lift" @input="seek">
          <code>{{ (Math.min(Math.max(now, clip.start), clip.end) - clip.start).toFixed(1) }} /{{ (clip.end - clip.start).toFixed(1) }} s</code>
        </div>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'plate'" class="ll-figure">
    <figcaption><strong>Fig. 2</strong> Finding the plate at setup. Drag the dashed circle. Green ticks mark parts of the outline that line up with a real edge.</figcaption>
    <div class="ll-panel">
      <svg ref="plateSvg" class="ll-scene" viewBox="0 24 320 162" @pointermove="drag" @pointerup="release" @pointercancel="release">
        <line class="ll-floor" x1="0" x2="320" :y1="floor + 1" :y2="floor + 1"/>
        <g class="ll-rack" aria-hidden="true"><rect x="292" y="30" width="7" height="147"/><rect x="236" y="92" width="63" height="4"/></g>
        <g aria-hidden="true">
          <circle class="ll-head" cx="95" cy="46" r="8"/>
          <polyline class="ll-bone" :points="`102,${floor} 144,${floor}`"/>
          <polyline class="ll-bone" :points="Object.values(joints).join(' ')"/>
          <circle v-for="(p, name) in joints" :key="name" class="ll-key" :cx="p[0]" :cy="p[1]" r="2.5"/>
          <circle v-for="(c, i) in circles" :key="i" class="ll-real" :cx="c.x" :cy="c.y" :r="c.r"/>
          <circle v-for="(c, i) in circles" :key="`h${i}`" class="ll-hub" :cx="c.x" :cy="c.y" r="3"/>
          <text class="ll-tag" :x="knee[0] - 23" :y="knee[1] - 8" text-anchor="end">knee</text>
          <text class="ll-tag" :x="wrist[0] - 40" :y="wrist[1] + 3" text-anchor="end">wrists</text>
          <text class="ll-tag" :x="ankle[0] + 8" :y="ankle[1] + 2">ankle</text>
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
          <button v-for="(p, id) in presets" :key="id" class="raised ll-button" :class="{ pressed: isPreset(p) }" :aria-pressed="isPreset(p)" @click="cand = { ...p }">{{ p.label }}</button>
        </span>
      </div>
      <ul class="ll-checks" aria-live="polite">
        <li v-for="c in checks" :key="c.label" :class="{ ok: c.ok }"><b>{{ c.ok ? '✓' : '✗' }}</b> {{ c.label }}<template v-if="c.value"> ({{ c.value }})</template></li>
        <li class="ll-verdict" :class="{ ok: accepted }">{{ accepted ? 'Accepted' : 'Rejected' }}</li>
      </ul>
    </div>
  </figure>

  <figure v-else-if="figure === 'smooth'" class="ll-figure">
    <figcaption><strong>Fig. 3</strong> Bar speed through one clean, calculated three ways from the same jittery track. The dashed line is the true speed. The curve fit uses 50 ms either side of each point.</figcaption>
    <div class="ll-panel">
      <svg class="ll-chart" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`${methods[method].label}: peak ${estPeak.v.toFixed(2)} m/s`">
        <clipPath id="ll-plot"><rect :x="plot.x" :y="plot.y" :width="plot.w" :height="plot.h"/></clipPath>
        <line v-for="v in [-1, 0, 1, 2, 3]" :key="v" class="ll-grid" :class="{ zero: v === 0 }" :x1="sx(0)" :x2="sx(1)" :y1="sy(v)" :y2="sy(v)"/>
        <text v-for="v in [-1, 0, 1, 2, 3]" :key="`l${v}`" class="ll-axis" :x="sx(0) - 5" :y="sy(v) + 3" text-anchor="end">{{ v }}</text>
        <text v-for="t in [0, 0.5, 1]" :key="`t${t}`" class="ll-axis" :x="sx(t)" :y="H - 6" :text-anchor="t ? (t === 1 ? 'end' : 'middle') : 'start'">{{ t }} s</text>
        <text class="ll-axis" :x="sx(0) - 5" y="9" text-anchor="end">m/s</text>
        <g class="ll-legend" :transform="`translate(${sx(0) + 6}, 6)`">
          <line class="ll-truth" x1="0" x2="14" y1="0" y2="0"/><text x="18" y="3">True</text>
          <line class="ll-est" x1="44" x2="58" y1="0" y2="0"/><text x="62" y="3">{{ methods[method].label }}</text>
        </g>
        <g clip-path="url(#ll-plot)">
          <polyline class="ll-truth" :points="line(truth)"/>
          <polyline class="ll-est" :points="line(estimate)"/>
        </g>
        <circle class="ll-peak true" :cx="sx(times[truePeak.i])" :cy="sy(truePeak.v)" r="3.5"/>
        <circle class="ll-peak" :cx="sx(times[estPeak.i])" :cy="sy(Math.min(VMAX, estPeak.v))" r="3.5"/>
      </svg>
      <dl class="ll-readout" aria-live="polite">
        <div><dt>Peak</dt><dd>{{ estPeak.v.toFixed(2) }}<small>m/s</small></dd></div>
        <div><dt>True peak</dt><dd>{{ truePeak.v.toFixed(2) }}<small>m/s</small></dd></div>
        <div><dt>Timing</dt><dd>{{ lag === 0 ? 'On time' : `${Math.abs(lag)} ms ${lag > 0 ? 'late' : 'early'}` }}</dd></div>
      </dl>
      <p class="ll-note">{{ methods[method].note }}</p>
      <div class="ll-buttons">
        <span class="ll-toggle" role="group" aria-label="Method">
          <button v-for="(m, id) in methods" :key="id" class="raised ll-button" :class="{ pressed: method === id }" :aria-pressed="method === id" @click="method = id">{{ m.label }}</button>
        </span>
        <button class="raised ll-button" @click="seed++">New noise</button>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'reps'" class="ll-figure">
    <figcaption><strong>Fig. 4</strong> Bar speed for the clean in Fig. 1 and a made-up rep that’s 30% slower. Switch to percent to stretch both onto the same 101 steps.</figcaption>
    <div class="ll-panel">
      <svg class="ll-chart" :viewBox="`0 0 ${RW} ${RH}`" role="img" :aria-label="percent ? 'Both reps stretched to 0 to 100 percent, their curves on top of each other' : 'Both reps in seconds, the slower one longer and lower'">
        <line v-for="v in [0, 1]" :key="v" class="ll-grid" :class="{ zero: v === 0 }" :x1="rplot.x" :x2="rplot.x + rplot.w" :y1="ry(v)" :y2="ry(v)"/>
        <text v-for="v in [0, 1]" :key="`l${v}`" class="ll-axis" :x="rplot.x - 5" :y="ry(v) + 3" text-anchor="end">{{ v }}</text>
        <text class="ll-axis" :x="rplot.x - 5" y="9" text-anchor="end">m/s</text>
        <g class="ll-steps" :style="{ opacity: stretched }"><line v-for="(x, i) in STEPS" :key="i" :x1="x" :x2="x" :y1="ry(RLO) - (i % 10 ? 2 : 4)" :y2="ry(RLO)"/></g>
        <template v-if="percent">
          <text v-for="p in [0, 50, 100]" :key="`p${p}`" class="ll-axis" :x="rplot.x + p / 100 * rplot.w" :y="RH - 6" :text-anchor="p ? (p === 100 ? 'end' : 'middle') : 'start'">{{ p }}%</text>
        </template>
        <template v-else>
          <text v-for="t in [0, 0.5, 1, 1.5]" :key="`s${t}`" class="ll-axis" :x="rplot.x + t / RSEC * rplot.w" :y="RH - 6" :text-anchor="t ? (t === 1.5 ? 'end' : 'middle') : 'start'">{{ t }} s</text>
        </template>
        <g class="ll-legend" :transform="`translate(${rplot.x + 6}, 6)`">
          <line class="ll-rep a" x1="0" x2="14" y1="0" y2="0"/><text x="18" y="3">{{ reps[0].name }}</text>
          <line class="ll-rep b" x1="70" x2="84" y1="0" y2="0"/><text x="88" y="3">{{ reps[1].name }}</text>
        </g>
        <polyline v-for="r in repLines" :key="r.cls" class="ll-rep" :class="r.cls" :points="r.points"/>
      </svg>
      <dl class="ll-readout">
        <div v-for="r in reps" :key="r.cls"><dt>{{ r.name }}</dt><dd>{{ r.length.toFixed(2) }}<small>s, top {{ r.peak.toFixed(2) }} m/s</small></dd></div>
        <div><dt>On the chart</dt><dd>{{ percent ? '101' : '—' }}<small>{{ percent ? 'steps each' : 'real time' }}</small></dd></div>
      </dl>
      <p class="ll-note">{{ percent ? 'Stretched to the same length, every moment lines up, and the only difference left is how fast the bar moved.' : 'In real time the slower rep runs long, so its pull and catch land later and nothing lines up.' }}</p>
      <span class="ll-toggle" role="group" aria-label="Time axis">
        <button class="raised ll-button" :class="{ pressed: !percent }" :aria-pressed="!percent" @click="setPercent(false)">Seconds</button>
        <button class="raised ll-button" :class="{ pressed: percent }" :aria-pressed="percent" @click="setPercent(true)">Percent of the rep</button>
      </span>
    </div>
  </figure>

  <figure v-else-if="figure === 'hips'" class="ll-figure">
    <figcaption><strong>Fig. 5</strong> The clean in Fig. 1, from the floor until the bar passes the knee. If the knee and hip opened together, the line would follow the dashed diagonal.</figcaption>
    <div class="ll-panel ll-angles ll-hips">
      <div class="ll-cam">
        <video ref="hipVideo" class="ll-video" :src="videoUrl" :poster="posterUrl" muted playsinline preload="auto"
          aria-label="The start of the power clean, from the floor to the knee"
          @loadedmetadata="hipShow(hipNow)" @play="hipStarted" @pause="hipStopped"/>
      </div>
      <div class="ll-side">
        <dl class="ll-stats" aria-live="polite">
          <div><dt><i style="background: var(--ll-knee)" aria-hidden="true"/>Knee opened</dt><dd>{{ opened.knee >= 0 ? '+' : '' }}{{ Math.round(opened.knee) }}°</dd></div>
          <div><dt><i style="background: var(--ll-hip)" aria-hidden="true"/>Hip opened</dt><dd>{{ opened.hip >= 0 ? '+' : '' }}{{ Math.round(opened.hip) }}°</dd></div>
        </dl>
        <svg class="ll-opening" :viewBox="`0 0 ${HS} ${HS}`" aria-hidden="true">
          <line class="ll-zero" :x1="hx(HLO)" :x2="hx(HHI)" :y1="hy(0)" :y2="hy(0)"/>
          <line class="ll-zero" :x1="hx(0)" :x2="hx(0)" :y1="hy(HLO)" :y2="hy(HHI)"/>
          <line class="ll-together" :x1="hx(0)" :y1="hy(0)" :x2="hx(HHI)" :y2="hy(HHI)"/>
          <text class="ll-dim" :x="hx(32)" :y="hy(38)" text-anchor="end">together</text>
          <text class="ll-dim" :x="hx(HHI)" :y="HS - 4" text-anchor="end">knee opening →</text>
          <text class="ll-dim" :x="hx(HLO) + 2" :y="hy(HHI) + 6">↑ hip opening</text>
          <polyline class="ll-path ghost" :points="hipPath"/>
          <polyline class="ll-path" :points="hipSoFar"/>
          <circle class="ll-now" :cx="hx(opened.knee)" :cy="hy(opened.hip)" r="3"/>
        </svg>
        <div class="ll-transport">
          <button class="raised ll-button" @click="hipPlay">{{ hipPlaying ? 'Pause' : 'Play' }}</button>
          <input :value="hipNow" class="ll-scrub" type="range" :min="hipT0" :max="hipT1" step="0.005" aria-label="Point between the floor and the knee" @input="hipSeek">
          <code>{{ hipNow >= hipT1 - 0.01 ? 'knee' : 'floor →' }}</code>
        </div>
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
  display: grid; grid-template-columns: minmax(0, 9fr) minmax(0, 16fr); gap: 12px; align-items: stretch;
}
:root[data-theme="dark"] .ll-angles {
  --ll-tile: #1b1c1f; --ll-edge: #303136; --ll-text: #f4f4f5; --ll-dim: #989ba4;
  --ll-knee: #c6f36b; --ll-hip: #b49bff; --ll-elbow: #ffb35c; --ll-bar: #c6f36b;
}
.ll-cam { position: relative; aspect-ratio: 9 / 16; }
.ll-video { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: contain; }
.ll-side { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; min-height: 0; gap: 8px; }
.ll-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 0; }
.ll-stats > div { min-width: 0; padding: 6px 8px; background: var(--ll-tile); border: 1px solid var(--ll-edge); color: var(--ll-text); }
.ll-stats dt { display: flex; align-items: center; gap: 5px; font: 11px Tahoma, sans-serif; color: var(--ll-dim); }
.ll-stats dt i { width: 7px; height: 7px; border-radius: 50%; }
.ll-stats dt i.bar { background: var(--ll-bar); border-radius: 0; }
.ll-stats dd { margin: 2px 0 0; font: bold 20px 'Courier New', monospace; }
.ll-stats dd small { margin-left: 4px; font: 11px Tahoma, sans-serif; color: var(--ll-dim); }
.ll-charts { display: grid; grid-template-rows: repeat(2, minmax(0, 1fr)); min-height: 0; contain: size; gap: 6px; }
.ll-chart-box { position: relative; min-height: 0; }
.ll-chart-box span { position: absolute; top: 3px; left: 5px; font: 10px Tahoma, sans-serif; color: var(--ll-dim); pointer-events: none; }
.ll-charts svg { display: block; width: 100%; height: 100%; min-height: 0; box-sizing: border-box; background: var(--ll-tile); border: 1px solid var(--ll-edge); }
.ll-charts polyline { fill: none; stroke-width: 1.5; stroke-linejoin: round; }
.ll-charts .ll-speed { stroke: var(--ll-bar); }
.ll-zero { stroke: var(--ll-edge); }
.ll-cursor { stroke: var(--ll-text); stroke-width: 1; opacity: .6; }
.ll-transport { display: flex; align-items: center; gap: 8px; }
.ll-transport code { flex: none; font: 11px 'Courier New', monospace; color: var(--muted); }
.ll-scrub { flex: 1; min-width: 0; margin: 0; }
@container (max-width: 420px) {
  .ll-angles { grid-template-columns: minmax(0, 1fr); }
  .ll-cam { width: 100%; max-width: 202.5px; justify-self: center; }
  .ll-charts { contain: none; }
  .ll-charts svg { height: auto; }
}
/* too narrow for two readouts side by side */
@container (max-width: 260px) { .ll-stats { grid-template-columns: minmax(0, 1fr); } }
@container (max-width: 420px) {
  .ll-compact .ll-angles { grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); }
  /* the video stretches to the readouts' height and fills it, cropping a little off
     its sides, so the two columns end level */
  .ll-compact .ll-cam { max-width: none; aspect-ratio: auto; min-height: 200px; }
  .ll-compact .ll-video { object-fit: cover; }
  .ll-compact .ll-side { grid-template-rows: none; align-content: start; }
  .ll-compact .ll-stats { grid-template-columns: minmax(0, 1fr); }
  .ll-compact .ll-charts, .ll-compact .ll-transport code { display: none; }
}

/* fig 2 */
/* the lifter sits back in grey so the plates and the candidate circle read first */
.ll-scene .ll-bone { stroke: var(--muted); stroke-width: 3; fill: none; stroke-linecap: round; stroke-linejoin: round; opacity: .6; }
.ll-head { fill: none; stroke: var(--muted); stroke-width: 2.5; opacity: .6; }
.ll-hub { fill: var(--ink); stroke: none; }
.ll-scene .ll-key { fill: #e8a33d; stroke: none; }
.ll-scene { display: block; width: 100%; max-width: 480px; margin: 0 auto; touch-action: none; }
.ll-floor { stroke: var(--muted); stroke-width: 1.5; }
.ll-rack rect { fill: var(--muted); opacity: .5; }
.ll-real { fill: rgba(0, 0, 0, .1); stroke: var(--ink); stroke-width: 3; }
:root[data-theme="dark"] .ll-real { fill: rgba(255, 255, 255, .1); }
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
.ll-peak.true { fill: var(--paper); stroke: var(--muted); stroke-dasharray: 2 1.5; }
.ll-legend text { font: 8px Tahoma, sans-serif; fill: var(--muted); }
.ll-readout { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 10px 0 0; }
.ll-readout > div { padding: 5px 8px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); }
.ll-readout dt { font: 11px Tahoma, sans-serif; color: var(--muted); }
.ll-readout dd { margin: 2px 0 0; font: bold 17px 'Courier New', monospace; }
.ll-readout dd small { margin-left: 4px; font: 11px Tahoma, sans-serif; color: var(--muted); }

/* fig 4: the clean in navy like fig 3's estimate, the slower rep in orange */
.ll-rep { fill: none; stroke-width: 2; stroke-linejoin: round; }
.ll-rep.a { stroke: var(--navy, #000080); }
.ll-rep.b { stroke: #c46a00; }
:root[data-theme="dark"] .ll-rep.a { stroke: #8ca0ff; }
:root[data-theme="dark"] .ll-rep.b { stroke: #ffb35c; }
.ll-steps line { stroke: var(--muted); stroke-width: .5; }

/* fig 5: fig 1's layout and colours, with the opening chart under the readouts */
.ll-opening { display: block; width: 100%; height: 100%; min-height: 0; box-sizing: border-box; contain: size; background: var(--ll-tile); border: 1px solid var(--ll-edge); }
@container (max-width: 420px) { .ll-opening { contain: none; height: auto; max-width: 260px; justify-self: center; } }
.ll-dim { font: 7px Tahoma, sans-serif; fill: var(--ll-dim); }
.ll-together { stroke: var(--ll-dim); stroke-width: 1; stroke-dasharray: 3 2; }
.ll-path { fill: none; stroke: var(--ll-hip); stroke-width: 2; stroke-linejoin: round; }
.ll-path.ghost { opacity: .25; }
.ll-now { fill: var(--ll-knee); stroke: var(--ll-tile); stroke-width: 1; }
</style>
