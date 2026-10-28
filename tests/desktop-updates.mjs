import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
const server = await createServer({ server: { port: 5192 } });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // an old single notepad note is carried over into stickies
  await page.goto('http://localhost:5192/');
  await page.evaluate(() => localStorage.setItem('jt-desktop:note', 'Old notepad text'));
  await page.goto('http://localhost:5192/#app=stickies');
  await page.reload();
  const list = page.locator('[data-window="stickies"]');
  const notes = page.locator('[data-window^="sticky-"]');
  await expect(page.locator('.desktop-shortcut', { hasText: 'Sticky Notes' })).toHaveCount(1);
  await expect(list.locator('.sticky-card')).toHaveCount(1);
  await expect(list.locator('.sticky-card')).toContainText('Old notepad text');
  assert.equal(await page.evaluate(() => localStorage.getItem('jt-desktop:note')), null);

  // + opens each new note in its own window, separate from the list
  await list.getByRole('button', { name: 'New note' }).click();
  await expect(notes).toHaveCount(1);
  await notes.getByRole('textbox', { name: 'Note text' }).fill('Private text');
  await notes.getByRole('button', { name: 'New note' }).click();
  await expect(notes).toHaveCount(2);
  const second = page.locator('[data-window^="sticky-"]:focus-within');
  await second.getByRole('textbox', { name: 'Note text' }).fill('Second');
  await second.getByRole('button', { name: 'Note options' }).click();
  await second.getByRole('button', { name: 'pink' }).click();
  await expect(list.locator('.sticky-card')).toHaveCount(3);
  await expect(list.locator('.sticky-card').first()).toContainText('Second');

  // notes drag by their coloured bar
  const bar = second.locator('.sticky-bar');
  const before = await second.boundingBox();
  const grip = await bar.boundingBox();
  await page.mouse.move(grip.x + 100, grip.y + 10);
  await page.mouse.down();
  await page.mouse.move(grip.x + 40, grip.y + 90, { steps: 6 });
  await page.mouse.up();
  const after = await second.boundingBox();
  // it may stop at the bottom of the screen, so just check it followed the pointer
  assert.equal(Math.round(after.x - before.x), -60);
  assert.ok(after.y > before.y);

  // note windows come back after a reload, colour kept
  await page.reload();
  await expect(notes).toHaveCount(2);
  await expect(list.locator('.sticky-card-wrap').first()).toHaveCSS('--note', '#e384c3');
  await page.screenshot({ path: 'tmp/qa/stickies-light.png' });

  // the ... on a list card closes an open note, opens a closed one, and deletes
  const firstCard = list.locator('.sticky-card-wrap').first();
  await page.getByRole('button', { name: 'Sticky Notes', exact: true }).last().click();
  await firstCard.hover();
  await firstCard.getByRole('button', { name: 'Note options' }).click();
  await firstCard.getByRole('button', { name: 'Close note', exact: true }).click();
  await expect(notes).toHaveCount(1);
  await firstCard.hover();
  await firstCard.getByRole('button', { name: 'Note options' }).click();
  await firstCard.getByRole('button', { name: 'Open note', exact: true }).click();
  await expect(notes).toHaveCount(2);
  const oldCard = list.locator('.sticky-card-wrap', { hasText: 'Old notepad text' });
  await page.getByRole('button', { name: 'Sticky Notes', exact: true }).last().click();
  await oldCard.hover();
  await oldCard.getByRole('button', { name: 'Note options' }).click();
  await oldCard.getByRole('button', { name: 'Delete note' }).click();
  await oldCard.getByRole('button', { name: 'Click again to delete' }).click();
  await expect(list.locator('.sticky-card')).toHaveCount(2);

  await list.getByRole('searchbox', { name: 'Search notes' }).fill('private');
  await expect(list.locator('.sticky-card')).toHaveCount(1);
  await list.getByRole('searchbox', { name: 'Search notes' }).fill('');

  // the sun and moon in the tray flip the whole site, and it sticks
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toHaveCount(1);
  await page.screenshot({ path: 'tmp/qa/stickies-dark.png' });
  await page.goto('http://localhost:5192/#app=settings');
  await page.locator('[data-window="settings"]').getByRole('button', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto('http://localhost:5192/#app=settings');
  await page.getByRole('button', { name: 'Koi pond', exact: true }).click();
  // the koi pond takes the sunset's place, and stays picked after a reload
  await expect(page.locator('.desktop-wallpaper')).toHaveCount(1);
  await expect(page.locator('.koi-pond.desktop-wallpaper')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.koi-pond.desktop-wallpaper')).toHaveCount(1);
  await page.route('**/api/stats', r => r.fulfill({ json: { visitors: 123, online: 2, minesweeperWins: 4, breakoutWins: 8, snakeHighScore: 9, leaderboard: [{ rank: 1, player: 'Player ABC123', score: 9 }] } }));
  await page.goto('http://localhost:5192/#app=snake');
  await expect(page.getByText('#ABC123')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.snake-pager').scrollIntoViewIfNeeded();
  await expect(page.getByText('#ABC123')).toBeVisible();
  console.log('Desktop updates passed: sticky note windows, list menu, dragging, light/dark theme, desktop color persistence, leaderboard on mobile.');
} finally { await browser.close(); await server.close(); }
