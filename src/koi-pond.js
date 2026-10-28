// the koi pond wallpaper: big koi drawn as a grid of little shaded squares with letters
// in them, swimming around under the desktop. click the bare desktop and a few pellets
// land there with a ripple. any koi close enough turns and swims over, and each bite
// sends out a ripple of its own.
// the idea of ascii creatures swimming on a canvas comes from stackedlol/ascii-sharks
// (MIT), and the look from daoho.dev's pond. written fresh here for koi.
//
// the swimming, feeding and ripples are plain functions on a plain object (createPond,
// stepPond, feedPond) so they can be tested in node. createKoiPond draws them.

const SPACING = 6; // px between the spine points the body is drawn along
const SPINE = 77; // spine points, so a koi is about SPACING * SPINE = 462px long
const BODY = 51; // of those, the ones under the body. the rest carry the tail fin, half as long
const SEE_FOOD = 640; // px a koi notices pellets from
const BITE = 18; // px from the mouth close enough to eat
const PELLET_LIFE = 14; // seconds before an uneaten pellet sinks out of sight
const SPREAD = 75; // px/s a pellet starts spreading outward at, so it ends up about SPREAD * SPREAD_TIME / 3 px out
const SPREAD_TIME = 1; // seconds until a pellet stops moving
const FOOD_GAP = 16; // px kept between pellets, more than a grid square's diagonal
const RIPPLE_LIFE = 3.2; // seconds a ripple takes to fade
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// the smallest turn from angle a to angle b, between -π and π
const turnTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function createPond({ width, height, count = 5, random = Math.random } = {}) {
  const koi = Array.from({ length: count }, (_, i) => {
    const x = random() * width;
    const y = random() * height;
    const heading = random() * Math.PI * 2;
    // sizes spread evenly from little to big, give or take, so there's always a mix
    const size = 0.36 + 0.52 * (i + 0.2 + random() * 0.6) / count;
    return {
      x, y, heading, size,
      speed: 28 + random() * 14,
      // its markings, like a kohaku: often a cap on the head, one or two big uneven
      // patches over the back leaning to one side, and a few small dots scattered about
      spots: [
        ...random() < 0.6 ? [{ t: 0.07, across: (random() - 0.5) * 0.5, long: 0.05, wide: 0.6 }] : [],
        ...Array.from({ length: 1 + Math.floor(random() * 2) }, () => ({
          t: 0.2 + random() * 0.3,
          across: (random() < 0.5 ? -1 : 1) * random() * 0.4,
          long: 0.07 + random() * 0.07,
          wide: 0.55 + random() * 0.35,
        })),
        ...Array.from({ length: 2 + Math.floor(random() * 3) }, () => ({
          t: 0.15 + random() * 0.45,
          across: (random() - 0.5) * 1.6,
          long: 0.015 + random() * 0.01,
          wide: 0.14 + random() * 0.08,
        })),
      ].map(spot => ({ ...spot, phase: random() * Math.PI * 2 })),
      // how much redder than the usual orange its patches are
      deep: random() < 0.45 ? 0.35 + random() * 0.6 : 0,
      // where it drifts when there's nothing to eat, changed every so often
      wanderAt: random() * 6,
      wander: heading,
      phase: random() * Math.PI * 2,
      // 0 calm to 1 rushing for food: it beats its tail harder and faster, and surges
      excite: 0,
      wakeIn: 0.5 + random() * 1.5,
      // laid out straight behind it to start with
      spine: Array.from({ length: SPINE }, (_, n) => ({ x: x - Math.cos(heading) * n * SPACING * size, y: y - Math.sin(heading) * n * SPACING * size })),
    };
  });
  return { width, height, time: 0, koi, food: [], ripples: [], eaten: 0, random };
}

export function resizePond(pond, width, height) {
  pond.width = width;
  pond.height = height;
}

// a handful of pellets scattered around the click, and a ripple where they land. each
// one spreads outward from the click, slowing to a stop as it settles on the water
export function feedPond(pond, x, y, count = 4) {
  for (let i = 0; i < count; i++) {
    const angle = pond.random() * Math.PI * 2;
    const reach = pond.random() * 18;
    const push = SPREAD * (0.6 + pond.random() * 0.4);
    pond.food.push({
      x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach, age: 0, driftPhase: angle,
      vx: Math.cos(angle) * push, vy: Math.sin(angle) * push,
    });
  }
  pond.ripples.push({ x, y, age: 0, size: 1 });
}

