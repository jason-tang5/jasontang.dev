<script setup>
// turns a photo into colored ascii letters that you can smash away with the hammer
// to reveal the real photo underneath (the <img> sits behind this canvas). without the
// hammer picked up, a click or tap does nothing.
//
// how the drawing works:
//   - backing: the letters that are still standing, drawn once per layout
//   - glyphs: every letter with no background, used to make falling sprites
//   - glow: a brightened copy, stamped over cells near the cursor for the trail
// every frame just copies backing, then adds the glow and flying letters on top.
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { play } from '../sound.js';
import { hammerArmed as armed, hammerSize } from '../ascii-density.js';

const props = defineProps({
  source: String,
  description: String,
  columns: Number,
  cellSize: Number,
  visible: Boolean,
  reducedMotion: Boolean,
  resetVersion: Number,
  controlsTo: { type: Object, default: null },
  // false hides the hammer and its slider (AsciiImage's tidy mode)
  showTools: { type: Boolean, default: true },
});
const emit = defineEmits(['error', 'tap']);

// dark to bright
const characters = ' .,:;i1tfLCG08@';

const canvas = ref(null);
const remaining = ref(0);
// the hammer button arms it: then a press smashes letters, over and over while it's
// held. without it a click or tap does nothing, and on a touchscreen a drag over the
// letters scrolls the page like anywhere else (armed, shared in ascii-density.js)
// the pixel sledgehammer on the hammer button, [colour, path] on a 20x20 grid, head up
// top left and handle down to the bottom right, with a thick outline. picked up, the
// same picture is the cursor over the letters
const hammerSprite = [
  ['#1b1b1b', 'M8 1h3v1H8zM7 2h2v1H7zM10 2h2v1H10zM6 3h2v1H6zM11 3h2v1H11zM5 4h2v1H5zM12 4h2v1H12zM4 5h2v1H4zM13 5h1v1H13zM3 6h2v1H3zM12 6h2v1H12zM2 7h2v1H2zM11 7h2v1H11zM1 8h2v1H1zM10 8h2v1H10zM1 9h1v1H1zM11 9h2v1H11zM1 10h2v1H1zM8 10h1v1H8zM12 10h2v1H12zM2 11h2v1H2zM7 11h3v1H7zM13 11h2v1H13zM3 12h2v1H3zM6 12h2v1H6zM9 12h2v1H9zM14 12h2v1H14zM4 13h3v1H4zM10 13h2v1H10zM15 13h2v1H15zM11 14h2v1H11zM16 14h2v1H16zM12 15h2v1H12zM17 15h2v1H17zM13 16h2v1H13zM18 16h1v1H18zM14 17h2v1H14zM17 17h2v1H17zM15 18h3v1H15z'],
  ['#636b75', 'M11 5h2v1H11zM10 6h2v1H10zM9 7h2v1H9zM8 8h2v1H8zM2 9h1v1H2zM7 9h2v1H7zM3 10h1v1H3zM6 10h2v1H6zM4 11h3v1H4zM5 12h1v1H5z'],
  ['#a3abb4', 'M9 3h1v1H9zM8 4h3v1H8zM7 5h4v1H7zM6 6h2v1H6zM9 6h1v1H9zM5 7h2v1H5zM8 7h1v1H8zM4 8h2v1H4zM7 8h1v1H7zM3 9h4v1H3zM4 10h2v1H4z'],
  ['#dfe3e8', 'M9 2h1v1H9zM8 3h1v1H8zM10 3h1v1H10zM7 4h1v1H7zM11 4h1v1H11zM6 5h1v1H6zM5 6h1v1H5zM4 7h1v1H4zM3 8h1v1H3z'],
  ['#f4f6f8', 'M8 6h1v1H8zM7 7h1v1H7zM6 8h1v1H6z'],
  ['#8f5419', 'M9 9h2v1H9zM9 10h1v1H9z'],
  ['#d98a2c', 'M10 10h1v1H10zM10 11h2v1H10zM11 12h2v1H11zM12 13h2v1H12zM13 14h2v1H13zM14 15h2v1H14zM15 16h2v1H15zM16 17h1v1H16z'],
  ['#f2b562', 'M11 10h1v1H11zM12 11h1v1H12zM13 12h1v1H13zM14 13h1v1H14zM15 14h1v1H15zM16 15h1v1H16zM17 16h1v1H17z'],
];
// picked up, a copy of the hammer follows the mouse over the letters in place of the
// cursor (a css cursor can't move). pressing swings it down, and it keeps swinging
// while the button is held. each swing finishes before it stops
const cursorAt = ref(null);
const swinging = ref(false);
let held = false;
function trackCursor(event) {
  cursorAt.value = armed.value && event.pointerType === 'mouse' ? { x: event.clientX, y: event.clientY } : null;
}
// every press starts a fresh swing from the top, however fast the clicks come, and
// each one lands its own hit
const hammerCursorEl = ref(null);
function swingStart(event) {
  if (!swingsWithSound() || event.pointerType !== 'mouse' || event.button !== 0) return;
  held = true;
  hammerCursorEl.value?.getAnimations().forEach(a => { a.currentTime = 0; });
  swinging.value = true;
  strikeSoon();
}
function swingEnd() {
  held = false;
}
// the hammer cursor swings with a mouse once it's picked up, unless motion is reduced
const swingsWithSound = () => armed.value && Boolean(cursorAt.value) && !props.reducedMotion;
// one swing of the hammer, the same as hammer-strike's .36s in theme.css. its head comes
// down 15% of the way through. that's when it hits: letters under it break and it
// makes the sound, even if there's nothing left there to break
const attack = 360;
const strikeTimers = new Set();
function strikeSoon() {
  const timer = setTimeout(() => {
    strikeTimers.delete(timer);
    strike();
  }, attack * 0.15);
  strikeTimers.add(timer);
}
function strike() {
  if (!cursorAt.value || !canvas.value) return;
  const p = point({ clientX: cursorAt.value.x, clientY: cursorAt.value.y });
  knock(p.x, p.y);
}
function swingLoop() {
  if (!held) swinging.value = false;
  else strikeSoon();
}
const hammerSlider = ref(null);
let hammerDragging = false;

