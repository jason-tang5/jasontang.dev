// koi from the pond (koi-pond.js), made to fit in a figure. each swims by the pond's own
// rules (swimKoi): it turns toward where it's headed no tighter than a koi can, beats
// its tail harder when it's in a hurry, and its body follows the path its head took.
// the figures give them somewhere to go, and figure-pixels.js paints them the pond's way
import { SPACING, SPINE, createPond, swimKoi } from './koi-pond.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// length is nose to tail tip in the figure's units, heading in radians. pace sets how
// fast it drifts, in lengths a second; rushing somewhere it goes about three times that
export function createSwimmer(length, x, y, heading = 0, { pace = 0.5, random = Math.random } = {}) {
  const size = length / (SPACING * SPINE);
  const [markings] = createPond({ width: 1, height: 1, count: 1, random }).koi;
  return {
    x, y, heading, size, length,
    speed: length * pace * (0.9 + random() * 0.2),
    phase: random() * Math.PI * 2,
    excite: 0,
    wanderAt: 0,
    goal: null,
    // its markings, made the same way as a pond koi's, so it's painted just like one
    spots: markings.spots,
    deep: markings.deep,
    // laid out straight behind it to start with, like the pond's
    spine: Array.from({ length: SPINE }, (_, n) => ({ x: x - Math.cos(heading) * n * SPACING * size, y: y - Math.sin(heading) * n * SPACING * size })),
  };
}

// rushes toward (x, y) for dt seconds, slowing and turning tighter as it closes in the
// way a pond koi does on a pellet. true once its mouth is there
export function swimToward(k, x, y, dt) {
  const d = Math.hypot(x - k.x, y - k.y);
  if (d < k.length * 0.3) return true;
  swimKoi(k, Math.atan2(y - k.y, x - k.x), dt, { rushing: true, near: clamp(1 - d / (k.length * 2.5), 0, 1) });
  return Math.hypot(x - k.x, y - k.y) < k.length * 0.3;
}

// drifts about inside a circle ({ cx, cy, r }) with nowhere in particular to go, picking
// a new spot inside it every few seconds or when it gets there, like a pond koi wandering
export function wander(k, dt, { cx, cy, r }, random = Math.random) {
  k.wanderAt -= dt;
  const reached = k.goal && Math.hypot(k.goal.x - k.x, k.goal.y - k.y) < k.length * 0.6;
  if (!k.goal || k.wanderAt <= 0 || reached) {
    const a = random() * Math.PI * 2, out = Math.sqrt(random()) * r;
    k.goal = { x: cx + Math.cos(a) * out, y: cy + Math.sin(a) * out };
    k.wanderAt = 2 + random() * 3;
  }
  swimKoi(k, Math.atan2(k.goal.y - k.y, k.goal.x - k.x), dt, { near: 0.5 });
}

// holds still, its tail swaying slowly, as a koi resting on the bottom
export function rest(k, dt) {
  k.excite = Math.max(0, k.excite - dt * 0.5);
  k.phase += dt * 1.6;
}
