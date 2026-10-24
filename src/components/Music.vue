<script setup>
// the cd player. it drives spotify's embed through their iframe api, which only
// loads the first time you press play. while it plays, little pixel notes float
// up off the disc.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { defaultDisc, findTrack, musicDiscs } from '../music.mjs';
import { cdCue } from '../cd-cue.js';
import { loadSpotifyApi } from '../spotify.js';
import { createPlaybackEndTracker } from '../playback-end.mjs';
import { noteGlyphs, noteColors } from '../notes.mjs';
import MusicVisualizer from './MusicVisualizer.vue';
import RetroSelect from './RetroSelect.vue';
import { play } from '../sound.js';
import { buzz } from '../haptics.js';
import { read, save } from '../storage.js';

defineProps({ win: Object });

const selected = ref(0);
const position = ref(0);
const duration = ref(0);
const paused = ref(true);
const loading = ref(false);
const ready = ref(false);
const showSpotify = ref(true);
const message = ref('');
const notes = ref([]);
const repeatTrack = ref(read('cd-repeat', 'off') === 'on');
function toggleRepeat() {
  repeatTrack.value = !repeatTrack.value;
  save('cd-repeat', repeatTrack.value ? 'on' : 'off');
  buzz(8);
}

// template refs
const embedHost = ref(null);
const disc = ref(null);
const discEjected = ref(false);
const discClicked = ref(false);
function discOffset(index) {
  const count = discs.length;
  return ((index - browsing.value + count + Math.floor(count / 2)) % count) - Math.floor(count / 2);
}
let swipeFrom = null;
let rackSwiped = false;
function rackDown(event) { swipeFrom = event.clientX; rackSwiped = false; }
function rackUp(event) {
  if (swipeFrom === null) return;
  const delta = event.clientX - swipeFrom;
  swipeFrom = null;
  if (Math.abs(delta) > 30) { rackSwiped = true; rotateDisc(delta < 0 ? 1 : -1); }
}
function pickDisc(index, event) {
  if (rackSwiped && event.detail !== 0) return;
  spin(discOffset(index));
}
const discs = musicDiscs;
const inserted = ref(defaultDisc);
const browsing = ref(defaultDisc);
// how far the carousel has turned in total, so a disc always travels the short way
// round the ring instead of jumping across the front when the count wraps
const turn = ref(defaultDisc);
// where a disc sits on the ring, counting whole turns so it keeps travelling the same way
function discAngle(index) { return (index - turn.value) * 360 / discs.length; }
// how far to turn it back toward you. it depends only on its spot on the ring, so a disc
// looks the same however many times round you've gone: side discs turn back the most
function discFace(index) { return Math.round(-Math.sin(discAngle(index) * Math.PI / 180) * 50); }
function spin(steps) {
  turn.value += steps;
  browsing.value = ((turn.value % discs.length) + discs.length) % discs.length;
}
const activeDisc = computed(() => discs[inserted.value]);
const albumUrl = computed(() => activeDisc.value.url);
// discs with a track list get track controls, the rest just play straight through
const hasTracks = computed(() => Boolean(activeDisc.value.tracks));
const tracks = computed(() => activeDisc.value.tracks ?? [{ uri: activeDisc.value.uri, title: activeDisc.value.title, duration: 0 }]);
let insertTimer;
let insertPending = false;
function rotateDisc(direction) {
  spin(direction);
  play('release');
  buzz(8);
}
function toggleDisc() {
  clearTimeout(insertTimer);
  if (!discEjected.value) {
    insertPending = false;
    discEjected.value = true;
    turn.value = browsing.value = inserted.value;
    if (controller) pause();
    paused.value = true;
    play('cartOut');
  } else {
    if (!discs[browsing.value].uri) return;
    const changed = inserted.value !== browsing.value;
    inserted.value = browsing.value;
    if (changed) { selected.value = 0; position.value = 0; duration.value = 0; }
    playbackEnd.reset();
    discEjected.value = false;
    insertPending = true;
    play('discLoad');
    // Reduced motion has no transitionend; the timer also covers interrupted transitions.
    insertTimer = setTimeout(finishInsert, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420);
  }
  buzz(12);
}
function finishInsert() {
  if (!insertPending || discEjected.value || disposed) return;
  insertPending = false;
  clearTimeout(insertTimer);
  play('cartIn'); buzz([12, 18, 25]);
  // restart the seating bump even if the last one hasn't finished
  discClicked.value = false;
  requestAnimationFrame(() => { discClicked.value = true; });
  if (controller) { controller.loadUri(current.value.uri); requestPlay(); }
  else initialize();
}
function discSeated(event) {
  if (event.propertyName === 'transform') finishInsert();
}

