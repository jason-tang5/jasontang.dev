<script setup>
// the figures in the ui crash course post (blog.mjs), swapped in by blog-figures.mjs:
// the real ascii photo you can smash, how a pixel picks its letter, how thousands of
// letters get drawn quickly, the maths of one hammer hit, the real game backdrops,
// and how a figure like these gets into a post. the smash and backdrop figures run
// the site's own components, the rest use the same numbers as KnockoffAscii.vue
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AsciiImage from './AsciiImage.vue';
import BlogGraphic from './BlogGraphic.vue';
import { photos } from '../photos.mjs';
import { createBackdrop, breakoutScene, snakeScene, minesScene, reversiScene, tilesScene } from '../ascii-backdrop.js';
import { theme } from '../theme.js';
import { parse } from '../blog-markup.mjs';
import { withFigures } from '../blog-figures.mjs';
import '../post-figures.css';

const props = defineProps({
  figure: { type: String, required: true },
  caption: { type: String, default: '' },
  number: { type: Number, default: 0 },
});

// read out in place of the picture, for screen readers
const descriptions = {
  smash: 'A photo of Pocky the dog drawn as coloured ASCII letters. Pick up the hammer and click to knock letters away and show the photo underneath.',
  ramp: 'A small sunset picture shrunk to one pixel per letter, next to the same picture drawn in ASCII. Selecting a cell shows its colour, its brightness and the letter that brightness picks.',
  stamp: 'Four panels: every letter drawn once in white, the letters stamped into place, one colour per cell, and the colours poured into the letters. A button times this against drawing every letter on its own.',
  hit: 'A grid of letters with one hammer hit. A solid circle in the middle always breaks, a wobbly edge around it breaks some letters at random, and broken letters are grouped into chunks that fly off.',
  backdrop: 'The real animated ASCII backdrop from each game, with switches for whether a game is being played and whether the window is in front.',
  swap: 'A few lines of post text, the blocks the parser turns them into, and the blocks after an image line is swapped for an interactive figure.',
};

// only animate while the figure is on screen, and not at all with reduced motion
const root = ref(null);
const visible = ref(false);
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let observer;
onMounted(() => {
  if (typeof IntersectionObserver !== 'function') { visible.value = true; return; }
  observer = new IntersectionObserver(([entry]) => { visible.value = entry.isIntersecting; });
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());

// a canvas drawn at the screen's resolution, sized by its css box
function fit(canvas) {
  const ratio = Math.min(3, devicePixelRatio || 1);
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}
const resizers = [];
function onResize(el, callback) {
  if (!el || typeof ResizeObserver !== 'function') return;
  const watcher = new ResizeObserver(() => callback());
  watcher.observe(el);
  resizers.push(watcher);
}
onBeforeUnmount(() => resizers.forEach(r => r.disconnect()));

// ---- a stand-in photo: the wallpaper's vaporwave sunset, drawn in code ----
function paintScene(ctx, w, h) {
  const horizon = h * 0.62;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#140b36');
  sky.addColorStop(0.55, '#6d2a78');
  sky.addColorStop(1, '#ff8a4c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  const r = h * 0.3;
  const cx = w * 0.5;
  const cy = horizon - r * 0.35;
  const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  sun.addColorStop(0, '#fff07a');
  sun.addColorStop(1, '#ff3f8e');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = sun;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // the gaps across the bottom of the sun
  ctx.fillStyle = '#8a3272';
  for (let i = 0; i < 4; i++) ctx.fillRect(cx - r, cy + r * (0.15 + i * 0.2), r * 2, r * (0.04 + i * 0.03));
  ctx.restore();
  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, '#2a0f3a');
  ground.addColorStop(1, '#07030d');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.strokeStyle = '#ff4fd8';
  ctx.lineWidth = Math.max(1, h / 90);
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * w * 0.02, horizon);
    ctx.lineTo(cx + i * w * 0.16, h);
    ctx.stroke();
  }
  for (let i = 1; i < 7; i++) {
    const y = horizon + (h - horizon) * (i / 7) ** 1.8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}
let sceneCanvas;
function scene() {
  if (!sceneCanvas) {
    sceneCanvas = document.createElement('canvas');
    sceneCanvas.width = 640;
    sceneCanvas.height = 360;
    paintScene(sceneCanvas.getContext('2d'), 640, 360);
  }
  return sceneCanvas;
}

