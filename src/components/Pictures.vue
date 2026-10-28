<script setup>
// the gallery: one big photo with dots under it, like a phone's photos app. swipe,
// drag or scroll (or use the arrow keys) to move along, tap the photo to flip it between ascii
// and the real thing, and the grid button shows every thumbnail. the photo tools wait
// behind a ⋯ button. when the window (or the phone) is too small for them to sit on the
// photo, they move up into a toolbar over it. dragging the photo sideways
// slides it along with the next or previous one coming in beside it, like a phone's
// photo gallery
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AsciiImage from './AsciiImage.vue';
import { photos } from '../photos.mjs';
import { imageAscii } from '../ascii-density.js';

defineProps({ visible: Boolean });

const selected = ref(0);
const showThumbnails = ref(false);
const ascii = imageAscii;
const photo = computed(() => photos[selected.value]);


// once the photo area is 620px wide or 340px tall or less, the sliders coming down
// from the top of the photo and up from the bottom run into each other, and on a
// phone-sized screen they'd drop under the photo (theme.css), so everything goes in
// the toolbar. the toolbar's own height is counted back in, or showing it would
// shrink the area enough to keep it showing
const phoneScreen = matchMedia('(max-width: 700px)');
const stage = ref(null);
const toolbar = ref(null);
const controlsHost = ref(null);
const compact = ref(false);
function measure() {
  const area = stage.value;
  if (!area) return;
  const height = area.clientHeight + (compact.value ? toolbar.value?.offsetHeight ?? 0 : 0);
  compact.value = phoneScreen.matches || area.clientWidth <= 620 || height <= 340;
}
const observer = new ResizeObserver(measure);
onMounted(() => observer.observe(stage.value));
onBeforeUnmount(() => observer.disconnect());

// a finger that moves mostly sideways drags the photo along, with its neighbour
// following a gap behind. letting go past a third of the way, or with a flick, slides
// the rest of the way over and switches to it; otherwise both slide back. a mouse
// drags it the same way. the ascii letters let unarmed presses through to here
// (KnockoffAscii.vue), an armed hammer keeps them; a drag still never counts as a tap
const gap = 20;
const offset = ref(0);
const settling = ref(false);
const dragging = ref(false);
let swipe = null;
let settleTimer = 0;
// a mouse let go after a drag still clicks, which shouldn't ripple the letters
let dragged = false;
function swallowClick(event) {
  if (!dragged) return;
  dragged = false;
  event.stopPropagation();
}
function swipeDown(event) {
  dragged = false;
  swipeStart(event);
}
// in order left to right, so the photo never moves in the page when its neighbour
// comes or goes. shift is how many pages over from the photo each one sits
const slides = computed(() => {
  const current = { photo: photo.value, shift: 0 };
  if (!offset.value) return [current];
  const shift = offset.value < 0 ? 1 : -1;
  const neighbour = { photo: photos[(selected.value + shift + photos.length) % photos.length], shift };
  return shift < 0 ? [neighbour, current] : [current, neighbour];
});
const pageWidth = () => (stage.value?.clientWidth ?? 0) + gap;

