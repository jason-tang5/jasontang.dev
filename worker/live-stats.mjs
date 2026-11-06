// One SQLite Durable Object serializes counters and retains all-time records.
import { cleanName } from '../src/names.mjs';
export class LiveStats {
  constructor(ctx) {
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS totals (name TEXT PRIMARY KEY, value INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, seen INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS scores (id TEXT PRIMARY KEY, score INTEGER NOT NULL)`);
    // the leaderboard name came later, so older tables get the column added. it
    // throws once the column is there, which is fine
    try { this.sql.exec(`ALTER TABLE scores ADD COLUMN name TEXT`); } catch { /* already added */ }
    // each player's best per day, for the 7 and 30 day boards. kept for 31 days
    this.sql.exec(`CREATE TABLE IF NOT EXISTS daily_scores (id TEXT NOT NULL, day TEXT NOT NULL, score INTEGER NOT NULL, name TEXT, PRIMARY KEY (id, day))`);
    // unique visitors, all time. the worker's visitor ids (worker/analytics.mjs) are new
    // each month, so this month's are kept to spot someone coming back and older ones
    // dropped. the count started from the visits before ids, which each count once
    this.sql.exec(`CREATE TABLE IF NOT EXISTS visitor_ids (id TEXT PRIMARY KEY, month TEXT NOT NULL)`);
    this.sql.exec(`INSERT OR IGNORE INTO totals SELECT 'uniqueVisitors', value FROM totals WHERE name = 'visitors'`);
  }
  async fetch(request) {
    const now = Date.now();
    if (request.method === 'POST') {
      const { visit, name, value, player, playerId, visitor } = await request.json();
      if (name === 'visit') {
        this.sql.exec(`INSERT INTO totals VALUES ('visitors', 1) ON CONFLICT(name) DO UPDATE SET value=value+1`);
        // a visit with no id (no salt set) counts as a new visitor, like the analytics do
        const month = dayOf(now).slice(0, 7);
        const id = typeof visitor === 'string' && /^[0-9a-f]{16}$/.test(visitor) ? visitor : '';
        const fresh = !id || [...this.sql.exec(`INSERT INTO visitor_ids VALUES (?, ?) ON CONFLICT(id) DO NOTHING RETURNING id`, id, month)].length > 0;
        if (fresh) this.sql.exec(`INSERT INTO totals VALUES ('uniqueVisitors', 1) ON CONFLICT(name) DO UPDATE SET value=value+1`);
        this.sql.exec(`DELETE FROM visitor_ids WHERE month < ?`, month);
      }
      if (name === 'visit' || name === 'heartbeat') {
        this.sql.exec(`INSERT INTO sessions VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen`, visit, now);
      }
      if (name === 'leave') this.sql.exec(`DELETE FROM sessions WHERE id=?`, visit);
      const counter = { 'minesweeper-win': 'minesweeperWins', 'breakout-complete': 'breakoutWins', 'reversi-lose': 'clippyWins', 'reversi-win': 'clippyLosses', '2048-win': 'twenty48Wins' }[name];
      if (counter) this.sql.exec(`INSERT INTO totals VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET value=value+1`, counter);
      // the best 2048 score only ever goes up
      if (name === '2048-score' && Number.isInteger(value) && value > 0 && value <= 1e6) {
        this.sql.exec(`INSERT INTO totals VALUES ('twenty48HighScore', ?) ON CONFLICT(name) DO UPDATE SET value=MAX(value, excluded.value)`, value);
      }
      if (name === 'snake-score' && Number.isInteger(value) && value > 0 && value <= 1000) {
        // names are checked again here, a blocked or missing one stays anonymous
        // a score belongs to the browser's saved player id, or to the visit for older pages
        const id = typeof playerId === 'string' && /^[a-z0-9]{8,24}$/.test(playerId) ? playerId : visit;
        const playerName = cleanName(player) || null;
        this.sql.exec(`INSERT INTO scores (id, score, name) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET score=MAX(score, excluded.score), name=excluded.name`, id, value, playerName);
        this.sql.exec(`INSERT INTO daily_scores (id, day, score, name) VALUES (?, ?, ?, ?) ON CONFLICT(id, day) DO UPDATE SET score=MAX(score, excluded.score), name=excluded.name`, id, dayOf(now), value, playerName);
        // a year of days backs the 7, 30, 90 day and 1 year boards
        this.sql.exec(`DELETE FROM daily_scores WHERE day < ?`, dayOf(now - 366 * day));
        // Only the top 100 anonymous sessions need permanent storage.
        this.sql.exec(`DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY score DESC, id LIMIT 100)`);
      }
    }
    this.sql.exec(`DELETE FROM sessions WHERE seen < ?`, now - 90000);
    const totals = Object.fromEntries([...this.sql.exec('SELECT * FROM totals')].map(r => [r.name, r.value]));
    const leaderboard = board(this.sql.exec('SELECT id, score, name FROM scores ORDER BY score DESC, id LIMIT 10'));
    // sqlite hands back the name from the row with the max score
    const since = days => board(this.sql.exec(`SELECT id, MAX(score) AS score, name FROM daily_scores WHERE day > ? GROUP BY id ORDER BY score DESC, id LIMIT 10`, dayOf(now - days * day)));
    const online = [...this.sql.exec('SELECT COUNT(*) AS count FROM sessions')][0].count;
    return Response.json({ visitors: 0, uniqueVisitors: 0, minesweeperWins: 0, breakoutWins: 0, clippyWins: 0, clippyLosses: 0, twenty48Wins: 0, twenty48HighScore: 0, ...totals, online, snakeHighScore: leaderboard[0]?.score || 0, leaderboard, leaderboardWeek: since(7), leaderboardMonth: since(30), leaderboardQuarter: since(90), leaderboardYear: since(365) }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
const day = 86400000;
const dayOf = time => new Date(time).toISOString().slice(0, 10);
// names are shown in capitals, older ones were stored as typed
const board = rows => [...rows].map((r, i) => ({ rank: i + 1, player: cleanName(r.name) || 'Player ' + r.id.slice(0, 6).toUpperCase(), score: r.score }));

export function liveStats(env) {
  return env.LIVE_STATS.get(env.LIVE_STATS.idFromName('site'));
}
