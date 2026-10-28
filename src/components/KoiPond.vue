<script setup>
// the koi pond (koi-pond.js), as the desktop wallpaper or in its own window in fun stuff.
// a click on the water drops food where it lands. on the desktop a drag is the
// selection box instead, so only a press that barely moves counts as a click. the press
// still carries on to App.vue's marquee
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createKoiPond } from '../koi-pond.js';
import { theme } from '../theme.js';

defineProps({ windowed: Boolean });

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

onMounted(() => { pond = createKoiPond(canvas.value, { dark: theme.value === 'dark', veils }); });
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
function up(event) {
  if (!pressedAt || Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > 5) return;
  const rect = canvas.value.getBoundingClientRect();
  pond?.feed(event.clientX - rect.left, event.clientY - rect.top);
  pressedAt = null;
}
</script>

<template>
  <canvas ref="canvas" class="koi-pond" role="img" :aria-label="`An ASCII koi pond. Click the ${windowed ? 'water' : 'desktop'} to feed the fish.`" @pointerdown="down" @pointermove="move" @pointerup="up"/>
</template>


<style>
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
