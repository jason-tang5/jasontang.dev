<script setup>
// where visits come from, laid out like umami's location card: text tabs for
// countries, regions and cities, a list with a flag on each row, the visits and their
// share of the total on the right, the analytics window's pixel bar under each, and
// more to open the whole list. the places come
// from summarizePlaces() in worker/analytics.mjs
import { computed, ref } from 'vue';
import { read, save } from '../storage.js';

const props = defineProps({
  countries: { type: Array, default: () => [] },
  regions: { type: Array, default: () => [] },
  cities: { type: Array, default: () => [] },
});

// the flags are flag-icons' svgs (licenses/flag-icons-MIT.txt), served from this site.
// only the urls are bundled here, each flag loads when a row shows it
const flagFiles = import.meta.glob('/node_modules/flag-icons/flags/4x3/*.svg', { eager: true, query: '?no-inline', import: 'default' });
const flags = Object.fromEntries(Object.entries(flagFiles).map(([path, url]) => [path.split('/').pop().slice(0, -4), url]));
const flag = code => (code && flags[code.toLowerCase()]) || null;

const levels = [
  { id: 'countries', tab: 'Countries', column: 'Country' },
  { id: 'regions', tab: 'Regions', column: 'Region' },
  { id: 'cities', tab: 'Cities', column: 'City' },
];
const saved = read('analytics-places', 'countries');
const level = ref(levels.some(l => l.id === saved) ? saved : 'countries');
const current = computed(() => levels.find(l => l.id === level.value));
function pick(id) {
  level.value = id;
  expanded.value = false;
  save('analytics-places', id);
}
// left and right arrows move between the tabs
function step(event, by) {
  const next = levels[(levels.findIndex(l => l.id === level.value) + by + levels.length) % levels.length];
  pick(next.id);
  event.currentTarget.parentElement.querySelector(`[data-level="${next.id}"]`)?.focus();
}

// the first few rows, and the rest behind more
const shown = 8;
const expanded = ref(false);
const rows = computed(() => props[level.value] || []);
const total = computed(() => rows.value.reduce((sum, row) => sum + row.count, 0));
const visible = computed(() => (expanded.value ? rows.value : rows.value.slice(0, shown)));
const share = count => `${Math.round(count / Math.max(1, total.value) * 100)}%`;
// bars are measured against the biggest row, like the rest of the window's bars
const peak = computed(() => Math.max(1, ...rows.value.map(row => row.count)));
</script>

<template>
  <section class="location-card">
    <h2>Location</h2>
    <div class="location-tabs" role="tablist" aria-label="Location by">
      <button v-for="l in levels" :id="`location-tab-${l.id}`" :key="l.id" :data-level="l.id" role="tab" :aria-selected="level === l.id" aria-controls="location-panel" :tabindex="level === l.id ? 0 : -1"
        @click="pick(l.id)" @keydown.right.prevent="step($event, 1)" @keydown.left.prevent="step($event, -1)">{{ l.tab }}</button>
    </div>
    <div id="location-panel" role="tabpanel" :aria-labelledby="`location-tab-${level}`">
      <p v-if="!rows.length" class="location-empty">No visits yet.</p>
      <table v-else class="location-table">
        <thead><tr><th scope="col">{{ current.column }}</th><th scope="col">Visitors</th></tr></thead>
        <tbody>
          <template v-for="row in visible" :key="row.label">
          <tr>
            <td>
              <img v-if="flag(row.country)" class="location-flag" :src="flag(row.country)" alt="" width="20" height="15" loading="lazy">
              <span v-else class="location-flag unknown" aria-hidden="true">?</span>
              <span class="location-name">{{ row.label }}</span>
            </td>
            <td><b>{{ row.count.toLocaleString() }}</b><span class="location-share">{{ share(row.count) }}</span></td>
          </tr>
          <tr class="location-bar-row" aria-hidden="true">
            <td colspan="2"><div class="location-bar"><span :style="{ width: `${row.count / peak * 100}%` }"/></div></td>
          </tr>
          </template>
        </tbody>
      </table>
      <button v-if="rows.length > shown" class="location-more" :aria-expanded="expanded" aria-controls="location-panel" @click="expanded = !expanded">
        <svg viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true"><path :d="expanded ? 'M3 0h1v3H0V2h3zM6 0h1v2h3v1H6zM0 7h3v3h1V6H0zM6 6h4v1H7v3H6z' : 'M0 0h3v1H1v2H0zM7 0h3v3H9V1H7zM0 7h1v2h2v1H0zM9 7h1v3H7V9h2z'"/></svg>
        {{ expanded ? 'Less' : 'More' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
/* the tabs are plain words over a rule, the picked one underlined in the link colour */
.location-tabs { display: flex; gap: 22px; border-bottom: 1px solid var(--d-rule, #ddd); margin: 4px 0 10px; }
.location-tabs button {
  padding: 4px 0 7px; margin-bottom: -1px; border: 0; border-bottom: 2px solid transparent; background: none; cursor: pointer;
  font: 13px Tahoma, Arial, sans-serif; color: var(--muted);
}
.location-tabs button:hover { color: var(--ink); }
.location-tabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--d-link, #000080); }
.location-tabs button:focus-visible { outline: 1px dotted var(--ink); outline-offset: 2px; }
.location-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.location-table th { padding: 6px 0; text-align: left; font-weight: bold; }
.location-table th:last-child, .location-table td:last-child { text-align: right; white-space: nowrap; }
.location-table td { padding: 7px 0 3px; }
/* the same dashed pixel bar as sources and the funnel, in the locations' amber */
.location-bar-row td { padding: 0 0 7px; }
.location-bar { height: 12px; background: var(--d-rule, #eee); }
.location-bar span { display: block; height: 100%; background: repeating-linear-gradient(to right, var(--bar-4, #eda100) 0 6px, transparent 6px 8px); }
.location-table tr:not(.location-bar-row) td:first-child { display: flex; align-items: center; gap: 10px; min-width: 0; }
.location-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.location-flag { flex: none; width: 20px; height: 15px; object-fit: cover; box-shadow: 0 0 0 1px rgb(0 0 0 / .12); }
.location-flag.unknown { display: grid; place-items: center; background: var(--d-rule, #eee); color: var(--muted); font-size: 10px; font-weight: bold; }
/* the share sits after a thin divider, in a fixed width so the counts line up */
.location-share { display: inline-block; min-width: 46px; margin-left: 10px; padding-left: 10px; border-left: 1px solid var(--d-rule, #ccc); color: var(--muted); text-align: right; }
.location-more { display: flex; align-items: center; gap: 8px; margin: 8px auto 0; padding: 4px 10px; border: 0; background: none; cursor: pointer; font: bold 13px Tahoma, Arial, sans-serif; color: var(--ink); }
.location-more:hover { text-decoration: underline; }
.location-more:focus-visible { outline: 1px dotted var(--ink); }
.location-more svg { width: 10px; height: 10px; fill: currentColor; }
.location-empty { color: var(--muted); }
</style>