// the same letters and maths as KnockoffAscii.vue
const characters = ' .,:;i1tfLCG08@';
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const letterIndex = brightness => Math.max(1, Math.round(brightness * (characters.length - 1)));
const lift = v => Math.min(255, v * 1.25 + 20);
// a monospace letter is roughly 1.65 times taller than it is wide
function sampleScene(cols, aspect) {
  const rows = Math.max(1, Math.round(cols * aspect / 1.65));
  const small = document.createElement('canvas');
  small.width = cols;
  small.height = rows;
  const ctx = small.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(scene(), 0, 0, cols, rows);
  return { cols, rows, small, pixels: ctx.getImageData(0, 0, cols, rows).data };
}
function drawLetters(ctx, width, height, grid, skip) {
  const cw = width / grid.cols;
  const ch = height / grid.rows;
  ctx.fillStyle = '#15151e';
  ctx.fillRect(0, 0, width, height);
  ctx.font = `bold ${ch}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let id = 0; id < grid.cols * grid.rows; id++) {
    if (skip?.(id)) continue;
    const o = id * 4;
    const p = grid.pixels;
    ctx.fillStyle = `rgb(${lift(p[o])}, ${lift(p[o + 1])}, ${lift(p[o + 2])})`;
    ctx.fillText(characters[letterIndex(luma(p[o], p[o + 1], p[o + 2]))], ((id % grid.cols) + 0.5) * cw, (Math.floor(id / grid.cols) + 0.5) * ch);
  }
}

// ---- smash: the real thing, my pictures' ascii photo with its hammer ----
const pocky = photos.find(p => p.id === 1) ?? photos[0];
const asciiOn = ref(true);

// ---- ramp: one pixel per cell, then brightness picks the letter ----
const rampCols = ref(28);
const rampPixels = ref(null);
const rampLetters = ref(null);
const picked = ref(null);
let rampGrid = null;
function drawRamp() {
  if (!rampPixels.value || !rampLetters.value) return;
  // only sample again when the columns change, so pointing around stays cheap
  if (rampGrid?.cols !== rampCols.value) rampGrid = sampleScene(rampCols.value, 9 / 16);
  const left = fit(rampPixels.value);
  left.ctx.imageSmoothingEnabled = false;
  left.ctx.drawImage(rampGrid.small, 0, 0, left.width, left.height);
  const right = fit(rampLetters.value);
  drawLetters(right.ctx, right.width, right.height, rampGrid);
  // the picked cell gets a box on both sides, black and white so it shows on any colour
  if (picked.value === null || picked.value >= rampGrid.cols * rampGrid.rows) picked.value = sunCell();
  for (const side of [left, right]) {
    const cw = side.width / rampGrid.cols;
    const ch = side.height / rampGrid.rows;
    const x = (picked.value % rampGrid.cols) * cw;
    const y = Math.floor(picked.value / rampGrid.cols) * ch;
    side.ctx.lineWidth = 3;
    side.ctx.strokeStyle = '#000';
    side.ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
    side.ctx.lineWidth = 1.5;
    side.ctx.strokeStyle = '#fff';
    side.ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
  }
}
// start on the middle of the sun, where it's brightest
const sunCell = () => Math.floor(rampGrid.rows * 0.42) * rampGrid.cols + Math.floor(rampGrid.cols / 2);
const cellInfo = computed(() => {
  rampCols.value;
  if (picked.value === null || !rampGrid) return null;
  const o = picked.value * 4;
  const [r, g, b] = rampGrid.pixels.slice(o, o + 3);
  const brightness = luma(r, g, b);
  const rounded = Math.round(brightness * (characters.length - 1));
  const index = letterIndex(brightness);
  const ink = [r, g, b].map(v => Math.round(lift(v)));
  return { r, g, b, ink, brightness, rounded, index, letter: characters[index], col: picked.value % rampGrid.cols, row: Math.floor(picked.value / rampGrid.cols) };
});
// a short version for screen readers, read out as the picked cell moves
const cellSpoken = computed(() => cellInfo.value && `Column ${cellInfo.value.col}, row ${cellInfo.value.row}: brightness ${cellInfo.value.brightness.toFixed(2)}, letter ${cellInfo.value.letter}`);
function pickCell(event) {
  if (!rampGrid) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const col = Math.min(rampGrid.cols - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * rampGrid.cols)));
  const row = Math.min(rampGrid.rows - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * rampGrid.rows)));
  const id = row * rampGrid.cols + col;
  if (id === picked.value) return;
  picked.value = id;
  drawRamp();
}
// pointing with a mouse is enough. a finger taps instead, so a swipe still scrolls
const pointCell = event => { if (event.pointerType === 'mouse') pickCell(event); };
function rampKeys(event) {
  if (!rampGrid) return;
  let col = picked.value % rampGrid.cols;
  let row = Math.floor(picked.value / rampGrid.cols);
  if (event.key === 'ArrowRight') col++;
  else if (event.key === 'ArrowLeft') col--;
  else if (event.key === 'ArrowDown') row++;
  else if (event.key === 'ArrowUp') row--;
  else return;
  event.preventDefault();
  col = Math.min(rampGrid.cols - 1, Math.max(0, col));
  row = Math.min(rampGrid.rows - 1, Math.max(0, row));
  picked.value = row * rampGrid.cols + col;
  drawRamp();
}
watch(rampCols, () => { picked.value = null; drawRamp(); });

// ---- stamp: draw each letter once, stamp it everywhere, colour it all at once ----
const stampSteps = [
  { id: 'strip', title: 'Draw every letter once', text: 'Each of the 14 letters is drawn one time, in white, into a strip. These are the only fillText calls, however many cells there are.' },
  { id: 'mask', title: 'Stamp the letters into place', text: 'Every cell copies its letter out of the strip with drawImage. Copying pixels is cheaper than laying out text, and it doesn’t need a colour change between cells.' },
  { id: 'colors', title: 'One pixel per cell', text: 'The photo, shrunk so each cell is one pixel and brightened a little, is the colour map. Stretched back up with smoothing off, every cell is one flat colour.' },
  { id: 'result', title: 'Pour the colours in', text: 'With globalCompositeOperation set to source-in, the colours only land where the white letters are. One drawImage colours every letter.' },
];
const stampStep = ref(0);
const stampCanvases = ref([]);
// how many calls each step makes for this little picture, under each panel
const stampCounts = ref([]);
const timing = ref(null);
const timingBusy = ref(false);
const timingFailed = ref(false);
function drawStamp() {
  const [stripEl, maskEl, colorEl, resultEl] = stampCanvases.value;
  if (!resultEl) return;
  const grid = sampleScene(36, 9 / 16);
  const cells = grid.cols * grid.rows;
  stampCounts.value = ['14 × fillText', `${cells} × drawImage`, `${grid.cols} × ${grid.rows} pixels`, '1 × drawImage'];

  // 1: the strip, shown big with its slots marked
  const shown = fit(stripEl);
  const slot = (shown.width - 16) / (characters.length - 1);
  const band = Math.min(slot * 1.6, shown.height * 0.5);
  const top = (shown.height - band) / 2;
  shown.ctx.fillStyle = '#15151e';
  shown.ctx.fillRect(0, 0, shown.width, shown.height);
  shown.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  shown.ctx.lineWidth = 1;
  for (let i = 0; i < characters.length - 1; i++) shown.ctx.strokeRect(8 + i * slot + 0.5, top + 0.5, slot - 1, band - 1);
  shown.ctx.font = `bold ${Math.min(slot * 1.3, band * 0.75)}px "Courier New", monospace`;
  shown.ctx.textAlign = 'center';
  shown.ctx.textBaseline = 'middle';
  shown.ctx.fillStyle = '#fff';
  for (let i = 1; i < characters.length; i++) shown.ctx.fillText(characters[i], 8 + (i - 0.5) * slot, top + band / 2);

  // 2: every cell stamped from a real strip, the same way as KnockoffAscii
  const mask = fit(maskEl);
  const scale = maskEl.width / mask.width;
  const cw = mask.width / grid.cols * scale;
  const ch = mask.height / grid.rows * scale;
  const slotWidth = Math.ceil(ch) + 2;
  const slotHeight = Math.ceil(ch * 1.3) + 2;
  const strip = document.createElement('canvas');
  strip.width = slotWidth * characters.length;
  strip.height = slotHeight;
  const pen = strip.getContext('2d');
  pen.font = `bold ${ch}px "Courier New", monospace`;
  pen.textAlign = 'center';
  pen.textBaseline = 'middle';
  pen.fillStyle = '#fff';
  for (let i = 1; i < characters.length; i++) pen.fillText(characters[i], (i + 0.5) * slotWidth, slotHeight / 2);
  const letters = document.createElement('canvas');
  letters.width = maskEl.width;
  letters.height = maskEl.height;
  const stamps = letters.getContext('2d');
  for (let id = 0; id < cells; id++) {
    const o = id * 4;
    const letter = letterIndex(luma(grid.pixels[o], grid.pixels[o + 1], grid.pixels[o + 2]));
    stamps.drawImage(strip, letter * slotWidth, 0, slotWidth, slotHeight, ((id % grid.cols) + 0.5) * cw - slotWidth / 2, (Math.floor(id / grid.cols) + 0.5) * ch - slotHeight / 2, slotWidth, slotHeight);
  }
  mask.ctx.fillStyle = '#15151e';
  mask.ctx.fillRect(0, 0, mask.width, mask.height);
  mask.ctx.drawImage(letters, 0, 0, mask.width, mask.height);

  // 3: the colour map, one brightened pixel per cell
  const colors = fit(colorEl);
  const lifted = document.createElement('canvas');
  lifted.width = grid.cols;
  lifted.height = grid.rows;
  const paint = new ImageData(grid.cols, grid.rows);
  for (let i = 0; i < grid.pixels.length; i += 4) {
    paint.data[i] = lift(grid.pixels[i]);
    paint.data[i + 1] = lift(grid.pixels[i + 1]);
    paint.data[i + 2] = lift(grid.pixels[i + 2]);
    paint.data[i + 3] = 255;
  }
  lifted.getContext('2d').putImageData(paint, 0, 0);
  colors.ctx.imageSmoothingEnabled = false;
  colors.ctx.drawImage(lifted, 0, 0, colors.width, colors.height);

  // 4: the colours poured into the letters with source-in
  const result = fit(resultEl);
  const inked = document.createElement('canvas');
  inked.width = letters.width;
  inked.height = letters.height;
  const ink = inked.getContext('2d');
  ink.drawImage(letters, 0, 0);
  ink.globalCompositeOperation = 'source-in';
  ink.imageSmoothingEnabled = false;
  ink.drawImage(lifted, 0, 0, inked.width, inked.height);
  result.ctx.fillStyle = '#15151e';
  result.ctx.fillRect(0, 0, result.width, result.height);
  result.ctx.drawImage(inked, 0, 0, result.width, result.height);
}
// times both ways on an offscreen canvas with the photo from the top of the post at
// full detail (220 columns across 900 pixels). the median of a few runs, on this device
let pockyPicture;
function loadPocky() {
  pockyPicture ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = pocky.source;
  });
  return pockyPicture;
}
async function timeStamping() {
  if (timingBusy.value) return;
  timingBusy.value = true;
  timing.value = null;
  timingFailed.value = false;
  let img;
  try {
    img = await loadPocky();
  } catch {
    // forget the failed load so the next press tries again
    pockyPicture = null;
    timingBusy.value = false;
    timingFailed.value = true;
    return;
  }
  // let the button show it's busy before the page is held up
  setTimeout(() => {
    const width = 900;
    const height = Math.round(width * img.naturalHeight / img.naturalWidth);
    const cols = 220;
    const rows = Math.max(1, Math.round(cols * height / width / 1.65));
    const small = document.createElement('canvas');
    small.width = cols;
    small.height = rows;
    const sampler = small.getContext('2d', { willReadFrequently: true });
    sampler.drawImage(img, 0, 0, cols, rows);
    const grid = { cols, rows, small, pixels: sampler.getImageData(0, 0, cols, rows).data };
    const cw = width / grid.cols;
    const ch = height / grid.rows;
    const target = document.createElement('canvas');
    target.width = width;
    target.height = height;
    const ctx = target.getContext('2d');
    // reading one pixel back makes the browser finish drawing before the clock stops.
    // it's copied to a fresh 1x1 canvas each time so the big one stays a normal canvas
    const settle = () => {
      const probe = document.createElement('canvas');
      probe.width = probe.height = 1;
      const pen = probe.getContext('2d');
      pen.drawImage(target, 0, 0, 1, 1, 0, 0, 1, 1);
      pen.getImageData(0, 0, 1, 1);
    };
    const letterOf = new Uint8Array(grid.cols * grid.rows);
    for (let id = 0; id < letterOf.length; id++) letterOf[id] = letterIndex(luma(grid.pixels[id * 4], grid.pixels[id * 4 + 1], grid.pixels[id * 4 + 2]));

    const oneByOne = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.font = `bold ${ch}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let id = 0; id < letterOf.length; id++) {
        const o = id * 4;
        ctx.fillStyle = `rgb(${lift(grid.pixels[o])}, ${lift(grid.pixels[o + 1])}, ${lift(grid.pixels[o + 2])})`;
        ctx.fillText(characters[letterOf[id]], ((id % grid.cols) + 0.5) * cw, (Math.floor(id / grid.cols) + 0.5) * ch);
      }
      settle(); // wait for the drawing to really happen
    };
    const stamped = () => {
      const slotWidth = Math.ceil(ch) + 2;
      const slotHeight = Math.ceil(ch * 1.3) + 2;
      const strip = document.createElement('canvas');
      strip.width = slotWidth * characters.length;
      strip.height = slotHeight;
      const pen = strip.getContext('2d');
      pen.font = `bold ${ch}px "Courier New", monospace`;
      pen.textAlign = 'center';
      pen.textBaseline = 'middle';
      pen.fillStyle = '#fff';
      for (let i = 1; i < characters.length; i++) pen.fillText(characters[i], (i + 0.5) * slotWidth, slotHeight / 2);
      const mask = document.createElement('canvas');
      mask.width = width;
      mask.height = height;
      const stamps = mask.getContext('2d');
      for (let id = 0; id < letterOf.length; id++) {
        stamps.drawImage(strip, letterOf[id] * slotWidth, 0, slotWidth, slotHeight, ((id % grid.cols) + 0.5) * cw - slotWidth / 2, (Math.floor(id / grid.cols) + 0.5) * ch - slotHeight / 2, slotWidth, slotHeight);
      }
      const small = document.createElement('canvas');
      small.width = grid.cols;
      small.height = grid.rows;
      const paint = new ImageData(grid.cols, grid.rows);
      for (let i = 0; i < grid.pixels.length; i += 4) {
        paint.data[i] = lift(grid.pixels[i]);
        paint.data[i + 1] = lift(grid.pixels[i + 1]);
        paint.data[i + 2] = lift(grid.pixels[i + 2]);
        paint.data[i + 3] = 255;
      }
      small.getContext('2d').putImageData(paint, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      settle();
    };
    const median = run => {
      const times = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        run();
        times.push(performance.now() - start);
      }
      return times.sort((a, b) => a - b)[2];
    };
    try {
      oneByOne();
      stamped();
      timing.value = { cells: letterOf.length, oneByOne: median(oneByOne), stamped: median(stamped) };
    } finally {
      timingBusy.value = false;
    }
  }, 30);
}

