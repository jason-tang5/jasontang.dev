<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import ClippyArt from './ClippyArt.vue';
const props = defineProps({ available: Boolean, thinking: Boolean, failed: Boolean, connected: Boolean, reply: { type: Number, default: 0 } });
defineEmits(['ask']);
const celebrating = ref(false);
let timer;
watch(() => props.reply, () => {
  clearTimeout(timer); celebrating.value = true;
  timer = setTimeout(() => { celebrating.value = false; }, 2400);
});
onBeforeUnmount(() => clearTimeout(timer));
const state = computed(() => !props.connected || !props.available ? 'offline' : props.thinking ? 'thinking' : props.failed ? 'sad' : celebrating.value ? 'happy' : 'idle');
const line = computed(() => ({
  offline: 'I’m away from my desk. You can still chat with everyone here.',
  thinking: 'Hmm, let me straighten out that thought…',
  sad: 'A little snag. Try asking me again in a moment.',
  happy: 'One freshly paperclipped answer, coming right up!',
  idle: 'Need a hand finding your way around the website?',
}[state.value]));
</script>

<template>
  <div class="msn-clippy" :data-state="state">
    <ClippyArt class="msn-clippy-art" :mood="state === 'idle' || state === 'offline' ? 'neutral' : state"/>
    <div class="msn-clippy-balloon">
      <div class="msn-clippy-heading"><strong>Clippy <small>Website assistant · AI</small></strong><button type="button" :disabled="!available || !connected || thinking" @click="$emit('ask')">Ask Clippy</button></div>
      <p role="status">{{ line }}<span v-if="thinking" class="msn-clippy-dots" aria-hidden="true"><i></i><i></i><i></i></span></p>
      <span class="msn-clippy-hint">Start with @Clippy · Questions and replies are public</span>
    </div>
  </div>
</template>

<style scoped>
.msn-clippy{display:flex;align-items:center;gap:12px;padding:9px 15px;background:#f4f7fb;border-top:1px solid #c5d2e2;flex-shrink:0}
.msn-clippy-art{width:32px;height:58px;flex-shrink:0;transform-origin:50% 94%;animation:clippy-idle 6s ease-in-out infinite}
.msn-clippy-balloon{position:relative;flex:1;min-width:0;padding:7px 10px;background:#fffde5;border:1px solid #b8ad74;border-radius:5px;color:#4d482d;box-shadow:1px 2px 0 #0000000a}
.msn-clippy-balloon::before{content:'';position:absolute;left:-5px;top:25px;width:7px;height:7px;background:inherit;border-left:1px solid #b8ad74;border-bottom:1px solid #b8ad74;transform:rotate(45deg)}
.msn-clippy-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px}.msn-clippy-heading small{font-weight:normal;font-size:9px;color:#80774f;margin-left:5px}
.msn-clippy-heading button{background:none;border:0;padding:0;text-decoration:underline;font:inherit;color:#315e91;cursor:pointer}.msn-clippy-heading button:disabled{opacity:.5;cursor:default}
.msn-clippy-balloon p{margin:5px 0;font-size:11px;line-height:1.4}.msn-clippy-hint{font-size:9px;color:#80774f}
[data-state="thinking"] .msn-clippy-art{animation:clippy-think 1.3s ease-in-out infinite}[data-state="happy"] .msn-clippy-art{animation:clippy-hop .6s ease-in-out 4}[data-state="sad"] .msn-clippy-art{animation:clippy-snag .5s ease-in-out 2}[data-state="offline"] .msn-clippy-art{animation:none;opacity:.65}
.msn-clippy-dots{display:inline-flex;gap:3px;margin-left:6px}.msn-clippy-dots i{width:3px;height:3px;border-radius:50%;background:currentColor;animation:clippy-dot 1s ease-in-out infinite}.msn-clippy-dots i:nth-child(2){animation-delay:.15s}.msn-clippy-dots i:nth-child(3){animation-delay:.3s}
@keyframes clippy-idle{0%,70%,100%{transform:rotate(0)}80%{transform:rotate(-5deg)}90%{transform:rotate(4deg)}}
@keyframes clippy-think{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(6deg) translateY(-2px)}}
@keyframes clippy-hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-7px) rotate(-5deg)}75%{transform:translateY(0) scaleY(.95)}}
@keyframes clippy-snag{25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}
@keyframes clippy-dot{50%{opacity:.3;transform:translateY(-2px)}}
:root[data-theme="dark"] .msn-clippy{background:#1b222d;border-color:#2e3a4b}:root[data-theme="dark"] .msn-clippy-balloon{background:#38341f;border-color:#766b40;color:#eee6bc}:root[data-theme="dark"] .msn-clippy-balloon::before{border-color:#766b40}:root[data-theme="dark"] .msn-clippy-hint,:root[data-theme="dark"] .msn-clippy-heading small{color:#bcb184}:root[data-theme="dark"] .msn-clippy-heading button{color:#a9cdf5}
@container (max-width:520px){.msn-clippy{gap:8px;padding:7px 10px}.msn-clippy-art{width:26px;height:47px}.msn-clippy-hint{font-size:8px}}
@media(prefers-reduced-motion:reduce){.msn-clippy-art,.msn-clippy-dots i{animation:none!important}}
</style>