// the hammer slider runs 1 (bottom) to 7 (top) in quarter steps, dragged or with the keys
function setHammer(value) {
  hammerSize.value = Math.max(1, Math.min(7, Math.round(value * 4) / 4));
}

// upright on big screens, flat under the photo on phones
function hammerAt(event) {
  const rect = hammerSlider.value.getBoundingClientRect();
  const along = rect.width > rect.height
    ? (event.clientX - rect.left - 5.5) / (rect.width - 11)
    : (rect.bottom - event.clientY - 5.5) / (rect.height - 11);
  setHammer(1 + along * 6);
}

function hammerDown(event) {
  if (event.button !== 0) return;
  hammerDragging = true;
  hammerSlider.value.setPointerCapture(event.pointerId);
  hammerSlider.value.focus();
  hammerAt(event);
}

function hammerKeys(event) {
  const steps = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5, PageUp: 1.5, PageDown: -1.5 };
  if (event.key === 'Home') setHammer(1);
  else if (event.key === 'End') setHammer(7);
  else if (event.key in steps) setHammer(hammerSize.value + steps[event.key]);
  else return;
  event.preventDefault();
}

let picture;
let observer;
let cells = [];
let particles = [];
let frame = 0;
let lastTime = 0;
let width = 0;
let height = 0;
let cellWidth = 0;
let cellHeight = 0;
let cols = 0;
let rows = 0;
let disposed = false;
let backing;
let glyphs;
let glow;
let drag = null;
const trail = [];

// Keep only cleared cell IDs and the grid they belong to. Density changes
// sample the old grid at each new cell's center, snapping holes to whole cells.
const cleared = new Map();

