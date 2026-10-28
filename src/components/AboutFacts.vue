<script setup>
// the about page's quick facts: a label column and the fact beside it, with each
// scholarship on its own line next to a little ribbon medal, and the
// favourite books as pixel font links, each with a tiny book in front, and the lifts
// with their weights in the pixel font
import InlineText from './InlineText.vue';

defineProps({ facts: { type: Array, required: true } });
</script>

<template>
  <ul class="about-facts">
    <li v-for="fact in facts" :key="fact.label">
      <strong>{{ fact.label }}</strong>
      <span :class="{ 'fact-books': fact.books }">
        <span v-if="fact.lifts" class="fact-lifts">
          <span v-for="[lift, weight] in fact.lifts" :key="lift">{{ lift }} <b>{{ weight }}</b></span>
        </span>
        <InlineText v-else-if="fact.text" :text="fact.text"/>
        <span v-for="award in fact.awards" :key="award" class="fact-award">
          <svg viewBox="0 0 9 12" aria-hidden="true" shape-rendering="crispEdges">
            <path fill="#c43b33" d="M1 6h3v6L2.5 10.5 1 12zM5 6h3v6l-1.5-1.5L5 12z"/>
            <path fill="#a0781c" d="M2 0h5v1h1v1h1v4H8v1H7v1H2V7H1V6H0V2h1V1h1z"/>
            <path fill="#f3d568" d="M3 1h3v1h1v3H6v1H3V5H2V2h1z"/>
          </svg>
          {{ award }}
        </span>
      </span>
    </li>
  </ul>
</template>
