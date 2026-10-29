<script setup>
// the digit guesser in games: draw a digit and the mlp from my mini ml framework guesses
// it (DigitPad.vue), in a window with a toolbar like the other games
import DigitPad from './DigitPad.vue';
import RetroIcon from './RetroIcon.vue';

const emit = defineEmits(['open']);
</script>

<template>
  <div class="app-layout digits-app">
    <div class="toolbar ie-toolbar">
      <!-- the writeup for the framework that trained it -->
      <button class="ie-button" title="Read how the Mini ML Framework was built" @click="emit('open', 'mini-ml')">
        <RetroIcon name="document"/>
        <span>Project</span>
      </button>
      <button class="ie-button" title="Open the Games folder" @click="emit('open', 'games')">
        <RetroIcon name="games"/>
        <span>Games</span>
      </button>
    </div>

    <div class="content-scroll digits-content">
      <DigitPad/>
    </div>

    <footer class="status-bar">
      <span>784 → 256 → 128 → 10, trained with minitorch</span>
    </footer>
  </div>
</template>

<style scoped>
/* the pad as big as the window allows, square */
.digits-content { container-type: size; background: var(--d-page, #f5f4ed); }
.digit-pad { --pad-size: min(100cqh - 28px, 60cqw); box-sizing: border-box; min-height: 100%; padding: 14px; }
@container (max-aspect-ratio: 1 / 1) {
  .digit-pad { --pad-size: min(100cqw - 28px, 55cqh); }
}
</style>