function swipeStart(event) {
  if (!event.isPrimary || event.button !== 0 || settling.value || event.target.closest('button')) return;
  swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, moves: [{ x: event.clientX, t: event.timeStamp }] };
}
function swipeMove(event) {
  if (swipe?.id !== event.pointerId) return;
  const dx = event.clientX - swipe.x;
  const dy = event.clientY - swipe.y;
  if (!dragging.value) {
    // wait to see which way the finger's going before taking it
    if (Math.hypot(dx, dy) < 8) return;
    if (Math.abs(dx) < Math.abs(dy)) { swipe = null; return; }
    dragging.value = true;
    swipe.x = event.clientX;
    stage.value.setPointerCapture(event.pointerId);
  }
  offset.value = event.clientX - swipe.x;
  swipe.moves.push({ x: event.clientX, t: event.timeStamp });
  if (swipe.moves.length > 5) swipe.moves.shift();
}
function swipeEnd(event) {
  if (swipe?.id !== event.pointerId) return;
  const moves = swipe.moves;
  swipe = null;
  if (!dragging.value) return;
  dragging.value = false;
  dragged = true;
  // how fast the finger was going over its last few moves, in px per ms
  const first = moves[0];
  const last = moves[moves.length - 1];
  const speed = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
  const width = pageWidth();
  const flick = Math.abs(speed) > 0.4 && Math.sign(speed) === Math.sign(offset.value);
  const go = event.type !== 'pointercancel' && (flick || Math.abs(offset.value) > width / 3);
  const direction = offset.value < 0 ? 1 : -1;
  settle(go ? -direction * width : 0, () => {
    if (go) step(direction);
    offset.value = 0;
  });
}
// scrolling moves along too. a trackpad's sideways swipe drags the photo like a finger
// would and lets go once it stops. each notch of a mouse wheel glides over one photo,
// and notches that come while it's still gliding wait their turn, so a quick spin
// goes photo by photo instead of skipping. a trackpad's up and down is a stream of
// small deltas with momentum on the end, so that moves one photo per swipe. either
// way, momentum still coming in after a photo has moved is ignored until it dies down
let wheelTotal = 0;
let wheelIdle = 0;
let wheelLocked = false;
let queued = 0;
const lockWheel = () => {
  wheelLocked = true;
  clearTimeout(wheelIdle);
  wheelIdle = setTimeout(() => { wheelLocked = false; }, 150);
};
function wheel(event) {
  if (dragging.value || showThumbnails.value) return;
  event.preventDefault();
  const scale = event.deltaMode ? 40 : 1;
  const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY);
  // a mouse wheel's notches come as big round steps, a trackpad's as a stream of small ones
  const notch = !sideways && Math.abs(event.deltaY * scale) >= 50;
  if (notch) {
    const direction = Math.sign(event.deltaY);
    // up to two more can wait, and turning back cancels the rest
    if (settling.value) queued = Math.sign(queued) === -direction ? 0 : Math.max(-2, Math.min(2, queued + direction));
    else slide(direction);
    return;
  }
  if (wheelLocked || settling.value) {
    lockWheel();
    return;
  }
  clearTimeout(wheelIdle);
  if (sideways) {
    const width = pageWidth();
    offset.value = Math.max(-width, Math.min(width, offset.value - event.deltaX * scale));
    wheelIdle = setTimeout(() => {
      const go = Math.abs(offset.value) > width / 5;
      const direction = offset.value < 0 ? 1 : -1;
      lockWheel();
      settle(go ? -direction * width : 0, () => {
        if (go) step(direction);
        offset.value = 0;
      });
    }, 120);
    return;
  }
  const delta = event.deltaY * scale;
  if (Math.sign(delta) !== Math.sign(wheelTotal)) wheelTotal = 0;
  wheelTotal += delta;
  if (Math.abs(wheelTotal) < 60) return;
  wheelTotal = 0;
  lockWheel();
  slide(Math.sign(delta));
}
// glides the next (1) or previous (-1) photo in. the neighbour is put beside the photo
// and given its decoded picture and a frame to draw its letters before anything moves.
// the glide is stepped here a frame at a time rather than left to a css transition,
// so both photos move from the one offset and stay a gap apart the whole way. it eases
// in and out since it starts from a standstill
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const easeInOut = p => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
const gliding = ref(false);
let glideFrame = 0;
async function slide(direction) {
  settling.value = true;
  gliding.value = true;
  offset.value = -direction;
  const next = photos[(selected.value + direction + photos.length) % photos.length];
  if (next.mediaType !== 'video') {
    const picture = new Image();
    picture.src = next.source;
    await picture.decode().catch(() => {});
  }
  await frame();
  const from = offset.value;
  const to = -direction * pageWidth();
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 340;
  const start = performance.now();
  const tick = now => {
    const p = duration ? Math.min(1, (now - start) / duration) : 1;
    offset.value = from + (to - from) * easeInOut(p);
    if (p < 1) { glideFrame = requestAnimationFrame(tick); return; }
    step(direction);
    offset.value = 0;
    gliding.value = false;
    settled();
  };
  glideFrame = requestAnimationFrame(tick);
}
onBeforeUnmount(() => cancelAnimationFrame(glideFrame));
onBeforeUnmount(() => clearTimeout(wheelIdle));

// slides to `target`, then lets `done` swap the photos without a jump
function settle(target, done) {
  if (offset.value === target) { done(); return; }
  settling.value = true;
  offset.value = target;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    done();
    settled();
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260);
}
// once a photo has moved, a wheel notch that came in on the way goes next
function settled() {
  settling.value = false;
  if (!queued) return;
  const direction = Math.sign(queued);
  queued -= direction;
  nextTick(() => slide(direction));
}
onBeforeUnmount(() => clearTimeout(settleTimer));

// the photos either side are fetched ahead, so one sliding in already has its picture
watch(selected, index => {
  for (const shift of [-1, 1]) {
    const next = photos[(index + shift + photos.length) % photos.length];
    if (next.mediaType !== 'video') new Image().src = next.source;
  }
}, { immediate: true });

// dates are "YYYY-MM-DD" or just "YYYY-MM", shown in the reader's locale
function formatDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  const options = d
    ? { year: 'numeric', month: 'long', day: 'numeric' }
    : { year: 'numeric', month: 'long' };
  return new Date(y, m - 1, d || 1).toLocaleDateString([], options);
}

