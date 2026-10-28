import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampBounds,
  resizeBounds,
  createWindow,
  placeBeside,
  restoreWindow,
  isSavedBounds,
  toggleMaximize,
  nextVisible,
  bounds,
  columnApps,
  presetBounds,
} from '../src/window-state.mjs';

const area = { width: 1440, height: 860 };
const app = { id: 'test', width: 690, height: 520, minWidth: 400, minHeight: 260 };

// true if the window sits fully inside the area
const inside = (w, space) => w.x >= 0 && w.y >= 0 && w.x + w.width <= space.width && w.y + w.height <= space.height;

test('cascades remain inside the work area, including a small landscape viewport', () => {
  for (const viewport of [area, { width: 740, height: 290 }]) {
    for (let i = 0; i < 15; i++) {
      assert.ok(inside(createWindow(app, i, viewport), viewport));
    }
  }
});

test('dragging far offscreen and viewport shrink always retain reachable title bars', () => {
  const small = { width: 800, height: 500 };
  for (const [x, y] of [[-999, -999], [9999, 9999]]) {
    assert.ok(inside(clampBounds({ ...app, x, y }, small), small));
  }
});

test('all eight resize handles respect minimum size and screen boundaries', () => {
  const start = { ...app, x: 100, y: 100 };
  for (const edge of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
    for (const d of [-10000, 10000]) {
      const w = resizeBounds(start, edge, d, d, area);
      assert.ok(w.width >= 400 && w.height >= 260);
      assert.ok(inside(w, area));
    }
  }
});

test('windows opened beside another one sit to its right and stay on screen', () => {
  const anchor = createWindow({ ...app, width: 900, height: 740 }, 0, area);
  for (let i = 1; i < 8; i++) {
    const w = placeBeside(app, anchor, i, area);
    assert.ok(w.x >= anchor.x + 80, 'starts well to the right of the anchor');
    assert.ok(inside(w, area));
  }

  // on a tiny screen it still has to fit, even if that means overlapping more
  const small = { width: 800, height: 500 };
  assert.ok(inside(placeBeside(app, createWindow(app, 0, small), 1, small), small));
});

test('restored windows come back where they were, clamped to the current screen', () => {
  const saved = { x: 200, y: 120, width: 700, height: 500, maximized: false };
  const w = restoreWindow(app, saved, 0, area);
  assert.deepEqual(bounds(w), { x: 200, y: 120, width: 700, height: 500 });

  // saved on a big monitor, reopened on a small laptop
  const small = { width: 800, height: 500 };
  assert.ok(inside(restoreWindow(app, { ...saved, x: 1200, y: 700 }, 0, small), small));

  // fixed size windows only get their position back
  const fixed = restoreWindow({ ...app, fixedSize: true }, saved, 0, area);
  assert.equal(fixed.width, app.width);
  assert.equal(fixed.x, 200);

  // maximized comes back maximized, and restoring goes to the saved bounds
  const max = restoreWindow(app, { ...saved, maximized: true }, 0, area);
  assert.equal(max.maximized, true);
  assert.deepEqual(max.restoreBounds, bounds(w));

  assert.equal(isSavedBounds(saved), true);
  assert.equal(isSavedBounds({ x: 'nope', y: 1, width: 1, height: 1 }), false);
  assert.equal(isSavedBounds(null), false);
});

test('maximize and restore preserve bounds and re-clamp after screen resize', () => {
  const w = createWindow(app, 0, area);
  const original = bounds(w);

  toggleMaximize(w, area);
  assert.equal(w.maximized, true);
  assert.deepEqual(w.restoreBounds, original);

  toggleMaximize(w, area);
  assert.equal(w.maximized, false);
  assert.deepEqual(bounds(w), original);

  // maximize, then restore onto a smaller screen
  toggleMaximize(w, area);
  toggleMaximize(w, { width: 800, height: 600 });
  assert.ok(w.x + w.width <= 800 && w.y + w.height <= 600);
});

test('next focus skips minimized windows and chooses the most recent visible window', () => {
  const windows = [
    { id: 'about', z: 3 },
    { id: 'projects', z: 5, minimized: true },
    { id: 'contact', z: 4 },
  ];
  assert.equal(nextVisible(windows), 'contact');
  assert.equal(nextVisible(windows.map(w => ({ ...w, minimized: true }))), null);
});

test('projects and contact pop out left to right, about opens centered up top', () => {
  for (const viewport of [area, { width: 1024, height: 600 }]) {
    const [projects, contact] = columnApps.map(id => presetBounds(id, viewport));
    assert.ok(projects.x < contact.x);
    assert.ok(projects.height < viewport.height * 0.6);
    // contact stands tall for its arcade cabinet
    assert.ok(contact.height < viewport.height * 0.9);
    const about = presetBounds('about', viewport);
    for (const w of [projects, contact, about]) assert.ok(inside(w, viewport));
    assert.ok(Math.abs(about.x * 2 + about.width - viewport.width) <= 1);
    assert.ok(about.width < viewport.width * 0.7 && about.height < viewport.height * 0.7);
    assert.equal(presetBounds('stickies', viewport), null);
  }
});