let controller;
let disposed = false;
let startupTimer;
let noteTimer;
let noteId = 0;

const playbackEnd = createPlaybackEndTracker();
const current = computed(() => tracks.value[selected.value]);
// spotify only tells us the duration once it's playing, until then use ours
const length = computed(() => duration.value || current.value.duration);

// ms to m:ss
function time(ms) {
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
}

function update({ data }) {
  // ignore stale updates from the track we just switched away from
  if (disposed || discEjected.value) return;
  if (hasTracks.value && data.playingURI && data.playingURI !== current.value.uri) return;

  const ended = playbackEnd.update(data);
  paused.value = data.isPaused;
  position.value = data.position || 0;
  duration.value = data.duration || 0;

  const index = tracks.value.findIndex(t => t.uri === data.playingURI);
  if (index >= 0) selected.value = index;

  if (!data.isPaused) {
    clearTimeout(startupTimer);
    message.value = '';
  }
  if (ended && hasTracks.value) choose(repeatTrack.value ? selected.value : selected.value + 1);
}

// spotify's play() always restarts from 0:00, so after a pause we have to use resume().
// browsers sometimes block autoplay in the iframe, so if nothing starts after a few
// seconds we open the real spotify player and ask the user to press play there.
function requestPlay(resume = false) {
  if (discEjected.value) return;
  if (resume) controller?.resume();
  else controller?.play();

  clearTimeout(startupTimer);
  startupTimer = setTimeout(() => {
    if (paused.value && !disposed) {
      showSpotify.value = true;
      message.value = 'Press Play in Spotify to start playback.';
    }
  }, 6000);
}

function giveUp(text) {
  loading.value = false;
  showSpotify.value = true;
  message.value = text;
}

async function initialize() {
  if (controller || loading.value) return;
  loading.value = true;
  message.value = 'Loading Spotify…';

  try {
    const api = await loadSpotifyApi();
    if (disposed) return;

    const mount = document.createElement('div');
    embedHost.value.append(mount);

    api.createController(mount, { uri: current.value.uri, width: '100%', height: 152 }, value => {
      // the window might have closed while spotify was loading
      if (disposed) {
        value.destroy();
        return;
      }

      controller = value;
      controller.addListener('playback_update', update);
      controller.addListener('ready', () => {
        if (disposed) return;
        loading.value = false;
        ready.value = true;
        message.value = '';
        requestPlay();
      });

      clearTimeout(startupTimer);
      startupTimer = setTimeout(() => {
        if (!ready.value && !disposed) giveUp('Spotify is taking longer to load. You can open the album below.');
      }, 12000);
    });
  } catch {
    if (!disposed) giveUp('Spotify is unavailable. Open the album below.');
  }
}

function pause() {
  clearTimeout(startupTimer);
  playbackEnd.pause();
  controller?.pause();
}

function togglePlay() {
  if (discEjected.value) return toggleDisc();
  if (!controller) initialize();
  else if (paused.value) requestPlay(position.value > 0);
  else pause();
}

// spotify's embed has no volume control we can reach, so the closest thing is
// pausing when the site is muted or the volume slider hits zero.
// turning sound back on doesn't restart the music by itself
function siteSound({ detail }) {
  if ((!detail.enabled || !detail.level) && controller && !paused.value) pause();
}

// wraps around in both directions
function choose(index) {
  if (discEjected.value || !hasTracks.value) return;
  playbackEnd.reset();
  selected.value = (index + tracks.value.length) % tracks.value.length;
  position.value = 0;
  duration.value = 0;
  if (controller) {
    controller.loadUri(current.value.uri);
    requestPlay();
  }
}

function seek(event) {
  controller?.seek(Math.floor(Number(event.target.value) / 1000));
}

// ---- floating notes ----
// they're teleported onto the desktop so they can float out past the window edges

// the glyphs and colours live in notes.mjs, the about page uses them too

