// little ui sound effects, generated with web audio so there are no sound files.
// the idea (quiet clicks, a close click, a blip when things open, and a hover
// sound that climbs in pitch) comes from sharyap.com.
import { read, save } from './storage.js';

let ctx;
let master;
let noise;
let enabled = read('sound', 'on') !== 'off';
const lastPlayed = {};

// volume slider level, 0 to 100. 75 is how loud the sounds were designed to be,
// so the top of the slider is a bit louder than that. new visitors start at 70,
// a little quieter than that (loudness follows the square of the slider)
const designedLevel = 75;
const defaultLevel = 70;
let level = Number(read('volume', defaultLevel));
if (!Number.isFinite(level) || level < 0 || level > 100) level = defaultLevel;

// do re mi fa sol la ti do: the c major scale from c5 to c6, which the hover xylophone steps through
const xylophone = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5];
let note = 0;

// minimum ms between repeats, so sweeping the mouse or dragging doesn't turn into a buzz
const throttle = { hover: 60, brick: 30, letter: 300, meow: 400, ping: 300, babble: 250 };

export const soundEnabled = () => enabled;
export const soundLevel = () => level;

// loudness follows the square of the slider, which feels more even to the ear than a straight line
const gainFor = value => (value / designedLevel) ** 2;

// other parts of the site (the cd player) listen for this to pause when sound goes off
function announce() {
  window.dispatchEvent(new CustomEvent('site-sound', { detail: { enabled, level } }));
}

export function setSoundEnabled(value) {
  enabled = value;
  save('sound', value ? 'on' : 'off');
  announce();
  if (value) play('chime');
}

export function setSoundLevel(value) {
  level = Math.max(0, Math.min(100, Math.round(value)));
  save('volume', String(level));
  if (master) master.gain.value = gainFor(level);
  announce();
}

// browsers only allow audio after the user has interacted with the page,
// so the context is made (or woken up) on the first sound.
// everything plays through one master gain so the volume slider controls it all
function audio() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = gainFor(level);
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// the master gain for the live page, or the plain output for anything else
const output = ac => (ac === ctx ? master : ac.destination);

// one short tone with a quick attack and exponential fade
function blip(ac, { type = 'square', from, to = from, start = 0, length = 0.04, volume }) {
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + length);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);

  osc.connect(gain).connect(output(ac));
  osc.start(t);
  osc.stop(t + length + 0.02);
}

// a tiny burst of filtered noise. this is what makes clicks feel physical
// instead of beepy, like the snap of a real switch
function burst(ac, { freq, q = 1, start = 0, length = 0.012, volume }) {
  if (!noise) {
    noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.2), ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  const t = ac.currentTime + start;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();

  src.buffer = noise;
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);

  src.connect(filter).connect(gain).connect(output(ac));
  // start at a random spot in the noise so repeats don't sound identical
  src.start(t, Math.random() * 0.15);
  src.stop(t + length + 0.02);
}

// noise that swells in and out while its pitch slides, like paper drawn across paper
function swish(ac, { from, to, q = 1.2, start = 0, length, volume }) {
  burst(ac, { freq: from, length: 0.001, volume: 0.0001 }); // makes sure the noise exists
  const t = ac.currentTime + start;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();

  src.buffer = noise;
  src.loop = true;
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + length);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + length * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);

  src.connect(filter).connect(gain).connect(output(ac));
  src.start(t, Math.random() * 0.15);
  src.stop(t + length + 0.02);
}

