// end to end checks in a real browser (playwright + chromium).
// run `npm run build` first, then `node tests/browser-check.mjs`.
//
// it serves dist/ under /portfolio/ to make sure the site works from a subpath,
// clicks through every app, and saves screenshots to tmp/qa/ so you can eyeball them.
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { photos } from '../src/photos.mjs';

const root = resolve('dist');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// tiny static server that only answers under /portfolio/
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/portfolio/')) {
      res.writeHead(404).end();
      return;
    }

    let path = url.pathname.slice('/portfolio/'.length);
    if (!path || path.endsWith('/')) path += 'index.html';

    const file = resolve(root, path);
    if (!file.startsWith(root + sep)) throw Error('Invalid path');

    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(data);
  } catch {
    res.writeHead(404).end();
  }
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/portfolio/`;
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
let vite;

try {
  await mkdir('tmp/qa', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // collect js errors and broken requests, checked at the end
  const errors = [];
  const missing = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => {
    if (r.url().startsWith(base) && r.status() >= 400) missing.push(r.url());
  });

  // the static server has no worker. act like a visitor who isn't signed in:
  // no posts written on the site, and access never lets /api/admin/* through
  await page.route('**/api/blog', route => route.fulfill({ json: { posts: [] } }));
  await page.route('**/api/admin/**', route => route.abort());

  // opens an app through the url hash like a shared link would
  const open = async id => {
    await page.evaluate(id => { location.hash = `app=${id}`; }, id);
    const windowId = id === 'breakout' ? 'contact' : id;
    await expect(page.locator(`[data-window="${windowId}"]`)).toBeVisible();
  };

  // ---- wallpaper and portrait ----

  await page.goto(base);
  const wallpaper = page.locator('.desktop-wallpaper .ascii-layer');
  await expect(wallpaper.locator('canvas')).toHaveCount(1);
  await expect(wallpaper.locator('video')).toHaveCount(1);
  await expect.poll(() => wallpaper.locator('video').evaluate(v => v.currentTime)).toBeGreaterThan(0);

  // the portrait's normal/ascii choice should survive a reload
  const portraitButtons = page.locator('.portrait-frame').getByRole('group', { name: 'Photo rendering' });
  await expect(page.locator('.portrait-ascii canvas')).toHaveCount(1);
  await portraitButtons.getByRole('button', { name: 'Normal', exact: true }).click();
  await expect(page.locator('.portrait-ascii canvas')).toHaveCount(0);
  await expect(wallpaper.locator('canvas')).toHaveCount(1);
  await expect(portraitButtons.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(portraitButtons.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await portraitButtons.getByRole('button', { name: 'ASCII', exact: true }).click();
  await expect(page.locator('.portrait-ascii canvas')).toHaveCount(1);

  assert.match(await page.locator('.desktop').evaluate(el => getComputedStyle(el).cursor), /data:image\/x-icon;base64/);
  await page.screenshot({ path: 'tmp/qa/desktop.png' });

  // ---- desktop icons ----

  await expect(page.locator('.desktop-shortcut', { hasText: 'My Computer' })).toHaveCount(0);
  const resumeIcon = page.locator('.desktop-shortcut', { hasText: 'Resume' });
  const before = await resumeIcon.boundingBox();
  await page.mouse.move(before.x + 40, before.y + 30);
  await page.mouse.down();
  await page.mouse.move(before.x + 240, before.y - 70, { steps: 8 });
  await page.mouse.up();

  // a 200x-100 drag snaps two columns right and one row up (98x88 grid)
  await expect.poll(async () => {
    const b = await resumeIcon.boundingBox();
    return [Math.round(b.x - before.x), Math.round(b.y - before.y)];
  }).toEqual([196, -88]);
  await expect(page.locator('[data-window="resume"]')).toHaveCount(0);

  await page.reload();
  const reloaded = await resumeIcon.boundingBox();
  assert.ok(Math.abs(reloaded.x - before.x) < 2 && Math.abs(reloaded.y - before.y) < 2, 'icon positions reset on load');

  // ---- windows remember where they were ----

  const about = page.locator('[data-window="about"]');
  const start = await about.boundingBox();
  await page.mouse.move(start.x + 200, start.y + 12);
  await page.mouse.down();
  await page.mouse.move(start.x + 100, start.y - 28, { steps: 6 });
  await page.mouse.up();
  const moved = await about.boundingBox();
  assert.ok(Math.abs(moved.x - (start.x - 100)) < 2 && Math.abs(moved.y - (start.y - 40)) < 2, 'about window dragged');
  await page.waitForTimeout(500); // positions save after a short delay
  await page.reload();
  await expect.poll(async () => {
    const b = await about.boundingBox();
    return [Math.round(b.x), Math.round(b.y)];
  }).toEqual([Math.round(moved.x), Math.round(moved.y)]);

  // Pulling down a maximized title bar restores its previous dimensions.
  const normalSize = await about.boundingBox();
  await about.getByRole('button', { name: 'Maximize About Me', exact: true }).click();
  await expect(about).toHaveClass(/maximized/);
  const title = await about.locator('.top-bar').boundingBox();
  await page.mouse.move(title.x + title.width / 2, title.y + 12);
  await page.mouse.down();
  await page.mouse.move(title.x + title.width / 2 + 30, title.y + 90, { steps: 8 });
  await page.mouse.up();
  await expect(about).not.toHaveClass(/maximized/);
  const restoredSize = await about.boundingBox();
  assert.ok(Math.abs(restoredSize.width - normalSize.width) < 2 && Math.abs(restoredSize.height - normalSize.height) < 2);
  assert.ok(restoredSize.y > title.y + 20, 'restored window follows downward drag');

  // ---- settings and reduced motion ----

  await open('settings');
  await expect(page.getByRole('checkbox', { name: /Enable colored ASCII/ })).toHaveCount(0);
  await expect(page.getByText('Saved in this browser when storage is available.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Recycle Bin', exact: true })).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => wallpaper.locator('video').evaluate(v => v.paused)).toBe(true);
  assert.equal(await wallpaper.evaluate(el => el.style.animationPlayState), 'paused');

  // closing a window should tear down its canvas
  await open('about');
  await expect(page.locator('.portrait-ascii canvas')).toHaveCount(1);
  await page.setViewportSize({ width: 1100, height: 750 });
  await expect(page.locator('.desktop-wallpaper canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Close About Me', exact: true }).click();
  await expect(page.locator('.portrait-ascii canvas')).toHaveCount(0);

  // ---- my pictures ----

  await open('pictures');
  const pictures = page.locator('[data-window="pictures"]');
  await expect(pictures.locator('.picture-thumbnails button')).toHaveCount(photos.length);
  await expect(pictures.locator('.pictures-hero canvas')).toHaveCount(1);
  await pictures.screenshot({ path: 'tmp/qa/pictures-desktop.png' });

  // every photo should load in normal mode
  const modes = pictures.getByRole('group', { name: 'Photo rendering' });
  await modes.getByRole('button', { name: 'Normal', exact: true }).click();
  await expect(pictures.locator('canvas')).toHaveCount(0);
  for (let i = 0; i < photos.length; i++) {
    await pictures.locator('.picture-thumbnails button').nth(i).click();
    await expect(pictures.locator('.status-bar > span:first-child')).toHaveText(`${i + 1} / ${photos.length}`);
    await expect.poll(() => pictures.locator('.pictures-hero img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  }

  await modes.getByRole('button', { name: 'ASCII', exact: true }).click();
  await expect(pictures.locator('canvas')).toHaveCount(1);
  await pictures.getByRole('button', { name: 'Previous photo' }).click();
  await expect(pictures.locator('.status-bar > span:first-child')).toHaveText(`${photos.length - 1} / ${photos.length}`);
  await page.keyboard.press('ArrowRight');
  await expect(pictures.locator('.status-bar > span:first-child')).toHaveText(`${photos.length} / ${photos.length}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await pictures.screenshot({ path: 'tmp/qa/pictures-mobile.png' });
  assert.equal(await pictures.evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await page.setViewportSize({ width: 1100, height: 750 });
  await page.getByRole('button', { name: 'Close My Pictures', exact: true }).click();
  await expect(page.locator('.pictures-hero canvas')).toHaveCount(0);

  // ---- contact / breakout ----

  // the old #app=breakout link should land on contact without opening a second window
  await open('breakout');
  await open('contact');
  await expect(page.locator('[data-window="contact"]')).toHaveCount(1);
  const game = page.locator('[data-window="contact"]');
  const startButton = game.locator('#breakout-start');
  await expect(game.locator('#breakout')).toBeVisible();

  // switching to another window pauses the game
  await startButton.click();
  await expect(startButton).toHaveText('Pause');
  await open('blog');
  await expect(startButton).toHaveText('Resume');
  await expect(page.getByText('No posts published yet.', { exact: true })).toBeVisible();

  // keyboard controls
  await open('contact');
  await game.locator('#breakout-restart').click();
  await expect(startButton).toHaveText('Play');
  await game.locator('#breakout').focus();
  await page.keyboard.press('Space');
  await expect(startButton).toHaveText('Pause');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(startButton).toHaveText('Resume');
  await startButton.click();
  await expect(startButton).toHaveText('Pause');
  await game.locator('#breakout').focus();
  await startButton.click();
  await expect(startButton).toHaveText('Resume');
  await game.screenshot({ path: 'tmp/qa/contact-desktop.png' });

  await expect(game.locator('.contact-invitation')).toHaveText('Want to get my email? Beat the game :)');
  await expect(game.locator('#breakout-add-ball')).toHaveCount(0);
  await expect(game.locator('.status-bar a')).toHaveCount(0);

  // the hidden email should stretch across most of the board
  const [emailWidth, boardWidth] = await game.locator('.breakout-email a').evaluate(a => {
    const range = document.createRange();
    range.selectNodeContents(a);
    return [range.getBoundingClientRect().width, a.closest('.breakout-board').clientWidth];
  });
  assert.ok(emailWidth > boardWidth * 0.75 && emailWidth <= boardWidth, `email spans the board (${emailWidth} of ${boardWidth})`);

  // ---- games folder and ASCII snake ----
  await open('games');
  const gamesFolder = page.locator('[data-window="games"]');
  await expect(page.locator('.desktop-shortcut', { hasText: 'Games' })).toHaveCount(1);
  await expect(page.locator('.desktop-shortcut', { hasText: 'Minesweeper' })).toHaveCount(0);
  await gamesFolder.getByRole('button', { name: /Snake/ }).click();
  const snake = page.locator('[data-window="snake"]');
  await expect(snake.locator('pre')).toContainText('best');
  const initialSnake = await snake.locator('pre').textContent();
  await snake.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => snake.locator('pre').textContent()).not.toBe(initialSnake);
  await snake.locator('.snake-board').press('Space');
  await expect(snake.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  const pausedSnake = await snake.locator('pre').textContent();
  await page.waitForTimeout(220);
  assert.equal(await snake.locator('pre').textContent(), pausedSnake);
  await snake.getByRole('button', { name: 'Move down', exact: true }).click();
  await expect(snake.locator('pre')).toContainText('v');
  await open('games');
  await expect(snake.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await gamesFolder.getByRole('button', { name: /Minesweeper/ }).click();
  await expect(page.locator('[data-window="minesweeper"]')).toBeVisible();
  await open('snake');
  await snake.screenshot({ path: 'tmp/qa/snake.png' });

  // ---- minesweeper ----

  await open('minesweeper');
  const mines = page.locator('[data-window="minesweeper"]');
  await expect(mines.locator('.mine-cell')).toHaveCount(81);
  await mines.locator('.mine-cell').nth(40).click();
  await expect(mines.locator('.mine-cell.open').first()).toBeVisible();
  assert.ok(await mines.locator('.mine-cell.open').count() >= 9, 'first click opens a safe area');

  const hidden = mines.locator('.mine-cell.raised').first();
  await hidden.click({ button: 'right' });
  await expect(hidden.locator('.mine-flag')).toHaveCount(1);
  await expect(mines.locator('.status-bar, .toolbar')).toHaveCount(0);

  await mines.getByRole('button', { name: /^Difficulty/ }).click();
  await mines.getByRole('menuitemradio', { name: 'Expert', exact: true }).click();
  await expect(mines.locator('.mine-cell')).toHaveCount(480);
  await expect(mines.getByRole('menu')).toHaveCount(0);
  await mines.screenshot({ path: 'tmp/qa/minesweeper.png' });

  // ---- cd player ----

  // fake spotify's iframe api so we can test the real component without logging in.
  // every call gets recorded in window.__cdCalls
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route => route.fulfill({
    contentType: 'text/javascript',
    body: `
      window.__cdCalls = [];
      window.onSpotifyIframeApiReady({
        createController(mount, options, callback) {
          const frame = document.createElement('iframe');
          frame.title = 'Spotify test player';
          frame.src = 'https://open.spotify.com/embed/album/35I1NyorvFXQm14NSTQGY4';
          mount.replaceWith(frame);

          const listeners = {};
          let uri = options.uri;
          let position = 0;
          const update = paused => listeners.playback_update?.({ data: { isPaused: paused, position, duration: 202000, playingURI: uri } });

          callback({
            addListener(name, fn) { listeners[name] = fn; if (name === 'ready') setTimeout(fn, 0); },
            play() { position = 0; window.__cdCalls.push('play'); update(false); },
            resume() { window.__cdCalls.push('resume'); update(false); },
            pause() { window.__cdCalls.push('pause'); update(true); },
            loadUri(value) { uri = value; window.__cdCalls.push(value); },
            seek(value) { position = value * 1000; window.__cdCalls.push('seek:' + value); update(false); },
            destroy() { window.__cdCalls.push('destroy'); frame.remove(); },
          });
        },
      });
    `,
  }));

  let loads = 0;
  await page.route('https://open.spotify.com/embed/album/**', route => {
    loads++;
    return route.fulfill({ contentType: 'text/html', body: '<button>Spotify test player</button>' });
  });

  // spotify shouldn't load until you press play
  await open('music');
  const cd = page.locator('[data-window="music"]');
  const track = cd.getByRole('combobox', { name: 'Track', exact: true });
  await expect(cd.locator('iframe')).toHaveCount(0);
  await cd.screenshot({ path: 'tmp/qa/cd-player.png' });

  await cd.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(cd.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await cd.getByRole('button', { name: 'Next track' }).click();
  await expect(track).toHaveValue('1');
  await cd.getByRole('button', { name: 'Previous track' }).click();
  await expect(track).toHaveValue('0');

  await cd.getByRole('slider').fill('30000');
  await cd.getByRole('slider').dispatchEvent('change');
  await expect(cd.getByLabel('Elapsed time')).toHaveText('0:30');

  // pausing then playing should resume, not restart from 0:00
  await cd.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(cd.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await cd.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(cd.getByLabel('Elapsed time')).toHaveText('0:30');
  assert.equal((await page.evaluate(() => window.__cdCalls)).at(-1), 'resume');

  // spotify has no volume control, so muting the site pauses the cd player instead
  await page.getByRole('button', { name: 'Volume', exact: true }).click();
  await page.getByRole('group', { name: 'Volume control' }).getByRole('checkbox', { name: 'Mute' }).check();
  await expect(cd.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  assert.equal((await page.evaluate(() => window.__cdCalls)).at(-1), 'pause');
  await page.getByRole('group', { name: 'Volume control' }).getByRole('checkbox', { name: 'Mute' }).uncheck();
  await page.keyboard.press('Escape');

  // minimizing keeps the player alive, closing destroys it
  await page.getByRole('button', { name: 'Minimize CD Player', exact: true }).click();
  await expect(cd.locator('iframe')).toHaveCount(1);
  await open('music');
  assert.equal(loads, 1);
  await open('blog');
  await expect(cd.locator('iframe')).toHaveCount(1);
  await open('music');
  await expect(cd.getByRole('button', { name: 'Hide Spotify player', exact: true })).toBeVisible();
  await expect(cd.getByRole('link', { name: 'Open in Spotify' })).toBeVisible();
  await page.getByRole('button', { name: 'Close CD Player', exact: true }).click();
  assert.ok((await page.evaluate(() => window.__cdCalls)).includes('destroy'));
  await expect(page.locator('[data-window="music"] iframe')).toHaveCount(0);

  // if spotify is blocked, we should still offer the album link
  const blocked = await browser.newPage();
  await blocked.route('https://open.spotify.com/embed/iframe-api/v1', route => route.abort());
  await blocked.goto(base + '#app=music');
  await blocked.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(blocked.getByRole('link', { name: 'Open in Spotify' })).toBeVisible();
  await blocked.close();

  // ---- resume and old urls ----

  // the served pdf should be byte for byte the one in assets/
  await open('resume');
  const pdfLink = page.getByRole('link', { name: 'Open PDF', exact: true }).first();
  const pdfUrl = new URL(await pdfLink.getAttribute('href'), base).href;
  const response = await page.request.get(pdfUrl);
  assert.equal(response.status(), 200);
  const hash = b => createHash('sha256').update(b).digest('hex');
  assert.equal(hash(await response.body()), hash(await readFile('assets/Jason_Tang_Resume.pdf')));

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download', exact: true }).click();
  assert.equal((await download).suggestedFilename(), 'Jason_Tang_Resume.pdf');

  // ---- phone size and keyboard ----

  await page.setViewportSize({ width: 390, height: 844 });
  await open('contact');
  await page.screenshot({ path: 'tmp/qa/mobile-contact.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Reset Desktop' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeFocused();

  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);

  // ---- sound effects ----

  // count every tone and noise burst web audio starts, so we can tell if sounds are playing
  const noisy = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await noisy.addInitScript(() => {
    window.__tones = 0;
    for (const Node of [OscillatorNode, AudioBufferSourceNode]) {
      const start = Node.prototype.start;
      Node.prototype.start = function (...args) {
        window.__tones++;
        return start.apply(this, args);
      };
    }
  });
  await noisy.goto(base);
  const tones = () => noisy.evaluate(() => window.__tones);
  // how many sounds an action makes. the pause lets the throttles in sound.js reset
  const soundsFrom = async action => {
    const start = await tones();
    await action();
    await noisy.waitForTimeout(150);
    return (await tones()) - start;
  };
  const speaker = noisy.getByRole('button', { name: 'Volume', exact: true });
  await expect(speaker).toBeVisible();

  // empty desktop to the right of the about window
  assert.ok(await soundsFrom(() => noisy.mouse.click(1330, 450)) > 0, 'background click makes a sound');
  await noisy.locator('[data-window="about"] .hammer-toggle').click();
  assert.ok(await soundsFrom(() => noisy.locator('.portrait-ascii canvas').click()) > 0, 'breaking ascii letters makes a sound');
  assert.ok(await soundsFrom(() => noisy.locator('[data-window="about"]').getByRole('button', { name: 'Experience', exact: true }).click()) > 0, 'button click makes a sound');

  // hovering buttons is silent, hovering a technology ticks
  await noisy.mouse.move(1330, 450);
  assert.equal(await soundsFrom(() => noisy.getByRole('button', { name: 'Start', exact: true }).hover()), 0, 'button hover is silent');
  const tool = noisy.locator('[data-window="experience"] .tech-tag').first();
  await tool.scrollIntoViewIfNeeded();
  assert.ok(await soundsFrom(() => tool.hover()) > 0, 'hovering a tool ticks');

  assert.ok(await soundsFrom(() => noisy.getByRole('button', { name: 'Close About Me', exact: true }).click()) > 0, 'closing makes a sound');

  // play breakout until the first brick breaks, which should make a sound on its own
  await noisy.locator('.desktop-shortcut', { hasText: 'Contact' }).dblclick();
  const contact = noisy.locator('[data-window="contact"]');
  await contact.locator('#breakout-start').click();
  await noisy.waitForTimeout(150);
  const beforeBrick = await tones();
  await expect(contact.locator('#breakout-status')).not.toHaveText('15 bricks to go.', { timeout: 10000 });
  assert.ok(await tones() > beforeBrick, 'breaking a brick makes a sound');
  await contact.locator('#breakout-start').click();

  // the speaker opens the volume popup. the slider works with the keyboard
  await speaker.click();
  const volume = noisy.getByRole('slider', { name: 'Volume' });
  await expect(volume).toHaveAttribute('aria-valuenow', '70');
  await volume.focus();
  await noisy.keyboard.press('PageDown');
  await expect(volume).toHaveAttribute('aria-valuenow', '50');

  // muted: clicking around makes no sound, and it all stays after a refresh
  await noisy.getByRole('group', { name: 'Volume control' }).getByRole('checkbox', { name: 'Mute' }).check();
  await expect(noisy.getByRole('button', { name: 'Volume (muted)', exact: true })).toBeVisible();
  const tonesBefore = await tones();
  await noisy.locator('.desktop-shortcut', { hasText: 'Projects' }).dblclick();
  await noisy.getByRole('button', { name: 'Start', exact: true }).click();
  assert.equal(await tones(), tonesBefore, 'no sounds while muted');
  await noisy.reload();
  await noisy.getByRole('button', { name: 'Volume (muted)', exact: true }).click();
  await expect(noisy.getByRole('group', { name: 'Volume control' }).getByRole('checkbox', { name: 'Mute' })).toBeChecked();
  await expect(noisy.getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-valuenow', '50');
  await noisy.locator('.volume-popup').screenshot({ path: 'tmp/qa/volume-popup.png' });
  await noisy.close();

  // ---- mail window ----

  // mail is locked until you beat breakout: no icon, no start menu entry,
  // and a #app=mail link just opens the normal desktop
  const mailPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mailPage.goto(base + '#app=mail');
  await expect(mailPage.locator('[data-window="about"]')).toBeVisible();
  await expect(mailPage.locator('[data-window="mail"]')).toHaveCount(0);
  await expect(mailPage.locator('.desktop-shortcut', { hasText: 'Mail' })).toHaveCount(0);
  await mailPage.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(mailPage.getByRole('menuitem', { name: 'Mail', exact: true })).toHaveCount(0);
  await mailPage.keyboard.press('Escape');
  await mailPage.evaluate(() => { location.hash = 'app=mail'; });
  await mailPage.waitForTimeout(300);
  await expect(mailPage.locator('[data-window="mail"]')).toHaveCount(0);

  // once breakout is beaten it stays beaten, with a button straight to mail.
  // (actually clearing 15 bricks takes too long here, so fake the saved win)
  await mailPage.evaluate(() => localStorage.setItem('jt-desktop:contact-beaten', 'yes'));
  await mailPage.goto(base + '#app=contact');
  const beaten = mailPage.locator('[data-window="contact"]');
  const goToMail = beaten.getByRole('button', { name: 'Go to Mail', exact: true });
  await expect(goToMail).toBeVisible();
  await expect(beaten.locator('.breakout-board')).toHaveClass(/is-revealed/);
  await expect(beaten.locator('#breakout-start')).toHaveText('Play again');
  await expect(mailPage.locator('[data-window="mail"]')).toHaveCount(0); // no pop-up on a plain reopen

  await goToMail.click();
  await expect(mailPage.locator('[data-window="mail"]')).toBeVisible();
  assert.ok(!mailPage.url().includes('app=mail'), 'mail never goes in the url');
  await mailPage.getByRole('button', { name: 'Close Mail', exact: true }).click();

  // play again and restart both start a new round, but you keep the win: go to mail
  // stays, and a reopen after restart shows a fresh board with mail still unlocked
  await beaten.locator('#breakout-start').click();
  await expect(goToMail).toBeVisible();
  await beaten.locator('#breakout-restart').click();
  await expect(goToMail).toBeVisible();
  await mailPage.goto(base + '#app=contact');
  await expect(mailPage.locator('[data-window="contact"] #breakout-start')).toHaveText('Play');
  await expect(mailPage.locator('[data-window="contact"]').getByRole('button', { name: 'Go to Mail', exact: true })).toBeVisible();
  await mailPage.close();

  // ---- no webgl ----

  // pretend webgl2 doesn't exist, the wallpaper should fall back to the plain video
  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl2' ? null : getContext.call(this, type, ...args);
    };
  });
  await fallback.goto(base);
  await expect(fallback.locator('.ascii-layer canvas')).toHaveCount(0);
  assert.equal(await fallback.locator('.portrait-ascii img').evaluate(img => img.complete && img.naturalWidth > 0), true);
  await fallback.screenshot({ path: 'tmp/qa/fallback.png' });

  // ---- blog renderer ----

  // no posts ship yet, so mount the real blog component with a fake post through vite
  vite = await createViteServer({ server: { host: '127.0.0.1', port: 0 } });
  await vite.listen();
  const blogPage = await browser.newPage();
  const devBase = `http://127.0.0.1:${vite.httpServer.address().port}`;
  await blogPage.goto(devBase);
  await blogPage.evaluate(async () => {
    const { mountFixture } = await import('/tests/blog-fixture.js');
    mountFixture();
  });

  await blogPage.getByRole('button', { name: 'Renderer fixture' }).click();
  await expect(blogPage.getByRole('heading', { name: 'Renderer fixture' })).toBeVisible();
  await blogPage.screenshot({ path: 'tmp/qa/blog-top.png' });
  await expect(blogPage.getByRole('heading', { name: 'Example section' })).toBeVisible();
  await expect(blogPage.locator('#blog-fixture code')).toHaveText('const safe = "<script>";');

  await blogPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await blogPage.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(blogPage.getByText('Code copied.')).toBeVisible();
  assert.equal(await blogPage.evaluate(() => navigator.clipboard.readText()), 'const safe = "<script>";');
  await blogPage.screenshot({ path: 'tmp/qa/blog-fixture.png' });

  await blogPage.getByRole('button', { name: 'Back to Blog' }).click();
  await expect(blogPage.getByRole('button', { name: 'Renderer fixture' })).toBeVisible();

  // ---- sending mail ----

  // the real endpoint is the cloudflare worker, so fake it here and check what gets sent
  const mailFixture = await browser.newPage();
  const sent = [];
  let reply = { status: 200, body: { ok: true } };
  await mailFixture.route('**/api/contact', route => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) });
  });
  await mailFixture.goto(devBase);
  await mailFixture.evaluate(async () => {
    const { mountMail } = await import('/tests/mail-fixture.js');
    mountMail();
  });

  const mail = mailFixture.locator('#mail-fixture');
  await expect(mail.getByRole('textbox', { name: 'To', exact: true })).toHaveValue('jasontcanada@gmail.com');
  await mail.getByRole('textbox', { name: 'Subject:', exact: true }).fill('Hello');
  await mail.getByRole('textbox', { name: 'From:', exact: true }).fill('ada@example.com');
  await mail.getByRole('textbox', { name: 'Message', exact: true }).fill('hello!');
  // mail reports how it went with a 'site-notice' event, which the desktop shows as a note
  await mailFixture.evaluate(() => {
    window.notices = [];
    window.addEventListener('site-notice', event => window.notices.push(event.detail));
  });
  const lastNotice = () => mailFixture.evaluate(() => window.notices.at(-1));
  // the worker turns away anything sent under 3 seconds after the window opened
  await mailFixture.waitForTimeout(3100);
  await mail.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(lastNotice).toEqual({ title: 'Message sent', message: 'Thanks! I’ll get back to you soon.' });
  await expect(mail.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('');
  assert.deepEqual(
    { ...sent[0], elapsed: typeof sent[0].elapsed },
    { subject: 'Hello', email: 'ada@example.com', message: 'hello!', website: '', elapsed: 'number' },
  );

  // errors from the worker show up with the email as a fallback
  reply = { status: 400, body: { error: 'The message is empty.' } };
  await mail.getByRole('textbox', { name: 'Message', exact: true }).fill('again');
  await mail.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(lastNotice).toEqual({ title: 'Couldn’t send', message: 'The message is empty. You can also email jasontcanada@gmail.com.' });
  await mailFixture.close();

  console.log('browser checks passed');
} finally {
  await browser.close();
  await vite?.close();
  await new Promise(r => server.close(r));
}