function spawnNote() {
  const host = document.querySelector('.desktop');
  const rect = disc.value?.getBoundingClientRect();
  if (!host || !rect?.width || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const box = host.getBoundingClientRect();
  const id = noteId++;
  // alternate left and right
  const dir = id % 2 ? 1 : -1;

  // start somewhere on the upper rim of the disc, not the middle
  const angle = -Math.PI / 2 + dir * (Math.PI / 5 + Math.random() * Math.PI / 4);
  const radius = rect.width / 2;

  notes.value.push({
    id,
    glyph: noteGlyphs[id % noteGlyphs.length],
    style: {
      left: `${rect.left - box.left + radius + Math.cos(angle) * radius}px`,
      top: `${rect.top - box.top + rect.height / 2 + Math.sin(angle) * radius}px`,
      color: noteColors[id % noteColors.length],
      // how far it drifts, the css animation reads these
      '--dx': `${dir * (50 + Math.random() * 100)}px`,
      '--dy': `${-(170 + Math.random() * 130)}px`,
    },
  });
}

function removeNote(id) {
  notes.value = notes.value.filter(n => n.id !== id);
}

watch(paused, isPaused => {
  clearInterval(noteTimer);
  if (!isPaused) {
    spawnNote();
    noteTimer = setInterval(spawnNote, 450);
  }
});

// a link asked for a song (cd-cue.js): put its disc in, pick the track and play it
function playCue() {
  const found = cdCue.value && findTrack(cdCue.value.slug);
  cdCue.value = null;
  if (!found || disposed) return;
  clearTimeout(insertTimer);
  insertPending = false;
  spin(discOffset(found.disc));
  inserted.value = found.disc;
  discEjected.value = false;
  playbackEnd.reset();
  selected.value = found.track;
  position.value = 0;
  duration.value = 0;
  if (controller) { controller.loadUri(current.value.uri); requestPlay(); }
  else initialize();
}
watch(cdCue, playCue);

onMounted(() => {
  window.addEventListener('site-sound', siteSound);
  // the link that opened the window may have cued a song before it was here
  playCue();
});

onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(insertTimer);
  window.removeEventListener('site-sound', siteSound);
  clearTimeout(startupTimer);
  clearInterval(noteTimer);
  controller?.destroy();
});
</script>

