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
test('japanese titles keep their own slug and every slug on a disc is unique', () => {
  assert.equal(trackSlug('小村'), '小村');
  const found = findTrack('ひとりごと');
  assert.equal(musicDiscs[found.disc].title, 'weeb shi');
  for (const disc of musicDiscs) {
    const slugs = (disc.tracks || []).map(t => trackSlug(t.title));
    assert.ok(slugs.every(Boolean));
    assert.equal(new Set(slugs).size, slugs.length);
  }
});
