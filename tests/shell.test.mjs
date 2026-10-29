import test from 'node:test';
import assert from 'node:assert/strict';
import { appFor, complete, run } from '../src/shell.mjs';

const shell = (unlocked = false) => ({ cwd: '', history: [], started: Date.now(), isUnlocked: () => unlocked });
// a line's text, whether it came as a string or as segments
const text = line => [line].flat().map(seg => (typeof seg === 'string' ? seg : seg[0])).join('');

test('ls lists the folder you are in, and cd moves between them', () => {
  const state = shell();
  assert.match(text(run('ls', state).lines[0]), /games\/.*funstuff\/.*about\.txt.*about/);
  state.cwd = run('cd games', state).cwd;
  assert.equal(state.cwd, 'games');
  assert.equal(text(run('ls', state).lines[0]), 'contact  minesweeper  snake  reversi  2048  digits');
  assert.equal(text(run('pwd', state).lines[0]), '/home/jason/games');
  assert.equal(run('cd ../funstuff', state).cwd, 'funstuff');
  assert.equal(run('cd', state).cwd, '');
  assert.match(text(run('cd nowhere', state).lines[0]), /No such file/);
});

test('an app opens by name, with open, start or an alias', () => {
  const state = shell();
  assert.equal(run('snake', state).open, 'snake');
  assert.equal(run('open 2048', state).open, '2048');
  assert.equal(run('start msn', state).open, 'chat');
  assert.equal(run('./breakout', state).open, 'contact');
  assert.equal(run('open liftlens', state).open, 'liftlens');
  assert.equal(run('open games', state).open, 'games');
  assert.equal(appFor('Music'), 'music');
  assert.equal(run('open nothing', state).open, undefined);
});

test('mail stays locked until breakout is beaten', () => {
  assert.equal(run('mail', shell(false)).open, undefined);
  assert.match(text(run('mail', shell(false)).lines[0]), /permission denied/);
  assert.equal(run('mail', shell(true)).open, 'mail');
});

test('cat prints the text files and points at the rest', () => {
  const state = shell();
  assert.match(text(run('cat about.txt', state).lines[0]), /Jason/);
  assert.match(run('cat experience.txt', state).lines.map(text).join('\n'), /AMD/);
  assert.match(text(run('cat resume.pdf', state).lines[0]), /open resume/);
  assert.match(text(run('cat snake', state).lines[0]), /is an app/);
});

test('clear, exit and unknown commands', () => {
  const state = shell();
  assert.equal(run('clear', state).clear, true);
  assert.equal(run('cls', state).clear, true);
  assert.equal(run('exit', state).close, true);
  assert.match(text(run('frobnicate', state).lines[0]), /command not found/);
  assert.deepEqual(run('   ', state).lines, []);
});

test('tab completes commands, apps, folders and files', () => {
  assert.equal(complete('neof', '').input, 'neofetch ');
  assert.equal(complete('cd fun', '').input, 'cd funstuff/');
  assert.equal(complete('cat exp', '').input, 'cat experience.txt ');
  assert.equal(complete('open sna', '').input, 'open snake ');
  const many = complete('s', '');
  assert.ok(many.options.includes('sudo') && many.options.includes('start'));
  assert.equal(complete('zzz', '').input, 'zzz');
});