function revealState() {
  if (!cleared.has(props.source)) cleared.set(props.source, { cols, rows, gone: new Set() });
  return cleared.get(props.source);
}

function removed() {
  return revealState().gone;
}

function remapClearedCells() {
  const state = revealState();
  if (state.cols === cols && state.rows === rows) return;
  const gone = new Set();
  if (state.gone.size && state.cols && state.rows) {
    for (let row = 0; row < rows; row++) {
      const oldRow = Math.min(state.rows - 1, Math.floor((row + 0.5) * state.rows / rows));
      for (let col = 0; col < cols; col++) {
        const oldCol = Math.min(state.cols - 1, Math.floor((col + 0.5) * state.cols / cols));
        if (state.gone.has(oldRow * state.cols + oldCol)) gone.add(row * cols + col);
      }
    }
  }
  Object.assign(state, { cols, rows, gone });
}

function hitRadius() {
  return Math.max(40, Math.min(width, height) * 0.24) * hammerSize.value / 5 * 1.05;
}

function draw() {
  if (!canvas.value) return;
  const ctx = canvas.value.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  // still loading, so cover the real photo underneath with the ascii background
  // instead of letting it flash through before the letters are ready
  if (!backing) {
    ctx.fillStyle = '#15151e';
    ctx.fillRect(0, 0, canvas.value.width, canvas.value.height);
    return;
  }

  ctx.drawImage(backing, 0, 0, width, height);

  // mouse trail. meant to look like the wallpaper's effect: 14 bright spots
  // that shrink over a second with a steep falloff
  const now = performance.now();
  const gone = removed();
  while (trail.length && now - trail[0].time >= 1000) trail.shift();

  // with tiny letters (high detail) there are thousands under the cursor, so instead of
  // lighting them one by one, show the bright copy through circles. glow has the same
  // holes knocked out as backing, so empty cells stay empty
  const cellsUnderCursor = (hitRadius() * 2 / cellWidth) * (hitRadius() * 2 / cellHeight);
  if (cellsUnderCursor > 2000) {
    ctx.save();
    ctx.beginPath();
    for (const point of trail) {
      const radius = hitRadius() * Math.max(0, 1 - (now - point.time) / 1000) ** 6;
      if (radius < 0.5) continue;
      ctx.moveTo(point.x + radius, point.y);
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    }
    ctx.clip();
    ctx.drawImage(glow, 0, 0, width, height);
    ctx.restore();
    drawParticles(ctx);
    return;
  }

  const lit = new Set();
  for (const point of trail) {
    const radius = hitRadius() * Math.max(0, 1 - (now - point.time) / 1000) ** 6;
    const firstRow = Math.max(0, Math.floor((point.y - radius) / cellHeight));
    const lastRow = Math.min(rows - 1, Math.floor((point.y + radius) / cellHeight));
    const firstCol = Math.max(0, Math.floor((point.x - radius) / cellWidth));
    const lastCol = Math.min(cols - 1, Math.floor((point.x + radius) / cellWidth));

    for (let row = firstRow; row <= lastRow; row++) {
      for (let col = firstCol; col <= lastCol; col++) {
        const cell = cells[row * cols + col];
        if (!gone.has(cell.id) && Math.hypot(cell.x - point.x, cell.y - point.y) < radius) lit.add(cell.id);
      }
    }
  }
  for (const id of lit) stamp(ctx, glow, cells[id], cells[id].x, cells[id].y);
  drawParticles(ctx);
}

