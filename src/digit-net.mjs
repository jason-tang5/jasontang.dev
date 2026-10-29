// the mlp from my mini ml framework (784 → 256 → 128 → 10, relu between), for guessing
// drawn digits (DigitPad.vue). the weights come from a run of minitorch's mnist example
// on the cpu, stored as int8 with one scale per output neuron: each layer is f32
// scales[out], f32 bias[out], then i8 w[in × out]. the page never touches the dom here,
// so the tests can run it directly
export const SIZES = [784, 256, 128, 10];
// mnist's pixel mean and spread, which the network was trained on
const MEAN = 0.1307, STD = 0.3081;

export function parseNet(buffer) {
  const layers = [];
  let at = 0;
  for (let l = 0; l < 3; l++) {
    const inp = SIZES[l], out = SIZES[l + 1];
    const scale = new Float32Array(buffer.slice(at, at + out * 4)); at += out * 4;
    const bias = new Float32Array(buffer.slice(at, at + out * 4)); at += out * 4;
    const w = new Int8Array(buffer.slice(at, at + inp * out)); at += inp * out;
    layers.push({ inp, out, scale, bias, w });
  }
  if (at !== buffer.byteLength) throw new Error('weights file is the wrong size');
  return layers;
}

// fetched once, however many pads are open
let loading;
export function loadNet(url) {
  loading ??= fetch(url).then(r => {
    if (!r.ok) throw new Error(`weights: ${r.status}`);
    return r.arrayBuffer();
  }).then(parseNet).catch(error => { loading = undefined; throw error; });
  return loading;
}

// the chance of each digit for a 28 × 28 image with pixels from 0 to 1: x @ W + b for
// each layer, relu between them, then softmax
export function guessDigit(layers, image) {
  let h = Float32Array.from(image, v => (v - MEAN) / STD);
  layers.forEach(({ inp, out, scale, bias, w }, l) => {
    const acc = new Float32Array(out);
    for (let i = 0; i < inp; i++) {
      const v = h[i];
      if (v === 0) continue;
      const row = i * out;
      for (let j = 0; j < out; j++) acc[j] += v * w[row + j];
    }
    for (let j = 0; j < out; j++) {
      acc[j] = acc[j] * scale[j] + bias[j];
      if (l < layers.length - 1 && acc[j] < 0) acc[j] = 0;
    }
    h = acc;
  });
  const top = Math.max(...h);
  const e = Array.from(h, v => Math.exp(v - top));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / sum);
}

// a square drawing (one brightness per pixel, 0 to 255, size × size) the way mnist's
// digits were made: cropped to the ink, shrunk so its longer side is 20 pixels by
// averaging, then put in a 28 × 28 box with its centre of mass in the middle. returns
// 784 values from 0 to 1, or null if nothing's drawn
export function toMnist(gray, size) {
  let x0 = size, y0 = size, x1 = -1, y1 = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (gray[y * size + x] > 30) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (x1 < 0) return null;
  const k = 20 / Math.max(x1 - x0 + 1, y1 - y0 + 1);
  const tw = Math.max(1, Math.round((x1 - x0 + 1) * k)), th = Math.max(1, Math.round((y1 - y0 + 1) * k));
  const small = new Float32Array(tw * th);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const sx0 = x0 + Math.floor(tx / k), sx1 = Math.min(x1 + 1, x0 + Math.ceil((tx + 1) / k));
    const sy0 = y0 + Math.floor(ty / k), sy1 = Math.min(y1 + 1, y0 + Math.ceil((ty + 1) / k));
    let sum = 0, n = 0;
    for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) { sum += gray[y * size + x]; n++; }
    small[ty * tw + tx] = n ? sum / n / 255 : 0;
  }
  let mass = 0, mx = 0, my = 0;
  small.forEach((v, i) => { mass += v; mx += v * (i % tw); my += v * Math.floor(i / tw); });
  const ox = Math.round(14 - mx / mass), oy = Math.round(14 - my / mass);
  const image = new Float32Array(784);
  small.forEach((v, i) => {
    const x = (i % tw) + ox, y = Math.floor(i / tw) + oy;
    if (x >= 0 && x < 28 && y >= 0 && y < 28) image[y * 28 + x] = v;
  });
  return image;
}
