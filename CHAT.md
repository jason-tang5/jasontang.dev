# MSN Messenger

One public lobby inside the portfolio desktop. Open the Messenger icon or `/#app=chat`.
Visitors choose a nickname, see the latest 50 messages, and chat over a real WebSocket.
The app includes online visitors, reconnects, preserved drafts, and owner moderation.

## Run locally

```sh
npm install
npm run dev:chat
```

Open **http://127.0.0.1:8787/#app=chat**. Use another browser or an incognito window
for a second visitor; tabs in the same browser share a session.

This command builds the Vue app and starts Wrangler with `wrangler.chat-local.jsonc`.
Its SQLite state stays on this computer. It has no remote blog, email or analytics
bindings. Re-run the build after frontend changes; Wrangler reloads backend changes.
`npm run dev` alone serves the UI, not the chat server.

The local config enables nickname sign-in without Turnstile only on loopback hosts.
It never grants owner privileges automatically. For manual moderation testing, start
Wrangler with a random development token of at least 32 letters, numbers or hyphens:

```sh
npx wrangler dev --config wrangler.chat-local.jsonc --ip 127.0.0.1 --port 8787 --var CHAT_DEV_ADMIN_TOKEN:YOUR_RANDOM_LOCAL_TOKEN
```

In a separate local browser profile, add a `chat_dev_admin` cookie for `127.0.0.1`,
path `/`, with that token using browser developer tools. Reload Messenger; the
Moderation button appears. This shortcut is rejected on production hostnames.
The browser test handles its own isolated local owner session automatically.

## Production setup

The production binding and the new `v2-chat-room` migration are in `wrangler.jsonc`.
The existing `LIVE_STATS` binding and migration are preserved. Chat has its own
`ChatRoom` object named `lobby` and its own SQLite database.

1. The existing Turnstile widget's public site key `0x4AAAAAAFi-ujUTULWwwy_V`
   is configured as `TURNSTILE_SITE_KEY` in `wrangler.jsonc`. Do not create a
   replacement widget. `TURNSTILE_HOSTNAMES` is restricted to `jasontang.dev`.
