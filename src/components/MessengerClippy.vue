<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import ClippyArt from './ClippyArt.vue';
import { play } from '../sound.js';
const props = defineProps({ available: Boolean, thinking: Boolean, failed: Boolean, connected: Boolean, reply: { type: Number, default: 0 } });
defineEmits(['ask']);
const celebrating = ref(false);
// poking him gets a line, a face and a move, picked at random but never the same line twice in a row
const pokeLines = [
  'It looks like you’re poking me. Would you like help with that?',
  'Hey! I’m holding important papers together, you know.',
  'Ask me where anything on this site lives. I know every folder.',
  'I used to work in Microsoft Office. Now I live in a chat room.',
  'I bend, but I don’t break.',
  'Fancy a game of Reversi? I play white.',
  'Careful, I’m 100% recycled steel.',
  'Click me again. I dare you.',
  'Psst. Jason’s best power clean is 265 lb.',
  'I’m a paperclip of many talents. Mostly clipping.',
];
const pokeMoods = ['surprised', 'happy', 'smug', 'angry'];
const pokeMoves = ['spin', 'hop', 'wobble', 'stretch', 'lean'];
const pick = list => list[Math.floor(Math.random() * list.length)];
const poked = ref(null);
let pokes = 0;
let timer, pokeTimer;
function poke() {
  if (props.thinking) return;
  let line;
  do line = pick(pokeLines); while (line === poked.value?.line);
  poked.value = { id: ++pokes, line, mood: pick(pokeMoods), move: pick(pokeMoves) };
  play('babble', Math.min(10, Math.ceil(line.length / 8)));
  clearTimeout(pokeTimer);
  pokeTimer = setTimeout(() => { poked.value = null; }, 4000);
}
watch(() => props.reply, () => {
  clearTimeout(timer); celebrating.value = true;
  timer = setTimeout(() => { celebrating.value = false; }, 2400);
});
onBeforeUnmount(() => { clearTimeout(timer); clearTimeout(pokeTimer); });
const state = computed(() => !props.connected || !props.available ? 'offline' : props.thinking ? 'thinking' : poked.value ? 'poked' : props.failed ? 'sad' : celebrating.value ? 'happy' : 'idle');
const line = computed(() => ({
  offline: 'I’m away from my desk. You can still chat with everyone here.',
  thinking: 'Hmm, let me straighten out that thought…',
  sad: 'A little snag. Try asking me again in a moment.',
  happy: 'One freshly paperclipped answer, coming right up!',
  idle: 'Need a hand finding your way around the website?',
  poked: poked.value?.line,
}[state.value]));
const mood = computed(() => state.value === 'poked' ? poked.value.mood : state.value === 'idle' || state.value === 'offline' ? 'neutral' : state.value);
</script>

<template>
  <div class="msn-clippy" :data-state="state" :data-move="state === 'poked' ? poked.move : undefined">
    <button :key="poked?.id" type="button" class="msn-clippy-poke" aria-label="Poke Clippy" title="Poke Clippy" @click="poke"><ClippyArt class="msn-clippy-art" :mood="mood"/></button>
    <div class="msn-clippy-balloon">
      <div class="msn-clippy-heading"><strong>Clippy <small>Website assistant · AI</small></strong><button type="button" :disabled="!available || !connected || thinking" @click="$emit('ask')">Ask Clippy</button></div>
      <p role="status">{{ line }}<span v-if="thinking" class="msn-clippy-dots" aria-hidden="true"><i></i><i></i><i></i></span></p>
      <span class="msn-clippy-hint">Ask with @Clippy · AI can read recent public chat</span>
    </div>
  </div>
</template>

