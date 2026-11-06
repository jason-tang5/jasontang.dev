import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { LiveStats } from '../worker/live-stats.mjs';
function setup() {
  const db = new DatabaseSync(':memory:');
  const ctx = { storage: { sql: { exec(query, ...args) { const statement = db.prepare(query); return statement.columns().length ? statement.all(...args) : (statement.run(...args), []); } } } };
  return { ctx, stats: new LiveStats(ctx) };
}
const post = (stats, name, visit = 'visitor123', value = 0) => stats.fetch(new Request('https://stats/', { method: 'POST', body: JSON.stringify({ name, visit, value }) }));
const get = async stats => (await stats.fetch(new Request('https://stats/'))).json();
test('durable totals, presence and leaderboard survive object recreation', async () => {
  const { stats, ctx } = setup();
  await post(stats, 'visit');
  await post(stats, 'heartbeat');
  await post(stats, 'minesweeper-win');
  await post(stats, 'breakout-complete');
  await post(stats, 'reversi-lose');
  await post(stats, 'reversi-lose');
  await post(stats, 'reversi-win');
  await post(stats, 'snake-score', 'visitor123', 12);
  await post(stats, 'snake-score', 'visitor123', 5);
  await post(stats, 'snake-score', 'visitor456', 20);
  await post(stats, '2048-win');
  await post(stats, '2048-score', 'visitor123', 20480);
  await post(stats, '2048-score', 'visitor456', 3000);
  const data = await get(new LiveStats(ctx));
  assert.equal(data.visitors, 1);
  assert.equal(data.online, 1);
  assert.equal(data.minesweeperWins, 1);
  assert.equal(data.breakoutWins, 1);
  assert.equal(data.clippyWins, 2);
  assert.equal(data.clippyLosses, 1);
  assert.equal(data.snakeHighScore, 20);
  assert.equal(data.twenty48Wins, 1);
  assert.equal(data.twenty48HighScore, 20480);
  assert.deepEqual(data.leaderboard.map(r => r.score), [20, 12]);
  await post(stats, 'leave');
  assert.equal((await get(stats)).online, 0);
});
test('presence expires and score storage stays bounded', async () => {
  const { stats, ctx } = setup();
  ctx.storage.sql.exec('INSERT INTO sessions VALUES (?, ?)', 'stale', Date.now() - 91000);
  for (let i = 1; i <= 105; i++) await post(stats, 'snake-score', 'player' + i, i);
  assert.equal((await get(stats)).online, 0);
  assert.equal((await get(stats)).leaderboard.length, 10);
  assert.equal([...ctx.storage.sql.exec('SELECT COUNT(*) AS n FROM scores')][0].n, 100);
});
test('snake names show on the leaderboard, blocked ones stay anonymous', async () => {
  const { stats } = setup();
  const score = (visit, value, player) => stats.fetch(new Request('https://stats/', { method: 'POST', body: JSON.stringify({ name: 'snake-score', visit, value, player }) }));
  await score('visitor001', 30, 'Jason');
  await score('visitor002', 20, 'sh1tface');
  await score('visitor003', 10);
  assert.deepEqual((await get(stats)).leaderboard.map(r => r.player), ['JASON', 'Player VISITO', 'Player VISITO']);
});
test('an older scores table without names gets the column', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE scores (id TEXT PRIMARY KEY, score INTEGER NOT NULL)');
  db.exec("INSERT INTO scores VALUES ('oldplayer1', 5)");
  const ctx = { storage: { sql: { exec(query, ...args) { const statement = db.prepare(query); return statement.columns().length ? statement.all(...args) : (statement.run(...args), []); } } } };
  new LiveStats(ctx);
  const data = await get(new LiveStats(ctx));
  assert.equal(data.leaderboard[0].player, 'Player OLDPLA');
});
test('one player id keeps one row across visits', async () => {
  const { stats } = setup();
  const score = (visit, value, playerId) => stats.fetch(new Request('https://stats/', { method: 'POST', body: JSON.stringify({ name: 'snake-score', visit, value, playerId, player: 'Jason' }) }));
  await score('visitaaaa1', 8, 'browserabc123');
  await score('visitbbbb2', 15, 'browserabc123');
  await score('visitcccc3', 4, 'browserabc123');
  await score('visitdddd4', 9, 'bad id!');
  const board = (await get(stats)).leaderboard;
  assert.deepEqual(board.map(r => [r.player, r.score]), [['JASON', 15], ['JASON', 9]]);
});
test('the 7, 30, 90 day and 1 year boards only count recent days', async () => {
  const { stats, ctx } = setup();
  const day = offset => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
  ctx.storage.sql.exec('INSERT INTO daily_scores VALUES (?, ?, ?, ?)', 'oldplayer1', day(20), 50, 'OLDIE');
  ctx.storage.sql.exec('INSERT INTO daily_scores VALUES (?, ?, ?, ?)', 'seasonal01', day(40), 70, 'SEASON');
  ctx.storage.sql.exec('INSERT INTO daily_scores VALUES (?, ?, ?, ?)', 'lastyear01', day(200), 80, 'SPRING');
  ctx.storage.sql.exec('INSERT INTO daily_scores VALUES (?, ?, ?, ?)', 'ancient001', day(400), 90, 'GONE');
  await stats.fetch(new Request('https://stats/', { method: 'POST', body: JSON.stringify({ name: 'snake-score', visit: 'visitnew01', value: 12, playerId: 'newplayer1', player: 'newbie' }) }));
  const data = await get(stats);
  assert.deepEqual(data.leaderboardWeek.map(r => [r.player, r.score]), [['NEWBIE', 12]]);
  assert.deepEqual(data.leaderboardMonth.map(r => [r.player, r.score]), [['OLDIE', 50], ['NEWBIE', 12]]);
  assert.deepEqual(data.leaderboardQuarter.map(r => [r.player, r.score]), [['SEASON', 70], ['OLDIE', 50], ['NEWBIE', 12]]);
  assert.deepEqual(data.leaderboardYear.map(r => [r.player, r.score]), [['SPRING', 80], ['SEASON', 70], ['OLDIE', 50], ['NEWBIE', 12]]);
  assert.equal([...ctx.storage.sql.exec("SELECT COUNT(*) AS n FROM daily_scores WHERE id = 'ancient001'")][0].n, 0);
});