2. Recover and store its private key in the existing `jasontang-dev` Worker's
   `TURNSTILE_SECRET` binding using Cloudflare's
   [existing-widget flow](https://developers.cloudflare.com/turnstile/spin/prompt.md).
   That flow requires explicit approval of an external canonical Wrangler
   executable and the exact destination before secret retrieval or writes.
   Use the approved executable directly, never project package resolution for
   secret-bearing commands. Keep the secret in memory and pipe it to the secret
   store; never put it in chat, command arguments, source files or client variables.
   The widget sends action `chat-join`; the Worker requires literal `success: true`,
   that action, and the approved production hostname before creating a session.
3. Confirm the existing Cloudflare Access application protects
   `jasontang.dev/api/admin/*`, including `/api/admin/chat/*`, and allows only the
   owner's identity. The existing `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` and
   `ADMIN_EMAIL` settings are reused. The Worker independently verifies every
   admin request. Click **Owner sign in** to authenticate and return to Messenger.
4. Run the checks below, then deploy the production config with `npm run deploy`.
   Never deploy `wrangler.chat-local.jsonc`.
5. In two independent browsers, confirm public joins and delivery. Sign in as the
   owner and check moderation. Owner-authenticated joins use `Jason` with an owner
   badge. The Moderation button works even before joining the public room.

Without both Turnstile keys, production shows an unavailable screen and rejects
joins and sockets. It does not silently bypass verification. The room defaults to
enabled once configured; use **Disable chat** in Moderation to close it immediately.
`CHAT_ORIGIN` can override `https://jasontang.dev` for an explicitly configured
staging host; that host needs its own valid Turnstile and Access configuration.
Set `TURNSTILE_HOSTNAMES` to that staging hostname as well; production configuration
must not contain loopback hosts. Local isolated tests continue using `CHAT_LOCAL`.

After storing the secret and deploying the integration, validate a fresh real
Turnstile token through `POST /api/chat/join`, then confirm replay is rejected.
Unit tests simulate these responses but do not replace that live validation.

## Checks

```sh
npm test
npm run build
npm run test:chat:browser
```

The browser test starts and stops its own Wrangler process on a free local port,
with a fresh SQLite directory and development owner token. It covers two real
visitors, session persistence, reconnects, literal HTML rendering, rate limits,
deletion, mute, ban, the kill switch, authentication, origin checks and mobile
layout. Screenshots go to `tmp/chat-qa/`. No production credentials are needed.

The unit tests also recreate the room to verify limits survive hibernation, test
Turnstile validation, session expiry, retention, oversized frames and retry IDs.

## Files and routes

| File | Purpose |
| --- | --- |
| `src/components/Chat.vue` | MSN-style join, conversation, people and moderation UI |
| `src/registry.js`, `src/components/RetroIcon.vue` | Desktop app and Messenger icon |
| `worker/chat.mjs` | Public routing, cookies, Turnstile and owner authentication |
| `worker/chat-room.mjs` | Hibernating WebSockets, SQLite, limits and moderation |
| `worker/chat-rules.mjs` | Shared server validation and response helpers |

Public endpoints: `GET /api/chat/session`, `POST /api/chat/join`,
`GET /api/chat/socket` (WebSocket upgrade), `POST /api/chat/leave`.
Messages travel over the socket, not a separate HTTP send route.

Owner endpoints under `/api/admin/chat/`: `GET login`, `GET overview`,
`POST settings`, `POST delete`, `POST moderate`. Chat routing runs before the
existing blog admin router, so blog administration continues to use its own paths.

## Limits and retention

- Nicknames: 3–20 ASCII letters, numbers, `_` or `-`; blank generates a guest name.
  Names are reserved while connected and for 60 seconds after joining. `Jason`
  requires verified owner identity; other administration names are reserved.
- Messages: 250 Unicode characters, plain text, no clickable links or uploads.
  Messages and nicknames go through the Snake leaderboard's profanity filter.
  Vue text interpolation renders HTML literally.
- Clippy: 3 seconds between AI requests across the room, one answer in flight,
  and 500 attempts per UTC day. Each reply generates at most 100 tokens. This is
  a request cap, not a guaranteed neuron budget; account-wide AI usage also counts.
  The Workers AI binding runs `@cf/meta/llama-3.2-3b-instruct`. The previous
  Llama 3.1 8B identifier returns deprecation error 5028 through the binding.
- At least 3 seconds between messages (owner-adjustable up to 60), at most 20 per
  rolling minute per session, across all tabs. Rate timestamps live in SQLite.
- Last-three-message duplicate suppression; retry IDs acknowledge an already
  stored message without broadcasting or inserting it again.
- 10 successful joins per IP hash per 10 minutes (failed attempts and the owner are
  not counted); daily salted hashes, no stored raw
  IP addresses. 200 sockets per room, 4 per session, 5,000 retained sessions.
- Client frames are limited to 4 KiB, allowing 250-character Unicode messages plus
  JSON overhead. Floods above 30 frames per 10 seconds per socket are disconnected.
- Random 32-byte session cookies: HttpOnly, Secure in production, SameSite=Strict,
  30-day fixed expiry; only token hashes are stored. Expired sessions must rejoin.
- Recent-history load: 50 messages. In-memory transcript: at most 200 entries.
  A daily alarm deletes messages older than 30 days and expired sessions.
- Deleted content is hidden from public history and removed live from connected
  clients. Owners can still see the original until retention cleanup.
- Bans apply to sessions. Clearing cookies can evade a ban; Turnstile and join
  limits provide additional friction. This is not an account identity system.

The older design notes are in the ignored `docs/live-chat-backend.md` and
`docs/decisions.md`. This tracked guide reflects the implementation. Unlike the
old proposal, rate limits persist across hibernation, chat admin routes have their
own prefix, and local development cannot accidentally connect to live KV.
