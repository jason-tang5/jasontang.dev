// Local changes are a temporary floor, not an increment added to every response.
// This avoids double counting when the server catches up. After 90 seconds the
// server wins even if an event was rejected or could not be delivered.
export function createOptimisticStats(now = Date.now) {
  let confirmed = null;
  let revision = 0;
  const floors = new Map();
  // events from before the first snapshot, replayed on top of it once it loads
  const early = [];
  const read = (data, path) => {
    const [field, label] = path.split(/[|#]/);
    const value = field.split('.').reduce((obj, key) => obj?.[key], data);
    return Number(label === undefined ? value : path.includes('#') ? value?.find(row => row.player === label)?.score : field === 'daily' ? value?.find(row => row.day === label)?.visits : value?.find(row => row.label === label)?.count) || 0;
  };
  const write = (data, path, value) => {
    const [field, label] = path.split(/[|#]/);
    const keys = field.split('.');
    const last = keys.pop();
    const parent = keys.reduce((obj, key) => obj[key] ||= {}, data);
    if (label === undefined) parent[last] = value;
    else if (path.includes('#')) {
      const rows = parent[last] ||= [];
      const row = rows.find(row => row.player === label);
      if (row) row.score = value;
      else rows.push({ player: label, score: value });
      parent[last] = rows.sort((a, b) => b.score - a.score).slice(0, 10).map((row, i) => ({ ...row, rank: i + 1 }));
    } else {
      const rows = parent[last] ||= [];
      const [labelKey, valueKey] = field === 'daily' ? ['day', 'visits'] : ['label', 'count'];
      const row = rows.find(row => row[labelKey] === label);
      if (row) row[valueKey] = value;
      else rows.push({ [labelKey]: label, [valueKey]: value });
    }
  };
  function value() {
    if (!confirmed) return null;
    const result = structuredClone(confirmed);
    for (const [path, floor] of floors) write(result, path, floor.until ? floor.value : Math.max(read(result, path), floor.value));
    return result;
  }
  function apply(event) {
    revision++;
    if (!confirmed) return void early.push(event);
    const current = value();
    const change = (path, amount = 1, maximum = false) => {
      floors.set(path, { value: maximum ? Math.max(read(current, path), amount) : read(current, path) + amount, at: now(), revision });
    };
    const counters = {
      visit: 'visitors', 'minesweeper-win': 'minesweeperWins', 'breakout-complete': 'breakoutWins',
      'reversi-lose': 'clippyWins', 'reversi-win': 'clippyLosses', '2048-win': 'twenty48Wins',
      'balloon-pop': 'balloonsPopped', 'koi-feed': 'koiFed', 'breakout-lose': 'breakout.losses',
      'mail-sent': 'mail.sent', 'mail-failed': 'mail.failed',
    };
    if (counters[event.name]) change(counters[event.name]);
    if (event.name === '2048-score') change('twenty48HighScore', event.value, true);
    if (event.name === 'snake-score') {
      change('snakeHighScore', event.value, true);
      const player = event.player || `Player ${String(event.playerId || '').slice(0, 6).toUpperCase()}`;
      for (const board of ['leaderboard', 'leaderboardWeek', 'leaderboardMonth', 'leaderboardQuarter', 'leaderboardYear']) {
        change(`${board}#${player}`, event.value, true);
      }
    }
    const rows = { open: 'windows', 'blog-post': 'blogPosts', 'mail-error': 'mail.errors' };
    if (rows[event.name]) change(`${rows[event.name]}|${event.name === 'open' && event.detail.startsWith('sticky-') ? 'sticky notes' : event.detail}`);
    const funnel = {
      visit: 'Visited the site', 'breakout-start': 'Started Breakout', 'breakout-win': 'Cleared the board',
      'breakout-mercy': 'Unlocked Mail by losing 3 times', 'email-click': 'Clicked the revealed email', 'mail-sent': 'Sent a message',
    };
    if (funnel[event.name]) change(`funnel|${funnel[event.name]}`);
    if (event.name === 'breakout-win') {
      const wins = read(current, 'funnel|Cleared the board');
      floors.set('breakout.averageWinSeconds', {
        value: Math.round((read(current, 'breakout.averageWinSeconds') * wins + event.value) / (wins + 1)),
        until: ['funnel|Cleared the board', wins + 1], at: now(), revision,
      });
    }
    if (event.name === 'open' && ['contact', 'mail'].includes(event.detail)) change(`funnel|Opened ${event.detail === 'mail' ? 'Mail' : 'Contact'}`);
    if (event.name === 'visit') {
      change(`devices|${event.device}`);
      change(`referrers|${event.referrer || 'direct'}`);
      change(`daily|${new Date(now()).toISOString().slice(0, 10)}`);
      change('online');
    }
  }
  return {
    value, apply,
    get revision() { return revision; },
    accept(snapshot, startedRevision = revision) {
      confirmed = snapshot;
      for (const [path, floor] of floors) {
        const caughtUp = floor.until ? read(snapshot, floor.until[0]) >= floor.until[1] : read(snapshot, path) >= floor.value;
        if (floor.revision <= startedRevision && (caughtUp || now() - floor.at >= 90000)) floors.delete(path);
      }
      for (const event of early.splice(0)) apply(event);
      return value();
    },
  };
}
