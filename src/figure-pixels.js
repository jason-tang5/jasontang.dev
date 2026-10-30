// draws the fishbowl writeup's figures the way the pond is drawn (koi-pond.js): a grid
// of little squares with letters in them, CELL px a square, in the fishbowl's colours.
// a figure is cols × rows squares, worked out in px at CELL a square and scaled to
// however wide its canvas is. its koi are painted by the pond's own painter, and the
// messages moving between things are little labelled nodes
import { koiPainter, palettes } from './koi-pond.js';

export const CELL = 10;

// the figures' colours beside the fishbowl's koi: its chat window's blues, pale water,
// and a green and red for saved and turned down
const colours = {
  light: {
    water: '#f5f9ff', ripple: '#d6e4f4', line: '#9db4cf', text: '#23344e', dim: '#6f8194',
    win: '#eef3fa', box: '#ffffff', title: '#3a6ea5', titleText: '#ffffff', who: '#315e91', own: '#507b38',
    good: '#1baf7a', bad: '#c0392b', accent: '#2f74c0', warn: '#fff6d9', warnText: '#765b2e', gravel: '#c9c0b2',
  },
  dark: {
    water: '#131922', ripple: '#223148', line: '#3d4f68', text: '#d3deec', dim: '#8a9bb0',
    win: '#1b222d', box: '#131922', title: '#24426b', titleText: '#ffffff', who: '#83b3e8', own: '#94cf74',
    good: '#1baf7a', bad: '#e05a4a', accent: '#7fb2ea', warn: '#3a3018', warnText: '#ecd9a6', gravel: '#4a4640',
  },
};

// the fishbowl's koi, a shade deeper than the hero card's so they show up on the
// figures' white panels
const koiColours = {
  light: { ...palettes.msnLight, body: '#b9cde6', ink: '#93acd0', fin: '#d6e2f0', outline: '#d6e2f0', line: '#9fb6d4', patch: ['#f0a35e', '#f6c08a'] },
  dark: { ...palettes.msnDark, body: '#3e5170', ink: '#5a7092', patch: ['#a06838', '#bd8350'] },
};

// a letter's slant along a circle at angle a, like the pond's ripples: flat at the top
// and bottom, upright at the sides
const along = a => (Math.abs(Math.sin(a)) > 0.85 ? '-' : Math.abs(Math.cos(a)) > 0.85 ? '|' : Math.sin(2 * a) > 0 ? '/' : '\\');