test('unique visitors count each visitor id once a month and start from the old visits', async () => {
  const { stats, ctx } = setup();
  const visit = (visitor, time = Date.UTC(2026, 10, 6)) => {
    const realNow = Date.now;
    Date.now = () => time;
    return stats.fetch(new Request('https://stats/', { method: 'POST', body: JSON.stringify({ name: 'visit', visit: 'visitor123', visitor }) })).finally(() => { Date.now = realNow; });
  };
  // three visits from before ids, then the object restarts with the new code
  await visit(undefined); await visit(undefined); await visit(undefined);
  ctx.storage.sql.exec(`DELETE FROM totals WHERE name = 'uniqueVisitors'`);
  const restarted = new LiveStats(ctx);
  assert.equal((await get(restarted)).uniqueVisitors, 3);
  await visit('aaaaaaaaaaaaaaaa');
  await visit('aaaaaaaaaaaaaaaa');
  await visit('bbbbbbbbbbbbbbbb');
  await visit('not-a-real-id');
  const data = await get(stats);
  assert.equal(data.visitors, 7);
  assert.equal(data.uniqueVisitors, 6);
  // next month the old ids are dropped
  await visit('cccccccccccccccc', Date.UTC(2026, 11, 1));
  assert.deepEqual(ctx.storage.sql.exec('SELECT id FROM visitor_ids').map(r => r.id), ['cccccccccccccccc']);
});