// ---- hit: which letters one swing breaks ----
const hitSize = ref(4);
const hitLetter = ref(9);
const hitChunks = ref(true);
const hitCanvas = ref(null);
const hitResult = ref(null);
let hitAt = null;
let hitPhase = Math.random() * Math.PI * 2;
let hitRolls = [];
// the same numbers as KnockoffAscii: radius from the photo size and the hammer slider,
// a solid core at 82% of it, and an edge wobbling by 11% and 5.5%
const spritesPerHit = 60;
function drawHit() {
  if (!hitCanvas.value) return;
  const { ctx, width, height } = fit(hitCanvas.value);
  const cols = Math.max(8, Math.round(width / hitLetter.value));
  const grid = sampleScene(cols, height / width);
  const cellWidth = width / grid.cols;
  const cellHeight = height / grid.rows;
  const radius = Math.max(40, Math.min(width, height) * 0.24) * hitSize.value / 5 * 1.05;
  const core = Math.max(Math.hypot(cellWidth, cellHeight), radius * 0.82);
  const { x, y } = hitAt ?? { x: width / 2, y: height / 2 };
  const count = grid.cols * grid.rows;
  if (hitRolls.length !== count) hitRolls = Array.from({ length: count }, Math.random);

  const broken = [];
  const kind = new Map();
  for (let id = 0; id < count; id++) {
    const cx = ((id % grid.cols) + 0.5) * cellWidth;
    const cy = (Math.floor(id / grid.cols) + 0.5) * cellHeight;
    const distance = Math.hypot(cx - x, cy - y);
    if (distance <= core) {
      broken.push(id);
      kind.set(id, 'core');
      continue;
    }
    const angle = Math.atan2(cy - y, cx - x);
    const edge = radius * (1 + 0.11 * Math.sin(angle * 3 + hitPhase) + 0.055 * Math.cos(angle * 7 - hitPhase));
    if (hitRolls[id] < (edge - distance) / (edge - core)) {
      broken.push(id);
      kind.set(id, 'edge');
    }
  }

  // letters left standing, then the broken ones picked out
  drawLetters(ctx, width, height, grid, id => kind.has(id));
  ctx.font = `bold ${cellHeight}px "Courier New", monospace`;
  for (const id of broken) {
    ctx.fillStyle = kind.get(id) === 'core' ? 'rgba(255, 236, 138, 0.42)' : 'rgba(95, 208, 200, 0.55)';
    ctx.fillRect((id % grid.cols) * cellWidth, Math.floor(id / grid.cols) * cellHeight, cellWidth, cellHeight);
  }

  // the core and the wobbly edge
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#ffec8a';
  ctx.beginPath();
  ctx.arc(x, y, core, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#5fd0c8';
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const angle = i / 120 * Math.PI * 2;
    const edge = radius * (1 + 0.11 * Math.sin(angle * 3 + hitPhase) + 0.055 * Math.cos(angle * 7 - hitPhase));
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(angle) * edge, y + Math.sin(angle) * edge);
  }
  ctx.stroke();

  // the chunks, grouped the same way as fallingLetters. only the first 60 fly, in the
  // order the letters broke (top to bottom), the rest are dashed: they just vanish
  const rowsFor = groupCols => Math.max(1, Math.round(groupCols * cellWidth / cellHeight));
  let groupCols = Math.max(1, Math.ceil(8 / cellWidth));
  while (broken.length / (groupCols * rowsFor(groupCols)) > spritesPerHit) groupCols++;
  const groupRows = rowsFor(groupCols);
  const groups = new Set(broken.map(id => {
    const col = Math.floor((id % grid.cols) / groupCols) * groupCols;
    const row = Math.floor(Math.floor(id / grid.cols) / groupRows) * groupRows;
    return row * grid.cols + col;
  }));
  if (hitChunks.value) {
    ctx.lineWidth = 1;
    [...groups].forEach((key, i) => {
      ctx.strokeStyle = i < spritesPerHit ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 107, 97, 0.9)';
      ctx.setLineDash(i < spritesPerHit ? [] : [2, 2]);
      ctx.strokeRect((key % grid.cols) * cellWidth + 0.5, Math.floor(key / grid.cols) * cellHeight + 0.5, groupCols * cellWidth - 1, groupRows * cellHeight - 1);
    });
    ctx.setLineDash([]);
  }

  // where the hammer landed
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 5, y);
  ctx.lineTo(x + 5, y);
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y + 5);
  ctx.stroke();
  hitResult.value = {
    letters: count,
    core: broken.filter(id => kind.get(id) === 'core').length,
    edge: broken.filter(id => kind.get(id) === 'edge').length,
    chunks: Math.min(groups.size, spritesPerHit),
    over: Math.max(0, groups.size - spritesPerHit),
    group: `${groupCols} × ${groupRows}`,
    across: Math.round(groupCols * cellWidth),
    radius: Math.round(radius),
  };
}
function hitHere(event) {
  const rect = hitCanvas.value.getBoundingClientRect();
  hitAt = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  swingAgain(false);
}
// arrow keys move where the hammer lands, enter or space swings there again
function hitKeys(event) {
  const rect = hitCanvas.value.getBoundingClientRect();
  const step = event.shiftKey ? 40 : 12;
  const at = hitAt ?? { x: rect.width / 2, y: rect.height / 2 };
  const move = { ArrowRight: [step, 0], ArrowLeft: [-step, 0], ArrowDown: [0, step], ArrowUp: [0, -step] }[event.key];
  if (move) {
    hitAt = { x: Math.min(rect.width, Math.max(0, at.x + move[0])), y: Math.min(rect.height, Math.max(0, at.y + move[1])) };
  } else if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (!move) hitAt = at;
  swingAgain(false);
}
function swingAgain(center = true) {
  if (center) hitAt = null;
  hitPhase = Math.random() * Math.PI * 2;
  hitRolls = [];
  drawHit();
}
watch([hitSize, hitLetter, hitChunks], drawHit);

