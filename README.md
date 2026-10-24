# jasontang.dev

my portfolio, dressed up as a windows 95 desktop. vue 3 + vite, running on cloudflare workers.

```sh
npm install
npm run dev     # local dev server
npm test        # unit tests
npm run build   # builds into dist/
```

pushing to `main` deploys it. most of the text lives in `src/content.mjs`.

MSN Messenger adds a public visitor chat room. Run `npm run dev:chat` for the local
chat server; see [CHAT.md](CHAT.md) for production setup, moderation and tests.

## credits

- window chrome and palette adapted from don chia's [vuejs-os-template](https://github.com/DonChiaQE/vuejs-os-template) (mit, `licenses/vuejs-os-template-MIT.txt`)
- some win98 control styling borrowed from [98.css](https://github.com/jdan/98.css) (mit, `licenses/98css-MIT.txt`)
- windows 95/98 cursors by darix555, public domain (`licenses/win98-cursors-public-domain.txt`)
- the wallpaper is a vaporwave sunset gif from tenor, rendered as ascii with [react-video-ascii](https://www.npmjs.com/package/react-video-ascii). source link in `assets/wallpaper-source.txt`

## inspiration

- [sharyap.com](https://sharyap.com)
- don chia's [win95](https://github.com/DonChiaQE/win95)
- [lucasjin.ca](https://lucasjin.ca), thank you for video-to-ascii
- [expensive.toys](https://expensive.toys/)


### Clippy in Messenger

Clippy lives in the existing public lobby. Start a message with `@Clippy` (or use
**Ask Clippy**) to ask him a question. Questions and answers are public, use the
normal 30-day chat retention, and answers can be deleted in moderation. Only the
addressed question is sent to AI; Clippy does not receive the whole room history
or remember previous questions. His art is the same `ClippyArt.vue` used in Reversi.

Production `wrangler.jsonc` includes a Workers AI binding named `AI`; deploy through
the existing authenticated Cloudflare account. No separate AI API key is required.
The model is `@cf/meta/llama-3.1-8b-instruct`. The room limits AI to one request at a
time, 15 seconds between requests, 50 attempts per UTC day, 100 output tokens per
request, and a 20-second response deadline. The request allowance persists across
hibernation. This cap bounds requests, not Cloudflare billing: review Workers AI
usage and the account plan before deploying. Provider failures show a friendly
unavailable reply, never a fabricated model answer.

`npm run dev:chat` deliberately has no remote AI binding, so Clippy appears away
and ordinary public chat remains usable without cloud inference charges. Unit
tests inject a fake AI binding to verify replies, moderation during inference,
quota handling, and duplicate suppression; browser tests verify the UI states.