function drawParticles(ctx) {
  for (const particle of particles) {
    const cosine = Math.cos(particle.angle);
    const sine = Math.sin(particle.angle);
    ctx.setTransform(cosine, sine, -sine, cosine, particle.x, particle.y);
    ctx.drawImage(particle.sprite, -particle.sprite.width / 2, -particle.sprite.height / 2);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// copies one cell from a source canvas, centered on x/y
function stamp(ctx, source, cell, x, y) {
  const sx = (cell.id % cols) * cellWidth;
  const sy = Math.floor(cell.id / cols) * cellHeight;
  ctx.drawImage(source, sx, sy, cellWidth, cellHeight, x - cellWidth / 2, y - cellHeight / 2, cellWidth, cellHeight);
}

function schedule() {
  if (frame || (!particles.length && !trail.length)) return;
  lastTime = performance.now();
  frame = requestAnimationFrame(animate);
}

function stop() {
  endDrag();
  cancelAnimationFrame(frame);
  frame = 0;
  particles = [];
  trail.length = 0;
  draw();
}

function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.035);
  lastTime = now;

  for (const particle of particles) {
    particle.vy += 650 * dt; // gravity
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.angle += particle.spin * dt;
  }
  particles = particles.filter(p => p.y < height + p.margin && p.x > -p.margin && p.x < width + p.margin);

  draw();
  frame = particles.length || trail.length ? requestAnimationFrame(animate) : 0;
}

// each hit makes at most this many flying sprites, with this many in the air at once.
// at max detail one big hit can break thousands of letters, and a new canvas per
// letter (or per 4x3 block) froze the page for half a second at a time
const spritesPerHit = 60;
const maxSprites = 300;

function fallingLetters(broken, x, y) {
  const budget = Math.min(spritesPerHit, maxSprites - particles.length);
  if (props.reducedMotion || !broken.length || budget <= 0) return;

  // group neighbouring letters into roughly square chunks, never smaller than about
  // 8px so tiny letters still fly as something visible, and big enough that this hit fits the budget
  const rowsFor = groupCols => Math.max(1, Math.round(groupCols * cellWidth / cellHeight));
  let groupCols = Math.max(1, Math.ceil(8 / cellWidth));
  while (broken.length / (groupCols * rowsFor(groupCols)) > budget) groupCols++;
  const groupRows = rowsFor(groupCols);

  const groups = new Map();
  for (const cell of broken) {
    const col = Math.floor((cell.id % cols) / groupCols) * groupCols;
    const row = Math.floor(Math.floor(cell.id / cols) / groupRows) * groupRows;
    const key = row * cols + col;
    if (!groups.has(key)) groups.set(key, { col, row, cells: [] });
    groups.get(key).cells.push(cell);
  }

  // chunks at the edge of the hit are partly empty, so the count can run a little over
  for (const group of [...groups.values()].slice(0, budget)) {
    const left = group.col * cellWidth;
    const top = group.row * cellHeight;
    const sprite = document.createElement('canvas');
    sprite.width = Math.ceil(Math.min(groupCols, cols - group.col) * cellWidth);
    sprite.height = Math.ceil(Math.min(groupRows, rows - group.row) * cellHeight);

    const pen = sprite.getContext('2d');
    for (const cell of group.cells) stamp(pen, glyphs, cell, cell.x - left, cell.y - top);

    const centerX = left + sprite.width / 2;
    const centerY = top + sprite.height / 2;
    particles.push({
      sprite,
      x: centerX,
      y: centerY,
      margin: Math.hypot(sprite.width, sprite.height),
      // fly away from where you hit
      vx: (centerX - x) * 3 + (Math.random() - 0.5) * 60,
      vy: -80 - Math.random() * 130,
      angle: 0,
      spin: (Math.random() - 0.5) * 7,
    });
  }
}

