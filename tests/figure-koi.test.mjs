import test from 'node:test';
import assert from 'node:assert/strict';
import { createSwimmer, rest, swimToward, wander } from '../src/figure-koi.js';

// the same "random" numbers every run
function seeded(seed = 1) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

test('a figure koi swims to where it is sent, even one behind it', () => {
  for (const [tx, ty] of [[300, 0], [-200, 40], [0, -150]]) {
    const k = createSwimmer(40, 0, 0, 0, { random: seeded(3) });
    let arrived = false;
    for (let i = 0; i < 600 && !arrived; i++) arrived = swimToward(k, tx, ty, 1 / 30);
    assert.ok(arrived, `didn't reach ${tx}, ${ty}`);
  }
});

test('it turns in an arc like a pond koi instead of spinning on the spot', () => {
  const k = createSwimmer(40, 0, 0, 0, { random: seeded(5) });
  let most = 0;
  for (let i = 0; i < 60; i++) {
    const before = k.heading;
    swimToward(k, -300, 0, 1 / 30);
    most = Math.max(most, Math.abs(Math.atan2(Math.sin(k.heading - before), Math.cos(k.heading - before))));
  }
  assert.ok(most <= 2.5 / 30 + 1e-9, `turned ${most} in one frame`);
});

test('it keeps its length as it swims and stays in the circle it wanders', () => {
  const random = seeded(9);
  const k = createSwimmer(30, 100, 100, 0, { random });
  for (let i = 0; i < 900; i++) wander(k, 1 / 30, { cx: 100, cy: 100, r: 30 }, random);
  assert.ok(Math.hypot(k.x - 100, k.y - 100) < 30 + 30, `wandered off to ${Math.round(k.x)}, ${Math.round(k.y)}`);
  const along = k.spine.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - k.spine[i].x, p.y - k.spine[i].y), 0);
  assert.ok(Math.abs(along - 30 * (k.spine.length - 1) / k.spine.length) < 3, `spine is ${along} long`);
  const { x, y } = k;
  rest(k, 1);
  assert.deepEqual([k.x, k.y], [x, y]);
});