// wraps around at both ends
function step(delta) {
  selected.value = (selected.value + delta + photos.length) % photos.length;
}

// flipping to the photo removes the letters' canvas, and focus with it, so it comes
// back here to keep the arrow keys working
const root = ref(null);
async function setMode(value) {
  ascii.value = value;
  await nextTick();
  if (document.activeElement === document.body) root.value?.focus({ preventScroll: true });
}

// the arrow keys work while focus is anywhere in this window, its frame included,
// which is where a click on the window often leaves it
function keys(event) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' || event.defaultPrevented) return;
  const frame = root.value?.closest('.window') ?? root.value;
  if (!frame?.contains(document.activeElement) || document.activeElement.closest('input, textarea, [role="slider"]')) return;
  event.preventDefault();
  step(event.key === 'ArrowLeft' ? -1 : 1);
}
addEventListener('keydown', keys);
onBeforeUnmount(() => removeEventListener('keydown', keys));
</script>

<template>
  <!-- tabindex so a tap on the photo keeps the arrow keys working -->
  <div ref="root" class="app-layout pictures-app" :class="{ compact }" tabindex="-1">
    <div v-if="compact" ref="toolbar" class="pictures-toolbar">
      <div ref="controlsHost" class="pictures-controls"/>
    </div>
    <div ref="stage" :class="['pictures-stage', { swiping: offset || dragging, settling: settling && !gliding }]" @pointerdown="swipeDown" @pointermove="swipeMove" @pointerup="swipeEnd" @pointercancel="swipeEnd" @wheel="wheel" @click.capture="swallowClick" @dragstart.prevent>
      <!-- the photo and, while it's being dragged, the neighbour coming in beside it.
           the neighbour is only made once a drag starts, then carries on as the photo
           after the swap, so its letters are already drawn and nothing reloads -->
      <figure
        v-for="slide in slides"
        :key="slide.photo.id"
        :class="['pictures-hero', { 'pictures-peek': slide.shift }]"
        :inert="slide.shift ? true : null"
        :style="{ transform: offset || slide.shift ? `translateX(${offset + slide.shift * pageWidth()}px)` : null, '--photo-ratio': slide.photo.width / slide.photo.height, '--photo-brightness': slide.photo.brightness ?? 1.22, '--ascii-brightness': slide.photo.brightness ?? 1 }"
      >
        <AsciiImage
          class="picture-image inset"
          :source="slide.photo.source"
          :media-type="slide.photo.mediaType || 'image'"
          :poster="slide.photo.poster"
          show-controls
          tidy
          :description="slide.photo.description"
          :enabled="ascii"
          :visible="visible"
          :cell-size="6"
          :controls-to="compact && !slide.shift ? controlsHost : null"
          @update:enabled="setMode"
        />
        <figcaption v-if="slide.photo.caption" class="picture-subtitle">
          <span>{{ slide.photo.caption }}</span> <strong>{{ slide.photo.name }}</strong>
        </figcaption>
      </figure>
    </div>

    <nav class="picture-dots" aria-label="Photos">
      <button
        v-for="(entry, index) in photos"
        :key="entry.id"
        :aria-label="`Photo ${index + 1}: ${entry.description}`"
        :aria-current="selected === index ? 'true' : null"
        :class="{ on: selected === index }"
        @click="selected = index"
      />
    </nav>

    <nav v-if="showThumbnails" class="picture-thumbnails" aria-label="All photos">
      <button
        v-for="(entry, index) in photos"
        :key="entry.id"
        :aria-label="`Photo ${index + 1}: ${entry.description}`"
        :aria-pressed="selected === index"
        :class="['raised', { pressed: selected === index }]"
        @click="selected = index"
      >
        <img :src="entry.thumbnail" :style="{ '--photo-brightness': entry.brightness ?? 1.22 }" alt="" width="54" height="54" loading="lazy">
      </button>
    </nav>

    <footer class="status-bar" aria-live="polite">
      <span>{{ selected + 1 }} / {{ photos.length }}</span>
      <button class="raised picture-grid" :class="{ pressed: showThumbnails }" :aria-pressed="showThumbnails" aria-label="Show all photos" title="Show all photos" @click="showThumbnails = !showThumbnails">
        <svg viewBox="0 0 11 11" width="11" height="11" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M0 0h3v3H0zm4 0h3v3H4zm4 0h3v3H8zM0 4h3v3H0zm4 0h3v3H4zm4 0h3v3H8zM0 8h3v3H0zm4 0h3v3H4zm4 0h3v3H8z"/></svg>
      </button>
      <span v-if="photo.date" class="picture-date">
        <time :datetime="photo.date">{{ formatDate(photo.date) }}</time>
      </span>
    </footer>
  </div>
</template>
