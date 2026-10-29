<!-- Fishbowl writeup; legacy filename preserves existing references. -->

# Fishbowl

*Interactive web · Fall 2026*

> A shared chat room with ASCII koi swimming behind the conversation.

**Tech:** JavaScript, Vue, Canvas 2D, Cloudflare Workers, Durable Objects, WebSockets, SQLite, Workers AI, Turnstile, Playwright

## Why I built it

A desktop feels more alive with someone else in it. Fishbowl gives visitors a place to say hi, with the familiar blues of MSN Messenger and a pond that keeps moving while the room is quiet.

## What I built

*[Figure: fishbowl]*

Open Fishbowl, pick a nickname, and join everyone else on the site. See who’s online, send a message, or start one with @Clippy to ask the site’s AI assistant a question. Click an empty patch of water to feed the koi.

The pond’s visual inspiration comes from [Dao Ho’s pond](https://www.daoho.dev/). The fish here use the same custom canvas simulation as this site’s koi wallpaper, recoloured in pale MSN blues.

## How it works

### Fish made of letters

Each koi follows a chain of points that bends into a spine. A moving wave gives its body, fins and forked tail their sway. Canvas draws the fish as a grid of shaded squares and characters, with generated markings that make each one different.

### A pond you can touch

Clicking the water scatters food pellets. Nearby koi turn toward them, speed up, and leave ripples as they eat. Moving the mouse leaves a brief trail. Fish fade beneath message text to keep it readable, and clicks on words or controls stay with the chat.

The canvas resizes with its window and changes palette with the desktop theme. Reduced-motion mode holds the fish still while keeping the pond visible.

### One shared room

A single Cloudflare Durable Object owns the lobby. WebSockets push new messages and presence updates to connected browsers, while SQLite stores messages, sessions, moderation settings and send limits.

*[Figure: lobby]*

### Sleeping between messages

The room uses hibernating WebSockets, so connections can stay open when the object leaves memory. Rate limits live in SQLite too: waking up does not give a visitor a fresh allowance.

*[Figure: sleep]*

### Keeping it friendly

Joining requires a Turnstile check. The server checks every message for length, profanity and invalid control characters, then applies slow mode, a 20-per-minute limit and a check against the sender’s last three messages. Moderation controls let me remove messages, mute or ban sessions, and close the room.

*[Figure: checks]*

### Safe to send again

A dropped connection can lose the acknowledgement after a message has already been saved. The browser retries with the same message ID, and the room returns the saved message instead of inserting another copy.

*[Figure: retry]*

## Clippy lives here too

Messages starting with @Clippy call Gemma 4 through Workers AI. His prompt includes a guide to the site, bounded recent conversation history and live site statistics. He can give directions and answer questions; he cannot operate the desktop.

The room allows one AI request at a time, caps requests at 500 per UTC day, and asks for replies of at most 200 tokens with a 20-second timeout. Token usage is recorded for Analytics.

## What I learned

The chat and the pond share a window, but need different kinds of state. The room keeps durable records so reconnects and hibernation are safe. The fish keep a local simulation that can be rebuilt whenever the canvas mounts. Making both work together also means deciding which clicks belong to the water and which belong to the conversation.