const sounds = {
  // pressing a button down: a short snap with a soft low thump under it
  press: ac => {
    burst(ac, { freq: 2600, q: 0.8, length: 0.014, volume: 0.14 });
    blip(ac, { type: 'sine', from: 170, to: 80, length: 0.035, volume: 0.09 });
  },

  // letting go: a much lighter tick
  release: ac => burst(ac, { freq: 5200, q: 1.2, length: 0.007, volume: 0.05 }),

  // A crisp two-part plastic latch, triggered when the cartridge finishes sliding.
  cartIn: ac => {
    burst(ac, { freq: 3400, q: 1.4, length: 0.009, volume: 0.18 });
    burst(ac, { freq: 1800, q: 1.1, start: 0.018, length: 0.014, volume: 0.14 });
    blip(ac, { type: 'sine', from: 190, to: 80, start: 0.018, length: 0.04, volume: 0.12 });
  },

  // and pulling it back out: the latch letting go with a little rising pop
  cartOut: ac => {
    burst(ac, { freq: 1900, q: 0.8, length: 0.012, volume: 0.12 });
    blip(ac, { type: 'sine', from: 220, to: 360, start: 0.01, length: 0.06, volume: 0.07 });
  },

  // a cd drawn into the player: a soft slide as the tray pulls it in, before the
  // cartridge latch plays as it seats
  discLoad: ac => swish(ac, { from: 900, to: 2400, q: 0.9, length: 0.36, volume: 0.05 }),

  // a coin into the arcade cabinet: a metal clink as it drops, then the credit chime
  coin: ac => {
    burst(ac, { freq: 6200, q: 2, length: 0.012, volume: 0.1 });
    burst(ac, { freq: 4800, q: 2, start: 0.09, length: 0.01, volume: 0.07 });
    blip(ac, { from: 988, start: 0.2, length: 0.07, volume: 0.05 });
    blip(ac, { from: 1319, start: 0.27, length: 0.22, volume: 0.05 });
  },

  // breakout: losing a ball, a sad two-step wah down
  lose: ac => {
    blip(ac, { from: 392, to: 330, length: 0.2, volume: 0.05 });
    blip(ac, { from: 294, to: 196, start: 0.22, length: 0.34, volume: 0.05 });
  },

  // breakout: out of tries. a falling four-note run, then a low buzz that
  // sinks away, so it's clear the game wants another coin
  gameOver: ac => {
    [523.25, 392, 329.63, 261.63].forEach((pitch, i) =>
      blip(ac, { from: pitch, start: i * 0.13, length: 0.12, volume: 0.045 }));
    blip(ac, { type: 'sawtooth', from: 131, to: 55, start: 0.55, length: 0.7, volume: 0.05 });
    blip(ac, { from: 98, to: 41, start: 0.55, length: 0.7, volume: 0.03 });
  },

  // breakout: clearing the board. a quick climb up c major, then a bright chord
  clear: ac => {
    [523.25, 659.25, 783.99, 1046.5].forEach((pitch, i) =>
      blip(ac, { from: pitch, start: i * 0.08, length: 0.09, volume: 0.045 }));
    [1046.5, 1318.51, 1567.98].forEach(pitch =>
      blip(ac, { type: 'triangle', from: pitch, start: 0.34, length: 0.6, volume: 0.035 }));
    burst(ac, { freq: 7000, q: 0.7, start: 0.34, length: 0.05, volume: 0.05 });
  },

  // keyboard presses have no separate down and up, so play both
  click: ac => {
    sounds.press(ac);
    burst(ac, { freq: 5200, q: 1.2, start: 0.05, length: 0.007, volume: 0.05 });
  },

  // clicking the empty desktop, softer and duller than a button.
  // kept above ~300hz so it still comes through laptop speakers
  tap: ac => {
    burst(ac, { freq: 1200, q: 0.7, length: 0.03, volume: 0.12 });
    blip(ac, { type: 'sine', from: 380, to: 260, length: 0.035, volume: 0.05 });
  },

  // ascii letters breaking off: a hammer blow. a low thud of the head landing, a short
  // metallic clank from the steel ringing on top, then a crackle of bits breaking off,
  // more of them the more letters went. pitched a little differently every hit
  crumble: (ac, amount = 1) => {
    const tone = 0.9 + Math.random() * 0.2;
    blip(ac, { type: 'sine', from: 170 * tone, to: 55, length: 0.11, volume: 0.16 });
    burst(ac, { freq: 500 * tone, q: 1, length: 0.035, volume: 0.14 });
    blip(ac, { type: 'triangle', from: 1850 * tone, to: 1780 * tone, start: 0.002, length: 0.09, volume: 0.02 });
    blip(ac, { type: 'sine', from: 2710 * tone, start: 0.002, length: 0.06, volume: 0.012 });
    const bits = Math.min(4, 1 + Math.floor(amount / 25));
    for (let i = 0; i < bits; i++) {
      burst(ac, { freq: 2600 + Math.random() * 1800, q: 2.5, start: 0.02 + i * 0.022 + Math.random() * 0.012, length: 0.014, volume: 0.09 });
    }
  },

  // turning sound back on: a quick rising bell arpeggio (c e g c)
  chime: ac => {
    [1046.5, 1318.51, 1567.98, 2093].forEach((freq, i) => {
      blip(ac, { type: 'sine', from: freq, start: i * 0.07, length: 0.5, volume: 0.045 });
      blip(ac, { type: 'sine', from: freq * 2.76, start: i * 0.07, length: 0.12, volume: 0.01 });
    });
  },

  // breakout brick: an arcade blip plus a small crack. each brick broken this
  // round climbs one note up a major scale, so the last brick is the highest
  brick: (ac, broken = 0) => {
    const scale = [0, 2, 4, 5, 7, 9, 11];
    const step = scale[broken % 7] + 12 * Math.floor(broken / 7);
    const pitch = 440 * 2 ** (step / 12);
    blip(ac, { from: pitch, to: pitch * 0.92, length: 0.06, volume: 0.05 });
    burst(ac, { freq: 3000, q: 0.8, length: 0.015, volume: 0.07 });
  },

  // hovering the cd on the about page: a little music box tune, one note per call.
  // the caller passes the step so the tune starts from the top on every hover
  tune: (ac, step = 0) => {
    const melody = [0, 4, 7, 12, 9, 7, 4, 2];
    const pitch = 523.25 * 2 ** (melody[step % melody.length] / 12);
    blip(ac, { type: 'sine', from: pitch, length: 0.35, volume: 0.04 });
    blip(ac, { type: 'triangle', from: pitch * 2, length: 0.08, volume: 0.008 });
    // a soft low note on the downbeats
    if (step % 4 === 0) blip(ac, { type: 'sine', from: pitch / 4, length: 0.45, volume: 0.03 });
  },

  // hovering contact on the about page: a letter pulled out of its envelope. the
  // sheet slides out with a papery swish that rises as it comes free, then gives
  // the little flick of paper snapping straight
  letter: ac => {
    swish(ac, { from: 1400, to: 5200, length: 0.24, volume: 0.16 });
    swish(ac, { from: 3000, to: 7000, q: 2, start: 0.03, length: 0.2, volume: 0.05 });
    burst(ac, { freq: 3800, q: 1.4, start: 0.25, length: 0.025, volume: 0.1 });
    burst(ac, { freq: 1800, q: 0.9, start: 0.255, length: 0.03, volume: 0.05 });
  },

  // hovering github: a small high meow. a buzzy tone through a filter that opens
  // and closes like a mouth going "mi-ow", the pitch rising then falling away
  meow: ac => {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const mouth = ac.createBiquadFilter();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(560, t);
    osc.frequency.exponentialRampToValueAtTime(820, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.36);
    mouth.type = 'bandpass';
    mouth.Q.value = 4;
    mouth.frequency.setValueAtTime(900, t);
    mouth.frequency.exponentialRampToValueAtTime(1800, t + 0.13);
    mouth.frequency.exponentialRampToValueAtTime(700, t + 0.36);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.09, t + 0.04);
    gain.gain.setValueAtTime(0.09, t + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.connect(mouth).connect(gain).connect(output(ac));
    osc.start(t);
    osc.stop(t + 0.4);
  },

  // hovering linkedin: a friendly two note ping, like a new message coming in
  ping: ac => {
    [783.99, 1174.66].forEach((freq, i) => {
      blip(ac, { type: 'sine', from: freq, start: i * 0.09, length: 0.28, volume: 0.045 });
      blip(ac, { type: 'sine', from: freq * 2.76, start: i * 0.09, length: 0.06, volume: 0.008 });
    });
  },

  // clippy talking when he's poked: a run of little syllables that wander around one
  // pitch, like a cartoon voice reading the line out
  babble: (ac, syllables = 6) => {
    let pitch = 420;
    for (let i = 0; i < syllables; i++) {
      pitch = Math.min(620, Math.max(300, pitch + (Math.random() - 0.5) * 160));
      blip(ac, { type: 'triangle', from: pitch, to: pitch * (i === syllables - 1 ? 0.8 : 1.08), start: i * 0.075, length: 0.06, volume: 0.05 });
    }
  },

  // snake eating: a quick upward chirp, the same pitch every time
  eat: ac => {
    blip(ac, { from: 520, to: 780, length: 0.07, volume: 0.05 });
    blip(ac, { type: 'triangle', from: 1040, start: 0.05, length: 0.06, volume: 0.03 });
  },

  // the mail window's error box: a short, low two note "nope", like the windows chord
  error: ac => {
    blip(ac, { type: 'triangle', from: 440, length: 0.12, volume: 0.07 });
    blip(ac, { type: 'triangle', from: 330, start: 0.1, length: 0.18, volume: 0.07 });
  },

  // lower and a touch longer than a normal click
  close: ac => {
    blip(ac, { from: 900, to: 500, length: 0.05, volume: 0.06 });
    blip(ac, { from: 600, to: 350, start: 0.045, length: 0.05, volume: 0.04 });
  },

  // flipping light/dark: the snap of a light switch, then a soft sweep up for
  // day or down for night
  theme: (ac, dark = false) => {
    burst(ac, { freq: 2400, q: 1.5, length: 0.01, volume: 0.08 });
    const [a, b] = dark ? [880, 440] : [440, 880];
    blip(ac, { type: 'sine', from: a, to: b, start: 0.02, length: 0.22, volume: 0.05 });
    blip(ac, { type: 'sine', from: a * 1.5, to: b * 1.5, start: 0.05, length: 0.2, volume: 0.02 });
  },

  // letting the balloons go: a few quick squeaky rising chirps, like rubber being
  // pulled, then a bright little run up as they float off
  balloons: ac => {
    [0, 0.07, 0.13].forEach((start, i) => blip(ac, { type: 'triangle', from: 500 + i * 120, to: 900 + i * 160, start, length: 0.06, volume: 0.05 }));
    [659.25, 783.99, 1046.5, 1318.51].forEach((freq, i) => blip(ac, { type: 'sine', from: freq, start: 0.22 + i * 0.07, length: 0.16, volume: 0.04 }));
  },

  // a balloon popping: a sharp snap of noise over a quick low thump
  pop: ac => {
    burst(ac, { freq: 1800, q: 0.6, length: 0.05, volume: 0.2 });
    blip(ac, { type: 'sine', from: 180, to: 70, length: 0.07, volume: 0.08 });
  },

  // two rising notes
  open: ac => {
    blip(ac, { type: 'triangle', from: 660, length: 0.07, volume: 0.08 });
    blip(ac, { type: 'triangle', from: 990, start: 0.06, length: 0.09, volume: 0.07 });
  },

  // a xylophone note. each hover plays the next note of do re mi, then starts
  // over at do. a wooden bar is mostly a
  // pure tone with a bright overtone about 4x higher that dies off fast, plus the tap of the mallet
  hover: ac => {
    const freq = xylophone[note];
    note = (note + 1) % xylophone.length;
    blip(ac, { type: 'sine', from: freq, length: 0.3, volume: 0.035 });
    blip(ac, { type: 'sine', from: freq * 3.9, length: 0.05, volume: 0.008 });
    burst(ac, { freq: 3500, q: 1, length: 0.004, volume: 0.01 });
  },
};

export function play(name, amount) {
  if (!enabled || !level || document.hidden) return;
  // hovering before the first click would just get blocked by the browser
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;

  if (throttle[name]) {
    const now = performance.now();
    if (now - (lastPlayed[name] || 0) < throttle[name]) return;
    lastPlayed[name] = now;
  }

  const ac = audio();
  if (ac) sounds[name](ac, amount);
}
