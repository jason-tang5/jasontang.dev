<script setup>
// shows an image or video as colored ascii art, with the original underneath as a fallback.
//   - videos (the wallpaper) use react-video-ascii, which is a react component,
//     so we mount a tiny react root just for it. the rest of the site is vue.
//   - images (portrait, photos) use KnockoffAscii, which is our own canvas version.
// if webgl isn't available or anything crashes, it quietly falls back to the plain media.
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { createElement, Component } from 'react';
import { createRoot } from 'react-dom/client';
import { VideoAscii } from 'react-video-ascii';
import KnockoffAscii from './KnockoffAscii.vue';
import { hammerArmed, imageDetail } from '../ascii-density.js';

const props = defineProps({
  source: String,
  description: String,
  enabled: Boolean,
  visible: Boolean,
  mediaType: { type: String, default: 'image' },
  poster: String,
  columns: Number,
  cellSize: Number,
  showControls: Boolean,
  // an element to move the controls into (my pictures' toolbar on a phone) instead of
  // floating them over the photo
  controlsTo: { type: Object, default: null },
  // fewer buttons: a tap on the photo flips between ascii and the photo, and the
  // mode buttons, sliders, hammer and reset wait behind a small ⋯ button
  tidy: Boolean,
});
const emit = defineEmits(['update:enabled']);

const toolsOpen = ref(false);
const toolsShown = computed(() => !props.tidy || toolsOpen.value);
// which mode it just switched to, shown for a moment as a pill on the photo
const flipped = ref(null);
function tapPhoto() {
  if (!props.tidy || props.mediaType !== 'image' || hammerArmed.value || failed.value) return;
  emit('update:enabled', !props.enabled);
  flipped.value = { text: props.enabled ? 'Photo' : 'ASCII', key: Date.now() };
}
// putting the tools away puts the hammer down too
watch(toolsShown, shown => { if (!shown) hammerArmed.value = false; });

const host = ref(null);
const fallbackVideo = ref(null);
const failed = ref(false);
const playbackBlocked = ref(false);
let mediaObserver;
let observedVideo;
let playbackNudge;
const asciiReset = ref(0);
const reducedMotion = ref(false);
const pageHidden = ref(document.hidden);
// one detail setting for every photo and video in my pictures. it becomes a letter
// size in pixels, not a column count, so a narrow portrait video and a wide landscape
// one (or a photo) get the same size letters at the same slider position
const asciiColumns = imageDetail;
const imageCellSize = computed(() => 540 / asciiColumns.value);
const densitySlider = ref(null);
const spinning = ref(false);

// the ↻ button in the top left brings every knocked out letter back
function resetAscii() {
  asciiReset.value++;
  spinning.value = false;
  requestAnimationFrame(() => { spinning.value = true; });
}
let densityDragging = false;

function setColumns(value) {
  asciiColumns.value = Math.max(40, Math.min(220, Math.round(value / 10) * 10));
}

// the slider stands up on big screens and lies flat under the photo on phones
function densityAt(event) {
  const rect = densitySlider.value.getBoundingClientRect();
  const along = rect.width > rect.height
    ? (event.clientX - rect.left - 5.5) / (rect.width - 11)
    : (rect.bottom - event.clientY - 5.5) / (rect.height - 11);
  setColumns(40 + along * 180);
}

function densityDown(event) {
  if (!props.enabled || event.button !== 0) return;
  densityDragging = true;
  densitySlider.value.setPointerCapture(event.pointerId);
  densitySlider.value.focus();
  densityAt(event);
}

function densityKeys(event) {
  if (!props.enabled) return;
  const steps = { ArrowRight: 10, ArrowUp: 10, ArrowLeft: -10, ArrowDown: -10, PageUp: 30, PageDown: -30 };
  if (event.key === 'Home') setColumns(40);
  else if (event.key === 'End') setColumns(220);
  else if (event.key in steps) setColumns(asciiColumns.value + steps[event.key]);
  else return;
  event.preventDefault();
}

// only burn gpu when someone can actually see it
const running = computed(() =>
  (props.enabled || props.mediaType === 'video') && props.visible && !failed.value && !reducedMotion.value && !pageHidden.value,
);

const mouseTrail = { style: 'brighten', radius: 0.04, duration: 1.0, trailLen: 14, trailDecay: 6, brightness: 2.4 };
const ripple = { style: 'ripple', brightness: 1.3, speed: 1.2 };

let root;
let observer;
let motionQuery;

// react error boundary so a crash inside the library flips us to the fallback instead of breaking the page
class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    failed.value = true;
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}


function release() {
  root?.unmount();
  root = null;
}

