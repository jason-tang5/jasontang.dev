<script setup>
// picks what goes inside each window based on its type. the small apps live
// right here, the bigger ones have their own components.
import { defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue';
import { profile, projects, roles } from '../content.mjs';
import { folders, registry } from '../registry.js';
import { isUnlocked } from '../unlocks.js';
import AsciiImage from './AsciiImage.vue';
import { imageAscii } from '../ascii-density.js';
import Analytics from './Analytics.vue';
import Blog from './Blog.vue';
import Music from './Music.vue';
import Mail from './Mail.vue';
import Pictures from './Pictures.vue';
import Stickies from './Stickies.vue';
import StickyNote from './StickyNote.vue';
import RetroIcon from './RetroIcon.vue';
import InlineText from './InlineText.vue';
import AboutFacts from './AboutFacts.vue';
import TypedRoles from './TypedRoles.vue';
import TechList from './TechList.vue';
import PortfolioFigures from './PortfolioFigures.vue';
import FpgaFigures from './FpgaFigures.vue';
import ReversiFigures from './ReversiFigures.vue';
import LiftLensFigures from './LiftLensFigures.vue';
import MlFigures from './MlFigures.vue';
import MessengerFigures from './MessengerFigures.vue';
import { read, save, remove } from '../storage.js';
import { track } from '../analytics.js';
import { balloonColors, balloonFrames, balloonString } from '../balloon-sprite.js';
import { play, setSoundEnabled, setSoundLevel, soundEnabled, soundLevel } from '../sound.js';
import { theme, setTheme } from '../theme.js';
import { defaultWallpaper, wallpaperFilter, wallpapers } from '../wallpaper.js';
import { autoHide, edges, setAutoHide, setTaskbarEdge, taskbarEdge } from '../taskbar.js';

// a folder's apps, leaving out locked ones (mail) until they're earned
const folderItems = type => folders[type].filter(id => !registry[id].locked || isUnlocked(id));

// the games only load when someone actually opens them
const Game = defineAsyncComponent(() => import('./Game.vue'));
const Chat = defineAsyncComponent(() => import('./Chat.vue'));
const Snake = defineAsyncComponent(() => import('./Snake.vue'));
const Minesweeper = defineAsyncComponent(() => import('./Minesweeper.vue'));
const Reversi = defineAsyncComponent(() => import('./Reversi.vue'));
const Twenty48 = defineAsyncComponent(() => import('./Twenty48.vue'));
const Terminal = defineAsyncComponent(() => import('./Terminal.vue'));
// the interactive figures in a project's writeup, by name (content.mjs, figures)
const figureFor = { desktop: PortfolioFigures, apps: PortfolioFigures, stack: PortfolioFigures, live: PortfolioFigures, register: FpgaFigures, datapath: FpgaFigures, slide: FpgaFigures, fsm: FpgaFigures, board: ReversiFigures, weights: ReversiFigures, eval: ReversiFigures, lookahead: ReversiFigures, angles: LiftLensFigures, plate: LiftLensFigures, smooth: LiftLensFigures, reps: LiftLensFigures, hips: LiftLensFigures, train: MlFigures, graph: MlFigures, tiles: MlFigures, epsilon: MlFigures, lobby: MessengerFigures, sleep: MessengerFigures, checks: MessengerFigures, retry: MessengerFigures };
// a project's why i built it, what i built and implementation sections as one list of
// items: a string is a paragraph, an array a paragraph mixing text with { open, text }
// links to other windows, then { heading }, { subheading }, { figure }, { list }
// (numbered, or bulleted with bullets: true) and { table } (rows, the first one the
// header). paragraphs, list points and table cells can use **bold**
// and the rest of InlineText. why, contribution and implementation can each be one string
// or a list of items. the lead figure goes at the top of what i built unless contribution
// places it itself
const figureItems = f => [f ?? []].flat().map(figure => ({ figure }));
function writeup(p) {
  const built = [p.contribution ?? []].flat();
  const lead = built.some(item => item.figure === p.figures?.lead) ? [] : figureItems(p.figures?.lead);
  return [
    ...(p.why ? [{ heading: 'Why I built it' }, ...[p.why].flat()] : []),
    ...(built.length ? [{ heading: 'What I built' }, ...lead, ...built, ...figureItems(p.figures?.built)] : []),
    { heading: p.implementationTitle ?? 'Implementation' },
    ...[p.implementation].flat(),
    ...figureItems(p.figures?.implementation),
  ];
}

defineProps({
  win: Object,
  active: Boolean,
  wallpaper: String,
  visible: Boolean,
});
const emit = defineEmits(['open', 'close', 'unlock', 'wallpaper']);

const selected = ref(projects[0]);
// the preview's back and next buttons step through the files, wrapping at the ends
function stepProject(by) {
  const i = projects.findIndex(p => p.id === selected.value.id);
  selected.value = projects[(i + by + projects.length) % projects.length];
}
const favoritesStrip = ref(null);
const favoritesLeft = ref(false);
const favoritesRight = ref(false);
const favoritesScroll = ref(0);
const favoritesScrollMax = ref(0);
const favoritesThumb = ref(100);
function updateFavoritesScroll() {
  const strip = favoritesStrip.value;
  if (!strip) return;
  favoritesScroll.value = strip.scrollLeft;
  favoritesScrollMax.value = Math.max(0, strip.scrollWidth - strip.clientWidth);
  favoritesThumb.value = Math.max(20, strip.clientWidth / strip.scrollWidth * 100);
  favoritesLeft.value = strip.scrollLeft > 1;
  favoritesRight.value = strip.scrollLeft < strip.scrollWidth - strip.clientWidth - 1;
}
watch(favoritesStrip, (strip, _, onCleanup) => {
  if (!strip) return;
  const observer = new ResizeObserver(updateFavoritesScroll);
  observer.observe(strip);
  updateFavoritesScroll();
  onCleanup(() => observer.disconnect());
}, { flush: 'post' });
function scrollFavorites(direction) {
  favoritesStrip.value?.scrollBy({
    left: direction * favoritesStrip.value.clientWidth * 0.75,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}

// the volume in desktop settings, kept in step with the taskbar's speaker
const sound = ref(soundEnabled());
const level = ref(soundLevel());
function soundChanged(event) {
  sound.value = event.detail.enabled;
  level.value = event.detail.level;
}
addEventListener('site-sound', soundChanged);
onBeforeUnmount(() => removeEventListener('site-sound', soundChanged));
// the about window's side pane, each place with the path it'd have on the computer.
// hovering one shows its path in the address bar, like explorer
const places = [
  {
    title: 'Favorites',
    star: true,
    items: [
      { id: 'projects', path: 'Portfolio:\\Projects' },
      { id: 'resume', path: 'Portfolio:\\Jason_Tang_Resume.pdf' },
      { id: 'experience', path: 'Portfolio:\\Experience.txt' },
      { id: 'blog', path: 'Portfolio:\\Blog' },
    ],
  },
  {
    title: 'Other places',
    items: [
      { id: 'games', path: 'Portfolio:\\Games' },
      { id: 'music', path: 'Portfolio:\\Fun Stuff\\CD Player' },
      { id: 'pictures', path: 'Portfolio:\\Fun Stuff\\My Pictures' },
      { id: 'chat', path: 'Portfolio:\\MSN Messenger' },
      { id: 'analytics', path: 'Portfolio:\\Analytics' },
    ],
  },
];
const hoveredPlace = ref(null);

// the projects folder shows its files as large icons or as a details list
const projectViews = [
  { id: 'icons', label: 'Large icons', glyph: 'M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9zM2 2v4h4V2zM10 2v4h4V2zM2 10v4h4v-4zM10 10v4h4v-4z' },
  { id: 'details', label: 'Details', glyph: 'M1 2h3v3H1zM6 3h9v1H6zM1 7h3v3H1zM6 8h9v1H6zM1 12h3v3H1zM6 13h9v1H6z' },
];
// in the details list on a touchscreen a double tap only picks the file, since the
// rows are close enough to open one by accident. the preview's view project button
// opens it
let lastPointer = '';
function openOnDoubleClick(p) {
  if (lastPointer === 'touch' && projectView.value === 'details') return;
  emit('open', p.id);
}
const projectView = ref(read('projects-view', 'icons') === 'details' ? 'details' : 'icons');
function setProjectView(view) {
  projectView.value = view;
  save('projects-view', view);
}

// the details view's columns can be dragged wider or narrower by their header edges.
// until one is dragged they squeeze to fit the pane, after that every column keeps
// its own width and the pane scrolls if it runs out. an empty last column holds the
// row's open button so it never sits on top of the type
let savedColumns = null;
try { savedColumns = JSON.parse(read('projects-columns', 'null')); } catch { /* keep the defaults */ }
const columns = ref(savedColumns?.name ? savedColumns : null);
const detailsHeader = ref(null);
function detailsColumns() {
  const c = columns.value;
  return c
    ? `24px ${c.name}px ${c.date}px ${c.kind}px minmax(64px, 1fr)`
    : '24px minmax(90px, 1fr) minmax(0, 112px) minmax(0, 100px) 64px';
}
function resizeColumn(key, event) {
  // pin every column to its current width so dragging one doesn't reflow the others.
  // the name header also spans the icon column
  if (!columns.value) {
    const [name, date, kind] = [...detailsHeader.value.children].map(el => el.getBoundingClientRect().width);
    columns.value = { name: Math.round(name - 24), date: Math.round(date), kind: Math.round(kind) };
  }
  const start = columns.value[key];
  const x = event.clientX;
  const handle = event.currentTarget;
  handle.setPointerCapture(event.pointerId);
  const move = e => {
    columns.value[key] = Math.max(40, Math.round(start + e.clientX - x));
  };
  const end = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    save('projects-columns', JSON.stringify(columns.value));
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}
// the line between the preview and the files drags like the details columns, and
// the width it's left at is remembered
const explorer = ref(null);
const previewWidth = ref(Number(read('projects-preview', '0')) || null);
function resizePreview(event) {
  const start = event.currentTarget.parentElement.getBoundingClientRect().width;
  const x = event.clientX;
  const handle = event.currentTarget;
  handle.setPointerCapture(event.pointerId);
  const move = e => {
    const room = explorer.value.clientWidth - 160;
    previewWidth.value = Math.round(Math.max(180, Math.min(room, start + e.clientX - x)));
  };
  const end = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    save('projects-preview', String(previewWidth.value));
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}
const resumeUrl =`${import.meta.env.BASE_URL}assets/Jason_Tang_Resume.pdf`;
const portraitUrl = new URL('../../assets/profile.jpg', import.meta.url).href;
const portraitHint = ref(true);
const portraitAscii = imageAscii;
// the portrait's ascii / normal buttons, sliders and reset sit in a toolbar over it,
// like my pictures' toolbar, instead of on the photo
const portraitControls = ref(null);
// on a touchscreen the hint points at the hammer, since a finger has to pick it up
// before it can smash letters. without the hammer it sits on the photo instead
const portraitFrame = ref(null);
const hintAt = ref(null);
function placeHint() {
  const hammer = portraitControls.value?.querySelector('.hammer-toggle');
  if (!portraitHint.value || !hammer?.getClientRects().length || !portraitFrame.value) {
    hintAt.value = null;
    return;
  }
  const frame = portraitFrame.value.getBoundingClientRect();
  const box = hammer.getBoundingClientRect();
  hintAt.value = { left: `${Math.max(4, box.left - frame.left + box.width / 2 - 18)}px`, top: `${box.bottom - frame.top + 9}px` };
}
const hintObserver = new ResizeObserver(placeHint);
watch(portraitFrame, (frame, old) => {
  if (old) hintObserver.unobserve(old);
  if (frame) hintObserver.observe(frame);
});
watch(portraitControls, controls => controls && hintObserver.observe(controls));
onBeforeUnmount(() => hintObserver.disconnect());


function setPortraitAscii(value) {
  portraitHint.value = false;
  portraitAscii.value = value;
}

// ---- balloons: the button at the end of the shortcuts toolbar lets a bunch of pixel balloons float up
// over the whole about window (the sprite is in balloon-sprite.js) ----
const aboutApp = ref(null);
const balloons = ref([]);
let balloonId = 0;
function launchBalloons() {
  // reduced motion stops every animation, so they'd never float up. say why instead of
  // letting them sit invisible under the window
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.dispatchEvent(new CustomEvent('site-notice', { detail: {
      title: 'No balloons?',
      message: 'They need motion to float up. Turn off Reduce motion in your device settings to see them.',
    } }));
    return;
  }
  play('balloons');
  const rise = (aboutApp.value?.offsetHeight ?? 600) + 120;
  const count = 7;
  const batch = Array.from({ length: count }, (_, i) => {
    const [color, dark] = balloonColors[Math.floor(Math.random() * balloonColors.length)];
    return {
      id: ++balloonId, color, dark,
      style: {
        left: `${(i / count) * 88 + Math.random() * 6}%`,
        '--rise': `${rise}px`,
        '--scale': 4 + Math.floor(Math.random() * 2),
        animationDuration: `${3.2 + Math.random() * 2.4}s`,
        animationDelay: `${Math.random() * 0.9}s`,
      },
      // each one starts somewhere different in its sway, at its own pace
      sway: { '--sway-time': `${4.4 + Math.random() * 1.4}s`, '--phase': `${-Math.random() * 2}s` },
    };
  });
  balloons.value = [...balloons.value, ...batch];
  if (!balloonWatch) balloonWatch = requestAnimationFrame(watchBalloons);
}
// the pieces a popped balloon bursts into, flying out from the middle
const balloonShards = 'M7 0h2v2H7zM7 14h2v2H7zM0 7h2v2H0zM14 7h2v2h-2zM2 2h2v2H2zM12 2h2v2h-2zM2 12h2v2H2zM12 12h2v2h-2zM5 4h1v1H5zM10 4h1v1h-1zM4 10h1v1H4zM11 11h1v1h-1z';
// a press anywhere over the window checks every balloon, with a hit box a bit bigger
// than the balloon's body, and pops the nearest one under it, one per click. it stops
// where it is and bursts, and goes once the burst is done
const balloonReach = 14;
let swallowClick = false;
function balloonsAt(x, y) {
  const hits = [];
  if (!aboutApp.value) return hits;
  for (const el of aboutApp.value.querySelectorAll('.balloon:not(.popped)')) {
    const r = el.querySelector('svg').getBoundingClientRect();
    // the body is the top 15 of the sprite's 24 rows, the string isn't worth a pop
    const bottom = r.top + r.height * (15 / 24);
    if (x >= r.left - balloonReach && x <= r.right + balloonReach && y >= r.top - balloonReach && y <= bottom + balloonReach) {
      hits.push({ id: Number(el.dataset.id), distance: Math.hypot(x - (r.left + r.right) / 2, y - (r.top + bottom) / 2) });
    }
  }
  // nearest first
  return hits.sort((a, b) => a.distance - b.distance).map(h => h.id);
}
// the pointer turns to a hand over a balloon. they move under a still pointer too, so
// it's checked every frame while any are up
const overBalloon = ref(false);
let pointerAt = null;
let balloonWatch = 0;
function watchBalloons() {
  overBalloon.value = !!pointerAt && balloonsAt(pointerAt.x, pointerAt.y).length > 0;
  balloonWatch = balloons.value.length ? requestAnimationFrame(watchBalloons) : 0;
  if (!balloonWatch) overBalloon.value = false;
}
function trackBalloonPointer(event) {
  pointerAt = event.type === 'pointerleave' ? null : { x: event.clientX, y: event.clientY };
}
onBeforeUnmount(() => cancelAnimationFrame(balloonWatch));
function popBalloons(event) {
  swallowClick = false;
  if (!balloons.value.length || event.button !== 0) return;
  const [hit] = balloonsAt(event.clientX, event.clientY);
  if (hit === undefined) return;
  // the press was for the balloons, not whatever is under them
  event.preventDefault();
  event.stopPropagation();
  swallowClick = true;
  balloons.value.find(b => b.id === hit).popped = true;
  play('pop');
  track('balloon-pop');
  save('balloons-popped', String((Number(read('balloons-popped', '0')) || 0) + 1));
}
// and the click that follows it, so a link or button under a balloon doesn't go off too
function swallowBalloonClick(event) {
  if (!swallowClick) return;
  swallowClick = false;
  event.preventDefault();
  event.stopPropagation();
}
function balloonDone(event, id) {
  if (/balloon-(rise|pop)/.test(event.animationName)) balloons.value = balloons.value.filter(b => b.id !== id);
}

</script>

<template>
  <!-- about -->
  <div v-if="win.type === 'about'" ref="aboutApp" class="app-layout about-app" :class="{ 'over-balloon': overBalloon }"
    @pointerdown.capture="popBalloons" @click.capture="swallowBalloonClick" @pointermove="trackBalloonPointer" @pointerleave="trackBalloonPointer">
    <div class="balloon-sky" aria-hidden="true">
      <span v-for="b in balloons" :key="b.id" class="balloon" :class="{ popped: b.popped }" :data-id="b.id" :style="b.style" @animationend="balloonDone($event, b.id)">
        <svg v-if="b.popped" class="balloon-burst" viewBox="0 0 16 16" shape-rendering="crispEdges">
          <path :d="balloonShards" :fill="b.color"/>
        </svg>
        <svg v-else viewBox="0 0 14 24" shape-rendering="crispEdges" :style="b.sway">
          <g v-for="(f, k) in balloonFrames" :key="k" :class="['balloon-frame', `f${k}`]">
            <path :d="f.outline" :fill="b.dark"/>
            <path :d="f.fill" :fill="b.color"/>
            <path :d="f.shine" fill="#fff" fill-opacity=".75"/>
            <path :d="f.knot" :fill="b.dark"/>
            <path :d="f.string" :fill="balloonString"/>
          </g>
        </svg>
      </span>
    </div>
    <div class="address-bar">
      <span>Address</span>
      <div class="inset">{{ hoveredPlace?.path || 'Portfolio:\\About Me' }}</div>
    </div>
    <div class="about-explorer">
      <!-- the left pane of an explorer window, like browsing my computer to get to things -->
      <div class="about-favorites-pane">
      <nav ref="favoritesStrip" class="about-favorites inset" aria-label="Favorites" @scroll.passive="updateFavoritesScroll">
        <template v-for="group in places" :key="group.title">
          <p class="favorites-head" aria-hidden="true">
            <svg v-if="group.star" viewBox="0 0 16 16"><path d="M7 1h2v4h5v2h-1v1h-1v1h-1v2h1v4h-1v-1h-1v-1H9v-1H7v1H6v1H5v1H4v-4h1V9H4V8H3V7H2V5h5z"/></svg>
            <RetroIcon v-else name="computer" small/>
            {{ group.title }}
          </p>
          <button
            v-for="place in group.items"
            :key="place.id"
            class="favorite"
            :title="place.path"
            @click="emit('open', place.id)"
            @pointerenter="hoveredPlace = place"
            @pointerleave="hoveredPlace = null"
            @focus="hoveredPlace = place"
            @blur="hoveredPlace = null"
          >
            <RetroIcon :name="registry[place.id].icon" small/>
            <span>{{ registry[place.id].label }}</span>
          </button>
        </template>
      </nav>
      <div v-if="favoritesLeft || favoritesRight" class="favorites-scroll-cue">
        <button class="raised" aria-label="Scroll shortcuts left" :disabled="!favoritesLeft" @click="scrollFavorites(-1)"><svg viewBox="0 0 7 7" aria-hidden="true" shape-rendering="crispEdges"><path d="M4 0h1v7H4zM3 1h1v5H3zM2 2h1v3H2zM1 3h1v1H1z"/></svg></button>
        <input class="favorites-scroll-track" type="range" aria-label="Scroll shortcuts"
          min="0" :max="favoritesScrollMax" :value="favoritesScroll"
          :style="{ '--scroll-thumb': `${favoritesThumb}%` }"
          @input="favoritesStrip.scrollLeft = Number($event.target.value)">
        <button class="raised" aria-label="Scroll shortcuts right" :disabled="!favoritesRight" @click="scrollFavorites(1)"><svg viewBox="0 0 7 7" aria-hidden="true" shape-rendering="crispEdges"><path d="M2 0h1v7H2zM3 1h1v5H3zM4 2h1v3H4zM5 3h1v1H5z"/></svg></button>
      </div>
      </div>
      <div class="content-scroll about-content">
        <!-- linkedin, github, contact and the cd player as toolbar icons in the top right.
             each has its own hover: linkedin's letters bounce with a ping, the octocat wags
             its tail and meows, the envelope wiggles with a paper swish, and the cd spins,
             plays a tune and puffs out notes -->
        <div class="about-shortcuts raised">
          <a class="about-shortcut ie-button" :href="profile.links.linkedin" target="_blank" rel="noopener" title="LinkedIn (opens in a new tab)" @pointerenter="play('ping')">
            <RetroIcon name="linkedin"/>
            <span>LinkedIn</span>
          </a>
          <a class="about-shortcut ie-button" :href="profile.links.github" target="_blank" rel="noopener" title="GitHub (opens in a new tab)" @pointerenter="play('meow')">
            <RetroIcon name="github"/>
            <span>GitHub</span>
          </a>
          <button class="about-shortcut ie-button about-contact" @pointerenter="play('letter')" @click="emit('open', 'contact')">
            <RetroIcon name="contact"/>
            <span>Contact</span>
          </button>
          <!-- the balloons are just for fun, so a groove keeps them apart from the links -->
          <span class="toolbar-separator" aria-hidden="true"/>
          <button class="about-shortcut ie-button about-balloons" title="Let go of some balloons" @click="launchBalloons">
            <RetroIcon name="balloon"/>
            <span>Balloons</span>
          </button>
        </div>
        <div class="about-grid">
          <div ref="portraitFrame" class="portrait-frame inset" @pointerdown.capture="portraitHint = false">
            <div ref="portraitControls" class="pictures-controls portrait-toolbar"/>
            <span v-if="portraitHint" class="portrait-hint" :class="{ pointing: hintAt }" :style="hintAt">Tap to flip me!</span>
            <AsciiImage
              class="portrait-ascii"
              :source="portraitUrl"
              description="Jason in a golden mirrored room"
              :enabled="portraitAscii"
              :visible="visible"
              :controls-to="portraitControls"
              tidy
              @update:enabled="setPortraitAscii"
            />
          </div>
          <div class="about-copy">
            <h1>{{ profile.name }}</h1>
            <TypedRoles :words="profile.roles" :visible="visible"/>
            <p class="intro">{{ profile.intro }}</p>
            <p class="intro">{{ profile.bio }}</p>
            <!-- a few quick facts under an etched line -->
            <section class="about-facts-section" aria-labelledby="about-facts-heading">
              <h2 id="about-facts-heading">About me</h2>
              <nav class="about-links" aria-label="More about me">
                <button v-for="id in ['projects', 'resume', 'experience', 'terminal']" :key="id" class="about-link raised" @click="emit('open', id)">
                  <RetroIcon :name="registry[id].icon" small/>
                  <span>{{ registry[id].label }}</span>
                </button>
              </nav>
              <AboutFacts :facts="profile.facts"/>
              <!-- what i'm building right now, the clean from the liftlens writeup -->
              <LiftLensFigures figure="angles" compact>
                <template #caption><strong>Currently building</strong> <button class="crumb-back" @click="emit('open', 'liftlens')">LiftLens</button> · 100kg @ 1.3m/s</template>
              </LiftLensFigures>
            </section>
          </div>
        </div>
      </div>
    </div>
    <footer class="status-bar">
      <span>{{ hoveredPlace ? registry[hoveredPlace.id].label : 'About Me' }}</span>
      <span>{{ projects.length }} projects</span>
    </footer>
  </div>

  <!-- projects folder, explorer style: the selected file's details on the left,
       the files as big icons on the right like a my computer folder -->
  <div v-else-if="win.type === 'projects'" class="app-layout">
    <div class="toolbar explorer-toolbar">
      <div class="explorer-folder inset" aria-hidden="true">
        <RetroIcon name="folder" small/>
        <span>Projects</span>
      </div>
      <span class="toolbar-separator" aria-hidden="true"/>
      <!-- large icons or details, like the view buttons on a windows 95 folder -->
      <div class="view-toggle" role="group" aria-label="View">
        <button
          v-for="v in projectViews"
          :key="v.id"
          class="raised view-button"
          :class="{ pressed: projectView === v.id }"
          :aria-pressed="projectView === v.id"
          :aria-label="v.label"
          :title="v.label"
          @click="setProjectView(v.id)"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path :d="v.glyph" fill="currentColor" fill-rule="evenodd"/></svg>
        </button>
      </div>
    </div>
    <div class="address-bar">
      <span>Address</span>
      <div class="inset address-with-icon"><RetroIcon name="folder" small/>Portfolio:\Projects</div>
    </div>
    <div ref="explorer" class="project-explorer content-scroll inset" :style="previewWidth ? { '--preview-width': `${previewWidth}px` } : null">
      <aside class="project-preview">
        <div class="preview-steps" role="group" aria-label="Project navigation">
          <button @click="stepProject(-1)">← Back</button>
          <span>{{ projects.findIndex(p => p.id === selected.id) + 1 }} / {{ projects.length }}</span>
          <button @click="stepProject(1)">Next →</button>
        </div>
        <div class="preview-title">
          <RetroIcon :name="selected.icon"/>
          <div>
            <h2>{{ selected.name }}</h2>
            <time>{{ selected.date }}</time>
          </div>
        </div>
        <p>{{ selected.summary }}</p>
        <div class="preview-actions">
          <small><TechList :items="selected.tech" chips/></small>
          <button class="raised tinted" @click="emit('open', selected.id)">View project</button>
        </div>
        <!-- the project's first figure, the same one that opens its what i built -->
        <component :is="figureFor[f]" v-for="f in [selected.figures?.lead ?? []].flat().slice(0, 1)" :key="selected.id + f" :figure="f" @open="id => emit('open', id)"/>
        <i class="preview-resize" aria-hidden="true" @pointerdown.prevent="resizePreview"/>
      </aside>
      <div
        :class="projectView === 'details' ? ['project-details', { 'fixed-columns': columns }] : 'project-icons'"
        :style="projectView === 'details' ? { '--details-columns': detailsColumns() } : null"
        role="group"
        aria-label="Projects"
      >
        <div v-if="projectView === 'details'" ref="detailsHeader" class="list-header" aria-hidden="true">
          <span>Name<i class="col-resize" @pointerdown.prevent="resizeColumn('name', $event)"/></span>
          <span>Modified<i class="col-resize" @pointerdown.prevent="resizeColumn('date', $event)"/></span>
          <span>Type<i class="col-resize" @pointerdown.prevent="resizeColumn('kind', $event)"/></span>
          <span class="col-filler"/>
        </div>
        <!-- hovering a file (or selecting it) shows an open button under its name -->
        <div v-for="p in projects" :key="p.id" :class="['project-item', { selected: selected.id === p.id }]">
          <button
            class="project-file"
            :aria-pressed="selected.id === p.id"
            :title="projectView === 'details' ? null : p.kind"
            @pointerdown="lastPointer = $event.pointerType"
            @click="selected = p"
            @dblclick="openOnDoubleClick(p)"
            @keydown.enter.prevent="emit('open', p.id)"
          >
            <RetroIcon :name="p.icon" :small="projectView === 'details'"/>
            <span>{{ p.name }}</span>
            <template v-if="projectView === 'details'">
              <small class="col-date">{{ p.date }}</small>
              <small class="col-kind">{{ p.kind }}</small>
            </template>
          </button>
          <button class="row-open raised" :title="`Open ${p.name} in its own window`" @click="emit('open', p.id)">
            Open<span class="sr-only"> {{ p.name }}</span>
          </button>
        </div>
      </div>
    </div>
    <footer class="status-bar"><span>{{ selected.name }} · {{ selected.kind }}</span><span>{{ projects.length }} objects</span></footer>
  </div>

  <!-- a single project -->
  <div v-else-if="win.type === 'project'" class="app-layout">
    <div class="toolbar ie-toolbar">
      <button class="ie-button" title="Back to the projects folder" @click="emit('open', 'projects')">
        <RetroIcon name="folder"/>
        <span>All projects</span>
      </button>
      <a v-if="win.project.demo" class="ie-button icon-button" :href="win.project.demo" target="_blank" rel="noopener" title="Try the live demo in a new tab">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path class="page" d="M1 3h9v12H1z"/><path d="M1 3h9v1H1zM1 14h9v1H1zM1 3h1v12H1zM9 9h1v6H9zM3 6h4v1H3zM3 8h3v1H3zM3 10h4v1H3z"/><path class="accent" d="M9 1h6v6h-1V3h-1v1h-1v1h-1v1h-1v1H9V6h1V5h1V4h1V3h1V2H9z"/></svg>
        <span>Open demo</span>
      </a>
      <!-- projects that have a playable version in the games folder -->
      <button v-if="win.project.game" class="ie-button" :title="`Play ${registry[win.project.game].label} in the Games folder`" @click="emit('open', win.project.game)">
        <RetroIcon :name="registry[win.project.game].icon"/>
        <span>Play it</span>
      </button>
      <!-- projects that are an app on this desktop -->
      <button v-if="win.project.app" class="ie-button" :title="`Open ${registry[win.project.app].label} on the desktop`" @click="emit('open', win.project.app)">
        <RetroIcon :name="registry[win.project.app].icon"/>
        <span>Try it</span>
      </button>
    </div>
    <article class="content-scroll document pixel-headings">
      <!-- a breadcrumb back up to the folder, so the way back is in the page too -->
      <p class="eyebrow"><button class="crumb-back" title="Back to the projects folder" @click="emit('open', 'projects')">← Projects</button> / {{ win.project.kind }}<template v-if="win.project.date"> / {{ win.project.date }}</template></p>
      <h1>{{ win.project.name }}</h1>
      <p class="intro">{{ win.project.summary }}</p>
      <p class="tech-line"><TechList :items="win.project.tech" chips/></p>
      <!-- see writeup() for what each item can be -->
      <template v-for="(item, i) in writeup(win.project)" :key="i">
        <h2 v-if="item.heading">{{ item.heading }}</h2>
        <h3 v-else-if="item.subheading">{{ item.subheading }}</h3>
        <component :is="figureFor[item.figure]" v-else-if="item.figure" :figure="item.figure" @open="id => emit('open', id)"/>
        <component :is="item.bullets ? 'ul' : 'ol'" v-else-if="item.list"><li v-for="point in item.list" :key="point"><InlineText :text="point"/></li></component>
        <div v-else-if="item.table" class="blog-table"><table>
          <thead><tr><th v-for="cell in item.table[0]" :key="cell" scope="col">{{ cell }}</th></tr></thead>
          <tbody><tr v-for="(row, r) in item.table.slice(1)" :key="r"><td v-for="(cell, c) in row" :key="c"><InlineText :text="cell"/></td></tr></tbody>
        </table></div>
        <p v-else-if="Array.isArray(item)"><template v-for="(part, j) in item" :key="j">
          <button v-if="part.open" class="crumb-back" @click="emit('open', part.open)">{{ part.text }}</button><InlineText v-else :text="part"/>
        </template></p>
        <p v-else><InlineText :text="item"/></p>
      </template>
      <template v-if="win.project.outcomes">
        <h2>Results</h2>
        <ul>
          <li v-for="outcome in win.project.outcomes" :key="outcome">{{ outcome }}</li>
        </ul>
        <component :is="figureFor[f]" v-for="f in [win.project.figures?.results ?? []].flat()" :key="f" :figure="f" @open="id => emit('open', id)"/>
      </template>
      <template v-if="win.project.lessons">
        <h2>{{ win.project.lessonsTitle ?? 'Lessons learned' }}</h2>
        <p v-for="paragraph in [win.project.lessons].flat()" :key="paragraph">{{ paragraph }}</p>
      </template>
      <aside v-if="win.project.funFact" class="fun-fact"><strong>Fun fact</strong><p>{{ win.project.funFact }}</p></aside>
    </article>
    <footer class="status-bar"><span>Project information</span><span>{{ win.project.tech[0] }}</span></footer>
  </div>

  <!-- experience -->
  <div v-else-if="win.type === 'experience'" class="app-layout">
    <div class="toolbar"><RetroIcon name="document" small/><span>Experience.txt</span></div>
    <article class="content-scroll document pixel-headings">
      <p class="eyebrow">WORK & EDUCATION</p>
      <h1>Experience</h1>
      <section v-for="role in roles" :key="role.company" class="role">
        <p class="role-date">{{ role.dates }} · {{ role.location }}</p>
        <h2>{{ role.company }}</h2>
        <strong>{{ role.role }}</strong>
        <ul>
          <li v-for="bullet in role.bullets" :key="bullet"><InlineText :text="bullet" /></li>
        </ul>
      </section>
      <section class="role">
        <h2>University of Toronto</h2>
        <p>{{ profile.education }}</p>
        <h3>Tools I’ve worked with</h3>
        <p><TechList :items="profile.skills" chips/></p>
      </section>
    </article>
    <footer class="status-bar"><span>{{ roles.length }} roles</span><span>Jason Tang</span></footer>
  </div>

  <!-- resume pdf -->
  <div v-else-if="win.type === 'resume'" class="app-layout">
    <div class="toolbar ie-toolbar">
      <a class="ie-button icon-button" :href="resumeUrl" target="_blank" rel="noopener" title="Open PDF in a new tab">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path class="page" d="M1 3h9v12H1z"/><path d="M1 3h9v1H1zM1 14h9v1H1zM1 3h1v12H1zM9 9h1v6H9zM3 6h4v1H3zM3 8h3v1H3zM3 10h4v1H3z"/><path class="accent" d="M9 1h6v6h-1V3h-1v1h-1v1h-1v1h-1v1H9V6h1V5h1V4h1V3h1V2H9z"/></svg>
        <span>Open PDF</span>
      </a>
      <a class="ie-button icon-button" :href="resumeUrl" download="Jason_Tang_Resume.pdf" title="Download PDF">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path class="accent" d="M7 1h2v7h2v1h-1v1H9v1H7v-1H6V9H5V8h2z"/><path d="M1 10h1v4h12v-4h1v5H1z"/></svg>
        <span>Download</span>
      </a>
    </div>
    <object class="resume-viewer" :data="resumeUrl" type="application/pdf" aria-label="Jason Tang resume">
      <p>Your browser cannot display this PDF. <a :href="resumeUrl">Open PDF</a>.</p>
    </object>
  </div>

  <Game v-else-if="win.type === 'contact'" :active="active" @unlock="(id, message) => emit('unlock', id, message)" @open="id => emit('open', id)"/>
  <Mail v-else-if="win.type === 'mail'"/>
  <Music v-else-if="win.type === 'music'" :win="win"/>
  <Pictures v-else-if="win.type === 'pictures'" :visible="visible"/>
  <Analytics v-else-if="win.type === 'analytics'"/>
  <Blog v-else-if="win.type === 'blog'"/>
  <Chat v-else-if="win.type === 'chat'"/>
  <Terminal v-else-if="win.type === 'terminal'" :visible="visible" :active="active" @open="id => emit('open', id)" @close="id => emit('close', id)"/>
  <!-- the games, fun stuff and all apps folders: a big icon for each app inside -->
  <div v-else-if="folders[win.type]" class="app-layout">
    <div class="address-bar"><span>Address</span><div class="inset">{{ win.type === 'computer' ? 'All Apps' : `Portfolio:\\${win.label}` }}</div></div>
    <div class="content-scroll games-folder inset">
      <button v-for="id in folderItems(win.type)" :key="id" class="game-shortcut" @click="emit('open', id)">
        <RetroIcon :name="registry[id].icon"/><span>{{ registry[id].label }}</span>
      </button>
    </div>
    <footer class="status-bar"><span>{{ folderItems(win.type).length }} {{ win.type === 'games' ? 'games' : 'items' }}</span></footer>
  </div>
  <Snake v-else-if="win.type === 'snake'" :active="active" @open="id => emit('open', id)"/>
  <Minesweeper v-else-if="win.type === 'minesweeper'" :active="active" :win="win" @open="id => emit('open', id)"/>
  <Reversi v-else-if="win.type === 'reversi'" :active="active" @open="id => emit('open', id)"/>
  <Twenty48 v-else-if="win.type === '2048'" :active="active" @open="id => emit('open', id)"/>

  <!-- desktop settings -->
  <div v-else-if="win.type === 'settings'" class="app-layout">
    <div class="content-scroll settings-content">
      <h1>Desktop Settings</h1>
      <div class="monitor-preview inset">
        <span class="wallpaper-tone" :style="{ '--tone-filter': wallpaperFilter(wallpaper), backgroundColor: wallpaper }"/>
        <RetroIcon name="computer"/>
        <span>Jason’s desktop</span>
      </div>
      <fieldset>
        <legend>Appearance</legend>
        <div class="theme-choices" role="group" aria-label="Color theme">
          <button
            v-for="mode in ['light', 'dark']"
            :key="mode"
            class="raised"
            :class="{ pressed: theme === mode }"
            :aria-pressed="theme === mode"
            @click="setTheme(mode)"
          >
            <RetroIcon :name="mode === 'light' ? 'sun' : 'moon'" small/>
            {{ mode === 'light' ? 'Light' : 'Dark' }}
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Desktop color</legend>
        <div class="swatches">
          <button
            v-for="{ label, color, filter } in wallpapers"
            :key="color"
            class="swatch raised"
            :aria-label="label"
            :aria-pressed="wallpaper === color"
            :title="label"
            @click="emit('wallpaper', color)"
          >
            <span class="wallpaper-tone" :style="{ '--tone-filter': filter, backgroundColor: color }"/>
            <span v-if="wallpaper === color">✓</span>
          </button>
        </div>
        <button class="raised settings-reset" @click="emit('wallpaper', defaultWallpaper)">Reset wallpaper</button>
      </fieldset>
      <fieldset>
        <legend>Sound</legend>
        <div class="settings-volume">
          <RetroIcon :name="sound && level ? 'sound' : 'mute'" small/>
          <input
            type="range"
            min="0"
            max="100"
            :value="level"
            aria-label="Volume"
            :disabled="!sound"
            @input="setSoundLevel(Number($event.target.value))"
          >
          <span class="settings-volume-level">{{ sound ? level : 'Off' }}</span>
        </div>
        <label class="settings-check">
          <input type="checkbox" :checked="!sound" @change="setSoundEnabled(!$event.target.checked)">
          Mute
        </label>
      </fieldset>
      <fieldset>
        <legend>Taskbar</legend>
        <!-- phones always keep it at the bottom, so the edge choice is desktop only -->
        <div class="taskbar-edges" role="group" aria-label="Taskbar position">
          <button
            v-for="e in edges"
            :key="e.id"
            class="raised"
            :class="{ pressed: taskbarEdge === e.id }"
            :aria-pressed="taskbarEdge === e.id"
            @click="taskbarEdge !== e.id && setTaskbarEdge(e.id)"
          >
            <svg viewBox="0 0 12 10" aria-hidden="true">
              <path class="taskbar-edge-screen" d="M0 0h12v10H0z"/>
              <path class="taskbar-edge-bar" :d="{ bottom: 'M0 8h12v2H0z', top: 'M0 0h12v2H0z', left: 'M0 0h2v10H0z', right: 'M10 0h2v10h-2z' }[e.id]"/>
            </svg>
            {{ e.label }}
          </button>
        </div>
        <label class="settings-check">
          <input type="checkbox" :checked="autoHide" @change="setAutoHide($event.target.checked)">
          Automatically hide the taskbar
        </label>
      </fieldset>
    </div>
    <footer class="status-bar"><span>Display properties</span></footer>
  </div>

  <Stickies v-else-if="win.type === 'stickies'" @open="id => emit('open', id)" @close="id => emit('close', id)"/>
  <StickyNote v-else-if="win.type === 'sticky'" :win="win" @open="id => emit('open', id)" @close="id => emit('close', id)"/>
</template>