<style scoped>
/* sits in the bottom corner of the people list, office assistant style, with the balloon above him */
.msn-clippy{display:flex;flex-direction:column-reverse;align-items:flex-end;gap:6px;margin-top:auto;padding:10px 10px 8px;flex-shrink:0}
.msn-clippy-poke{padding:0;border:0;background:none;cursor:pointer;line-height:0}.msn-clippy-poke:focus-visible{outline:1px dotted currentColor;outline-offset:2px}
.msn-clippy-art{width:32px;height:58px;flex-shrink:0;transform-origin:50% 94%;animation:clippy-idle 6s ease-in-out infinite}
.msn-clippy-balloon{position:relative;align-self:stretch;min-width:0;padding:7px 10px;background:#fffde5;border:1px solid #b8ad74;border-radius:5px;color:#4d482d;box-shadow:1px 2px 0 #0000000a}
.msn-clippy-balloon::before{content:'';position:absolute;right:12px;bottom:-5px;width:7px;height:7px;background:inherit;border-right:1px solid #b8ad74;border-bottom:1px solid #b8ad74;transform:rotate(45deg)}
.msn-clippy-heading{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 8px;font-size:11px}.msn-clippy-heading small{display:block;font-weight:normal;font-size:9px;color:#80774f;margin-top:2px}
.msn-clippy-heading button{background:none;border:0;padding:0;text-decoration:underline;font:inherit;color:#315e91;cursor:pointer}.msn-clippy-heading button:disabled{opacity:.5;cursor:default}
.msn-clippy-balloon p{margin:5px 0;font-size:11px;line-height:1.4}.msn-clippy-hint{font-size:9px;color:#80774f}
[data-state="thinking"] .msn-clippy-art{animation:clippy-think 1.3s ease-in-out infinite}[data-state="happy"] .msn-clippy-art{animation:clippy-hop .6s ease-in-out 4}[data-state="sad"] .msn-clippy-art{animation:clippy-snag .5s ease-in-out 2}[data-state="offline"] .msn-clippy-art{animation:none;opacity:.65}
[data-move="spin"] .msn-clippy-art{transform-origin:50% 50%;animation:clippy-spin .7s ease-in-out}[data-move="hop"] .msn-clippy-art{animation:clippy-hop .5s ease-in-out 2}[data-move="wobble"] .msn-clippy-art{animation:clippy-snag .35s ease-in-out 3}[data-move="stretch"] .msn-clippy-art{animation:clippy-stretch .8s ease-in-out}[data-move="lean"] .msn-clippy-art{animation:clippy-lean 1.2s ease-in-out}
.msn-clippy-dots{display:inline-flex;gap:3px;margin-left:6px}.msn-clippy-dots i{width:3px;height:3px;border-radius:50%;background:currentColor;animation:clippy-dot 1s ease-in-out infinite}.msn-clippy-dots i:nth-child(2){animation-delay:.15s}.msn-clippy-dots i:nth-child(3){animation-delay:.3s}
@keyframes clippy-idle{0%,70%,100%{transform:rotate(0)}80%{transform:rotate(-5deg)}90%{transform:rotate(4deg)}}
@keyframes clippy-think{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(6deg) translateY(-2px)}}
@keyframes clippy-hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-7px) rotate(-5deg)}75%{transform:translateY(0) scaleY(.95)}}
@keyframes clippy-snag{25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}
@keyframes clippy-spin{to{transform:rotate(360deg)}}
@keyframes clippy-stretch{30%{transform:scale(1.1,.8)}60%{transform:scale(.9,1.2) translateY(-3px)}}
@keyframes clippy-lean{20%,80%{transform:rotate(-14deg) translateX(-3px)}}
@keyframes clippy-dot{50%{opacity:.3;transform:translateY(-2px)}}
:root[data-theme="dark"] .msn-clippy-balloon{background:#38341f;border-color:#766b40;color:#eee6bc}:root[data-theme="dark"] .msn-clippy-balloon::before{border-color:#766b40}:root[data-theme="dark"] .msn-clippy-hint,:root[data-theme="dark"] .msn-clippy-heading small{color:#bcb184}:root[data-theme="dark"] .msn-clippy-heading button{color:#a9cdf5}
@container (max-width:520px){.msn-clippy{padding:8px 6px 6px}.msn-clippy-art{width:26px;height:47px}.msn-clippy-hint{font-size:8px}}
@media(prefers-reduced-motion:reduce){.msn-clippy-art,.msn-clippy-dots i{animation:none!important}}
</style>