function render() {
  if (!host.value) return;
  if (failed.value || props.mediaType === 'image') {
    release();
    return;
  }

  if (!root) {
    // check webgl2 exists before handing things to the library, then give the test context back
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      failed.value = true;
      return;
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    root = createRoot(host.value);
  }

  // the gpu loop keeps running so the mouse trail and ripples can fade out.
  // with reduced motion it's paused but still draws the frame.
  // a fixed column count (the wallpaper asks for 350) is capped so letters stay at
  // least 4px wide. on a phone 350 columns made them about 1px, which just looked
  // like a blurry video instead of ascii
  const columns = props.showControls
    ? Math.max(20, Math.round(host.value.clientWidth / imageCellSize.value))
    : props.columns
      ? Math.max(40, Math.min(props.columns, Math.round(host.value.clientWidth / 4)))
      : Math.min(180, Math.max(40, Math.round(host.value.clientWidth / 7)));
  root.render(createElement(Boundary, null, createElement(VideoAscii, {
    src: props.source,
    mediaType: props.mediaType,
    videoMode: !props.enabled,
    paused: !running.value,
    mouseEffect: running.value && props.enabled ? mouseTrail : false,
    clickEffect: running.value && props.enabled ? ripple : false,
    revealEffect: false,
    // the library shrinks its canvas by maxDpr / devicePixelRatio, so a fixed 1 left
    // phones (3x screens) drawing at a third of the resolution, too blurry to read
    // as letters. follow the screen instead, up to 3x
    maxDpr: Math.min(3, Math.max(props.showControls ? 2 : 1, window.devicePixelRatio || 1)),
    numColsRaw: columns,
    brightnessRaw: 1.15,
    saturationRaw: 1.2,
    bgOpacityRaw: 0.35,
  })));
}

// the library's hidden <video> gets muted and playsinline as react props, which don't
// always become real attributes. iphones only autoplay a video with both attributes,
// so set them directly and give it a nudge
function playVideo(video) {
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  if (video.paused) video.play().then(() => { playbackBlocked.value = false; }).catch(error => {
    if (error.name !== 'AbortError') playbackBlocked.value = true;
  });
}
function keepVideoPlaying() {
  const video = host.value?.querySelector('video');
  if (!video) return;
  // Chrome Android may suspend display:none autoplay media. Keep the decoding
  // source laid out underneath its canvas instead of removing it from layout.
  video.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:-1';
  if (observedVideo !== video) {
    observedVideo?.removeEventListener('error', videoError);
    observedVideo?.removeEventListener('canplay', keepVideoPlaying);
    observedVideo = video;
    video.addEventListener('error', videoError);
    video.addEventListener('canplay', keepVideoPlaying);
  }
  if (running.value) playVideo(video);
}
function videoError() { failed.value = true; }
function retryPlayback() {
  keepVideoPlaying();
  syncFallback();
}

function lost(event) {
  event.preventDefault();
  failed.value = true;
}

function syncMotion() {
  reducedMotion.value = motionQuery.matches;
}

function syncVisibility() {
  pageHidden.value = document.hidden;
}

// the plain fallback video should also pause when nobody's looking
function syncFallback() {
  const video = fallbackVideo.value;
  if (!video) return;
  if (props.visible && !reducedMotion.value && !pageHidden.value) playVideo(video);
  else video.pause();
}

watch(
  () => [
    props.source,
    props.mediaType,
    props.columns,
    asciiColumns.value,
    props.enabled,
    props.visible,
    failed.value,
    running.value,
    reducedMotion.value,
    pageHidden.value,
  ],
  async () => {
    render();
    await nextTick();
    syncFallback();
    keepVideoPlaying();
  },
);

onMounted(() => {
  motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  syncMotion();
  motionQuery.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncVisibility);
  host.value.addEventListener('webglcontextlost', lost, true);
  observer = new ResizeObserver(render);
  observer.observe(host.value);
  mediaObserver = new MutationObserver(keepVideoPlaying);
  mediaObserver.observe(host.value, { childList: true, subtree: true });
  document.addEventListener('pointerdown', retryPlayback);
  render();
  syncFallback();
  // react mounts the library's video a moment later
  playbackNudge = setTimeout(keepVideoPlaying, 300);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  mediaObserver?.disconnect();
  clearTimeout(playbackNudge);
  document.removeEventListener('pointerdown', retryPlayback);
  observedVideo?.removeEventListener('error', videoError);
  observedVideo?.removeEventListener('canplay', keepVideoPlaying);
  motionQuery?.removeEventListener('change', syncMotion);
  document.removeEventListener('visibilitychange', syncVisibility);
  fallbackVideo.value?.pause();
  host.value?.removeEventListener('webglcontextlost', lost, true);
  release();
});
</script>

