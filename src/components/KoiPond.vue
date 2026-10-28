<script setup>
// the koi pond (koi-pond.js), as the desktop wallpaper or in its own window in fun stuff.
// a click on the water drops food where it lands. on the desktop a drag is the
// selection box instead, so only a press that barely moves counts as a click. the press
// still carries on to App.vue's marquee. as a background (behind the fishbowl's chat)
// it takes no clicks itself: whatever is over it passes them on with feedAt and touchAt
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createKoiPond } from '../koi-pond.js';
import { theme } from '../theme.js';

const props = defineProps({
  windowed: Boolean,
  background: Boolean,
  // passed on to createKoiPond: 'msn' for the fishbowl's msn colours, and how many koi
  // there are and how big
  look: { type: String, default: '' },
  count: { type: Number, default: undefined },
  scale: { type: Number, default: 1 },
});

const canvas = ref(null);
let pond;
let pressedAt = null;

// the squares under each desktop shortcut are dimmed so its icon and label stay
// readable, and the fish fade out as they swim up to a window's edge. both follow
// along while they're dragged
function veils() {
  const origin = canvas.value.getBoundingClientRect();
  const boxes = (selector, pad, hollow) => [...canvas.value.parentElement.querySelectorAll(selector)]
    .map(el => el.getBoundingClientRect())
    .filter(rect => rect.width)
    .map(rect => ({ x: rect.left - origin.left - pad.x, y: rect.top - origin.top - pad.y, width: rect.width + pad.x * 2, height: rect.height + pad.y * 2, hollow }));
  return [...boxes('.desktop-shortcut', { x: 7, y: 8 }, false), ...boxes('[data-window]', { x: 0, y: 0 }, true)];
}

onMounted(() => {
  pond = createKoiPond(canvas.value, { dark: theme.value === 'dark', veils, look: props.look, count: props.count, scale: props.scale });
});
onBeforeUnmount(() => pond?.destroy());
watch(theme, value => pond?.setDark(value === 'dark'));

function down(event) {
  pressedAt = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
}
// the mouse trail follows a mouse over the water, a drag included
function move(event) {
  if (event.pointerType !== 'mouse') return;
  const rect = canvas.value.getBoundingClientRect();
  pond?.touch(event.clientX - rect.left, event.clientY - rect.top);
}
// points on the page, from whatever sits over a background pond
function local(clientX, clientY) {
  const rect = canvas.value.getBoundingClientRect();
  return [clientX - rect.left, clientY - rect.top];
}
defineExpose({
  feedAt: (x, y) => pond?.feed(...local(x, y)),
  touchAt: (x, y) => pond?.touch(...local(x, y)),
});
function up(event) {
  if (!pressedAt || Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > 5) return;
  const rect = canvas.value.getBoundingClientRect();
  pond?.feed(event.clientX - rect.left, event.clientY - rect.top);
  pressedAt = null;
}
</script>

<template>
  <canvas v-if="background" ref="canvas" class="koi-pond koi-pond-background" aria-hidden="true"/>
  <canvas v-else ref="canvas" class="koi-pond" role="img" :aria-label="`An ASCII koi pond. Click the ${windowed ? 'water' : 'desktop'} to feed the fish.`" @pointerdown="down" @pointermove="move" @pointerup="up"/>
</template>


<style>
.koi-pond-background {
  pointer-events: none;
}

/* on the pale light mode water the labels go dark so they can still be read */
:root:not([data-theme="dark"]) .koi-pond ~ .desktop-grid .desktop-shortcut {
  color: #1c1b19;
}
:root:not([data-theme="dark"]) .koi-pond ~ .desktop-grid .desktop-shortcut span {
  text-shadow: 1px 1px #fff;
}
:root:not([data-theme="dark"]) .koi-pond ~ .desktop-grid .desktop-shortcut:is(.selected, :focus-visible) span {
  color: #fff;
  text-shadow: none;
}
</style>
