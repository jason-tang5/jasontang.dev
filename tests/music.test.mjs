import test from 'node:test';
import assert from 'node:assert/strict';
import { findTrack, musicDiscs, trackSlug } from '../src/music.mjs';

test('track links find their disc and track by slug', () => {
  assert.equal(trackSlug('JANE DOE'), 'jane-doe');
  assert.equal(trackSlug("i know you'll like this"), 'i-know-you-ll-like-this');
  const found = findTrack('jane-doe');
  assert.equal(musicDiscs[found.disc].tracks[found.track].title, 'JANE DOE');
  assert.equal(findTrack('not-a-song'), null);
});