<template>
  <div class="app-layout cd-app">
    <div class="cd-face">
      <button class="cd-disc-slot" :class="{ ejected: discEjected, clicked: discClicked, playing: !paused && !discEjected }"
        :aria-label="discEjected ? 'Insert CD' : 'Eject CD'" :aria-pressed="discEjected" :disabled="discEjected && !discs[browsing].uri" @click="toggleDisc">
        <span class="cd-disc-carriage" @transitionend="discSeated" @animationend="discClicked = false">
          <span ref="disc" class="cd-disc" :class="[`disc-${inserted + 1}`, { spinning: !paused && !discEjected }]" aria-hidden="true"/>
        </span>
        <span class="cd-slot-led" aria-hidden="true"/>
        <span class="cd-slot-front" aria-hidden="true">
          <svg viewBox="0 0 7 9" shape-rendering="crispEdges"><path d="M3 0h1v1H3zM2 1h3v1H2zM1 2h5v1H1zM0 3h7v1H0zM0 6h7v2H0z"/></svg>
          {{ discEjected ? 'INSERT' : 'EJECT' }}
        </span>
      </button>

      <div class="cd-controls">
        <RetroSelect class="cd-track" label="Track" :disabled="discEjected || !hasTracks" :model-value="selected"
          :options="tracks.map((track, i) => `${i + 1} of ${tracks.length}: ${track.title}`)" @update:model-value="choose"/>

        <div class="cd-timeline">
          <output aria-label="Elapsed time">{{ time(position) }}</output>
          <input
            aria-label="Seek playback"
            type="range"
            min="0"
            :max="length"
            step="1000"
            :value="position"
            :disabled="!ready || discEjected"
            @change="seek"
          >
          <output aria-label="Track duration">{{ time(length) }}</output>
        </div>

        <div class="cd-transport">
          <button class="raised cd-repeat" :class="{ pressed: repeatTrack }" :aria-pressed="repeatTrack"
            :aria-label="repeatTrack ? 'Disable repeat' : 'Enable repeat'" title="Repeat current track"
            :disabled="!hasTracks" @click="toggleRepeat">
            <svg viewBox="0 0 20 14" shape-rendering="crispEdges" aria-hidden="true"><path d="M4 2h10V0h2v1h1v1h1v2h-1v1h-1v1h-2V4H4v3H2V4h1V3h1zM16 12H6v2H4v-1H3v-1H2v-2h1V9h1V8h2v2h10V7h2v3h-1v1h-1z"/></svg>
          </button>
          <button class="raised" aria-label="Previous track" :disabled="discEjected || !hasTracks" @click="choose(selected - 1)">
            <svg viewBox="0 0 20 14" aria-hidden="true"><path d="M9 2 2 7l7 5V2zm8 0-7 5 7 5V2z"/></svg>
          </button>
          <button
            class="raised"
            :aria-label="loading ? 'Loading Spotify' : discEjected ? 'Insert selected CD' : paused ? 'Play' : 'Pause'"
            :disabled="loading || (discEjected && !discs[browsing].uri)"
            @click="togglePlay"
          >
            <svg viewBox="0 0 20 14" aria-hidden="true">
              <path v-if="paused" d="m6 2 10 5-10 5z"/>
              <path v-else d="M5 2h4v10H5zm7 0h4v10h-4z"/>
            </svg>
          </button>
          <button class="raised" aria-label="Next track" :disabled="discEjected || !hasTracks" @click="choose(selected + 1)">
            <svg viewBox="0 0 20 14" aria-hidden="true"><path d="m3 2 7 5-7 5V2zm8 0 7 5-7 5V2z"/></svg>
          </button>
          <button
            class="raised cd-spotify-toggle"
            :class="{ pressed: showSpotify }"
            :aria-label="showSpotify ? 'Hide Spotify player' : 'Show Spotify player'"
            title="Spotify"
            :aria-expanded="showSpotify"
            aria-controls="cd-spotify"
            @click="showSpotify = !showSpotify"
          >
            <svg viewBox="0 0 20 14" aria-hidden="true">
              <circle cx="10" cy="7" r="6.5"/>
              <path
                d="M6 5.2c2.8-.9 5.6-.6 8 .8M6.5 7.6c2.3-.6 4.5-.4 6.6.7M7 9.8c1.8-.4 3.4-.3 5 .5"
                fill="none"
                stroke-width="1.2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <Transition name="cd-rack">
      <section v-if="discEjected" class="cd-disc-rack inset" aria-label="CD carousel">
        <div class="cd-rack-header">
          <div aria-live="polite"><strong>{{ discs[browsing].title }}</strong><small>{{ discs[browsing].uri ? 'Ready to play' : 'Album coming soon' }}</small></div>
          <span>{{ browsing + 1 }} / {{ discs.length }}</span>
        </div>
        <div class="cd-rack-stage" @pointerdown="rackDown" @pointerup="rackUp" @pointercancel="swipeFrom = null">
          <button v-for="(item, index) in discs" :key="index" class="cd-rack-disc"
            :class="{ selected: browsing === index, empty: !item.uri }"
            :style="{ '--disc-angle': discAngle(index), '--disc-face': discFace(index), '--disc-color': item.color, zIndex: discs.length - Math.abs(discOffset(index)) }"
            :aria-label="item.title" :aria-pressed="browsing === index" @click="pickDisc(index, $event)">
            <span class="cd-disc" :class="`disc-${index + 1}`" aria-hidden="true"/>
            <span class="cd-rack-number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
          </button>
        </div>
        <div class="cd-rack-navigation">
          <button class="raised" aria-label="Previous disc" @click="rotateDisc(-1)"><svg viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true"><path d="M4 0h1v7H4zM3 1h1v5H3zM2 2h1v3H2zM1 3h1v1H1z"/></svg></button>
          <button class="raised cd-rack-insert" :disabled="!discs[browsing].uri" @click="toggleDisc">INSERT DISC</button>
          <button class="raised" aria-label="Next disc" @click="rotateDisc(1)"><svg viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true"><path d="M2 0h1v7H2zM3 1h1v5H3zM4 2h1v3H4zM5 3h1v1H5z"/></svg></button>
        </div>
      </section>
    </Transition>

    <!-- the Spotify panel is open by default; playback still starts on request -->
    <div id="cd-spotify" class="cd-spotify" :class="{ expanded: showSpotify }" :inert="!showSpotify">
      <p v-if="message" role="status">{{ message }}</p>
      <div ref="embedHost" class="cd-embed"/>
      <a :href="albumUrl" target="_blank" rel="noopener">Open in Spotify</a>
    </div>

    <!-- a strip under the player on desktop, the rest of the screen on phones -->
    <MusicVisualizer :playing="!paused"/>

    <span class="sr-only" role="status">{{ message }} {{ current.title }}. {{ paused ? 'Paused' : 'Playing' }}. </span>
  </div>

  <Teleport to=".desktop">
    <span
      v-for="n in notes"
      :key="n.id"
      class="cd-note"
      :style="n.style"
      aria-hidden="true"
      @animationend="removeNote(n.id)"
    >
      <svg :viewBox="`0 0 ${n.glyph.w} ${n.glyph.h}`" :width="n.glyph.w * 3" :height="n.glyph.h * 3" shape-rendering="crispEdges">
        <path :d="n.glyph.d" fill="currentColor"/>
      </svg>
    </span>
  </Teleport>
</template>