// knocks out the letters around x/y
// every hit makes the sound, even where the letters are already gone
function knock(x, y, repaint = true) {
  if (!props.visible || document.hidden || !cells.length) return;

  const radius = hitRadius();
  const gone = removed();
  const coreRadius = Math.max(Math.hypot(cellWidth, cellHeight), radius * 0.82);
  const phase = Math.random() * Math.PI * 2;
  const ctx = backing.getContext('2d');
  const bright = glow.getContext('2d');
  const broken = [];

  const reach = Math.max(coreRadius, radius * 1.165);
  const firstCol = Math.max(0, Math.floor((x - reach) / cellWidth));
  const lastCol = Math.min(cols - 1, Math.floor((x + reach) / cellWidth));
  const firstRow = Math.max(0, Math.floor((y - reach) / cellHeight));
  const lastRow = Math.min(rows - 1, Math.floor((y + reach) / cellHeight));

  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const cell = cells[row * cols + col];
      if (gone.has(cell.id)) continue;

      // solid in the middle, with a wobbly random edge so it doesn't look like a perfect circle.
      // only letters outside the solid core need the (slower) wobble maths
      const distance = Math.hypot(cell.x - x, cell.y - y);
      if (distance > coreRadius) {
        const angle = Math.atan2(cell.y - y, cell.x - x);
        const edge = radius * (1 + 0.11 * Math.sin(angle * 3 + phase) + 0.055 * Math.cos(angle * 7 - phase));
        if (Math.random() >= (edge - distance) / (edge - coreRadius)) continue;
      }

      gone.add(cell.id);
      ctx.clearRect(cell.x - cellWidth / 2, cell.y - cellHeight / 2, cellWidth, cellHeight);
      bright.clearRect(cell.x - cellWidth / 2, cell.y - cellHeight / 2, cellWidth, cellHeight);
      broken.push(cell);
    }
  }

  fallingLetters(broken, x, y);
  play('crumble', Math.max(1, broken.length));
  remaining.value -= broken.length;
  // wipe the dark background too once every letter is gone
  if (!remaining.value) {
    ctx.clearRect(0, 0, width, height);
    bright.clearRect(0, 0, width, height);
  }

  if (repaint) {
    draw();
    schedule();
  }
}

// pointer position in canvas pixels, clamped to the canvas
function point(event) {
  const rect = canvas.value.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(width, (event.clientX - rect.left) * width / rect.width)),
    y: Math.max(0, Math.min(height, (event.clientY - rect.top) * height / rect.height)),
  };
}

function move(event) {
  if (!props.visible || document.hidden || !cells.length) return;
  if (drag && event.pointerId !== drag.id) return;

  const { x, y } = point(event);
  // a held press doesn't break letters as it moves, it just moves where the next hit lands
  if (drag) {
    if (!(event.buttons & 1)) endDrag();
    else Object.assign(drag, { x, y });
  }

  if (props.reducedMotion) return;
  trail.push({ x, y, time: performance.now() });
  if (trail.length > 14) trail.shift();
  schedule();
}

// mouse and touch are handled on pointerdown. this is just so screen readers
// and other assistive "clicks" still do something
function click(event) {
  if (event.detail === 0 && !event.pointerType) keyboard();
  // without the hammer a click is just a tap on the photo
  else if (!armed.value) emit('tap');
}

function startDrag(event) {
  // only the hammer breaks letters. without it a press does nothing here, and a
  // finger's drag or swipe carries on to the page
  if (!armed.value) return;
  // the press is the letters', not the window's or a swipe's
  event.stopPropagation();
  if (event.button !== 0 || !event.isPrimary || drag || !props.visible || !cells.length) return;
  event.preventDefault();
  canvas.value.focus({ preventScroll: true });
  canvas.value.setPointerCapture(event.pointerId);

  // holding the press down hits over and over at the hammer's attack speed. the
  // swinging hammer cursor hits when its head comes down (strike). anything else
  // hits straight away, then again every swing's length while it's held
  const p = point(event);
  drag = { id: event.pointerId, ...p };
  if (swingsWithSound()) return;
  knock(p.x, p.y);
  drag.repeat = setInterval(() => drag && knock(drag.x, drag.y), attack);
}

function pointerUp(event) {
  if (drag?.id !== event.pointerId) return;
  endDrag();
}

function endDrag() {
  clearInterval(drag?.repeat);
  const id = drag?.id;
  drag = null;
  if (id !== undefined && canvas.value?.hasPointerCapture(id)) canvas.value.releasePointerCapture(id);
}