export function pixelCanvas(canvas, cols, rows) {
  const ctx = canvas.getContext('2d');
  const painter = koiPainter(ctx, CELL);
  const W = cols * CELL, H = rows * CELL;
  const font = bold => `${bold ? 'bold ' : ''}${CELL - 1}px 'Courier New', monospace`;
  let c = colours.light, fish = koiColours.light, dark = false;
  // the words' size in the figure's px: a little over a square tall, or bigger on a
  // narrow screen so they never come out smaller than 11px there. they're set in the
  // desktop's pixel font, which stays crisp that small where the squares' letters don't
  let letter = CELL + 1;
  const words = bold => `${bold ? 'bold ' : ''}${letter}px 'Pixel MS Sans Serif', Tahoma, sans-serif`;

  const draw = {
    W, H,
    get c() { return c; },
    // clears the canvas at its size on the page, ready to draw on. false while it isn't
    // laid out yet
    begin(isDark) {
      const width = canvas.clientWidth;
      if (!width) return false;
      const ratio = devicePixelRatio || 1;
      const height = width * rows / cols;
      if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
      if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
      const scale = ratio * width / W;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      letter = Math.max(CELL + 1, 11 * W / width);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      dark = isDark;
      c = isDark ? colours.dark : colours.light;
      fish = koiColours[isDark ? 'dark' : 'light'];
      return true;
    },
    // one square, its fill and letter in colours from c by name or as they are
    cell(col, row, fill, glyph, ink, alpha = 1, bold = true) {
      if (col < 0 || row < 0 || col >= cols || row >= rows) return;
      ctx.font = font(bold);
      painter.cell(col, row, c[fill] ?? fill, glyph, c[ink] ?? ink, alpha);
    },
    // a line of text on a row of squares, from its first square or centred on it. fill
    // shades span squares behind it first, solid so the words read cleanly on it
    text(col, row, str, ink = 'text', { fill = null, span = 0, centre = false, bold = true, alpha = 1 } = {}) {
      ctx.globalAlpha = alpha;
      if (fill && span) {
        ctx.fillStyle = c[fill] ?? fill;
        const tall = Math.max(CELL, letter + 3);
        ctx.fillRect(col * CELL, (row + 0.5) * CELL - tall / 2, span * CELL, tall);
      }
      ctx.font = words(bold);
      ctx.fillStyle = c[ink] ?? ink;
      ctx.textAlign = centre ? 'center' : 'left';
      ctx.fillText(str, centre ? (col + 0.5) * CELL : col * CELL + 2, (row + 0.5) * CELL + 0.5);
      ctx.textAlign = 'center';
      ctx.globalAlpha = 1;
    },
    // how many rows of squares a line of text takes: one, or two on a narrow screen
    // where the words are bigger than the squares
    get step() { return Math.ceil(letter / CELL - 0.25); },
    // how many letters of text fit across n squares
    fits: n => Math.floor(n * CELL / (letter * 0.6)),
    // a box of squares: a border of + - and |, and its inside filled
    box(c0, r0, c1, r1, { fill = 'box', edge = 'line', alpha = 1 } = {}) {
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const side = col === c0 || col === c1, end = row === r0 || row === r1;
          const glyph = side && end ? '+' : end ? '-' : side ? '|' : null;
          draw.cell(col, row, glyph ? null : fill, glyph, edge, alpha);
        }
      }
    },
    // squares along a line from (x0, y0) to (x1, y1) in px, each slanted the way it runs.
    // dashed leaves every other one out
    line(x0, y0, x1, y1, ink = 'line', { dashed = false, alpha = 1 } = {}) {
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (CELL * 0.7)));
      const a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
      const seen = new Set();
      for (let i = 0; i <= steps; i++) {
        const col = Math.floor((x0 + (x1 - x0) * i / steps) / CELL), row = Math.floor((y0 + (y1 - y0) * i / steps) / CELL);
        const key = `${col},${row}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (dashed && seen.size % 2 === 0) continue;
        draw.cell(col, row, null, along(a), ink, alpha);
      }
    },
    // a square tank ({ c0, r0, c1, r1 } in squares): water squares inside with a faint
    // scatter of dots, inside a border of + - and | in the state's colour
    tank(t, edge = 'line', { dim = 1 } = {}) {
      for (let row = t.r0; row <= t.r1; row++) {
        for (let col = t.c0; col <= t.c1; col++) {
          const side = col === t.c0 || col === t.c1, end = row === t.r0 || row === t.r1;
          if (side || end) draw.cell(col, row, null, side && end ? '+' : end ? '-' : '|', edge);
          else draw.cell(col, row, 'water', (col + row * 3) % 7 ? null : '·', 'ripple', dim);
        }
      }
    },
    // rings of slanted letters spreading out, like the pond's ripples
    ring(x, y, r, ink = 'accent', alpha = 1) {
      const dots = Math.max(8, Math.ceil(2 * Math.PI * r / CELL));
      const seen = new Set();
      for (let i = 0; i < dots; i++) {
        const a = i / dots * Math.PI * 2;
        const col = Math.floor((x + Math.cos(a) * r) / CELL), row = Math.floor((y + Math.sin(a) * r) / CELL);
        if (seen.has(`${col},${row}`)) continue;
        seen.add(`${col},${row}`);
        draw.cell(col, row, null, along(a), ink, alpha);
      }
    },
    // a message on its way somewhere: a bar a whole number of squares wide centred on
    // (x, y) in px
    // with its label on it, cut short to fit at most max squares
    node(x, y, label, ink = 'accent', { alpha = 1, max = 14 } = {}) {
      const room = draw.fits(max - 1);
      const shown = [...label].length > room ? `${[...label].slice(0, room - 1).join('')}…` : label;
      const n = Math.min(max, Math.ceil(([...shown].length * letter * 0.6 + 8) / CELL));
      const tall = draw.step;
      const c0 = Math.round(x / CELL - n / 2), r0 = Math.round(y / CELL - tall / 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = c[ink] ?? ink;
      ctx.fillRect(c0 * CELL, r0 * CELL - 2, n * CELL, tall * CELL + 4);
      ctx.font = words(true);
      ctx.fillStyle = dark ? c.water : '#ffffff';
      ctx.fillText(shown, (c0 + n / 2) * CELL, (r0 + tall / 2) * CELL + 0.5);
      ctx.globalAlpha = 1;
    },
    // a koi (figure-koi.js) painted by the pond's painter. one that lives in a tank
    // ({ c0, r0, c1, r1 }) shows only faintly where it swims out past the tank's edge
    koi(k, { fade = 1, within = null } = {}) {
      const alpha = Math.max(0, Math.min(1, fade));
      ctx.font = font(true);
      if (!within) painter.drawKoi(k, fish, W, H, alpha);
      else {
        const x = (within.c0 + 1) * CELL, y = (within.r0 + 1) * CELL;
        const inside = new Path2D();
        inside.rect(x, y, within.c1 * CELL - x, within.r1 * CELL - y);
        const outside = new Path2D(inside);
        outside.rect(0, 0, W, H);
        for (const [clip, shade] of [[inside, 1], [outside, 0.15]]) {
          ctx.save();
          ctx.clip(clip, 'evenodd');
          painter.drawKoi(k, fish, W, H, alpha * shade);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    },
  };
  return draw;
}

// a line of words broken into lines at most width letters long
export function wrap(str, width) {
  const lines = [];
  let line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if ([...next].length <= width) line = next;
    else {
      if (line) lines.push(line);
      line = [...word].length > width ? `${[...word].slice(0, width - 1).join('')}…` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
