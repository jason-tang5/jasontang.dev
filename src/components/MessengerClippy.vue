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
onBeforeUnmount(() => { clearTimeout(timer); clearTimeout(pokeTimer); clearInterval(typeTimer); });
const state = computed(() => !props.connected || !props.available ? 'offline' : props.thinking ? 'thinking' : poked.value ? 'poked' : props.failed ? 'sad' : celebrating.value ? 'happy' : 'idle');
const line = computed(() => ({
  offline: 'I’m away from my desk. You can still chat with everyone here.',
  thinking: 'Hmm, let me straighten out that thought…',
  sad: 'A little snag. Try asking me again in a moment.',
  happy: 'One freshly paperclipped answer, coming right up!',
  idle: 'Need a hand finding your way around the website?',
  poked: poked.value?.line,
}[state.value]));
// he types each line out like he's saying it, bobbing along until he's done. the untyped rest is kept in place
// but invisible so the balloon is the right size from the start, and screen readers get the whole line at once
const typed = ref(0);
let typeTimer;
watch(line, text => {
  clearInterval(typeTimer);
  typed.value = 0;
  if (!text || matchMedia('(prefers-reduced-motion: reduce)').matches) { typed.value = text?.length || 0; return; }
  typeTimer = setInterval(() => { if (++typed.value >= text.length) clearInterval(typeTimer); }, 28);
}, { immediate: true });
// x-ing out the balloon keeps him quiet until he has something new to say: a poke, a question being worked on,
// or an answer. drifting back to his idle or away line doesn't reopen it
const closed = ref(false);
watch(() => [state.value, poked.value?.id], ([now]) => { if (now !== 'idle' && now !== 'offline') closed.value = false; });
const talking = computed(() => !closed.value && typed.value < (line.value?.length || 0));
const mood = computed(() => state.value === 'poked' ? poked.value.mood : state.value === 'idle' || state.value === 'offline' ? 'neutral' : state.value);
</script>

<template>
  <div class="msn-clippy" :data-state="state" :data-move="state === 'poked' ? poked.move : undefined" :data-talking="talking || undefined">
    <button :key="poked?.id" type="button" class="msn-clippy-poke" aria-label="Poke Clippy" title="Poke Clippy" @click="poke"><ClippyArt class="msn-clippy-art" :mood="mood"/></button>
    <div v-if="!closed" class="msn-clippy-balloon">
      <button type="button" class="msn-clippy-close" aria-label="Close Clippy’s message" title="Close" @click="closed = true">×</button>
      <p><strong>Clippy</strong> <span class="msn-clippy-said" role="status">{{ line }}</span><span aria-hidden="true">{{ line.slice(0, typed) }}<span class="msn-clippy-unsaid">{{ line.slice(typed) }}</span></span><span v-if="thinking" class="msn-clippy-dots" aria-hidden="true"><i></i><i></i><i></i></span></p>
      <span class="msn-clippy-hint">Ask with <button type="button" :disabled="!available || !connected || thinking" @click="$emit('ask')">@Clippy</button></span>
    </div>
  </div>
</template>

<style scoped>
/* sits in the bottom corner of the people list, office assistant style. the balloon is placed against the room
   (not the scrolling people list, which would clip it) so it floats out over the chat to his left, clear of the send box */
