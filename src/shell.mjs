// the commands behind the terminal app (Terminal.vue). the desktop is a little file
// system: home holds the desktop's apps, a few text files and the folders, and each
// folder holds its apps. running an app's name (or open, start, ./name) opens its window.
// run() takes one line and the shell's state and returns what to print, plus what to
// do: open a window, close the terminal or clear the screen. it never touches the page,
// so the tests can drive it directly
import { profile, projects, roles } from './content.mjs';
import { apps, folders, registry } from './registry.js';

export const user = 'jason';
export const host = 'portfolio';

// the folders under home, each with the windows inside it
const dirs = {
  games: folders.games,
  funstuff: folders.funstuff,
  projects: projects.map(p => p.id),
};
// home's apps are the ones with a desktop icon, less the folders, which show as dirs
const homeApps = apps.filter(a => a.desktop && !(a.id in dirs)).map(a => a.id);
const files = {
  'about.txt': () => [profile.intro, profile.bio, '', ...profile.facts.filter(f => f.text && !f.books).map(f => `${f.label}: ${plain(f.text)}`)],
  'experience.txt': () => roles.flatMap((r, i) => [
    ...(i ? [''] : []),
    [[`${r.role} @ ${r.company}`, 'accent']],
    [[`${r.dates} · ${r.location}`, 'dim']],
    ...r.bullets.map(b => `  - ${plain(b)}`),
  ]),
  'skills.txt': () => [profile.skills.join(', ')],
};
// the resume is a pdf, so cat points you at its window instead
const binaries = { 'resume.pdf': 'resume' };

// other names people might reach for
const aliases = {
  msn: 'chat', messenger: 'chat', breakout: 'contact', notes: 'stickies', cdplayer: 'music',
  photos: 'pictures', mines: 'minesweeper', othello: 'reversi', cv: 'resume', explorer: 'computer',
  cmd: 'terminal', bash: 'terminal',
};

