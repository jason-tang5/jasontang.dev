// blog posts kept in the repo. each post looks like:
//   { slug, title, subtitle, date: 'YYYY-MM-DD', lead, blocks }
// or, instead of blocks, source: the same markup as the editor on the site
// (blog-markup.mjs), read from a .md file in posts/
// (subtitle is optional, one line under the title in the post list)
// (thumbnail is the post list picture for a post that opens with a figure: a pixel
// icon on a navy card in assets/blog/thumbs, like the contact post's mail icon)
//
// block types:
//   paragraph { text }
//   heading   { text }
//   image     { src, alt, caption }
//   demo      { src, title }
//   code      { code, language }
//
// the lead is either an image or a demo block. everything is rendered as text,
// so don't try to sneak raw html in.
//
// posts written on the site (in kv) win over these when they share a slug, so
// editing one of these on the site saves the edited copy to kv. their interactive
// figures are listed in blog-figures.mjs
import uiCrashCourse from './posts/a-crash-course-in-this-sites-ui.md?raw';
import analytics from './posts/how-the-analytics-work.md?raw';
import durableObject from './posts/one-durable-object-as-the-whole-backend.md?raw';

// the lead is also kept as leadImage, which the editor fills in when one is edited
const lead = (src, alt) => ({ lead: { type: 'image', src, alt }, leadImage: src });
const thumbnail = slug => `/assets/blog/thumbs/${slug}.svg`;

export const posts = [
  {
    slug: 'a-crash-course-in-this-sites-ui',
    title: 'A Crash Course in This Site’s UI',
    subtitle: 'letters you can smash, games that play themselves, and figures you can poke',
    date: '2026-09-28',
    ...lead('/figures/ui/smash', 'Pocky the dog drawn in coloured ASCII letters, ready to be smashed'),
    thumbnail: thumbnail('a-crash-course-in-this-sites-ui'),
    source: uiCrashCourse,
  },
  {
    slug: 'how-the-analytics-work',
    title: 'How the Analytics Work',
    subtitle: 'counting visitors without cookies, and numbers that never go backwards',
    date: '2026-09-28',
    ...lead('/figures/analytics/journey', 'An event’s trip from a click to the Analytics window'),
    thumbnail: thumbnail('how-the-analytics-work'),
    source: analytics,
  },
  {
    slug: 'one-durable-object-as-the-whole-backend',
    title: 'One Durable Object as the Whole Backend',
    subtitle: 'four tables, one class, and nothing to coordinate',
    date: '2026-09-28',
    ...lead('/figures/backend/race', 'Two wins arriving at the same moment'),
    thumbnail: thumbnail('one-durable-object-as-the-whole-backend'),
    source: durableObject,
  },
];