// enter or space knocks out the first letter still standing
function keyboard() {
  const cell = cells.find(c => !removed().has(c.id));
  if (cell) knock(cell.x, cell.y);
}

const surface = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
};

// a drag on the detail slider can change the size many times a frame, so rebuilding
// waits for the next frame and only happens once, with the latest size
let layoutFrame = 0;
function layoutSoon() {
  if (layoutFrame) return;
  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = 0;
    layout();
  });
}

// rebuilds the letter grid, runs on load and whenever the canvas resizes
function layout() {
  if (!canvas.value || !picture?.complete || !picture.naturalWidth) return;
  stop();

  width = canvas.value.clientWidth;
  height = canvas.value.clientHeight;
  if (!width || !height) return;

  canvas.value.width = Math.round(width);
  canvas.value.height = Math.round(height);
  canvas.value.getContext('2d').setTransform(1, 0, 0, 1, 0, 0);

  // a fixed cell size keeps letters the same size on every photo no matter its shape.
  // the 1.65 is roughly how much taller a monospace letter is than it is wide
  cols = props.columns || (props.cellSize ? Math.max(20, Math.round(width / props.cellSize)) : 70);
  rows = Math.max(1, Math.round(cols * height / width / 1.65));
  cellWidth = width / cols;
  cellHeight = height / rows;

  // shrink the photo down to one pixel per cell to get each cell's color.
  // crop it the same way the <img> underneath does (centered, object-fit: cover)
  const sample = document.createElement('canvas');
  sample.width = cols;
  sample.height = rows;
  const ctx = sample.getContext('2d', { willReadFrequently: true });
  const scale = Math.max(width / picture.naturalWidth, height / picture.naturalHeight);
  const sw = width / scale;
  const sh = height / scale;
  ctx.drawImage(picture, (picture.naturalWidth - sw) / 2, (picture.naturalHeight - sh) / 2, sw, sh, 0, 0, cols, rows);
  const pixels = ctx.getImageData(0, 0, cols, rows).data;

  // each cell's letter (by brightness), its colour lifted a little, and a much brighter
  // copy of that colour for the glow. the colours stay one pixel per cell
  const colors = new ImageData(cols, rows);
  const brightColors = new ImageData(cols, rows);
  const letterOf = new Uint8Array(cols * rows);
  for (let id = 0; id < cols * rows; id++) {
    const o = id * 4;
    const brightness = (0.2126 * pixels[o] + 0.7152 * pixels[o + 1] + 0.0722 * pixels[o + 2]) / 255;
    // never the space character, every cell gets something visible
    letterOf[id] = Math.max(1, Math.round(brightness * (characters.length - 1)));
    for (let k = 0; k < 3; k++) {
      const lifted = Math.min(255, pixels[o + k] * 1.25 + 20);
      colors.data[o + k] = lifted;
      brightColors.data[o + k] = Math.min(255, lifted * 2.4);
    }
    colors.data[o + 3] = 255;
    brightColors.data[o + 3] = 255;
  }
  cells = Array.from({ length: cols * rows }, (_, id) => ({
    id,
    x: ((id % cols) + 0.5) * cellWidth,
    y: (Math.floor(id / cols) + 0.5) * cellHeight,
  }));
  remapClearedCells();
  remaining.value = cells.length - removed().size;

  // drawing thousands of letters one by one, each in its own colour, is what made the
  // detail slider lag. instead each character is drawn once, in white, into a strip,
  // every cell is stamped from that strip, and then the colours go over all the letters
  // in one go: the one-pixel-per-cell colours stretched to full size without smoothing
  const slotWidth = Math.ceil(cellHeight) + 2;
  const slotHeight = Math.ceil(cellHeight * 1.3) + 2;
  const strip = surface(slotWidth * characters.length, slotHeight);
  const pen = strip.getContext('2d');
  pen.font = `bold ${cellHeight}px "Courier New", monospace`;
  pen.textAlign = 'center';
  pen.textBaseline = 'middle';
  pen.fillStyle = '#fff';
  for (let i = 1; i < characters.length; i++) pen.fillText(characters[i], (i + 0.5) * slotWidth, slotHeight / 2);

  const mask = surface(width, height);
  const stamps = mask.getContext('2d');
  for (const cell of cells) {
    stamps.drawImage(strip, letterOf[cell.id] * slotWidth, 0, slotWidth, slotHeight, cell.x - slotWidth / 2, cell.y - slotHeight / 2, slotWidth, slotHeight);
  }

  // the mask's letters, painted in one set of colours
  const colored = paint => {
    const small = surface(cols, rows);
    small.getContext('2d').putImageData(paint, 0, 0);
    const out = surface(width, height);
    const ink = out.getContext('2d');
    ink.drawImage(mask, 0, 0);
    ink.globalCompositeOperation = 'source-in';
    ink.imageSmoothingEnabled = false;
    ink.drawImage(small, 0, 0, width, height);
    return out;
  };

  glyphs = colored(colors);
  backing = surface(width, height);
  glow = surface(width, height);

  const base = backing.getContext('2d');
  base.fillStyle = '#15151e';
  base.fillRect(0, 0, width, height);
  base.drawImage(glyphs, 0, 0);

  // the glow is the same picture 2.4 times brighter, background included
  const bright = glow.getContext('2d');
  bright.fillStyle = 'rgb(50, 50, 72)';
  bright.fillRect(0, 0, width, height);
  bright.drawImage(colored(brightColors), 0, 0);

  // Bake the snapped holes into the cached background once, not every frame.
  for (const id of removed()) {
    const cell = cells[id];
    base.clearRect(cell.x - cellWidth / 2, cell.y - cellHeight / 2, cellWidth, cellHeight);
    bright.clearRect(cell.x - cellWidth / 2, cell.y - cellHeight / 2, cellWidth, cellHeight);
  }


  draw();
}