// moves everything on by dt seconds
export function stepPond(pond, dt) {
  pond.time += dt;
  const { width, height } = pond;

  for (const k of pond.koi) {
    // the nearest pellet it can see, if any
    let target = null;
    let best = SEE_FOOD;
    for (const f of pond.food) {
      const d = Math.hypot(f.x - k.x, f.y - k.y);
      if (d < best) { best = d; target = f; }
    }

    let want;
    if (target) {
      want = Math.atan2(target.y - k.y, target.x - k.x);
    } else {
      k.wanderAt -= dt;
      if (k.wanderAt <= 0) {
        k.wander = k.heading + (pond.random() - 0.5) * 2;
        k.wanderAt = 3 + pond.random() * 5;
      }
      want = k.wander;
      // steer back in before swimming off an edge
      const margin = 90;
      if (k.x < margin || k.x > width - margin || k.y < margin || k.y > height - margin) {
        want = Math.atan2(height / 2 - k.y, width / 2 - k.x);
      }
    }

    // edge away from any other koi swimming over it, gently, so they drift apart
    // over time without ever swerving hard. a koi after food barely bothers
    let awayX = 0, awayY = 0;
    for (const other of pond.koi) {
      if (other === k) continue;
      const room = 70 * (k.size + other.size);
      for (let n = 0; n < BODY; n += 8) {
        const p = other.spine[n];
        const dx = k.x - p.x, dy = k.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < room) {
          awayX += dx / d * (1 - d / room);
          awayY += dy / d * (1 - d / room);
        }
      }
    }
    if (awayX || awayY) {
      const push = (target ? 0.15 : 0.6) * Math.min(1, Math.hypot(awayX, awayY));
      want = Math.atan2(Math.sin(want) * (1 - push) + awayY * push, Math.cos(want) * (1 - push) + awayX * push);
    }

    // a koi gets excited quickly when it spots food and calms down slowly after.
    // excited koi turn harder and beat their tails faster and wider, surging
    // forward on each stroke
    k.excite = clamp(k.excite + (target ? dt * 2.5 : -dt * 0.5), 0, 1);
    const stroke = 1 + 0.5 * k.excite * Math.max(0, Math.sin(k.phase));
    // closing in on a pellet it slows down and turns tighter, nibbling its way between
    // the scattered food instead of looping wide round each one
    const near = target ? clamp(1 - best / 150, 0, 1) : 0;
    const speed = k.speed * (1 + 1.2 * k.excite) * stroke * (1 - 0.6 * near);
    // away from food, never tighter than a circle about 40% of its length across, so
    // even an excited koi swings round in a wide arc instead of folding back on itself
    const turnRate = Math.min(0.7 + 1.8 * k.excite, speed / (90 * k.size * (1 - 0.8 * near)));
    k.heading += clamp(turnTo(k.heading, want), -turnRate * dt, turnRate * dt);
    k.x += Math.cos(k.heading) * speed * dt;
    k.y += Math.sin(k.heading) * speed * dt;
    k.phase += dt * (3.5 + 6.5 * k.excite);

    // the head drops a spine point every SPACING px it swims, so the body follows the
    // path the head took and keeps its length
    const spacing = SPACING * k.size;
    const lead = k.spine[0];
    const gone = Math.hypot(k.x - lead.x, k.y - lead.y);
    if (gone >= spacing) {
      const steps = Math.floor(gone / spacing);
      for (let n = 1; n <= steps; n++) {
        k.spine.unshift({ x: lead.x + (k.x - lead.x) / gone * spacing * n, y: lead.y + (k.y - lead.y) / gone * spacing * n });
      }
      k.spine.length = SPINE;
    }

    // Surface disturbances, staggered independently for each koi. A koi rushing
    // for food churns the water far more often, and a little harder.
    if (speed > 0) k.wakeIn -= dt;
    if (target) k.wakeIn = Math.min(k.wakeIn, 0.6);
    if (speed > 0 && k.wakeIn <= 0) {
      k.wakeIn = target ? 0.3 + pond.random() * 0.3 : 1.2 + pond.random() * 1.4;
      const tail = swimmingSpine(k).at(-1);
      pond.ripples.push({
        x: tail.x,
        y: tail.y,
        age: 0, size: (target ? 0.9 : 0.75) * k.size, wake: true,
      });
    }

    // it eats every pellet its mouth passes over, not just the one it's after
    for (const f of pond.food.filter(f => Math.hypot(f.x - k.x, f.y - k.y) < BITE)) {
      pond.food.splice(pond.food.indexOf(f), 1);
      pond.ripples.push({ x: f.x, y: f.y, age: 0, size: 0.6 });
      pond.eaten++;
    }
  }

  // a pellet spreads outward from where it landed, fast at first and easing to a dead
  // stop SPREAD_TIME seconds in, then stays put
  for (const f of pond.food) {
    const left = Math.max(0, 1 - f.age / SPREAD_TIME);
    f.x = clamp(f.x + f.vx * left * left * dt, 0, width);
    f.y = clamp(f.y + f.vy * left * left * dt, 0, height);
    f.age += dt;
  }
  // pellets still spreading ease away from any too close, so no two ever sit in the
  // same square. a settled pellet holds still and the new one does the moving
  for (let i = 0; i < pond.food.length; i++) {
    for (let j = i + 1; j < pond.food.length; j++) {
      const a = pond.food[i], b = pond.food[j];
      const moveA = a.age < SPREAD_TIME, moveB = b.age < SPREAD_TIME;
      if (!moveA && !moveB) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (!(d < FOOD_GAP)) continue;
      if (!d) { dx = Math.cos(b.driftPhase); dy = Math.sin(b.driftPhase); d = 1; }
      const push = (FOOD_GAP - d) / (moveA && moveB ? 2 : 1) * Math.min(1, dt * 8);
      if (moveA) { a.x = clamp(a.x - dx / d * push, 0, width); a.y = clamp(a.y - dy / d * push, 0, height); }
      if (moveB) { b.x = clamp(b.x + dx / d * push, 0, width); b.y = clamp(b.y + dy / d * push, 0, height); }
    }
  }
  pond.food = pond.food.filter(f => f.age < PELLET_LIFE);
  for (const r of pond.ripples) r.age += dt;
  pond.ripples = pond.ripples.filter(r => r.age < RIPPLE_LIFE);
}

