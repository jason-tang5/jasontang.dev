<script setup>
// the terminal in fun stuff: a little linux style shell over the desktop (shell.mjs has
// the commands). it boots by "building" each project in turn, ending on what i'm building
// now, then hands you a prompt. any key or tap skips the boot, and with reduced motion it
// shows the finished boot straight away. typing an app's name opens its window
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { projects } from '../content.mjs';
import { isUnlocked } from '../unlocks.js';
import { complete, host, pathOf, run, user } from '../shell.mjs';

const props = defineProps({ visible: Boolean, active: Boolean });
const emit = defineEmits(['open', 'close']);

// oldest first, ending on what's being built now
const order = ['reversi-ai', 'fpga-2048', 'portfolio', 'mini-ml'];
const builds = [...order.filter(id => projects.some(p => p.id === id)), 'LiftLens'];
// a few commands to tap, for phones. three, so they stay clear of the taskbar's handle
const suggestions = ['help', 'ls', 'snake'];

// each line is a list of { text, kind } segments. shell.mjs hands back strings or
// [text, kind] pairs, and a line that's just a string
const lines = ref([]);
const input = ref('');
const cwd = ref('');
const booted = ref(false);
const screen = ref(null);
const field = ref(null);
const state = { history: [], started: Date.now(), isUnlocked };
let historyAt = 0;
let timer = 0;
let alive = true;

const segments = line => [line].flat().map(seg => (typeof seg === 'string' ? { text: seg } : { text: seg[0], kind: seg[1] }));
// shell lines come as a string or a list of segments, never a bare [text, kind] pair
const print = (...out) => {
  lines.value.push(...out.map(segments));
  scrollDown();
};
const promptLine = command => [[`${user}@${host}`, 'user'], ':', [pathOf(cwd.value), 'path'], `$ ${command}`];

async function scrollDown() {
  await nextTick();
  if (screen.value) screen.value.scrollTop = screen.value.scrollHeight;
}

const wait = ms => new Promise(resolve => { timer = setTimeout(resolve, ms); });
async function whenSeen() {
  while (alive && !booted.value && !props.visible) await wait(250);
}

// the boot: types each build line, spins a moment and prints done
async function boot() {
  for (const [i, name] of builds.entries()) {
    const last = i === builds.length - 1;
    const full = `building ${name}...`;
    lines.value.push([{ text: '> ', kind: 'prompt' }, { text: '' }]);
    const line = lines.value[lines.value.length - 1];
    for (const char of full) {
      await whenSeen();
      if (booted.value || !alive) return;
      line[1].text += char;
      await wait(18);
    }
    await wait(last ? 700 : 250 + Math.random() * 300);
    if (booted.value || !alive) return;
    line.push(last ? { text: ' in progress', kind: 'warn' } : { text: ' done', kind: 'ok' });
  }
  finishBoot();
}
function bootLines() {
  return builds.map((name, i) => [
    { text: '> ', kind: 'prompt' },
    { text: `building ${name}...` },
    i < builds.length - 1 ? { text: ' done', kind: 'ok' } : { text: ' in progress', kind: 'warn' },
  ]);
}
function finishBoot() {
  if (booted.value) return;
  clearTimeout(timer);
  booted.value = true;
  lines.value = bootLines();
  print('', ['Welcome to jsh. Type ', ['help', 'accent'], ' to see what you can do, or an app’s name to open it.'], '');
  focusField();
}

function submit(command = input.value) {
  input.value = '';
  print(promptLine(command));
  if (command.trim()) state.history.push(command.trim());
  historyAt = state.history.length;
  const result = run(command, { ...state, cwd: cwd.value });
  if (result.clear) lines.value = [];
  if (result.cwd !== undefined) cwd.value = result.cwd;
  print(...result.lines);
  if (result.open) emit('open', result.open);
  if (result.close) emit('close', 'terminal');
}

function keydown(event) {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    historyAt = Math.max(0, Math.min(state.history.length, historyAt + (event.key === 'ArrowUp' ? -1 : 1)));
    input.value = state.history[historyAt] ?? '';
  } else if (event.key === 'Tab') {
    event.preventDefault();
    if (!input.value) return;
    const { input: done, options } = complete(input.value, cwd.value);
    if (options.length) print(promptLine(input.value), [options.join('  ')]);
    input.value = done;
  } else if (event.ctrlKey && event.key.toLowerCase() === 'c') {
    if (getSelection()?.toString()) return; // let a copy through
    event.preventDefault();
    print(promptLine(`${input.value}^C`));
    input.value = '';
  } else if (event.ctrlKey && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    lines.value = [];
  }
}

// a phone's keyboard would jump up on every focus, so only a mouse focuses on its own
function focusField(force = false) {
  if (!force && !matchMedia('(pointer: fine)').matches) return;
  nextTick(() => field.value?.focus({ preventScroll: true }));
}
// clicking the screen puts you at the prompt, unless you were selecting text to copy
function screenClick() {
  if (!booted.value) return finishBoot();
  if (!getSelection()?.toString()) focusField(true);
}
function skipBoot(event) {
  if (!booted.value && props.active && !event.ctrlKey && !event.metaKey) finishBoot();
}

watch(() => props.active, active => { if (active && booted.value) focusField(); });
onMounted(() => {
  addEventListener('keydown', skipBoot);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) finishBoot();
  else boot();
});
onBeforeUnmount(() => {
  alive = false;
  clearTimeout(timer);
  removeEventListener('keydown', skipBoot);
});
</script>

<template>
  <div class="terminal">
    <div ref="screen" class="terminal-screen" @click="screenClick">
      <div role="log" aria-label="Terminal output">
        <div v-for="(line, i) in lines" :key="i" class="terminal-line">
          <span v-for="(seg, j) in line" :key="j" :class="seg.kind && `t-${seg.kind}`">{{ seg.text }}</span>
        </div>
      </div>
      <form v-if="booted" class="terminal-line terminal-input-line" @submit.prevent="submit()">
        <label for="terminal-input">
          <span class="t-user">{{ user }}@{{ host }}</span>:<span class="t-path">{{ pathOf(cwd) }}</span>$
        </label>
        <input
          id="terminal-input"
          ref="field"
          v-model="input"
          class="terminal-input"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="go"
          @keydown="keydown"
        >
      </form>
      <span v-else class="terminal-cursor" aria-hidden="true">_</span>
    </div>
    <div class="terminal-suggestions" role="group" aria-label="Try a command">
      <button v-for="s in suggestions" :key="s" class="raised" :disabled="!booted" @click="submit(s)">{{ s }}</button>
    </div>
  </div>
</template>
