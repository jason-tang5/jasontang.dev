// a track for the cd player to put on, from links like #app=music&track=jane-doe.
// App.vue sets it when the hash asks for one, and Music.vue loads the disc and track,
// even if the player wasn't open yet. a new object each time, so the same link twice still cues
import { ref } from 'vue';

export const cdCue = ref(null);
export function cueTrack(slug) {
  cdCue.value = { slug };
}

// the title of the song the cd player is playing right now, or null when it's paused,
// ejected or closed. Music.vue keeps it up to date, the about page's quote watches it
export const cdPlaying = ref(null);
