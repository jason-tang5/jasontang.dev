<script setup>
import { ref } from 'vue';
import KoiPond from './KoiPond.vue';
import { useInView } from '../in-view.js';

defineProps({ preview: Boolean });
const root = ref(null);
const visible = useInView(root);
const pond = ref(null);
function stir(event) {
  if (event.pointerType === 'mouse') pond.value?.touchAt(event.clientX, event.clientY);
}
</script>

<template>
  <figure ref="root" class="fishbowl-figure" :class="{ 'fishbowl-preview': preview }">
    <div class="fishbowl-water" @pointermove="stir" @click="pond?.feedAt($event.clientX, $event.clientY)">
      <KoiPond v-if="visible" ref="pond" background look="msn" :count="5" :scale="0.7" veil=".fishbowl-label"/>
      <div class="fishbowl-label">
        <strong>Fishbowl</strong>
        <span>A little pond for big thoughts.</span>
      </div>
      <span v-if="!preview" class="fishbowl-hint">Click the water to feed the fish</span>
    </div>
    <figcaption v-if="!preview">The koi behind the chat, inspired by <a href="https://www.daoho.dev/" target="_blank" rel="noopener noreferrer">Dao Ho</a>.</figcaption>
  </figure>
</template>

<style scoped>
.fishbowl-figure { margin: 18px 0 22px; }
.fishbowl-water { position: relative; height: 375px; overflow: hidden; background: #f5f9ff; border: 2px solid; border-color: var(--shadow) var(--light) var(--light) var(--shadow); }
.fishbowl-water :deep(canvas) { position: absolute; inset: 0; width: 100%; height: 100%; }
.fishbowl-label { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: grid; gap: 10px; text-align: center; width: max-content; max-width: 90%; color: #315e91; pointer-events: none; }
.fishbowl-label strong { font: bold 36px 'Pixel MS Sans Serif', Tahoma, sans-serif; }
.fishbowl-label span, .fishbowl-hint { font: 12px Tahoma, sans-serif; }
.fishbowl-hint { position: absolute; bottom: 14px; left: 0; right: 0; text-align: center; color: #315e91; pointer-events: none; }
figcaption { margin-top: 8px; font-size: 12px; line-height: 1.5; color: var(--muted); }
.fishbowl-preview { margin: 0; }
.fishbowl-preview .fishbowl-water { box-sizing: border-box; }
:root[data-theme='dark'] .fishbowl-water { background: #131922; }
:root[data-theme='dark'] .fishbowl-label, :root[data-theme='dark'] .fishbowl-hint { color: #b5cdeb; }
@media (max-width: 480px) { .fishbowl-water { height: 300px; } .fishbowl-preview .fishbowl-water { height: 375px; } }
</style>
