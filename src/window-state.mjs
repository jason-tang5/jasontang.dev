// window geometry, adapted from don chia's vue os template state model
// (see licenses/vuejs-os-template-MIT.txt). it's plain js with no vue in it so
// the tests can run in node without a browser.

export const bounds = w => ({ x: w.x, y: w.y, width: w.width, height: w.height });

// keeps a window inside the work area and at least its minimum size
export function clampBounds(w, area) {
  const width = Math.min(Math.max(w.minWidth || 1, w.width), area.width);
  const height = Math.min(Math.max(w.minHeight || 1, w.height), area.height);
  return {
    width,
    height,
    x: Math.max(0, Math.min(w.x, area.width - width)),
    y: Math.max(0, Math.min(w.y, area.height - height)),
  };
}

// edge is some combo of n/s/e/w depending on which handle is being dragged.
// dragging the left or top edge moves x/y and keeps the opposite edge pinned.
export function resizeBounds(start, edge, dx, dy, area) {
  let { x, y, width, height } = start;
  const minW = Math.min(start.minWidth, area.width);
  const minH = Math.min(start.minHeight, area.height);

  if (edge.includes('e')) {
    width = Math.min(area.width - x, Math.max(minW, width + dx));
  }
  if (edge.includes('s')) {
    height = Math.min(area.height - y, Math.max(minH, height + dy));
  }
  if (edge.includes('w')) {
    const right = x + width;
    x = Math.max(0, Math.min(x + dx, right - minW));
    width = right - x;
  }
  if (edge.includes('n')) {
    const bottom = y + height;
    y = Math.max(0, Math.min(y + dy, bottom - minH));
    height = bottom - y;
  }

  return { x, y, width, height };
}

// new windows cascade down and to the right, wrapping every 6 so they don't walk off screen
export function createWindow(app, index, area) {
  const offset = (index % 6) * 28;
  const position = clampBounds({
    ...app,
    x: Math.round(area.width * 0.23) + offset,
    y: Math.round(area.height * 0.13) + offset,
  }, area);

  return {
    ...app,
    ...position,
    minimized: false,
    maximized: false,
    restoreBounds: null,
    z: index + 1,
  };
}

// opens a window off to the right of one that's already on screen, so it doesn't
// land right on top of it. it hugs the right edge of the desktop, but always starts
// at least 80px right of the anchor so the anchor's left side stays visible.
// more windows opened this way stagger down and to the left.
export function placeBeside(app, anchor, index, area) {
  const stagger = (index % 4) * 28;
  const position = clampBounds({
    ...app,
    x: Math.max(anchor.x + 80, area.width - app.width - 24 - stagger),
    y: anchor.y + 40 + stagger,
  }, area);

  return { ...createWindow(app, index, area), ...position };
}

// reopens a window where it was last time (saved in localstorage), clamped so it
// still fits if the screen got smaller since. windows that size themselves to
// their content (fixedSize) only get their position back.
export function restoreWindow(app, saved, index, area) {
  const size = app.fixedSize ? {} : { width: saved.width, height: saved.height };
  const win = createWindow({ ...app, ...size }, index, area);
  Object.assign(win, clampBounds({ ...win, x: saved.x, y: saved.y }, area));

  if (saved.maximized && !app.fixedSize) {
    win.maximized = true;
    win.restoreBounds = bounds(win);
  }
  return win;
}

// checks saved window data before trusting it, since localstorage can hold anything
export function isSavedBounds(saved) {
  return Boolean(saved) && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(saved[key]));
}

export function toggleMaximize(w, area) {
  if (w.maximized) {
    // the screen might have shrunk while maximized, so re-clamp on the way back
    Object.assign(w, clampBounds({ ...w, ...w.restoreBounds }, area));
    w.maximized = false;
  } else {
    w.restoreBounds = bounds(w);
    w.maximized = true;
  }
}

// on a phone every window is full width and runs down to the bottom of the screen,
// but its top can be dragged up and down by the title bar (phoneTop). folders
// (sheet) start partway up, tall enough for their icons, so what's behind still shows.
// the title bar always stays on screen
export const phoneTitle = 60;
export function phoneTop(w, area) {
  const top = w.phoneTop ?? (w.sheet ? Math.max(area.height * 0.2, area.height - w.height - 40) : 0);
  return Math.round(Math.max(0, Math.min(top, area.height - phoneTitle)));
}

// the topmost window that isn't minimized, or null if there isn't one
export function nextVisible(windows) {
  const open = windows.filter(w => !w.minimized).sort((a, b) => b.z - a.z);
  return open[0]?.id || null;
}

// set spots for a fresh visit: about opens centered across the top of the screen, and
// projects and contact each pop out left to right when they're first
// opened, overlapping a little in the lower half so about stays visible behind them.
// numbers are x, y, width, height as fractions of the work area.
export const columnApps = ['projects', 'contact'];
const columnSpots = {
  projects: [0.02, 0.36, 0.47, 0.58],
  // contact is tall so its arcade cabinet has room
  contact: [0.73, 0.14, 0.26, 0.82],
};

export function presetBounds(id, area) {
  const spot = columnSpots[id];
  if (spot) {
    const [x, y, width, height] = spot;
    return {
      x: Math.round(area.width * x),
      y: Math.round(area.height * y),
      width: Math.round(area.width * width),
      height: Math.round(area.height * height),
    };
  }
  if (id === 'about') {
    const width = Math.round(area.width * 0.6);
    const height = Math.round(area.height * 0.66);
    return { x: Math.round((area.width - width) / 2), y: Math.round(area.height * 0.1), width, height };
  }
  return null;
}
