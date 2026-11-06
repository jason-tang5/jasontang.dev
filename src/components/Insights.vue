<script setup>
// the analytics window's insights tab: funnels, journeys and retention for the chosen
// period, from /api/insights (worker/insights.mjs). it loads when the tab opens, again
// when the period changes or the window's refresh is pressed
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { registry } from '../registry.js';
import { read, save } from '../storage.js';

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

// ---- funnels ----
const savedFunnel = read('analytics-funnel', 'contact');
const funnelId = ref(savedFunnel);
const funnel = computed(() => data.value?.funnels.find(f => f.id === funnelId.value) || data.value?.funnels[0]);
function pickFunnel(id) {
  funnelId.value = id;
  save('analytics-funnel', id);
}
function stepFunnel(event, by) {
  const list = data.value.funnels;
  const next = list[(list.findIndex(f => f.id === funnel.value.id) + by + list.length) % list.length];
  pickFunnel(next.id);
  event.currentTarget.parentElement.querySelector(`[data-funnel="${next.id}"]`)?.focus();
}
// each step with what it kept from the start and lost since the step before. the
// step that loses the biggest share of the one before is where most people give up
const steps = computed(() => {
  const list = funnel.value?.steps || [];
  const start = list[0]?.count || 0;
  const rows = list.map((step, i) => {
    const before = i ? list[i - 1].count : step.count;
    return { ...step, ofStart: percent(step.count, start), lost: before - step.count, lostShare: before ? (before - step.count) / before : 0 };
  });
  const worst = rows.slice(1).reduce((best, row) => (row.lost > 0 && row.lostShare > (best?.lostShare ?? 0) ? row : best), null);
  return rows.map(row => ({ ...row, worst: row === worst }));
});
const finished = computed(() => {
  const list = steps.value;
  return list.length ? percent(list.at(-1).count, list[0].count) : '0%';
});