function load() {
  stop();
  // no letters to hit until the new photo is laid out
  cells = [];

  // ignore late loads if the photo changed again in the meantime
  const next = new Image();
  picture = next;
  next.onload = () => {
    if (!disposed && picture === next) layout();
  };
  next.onerror = () => {
    if (!disposed && picture === next) emit('error');
  };
  next.src = props.source;
  // a photo already in the cache is laid out right away, with no blank frame.
  // otherwise the last photo's letters stay up until this one is ready, and only
  // the very first photo starts on the plain dark background
  if (next.complete && next.naturalWidth) layout();
  else if (!backing) draw();
}

function visibility() {
  if (document.hidden) stop();
}

watch(() => props.source, load);
watch(() => [props.columns, props.cellSize], layoutSoon);

// the ascii button was pressed again, bring every letter back for this photo
watch(() => props.resetVersion, () => {
  cleared.delete(props.source);
  layout();
});

watch(() => [props.visible, props.reducedMotion], () => {
  if (!props.visible || props.reducedMotion) stop();
});

onMounted(() => {
  observer = new ResizeObserver(layoutSoon);
  observer.observe(canvas.value);
  document.addEventListener('visibilitychange', visibility);
  load();
});

onBeforeUnmount(() => {
  disposed = true;
  strikeTimers.forEach(clearTimeout);
  endDrag();
  cancelAnimationFrame(frame);
  cancelAnimationFrame(layoutFrame);
  observer?.disconnect();
  document.removeEventListener('visibilitychange', visibility);
});
</script>

