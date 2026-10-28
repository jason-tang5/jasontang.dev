// the desktop is the animated sunset, or the koi pond, a pond you can feed
// (KoiPond.vue). the hex values are what earlier visits saved, so they stay the keys,
// and a saved colour that's no longer listed falls back to the sunset.
export const wallpapers = [
  { label: 'Sunset', color: '#008080', filter: 'none' },
  { label: 'Koi pond', color: '#1c1b19', filter: 'none', pond: true },
];

export const defaultWallpaper = wallpapers[0].color;
export const wallpaperFilter = color => (wallpapers.find(w => w.color === color) ?? wallpapers[0]).filter;
export const isPond = color => Boolean(wallpapers.find(w => w.color === color)?.pond);
