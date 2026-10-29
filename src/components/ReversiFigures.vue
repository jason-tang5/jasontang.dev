<script setup>
// the figures in the reversi writeup (content.mjs, figures), all driven by the same
// game as the games folder (reversi.mjs): the board the way the c version kept and
// printed it, the table of square weights, one move scored part by part, and the
// look-ahead that catches a move that only looks good. preview is the projects card:
// fig 1 plays the bot against itself, filling a 600 × 375 frame
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { black, white, other, newBoard, legalMoves, flipsFor, play, gameOver, count, evaluate, evaluateParts, weights, corners, nextToCorner } from '../reversi.mjs';
import { reducedMotion, useInView } from '../in-view.js';
const props = defineProps({ figure: { type: String, required: true }, preview: Boolean });

// ---- shared: seeded positions, square names, discs ----
const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const figureRandom = seeded(2024);
// a random midgame with clippy (white) to move and a few choices to make
function randomPosition(random, plies, accept = () => true) {
  for (let tries = 0; ; tries++) {
    let board = newBoard(), turn = black, n = 0;
    // play on until it's clippy's turn
    while ((n < plies || turn !== white) && !gameOver(board)) {
      const moves = legalMoves(board, turn);
      if (moves.length) { board = play(board, moves[Math.floor(random() * moves.length)], turn); n++; }
      turn = other(turn);
    }
    if (turn === white && legalMoves(board, white).length >= 4 && (accept(board) || tries > 300)) return board;
  }
}
const nameOf = i => `${'ABCDEFGH'[i % 8]}${Math.floor(i / 8) + 1}`;
const signed = v => { const r = Math.round(v); return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)}`; };
const rowsOf = (widths, y) => widths.map((w, row) => `M${(8 - w) / 2} ${y + row}h${w}v1h-${w}z`).join('');
const discShape = {
  outline: rowsOf([4, 6, 8, 8, 8, 8, 6, 4], 0) + rowsOf([4, 6, 8, 8, 8, 8, 6, 4], 1),
  edge: rowsOf([4, 6, 6, 6, 6, 4], 2),
  face: rowsOf([4, 6, 6, 6, 6, 4], 1),
};
const discColors = { [black]: { face: '#34343c', edge: '#000' }, [white]: { face: '#f2f2ea', edge: '#8a8a84' } };

// ---- board: the c version's char board of U, B and W, printed with a letter per
// row and column, and a move checked one direction at a time ----
const letters = 'abcdefgh';
const charOf = { 0: 'U', [black]: 'B', [white]: 'W' };
const rc = i => `${letters[Math.floor(i / 8)]}${letters[i % 8]}`;
// the 3 × 3 compass of directions as (deltaRow, deltaCol), the middle is the square itself
const compass = [[-1, -1], [-1, 0], [-1, 1], [0, -1], null, [0, 1], [1, -1], [1, 0], [1, 1]];
const arrowOf = { '-1,-1': '↖', '-1,0': '↑', '-1,1': '↗', '0,-1': '←', '0,1': '→', '1,-1': '↙', '1,0': '↓', '1,1': '↘' };
// the discs one direction would flip: a run of the other colour closed off by your own
function rayFlips(board, i, player, dr, dc) {
  const line = [];
  let r = Math.floor(i / 8) + dr, c = (i % 8) + dc;
  while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === other(player)) { line.push(r * 8 + c); r += dr; c += dc; }
  return line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === player ? line : [];
}
const cBoard = ref(newBoard());
const cTurn = ref(black);
const cSquare = ref(19);
const cLog = ref('');
const cChecks = computed(() => compass.map(d => {
  if (!d) return null;
  const empty = !cBoard.value[cSquare.value];
  return { d, arrow: arrowOf[d.join()], flips: empty ? rayFlips(cBoard.value, cSquare.value, cTurn.value, ...d) : [] };
}));
const cFlips = computed(() => cChecks.value.flatMap(c => c?.flips ?? []));
const cLegal = computed(() => legalMoves(cBoard.value, cTurn.value));
const cReadout = computed(() => {
  const i = cSquare.value, at = charOf[cBoard.value[i]];
  if (at !== 'U') return `${rc(i)} already holds ${at}, so it can’t be played.`;
  const ways = cChecks.value.filter(c => c?.flips.length);
  if (!ways.length) return `${rc(i)} is empty, but no direction closes off a line of ${charOf[other(cTurn.value)]}. Invalid move.`;
  return `${rc(i)} is valid for ${charOf[cTurn.value]}: it flips ${cFlips.value.length} going ${ways.map(c => c.arrow).join(' ')}.`;
});
// the board as the terminal printed it, one row per line
const cRows = computed(() => letters.split('').map((l, r) => ({ l, cells: cBoard.value.slice(r * 8, r * 8 + 8).map((v, c) => ({ i: r * 8 + c, ch: charOf[v] })) })));
function cPlay(i) {
  cSquare.value = i;
  if (!cLegal.value.includes(i)) return;
  const mover = cTurn.value;
  cBoard.value = play(cBoard.value, i, mover);
  cTurn.value = other(mover);
  cLog.value = `${charOf[mover]} played ${rc(i)}.`;
  if (gameOver(cBoard.value)) {
    const { [black]: b, [white]: w } = count(cBoard.value);
    cLog.value += ` Game over, ${b > w ? 'B wins' : w > b ? 'W wins' : 'a draw'} ${b} to ${w}.`;
  } else if (!legalMoves(cBoard.value, cTurn.value).length) {
    cLog.value += ` ${charOf[cTurn.value]} has no valid move and passes.`;
    cTurn.value = mover;
  }
}
function cReset() {
  cBoard.value = newBoard();
  cTurn.value = black;
  cSquare.value = 19;
  cLog.value = '';
}
// the preview's two bots: each turn one aims at the move that scores best for it once
// played, checks it in every direction, then plays it. a little noise breaks near ties
// so no two games go the same way
const cFigure = ref(null);
const cInView = useInView(cFigure);
let botTimer = 0;
const botWait = (ms, fn) => { botTimer = setTimeout(fn, ms); };
function botAim() {
  if (gameOver(cBoard.value)) { cReset(); return botWait(700, botAim); }
  const turn = cTurn.value;
  const scored = legalMoves(cBoard.value, turn).map(m => ({ m, score: evaluate(play(cBoard.value, m, turn), turn) + Math.random() * 6 }));
  const { m } = scored.reduce((a, b) => (b.score > a.score ? b : a));
  cSquare.value = m;
  // the finished board stays up a little longer before the next game
  botWait(700, () => { cPlay(m); botWait(gameOver(cBoard.value) ? 2000 : 700, botAim); });
}
watch(() => props.preview && cInView.value && !reducedMotion(), on => {
  clearTimeout(botTimer);
  if (on) botWait(700, botAim);
});
onBeforeUnmount(() => clearTimeout(botTimer));

// ---- weights: the positional table, with the corner rule ----
const taken = ref([]);
const pickedSquare = ref(0);
const kindOf = i => {
  const w = weights[i];
  const x = i % 8, y = Math.floor(i / 8);
  const edge = x === 0 || x === 7 || y === 0 || y === 7;
  if (w === 120) return 'corner';
  if (w === -40) return 'x';
  if (w === -20) return 'c';
  if (w === 20) return 'a';
  if (w === 15) return 'inner';
  if (w === 5 && edge) return 'b';
  if (w === -5) return 'ring';
  return 'centre';
};
const cornerOf = i => nextToCorner.find(([square]) => square === i)?.[1];
const safe = i => cornerOf(i) !== undefined && taken.value.includes(cornerOf(i));
const weightAt = i => (safe(i) ? 5 : weights[i]);
const squareText = {
  corner: 'A corner. A disc here can never be flipped back, and it anchors the two edges beside it. Click a corner to take it.',
  x: 'An X-square, diagonal to the corner. Playing here almost always lets the opponent take the corner.',
  c: 'A C-square, beside the corner on the edge. Risky for the same reason while the corner is still empty.',
  a: 'Two in from a corner on the edge. Edges are hard to flip, and this one doesn’t open the corner up.',
  b: 'The middle of an edge. Fairly stable, worth a little.',
  inner: 'Diagonal from the X-square, just inside. Safe, and it tends to force the opponent toward the edge.',
  ring: 'One in from the edge. Playing here often gives the opponent a move onto the edge.',
  centre: 'The middle. Everything here flips back and forth all game, so it barely counts.',
};
const squareNote = computed(() => {
  const i = pickedSquare.value;
  if (safe(i)) return `Its corner, ${nameOf(cornerOf(i))}, is taken, so this square can’t give it away any more. It drops to a plain 5.`;
  return squareText[kindOf(i)];
});
const tint = i => {
  if (safe(i)) return 'safe';
  return kindOf(i);
};
function toggleCorner(i) {
  pickedSquare.value = i;
  if (!corners.includes(i)) return;
  taken.value = taken.value.includes(i) ? taken.value.filter(c => c !== i) : [...taken.value, i];
}

// ---- eval: one move, scored part by part ----
const evalBoard = ref(randomPosition(figureRandom, 18));
const scored = computed(() => legalMoves(evalBoard.value, white).map(m => ({ m, parts: evaluateParts(play(evalBoard.value, m, white), white) })));
const bestScored = computed(() => scored.value.reduce((a, b) => (b.parts.total > a.parts.total ? b : a)));
const pickedMove = ref(null);
const shown = computed(() => scored.value.find(s => s.m === pickedMove.value) ?? bestScored.value);
const shownFlips = computed(() => flipsFor(evalBoard.value, shown.value.m, white));
const partNames = [
  { key: 'position', label: 'Position', note: 'the weights of every square each side holds' },
  { key: 'mobility', label: 'Mobility', note: 'its moves against yours, as a share, × 0.8' },
  { key: 'corners', label: 'Corners', note: '25 for each corner it owns, −25 for each of yours' },
  { key: 'parity', label: 'Disc count', note: 'only once 13 or fewer squares are empty' },
];
const barScale = computed(() => Math.max(1, ...scored.value.flatMap(s => partNames.map(p => Math.abs(s.parts[p.key])))));
const bar = v => ({ width: `${(Math.abs(v) / barScale.value) * 50}%`, [v < 0 ? 'right' : 'left']: '50%' });
const scoreAt = computed(() => Object.fromEntries(scored.value.map(s => [s.m, s.parts.total])));
function playBest() {
  let board = play(evalBoard.value, bestScored.value.m, white);
  // you answer at random, and pass if you have to, until it's clippy's turn with a choice
  for (let turn = black; !gameOver(board); turn = other(turn)) {
    const moves = legalMoves(board, turn);
    if (turn === white && moves.length >= 2) break;
    if (moves.length) board = play(board, moves[Math.floor(figureRandom() * moves.length)], turn);
  }
  if (gameOver(board) || legalMoves(board, white).length < 2) board = randomPosition(figureRandom, 18);
  evalBoard.value = board;
  pickedMove.value = null;
}
function newEvalPosition() {
  evalBoard.value = randomPosition(figureRandom, 12 + Math.floor(figureRandom() * 16));
  pickedMove.value = null;
}

// ---- lookahead: the move that looks best now, against the move whose worst reply is best ----
function lookahead(board) {
  return legalMoves(board, white).map(m => {
    const after = play(board, m, white);
    const now = evaluate(after, white);
    const replies = legalMoves(after, black).map(r => ({ r, score: evaluate(play(after, r, black), white) })).sort((a, b) => a.score - b.score);
    // no reply means you pass, and the board stays as it is
    return { m, after, now, replies, worst: replies.length ? replies[0].score : now };
  });
}
const argmax = (list, key) => list.reduce((a, b) => (b[key] > a[key] ? b : a));
// keep to positions where looking ahead changes the answer, since that's the point
const disagrees = board => { const t = lookahead(board); return argmax(t, 'now').m !== argmax(t, 'worst').m; };
const treeBoard = ref(randomPosition(figureRandom, 16, disagrees));
const deep = ref(true);
const tree = computed(() => lookahead(treeBoard.value));
const greedyPick = computed(() => argmax(tree.value, 'now').m);
const deepPick = computed(() => argmax(tree.value, 'worst').m);
const chosen = computed(() => (deep.value ? deepPick.value : greedyPick.value));
// four candidates at most: both picks, then the rest by how they hold up
const candidates = computed(() => {
  const keep = [greedyPick.value, deepPick.value];
  const rest = tree.value.filter(c => !keep.includes(c.m)).sort((a, b) => b.worst - a.worst);
  const list = [...tree.value.filter(c => keep.includes(c.m)), ...rest].slice(0, 4);
  return list.sort((a, b) => a.m - b.m);
});
const colX = k => 70 + k * 140;
const peeked = ref(null);
// the path lit green: down to whatever you picked, or to the move clippy plays. a move
// on its own lights its worst reply too once looking two ahead
const litPath = computed(() => {
  const m = peeked.value?.m ?? chosen.value;
  const c = tree.value.find(t => t.m === m);
  const r = peeked.value?.r ?? (deep.value ? c?.replies[0]?.r : undefined);
  return { m, r };
});
// every edge in the tree, the lit path drawn last so the grey never covers it
const edges = computed(() => {
  const lit = litPath.value;
  const list = candidates.value.flatMap((c, k) => [
    { key: `e${c.m}`, d: `M280 34V48H${colX(k)}V74`, lit: c.m === lit.m },
    ...c.replies.slice(0, 3).map((r, j) => ({ key: `r${c.m}-${r.r}`, d: `M${colX(k)} 116V130H${colX(k) + (j - 1) * 44}V146`, lit: c.m === lit.m && r.r === lit.r, dim: !deep.value })),
  ]);
  return [...list.filter(e => !e.lit), ...list.filter(e => e.lit)];
});
const previewBoard = computed(() => {
  const p = peeked.value;
  const c = tree.value.find(t => t.m === (p?.m ?? chosen.value));
  if (!c) return { board: treeBoard.value, marks: [] };
  if (p?.r !== undefined) return { board: play(c.after, p.r, black), marks: [c.m, p.r] };
  return { board: c.after, marks: [c.m] };
});
const treeNote = computed(() => {
  const p = peeked.value;
  const g = tree.value.find(t => t.m === greedyPick.value), d = tree.value.find(t => t.m === deepPick.value);
  if (p?.r !== undefined) return `Clippy plays ${nameOf(p.m)}, you answer ${nameOf(p.r)}: the board is worth ${signed(tree.value.find(t => t.m === p.m).replies.find(x => x.r === p.r).score)} to Clippy.`;
  if (p) {
    const c = tree.value.find(t => t.m === p.m);
    return `${nameOf(c.m)} scores ${signed(c.now)} right away. ${c.replies.length ? `Your best answer, ${nameOf(c.replies[0].r)}, takes it to ${signed(c.worst)}.` : 'You would have to pass.'}`;
  }
  return deep.value
    ? `Looking two moves ahead, Clippy plays ${nameOf(d.m)}: its worst case, ${signed(d.worst)}, beats ${nameOf(g.m)}’s worst case of ${signed(g.worst)}.`
    : `Looking one move ahead, Clippy grabs ${nameOf(g.m)} for ${signed(g.now)}, the best score right now. Switch to two to see your reply.`;
});
function newTree() {
  treeBoard.value = randomPosition(figureRandom, 10 + Math.floor(figureRandom() * 20), disagrees);
  peeked.value = null;
}
</script>

<template>
  <figure v-if="figure === 'board'" ref="cFigure" class="rx-figure" :class="{ 'rx-preview': preview }">
    <figcaption><strong>Fig. 1</strong> The board in the terminal.</figcaption>
    <div class="rx-panel rx-split rx-c">
      <div class="rx-board" role="group" aria-label="Board">
        <button v-for="(cell, i) in cBoard" :key="i"
          :class="['rx-cell', 'felt', { picked: cSquare === i, flip: cFlips.includes(i) }]"
          :aria-label="`${rc(i)}: ${charOf[cell]}${cLegal.includes(i) ? ', valid move' : ''}`"
          @mouseenter="cSquare = i" @focus="cSquare = i" @click="cPlay(i)">
          <svg v-if="cell" class="rx-disc" viewBox="0 0 8 9" shape-rendering="crispEdges" aria-hidden="true">
            <path :d="discShape.outline" fill="#000"/><path :d="discShape.edge" :fill="discColors[cell].edge"/><path :d="discShape.face" :fill="discColors[cell].face"/>
          </svg>
          <i v-else-if="cLegal.includes(i)" class="rx-hint" aria-hidden="true"/>
        </button>
      </div>
      <pre class="rx-term" aria-hidden="true"><span class="rx-term-head">  {{ letters }}</span>
<template v-for="r in cRows" :key="r.l"><span class="rx-term-head">{{ r.l }} </span><span v-for="c in r.cells" :key="c.i" :class="{ on: cSquare === c.i, flip: cFlips.includes(c.i) }">{{ c.ch }}</span>
</template><span class="rx-term-prompt"><span class="rx-term-head">Enter move for colour {{ charOf[cTurn] }} (RowCol): </span>{{ rc(cSquare) }}</span></pre>
      <div class="rx-c-under">
        <div class="rx-check">
          <div class="rx-compass" aria-hidden="true">
            <span v-for="(c, k) in cChecks" :key="k" :class="{ mid: !c, hit: c?.flips.length }">{{ c ? (c.flips.length || c.arrow) : charOf[cTurn] }}</span>
          </div>
          <p class="rx-readout" aria-live="polite">
            <code>board[{{ Math.floor(cSquare / 8) }}][{{ cSquare % 8 }}] = '{{ charOf[cBoard[cSquare]] }}'</code>
            <span>{{ cReadout }}</span>
            <span v-if="cLog" class="rx-log">{{ cLog }}</span>
          </p>
        </div>
        <div class="rx-buttons">
          <button class="raised rx-button" @click="cReset">New game</button>
        </div>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'weights'" class="rx-figure">
    <figcaption><strong>Fig. 2</strong> The weight of every square.</figcaption>
    <div class="rx-panel rx-split">
      <div class="rx-board rx-weights" role="group" aria-label="Square weights">
        <button v-for="(w, i) in weights" :key="i" :class="['rx-cell', `w-${tint(i)}`, { picked: pickedSquare === i, corner: corners.includes(i) }]"
          :aria-label="`${nameOf(i)}: ${weightAt(i)}`" :aria-pressed="corners.includes(i) ? taken.includes(i) : undefined"
          @mouseenter="pickedSquare = i" @focus="pickedSquare = i" @click="toggleCorner(i)">
          <svg v-if="taken.includes(i)" class="rx-disc" viewBox="0 0 8 9" shape-rendering="crispEdges" aria-hidden="true">
            <path :d="discShape.outline" fill="#000"/><path :d="discShape.edge" :fill="discColors[black].edge"/><path :d="discShape.face" :fill="discColors[black].face"/>
          </svg>
          <span v-else>{{ weightAt(i) }}</span>
        </button>
      </div>
      <div class="rx-detail" aria-live="polite">
        <strong>{{ nameOf(pickedSquare) }} <code>{{ signed(weightAt(pickedSquare)) }}</code></strong>
        <p>{{ squareNote }}</p>
        <ul class="rx-key" aria-hidden="true">
          <li><i class="w-corner"/>corner</li><li><i class="w-a"/>good edge</li><li><i class="w-centre"/>neutral</li><li><i class="w-c"/>risky</li><li><i class="w-x"/>gives a corner away</li>
        </ul>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'eval'" class="rx-figure">
    <figcaption><strong>Fig. 3</strong> Clippy scoring its moves.</figcaption>
    <div class="rx-panel rx-split rx-eval">
      <div class="rx-board" role="group" aria-label="Clippy's legal moves">
        <button v-for="(cell, i) in evalBoard" :key="i" :disabled="scoreAt[i] === undefined"
          :class="['rx-cell', 'felt', { legal: scoreAt[i] !== undefined, picked: shown.m === i, best: bestScored.m === i, flip: shownFlips.includes(i) }]"
          :aria-label="scoreAt[i] !== undefined ? `${nameOf(i)}: ${signed(scoreAt[i])}` : nameOf(i)" @click="pickedMove = i">
          <svg v-if="cell" class="rx-disc" viewBox="0 0 8 9" shape-rendering="crispEdges" aria-hidden="true">
            <path :d="discShape.outline" fill="#000"/><path :d="discShape.edge" :fill="discColors[cell].edge"/><path :d="discShape.face" :fill="discColors[cell].face"/>
          </svg>
          <span v-else-if="scoreAt[i] !== undefined" class="rx-score">{{ signed(scoreAt[i]) }}</span>
        </button>
      </div>
      <div>
        <div class="rx-detail" aria-live="polite">
          <strong>{{ nameOf(shown.m) }} <code>{{ signed(shown.parts.total) }}</code><em v-if="shown.m === bestScored.m"> best</em></strong>
          <p>Flips {{ shownFlips.length }} disc{{ shownFlips.length === 1 ? '' : 's' }} (outlined).</p>
          <div v-for="p in partNames" :key="p.key" class="rx-part">
            <span>{{ p.label }} <code>{{ signed(shown.parts[p.key]) }}</code></span>
            <div class="rx-bar"><b :class="{ neg: shown.parts[p.key] < 0 }" :style="bar(shown.parts[p.key])"/></div>
            <small>{{ p.note }}</small>
          </div>
        </div>
        <div class="rx-buttons">
          <button class="raised rx-button" @click="playBest">Play the best</button>
          <button class="raised rx-button" @click="newEvalPosition">New position</button>
        </div>
      </div>
    </div>
  </figure>

  <figure v-else-if="figure === 'lookahead'" class="rx-figure">
    <figcaption><strong>Fig. 4</strong> Looking ahead a move.</figcaption>
    <div class="rx-panel">
      <div class="rx-buttons">
        <span class="rx-toggle" role="group" aria-label="How far ahead">
          <button class="raised rx-button" :class="{ pressed: !deep }" :aria-pressed="!deep" @click="deep = false; peeked = null">1 move ahead</button>
          <button class="raised rx-button" :class="{ pressed: deep }" :aria-pressed="deep" @click="deep = true; peeked = null">2 moves ahead</button>
        </span>
        <button class="raised rx-button" @click="newTree">New position</button>
      </div>
      <div class="rx-look">
      <div class="rx-tree">
        <svg viewBox="0 0 560 206" shape-rendering="crispEdges" role="group" aria-label="Look-ahead tree">
          <g class="rx-edges" aria-hidden="true">
            <path v-for="e in edges" :key="e.key" :class="{ lit: e.lit, dim: e.dim }" :d="e.d"/>
          </g>
          <g class="rx-node root"><rect x="220" y="6" width="120" height="28"/><text x="280" y="24">Clippy to move</text></g>
          <template v-for="(c, k) in candidates" :key="c.m">
            <g class="rx-node" :class="{ on: c.m === chosen, peek: peeked?.m === c.m && peeked?.r === undefined }" role="button" tabindex="0" :aria-label="`${nameOf(c.m)}: now ${signed(c.now)}, worst case ${signed(c.worst)}`"
              @click="peeked = { m: c.m }" @keydown.enter.space.prevent="peeked = { m: c.m }">
              <rect :x="colX(k) - 52" y="74" width="104" height="42"/>
              <text :x="colX(k)" y="90" class="big">{{ nameOf(c.m) }}</text>
              <text :x="colX(k)" y="108" :class="{ faint: deep }">now {{ signed(c.now) }}</text>
            </g>
            <g v-for="(r, j) in c.replies.slice(0, 3)" :key="r.r" class="rx-node reply" :class="{ worst: j === 0, dim: !deep, peek: peeked?.m === c.m && peeked?.r === r.r }"
              role="button" tabindex="0" :aria-label="`You reply ${nameOf(r.r)}: ${signed(r.score)}`" @click="peeked = { m: c.m, r: r.r }" @keydown.enter.space.prevent="peeked = { m: c.m, r: r.r }">
              <rect :x="colX(k) + (j - 1) * 44 - 20" y="146" width="40" height="34"/>
              <text :x="colX(k) + (j - 1) * 44" y="160">{{ nameOf(r.r) }}</text>
              <text :x="colX(k) + (j - 1) * 44" y="174">{{ signed(r.score) }}</text>
            </g>
            <text class="rx-worst" :class="{ dim: !deep }" :x="colX(k)" y="198">{{ c.replies.length > 3 ? `+${c.replies.length - 3} more · ` : '' }}worst {{ signed(c.worst) }}</text>
          </template>
        </svg>
      </div>
      <div class="rx-split rx-under">
        <div class="rx-board small" aria-hidden="true">
          <span v-for="(cell, i) in previewBoard.board" :key="i" :class="['rx-cell', 'felt', { mark: previewBoard.marks.includes(i) }]">
            <svg v-if="cell" class="rx-disc" viewBox="0 0 8 9" shape-rendering="crispEdges">
              <path :d="discShape.outline" fill="#000"/><path :d="discShape.edge" :fill="discColors[cell].edge"/><path :d="discShape.face" :fill="discColors[cell].face"/>
            </svg>
          </span>
        </div>
        <p class="rx-note" aria-live="polite">{{ treeNote }}</p>
      </div>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.rx-figure { margin: 18px 0 22px; font-family: 'Pixel MS Sans Serif', Tahoma, sans-serif; container-type: inline-size;
  --felt-cell: #1f7a45; --felt-line: #14512c; --felt-light: #2c9458; --felt-shade: #17613a; --wood-dark: #4b2c14; }
.rx-figure figcaption { margin-bottom: 8px; font-size: 12px; color: var(--muted); }
.rx-figure figcaption strong { color: var(--ink); margin-right: 4px; }
/* the same sunken panel as the fpga figures */
.rx-panel { --sunk-edge: var(--shadow); padding: 12px; background: var(--paper); border: 2px solid; border-color: var(--edge) var(--sunk-edge) var(--sunk-edge) var(--edge); box-shadow: inset 1px 1px var(--shadow); }
:root[data-theme="dark"] .rx-panel { --sunk-edge: var(--light); }
.rx-button { padding: 3px 10px; font: 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; color: var(--ink); }
/* a pair like the ascii / normal toggle: the one in use stays pressed in */
.rx-toggle { display: inline-flex; gap: 0; }
.rx-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.rx-panel > .rx-buttons:first-child { margin: 0 0 10px; }
.rx-split { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr); gap: 16px; align-items: start; }
@container (max-width: 480px) { .rx-split { grid-template-columns: minmax(0, 1fr); } .rx-board { max-width: 260px; } }

/* the board, drawn like the reversi app's: felt squares on a darker grid in a wood frame */
.rx-board { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; padding: 2px; background: var(--felt-line); box-shadow: 0 0 0 2px var(--wood-dark); }
.rx-cell {
  position: relative; display: grid; place-items: center; aspect-ratio: 1; min-width: 0; padding: 0; border: 0;
  font: bold 10px 'Courier New', monospace; color: #1b1b1b; cursor: default;
}
button.rx-cell:not(:disabled) { cursor: var(--classic-pointer, pointer); }
.rx-cell:focus-visible { outline: 2px dotted #ffffcc; outline-offset: -4px; }
.rx-cell.felt { background: var(--felt-cell); box-shadow: inset 2px 2px 0 var(--felt-light), inset -2px -2px 0 var(--felt-shade); }
.rx-disc { display: block; width: 72%; height: auto; aspect-ratio: 8 / 9; }

/* fig 1: valid squares get a faint dot, and the terminal printout beside the
   board follows the square being checked */
.rx-hint { display: block; width: 22%; aspect-ratio: 1; background: #0005; }
.rx-term { margin: 0; padding: 8px 10px; background: #000; color: #c0c0c0; font: 13px/1.25 'Courier New', monospace; overflow-x: auto; }
.rx-term-head { color: #808080; white-space: pre; }
.rx-term span:not(.rx-term-head, .rx-term-prompt) { display: inline-block; width: 1.4ch; text-align: center; }
/* the prompt wraps rather than widening the terminal past the board's rows */
.rx-term-prompt, .rx-term-prompt .rx-term-head { white-space: pre-wrap; }
/* no width of its own, so the terminal is only as wide as the board's rows */
.rx-term-prompt { display: block; width: 0; min-width: 100%; }
/* the board beside the terminal, the direction check and buttons under the terminal,
   or under both once the figure is narrow */
.rx-c { grid-template-areas: 'board term' 'board under'; row-gap: 10px; }
.rx-c > .rx-board { grid-area: board; }
.rx-c > .rx-term { grid-area: term; }
.rx-c > .rx-c-under { grid-area: under; }
.rx-c .rx-check { margin-top: 0; }
/* Give wide figures enough board width to fill the panel while keeping squares.
   The readout stretches beside the board, with its controls at the bottom. */
@container (min-width: 760px) {
  .rx-c, .rx-eval {
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  }
  .rx-c { grid-template-rows: auto minmax(0, 1fr); }
  :is(.rx-c, .rx-eval) > .rx-board {
    aspect-ratio: 1;
    grid-template-rows: repeat(8, minmax(0, 1fr));
  }
  .rx-c > .rx-c-under, .rx-eval > div:last-child {
    align-self: stretch;
    display: flex;
    flex-direction: column;
  }
  :is(.rx-c-under, .rx-eval > div:last-child) > .rx-buttons {
    margin-top: auto;
    padding-top: 10px;
  }
}
@container (max-width: 480px) {
  .rx-c { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'board term' 'under under'; column-gap: 12px; }
  .rx-c > .rx-board { max-width: none; }
  .rx-c > .rx-term { padding: 6px 8px; font-size: 11px; }
}
@container (max-width: 220px) { .rx-c { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'board' 'term' 'under'; } }
/* the projects card: the board as tall as the frame, the terminal and the direction
   check stacked beside it */
.rx-preview .rx-c { box-sizing: border-box; height: 375px; grid-template-columns: 343px minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
.rx-preview .rx-buttons { display: none; }
.rx-preview .rx-c > .rx-c-under { overflow: hidden; }
.rx-term span.on { background: #c0c0c0; color: #000; }
.rx-term span.flip { color: #ffe066; font-weight: bold; }
.rx-check { display: flex; gap: 12px; align-items: flex-start; margin-top: 10px; }
.rx-compass { display: grid; grid-template-columns: repeat(3, 20px); gap: 2px; flex: none; }
.rx-compass span { display: grid; place-items: center; height: 20px; background: var(--d-page-alt, #fffdf2); border: 1px solid var(--d-line, #999); font: bold 11px 'Courier New', monospace; color: var(--muted); }
.rx-compass span.hit { background: #1baf7a; border-color: #0d7a52; color: #fff; }
.rx-compass span.mid { background: var(--navy, #000080); border-color: var(--navy, #000080); color: #fff; }
.rx-readout { display: flex; flex-direction: column; gap: 4px; margin: 0; font-size: 13px; line-height: 1.4; }
.rx-readout code { font: bold 12px 'Courier New', monospace; color: var(--d-link, #000080); }
.rx-log { color: var(--muted); }

/* fig 2: each square tinted by its weight */
.w-corner { background: #e8b830; }
.w-a { background: #58b368; }
.w-inner { background: #7cc47f; }
.w-b, .w-safe { background: #a9d6a0; }
.w-centre { background: #cfe6c4; }
.w-ring { background: #f0c0a8; }
.w-c { background: #e0785a; }
.w-x { background: #b8322a; color: #fff; }
.rx-weights .rx-cell { box-shadow: inset 2px 2px 0 #fff5, inset -2px -2px 0 #0002; }
.rx-weights .rx-cell.picked { box-shadow: inset 0 0 0 2px #000, inset 0 0 0 4px #fff; }
.rx-weights .rx-cell.corner { cursor: var(--classic-pointer, pointer); }
.rx-key { display: flex; flex-wrap: wrap; gap: 4px 8px; margin: 10px 0 0; padding: 0; list-style: none; font-size: 11px; color: var(--muted); }
.rx-key li { display: flex; align-items: center; gap: 4px; }
.rx-key i { display: block; width: 10px; height: 10px; border: 1px solid #000; }

/* fig 3: the legal moves carry their score, the best one is ringed in gold */
.rx-cell.legal .rx-score { color: #fff; font-size: 9px; letter-spacing: -.5px; text-shadow: 1px 1px 0 #0008; }
.rx-cell.best { box-shadow: inset 0 0 0 2px #e8b830, inset 2px 2px 0 var(--felt-light); }
.rx-cell.felt.picked { background: #2a8c52; box-shadow: inset 0 0 0 2px #fff, inset 0 0 0 4px #000; }
.rx-cell.flip::after { content: ''; position: absolute; inset: 2px; border: 2px dashed #ffe066; pointer-events: none; }
.rx-detail { padding: 8px 10px; background: var(--d-page-alt, #fffdf2); border: 2px solid var(--d-line, #000); box-shadow: 3px 3px 0 var(--d-line, #000); }
.rx-detail strong { font-size: 13px; }
.rx-detail strong em { font-style: normal; font-size: 11px; color: #b8860b; }
.rx-detail p { margin: 4px 0 0; font-size: 13px; line-height: 1.5; }
.rx-detail code, .rx-part code { font: bold 12px 'Courier New', monospace; color: var(--d-link, #000080); }
.rx-part { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 0 8px; align-items: center; margin-top: 8px; font-size: 12px; }
.rx-part small { grid-column: 1 / -1; color: var(--muted); font-size: 11px; }
.rx-bar { position: relative; height: 10px; background: var(--paper); border: 1px solid var(--d-line, #999); }
.rx-bar::before { content: ''; position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--ink); }
.rx-bar b { position: absolute; top: 0; bottom: 0; background: #1baf7a; }
.rx-bar b.neg { background: #c0392b; }

/* fig 4: the tree scrolls sideways on a phone rather than shrinking unreadably */
.rx-tree { overflow-x: auto; }
.rx-tree svg { display: block; width: 100%; min-width: 520px; max-width: 720px; margin: 0 auto; }
/* wide: the board sits beside the tree at a readable size instead of under it */
.rx-look { display: grid; gap: 12px; }
@container (min-width: 820px) {
  .rx-look { grid-template-columns: minmax(0, 1fr) 240px; align-items: center; }
  .rx-look .rx-under { margin-top: 0; grid-template-columns: minmax(0, 1fr); }
}
.rx-edges path { fill: none; stroke: var(--d-line, #888); stroke-width: 2; }
.rx-edges path.lit { stroke: #1baf7a; stroke-width: 3; }
.rx-edges path.dim, .rx-node.dim, .rx-worst.dim { opacity: .3; }
.rx-node { cursor: var(--classic-pointer, pointer); outline: none; }
.rx-node.root { cursor: default; }
.rx-node rect { fill: var(--d-page-alt, #fffdf2); stroke: var(--ink); stroke-width: 2; }
.rx-node text { fill: var(--ink); font: 10px 'Courier New', monospace; text-anchor: middle; pointer-events: none; }
.rx-node text.big { font: bold 12px 'Pixel MS Sans Serif', Tahoma, sans-serif; }
.rx-node text.faint { fill: var(--muted); }
.rx-node.root text { font: bold 10px 'Pixel MS Sans Serif', Tahoma, sans-serif; }
.rx-node:hover rect { fill: #e2d4bd; }
.rx-node:focus-visible rect { stroke-dasharray: 3 2; }
.rx-node.reply.worst rect { stroke: #c0392b; }
.rx-node.on rect { fill: var(--navy, #000080); }
.rx-node.on text { fill: #fff; }
.rx-node.peek rect { stroke: #1baf7a; stroke-width: 3; }
.rx-worst { fill: var(--muted); font: 9px 'Courier New', monospace; text-anchor: middle; }
.rx-under { grid-template-columns: minmax(0, 180px) minmax(0, 1fr); }
.rx-board.small .rx-cell.mark { background: #2a8c52; box-shadow: inset 0 0 0 2px #ffe066; }
.rx-note { margin: 0; font-size: 13px; line-height: 1.5; }
</style>
