# mitnimm

Switzerland-only map of sidewalk giveaways (gratis mitnehmen).

Site is meant to run as one Node service on Render: Vite static files + `/api`.

## Local

```
npm install
npm run dev
```

Web: http://localhost:5173 — API: http://127.0.0.1:8787

GPS on-site + live camera to post. No house / façade / house number in the photo.

## Render

1. New Web Service from this repo (or Blueprint `render.yaml`).
2. Free plan. Build `npm ci && npm run build`. Start `npx tsx worker/src/node.ts`.
3. Env: `TELEGRAM_BOT_TOKEN` (from BotFather). `APP_URL` = the `*.onrender.com` URL.
4. Telegram webhook: `https://api.telegram.org/bot<token>/setWebhook?url=https://<service>.onrender.com/api/telegram`

Free Render sleeps after 15 minutes idle. First request can take ~1 minute. Piles on the free disk vanish if the instance is replaced.

## Product rules

- CH bounding box only, no accounts
- OpenStreetMap / OpenFreeMap attribution stays on
- geo.admin.ch is PLZ search only
- Telegram bot @mitnimmbot is public (`/start` + PLZ)
