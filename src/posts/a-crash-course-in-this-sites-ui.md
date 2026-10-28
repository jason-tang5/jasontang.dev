This site is a Windows 95 desktop I built in about 180 commits over five days. Many of my favourite parts are drawn on a canvas, a blank rectangle that code paints pixel by pixel. This post covers three: photos you can smash, game backdrops that play themselves, and the figures in these posts.

# Photos made of letters

The About photo and everything in the Gallery are coloured ASCII art. Pick up the hammer and you can knock the letters off to reveal the photo. The one at the top of this post is the real component, so feel free to smash Pocky.

The animated wallpaper uses [react-video-ascii](https://www.npmjs.com/package/react-video-ascii), which runs in its own corner since it's built for React, not Vue. For photos I wrote my own canvas version (`KnockoffAscii.vue`), mostly because I wanted the hammer.

## From pixels to letters

The photo is shrunk to one pixel per letter, with fewer rows than columns since letters are about 1.65 times taller than wide. Each pixel's brightness picks a character from this ramp, dark to bright:

```text
 .,:;i1tfLCG08@
```

Brightness is luma, which weights green most because our eyes are most sensitive to it. Even the darkest cell gets a dot, and each letter is drawn in its pixel's colour, brightened so dark photos don't vanish.

![Picking a letter for each pixel](/figures/ui/ramp "Point at any cell to see its maths")

## Drawing thousands of letters without lag

The detail slider rebuilds the picture as you drag. My first version called `fillText` once per cell, tens of thousands of times at full detail, and the slider lagged.

Now each of the 14 characters is drawn once, in white, and every cell stamps its letter from that strip. Then the tiny photo is stretched over the top with the `source-in` composite mode, so the colour only lands on the letters.

![Stamping instead of typing](/figures/ui/stamp "Draw once, stamp everywhere, colour it all in one go")

In Chrome on my laptop that's 1.2 to 1.4 times faster at full detail and 1.7 times at the default. The button above times it on your device. The slider also rebuilds at most once per animation frame now.

The picture lives in three hidden canvases: **backing** (letters still there), **glyphs** (letters with no background, for flying pieces) and **glow** (for the mouse trail).

## The hammer

A perfect circle of broken letters looked fake. Each hit now has a solid core, 82% of the radius, and a wobbly edge from two sine waves at a random rotation. Letters in between break at random, less often further out.

![How a hit is worked out](/figures/ui/hit "Click the picture to swing somewhere else")

A canvas per broken letter could freeze the page on a big hit, so letters now fly off in chunks at least 8 pixels across, at most 60 per hit and 300 in the air. The crumble sound comes from Web Audio, holes survive a change in detail, and on phones you pick up the hammer first so dragging still scrolls.

# Games that play themselves in the background

Every game window surrounds its board with an ASCII version of that game playing itself: drifting bricks in Breakout, snakes playing Snake, a minefield that sweeps itself, rippling Reversi discs, and a 2048 board sliding and merging.

![The real backdrops](/figures/ui/backdrop "The same code as the game windows. Try the switches")

The 2048 backdrop uses the game's own `slideLine`, so merges follow the real rules. Backdrops speed up while you play, pause when their window isn't in front, and stay still with reduced motion on.

# Figures you can poke

A post can add a figure two ways. A `figure` code block is a bit of JSON that fills one of six templates (flow, steps, timeline, comparison, metrics or bars), checked field by field so it can't sneak in HTML. Or `blog-figures.mjs` swaps an image line with a specific address for a Vue component, like the figures here, so the post text stays plain.

![How a figure gets into a post](/figures/ui/swap "Edit the text and watch the blocks change")

When I can, the figures run the real code. The [contact form post](/#app=blog) calls the Worker's own `validate`, and here the smash and backdrop figures are the real components.

# Wrapping up

Getting ASCII on screen took a few lines. Most of the time went into the second version: fast enough for a slider, holes that survive a new grid, and no freezing on a big hit. Reusing real code for the figures was less work than faking it, and keeps them accurate when I change things.

# Fun fact: First Emoticon

The emoticon `:-)` was first used in 1982 by computer scientist Scott Fahlman to indicate jokes in online messages.
