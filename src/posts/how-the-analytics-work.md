The Analytics window on this site is public. It shows visits, which windows people open, how many people beat Breakout, and how badly Clippy is winning at Reversi. I wanted real numbers without cookies, stored IP addresses or a third-party script.

The short version: your browser sends small anonymous events to my Cloudflare Worker. Live totals go into a Durable Object, history into Workers Analytics Engine, which I read back with SQL. Your own events show up right away as "floors": minimums the server's numbers can only raise.

# What gets tracked

Nothing is sent until your first click, tap or key press. Then the site makes a visit id, ten random characters kept only in a JavaScript variable, so a refresh starts a new visit. Waiting for a real press keeps out bots and link previews for free.

`track(name, detail, value)` records one of 20 events, like `open` or `breakout-win`, with an optional number such as how long the win took. Funnel steps (start Breakout, unlock Mail, send a message) count once per visit with `trackOnce`. A `heartbeat` every 30 seconds and a `leave` feed "online now". Events go out with `navigator.sendBeacon`, which survives the page closing, and only from `jasontang.dev`.

The Worker adds two things to the visit event, not your browser. First a rough location: Cloudflare already works out a country, region and city from every connection (`request.cf`), so it saves those three words. Visits it can't place are left off the list.

Then a visitor id, the way [Umami](https://umami.is) does it, so one person coming back counts once. It's a SHA-256 hash of a secret salt, the month, your IP and your browser, cut to 16 characters. Same person, same month, same id; next month it's new. The IP goes into the hash and nowhere else, and you can't get it back out. Every visitor count on the site uses these ids, from the visitors banner to the "Welcome, visitor #" note.

![What one visit sends](/figures/analytics/event "Load the page, then press things")

# Checking and storing

Anyone can post to `/api/event`, so the Worker is strict: the right `Origin`, under 1,000 bytes, one of the 20 names, short slugs and a value up to a million. Anything else gets a 400, which is what the "forge an event" button above does.

Valid events update the Durable Object (more in [One Durable Object as the Whole Backend](/#app=blog)). All but heartbeats and leaves are also written to Analytics Engine with `writeDataPoint`, indexed by visit id.

# Reading it back

Analytics Engine needs a secret token, so the window asks the Worker instead (`/api/analytics?days=30`, or 7, or 90). It runs three queries, events by name, device and referrer, visits per day, and visits by country, region and city, all counting like this:

```sql
SUM(_sample_interval) AS count
```

Under heavy traffic, Analytics Engine may keep only a sample, say 1 visit in 4, with each kept row marked as standing in for 4. Adding those up keeps totals right, and because sampling keeps or drops whole visits, a sampled visit keeps its entire Breakout run.

![Rows in, numbers out](/figures/analytics/summary "Try storing only 1 visit in 4")

`summarize()` turns the rows into the funnel, the average Breakout time and everything else on screen.

# How it's displayed

**Scoreboard** has the cards, visits per day and the leaderboard. **Behind the scenes** has where visits come from (sources, countries, regions and cities), the funnel, windows opened, posts read and mail form errors. "Your scores" stay in `localStorage`.

The pie charts are pixel art: a 24 × 24 grid where each pixel takes the colour of the slice its angle falls in.

![The pixel pie](/figures/analytics/pie "Point at any pixel. This is the real PixelPie component")

# Live counters that never go backwards

Say you beat Minesweeper, then open Analytics. The card should include your win, but the window's refresh can beat your event to the server.

Adding your change on top would double count once the server caught up, and dropping it early would make the card go up, down, then up. So your change is a **floor**: the card shows at least the old count plus one, and the server can only raise it. The floor goes once the server reaches it, or after 90 seconds.

![Three ways to show a counter](/figures/analytics/floors "Win, lose an event, and slow the network down")

One case took a while to catch: a request sent just before your win can return just after it, already stale. So every change gets a revision number, and a response only clears floors set before its request went out. The average win time, which can't have a floor, waits until the server has counted your wins.

It's about 90 lines in `optimistic-stats.mjs`, tested in Node, and the figure above runs that same file on a fake clock.

# Wrapping up

Anonymous analytics was easier than I expected: an id in memory, nothing sent before a press, and a strict Worker. The hard part was showing your changes instantly without numbers going backwards, and the fix was treating each change as a minimum, not something to add.