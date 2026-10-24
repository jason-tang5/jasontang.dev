// Run with node tests/blog-figures-browser.mjs. Uses local fixtures, never Cloudflare writes.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { graphicExamples, graphicMarkup } from '../src/blog-templates.mjs';

const post = JSON.parse(await readFile(new URL('./fixtures/contact-post.json', import.meta.url), 'utf8'));
const server = await createServer({ server: { host: '127.0.0.1', port: 5196, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch();
  await mkdir('tmp/qa/blog-figures', { recursive: true });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  const writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copiedText = text; } }, configurable: true }));
  await page.route('**/api/**', route => {
    const request = route.request();
    if (request.method() !== 'GET') writes.push(request.url());
    const body = request.url().endsWith('/api/blog') ? { posts: [] }
      : request.url().endsWith('/api/admin/me') ? { email: 'fixture@example.com' } : {};
    return route.fulfill({ json: body });
  });
  await page.route('**/figure-check', route => route.fulfill({
    contentType: 'text/html',
    body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script type="module">import "/src/theme.css"; import { mountContactFixture } from "/tests/blog-fixture.js"; await mountContactFixture();</script></body></html>',
  }));
  await page.goto('http://127.0.0.1:5196/figure-check');
  const thumbnail = page.locator('.blog-thumbnail img');
  await expect(thumbnail).toBeVisible();
  await expect.poll(() => thumbnail.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  for (const width of [360, 900]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `tmp/qa/blog-figures/list-${width}.png` });
    assert.ok(await page.locator('.blog-reading').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
  }
  await page.getByRole('button', { name: post.title, exact: true }).click();
  await expect(page.locator('.cf-figure')).toHaveCount(7);
  await expect(page.locator('.code-block')).toHaveCount(2);
  await expect(page.locator('.code-language').first()).toContainText('JavaScript');
  await expect(page.locator('.code-text').first()).toHaveText(post.source.match(/```js\n([\s\S]*?)\n```/)[1]);
  await expect(page.locator('.code-text .hljs-keyword').first()).toBeAttached();
  await page.getByRole('button', { name: 'Copy JavaScript code', exact: true }).click();
  assert.equal(await page.evaluate(() => window.copiedText), post.source.match(/```js\n([\s\S]*?)\n```/)[1]);
  await page.setViewportSize({ width: 360, height: 900 });
  const flow = page.locator('.cf-figure--flow');
  await expect(flow).not.toContainText('Read left to right.');
  await expect(flow.locator('.bg-node svg')).toHaveCount(0);
  await expect(flow.getByRole('button', { name: 'Previous flowchart step' })).toBeDisabled();
  for (let i = 0; i < 7; i++) await flow.getByRole('button', { name: 'Next flowchart step' }).click();
  await expect(flow.getByRole('button', { name: 'Next flowchart step' })).toBeDisabled();
  await expect(flow.locator('.bg-detail')).toContainText('200 · Mail shows Sent');
  assert.ok(await flow.locator('.bg-flow-scroll').evaluate(el => el.scrollLeft > 0));
  assert.equal(await flow.locator('.bg-flow-scroll').evaluate(el => getComputedStyle(el).scrollbarWidth), 'auto');
  assert.equal(await flow.locator('.bg-flow-scroll').evaluate(el => getComputedStyle(el, '::-webkit-scrollbar').height), '18px');
  for (let i = 0; i < 7; i++) await flow.getByRole('button', { name: 'Previous flowchart step' }).click();
  assert.equal(await flow.locator('.bg-flow-scroll').evaluate(el => el.scrollLeft), 0);

  for (const width of [360, 600, 900]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      for (const size of ['Small', 'Medium', 'Large']) {
        await page.getByRole('button', { name: `${size} text`, exact: true }).click();
        const overflow = await page.locator('.blog-reading').evaluate(el => el.scrollWidth - el.clientWidth);
        assert.ok(overflow <= 1, `${width}/${theme}/${size}: article overflows by ${overflow}px`);
        const clipped = await page.locator('.cf-figure').evaluateAll(figures => figures.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.className));
        assert.deepEqual(clipped, [], `${width}/${theme}/${size}: figure overflow`);
      }
      await page.getByRole('button', { name: 'Small text', exact: true }).click();
      if (width !== 600) {
        await page.locator('.code-block').first().screenshot({ path: `tmp/qa/blog-figures/${width}-${theme}-code.png` });
        for (const figure of ['mail', 'journey', 'flow', 'spam', 'delivery', 'headers', 'pipeline']) {
          await page.locator(`.cf-figure--${figure}`).screenshot({ path: `tmp/qa/blog-figures/${width}-${theme}-${figure}.png` });
        }
      }
    }
  }

  const journey = page.locator('.cf-figure--journey');
  for (let i = 0; i < 5; i++) await journey.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(journey.locator('.cf-detail')).toContainText('Deliver');
  await expect(journey.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await journey.getByRole('button', { name: 'Empty message', exact: true }).click();
  await journey.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(journey.locator('.cf-detail')).toContainText('no request is sent');
  await journey.getByRole('button', { name: 'Send fails', exact: true }).click();
  for (let i = 0; i < 4; i++) await journey.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(journey.locator('.cf-detail')).toContainText('502');
  await journey.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(journey.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();

  const spam = page.locator('.cf-figure--spam');
  await spam.getByRole('button', { name: 'another site', exact: true }).click();
  await expect(spam.locator('.cf-verdict')).toContainText('403');
  await spam.getByRole('button', { name: 'no header', exact: true }).click();
  await spam.getByRole('button', { name: 'Filled in', exact: true }).click();
  await expect(spam.locator('.cf-verdict')).toContainText('quietly dropped');
  await spam.getByRole('button', { name: 'Empty', exact: true }).click();
  await spam.getByRole('slider').fill('1');
  await expect(spam.locator('.cf-verdict')).toContainText('400');
  await spam.getByRole('slider').fill('3');
  await expect(spam.locator('.cf-verdict')).toContainText('200');

  const headers = page.locator('.cf-figure--headers');
  await headers.getByRole('button', { name: 'Raw', exact: true }).click();
  await expect(headers.locator('pre')).toContainText('=?UTF-8?B?');
  await headers.getByRole('button', { name: 'Readable', exact: true }).click();
  await headers.getByLabel('Subject', { exact: true }).fill('Café next week?');
  await expect(headers.locator('pre')).toContainText('Subject: Café next week?');
  await headers.getByRole('button', { name: 'The visitor', exact: true }).click();
  await expect(headers.locator('pre')).not.toContainText('Reply-To:');
  await headers.getByLabel('Email', { exact: true }).fill('bad-address');
  await expect(headers.locator('.cf-error')).toContainText('doesn’t look right');
  await headers.getByLabel('Email', { exact: true }).fill('zoe@example.com');
  await headers.getByRole('button', { name: 'My domain', exact: true }).click();
  await expect(headers.locator('pre')).toContainText('Reply-To:');

  const pipes = page.locator('.cf-pipes');
  await pipes.getByRole('button', { name: 'Vue', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(pipes.getByRole('button', { name: 'HTTP', exact: true })).toBeFocused();
  await expect(pipes.getByRole('button', { name: 'HTTP', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const delivery = page.locator('.cf-figure--delivery');
  await delivery.getByRole('button', { name: 'Gmail', exact: true }).click();
  await expect(delivery.locator('.cf-detail')).toContainText('Reply-To');
  assert.equal(await journey.locator('.cf-wire i').first().evaluate(el => getComputedStyle(el).animationName), 'none');

  // The authenticated editor preview uses the same mapping; an edited image falls back.
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.cf-figure')).toHaveCount(7);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.locator('#blog-lead').fill('/tests/fixtures/vaporwave.svg');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.cf-figure')).toHaveCount(6);
  await expect(page.locator('article > figure > img')).toHaveAttribute('src', '/tests/fixtures/vaporwave.svg');

  await page.route('**/gallery-check', route => route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script type="module">import "/src/theme.css"; import { mountGalleryFixture } from "/tests/blog-fixture.js"; mountGalleryFixture();</script></body></html>' }));
  await page.goto('http://127.0.0.1:5196/gallery-check');
  // No saved draft should carry over from the contact preview.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.blog-thumbnail')).toHaveCount(1);
  await expect(page.locator('.thumb-window')).toBeVisible();
  await page.screenshot({ path: 'tmp/qa/blog-figures/list-fallback.png' });
  await page.getByRole('button', { name: 'test blog', exact: true }).click();
  await expect(page.locator('.blog-gallery .bg-figure')).toHaveCount(6);
  await expect(page.locator('.blog-gallery > p')).toHaveText('trash heap of unused graphics');
  await expect(page.locator('.blog-gallery')).not.toContainText('Copy template');
  await expect(page.locator('.blog-gallery details, .blog-gallery .code-block')).toHaveCount(0);
  assert.equal(await page.locator('.blog-gallery').evaluate(el => el.previousElementSibling.textContent), 'Jason was here');
  for (const width of [360, 900]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      for (const size of ['Small', 'Large']) {
        await page.getByRole('button', { name: `${size} text`, exact: true }).click();
        assert.ok(await page.locator('.blog-reading').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `gallery overflow: ${width}/${theme}/${size}`);
      }
      await page.getByRole('button', { name: 'Small text', exact: true }).click();
      for (const template of ['flow', 'steps', 'timeline', 'comparison', 'metrics', 'bars']) {
        await page.locator(`.bg-figure--${template}`).screenshot({ path: `tmp/qa/blog-figures/gallery-${width}-${theme}-${template}.png` });
      }
    }
  }
  await page.locator('.bg-figure--steps').getByRole('button', { name: /Transform/ }).click();
  await expect(page.locator('.bg-figure--steps .bg-detail')).toContainText('Apply the rules');
  const markup = graphicMarkup(graphicExamples[0]);
  await page.getByRole('button', { name: 'Back to Blog', exact: true }).click();
  await page.getByRole('button', { name: 'New Post', exact: true }).click();
  await page.locator('#blog-title').fill('Reused template');
  await page.getByRole('textbox', { name: 'Post', exact: true }).fill(markup);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.bg-figure--flow')).toHaveCount(1);
  await expect(page.locator('.blog-gallery')).toHaveCount(0);
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log('Blog figures: layout, themes, text sizes, controls, keyboard, reduced motion, preview and fallback passed. No API writes.');
} finally {
  await browser?.close();
  await server.close();
}