<template>
  <canvas
    ref="canvas"
    class="ascii-knockoff"
    :class="{ armed, 'hammer-cursor-on': cursorAt }"
    role="button"
    :tabindex="visible ? 0 : -1"
    :aria-label="remaining
      ? `${description}. Pick up the hammer and click, or press Enter or Space, to knock letters away and reveal the photo.`
      : `${description}. Photo fully revealed.`"
    @pointerdown="swingStart($event); startDrag($event)"
    @pointermove="trackCursor($event); move($event)"
    @pointerenter="trackCursor"
    @pointerleave="cursorAt = null"
    @pointerup="swingEnd(); pointerUp($event)"
    @pointercancel="swingEnd(); endDrag()"
    @lostpointercapture="swingEnd(); endDrag()"
    @click.stop="click"
    @keydown.enter.stop.prevent="keyboard"
    @keydown.space.stop.prevent="keyboard"
  />

  <!-- the hammer cursor, 32px across. the hot spot, where the pointer really is, is the
       head's lower left end, the face that strikes -->
  <Teleport to="body">
    <svg
      v-if="armed && cursorAt && visible"
      ref="hammerCursorEl"
      class="hammer-cursor"
      :class="{ swinging }"
      :style="{ left: `${cursorAt.x - 4}px`, top: `${cursorAt.y - 17}px` }"
      width="32"
      height="32"
      viewBox="0 0 20 20"
      shape-rendering="crispEdges"
      aria-hidden="true"
      @animationiteration="swingLoop"
      @animationend="swinging = false"
    >
      <path v-for="[fill, d] in hammerSprite" :key="fill" :fill="fill" :d="d"/>
    </svg>
  </Teleport>

  <!-- hammer size slider, built like the ascii detail slider and stacked under the reset
       button. a big pixel circle marks the big end, a small one the small end. stops events
       so dragging it doesn't smash letters or move the window -->
  <Teleport :to="controlsTo || 'body'" :disabled="!controlsTo">
  <!-- touchscreens only: pressed in, a drag over the photo smashes letters instead of
       scrolling. a pixel sledgehammer on a slant, head up top left, left of its size slider -->
  <button
    v-if="showTools"
    v-show="visible"
    class="hammer-toggle raised"
    :class="{ pressed: armed }"
    :aria-pressed="armed"
    :title="armed ? 'Put the hammer down' : 'Pick up the hammer'"
    aria-label="Hammer"
    @click.stop="armed = !armed"
    @pointerdown.stop
    @pointermove.stop
    @keydown.stop
  >
    <svg width="20" height="20" viewBox="0 0 20 20" shape-rendering="crispEdges" aria-hidden="true">
      <path v-for="[fill, d] in hammerSprite" :key="fill" :fill="fill" :d="d"/>
    </svg>
  </button>
  <div v-if="showTools" v-show="visible" class="ascii-hammer raised" title="Hammer size" @click.stop @pointerdown.stop @pointermove.stop @keydown.stop>
    <svg width="11" height="11" viewBox="0 0 11 11" shape-rendering="crispEdges" aria-hidden="true">
      <path fill="currentColor" d="M3 0h5v1H3zM1 1h9v2H1zM0 3h11v5H0zM1 8h9v2H1zM3 10h5v1H3z"/>
    </svg>
    <div
      ref="hammerSlider"
      class="volume-slider density-slider"
      role="slider"
      :tabindex="visible ? 0 : -1"
      aria-label="Hammer size"
      aria-orientation="vertical"
      aria-valuemin="1"
      aria-valuemax="7"
      :aria-valuenow="hammerSize"
      :aria-valuetext="`Size ${hammerSize}`"
      :style="{ '--level': (hammerSize - 1) / 6 * 100 }"
      @pointerdown="hammerDown"
      @pointermove="hammerDragging && hammerAt($event)"
      @pointerup="hammerDragging = false"
      @pointercancel="hammerDragging = false"
      @lostpointercapture="hammerDragging = false"
      @keydown="hammerKeys"
    >
      <span class="volume-groove" />
      <span class="volume-thumb" />
    </div>
    <svg width="5" height="5" viewBox="0 0 5 5" shape-rendering="crispEdges" aria-hidden="true">
      <path fill="currentColor" d="M1 0h3v1H1zM0 1h5v3H0zM1 4h3v1H1z"/>
    </svg>
  </div>
  </Teleport>
</template>