// how far the body reaches either side of the spine at t (0 the nose, 1 the tail tip),
// as a share of its widest point: a blunt round head into a full middle, then a curved
// taper down to a narrow tail
export function halfWidth(t) {
  if (t < 0.3) return Math.cbrt(1 - (Math.abs(t - 0.3) / 0.32) ** 3);
  if (t < 0.82) return 1 - 0.88 * ((t - 0.3) / 0.52) ** 1.5;
  return 0.12;
}

function swimmingSpine(k) {
    // Interpolate between stored path samples every display frame, rather than
    // holding the body still until the head crosses the next six-pixel sample.
    const fraction = clamp(Math.hypot(k.x - k.spine[0].x, k.y - k.spine[0].y) / (SPACING * k.size), 0, 1);
    const flowing = k.spine.map((p, i, spine) => i === 0
      ? { x: k.x, y: k.y }
      : { x: p.x + (spine[i - 1].x - p.x) * fraction,
          y: p.y + (spine[i - 1].y - p.y) * fraction });
    // the back half of the spine swings side to side, so the tail swishes
    return flowing.map((p, i, spine) => {
      const t = i / (spine.length - 1);
      if (t < 0.55) return p;
      const next = spine[Math.min(i + 1, spine.length - 1)];
      const prev = spine[i - 1];
      const nx = -(next.y - prev.y);
      const ny = next.x - prev.x;
      const n = Math.hypot(nx, ny) || 1;
      // easing in from nothing, so the tail bends in one smooth curve
      // big koi swing a little wider for their size, or their tails look stiff
      const sway = Math.sin(k.phase - t * 6) * ((t - 0.55) / 0.45) ** 2 * 16 * k.size * (0.7 + 0.6 * k.size) * (1 + 0.9 * k.excite);
      return { x: p.x + nx / n * sway, y: p.y + ny / n * sway };
    });

}