// ---- backdrop: the real scenes from ascii-backdrop.js ----
const scenes = {
  breakout: { label: 'Breakout', scene: breakoutScene, pace: 'Speed ×1 idle, ×2.6 playing', text: 'Bricks, sparks and little brick outlines drift up past the board, each at its own depth so the far ones are smaller, dimmer and slower.' },
  snake: { label: 'Snake', scene: snakeScene, pace: 'A step every 200 ms idle, 110 ms playing', text: 'Little snakes play their own game on a 12 px grid: mostly straight on, now and then a right angle, never straight back. They wrap round the edges and grow when they eat.' },
  mines: { label: 'Minesweeper', scene: minesScene, pace: 'A new patch every 400–867 ms idle, 167–333 ms playing', text: 'A minefield sweeps itself. A random safe cell opens and floods out a few cells a step, mines next to cleared ground get flagged, and past 60% cleared a mine goes off and it starts over.' },
  reversi: { label: 'Reversi', scene: reversiScene, pace: 'A capture every 560–1280 ms idle, 260–560 ms while Clippy thinks', text: 'The whole backdrop is a board of @ and O discs. A disc lands and flips a line of its neighbours in all eight directions, 90 ms apart, turning edge on through ( | ) so it reads as a wave.' },
  tiles: { label: '2048', scene: tilesScene, pace: 'A slide every 1.1–1.9 s idle, 0.52–0.82 s playing', text: 'A faint 2048 board plays itself with the game’s own slideLine, so every merge follows the real rules. When it’s too crowded to move, some blocks go so it never locks up.' },
};
const sceneId = ref('snake');
const playing = ref(false);
const front = ref(true);
const backdropCanvas = ref(null);
let backdrop = null;
function startBackdrop() {
  backdrop?.destroy();
  backdrop = null;
  if (!backdropCanvas.value) return;
  backdrop = createBackdrop(backdropCanvas.value, { running: () => playing.value, scene: scenes[sceneId.value].scene });
  backdrop.setActive(visible.value && front.value);
}
watch(sceneId, startBackdrop);
watch([visible, front], () => backdrop?.setActive(visible.value && front.value));
watch(theme, () => backdrop?.redraw());
onBeforeUnmount(() => backdrop?.destroy());

