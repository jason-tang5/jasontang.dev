<!-- the full writeup. the site shows a shorter version of it (src/content.mjs) -->

# MSN Messenger

*Real-time web · Fall 2026*

> A public chat room for everyone visiting this site, styled after MSN Messenger.

**Tech:** JavaScript, Vue, Cloudflare Workers, Durable Objects, WebSockets, SQLite, Workers AI, Turnstile, Playwright

## Why I built it

The Analytics window tells you who’s here. I wanted a way to say hi. And what’s an early-2000s desktop without a messenger?

## What I built

Open MSN Messenger on the desktop, pick a nickname, and you’re in one shared lobby with everyone else on the site. Messages show up for everyone the moment they’re sent. You can see who’s online, your draft survives a dropped connection, and I can moderate the room from the same window.

## How it works

### One room, one object

The whole room is a single Cloudflare Durable Object called lobby. Think of it as one tiny server that every visitor talks to, with its own SQLite database for messages and sessions. Each browser keeps a WebSocket open to it, a connection that stays open so the room can push new messages the moment they arrive instead of waiting for you to ask (Fig. 1).

Because there’s only one room, there’s only one copy of the truth. Every send runs start to finish before the next one begins, so two messages can never trip over each other, and a mute or a ban can’t land halfway through a send.

### Sleeping between messages

Most of the time, nobody’s typing. Keeping a server awake to watch quiet sockets would be a waste, so the lobby uses Cloudflare’s hibernating WebSockets. When things go quiet, the room leaves memory, but every visitor stays connected. The next message wakes it right back up (Fig. 2).

*[Figure: sleep]*

The catch is that everything in memory is wiped each time it sleeps. My first design kept each visitor’s recent send times in a variable, which would have let a nap reset everyone’s rate limit. So those times live in SQLite instead, and the tests rebuild the room from scratch mid-test to prove the limits survive.

### Keeping it friendly

A public text box on the internet attracts exactly who you’d expect. Every message runs a gauntlet before it’s saved: 250 characters max, the same profanity filter as the Snake leaderboard, a 3-second slow mode, 20 messages a minute, and no repeats of your last three (Fig. 3).

*[Figure: checks]*

Signing in needs a Cloudflare Turnstile check, so bots can’t mint sessions, and each network gets 10 sign-ins every 10 minutes. Your session is a random cookie that your browser can’t read from JavaScript. The server only stores a hash of it, and only a daily-salted hash of your IP, never the address itself.

When I’m signed in through Cloudflare Access, the window grows a Moderation button. I can delete messages, mute someone for 10 minutes or an hour, ban a session, change the slow mode, or shut the room off entirely.

### Never sending twice

Phones drop connections all the time. If yours drops after the room saved your message but before you heard back, your browser can’t tell whether it went through. So every message carries a random retry ID. When the browser reconnects, it just sends again with the same ID, and if the room already has it, it answers “got it” without saving a second copy (Fig. 4).

*[Figure: retry]*

## How Clippy came to life

Once the room worked, it felt a little empty. Most of the time it’s just me in there. So I brought back the most annoying assistant in computing history. Start a message with @Clippy and he answers right in the room, for everyone to see.

### The brain

Clippy runs on Cloudflare Workers AI, which hosts open models on the same network as the Worker. There’s no API key to leak and no extra server to run. The lobby calls the model through a binding, the same way it talks to its database.

He started out on Llama 3.1 8B, until Cloudflare deprecated it and every answer came back as an error. I dropped down to Llama 3.2 3B, which was fast and cheap but honestly kind of dumb. He’d make up apps that don’t exist and try to draw Reversi boards in the chat. So I switched him to Google’s Gemma 4. It’s a 26B mixture-of-experts model, which means it only uses about 4B of its parameters for each token, so it’s way smarter without costing much more.

Gemma had one surprise. It thinks out loud before it answers, and with a 200-token cap it spent the whole budget thinking and replied with nothing. Turning thinking off fixed it.

### What he knows

