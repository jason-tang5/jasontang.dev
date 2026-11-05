// win95 style tooltips in place of the browser's own. any title="" on the page is
// moved to data-tip as soon as it appears (so the native one never shows), and
// hovering it for a moment shows a small pixel box by the pointer instead. an element
// with data-tip-bomb shows just a bomb in its box that goes off as it opens, and keeps
// its text for screen readers
const delay = 500;
let box;
let target = null;
let timer;
let pointer = { x: 0, y: 0 };

// keep the text reachable for screen readers once the title attribute is gone
function adopt(el) {
  const text = el.getAttribute('title');
  el.removeAttribute('title');
  if (!text) return;
  el.dataset.tip = text;
  if (el === target && box) box.textContent = text;
  if (el.hasAttribute('aria-label') && !el.dataset.tipLabel) return;
  if (el.dataset.tipLabel || !el.textContent.trim()) {
    el.setAttribute('aria-label', text);
    el.dataset.tipLabel = 'yes';
  } else {
    el.setAttribute('aria-description', text);
  }
}

function scan(root) {
  if (root.nodeType !== 1) return;
  if (root.hasAttribute('title') && !(root instanceof SVGElement)) adopt(root);
  root.querySelectorAll('[title]').forEach(el => { if (!(el instanceof SVGElement)) adopt(el); });
}

function place() {
  const gap = 18;
  const { width, height } = box.getBoundingClientRect();
  const x = Math.min(pointer.x + 4, innerWidth - width - 4);
  let y = pointer.y + gap;
  if (y + height > innerHeight - 4) y = pointer.y - height - 6;
  box.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`;
}

function show() {
  if (!target?.isConnected || !target.dataset.tip) return;
  box.textContent = target.dataset.tip;
  // fresh each time, so the bomb goes off again on every hover
  if ('tipBomb' in target.dataset) {
    const bomb = document.createElement('span');
    bomb.className = 'pixel-tip-bomb';
    bomb.innerHTML = '<i>💣</i><i>💥</i>';
    box.replaceChildren(bomb);
  }
  box.hidden = false;
  place();
}

function hide() {
  clearTimeout(timer);
  target = null;
  if (box) box.hidden = true;
}

export function installTooltips() {
  box = document.createElement('div');
  box.className = 'pixel-tip';
  box.setAttribute('aria-hidden', 'true');
  box.hidden = true;
  document.body.append(box);

  scan(document.body);
  new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'attributes') { if (r.target.hasAttribute('title')) adopt(r.target); }
      else r.addedNodes.forEach(scan);
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });

  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const el = event.target.closest?.('[data-tip]');
    if (el === target) return;
    hide();
    if (!el) return;
    target = el;
    timer = setTimeout(show, delay);
  });
  document.addEventListener('pointermove', event => {
    pointer = { x: event.clientX, y: event.clientY };
  }, { passive: true });
  for (const type of ['pointerdown', 'keydown', 'wheel', 'blur']) addEventListener(type, hide, { capture: true, passive: true });
}
