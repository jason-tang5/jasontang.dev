// the album the cd player plays
export const albumUrl = 'https://open.spotify.com/album/35I1NyorvFXQm14NSTQGY4';
export const playlistUrl = 'https://open.spotify.com/playlist/3DBtkOxCoSnNZnxFds2dos';

// Fill the empty sleeves with Jason's album links when he picks the next discs.
// the track lists are defined further down
export const musicDiscs = [
  { title: 'Jazzy but not too jazzy', url: albumUrl, uri: 'spotify:album:35I1NyorvFXQm14NSTQGY4', color: '#96dfcf' },
  { title: 'jasontang.dev', url: playlistUrl, uri: 'spotify:playlist:3DBtkOxCoSnNZnxFds2dos', color: '#b9a2e9' },
  { title: 'Empty disc 03', uri: null, color: '#efc57d' },
  { title: 'Empty disc 04', uri: null, color: '#e99bb7' },
];

// the disc that's in the player when the window opens
export const defaultDisc = 1;

// turns an album link into the clean url plus the embed url, or null if it isn't one
export function spotifyAlbum(url) {
  const match = /^https:\/\/open\.spotify\.com\/album\/([A-Za-z0-9]{22})(?:\?.*)?$/.exec(url);
  if (!match) return null;
  return {
    url: `https://open.spotify.com/album/${match[1]}`,
    embed: `https://open.spotify.com/embed/album/${match[1]}?utm_source=generator&theme=0`,
  };
}

// track list copied from spotify's embed on 2026-09-25. durations are in ms.
export const tracks = [
  { uri: 'spotify:track:0o9nSLwxvwa2jpkWAv1A7e', title: 'keep it lowkey', duration: 202000 },
  { uri: 'spotify:track:2mGICJePwFTIRJE5ShUuXD', title: "i know you'll like this", duration: 192000 },
  { uri: 'spotify:track:0Vdc6nn45DRGiAe83AfYHE', title: "ridin'", duration: 188000 },
  { uri: 'spotify:track:0uL4tVLBoUpA7Xqgd5nMUy', title: 'bourbon nights', duration: 185000 },
  { uri: 'spotify:track:4XO1vCpJA3pxUPWXJbFInH', title: 'let it be', duration: 154000 },
  { uri: 'spotify:track:60JfIBSy2xeFdKS7xYwBA1', title: 'pretty tricky', duration: 124759 },
  { uri: 'spotify:track:3fBeuNTKa6FRJqdGnfA6OR', title: "the beat's hot", duration: 139000 },
  { uri: 'spotify:track:4omilNkTyubVw372cCcsDK', title: 'sofa blues', duration: 208519 },
  { uri: 'spotify:track:6UVQrSDKxCKBFkY0PV60LK', title: 'another way', duration: 89500 },
  { uri: 'spotify:track:3z4Ih5iMHBOKDS7jCPvTvR', title: "don't sweat it", duration: 178000 },
  { uri: 'spotify:track:4eF04Mg5sa5BnRuOmzri1P', title: 'rusty', duration: 64177 },
  { uri: 'spotify:track:6QxXdUJH6yayqx1Qqw4zOC', title: 'close, but not there yet', duration: 138039 },
  { uri: 'spotify:track:6ILNJKefZdT8mIxtv6d8Nx', title: 'jazzy but not too jazzy', duration: 183199 },
  { uri: 'spotify:track:09gMKRfspvKwuTyhkqKcXW', title: 'step by step', duration: 141000 },
  { uri: 'spotify:track:72xWcTFNVMeyF0WwtvJYXX', title: 'minimalistic', duration: 226500 },
  { uri: 'spotify:track:0y6MbnHfyuLWyP1oaXNMpg', title: "that's neat", duration: 148000 },
  { uri: 'spotify:track:5w4xu2MiWWMz6CnSXjZXcA', title: 'stuck here', duration: 151000 },
  { uri: 'spotify:track:0YrOoozjBihclD34MvRFKA', title: 'tryin too hard', duration: 120000 },
  { uri: 'spotify:track:5QMyYEaxJLI0Y6ZOaHeI3X', title: 'best of times', duration: 159000 },
  { uri: 'spotify:track:4dSGu8iX5967uQvpKfAA5r', title: 'last night', duration: 176999 },
  { uri: 'spotify:track:4wN01eNGpYhIzfnXj9OMmF', title: 'with ease', duration: 164000 },
  { uri: 'spotify:track:1GYuM3kefNbPRCGgDTyuL8', title: "nothing that can't wait", duration: 139000 },
  { uri: 'spotify:track:3uQ5Jt14MJxBlIy0zfCR4b', title: 'little thing', duration: 176000 },
];

// track list copied from spotify's playlist embed on 2026-10-23. durations are in ms.
export const playlistTracks = [
  { uri: 'spotify:track:3IYPLyQDgCJsyRgJ1NWWGv', title: 'Shiki no Uta', duration: 300033 },
  { uri: 'spotify:track:4ZJKi7HXFDG2emN6xIdbmV', title: 'Heartbeat, Heartbreak', duration: 135226 },
  { uri: 'spotify:track:5XLXrm5JVMdOus1fWmTOFw', title: 'Beneath the Mask', duration: 277880 },
  { uri: 'spotify:track:37NPLfEZQQ0rZTa9SRqWBL', title: "midnight cruisin'", duration: 283000 },
  { uri: 'spotify:track:0JUWF44gfMszGNhjCF7Ufs', title: 'Midnight Pretenders', duration: 345266 },
  { uri: 'spotify:track:7rU6Iebxzlvqy5t857bKFq', title: 'Plastic Love', duration: 294493 },
  { uri: 'spotify:track:2lV8YY0GQYXgtUWXM4NJ4X', title: '4:00A.M.', duration: 336960 },
  { uri: 'spotify:track:5LZja1KAke25BqjsidAcsq', title: 'Good Bye Boogie Dance', duration: 272093 },
  { uri: 'spotify:track:4J2oDU9oacz7lJ7H8A8P8v', title: 'Mayonaka no Door~stay with me', duration: 312293 },
  { uri: 'spotify:track:1AvuBt1hrjsHeBxFX91Rn6', title: 'in the pool', duration: 245440 },
  { uri: 'spotify:track:7k1HoUdskuBhyWvm7hPctM', title: 'Call of Silence', duration: 178213 },
  { uri: 'spotify:track:4oE7MyJhqSD3BaHRpNs8Nl', title: 'JANE DOE', duration: 235946 },
  { uri: 'spotify:track:4sUTagdmyuyAxd7RvbygpQ', title: 'aruarian dance', duration: 250433 },
];

musicDiscs[0].tracks = tracks;
musicDiscs[1].tracks = playlistTracks;

// a track title as it goes in a link: JANE DOE is jane-doe
export const trackSlug = title => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// which disc and track a slug points at, or null if no disc has it
export function findTrack(slug) {
  for (const [disc, { tracks: list = [] }] of musicDiscs.entries()) {
    const track = list.findIndex(t => trackSlug(t.title) === slug);
    if (track >= 0) return { disc, track };
  }
  return null;
}
