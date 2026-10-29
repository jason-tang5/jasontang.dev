import test from 'node:test';
import assert from 'node:assert/strict';
import { createPond, feedPond, stepPond } from '../src/koi-pond.js';

// the same "random" numbers every run
function seeded(seed = 1) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

test('koi stay in the pond while they wander', () => {
  const pond = createPond({ width: 800, height: 600, count: 6, random: seeded() });
  for (let i = 0; i < 2000; i++) stepPond(pond, 0.05);
  for (const k of pond.koi) {
    assert.ok(k.x > -80 && k.x < 880 && k.y > -80 && k.y < 680, `koi at ${Math.round(k.x)}, ${Math.round(k.y)}`);
  }
});

test('feeding drops pellets that each ripple as they land, and nearby koi swim over and eat them', () => {
  const pond = createPond({ width: 800, height: 600, count: 1, random: seeded(7) });
  const [koi] = pond.koi;
  koi.speed = 0;
  feedPond(pond, koi.x + 120, koi.y);
  assert.equal(pond.food.length, 4);
  assert.equal(pond.ripples.length, 0);
  for (let i = 0; i < 12; i++) stepPond(pond, 0.05);
  assert.equal(pond.ripples.length, 4);
  koi.speed = 35;
  for (let i = 0; i < 400 && pond.food.length; i++) stepPond(pond, 0.05);
  assert.equal(pond.food.length, 0);
  assert.equal(pond.eaten, 4);
});

test('uneaten pellets sink away and ripples fade', () => {
  const pond = createPond({ width: 2000, height: 2000, count: 1, random: seeded(3) });
  const [koi] = pond.koi;
  // far out of sight of the only koi
  pond.koi[0].x = 100; pond.koi[0].y = 100; koi.speed = 0;
  feedPond(pond, 1900, 1900);
  for (let i = 0; i < 20 * 15; i++) stepPond(pond, 0.05);
  assert.equal(pond.food.length, 0);
  assert.equal(pond.eaten, 0);
  assert.equal(pond.ripples.length, 0);
});

test('pellets ease apart so no two share a square', () => {
  const pond = createPond({ width: 2000, height: 2000, count: 1, random: seeded(5) });
  pond.koi[0].x = 100; pond.koi[0].y = 100; pond.koi[0].speed = 0;
  feedPond(pond, 1500, 1500, 8);
  for (let i = 0; i < 40; i++) stepPond(pond, 0.05);
  const cells = new Set(pond.food.map(f => `${Math.floor(f.x / 11)},${Math.floor(f.y / 11)}`));
  assert.equal(cells.size, pond.food.length);
});
