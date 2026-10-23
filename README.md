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