// **bold** and [links](…) from content.mjs, as plain text
const plain = text => text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/\[(.+?)\]\(.+?\)/g, '$1');
const slug = name => name.toLowerCase().replace(/^\.\//, '').replace(/\.exe$/, '').replace(/[\s_]+/g, '-');

// an app's id from what was typed, or null
export function appFor(name) {
  const s = slug(name);
  if (registry[s]) return s;
  const squashed = s.replace(/-/g, '');
  if (aliases[squashed]) return aliases[squashed];
  return Object.keys(registry).find(id => registry[id].label.toLowerCase().replace(/[^a-z0-9]/g, '') === squashed) ?? null;
}

// '~' for home, '~/games' for a folder
export const pathOf = cwd => (cwd ? `~/${cwd}` : '~');

// where a path lands from cwd: '' for home, a dir's name, or undefined if it isn't one
function resolve(cwd, path = '.') {
  let at = cwd;
  const parts = path.replace(/\/+$/, '').split('/');
  for (const [i, part] of parts.entries()) {
    if (part === '' && i === 0) at = ''; // a leading slash, treated as home
    else if (part === '~') at = '';
    else if (part === '..') at = '';
    else if (part === '.' || part === '') continue;
    else if (at === '' && part in dirs) at = part;
    else return undefined;
  }
  return at;
}

// what's in a dir: its folders, files and apps, in that order
function entries(dir) {
  if (dir) return dirs[dir].map(id => ({ name: id, kind: 'exe' }));
  return [
    ...Object.keys(dirs).map(name => ({ name, kind: 'dir' })),
    ...[...Object.keys(files), ...Object.keys(binaries)].sort().map(name => ({ name, kind: 'file' })),
    ...homeApps.map(name => ({ name, kind: 'exe' })),
  ];
}

const commands = {
  help: () => ({
    lines: [
      'Commands:',
      ...[
        ['ls [dir]', 'list what’s here'],
        ['cd <dir>', 'move into a folder'],
        ['open <app>', 'open an app, or just type its name'],
        ['cat <file>', 'print a file, try about.txt'],
        ['neofetch', 'about this system'],
        ['clear', 'clear the screen'],
        ['exit', 'close the terminal'],
      ].map(([name, what]) => [[`  ${name.padEnd(12)}`, 'accent'], what]),
      ['Also: whoami, pwd, date, echo, history. The DOS names (dir, cls, start, type) work too.'],
      '',
      [['Tab completes names, ↑ and ↓ go through what you typed.', 'dim']],
    ],
  }),
  ls: (args, state) => {
    const target = args.find(a => !a.startsWith('-'));
    const dir = resolve(state.cwd, target);
    if (dir === undefined) return error(`ls: cannot access '${target}': No such file or directory`);
    return { lines: [entries(dir).map(e => [e.kind === 'dir' ? `${e.name}/` : e.name, e.kind]).flatMap((seg, i) => (i ? ['  ', seg] : [seg]))] };
  },
  cd: (args, state) => {
    const dir = resolve(state.cwd, args[0] ?? '~');
    if (dir === undefined) {
      const app = appFor(args[0]);
      return error(app ? `cd: ${args[0]}: Not a directory (try: open ${args[0]})` : `cd: ${args[0]}: No such file or directory`);
    }
    return { lines: [], cwd: dir };
  },
  pwd: (_, state) => ({ lines: [`/home/${user}${state.cwd ? `/${state.cwd}` : ''}`] }),
  open: (args, state) => {
    if (!args.length) return error('open: missing app name. try: ls');
    const name = args[0];
    // a folder opens its window
    const dir = resolve(state.cwd, name);
    if (dir) return launch(dir, state);
    const id = appFor(name);
    if (!id) return error(`open: ${name}: no such app. try: ls`);
    return launch(id, state);
  },
  cat: (args, state) => {
    if (!args.length) return error('cat: missing file name');
    return { lines: args.flatMap(name => {
      const file = name.replace(/^~\//, '');
      if (state.cwd === '' || name.startsWith('~/')) {
        if (files[file]) return files[file]();
        if (binaries[file]) return [[[`cat: ${name}: binary file, try: open ${binaries[file]}`, 'err']]];
        if (file in dirs) return [[[`cat: ${name}: Is a directory`, 'err']]];
      }
      const id = appFor(name);
      if (id) return [[[`cat: ${name}: is an app, try: open ${name}`, 'err']]];
      return [[[`cat: ${name}: No such file or directory`, 'err']]];
    }) };
  },
  whoami: () => ({ lines: [user] }),
  date: () => ({ lines: [new Date().toString()] }),
  echo: args => ({ lines: [args.join(' ')] }),
  history: (_, state) => ({ lines: state.history.map((line, i) => `${String(i + 1).padStart(4)}  ${line}`) }),
  clear: () => ({ lines: [], clear: true }),
  exit: () => ({ lines: [], close: true }),
  uname: args => ({ lines: [args.includes('-a') ? `Portfolio98 ${host} 4.10.1998 i686 jasontang.dev` : 'Portfolio98'] }),
  neofetch: (_, state) => ({ lines: neofetch(state) }),
  sudo: () => error(`${user} is not in the sudoers file. This incident will be reported.`),
  rm: () => error('rm: permission denied. nice try'),
  mkdir: () => error('mkdir: read-only file system'),
  touch: () => error('touch: read-only file system. try: open stickies'),
  vim: () => error('no editors here. try: open stickies'),
  man: args => (args.length ? error(`No manual entry for ${args[0]}. try: help`) : error('What manual page do you want? try: help')),
  ping: () => ({ lines: ['PONG'] }),
};
// the dos names do the same
Object.assign(commands, {
  dir: commands.ls, cls: commands.clear, start: commands.open, type: commands.cat, ver: commands.uname,
  xdg_open: commands.open, nano: commands.vim, emacs: commands.vim, code: commands.vim, 'cd..': (_, s) => commands.cd(['..'], s),
});
commands['xdg-open'] = commands.open;
export const commandNames = Object.keys(commands).filter(name => !name.includes('_') && name !== 'cd..');

function error(text) {
  return { lines: [[[text, 'err']]] };
}

function launch(id, state) {
  const app = registry[id];
  if (app.locked && !state.isUnlocked(id)) return error(`${id}: permission denied. beat breakout first (open contact)`);
  if (id === 'terminal') return { lines: ['You’re already in it.'] };
  return { lines: [[['Opening ', 'dim'], app.label, ['...', 'dim']]], open: id };
}

// a little system summary, a pixel monitor beside it
function neofetch({ started }) {
  const minutes = Math.max(0, Math.round((Date.now() - started) / 60000));
  const art = [
    "  .--------.   ",
    "  | >_     |   ",
    "  |   JT   |   ",
    "  |        |   ",
    "  '--------'   ",
    "     _||_      ",
    "    '----'     ",
    "               ",
  ];
  const info = [
    [[`${user}@${host}`, 'accent']],
    [['---------------', 'dim']],
    [['OS', 'accent'], ': Portfolio 98'],
    [['Host', 'accent'], ': jasontang.dev'],
    [['Uptime', 'accent'], `: ${minutes} min${minutes === 1 ? '' : 's'}`],
    [['Apps', 'accent'], `: ${apps.length + projects.length}`],
    [['Shell', 'accent'], ': jsh 1.0'],
    [['CPU', 'accent'], ': caffeine @ 3 cups/day'],
  ];
  return art.map((line, i) => [[line, 'exe'], ...(info[i] ?? [])]);
}

// one line of input against the shell's state ({ cwd, history, started, isUnlocked })
export function run(input, state) {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [] };
  const [name, ...args] = words;
  const command = commands[name.toLowerCase()];
  if (command) return command(args, state);
  // a dir's name moves into it, an app's name opens it
  if (resolve(state.cwd, name) !== undefined && !appFor(name)) return commands.cd([name], state);
  const id = appFor(name);
  if (id) return launch(id, state);
  return error(`${name}: command not found. try: help`);
}

// tab completion: the longest shared start of everything that fits the last word, and
// the options when there's more than one
export function complete(input, cwd) {
  const words = input.split(/\s+/);
  const last = words[words.length - 1].toLowerCase();
  const first = words.length === 1;
  const names = first
    ? [...commandNames, ...entries(cwd).map(e => e.name)]
    : ['cd', 'ls', 'dir'].includes(words[0])
      ? entries('').filter(e => e.kind === 'dir').map(e => e.name)
      : ['cat', 'type'].includes(words[0])
        ? entries('').filter(e => e.kind === 'file').map(e => e.name)
        : [...new Set([...entries(cwd).map(e => e.name), ...Object.keys(registry)])];
  const matches = [...new Set(names)].filter(n => n.startsWith(last)).sort();
  if (!matches.length) return { input, options: [] };
  let shared = matches[0];
  for (const m of matches) while (!m.startsWith(shared)) shared = shared.slice(0, -1);
  const done = matches.length === 1 ? `${shared}${dirs[shared] && !first ? '/' : ' '}` : shared;
  return { input: [...words.slice(0, -1), done].join(' '), options: matches.length > 1 ? matches : [] };
}
