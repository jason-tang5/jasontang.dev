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

const showThumbnails = ref(false);
const ascii = imageAscii;


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

// moves like the projects row: where it is, counted in photos, glides toward a stop
// that wheel notches, flicks and arrow keys keep moving on from, even mid-glide. it
// wraps around, so `pos` runs past either end and the photo is pos mod the count.
// the glide is a spring stepped a frame at a time, so a new stop picks up from the
// speed it's already going instead of starting over
const gap = 20;
const wrap = index => ((index % photos.length) + photos.length) % photos.length;
const pos = ref(0);
const selected = computed(() => wrap(Math.round(pos.value)));
const photo = computed(() => photos[selected.value]);
let target = null;
let velocity = 0;
let glideFrame = 0;
let glideTime = 0;
const stiffness = 300;
function glideTo(to) {
  target = to;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stopGlide();
    pos.value = to;
    return;
  }
  if (glideFrame) return;
  glideTime = performance.now();
  glideFrame = requestAnimationFrame(glide);
}
function glide(now) {
  const dt = Math.min(0.032, (now - glideTime) / 1000);
  glideTime = now;
  velocity += (stiffness * (target - pos.value) - 2 * Math.sqrt(stiffness) * velocity) * dt;
  pos.value += velocity * dt;
  if (Math.abs(target - pos.value) < 0.002 && Math.abs(velocity) < 0.05) {
    pos.value = target;
    stopGlide();
    return;
  }
  glideFrame = requestAnimationFrame(glide);
}
function stopGlide() {
  cancelAnimationFrame(glideFrame);
  glideFrame = 0;
  target = null;
  velocity = 0;
}
onBeforeUnmount(stopGlide);
// the next stop over, counted from where it's headed
const glideBy = direction => glideTo((target ?? Math.round(pos.value)) + direction);
// the dots and thumbnails go straight there rather than gliding past every photo between
function jump(index) {
  stopGlide();
  pos.value = Math.round(pos.value) + index - selected.value;
}

// a finger or mouse that moves mostly sideways drags the photo along, with its
// neighbour following a gap behind, and catches it mid-glide. letting go settles on
// the nearest photo, or the next one over with a flick. the ascii letters let unarmed
// presses through to here (KnockoffAscii.vue), an armed hammer keeps them; a drag
// still never counts as a tap
const dragging = ref(false);
let swipe = null;
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
// the photo or two `pos` sits between, in order left to right so neither moves in the
// page when the other comes or goes. `at` is where each sits, unwrapped, and the one
// nearest `pos` is the photo, the other its peeking neighbour
const slides = computed(() => {
  const base = Math.floor(pos.value);
  const shown = pos.value === base || photos.length < 2 ? [base] : [base, base + 1];
  const current = Math.round(pos.value);
  return shown.map(at => ({ photo: photos[wrap(at)], at, peek: at !== current }));
});
const pageWidth = () => (stage.value?.clientWidth ?? 0) + gap;

function swipeStart(event) {
  if (!event.isPrimary || event.button !== 0 || event.target.closest('button')) return;
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
    stopGlide();
    clearTimeout(wheelIdle);
    swipe.x = event.clientX;
    swipe.from = pos.value;
    stage.value.setPointerCapture(event.pointerId);
  }
  pos.value = swipe.from - (event.clientX - swipe.x) / pageWidth();
  swipe.moves.push({ x: event.clientX, t: event.timeStamp });
  if (swipe.moves.length > 5) swipe.moves.shift();
}
function swipeEnd(event) {
  if (swipe?.id !== event.pointerId) return;
  const { moves, from } = swipe;
  swipe = null;
  if (!dragging.value) return;
  dragging.value = false;
  dragged = true;
  if (event.type === 'pointercancel') {
    glideTo(Math.round(from));
    return;
  }
  // how fast the finger was going over its last few moves, in px per ms
  const first = moves[0];
  const last = moves[moves.length - 1];
  const speed = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
  let to = Math.round(pos.value);
  if (Math.abs(speed) > 0.4) {
    const direction = speed < 0 ? 1 : -1;
    if (Math.sign(to - pos.value) !== direction) to += direction;
  }
  glideTo(to);
}
// scrolling moves along too. a trackpad's sideways swipe drags the photo under the
// fingers, momentum and all, and settles on the nearest photo once it stops. up and
// down, it's a photo for every notch of a mouse wheel (100px), and a trackpad's stream
// of small deltas adds up to the same before it moves
let wheelTotal = 0;
let wheelIdle = 0;
function wheel(event) {
  if (dragging.value || showThumbnails.value) return;
  event.preventDefault();
  const scale = event.deltaMode ? 40 : 1;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    stopGlide();
    pos.value += event.deltaX * scale / pageWidth();
    clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => glideTo(Math.round(pos.value)), 120);
    return;
  }
  const delta = event.deltaY * scale;
  if (Math.sign(delta) !== Math.sign(wheelTotal)) wheelTotal = 0;
  wheelTotal += delta;
  if (Math.abs(wheelTotal) < 100) return;
  glideBy(Math.sign(wheelTotal));
  wheelTotal = 0;
}
onBeforeUnmount(() => clearTimeout(wheelIdle));

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
  glideBy(event.key === 'ArrowLeft' ? -1 : 1);
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
    <div ref="stage" :class="['pictures-stage', { swiping: slides.length > 1 || dragging }]" @pointerdown="swipeDown" @pointermove="swipeMove" @pointerup="swipeEnd" @pointercancel="swipeEnd" @wheel="wheel" @click.capture="swallowClick" @dragstart.prevent>
      <!-- the photo and, while it's being dragged, the neighbour coming in beside it.
           the neighbour is only made once a drag starts, then carries on as the photo
           after the swap, so its letters are already drawn and nothing reloads -->
      <figure
        v-for="slide in slides"
        :key="slide.photo.id"
        :class="['pictures-hero', { 'pictures-peek': slide.peek }]"
        :inert="slide.peek ? true : null"
        :style="{ transform: slide.at !== pos ? `translateX(${(slide.at - pos) * pageWidth()}px)` : null, '--photo-ratio': slide.photo.width / slide.photo.height, '--photo-brightness': slide.photo.brightness ?? 1.22, '--ascii-brightness': slide.photo.brightness ?? 1 }"
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
          :controls-to="compact && !slide.peek ? controlsHost : null"
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
        @click="jump(index)"
      />
    </nav>

    <nav v-if="showThumbnails" class="picture-thumbnails" aria-label="All photos">
      <button
        v-for="(entry, index) in photos"
        :key="entry.id"
        :aria-label="`Photo ${index + 1}: ${entry.description}`"
        :aria-pressed="selected === index"
        :class="['raised', { pressed: selected === index }]"
        @click="jump(index)"
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
