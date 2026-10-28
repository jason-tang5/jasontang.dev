// photos for the my pictures app. each one has a full size webp and a small
// thumbnail next to it in assets/photos. dog photos are named dog-<id>, anything
// else sets `file` explicitly.
const asset = name => new URL(`../assets/photos/${name}`, import.meta.url).href;

const list = [
  { id: 7, date: '2024-04-22', file: 'volleyball-1', width: 1295, height: 861, description: 'The volleyball team in tri-campus league champions shirts sitting on the court with the trophy', caption: 'first year of tricampus' },
  { id: 8, date: '2025-03-10', file: 'volleyball-2', width: 1279, height: 854, description: 'The St. George volleyball team posing with the trophy under a 15–11 fifth-set scoreboard', caption: 'second year of tricampus', brightness: 0.8 },
  { id: 10, date: '2023-09-06', file: 'photo-2023-09-06', width: 1600, height: 1075, description: 'The Toronto ultimate team posing together on a grass field with a flying disc', caption: 'first year of UofT ultimate' },
  { id: 11, date: '2023-10-07', file: 'photo-2023-10-07', width: 1600, height: 955, description: 'Toronto and Waterloo ultimate players posing together on a grass field', caption: 'vs waterloo 😠' },
  { id: 14, file: 'amd-lunch', width: 1280, height: 748, description: 'A group lunch with the AMD team around a teppanyaki grill table', caption: 'amd lunch (free)' },
  { id: 13, file: 'badminton-highlight', mediaType: 'video', width: 1120, height: 720, description: 'Badminton highlight video', caption: '16 month training arc' },
  { id: 1, date: '2026-01-28', width: 1091, height: 1200, description: 'Pocky resting in a car with his tongue peeking out', caption: 'a name named', name: 'Pocky' },
  { id: 3, date: '2026-04-07', width: 900, height: 1200, description: 'Two dogs facing each other in a living room', caption: 'and his friend', name: 'Pringle' },
  { id: 12, width: 900, height: 1200, description: 'Pocky lying sleepily on the floor with his paws tucked up', caption: 'zzzZzZz' },
  { id: 5, date: '2026-04-07', width: 900, height: 1200, description: 'A close-up of a dog wearing a collar', caption: 'side eye...' },
];

export const photos = list.map(photo => {
  const file = photo.file ?? `dog-${photo.id}`;
  return {
    ...photo,
    source: asset(`${file}.${photo.mediaType === 'video' ? 'mp4' : 'webp'}`),
    poster: photo.mediaType === 'video' ? asset(`${file}.webp`) : undefined,
    thumbnail: asset(`${file}-thumb.webp`),
  };
});