// ---- swap: post text → blocks → figures ----
const swapExamples = {
  image: {
    label: 'An interactive figure',
    source: '## Hitting the letters\n\nEvery swing knocks out a wobbly circle.\n\n![How a hit is worked out](/figures/ui/hit "Solid in the middle, wobbly at the edge")\n\nThe letters it breaks fly off in chunks.',
  },
  graphic: {
    label: 'A ```figure graphic',
    source: '## Three steps\n\n```figure\n{"template": "steps", "title": "Drawing the letters", "items": [\n  {"label": "Strip", "text": "Each letter drawn once, in white."},\n  {"label": "Stamp", "text": "Copied into every cell."},\n  {"label": "Colour", "text": "One pass with source-in."}\n]}\n```',
  },
};
const swapKind = ref('image');
const swapSource = ref(swapExamples.image.source);
const swapListed = ref(true);
watch(swapKind, kind => { swapSource.value = swapExamples[kind].source; });
const parsed = computed(() => parse(swapSource.value));
const swapped = computed(() => withFigures(swapListed.value ? 'a-crash-course-in-this-sites-ui' : 'a-post-that-isnt-listed', parsed.value));
function blockLabel(block) {
  if (block.type === 'heading') return `heading · ${block.text}`;
  if (block.type === 'paragraph') return `paragraph · ${block.text.slice(0, 38)}${block.text.length > 38 ? '…' : ''}`;
  if (block.type === 'image') return `image · ${block.src}`;
  if (block.type === 'figure') return `figure · ${block.figure}${block.number ? ` (Fig. ${block.number})` : ''}`;
  if (block.type === 'graphic') return `graphic · ${block.template}: ${block.title}`;
  if (block.type === 'code') return `code · ${block.language || 'text'}`;
  return block.type;
}
const swapGraphic = computed(() => swapped.value.find(b => b.type === 'graphic'));

