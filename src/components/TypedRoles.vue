<script setup>
// the line under my name on the about page that types out a word, holds it, backspaces
// it and types the next, round and round. it only runs while
// the window's open and it's on screen, and with reduced motion it just shows the first
// word. screen readers get the whole list at once
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({ words: { type: Array, required: true }, visible: Boolean });

const text = ref('');
const line = ref(null);

let onScreen = false;
let alive = true;
let timer = 0;

const wait = ms => new Promise(resolve => {
  timer = setTimeout(resolve, ms);
});
async function whenSeen() {
  while (alive && !(props.visible && onScreen)) await wait(250);
}

async function run() {
  for (let i = 0; alive; i = (i + 1) % props.words.length) {
    const word = props.words[i];
    for (const char of word) {
      await whenSeen();
      text.value += char;
      await wait(70 + Math.random() * 50);
    }
    await wait(1800);
    while (alive && text.value) {
      await whenSeen();
      text.value = text.value.slice(0, -1);
      await wait(35);
    }
    await wait(350);
  }
}

let observer;
onMounted(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    text.value = props.words[0];
    return;
  }
  observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; });
  observer.observe(line.value);
  run();
});

onBeforeUnmount(() => {
  alive = false;
  clearTimeout(timer);
  observer?.disconnect();
});
</script>

<template>
  <p ref="line" class="typed-roles" :aria-label="words.join(', ')">
    <span aria-hidden="true">{{ text }}<span class="typed-cursor">_</span></span>
  </p>
</template>
