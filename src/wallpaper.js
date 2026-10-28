// the desktop is the animated sunset, and each colour choice re-tints it with a css
// filter. the hex values are what earlier visits saved, so they stay the keys. the
// koi pond swaps the sunset for a pond you can feed (KoiPond.vue).
export const wallpapers = [
  { label: 'Sunset', color: '#008080', filter: 'none' },
  { label: 'Slate', color: '#576575', filter: 'grayscale(.85) brightness(.95)' },
  { label: 'Koi pond', color: '#1c1b19', filter: 'none', pond: true },
];

export const defaultWallpaper = wallpapers[0].color;
export const wallpaperFilter = color => (wallpapers.find(w => w.color === color) ?? wallpapers[0]).filter;
export const isPond = color => Boolean(wallpapers.find(w => w.color === color)?.pond);