.msn-clippy{display:flex;justify-content:flex-end;margin-top:auto;padding:10px 12px 8px;flex-shrink:0}
.msn-clippy-poke{padding:0;border:0;background:none;cursor:pointer;line-height:0}.msn-clippy-poke:focus-visible{outline:1px dotted currentColor;outline-offset:2px}
.msn-clippy-art{width:44px;height:80px;flex-shrink:0;transform-origin:50% 94%;animation:clippy-idle 6s ease-in-out infinite}
.msn-clippy-balloon{position:absolute;z-index:2;right:18px;bottom:100px;width:min(210px,calc(100% - 80px));box-sizing:border-box;display:grid;gap:4px;padding:7px 22px 7px 10px;background:#fffde5;border:1px solid #b8ad74;border-radius:5px;color:#4d482d;box-shadow:1px 2px 6px #0002}
.msn-clippy-balloon::before{content:'';position:absolute;right:12px;bottom:-5px;width:7px;height:7px;background:inherit;border-right:1px solid #b8ad74;border-bottom:1px solid #b8ad74;transform:rotate(45deg)}
.msn-clippy-close{position:absolute;top:3px;right:4px;width:15px;height:15px;padding:0;border:0;border-radius:2px;background:none;font:13px/1 Tahoma,Arial,sans-serif;color:#80774f;cursor:pointer}.msn-clippy-close:hover{background:#0000001a;color:#4d482d}.msn-clippy-close:focus-visible{outline:1px dotted currentColor}
.msn-clippy-hint button{border:0;border-radius:3px;padding:1px 4px;background:#f3e79e;font:inherit;font-weight:bold;color:#315e91;cursor:pointer}.msn-clippy-hint button:hover{background:#ecdb79}.msn-clippy-hint button:disabled{opacity:.5;cursor:default}
.msn-clippy-said{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.msn-clippy-unsaid{visibility:hidden}
.msn-clippy-balloon p{margin:0;font-size:11px;line-height:1.4}.msn-clippy-balloon strong{margin-right:4px}.msn-clippy-hint{font-size:10px;color:#80774f}
[data-talking] .msn-clippy-art{animation:clippy-talk .32s ease-in-out infinite}[data-state="thinking"] .msn-clippy-art{animation:clippy-think 1.3s ease-in-out infinite}[data-state="happy"] .msn-clippy-art{animation:clippy-hop .6s ease-in-out 4}[data-state="sad"] .msn-clippy-art{animation:clippy-snag .5s ease-in-out 2}[data-state="offline"] .msn-clippy-art{animation:none;opacity:.65}
[data-move="spin"] .msn-clippy-art{transform-origin:50% 50%;animation:clippy-spin .7s ease-in-out}[data-move="hop"] .msn-clippy-art{animation:clippy-hop .5s ease-in-out 2}[data-move="wobble"] .msn-clippy-art{animation:clippy-snag .35s ease-in-out 3}[data-move="stretch"] .msn-clippy-art{animation:clippy-stretch .8s ease-in-out}[data-move="lean"] .msn-clippy-art{animation:clippy-lean 1.2s ease-in-out}
.msn-clippy-dots{display:inline-flex;gap:3px;margin-left:6px}.msn-clippy-dots i{width:3px;height:3px;border-radius:50%;background:currentColor;animation:clippy-dot 1s ease-in-out infinite}.msn-clippy-dots i:nth-child(2){animation-delay:.15s}.msn-clippy-dots i:nth-child(3){animation-delay:.3s}
@keyframes clippy-idle{0%,70%,100%{transform:rotate(0)}80%{transform:rotate(-5deg)}90%{transform:rotate(4deg)}}
@keyframes clippy-think{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(6deg) translateY(-2px)}}
@keyframes clippy-hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-7px) rotate(-5deg)}75%{transform:translateY(0) scaleY(.95)}}
@keyframes clippy-snag{25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}
@keyframes clippy-spin{to{transform:rotate(360deg)}}
@keyframes clippy-stretch{30%{transform:scale(1.1,.8)}60%{transform:scale(.9,1.2) translateY(-3px)}}
@keyframes clippy-lean{20%,80%{transform:rotate(-14deg) translateX(-3px)}}
@keyframes clippy-talk{50%{transform:scaleY(.94) translateY(1px) rotate(-2deg)}}
@keyframes clippy-dot{50%{opacity:.3;transform:translateY(-2px)}}
:root[data-theme="dark"] .msn-clippy-balloon{background:#38341f;border-color:#766b40;color:#eee6bc}:root[data-theme="dark"] .msn-clippy-balloon::before{border-color:#766b40}:root[data-theme="dark"] .msn-clippy-hint,:root[data-theme="dark"] .msn-clippy-close{color:#bcb184}:root[data-theme="dark"] .msn-clippy-close:hover{background:#ffffff1a;color:#eee6bc}:root[data-theme="dark"] .msn-clippy-hint button{background:#5a5230;color:#cfe3fa}:root[data-theme="dark"] .msn-clippy-hint button:hover{background:#6b6238}
@container (max-width:520px){.msn-clippy{padding:8px 6px 6px}.msn-clippy-art{width:36px;height:65px}.msn-clippy-balloon{right:8px;bottom:80px}.msn-clippy-hint{font-size:9px}}
@media(prefers-reduced-motion:reduce){.msn-clippy-art,.msn-clippy-dots i{animation:none!important}}
</style>
