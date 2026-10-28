<!-- the full writeup. the site shows a shorter version of it (src/content.mjs) -->

# Portfolio Website

*Web development · Fall 2026*

> This site!

**Tech:** Vue, JavaScript, Cloudflare Workers, Durable Objects, Workers KV, Vite, Playwright

## What I built

Most portfolios are a scrolling page with a list of projects and experiences. To stand out, I wanted mine to feel like something you’d want to poke around in, so I spent a decent chunk of time thinking about what would be cool to make. I first got inspired by desktop-style sites like sharyap.com and expensive.toys. Then I saw this really cool video-to-ASCII npm package by Lucas, react-video-ascii, and that got me thinking: what if I made a desktop too?

Then I filled it with things I’d want to find. My email is locked inside a Breakout arcade cabinet, and you have to clear the bricks to get it. Snake has a worldwide leaderboard. Clippy is back, and he’ll trash-talk you over Reversi. There’s also Minesweeper, a CD player that plays my music on Spotify, sticky notes, and this blog.

*[Figure: apps]*

## Cool things hiding in here

There isn’t a single sound file. Every click, beep and chime is generated on the fly with Web Audio. The game backgrounds are animated ASCII art. It felt more in the spirit of the era to make the retro stuff instead of downloading it.

Your iPhone vibrates, too. Safari doesn’t let websites trigger haptics, but toggle switches get a little haptic tick. So there’s a hidden switch on the page, and the site flips it whenever it wants your phone to buzz.

People are creative with leaderboard names, so the Snake leaderboard had a profanity filter from day one. It sees through letter swaps, and names are checked in your browser and again on the server.

The analytics ignore bots and link previews. Nothing is counted until you actually click or press a key, so every visit in Fig. 3 is a real person.

## What I learned

Safari is its own boss fight. Videos played everywhere except Safari, which turned out to need the server to send them in chunks. The haptics trick exists only because Safari says no to the normal way.

Tests are what let me keep adding things. With more than a dozen apps sharing one desktop, every new feature risked breaking an old one. Playwright now clicks through every app at desktop and phone sizes, so I can add things without breaking what’s already there.

Building for everyone makes it better for everyone. I added keyboard controls and screen reader announcements for accessibility, and they made the games nicer to play for everyone.

*[Figure: stack]*

## Under the hood

For anyone curious how it all fits together:

- **Frontend:** Vue and Vite. The window manager’s geometry is plain JavaScript with no Vue, so it can be unit tested in Node.
- **Server:** One Cloudflare Worker serves the site and handles every /api request.
- **Live data:** A SQLite Durable Object tracks visits, who’s online, game wins and the Snake leaderboard.
- **Blog:** Posts are stored in Workers KV and edited from the site itself, behind Cloudflare Access.
- **Contact form:** Messages are sent through Cloudflare Email Routing.
- **Analytics:** Anonymous and cookie-free. Visits go to Workers Analytics Engine, and the Analytics window reads them back with its SQL API.
- **Testing:** Unit tests cover the worker, window geometry and games. Playwright clicks through every app at desktop and phone sizes.
- **Deploys:** Every push to main goes live automatically.
- **Accessibility:** It respects reduced motion and works with a keyboard and screen reader.

*[Figure: live]*
