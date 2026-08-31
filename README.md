<div align="center">

<img src="docs/mark.svg" width="96" height="96" alt="mitnimm" />

# mitnimm

**Gratis zum Mitnehmen — a Switzerland-only map of sidewalk piles.**

You photograph what’s on the street. Someone walking by takes it. The pin dies in days.

[![Live](https://img.shields.io/badge/live-mitnimm.onrender.com-e85c1a?style=flat-square)](https://mitnimm.onrender.com)
[![Telegram](https://img.shields.io/badge/bot-@mitnimmbot-26A5E4?style=flat-square)](https://t.me/mitnimmbot)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](LICENSE)

</div>

<p align="center">
  <img src="docs/hero.png" width="380" alt="mitnimm map: listing photos zip-tied onto coordinates, metal plate, POSTEN tab" />
</p>

Not Tutti. Not Facebook Marketplace. Not a teardrop pin.

Piles show as **photos sitting on the coordinates**, dressed like crate labels. Orange zip-tie = still there. Hazard stripe = the one you picked.

## How it works

1. **Find** — map or a 4-digit PLZ. Tap a photo, walk over.
2. **Post** — you are at the pile. GPS + **live camera only**. Category, optional note, done.
3. **Gone** — mark items or the whole pile. **Still there** resets the 72h clock.

After it’s gone, history keeps street + categories + dates. Photos drop.

## Hard rules

- Switzerland bounding box. No accounts.
- Live camera, on site. Camera roll is rejected.
- Pile only — no house, no façade, no house number.
- OpenStreetMap / OpenFreeMap attribution stays on. geo.admin.ch is PLZ search only.
- Telegram bot is public: `/start`, then a PLZ.

Product spec: [`PRODUCT.md`](PRODUCT.md).

## Stack

| Layer | Tech |
|---|---|
| Map UI | Vite + TypeScript, MapLibre, OpenFreeMap. No React. |
| API | Node (Hono) + SQLite + disk photos |
| Host | Render, one free web service |
| Alerts | Telegram `@mitnimmbot` |

## Run it

```bash
npm install
npm run dev
```

http://localhost:5173 proxies `/api` to http://127.0.0.1:8787

Copy `.env.example`. Bot token lives in `.dev.vars` (gitignored). Never commit it.

```
TELEGRAM_BOT_TOKEN=
APP_URL=http://localhost:5173
```

## Deploy

`render.yaml` is the Blueprint. Free instance. Build `npm ci && npm run build`, start `npx tsx worker/src/node.ts`.

Free Render sleeps after 15 minutes idle — first hit can take about a minute. Disk is ephemeral; piles vanish if the instance is replaced.

Webhook:

```
https://api.telegram.org/bot<token>/setWebhook?url=https://<service>.onrender.com/api/telegram
```

## License

[MIT](LICENSE)
