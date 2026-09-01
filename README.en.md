<div align="center">

<img src="docs/mark.svg" width="96" height="96" alt="mitnimm" />

# mitnimm

**Gratis zum Mitnehmen — a Switzerland-only map of sidewalk piles.**

You photograph what’s on the street. Someone walking by takes it. The pin dies in days.

[**DE**](README.md) · **EN** · [FR](README.fr.md) · [IT](README.it.md) · [RM](README.rm.md)

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

1. **Find** — map, 4-digit PLZ, or the **category dropdown** (ALLE / Möbel / …). Tap a photo, walk over.
2. **Post** — at the pile: GPS + live camera, or album JPEG **with GPS in the file**. Crop the pile (no house). Category, optional note.
3. **Gone** — mark items or the whole pile. **Still there** resets the 72h clock.

After it’s gone, history keeps street + category + date. Photos drop.

## Agent API

No auth. Base: https://mitnimm.onrender.com

| | |
|---|---|
| Discovery | [`/api/agent`](https://mitnimm.onrender.com/api/agent) |
| OpenAPI | [`/api/openapi.json`](https://mitnimm.onrender.com/api/openapi.json) |
| For models | [`/llms.txt`](https://mitnimm.onrender.com/llms.txt) |

```
GET /api/categories
GET /api/spots?category=moebel&q=
GET /api/nearby?plz=8004&km=3&category=velo
GET /api/history?category=
```

`category` is an id (`moebel`) or a DE/EN/FR/IT label. `q` is free text on quote, items, street.

**POST /api/spots** is for humans on site (GPS + photo). Do not automate posts.

Telegram: `/start`, `/lang`, `/km`, or a PLZ.

## Hard rules

- Switzerland bounding box. No accounts.
- Live camera on site, or album JPEG with GPS metadata (anti-bot). Camera roll without GPS is rejected.
- Pile only — no house, no façade, no house number. Crop before pin.
- OpenStreetMap / OpenFreeMap attribution stays on. geo.admin.ch is PLZ search only.
- Telegram bot is public: `/start`, `/lang`, `/km`, then a PLZ.
- Agents may **read** the JSON API. They may not auto-post piles.
- Offline: after one online visit, last viewed map tiles + last pile list stay. Satellite only where you already opened it.
- Storage: piles + photos live in **Vercel Blob** (not Render’s disk). They survive sleep/redeploy.

Product spec: [`PRODUCT.md`](PRODUCT.md). German (default): [`README.md`](README.md).

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
