<script setup>
// the analytics window's insights tab: journeys and retention for the chosen period,
// from /api/insights (worker/insights.mjs). it loads when the tab opens, again when
// the period changes or the window's refresh is pressed
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { registry } from '../registry.js';

const props = defineProps({ days: { type: Number, required: true }, reload: { type: Number, default: 0 } });
const data = ref(null);
const busy = ref(false);
const error = ref('');
let request = 0;
let controller;
async function load() {
  const id = ++request;
  controller?.abort();
  controller = new AbortController();
  busy.value = true;
  error.value = '';
  try {
    const response = await fetch(`/api/insights?days=${props.days}`, { cache: 'no-store', signal: controller.signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    if (id === request) data.value = result;
  } catch (e) {
    if (id === request && e.name !== 'AbortError') error.value = 'Insights are unavailable right now. Please try again later.';
  }
  if (id === request) busy.value = false;
}
watch(() => [props.days, props.reload], load, { immediate: true });
onBeforeUnmount(() => { request++; controller?.abort(); });
const number = value => Number(value || 0).toLocaleString();
const percent = (part, whole) => `${whole ? Math.round(part / whole * 100) : 0}%`;

// ---- journeys ----
const windowName = id => registry[id]?.label || id;
const journeyPeak = computed(() => Math.max(1, ...(data.value?.journeys.paths || []).map(p => p.count)));

// ---- opened from ----
const viaNames = { desktop: 'Desktop', start: 'Start menu', taskbar: 'Taskbar', welcome: 'Welcome note', link: 'Links', other: 'Elsewhere' };
const viaName = via => viaNames[via] || `In ${windowName(via)}`;
const sourcePeak = computed(() => Math.max(1, ...(data.value?.openedFrom || []).map(s => s.count)));
const sourceTotal = computed(() => (data.value?.openedFrom || []).reduce((sum, s) => sum + s.count, 0));

// ---- retention ----
const weekLabel = week => new Date(`${week}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
// a cell's colour gets stronger with the share that came back
const cellStyle = (n, total) => (n === null ? {} : { '--share': total ? n / total : 0 });
</script>

<template>
  <h1>Insights, last {{ days }} days</h1>
  <p v-if="busy && !data" role="status">Loading insights...</p>
  <p v-else-if="error && !data" role="status">{{ error }}</p>
  <template v-if="data">
    <p v-if="error" class="analytics-note" role="status">{{ error }}</p>

    <section class="insight">
      <h2>Journeys</h2>
      <p v-if="!data.journeys.paths.length">No journeys yet.</p>
      <ol v-else class="journeys">
        <li v-for="(path, i) in data.journeys.paths" :key="i">
          <div class="journey-row">
            <span class="journey-path">
              <template v-for="(id, j) in path.path" :key="j"><span v-if="j" class="journey-arrow" aria-label="then">→</span><span class="journey-window">{{ windowName(id) }}</span></template>
              <span v-if="path.more" class="journey-arrow" aria-label="and more">→ …</span>
            </span>
            <span class="journey-count"><b>{{ number(path.count) }}</b><span class="insight-share">{{ percent(path.count, data.journeys.opened) }}</span></span>
          </div>
          <div class="insight-bar" aria-hidden="true"><span :style="{ width: `${path.count / journeyPeak * 100}%` }"/></div>
        </li>
      </ol>
    </section>

    <section class="insight">
      <h2>Opened from</h2>
      <p v-if="!data.openedFrom?.length">No windows opened yet.</p>
      <ol v-else class="journeys">
        <li v-for="source in data.openedFrom" :key="source.via">
          <div class="journey-row">
            <span class="source-name">
              <b>{{ viaName(source.via) }}</b>
              <span class="source-windows">{{ source.windows.map(w => `${windowName(w.id)} ${number(w.count)}`).join(' · ') }}</span>
            </span>
            <span class="journey-count"><b>{{ number(source.count) }}</b><span class="insight-share">{{ percent(source.count, sourceTotal) }}</span></span>
          </div>
          <div class="insight-bar source-bar" aria-hidden="true"><span :style="{ width: `${source.count / sourcePeak * 100}%` }"/></div>
        </li>
      </ol>
    </section>

    <section class="insight">
      <h2>Retention</h2>
      <p v-if="!data.retention.length">No visitors with an id yet. They start with the next visit.</p>
      <div v-else class="retention-scroll">
        <table class="retention">
          <thead>
            <tr><th scope="col">First week</th><th scope="col">Visitors</th><th v-for="k in data.retention[0].weeks.length" :key="k" scope="col">Week {{ k - 1 }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="cohort in data.retention" :key="cohort.week">
              <th scope="row">{{ weekLabel(cohort.week) }}</th>
              <td class="retention-total">{{ number(cohort.visitors) }}</td>
              <td v-for="(n, k) in cohort.weeks" :key="k" class="retention-cell" :class="{ future: n === null, strong: n !== null && n / cohort.visitors > 0.45 }" :style="cellStyle(n, cohort.visitors)" :title="n === null ? 'Not yet' : `${number(n)} of ${number(cohort.visitors)}`">
                {{ n === null ? '' : percent(n, cohort.visitors) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <p v-if="!data.complete" class="analytics-note">There were too many visits to read them all, so these use the most recent ones.</p>
  </template>
</template>

<style scoped>
.insight { margin-bottom: 26px; }
.journeys { list-style: none; margin: 0; padding: 0; }
.journey-row { display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 4px 0; }
.journey-path { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.journey-window { padding: 1px 6px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #000); font-size: 12px; white-space: nowrap; }
.journey-arrow { color: var(--muted); }
.journey-count { flex: none; white-space: nowrap; }
/* the share after a thin divider, fixed width so the counts line up, like the location card */
.insight-share { display: inline-block; min-width: 46px; margin-left: 10px; padding-left: 10px; border-left: 1px solid var(--d-rule, #ccc); color: var(--muted); text-align: right; }
/* the dashed pixel bar the rest of the window uses */
.insight-bar { height: 12px; background: var(--d-rule, #eee); margin-bottom: 4px; }
.insight-bar span { display: block; height: 100%; background: repeating-linear-gradient(to right, var(--bar-3, #1baf7a) 0 6px, transparent 6px 8px); }

/* a source's name, with the windows it opens most in small type after it */
.source-name { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; }
.source-windows { font-size: 11px; color: var(--muted); }
.source-bar span { background: repeating-linear-gradient(to right, var(--bar-1, #2a78d6) 0 6px, transparent 6px 8px); }

.retention-scroll { overflow-x: auto; }
.retention { border-collapse: separate; border-spacing: 3px; font-size: 12px; }
.retention th { font-weight: bold; text-align: left; padding: 3px 6px; white-space: nowrap; }
.retention thead th { color: var(--muted); font-weight: normal; }
.retention thead th:nth-child(2) { text-align: right; }
.retention-total { padding: 3px 6px; text-align: right; }
/* each cell is the window's purple, stronger the more came back */
.retention-cell {
  width: 64px; padding: 6px; text-align: center; font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--bar-7, #4a3aa7) calc(var(--share, 0) * 85% + 8%), transparent);
}
.retention-cell.strong { color: #fff; }
/* dark mode's purple is light, so its strong cells keep dark text */
:root[data-theme="dark"] .retention-cell.strong { color: #15131f; }
.retention-cell.future { background: repeating-linear-gradient(45deg, var(--d-rule, #eee) 0 3px, transparent 3px 6px); }
</style>