const palettes = {
  dark: {
    water: '#1c1b19',
    body: '#88837d',
    ink: '#6f6b66', // the letters on the body
    patch: ['#b5552a', '#d98a3c'],
    red: ['#8c1c14', '#d4442e'], // the patches' shades on the redder koi
    fin: '#3a3936',
    outline: '#3a3936',
    ring: [0.8, 0.35], // how strong the outline is on its inside and outside edge
    eye: '#050505',
    line: '#8e8b85',
    food: '#c8914a',
    ripple: '#6f6c66',
    glow: '#3e3b37', // screened over the squares the mouse trail passes
  },
  // pale water with mid grey koi, their outline a paler grey that melts into it
  light: {
    water: '#ecebe6',
    body: '#948f88',
    ink: '#625d57',
    patch: ['#e08a4a', '#f4ab63'],
    red: ['#b8291e', '#ee5d40'],
    fin: '#c4c0b9',
    outline: '#c4c0b9',
    ring: [0.8, 0.35],
    eye: '#050505',
    line: '#8a857e',
    food: '#a8702e',
    ripple: '#96918a',
    glow: '#8a8680',
  },
};

const mix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${[ch(16), ch(8), ch(0)].map(c => c.toString(16).padStart(2, '0')).join('')}`;
};

// draws the pond on a canvas and runs it. returns { feed, touch, setDark, destroy }.
// touch(x, y) adds to the mouse trail, a line of bright spots that shrink over a second
// like the sunset wallpaper's.
// veils, if given, returns boxes ({ x, y, width, height } on the canvas) to dim the
// squares under, so the desktop icons and their labels can be read over the fish.
// a hollow box (a window, which hides the pond under it anyway) only washes the
// squares around its edge
export function createKoiPond(canvas, { dark = false, veils = () => [] } = {}) {
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const CELL = 11; // px per grid square
  let palette = dark ? palettes.dark : palettes.light;
  let width = 0;
  let height = 0;
  let pond = null;
  let frame = 0;
  let last = 0;
  const trail = [];
  const TRAIL_LIFE = 1000;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = devicePixelRatio || 1;
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!pond) pond = createPond({ width, height, count: clamp(Math.round(width * height / 260000) + 3, 6, 10) });
    else resizePond(pond, width, height);
  }

  function cell(col, row, fill, glyph, ink, alpha = 1) {
    ctx.globalAlpha = alpha;
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(col * CELL + 1, row * CELL + 1, CELL - 2, CELL - 2);
    }
    if (glyph) {
      ctx.fillStyle = ink;
      ctx.fillText(glyph, col * CELL + CELL / 2, row * CELL + CELL / 2 + 0.5);
    }
  }

  // a letter at a point, snapped to the grid like everything else
  function mark(x, y, glyph, ink, alpha = 1) {
    cell(Math.floor(x / CELL), Math.floor(y / CELL), null, glyph, ink, alpha);
  }

  // the spine point nearest (x, y): how far along it is (t, 0 to 1) and how far to the
  // side, signed so the koi's left and right differ
  function nearest(spine, x, y) {
    let best = Infinity;
    let at = 0;
    let side = 0;
    for (let i = 0; i < spine.length - 1; i++) {
      const a = spine[i];
      const b = spine[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = dx * dx + dy * dy || 1;
      const u = clamp(((x - a.x) * dx + (y - a.y) * dy) / len, 0, 1);
      const d = (x - (a.x + dx * u)) ** 2 + (y - (a.y + dy * u)) ** 2;
      if (d < best) {
        best = d;
        at = (i + u) / (spine.length - 1);
        side = Math.sign(dx * (y - a.y) - dy * (x - a.x));
      }
    }
    const distance = Math.sqrt(best);
    return { t: at, side: side * distance, distance };
  }

  function drawKoi(k) {
    const WIDEST = 60 * k.size;
    const swayed = swimmingSpine(k);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of swayed) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const pad = WIDEST * 2.3 + CELL;
    const c0 = Math.max(0, Math.floor((minX - pad) / CELL)), c1 = Math.min(Math.ceil(width / CELL), Math.ceil((maxX + pad) / CELL));
    const r0 = Math.max(0, Math.floor((minY - pad) / CELL)), r1 = Math.min(Math.ceil(height / CELL), Math.ceil((maxY + pad) / CELL));

    ctx.font = `bold ${CELL - 3}px 'Courier New', monospace`;
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const near = nearest(swayed, (col + 0.5) * CELL, (row + 0.5) * CELL);
        const { side, distance } = near;
        // where along the fish: 0 to 0.8 over the body, then 0.8 to 1 down the tail fin
        const body = BODY / (SPINE - 1);
        const t = near.t < body ? near.t / body * 0.8 : 0.8 + (near.t - body) / (1 - body) * 0.2;
        // A long forked fin down the end of the spine, so it bends with the tail.
        // The two lobes fan out in a curve from a narrow root, with a rounded notch
        // between them.
        const along = (t - 0.8) / 0.2;
        const lateral = distance;
        // its edges ripple in a wave running back down the fin, so it flows
        const flow = 1 + 0.14 * along * Math.sin(along * 9 - k.phase * 1.5);
        const outer = WIDEST * (0.16 + 1.25 * Math.sin(along * Math.PI / 2)) * flow;
        const inner = Math.max(0, (along - 0.5) / 0.5) ** 1.5 * WIDEST * 0.75 * flow;
        if (along >= 0 && t < 0.9999 && lateral <= outer && lateral >= inner) {
          // dark squares with faint dots, melting into the water toward the rim and
          // the tips,
          // with pale rays streaming back through each lobe, like the side fins
          const rim = clamp((outer - lateral) / (CELL * 1.5), 0, 1);
          const fade = (0.75 - 0.35 * along) * (0.4 + 0.6 * rim) * clamp((1 - along) / 0.15, 0, 1);
          const ray = (lateral / outer * 5) % 1 < 0.3;
          cell(col, row, ray ? mix(palette.fin, palette.body, 0.45) : palette.fin, null, null, fade);
          cell(col, row, null, ray ? ':' : '·', palette.line, (ray ? 0.55 : 0.35) * fade);
          continue;
        }
        // Stop the body at the tail root so it cannot fill the V-shaped notch.
        if (t > 0.8 || t <= 0.001 && distance > WIDEST * 0.55) continue;
        const reach = halfWidth(t) * WIDEST * 1.1; // the body is plumper than the fins and tail are sized for
        const across = distance / reach;

        // Big swept-back pectoral fins behind the head and small pelvic fins halfway
        // down, each a fan of pale rays on a see-through web that flutters as it swims.
        for (const fin of [{ from: 0.16, to: 0.28, sweep: 0.16, length: 1.05 }, { from: 0.48, to: 0.55, sweep: 0.08, length: 0.55 }]) {
          const flutter = 0.9 + Math.sin(k.phase * 0.8 + Math.sign(side) * 0.7) * 0.12;
          const out = (distance - reach * 0.85) / (WIDEST * fin.length * flutter);
          if (out < 0 || out >= 1) continue;
          const lo = fin.from + fin.sweep * out;
          const hi = fin.to + fin.sweep * 1.4 * out;
          const across = (t - lo) / (hi - lo);
          // the far edge rounds off instead of ending square
          if (across < 0 || across > 1 || out > 1 - 0.6 * (2 * across - 1) ** 2) continue;
          const ray = (across * 5) % 1 < 0.35;
          const fade = clamp((1 - out) / 0.35, 0, 1) * clamp(Math.min(across, 1 - across) / 0.2, 0, 1);
          cell(col, row, mix(palette.fin, palette.body, ray ? 0.5 : 0.18), ray ? ':' : '·', palette.line, (ray ? 0.7 : 0.45) * fade);
          break;
        }
        if (across > 1) continue;

        // a ring of dark squares about a square thick outlines the pale body, so each
        // fish stands out clearly, softening outward into the water
        if (distance > reach - CELL) {
          const fade = palette.ring[0] - (palette.ring[0] - palette.ring[1]) * (distance - (reach - CELL)) / CELL;
          cell(col, row, palette.outline, '·', palette.line, fade);
          continue;
        }
        // each patch is a blob whose edge bulges in and out around it, so none are
        // plain ovals
        // how deep inside a patch this square is: 0 at its middle, 1 at its edge
        let spot = Infinity;
        for (const p of k.spots) {
          const u = (t - p.t) / p.long, v = (side / reach - p.across) / p.wide;
          const angle = Math.atan2(v, u);
          spot = Math.min(spot, (u * u + v * v) / (1 + 0.35 * Math.sin(3 * angle + p.phase) + 0.2 * Math.sin(5 * angle + p.phase * 2)));
        }
        if (spot < 1) {
          // brightest in the middle of a patch, deeper toward its edge and down the
          // curve of the body's sides, with a little grain that moves with the fish
          const grain = 0.08 * Math.sin(t * 170 + side * 0.35);
          const shade = clamp((1 - 0.55 * spot) * (1 - 0.3 * across * across) + grain, 0, 1);
          // some koi are born with redder patches than others
          const dark = mix(palette.patch[0], palette.red[0], k.deep), light = mix(palette.patch[1], palette.red[1], k.deep);
          cell(col, row, mix(dark, light, shade), (col + row) % 2 ? 'X' : 'S', mix(dark, '#000000', 0.25 + 0.2 * (1 - shade)));
        } else {
          // the pale body darkens into a slim stalk where it meets the tail fin
          const stalk = clamp((t - 0.62) / 0.14, 0, 1);
          const fill = mix(palette.fin, palette.body, 1 - stalk);
          cell(col, row, fill, (col * 7 + row) % 3 ? 'S' : '%', mix(palette.line, palette.ink, 1 - stalk));
        }
      }
    }

    // eyes either side of the head, and the barbels sweeping forward from the mouth
    const head = swayed[0];
    const behind = swayed[4];
    const length = Math.hypot(head.x - behind.x, head.y - behind.y) || 1;
    const fx = (head.x - behind.x) / length, fy = (head.y - behind.y) / length; // forward
    const sx = -fy, sy = fx; // to the side
    for (const s of [-1, 1]) {
      const ex = head.x - fx * CELL * 0.6 + sx * s * WIDEST * 0.5;
      const ey = head.y - fy * CELL * 0.6 + sy * s * WIDEST * 0.5;
      cell(Math.floor(ex / CELL), Math.floor(ey / CELL), palette.eye, null, null, 0.8);
      mark(ex, ey, 'o', '#ffffff', 0.4);
      const wiggle = Math.sin(k.phase * 0.7 + s) * 0.3;
      // the barbel's slant on screen, from which way it points
      const dx = fx + sx * s * (0.5 + wiggle);
      const dy = fy + sy * s * (0.5 + wiggle);
      const lean = Math.abs(dx) > 2 * Math.abs(dy) ? '-' : Math.abs(dy) > 2 * Math.abs(dx) ? '|' : dx * dy > 0 ? '\\' : '/';
      for (let n = 1; n <= 2; n++) {
        mark(head.x + fx * CELL * (0.6 + n * 0.7) + sx * s * (WIDEST * 0.35 + n * CELL * (0.5 + wiggle)),
          head.y + fy * CELL * (0.6 + n * 0.7) + sy * s * (WIDEST * 0.35 + n * CELL * (0.5 + wiggle)), lean, palette.line, 0.35);
      }
    }
  }

  function draw() {
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.water;
    ctx.fillRect(0, 0, width, height);

    for (const k of pond.koi) drawKoi(k);

    // each pellet is a little o floating on top of the fish, snapped to the grid
    ctx.font = `bold ${CELL}px 'Courier New', monospace`;
    for (const f of pond.food) mark(f.x, f.y, 'o', palette.food, Math.max(0, 1 - f.age / PELLET_LIFE));

    // ripples: rings of letters spreading out and fading
    ctx.font = `bold ${CELL - 3}px 'Courier New', monospace`;
    for (const r of pond.ripples) {
      const progress = r.age / RIPPLE_LIFE;
      const radius = 8 + progress * 150 * r.size;
      const dots = Math.max(12, Math.ceil(2 * Math.PI * radius / CELL));
      const occupied = new Set();
      for (let i = 0; i < dots; i++) {
        const a = i / dots * Math.PI * 2;
        const x = r.x + Math.cos(a) * radius;
        const y = r.y + Math.sin(a) * radius;
        const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
        if (occupied.has(key)) continue;
        occupied.add(key);
        // Tangential strokes follow the circle: horizontal at top/bottom, vertical at the sides.
        const glyph = Math.abs(Math.sin(a)) > 0.85 ? '-' : Math.abs(Math.cos(a)) > 0.85 ? '|' : Math.sin(2 * a) > 0 ? '/' : '\\';
        mark(x, y, glyph, palette.ripple, (1 - progress) * (r.wake ? 0.65 : 1));
      }
    }

    // the mouse trail: squares near each recent point are screened brighter, the spots
    // shrinking steeply as they age and easing off toward their edge
    const now = performance.now();
    while (trail.length && now - trail[0].time >= TRAIL_LIFE) trail.shift();
    if (trail.length) {
      const lit = new Map();
      const reach = Math.max(24, Math.max(width, height) * 0.04);
      for (const p of trail) {
        const radius = reach * (1 - (now - p.time) / TRAIL_LIFE) ** 6;
        if (radius < CELL / 2) continue;
        const c0 = Math.max(0, Math.floor((p.x - radius) / CELL)), c1 = Math.floor((p.x + radius) / CELL);
        const r0 = Math.max(0, Math.floor((p.y - radius) / CELL)), r1 = Math.floor((p.y + radius) / CELL);
        for (let row = r0; row <= r1; row++) {
          for (let col = c0; col <= c1; col++) {
            const d = Math.hypot((col + 0.5) * CELL - p.x, (row + 0.5) * CELL - p.y) / radius;
            if (d >= 1) continue;
            const key = row * 10000 + col;
            const alpha = 1 - d * d;
            if (alpha > (lit.get(key) ?? 0)) lit.set(key, alpha);
          }
        }
      }
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = palette.glow;
      for (const [key, alpha] of lit) {
        ctx.globalAlpha = alpha;
        ctx.fillRect(key % 10000 * CELL, Math.floor(key / 10000) * CELL, CELL, CELL);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // wash each square under a veil back toward the water, fully in the middle of the
    // box and easing off toward its edges and a few squares past them
    const washed = new Map();
    const soft = CELL * 3;
    for (const v of veils()) {
      const c0 = Math.max(0, Math.floor((v.x - soft) / CELL)), c1 = Math.ceil((v.x + v.width + soft) / CELL);
      const r0 = Math.max(0, Math.floor((v.y - soft) / CELL)), r1 = Math.ceil((v.y + v.height + soft) / CELL);
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const cx = (col + 0.5) * CELL, cy = (row + 0.5) * CELL;
          // skip straight across the middle of a hollow box
          if (v.hollow && cy > v.y + soft && cy < v.y + v.height - soft && cx > v.x + soft && cx < v.x + v.width - soft) {
            col = Math.floor((v.x + v.width - soft) / CELL);
            continue;
          }
          // how far past the box's edge, starting a square and a half inside it
          const out = Math.hypot(Math.max(v.x + soft / 2 - cx, 0, cx - v.x - v.width + soft / 2), Math.max(v.y + soft / 2 - cy, 0, cy - v.y - v.height + soft / 2));
          const ease = clamp(1 - out / (soft * 1.5), 0, 1);
          const alpha = 0.78 * ease * ease * (3 - 2 * ease);
          const key = row * 10000 + col;
          if (alpha > (washed.get(key) ?? 0)) washed.set(key, alpha);
        }
      }
    }
    ctx.fillStyle = palette.water;
    for (const [key, alpha] of washed) {
      ctx.globalAlpha = alpha;
      ctx.fillRect(key % 10000 * CELL, Math.floor(key / 10000) * CELL, CELL, CELL);
    }
    ctx.globalAlpha = 1;
  }

  function tick(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    // a hidden tab, or a minimized window with the canvas out of the page, skips drawing
    if (!document.hidden && canvas.getClientRects().length) {
      stepPond(pond, dt);
      draw();
    }
    frame = requestAnimationFrame(tick);
  }

  function start() {
    cancelAnimationFrame(frame);
    last = 0;
    // reduced motion: let the koi settle into place, then hold still
    if (reduced.matches) {
      for (let i = 0; i < 30; i++) stepPond(pond, 0.05);
      draw();
    } else frame = requestAnimationFrame(tick);
  }

  const observer = new ResizeObserver(() => { resize(); if (reduced.matches) draw(); });
  resize();
  observer.observe(canvas);
  reduced.addEventListener('change', start);
  start();

  return {
    feed(x, y) {
      feedPond(pond, x, y);
      if (reduced.matches) draw();
    },
    touch(x, y) {
      if (reduced.matches) return;
      trail.push({ x, y, time: performance.now() });
      if (trail.length > 14) trail.shift();
    },
    setDark(value) {
      palette = value ? palettes.dark : palettes.light;
      draw();
    },
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener('change', start);
    },
  };
}
