import { ref, watch } from 'vue';
import { read, save } from './storage.js';

// the ascii photo settings, shared by the about portrait and my pictures, so a change
// in one shows up in the other and they're all remembered for next time

const saved = Number(read('image-ascii-columns', '220'));
// One detail setting for all photos. The renderer derives columns from size.
export const imageDetail = ref(Number.isFinite(saved) ? Math.min(220, Math.max(40, saved)) : 220);
watch(imageDetail, value => save('image-ascii-columns', value));

// ascii or normal. the portrait's old choice carries over from before they were shared
export const imageAscii = ref(read('image-ascii', read('portrait-ascii', 'on')) !== 'off');
watch(imageAscii, value => save('image-ascii', value ? 'on' : 'off'));

// the hammer size slider runs 1 to 7 and starts halfway
const savedHammer = Number(read('image-hammer-size', '4'));
export const hammerSize = ref(Number.isFinite(savedHammer) ? Math.min(7, Math.max(1, savedHammer)) : 4);
watch(hammerSize, value => save('image-hammer-size', value));

// whether the hammer is picked up. shared between the photos but not kept after a
// reload, so a phone never opens with a drag over a photo smashing it instead of scrolling
export const hammerArmed = ref(false);
