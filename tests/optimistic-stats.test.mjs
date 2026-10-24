import test from 'node:test';
import assert from 'node:assert/strict';
import { createOptimisticStats } from '../src/optimistic-stats.mjs';

test('local counters are immediate, survive stale reads, and reconcile without doubling', () => {
  const stats = createOptimisticStats();
  stats.accept({ balloonsPopped: 7 });
  const before = stats.revision;
  stats.apply({ name: 'balloon-pop' });
  stats.apply({ name: 'balloon-pop' });
  assert.equal(stats.value().balloonsPopped, 9);
  assert.equal(stats.accept({ balloonsPopped: 7 }, before).balloonsPopped, 9);
  assert.equal(stats.accept({ balloonsPopped: 8 }).balloonsPopped, 9);
  assert.equal(stats.accept({ balloonsPopped: 9 }).balloonsPopped, 9);
  stats.apply({ name: 'balloon-pop' });
  assert.equal(stats.value().balloonsPopped, 10);
  assert.equal(stats.accept({ balloonsPopped: 12 }).balloonsPopped, 12);
});

test('server eventually resolves rejected or undelivered changes', () => {
  let now = 0;
  const stats = createOptimisticStats(() => now);
  stats.accept({ minesweeperWins: 4 });
  stats.apply({ name: 'minesweeper-win' });
  now = 89999;
  assert.equal(stats.accept({ minesweeperWins: 4 }).minesweeperWins, 5);
  now = 90000;
  assert.equal(stats.accept({ minesweeperWins: 4 }).minesweeperWins, 4);
});

test('high scores and leaderboard updates replace a player score instead of duplicating rows', () => {
  const stats = createOptimisticStats();
  stats.accept({ snakeHighScore: 30, leaderboardWeek: [{ rank: 1, player: 'JASON', score: 30 }], twenty48HighScore: 100 });
  stats.apply({ name: 'snake-score', value: 40, player: 'JASON' });
  stats.apply({ name: 'snake-score', value: 20, player: 'JASON' });
  stats.apply({ name: '2048-score', value: 80 });
  assert.equal(stats.value().snakeHighScore, 40);
  assert.equal(stats.value().twenty48HighScore, 100);
  assert.deepEqual(stats.value().leaderboardWeek, [{ rank: 1, player: 'JASON', score: 40 }]);
});

test('history rows, reversi perspective, daily visits and win averages update together', () => {
  const stats = createOptimisticStats(() => Date.UTC(2026, 8, 27));
  stats.accept({ clippyWins: 2, clippyLosses: 1, windows: [], daily: [], funnel: [{ label: 'Cleared the board', count: 1 }], breakout: { averageWinSeconds: 40 } });
  stats.apply({ name: 'reversi-lose' });
  stats.apply({ name: 'reversi-win' });
  stats.apply({ name: 'open', detail: 'contact' });
  stats.apply({ name: 'visit', device: 'desktop' });
  stats.apply({ name: 'breakout-win', value: 20 });
  const data = stats.value();
  assert.equal(data.clippyWins, 3);
  assert.equal(data.clippyLosses, 2);
  assert.deepEqual(data.windows, [{ label: 'contact', count: 1 }]);
  assert.deepEqual(data.daily, [{ day: '2026-09-27', visits: 1 }]);
  assert.equal(data.breakout.averageWinSeconds, 30);
});

test('events from before the first load are added on top of it', () => {
  const stats = createOptimisticStats();
  stats.apply({ name: 'mail-error', detail: 'email' });
  stats.apply({ name: 'mail-sent' });
  const data = stats.accept({ mail: { errors: [{ label: 'email', count: 4 }], sent: 1, failed: 0 } });
  assert.deepEqual(data.mail, { errors: [{ label: 'email', count: 5 }], sent: 2, failed: 0 });
  assert.equal(stats.accept({ mail: { errors: [{ label: 'email', count: 5 }], sent: 2, failed: 0 } }).mail.sent, 2);
});