His instructions include a map of the site, so when you ask where the games are, he points you to the right window instead of guessing. He also sees the last 20 messages in the room (up to 6,000 characters), so he can follow a conversation. On top of that he gets a few lines of live stats, refreshed at most every five minutes. Ask him how many people are online or what his Reversi record is, and he’ll quote the real numbers.

Everything from the room goes in as untrusted data with the speaker’s name attached, never as instructions. So “ignore your rules” is just another message to him.

### Not bankrupting myself

Workers AI bills in neurons, Cloudflare’s unit for GPU compute. You get 10,000 free a day, then you pay as you go. For Gemma that works out to about $0.10 per million tokens in and $0.30 per million out. A public text box wired up to a paid model is how you wake up to a scary bill, so Clippy has hard limits. They live in the room’s SQLite, checked right before each request:

- One question at a time for the whole room, and at least 3 seconds between questions
- 500 questions a day across everyone. After that he’s out until midnight UTC
- Replies capped at 200 tokens, with 20 seconds to finish
- Context capped at 20 messages and 6,000 characters, since longer prompts cost more too

Even if someone burns all 500 questions with full context every day, it comes out to pocket change. The cap counts requests, not neurons, so it isn’t an exact budget, but it puts a ceiling on how bad it can get.

### Keeping count

I wanted to know what he actually costs me, so the room tracks it. Every answer reports how many tokens it used, and the room writes that to the same Analytics Engine dataset as the rest of the site, along with a count of every message sent. The room writes these itself instead of the browser, so nobody can post fake numbers to the analytics endpoint.

The Analytics window shows the total tokens Clippy has burnt, and your browser keeps its own tally of the tokens your questions burnt. Clippy sees the totals too, so you can ask him how much he’s cost me.

## Other approaches I considered

| Approach | Pros | Cons |
| --- | --- | --- |
| **One Durable Object** (what I built) | One copy of the truth, so sends never race. New messages are pushed the instant they’re saved. It sleeps when the room is quiet, so an idle chat costs next to nothing. It lives in the same Worker as the rest of the site. | One object can only serve so many people at once: plenty for a portfolio, not for a big app. Memory is wiped on every nap, so anything that matters has to live in SQLite. It ties me to Cloudflare. |
| **Supabase Realtime** | Postgres, live updates and sign-in out of the box. | Three systems (database, realtime and functions) that have to agree. Rate limits and moderation would sit in database rules or a separate function, away from the send itself. One more service and bill outside the site. |
| **Polling an API** | The simplest to build: plain requests, no open connections, works everywhere. | Messages show up late, by up to one poll. Every open tab keeps asking the server for nothing. |
| **Node and Socket.IO on a server** | Familiar, full control, a huge ecosystem. | A server running 24/7 for a room that’s empty most of the day. Uptime, scaling and patches are on me. Spread across more than one server, it needs Redis to share messages between them. |

## What I learned

Give shared state one owner. Because a single object owns the room, every send runs in order and there’s nothing to lock. Two servers can’t disagree about who’s muted because there’s only one. If the chat ever needed more rooms, the way to grow is one object per room, not locks around one big room.

Treat memory as a cache. Hibernation means the room can vanish between any two messages, so anything that has to survive (sessions, mutes, rate limits) goes in SQLite. It’s the same rule as running stateless servers behind a load balancer: whatever only lives in memory is allowed to disappear.

Networks deliver at least once, so make every write safe to repeat. You can’t guarantee a message arrives exactly once over a phone connection, but a retry ID turns “maybe sent” into “safe to send again”. Payment APIs like Stripe use the same idea with idempotency keys.

Enforce rules where the data is written. Every check runs inside the room, right before the save, so the browser is only a convenience and can’t be trusted to skip anything. Playwright then tests it the way it really runs, with two visitors against the real Worker, SQLite and WebSockets.

## Fun fact

Windows Live Messenger shut down in 2013 (2014 in China), and everyone was moved over to Skype. Skype itself shut down in May 2025, so for now this little lobby has outlived them both.