onMounted(async () => {
  await nextTick();
  if (props.figure === 'ramp') {
    drawRamp();
    onResize(rampLetters.value, drawRamp);
  }
  if (props.figure === 'stamp') {
    drawStamp();
    onResize(stampCanvases.value[3], drawStamp);
  }
  if (props.figure === 'hit') {
    drawHit();
    onResize(hitCanvas.value, drawHit);
  }
  if (props.figure === 'backdrop') startBackdrop();
});
</script>

<template>
  <figure ref="root" class="pf-figure" :class="`uf-fig-${figure}`">
    <figcaption v-if="caption || number">
      <strong v-if="number">Fig. {{ number }}</strong> {{ caption }}
    </figcaption>
    <p class="sr-only">{{ descriptions[figure] }}</p>

    <!-- lead: the real ascii photo, hammer and all -->
    <div v-if="figure === 'smash'" class="uf-smash">
      <AsciiImage
        class="uf-photo"
        :source="pocky.source"
        :description="pocky.description"
        :enabled="asciiOn"
        :visible="visible"
        @update:enabled="asciiOn = $event"
      />
      <p class="pf-note">This is the same component as My Pictures. Pick up the hammer in the top left, then click or hold on Pocky. ↻ puts the letters back.</p>
    </div>

    <!-- ramp: pixels to letters -->
    <div v-else-if="figure === 'ramp'" class="pf-panel">
      <div class="pf-controls">
        <div class="pf-control">
          <label for="uf-ramp-cols">Columns <b>{{ rampCols }}</b></label>
          <input id="uf-ramp-cols" v-model.number="rampCols" class="pf-range" type="range" min="12" max="64" step="2">
        </div>
      </div>
      <div class="pf-pair">
        <div>
          <h4>One pixel per cell</h4>
          <canvas ref="rampPixels" class="pf-screen uf-ramp-canvas" tabindex="0" role="img" aria-label="The picture shrunk to one pixel per cell. Arrow keys move between cells." @click="pickCell" @pointermove="pointCell" @keydown="rampKeys" />
        </div>
        <div>
          <h4>One letter per cell</h4>
          <canvas ref="rampLetters" class="pf-screen uf-ramp-canvas" aria-hidden="true" @click="pickCell" @pointermove="pointCell" />
        </div>
      </div>
      <div class="uf-ramp" aria-hidden="true">
        <span class="uf-ramp-end">dark</span>
        <ol>
          <li v-for="(c, i) in characters" :key="i" :class="{ on: cellInfo?.index === i, off: i === 0 }" :title="i === 0 ? 'never used: every cell gets at least a dot' : `${i}`">{{ c === ' ' ? '␣' : c }}</li>
        </ol>
        <span class="uf-ramp-end">bright</span>
      </div>
      <p class="sr-only" aria-live="polite">{{ cellSpoken }}</p>
      <div v-if="cellInfo" class="pf-detail">
        <strong>Column {{ cellInfo.col }}, row {{ cellInfo.row }}</strong>
        <dl class="pf-dl">
          <dt>Pixel</dt><dd><i class="uf-swatch" :style="{ background: `rgb(${cellInfo.r}, ${cellInfo.g}, ${cellInfo.b})` }" /> rgb({{ cellInfo.r }}, {{ cellInfo.g }}, {{ cellInfo.b }})</dd>
          <dt>Brightness</dt><dd><code>(0.2126·{{ cellInfo.r }} + 0.7152·{{ cellInfo.g }} + 0.0722·{{ cellInfo.b }}) / 255</code> = {{ cellInfo.brightness.toFixed(3) }}</dd>
          <dt>Letter</dt><dd><code>round({{ cellInfo.brightness.toFixed(3) }} × 14)</code> = {{ cellInfo.rounded }}<template v-if="cellInfo.rounded < 1">, raised to 1 so it isn’t blank</template> → <b class="uf-letter" :style="{ color: `rgb(${cellInfo.ink.join(', ')})` }">{{ cellInfo.letter }}</b></dd>
          <dt>Drawn in</dt><dd><i class="uf-swatch" :style="{ background: `rgb(${cellInfo.ink.join(', ')})` }" /> <code>each × 1.25 + 20</code> = rgb({{ cellInfo.ink.join(', ') }}), so dark cells don’t vanish</dd>
        </dl>
      </div>
    </div>

    <!-- stamp: why it doesn't lag -->
    <div v-else-if="figure === 'stamp'" class="pf-panel">
      <div class="uf-stamps" role="group" aria-label="Steps">
        <button
          v-for="(s, i) in stampSteps"
          :key="s.id"
          class="uf-stamp"
          :class="{ on: stampStep === i }"
          :aria-pressed="stampStep === i"
          @click="stampStep = i"
        >
          <span class="uf-stamp-title"><b>{{ i + 1 }}</b> {{ s.title }}</span>
          <canvas :ref="el => { if (el) stampCanvases[i] = el; }" class="pf-screen" aria-hidden="true" />
          <small>{{ stampCounts[i] }}</small>
        </button>
      </div>
      <div class="pf-detail" aria-live="polite">
        <strong><b>{{ stampStep + 1 }}/4</b> {{ stampSteps[stampStep].title }}</strong>
        <p>{{ stampSteps[stampStep].text }}</p>
      </div>
      <div class="pf-buttons">
        <button class="raised pf-button" :disabled="timingBusy" @click="timeStamping">{{ timingBusy ? 'Timing…' : 'Time both on this device' }}</button>
        <span class="uf-timing" aria-live="polite">
          <template v-if="timing">
            {{ timing.cells.toLocaleString() }} letters: one by one <b>{{ timing.oneByOne.toFixed(1) }} ms</b>, stamped <b>{{ timing.stamped.toFixed(1) }} ms</b>
            <template v-if="timing.stamped > 0 && timing.oneByOne > 0"> ({{ timing.oneByOne >= timing.stamped ? `${(timing.oneByOne / timing.stamped).toFixed(1)}× faster` : `${(timing.stamped / timing.oneByOne).toFixed(1)}× slower on this device` }})</template>
          </template>
          <template v-else-if="timingFailed">Couldn’t load the photo to time it.</template>
          <template v-else-if="!timingBusy">Pocky at full detail, 220 columns, the middle of 5 runs each way.</template>
        </span>
      </div>
    </div>

    <!-- hit: the core, the wobbly edge and the chunks -->
    <div v-else-if="figure === 'hit'" class="pf-panel">
      <div class="pf-controls">
        <div class="pf-control">
          <label for="uf-hit-size">Hammer size <b>{{ hitSize }}</b></label>
          <input id="uf-hit-size" v-model.number="hitSize" class="pf-range" type="range" min="1" max="7" step="0.25">
        </div>
        <div class="pf-control">
          <label for="uf-hit-letter">Letter width <b>{{ hitLetter }} px</b></label>
          <input id="uf-hit-letter" v-model.number="hitLetter" class="pf-range" type="range" min="3" max="16" step="1">
        </div>
        <div class="pf-control">
          <span id="uf-hit-show">Show</span>
          <span class="pf-toggle" role="group" aria-labelledby="uf-hit-show">
            <button class="raised pf-button" :class="{ pressed: hitChunks }" :aria-pressed="hitChunks" @click="hitChunks = !hitChunks">Chunks</button>
          </span>
        </div>
      </div>
      <canvas
        ref="hitCanvas"
        class="pf-screen uf-hit-canvas"
        tabindex="0"
        role="img"
        aria-label="One hammer hit on the letters. Click, or use the arrow keys and Enter, to swing somewhere else."
        aria-describedby="uf-hit-result"
        @click="hitHere"
        @keydown="hitKeys"
      />
      <div class="pf-buttons">
        <button class="raised pf-button" @click="swingAgain()">Swing again</button>
        <span class="pf-note uf-legend" aria-hidden="true">
          <span><i class="core" />always breaks</span>
          <span><i class="edge" />broke by chance</span>
          <span v-if="hitChunks"><i class="box" />one flying chunk</span>
          <span v-if="hitChunks && hitResult?.over"><i class="gone" />no room, vanishes</span>
        </span>
      </div>
      <div v-if="hitResult" id="uf-hit-result" class="pf-detail" aria-live="polite">
        <dl class="pf-dl">
          <dt>Radius</dt><dd>{{ hitResult.radius }} px, solid core at 82%</dd>
          <dt>Broken</dt><dd>{{ hitResult.core + hitResult.edge }} letters: {{ hitResult.core }} in the core, {{ hitResult.edge }} on the edge</dd>
          <dt>Flying</dt><dd>{{ hitResult.chunks }} chunks of {{ hitResult.group }} letters, {{ hitResult.across }} px across<template v-if="hitResult.over">. {{ hitResult.over }} more don’t fit in the 60 per hit and just vanish</template></dd>
        </dl>
      </div>
    </div>

    <!-- backdrop: the real thing -->
    <div v-else-if="figure === 'backdrop'" class="pf-panel">
      <div class="pf-controls">
        <div class="pf-control">
          <span id="uf-scene">Game</span>
          <span class="pf-toggle" role="group" aria-labelledby="uf-scene">
            <button v-for="(s, id) in scenes" :key="id" class="raised pf-button" :class="{ pressed: sceneId === id }" :aria-pressed="sceneId === id" @click="sceneId = id">{{ s.label }}</button>
          </span>
        </div>
        <div class="pf-control">
          <span id="uf-switches">Switches</span>
          <span class="pf-toggle" role="group" aria-labelledby="uf-switches">
            <button class="raised pf-button" :class="{ pressed: playing }" :aria-pressed="playing" @click="playing = !playing">Game running</button>
            <button class="raised pf-button" :class="{ pressed: front }" :aria-pressed="front" @click="front = !front">Window in front</button>
          </span>
        </div>
      </div>
      <div class="uf-backdrop">
        <canvas ref="backdropCanvas" aria-hidden="true" />
        <span v-if="!front" class="uf-paused">Paused: the window isn’t in front</span>      </div>
      <div class="pf-detail" aria-live="polite">
        <strong>{{ scenes[sceneId].label }}</strong> <code>{{ scenes[sceneId].pace }}</code>
        <p>{{ scenes[sceneId].text }}</p>
      </div>
      <p v-if="reduced" class="pf-note">Your device asks for reduced motion, so the backdrop holds still, like it does on the site.</p>
    </div>

    <!-- swap: how a figure gets into a post -->
    <div v-else-if="figure === 'swap'" class="pf-panel">
      <div class="pf-controls">
        <div class="pf-control">
          <span id="uf-swap-kind">Example</span>
          <span class="pf-toggle" role="group" aria-labelledby="uf-swap-kind">
            <button v-for="(e, id) in swapExamples" :key="id" class="raised pf-button" :class="{ pressed: swapKind === id }" :aria-pressed="swapKind === id" @click="swapKind = id">{{ e.label }}</button>
          </span>
        </div>
        <div v-if="swapKind === 'image'" class="pf-control">
          <span id="uf-swap-listed">In blog-figures.mjs</span>
          <span class="pf-toggle" role="group" aria-labelledby="uf-swap-listed">
            <button class="raised pf-button" :class="{ pressed: swapListed }" :aria-pressed="swapListed" @click="swapListed = true">Listed</button>
            <button class="raised pf-button" :class="{ pressed: !swapListed }" :aria-pressed="!swapListed" @click="swapListed = false">Not listed</button>
          </span>
        </div>
      </div>
      <label class="sr-only" for="uf-swap-source">Post text</label>
      <textarea id="uf-swap-source" v-model="swapSource" class="inset uf-source" rows="7" spellcheck="false" />
      <div class="pf-pair uf-blocks">
        <div>
          <h4><code>parse()</code> gives</h4>
          <ol><li v-for="(b, i) in parsed" :key="i" :class="b.type">{{ blockLabel(b) }}</li></ol>
        </div>
        <div>
          <h4>then <code>withFigures()</code></h4>
          <ol><li v-for="(b, i) in swapped" :key="i" :class="b.type">{{ blockLabel(b) }}</li></ol>
        </div>
      </div>
      <BlogGraphic v-if="swapGraphic" :graphic="swapGraphic" class="uf-graphic" />
      <p class="pf-note">
        <template v-if="swapKind === 'graphic'">A ```figure block is plain data. The parser checks it against a short list of templates and fields, so a post can never smuggle in html.</template>
        <template v-else-if="swapListed">The image line is swapped for the hit figure, keeping its caption. Nothing about the post text changes.</template>
        <template v-else>Not listed, the line stays an ordinary image, so a post never breaks while its figure is being built.</template>
      </p>
    </div>
  </figure>
</template>

<style scoped>
/* smash: the photo at a fixed height, like a my pictures slide */
.uf-photo { width: 100%; height: clamp(260px, 60cqi, 420px); background: #15151e; border: 2px solid; border-color: var(--shadow) var(--light) var(--light) var(--shadow); }
/* on a phone the photo's controls move underneath it (theme.css), so leave them the
   same room the about portrait does */
@media (max-width: 700px) { .uf-photo { margin-bottom: 92px; } }
/* the blog gives every img height: auto, which would let the photo under the letters
   spill out of its box */
.uf-photo :deep(.ascii-original) { height: 100%; }

/* ramp */
.uf-ramp-canvas { aspect-ratio: 16 / 9; cursor: var(--classic-pointer, pointer); }
.uf-ramp-canvas:focus-visible { outline: 2px dotted var(--ink); outline-offset: 2px; }
/* the ramp, dark to bright, in one row at any width */
.uf-ramp { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; }
.uf-ramp ol { flex: 1; display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: 2px; max-width: 360px; margin: 0; padding: 0; list-style: none; font: bold 15px 'Courier New', monospace; }
.uf-ramp li { display: grid; place-items: center; height: 24px; background: #15151e; color: #d8d8e8; border: 1px solid var(--d-line, #000); }
.uf-ramp .on { background: var(--navy, #000080); color: #fff; outline: 2px solid var(--pf-mark); }
.uf-ramp .off { opacity: .4; }
.uf-ramp-end { font-size: 11px; color: var(--muted); }
.uf-swatch { display: inline-block; width: 12px; height: 12px; vertical-align: -2px; border: 1px solid var(--d-line, #000); }
.uf-letter { display: inline-grid; place-items: center; min-width: 20px; padding: 0 3px; background: #15151e; color: #fff; font: bold 15px 'Courier New', monospace; }

/* stamp: four little screens you pick between */
.uf-stamps { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.uf-stamp { display: flex; flex-direction: column; gap: 5px; padding: 6px; font: 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--ink); text-align: left; background: transparent; border: 2px solid transparent; cursor: var(--classic-pointer, pointer); }
.uf-stamp:hover { border-color: var(--d-rule, #ccc); }
.uf-stamp.on { border-color: var(--navy, #000080); background: var(--d-page-alt, #fffdf2); }
.uf-stamp-title { align-self: flex-start; padding: 1px 4px; }
.uf-stamp.on .uf-stamp-title { background: var(--navy, #000080); color: #fff; }
.uf-stamp b { font: bold 11px 'Courier New', monospace; color: var(--muted); margin-right: 3px; }
.uf-stamp.on b { color: #dfe3ff; }
.uf-stamp canvas { aspect-ratio: 16 / 9; }
.uf-stamp small { font: 11px 'Courier New', monospace; color: var(--muted); }
.uf-stamp:focus-visible { outline: 1px dotted currentColor; outline-offset: -4px; }
.uf-timing { flex: 1 1 220px; font: 12px/1.45 Tahoma, sans-serif; }
@container (max-width: 420px) { .uf-stamps { grid-template-columns: minmax(0, 1fr); } }

/* hit */
.uf-hit-canvas { height: 280px; cursor: crosshair; }
.uf-hit-canvas:focus-visible { outline: 2px dotted var(--ink); outline-offset: 2px; }
.uf-legend { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin: 0; }
.uf-legend > span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.uf-legend i { width: 12px; height: 12px; border: 1px solid var(--d-line, #000); }
.uf-legend i.core { background: rgba(255, 236, 138, .8); }
.uf-legend i.edge { background: rgba(95, 208, 200, .8); }
.uf-legend i.box { border: 1px solid var(--ink); background: transparent; }
.uf-legend i.gone { border: 1px dashed var(--pf-bad); background: transparent; }

/* backdrop: the window's own background behind the canvas, like a game window */
.uf-backdrop { position: relative; height: 240px; background: var(--surface); border: 2px solid; border-color: var(--shadow) var(--light) var(--light) var(--shadow); overflow: hidden; }
.uf-backdrop canvas { display: block; width: 100%; height: 100%; }
.uf-paused { position: absolute; left: 8px; bottom: 8px; padding: 2px 6px; font-size: 11px; background: var(--paper); color: var(--ink); border: 1px solid var(--d-line, #000); }

/* swap */
.uf-source { display: block; width: 100%; box-sizing: border-box; min-height: 9em; max-height: 26em; field-sizing: content; padding: 6px 8px; resize: vertical; background: var(--paper); color: var(--ink); font: 12px/1.5 'Courier New', monospace; }
.uf-blocks { margin-top: 12px; }
.uf-blocks h4 code { font: bold 12px 'Courier New', monospace; color: var(--ink); }
.uf-blocks ol { margin: 0; padding-left: 22px; font: 12px/1.5 'Courier New', monospace; }
.uf-blocks li { overflow-wrap: anywhere; }
.uf-blocks li.figure, .uf-blocks li.graphic { background: var(--pf-mark); color: var(--pf-mark-ink); }
.uf-blocks li.image { color: var(--muted); }
.uf-graphic { margin: 12px 0 0; }
</style>
