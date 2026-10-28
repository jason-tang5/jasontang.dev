// every app that can open as a window. sizes are the default width/height,
// then the minimum width/height the window can be resized down to.
import { projects } from './content.mjs';

const app = (id, label, icon, width, height, minWidth = 340, minHeight = 260) => ({
  id,
  label,
  icon,
  width,
  height,
  minWidth,
  minHeight,
});

export const apps = [
  // the desktop icons and start menu follow this order. the desktop leaves an empty
  // cell after resume, so the work stuff reads as its own group above the rest
  app('about', 'About Me', 'person', 900, 740, 430, 350),
  app('projects', 'Projects', 'folder', 840, 580, 430, 310),
  app('resume', 'Resume', 'document', 740, 650),
  app('blog', 'Blog', 'notebook', 720, 580),
  app('chat', 'MSN Messenger', 'messenger', 760, 640, 340, 440),
  app('analytics', 'Analytics', 'chart', 720, 640),
  app('games', 'Games', 'games', 440, 350, 300, 270),
  app('funstuff', 'Fun Stuff', 'funstuff', 440, 350, 300, 270),
  app('contact', 'Contact', 'contact', 460, 680, 340, 520),
  // opened from the start menu, shows every app in one folder view
  app('computer', 'All Apps', 'computer', 480, 440, 300, 270),
  app('pictures', 'Gallery', 'pictures', 760, 720, 340, 400),
  app('settings', 'Desktop Settings', 'settings', 470, 730),
  app('stickies', 'Sticky Notes', 'sticky', 340, 520, 280, 300),
  app('music', 'Music', 'music', 360, 490, 335, 200),
  app('terminal', 'Terminal', 'terminal', 600, 420, 300, 260),
  app('snake', 'Snake', 'snake', 400, 700, 340, 560),
  app('minesweeper', 'Minesweeper', 'mine', 300, 400, 250, 330),
  app('reversi', 'Reversi', 'reversi', 420, 660, 350, 480),
  app('2048', '2048', '2048', 540, 800, 320, 560),
  // locked until you beat the breakout game in contact, see unlock() in App.vue
  app('mail', 'Mail', 'mail', 500, 450, 360, 330),
];

// the apps that live inside the games and fun stuff folders instead of on the desktop
export const folders = {
  games: ['contact', 'minesweeper', 'snake', 'reversi', '2048'],
  funstuff: ['pictures', 'stickies', 'music', 'terminal'],
};
// contact's breakout is in games and the terminal is in fun stuff, but both keep their desktop icons
const tucked = ['settings', 'mail', 'computer', ...Object.values(folders).flat()].filter(id => !['contact', 'terminal'].includes(id));
// all apps holds everything, including what's inside the other folders
folders.computer = apps.map(a => a.id).filter(id => id !== 'computer');

for (const a of apps) {
  a.desktop = !tucked.includes(a.id) && a.id !== 'blog'; // gets a desktop icon. the blog is only in the start menu and all apps
  a.menu = !tucked.includes(a.id); // shows up in the start menu
  a.fixedSize = false;
  a.locked = a.id === 'mail'; // can't be opened until something unlocks it
  a.sheet = a.id in folders; // on a phone, opens partway up the screen instead of filling it
  a.gapAfter = a.id === 'resume'; // an empty desktop cell follows its icon
}

// #app=breakout opens contact, where the game is, and #app=experience opens the resume
export const canonicalApp = id => ({ breakout: 'contact', experience: 'resume' })[id] ?? id;

// each project also opens as its own window from the projects folder
export const projectApps = projects.map(p => ({
  ...app(p.id, p.name, p.icon, 690, 550, 400, 310),
  type: 'project',
  project: p,
}));

export const registry = Object.fromEntries(
  [...apps, ...projectApps].map(a => [a.id, { ...a, type: a.type || a.id }]),
);

export const shortcuts = apps.filter(a => a.desktop);
export const menuApps = apps.filter(a => a.menu);