// ---- journeys ----
const windowName = id => registry[id]?.label || id;
const journeyPeak = computed(() => Math.max(1, ...(data.value?.journeys.paths || []).map(p => p.count)));

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
      <h2>Funnels</h2>
      <p class="analytics-note">How many visits made it through each step, in order, and where the rest dropped off.</p>
      <div class="insight-tabs" role="tablist" aria-label="Funnel">
        <button v-for="f in data.funnels" :id="`funnel-tab-${f.id}`" :key="f.id" :data-funnel="f.id" role="tab" :aria-selected="funnel.id === f.id" aria-controls="funnel-panel" :tabindex="funnel.id === f.id ? 0 : -1"
          @click="pickFunnel(f.id)" @keydown.right.prevent="stepFunnel($event, 1)" @keydown.left.prevent="stepFunnel($event, -1)">{{ f.title }}</button>
      </div>
      <div id="funnel-panel" role="tabpanel" :aria-labelledby="`funnel-tab-${funnel.id}`">
        <p v-if="!steps[0]?.count">No visits yet.</p>
        <ol v-else class="funnel-steps">
          <li v-for="(step, i) in steps" :key="step.label">
            <div v-if="i" class="funnel-drop" :class="{ worst: step.worst }">
              <span aria-hidden="true">↓</span>
              {{ step.lost ? `${number(step.lost)} dropped off (${percent(step.lost, steps[i - 1].count)})` : 'nobody dropped off' }}
              <b v-if="step.worst">biggest drop-off</b>
            </div>
            <div class="funnel-step">
              <span class="funnel-number">{{ i + 1 }}</span>
              <span class="funnel-label">{{ step.label }}</span>
              <span class="funnel-count"><b>{{ number(step.count) }}</b><span class="insight-share">{{ step.ofStart }}</span></span>
            </div>
            <div class="insight-bar" aria-hidden="true"><span :style="{ width: `${step.count / Math.max(1, steps[0].count) * 100}%` }"/></div>
          </li>
        </ol>
        <p v-if="steps[0]?.count" class="funnel-total"><b>{{ finished }}</b> of visits made it all the way.</p>
      </div>
    </section>

    <section class="insight">
      <h2>Journeys</h2>
      <p class="analytics-note">The windows people opened, in order. {{ number(data.journeys.opened) }} visits opened at least one.</p>
      <p v-if="!data.journeys.paths.length">No journeys yet.</p>
      <ol v-else class="journeys">
        <li v-for="(path, i) in data.journeys.paths" :key="i">
          <div class="journey-row">
            <span class="journey-path">
              <template v-for="(id, j) in path.path" :key="j"><span v-if="j" class="journey-arrow" aria-label="then">→</span><span class="journey-window">{{ windowName(id) }}</span></template>
              <span v-if="path.more" class="journey-arrow" aria-label="and more">→ …</span>
            </span>
            <span class="funnel-count"><b>{{ number(path.count) }}</b><span class="insight-share">{{ percent(path.count, data.journeys.opened) }}</span></span>
          </div>
          <div class="insight-bar journey-bar" aria-hidden="true"><span :style="{ width: `${path.count / journeyPeak * 100}%` }"/></div>
        </li>
      </ol>
    </section>

    <section class="insight">
      <h2>Retention</h2>
      <p class="analytics-note">Visitors by the week they first came, and the share who came back in each week after. Visitor ids start fresh each month, so a return across the turn of a month counts as someone new.</p>
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
/* the same plain word tabs as the location card */
.insight-tabs { display: flex; flex-wrap: wrap; gap: 4px 22px; border-bottom: 1px solid var(--d-rule, #ddd); margin: 8px 0 12px; }
.insight-tabs button {
  padding: 4px 0 7px; margin-bottom: -1px; border: 0; border-bottom: 2px solid transparent; background: none; cursor: pointer;
  font: 13px Tahoma, Arial, sans-serif; color: var(--muted);
}
.insight-tabs button:hover { color: var(--ink); }
.insight-tabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--d-link, #000080); }
.insight-tabs button:focus-visible { outline: 1px dotted var(--ink); outline-offset: 2px; }

.funnel-steps, .journeys { list-style: none; margin: 0; padding: 0; }
.funnel-step, .journey-row { display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 4px 0; }
.funnel-number {
  flex: none; display: grid; place-items: center; width: 20px; height: 20px;
  font: bold 11px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--paper); background: var(--d-link, #000080);
}
.funnel-label, .journey-path { flex: 1; min-width: 0; }
.funnel-count { flex: none; white-space: nowrap; }
/* the share after a thin divider, fixed width so the counts line up, like the location card */
.insight-share { display: inline-block; min-width: 46px; margin-left: 10px; padding-left: 10px; border-left: 1px solid var(--d-rule, #ccc); color: var(--muted); text-align: right; }
/* the dashed pixel bar the rest of the window uses */
.insight-bar { height: 12px; background: var(--d-rule, #eee); margin-bottom: 4px; }
.insight-bar span { display: block; height: 100%; background: repeating-linear-gradient(to right, var(--bar-7, #4a3aa7) 0 6px, transparent 6px 8px); }
.journey-bar span { background: repeating-linear-gradient(to right, var(--bar-3, #1baf7a) 0 6px, transparent 6px 8px); }
/* between two steps: how many didn't make the next one */
.funnel-drop { display: flex; align-items: center; gap: 6px; margin: 2px 0 2px 30px; font-size: 12px; color: var(--muted); }
.funnel-drop.worst { color: var(--bar-2, #eb6834); font-weight: bold; }
.funnel-drop b {
  padding: 0 5px; font: bold 10px 'Pixel MS Sans Serif', Tahoma, sans-serif; text-transform: uppercase;
  color: var(--paper); background: var(--bar-2, #eb6834);
}
.funnel-total { margin-top: 10px; font-size: 13px; }

.journey-path { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.journey-window { padding: 1px 6px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #000); font-size: 12px; white-space: nowrap; }
.journey-arrow { color: var(--muted); }

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
