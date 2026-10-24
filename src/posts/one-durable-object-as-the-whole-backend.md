This site is almost all static files. The only things that change are a few counters: visits, who's online, Minesweeper wins, Clippy's Reversi record, and Snake leaderboards over five time ranges. All of it lives in one Durable Object with a SQLite database inside, in about 60 lines of code.

# What a Durable Object is

A Durable Object is a small program Cloudflare keeps running for you, with its own storage. Every request for a given name goes to the same copy. Mine is called `site`:

```js
env.LIVE_STATS.get(env.LIVE_STATS.idFromName('site'))
```

It handles one request at a time, and its database calls are synchronous, so nothing can sneak in halfway through. That's why the figure at the top can't lose a count, even when two wins arrive at once.

A normal database can add one safely too. What I like is everything around it: saving a Snake score updates the player's best and today's best, prunes old days, trims the all-time table, clears stale sessions and builds the response, all in order, with no transaction spread across services.

The Worker sends valid events to it from `/api/event` and reads numbers from `/api/stats`. Setup is one binding and one migration:

```json
"durable_objects": { "bindings": [{ "name": "LIVE_STATS", "class_name": "LiveStats" }] },
"migrations": [{ "tag": "v1-live-stats", "new_sqlite_classes": ["LiveStats"] }]
```

# Four tables

| table | columns | holds |
|---|---|---|
| totals | name, value | all-time counters |
| sessions | id, seen | visits heard from recently |
| scores | id, score, name | each Snake player's best ever |
| daily_scores | id, day, score, name | each player's best per day |

Almost every write is an upsert, like the visitor counter:

```sql
INSERT INTO totals VALUES ('visitors', 1)
ON CONFLICT(name) DO UPDATE SET value=value+1
```

Best scores use `MAX(score, excluded.score)`, so a worse run never overwrites a better one. To add leaderboard names, the object runs `ALTER TABLE scores ADD COLUMN name TEXT` on every start and ignores the error once the column exists. It's the cheapest migration there is.

![The four tables taking requests](/figures/backend/tables "Send some requests and watch the SQL")

# Who's online

"Online now" is the row count of `sessions`. Visits add rows, heartbeats refresh them, and leaves delete them. Leaves don't always arrive, so every request first removes anyone quiet for 90 seconds:

```sql
DELETE FROM sessions WHERE seen < ?
```

No cron job needed, since the cleanup always runs before the count.

![Who counts as online](/figures/backend/online "Drag the clock, or press Play")

# Leaderboards over any window

Rather than a table per time range, `daily_scores` keeps each player's best per day, and every board is one query with a different start day:

```sql
SELECT id, MAX(score) AS score, name FROM daily_scores
WHERE day > ? GROUP BY id ORDER BY score DESC, id LIMIT 10
```

Nothing moves a score off a board; the window just slides past it. Days older than 366 are pruned on every save, and the all-time board reads `scores`, which keeps the top 100.

![Windows sliding over a year of scores](/figures/backend/boards "Move today and watch the boards change")

Names are checked in the browser and again with [obscenity](https://www.npmjs.com/package/obscenity), which catches swaps like `sh1t`. A blocked name is shown as `Player` plus part of the player's id.

# What it costs

My original plan was Supabase: Postgres, live updates and a separate function for checking data, three systems that have to agree. A Durable Object is a coordinator with a database attached, which is simpler for one small set of counters.

![Supabase or one Durable Object](/figures/backend/choice)

The downsides: it runs in one location, so faraway visitors wait a bit longer, one object can only take so much traffic, leaving Cloudflare means a rewrite, and with no SQL console, every new question needs its own endpoint. It fits in the free plan with lots of room to spare.

# Wrapping up

The whole thing is one class, four tables and about a dozen SQL statements. Because requests run one at a time next to the data, "clean up, then count" and "save, prune, rank" are just lines of code in order.