<template>
  <div
    class="ascii-image"
    :class="{ 'ascii-tidy': tidy }"
    @click="tapPhoto"
    :role="mediaType === 'image' || showControls ? 'group' : 'img'"
    :aria-label="description"
  >
    <img :src="poster || source" alt="" class="ascii-original">
    <video
      v-if="mediaType === 'video' && failed"
      ref="fallbackVideo"
      class="ascii-original"
      :src="source"
      :poster="poster"
      muted
      loop
      playsinline
      preload="auto"
      aria-hidden="true"
      @loadeddata="syncFallback"
    />
    <div
      ref="host"
      class="ascii-layer"
      aria-hidden="true"
      :style="{
        visibility: (enabled || mediaType === 'video') && !failed && visible ? 'visible' : 'hidden',
        animationPlayState: running ? 'running' : 'paused',
      }"
    />
    <KnockoffAscii
      v-if="mediaType === 'image' && enabled && !failed"
      :reset-version="asciiReset"
      :source="source"
      :description="description"
      :cell-size="imageCellSize"

      :visible="visible"
      :reduced-motion="reducedMotion"
      :controls-to="controlsTo"
      :show-tools="toolsShown"
      @error="failed = true"
      @tap="tapPhoto"
    />
    <span v-if="flipped" :key="flipped.key" class="ascii-flip-pill" aria-hidden="true" @animationend="flipped = null">{{ flipped.text }}</span>
    <Teleport :to="controlsTo || 'body'" :disabled="!controlsTo">
    <button
      v-if="mediaType === 'image' && enabled && !failed && toolsShown"
      class="ascii-reset raised"
      :class="{ spinning }"
      title="Restore canvas"
      aria-label="Bring the ASCII letters back"
      @pointerdown.stop
      @pointermove.stop
      @keydown.stop
      @click.stop="resetAscii"
      @animationend="spinning = false"
    >
      <svg class="spin-icon" width="24" height="24" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
        <path fill="currentColor" d="M4 1h4v1H4zM9 1h1v1H9zM2 2h2v1H2zM8 2h2v1H8zM2 3h1v1H2zM7 3h3v1H7zM1 4h1v4H1zM10 6h1v2h-1zM2 8h1v1H2zM9 8h1v1H9zM2 9h2v1H2zM8 9h2v1H8zM4 10h4v1H4z"/>
      </svg>
    </button>
    </Teleport>
    <button v-if="mediaType === 'video' && playbackBlocked" class="raised video-play" @click.stop="retryPlayback">Play video</button>
    <!-- stop events here so clicking the toggle doesn't also poke the image or drag the window -->
    <Teleport :to="controlsTo || 'body'" :disabled="!controlsTo">
    <div
      v-if="(mediaType === 'image' || showControls) && toolsShown"
      class="ascii-mode-controls"

      role="group"
      aria-label="Photo rendering"
      @pointerdown.stop
      @pointermove.stop
      @click.stop
      @keydown.stop
    >
      <button class="raised" :class="{ pressed: enabled }" :aria-pressed="enabled" @click="emit('update:enabled', true)">ASCII</button>
      <button class="raised" :class="{ pressed: !enabled }" :aria-pressed="!enabled" @click="emit('update:enabled', false)">Normal</button>
      <!-- the detail slider stays up the whole time ascii is on -->
      <div v-if="enabled" class="ascii-density raised" title="ASCII detail">
        <svg width="11" height="11" viewBox="0 0 11 11" shape-rendering="crispEdges" aria-hidden="true">
          <path fill="currentColor" d="M0 0h3v3H0zm4 0h3v3H4zm4 0h3v3H8zM0 4h3v3H0zm4 0h3v3H4zm4 0h3v3H8zM0 8h3v3H0zm4 0h3v3H4zm4 0h3v3H8z"/>
        </svg>
        <div
          ref="densitySlider"
          class="volume-slider density-slider"
          role="slider"
          :tabindex="enabled ? 0 : -1"
          aria-label="ASCII detail"
          aria-orientation="vertical"
          aria-valuemin="40"
          aria-valuemax="220"
          :aria-valuenow="asciiColumns"
          :aria-valuetext="`${Math.round((asciiColumns - 40) / 180 * 100)}% detail`"
          :aria-disabled="!enabled"
          :style="{ '--level': (asciiColumns - 40) / 180 * 100 }"
          @pointerdown="densityDown"
          @pointermove="densityDragging && enabled && densityAt($event)"
          @pointerup="densityDragging = false"
          @pointercancel="densityDragging = false"
          @lostpointercapture="densityDragging = false"
          @keydown="densityKeys"
        >
          <span class="volume-groove" />
          <span class="volume-thumb" />
        </div>
        <svg width="7" height="7" viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true">
          <path fill="currentColor" d="M0 0h3v3H0zm4 0h3v3H4zM0 4h3v3H0zm4 0h3v3H4z"/>
        </svg>
      </div>
    </div>
    </Teleport>
    <button
      v-if="tidy && mediaType === 'image' && !failed"
      class="ascii-more raised"
      :class="{ pressed: toolsOpen }"
      :aria-pressed="toolsOpen"
      :title="toolsOpen ? 'Hide photo tools' : 'More photo tools'"
      aria-label="Photo tools"
      @click.stop="toolsOpen = !toolsOpen"
      @pointerdown.stop
      @pointermove.stop
      @keydown.stop
    >⋯</button>
  </div>
</template>
