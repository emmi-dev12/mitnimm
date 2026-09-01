<div align="center">

<img src="docs/mark.svg" width="96" height="96" alt="mitnimm" />

# mitnimm

**Gratis zum Mitnehmen — Schweiz-Karte für Haufen auf dem Trottoir.**

Du fotografierst, was auf der Strasse steht. Jemand nimmt’s mit. Der Pin stirbt in Tagen.

**DE** · [EN](README.en.md) · [FR](README.fr.md) · [IT](README.it.md) · [RM](README.rm.md)

[![Live](https://img.shields.io/badge/live-mitnimm.onrender.com-e85c1a?style=flat-square)](https://mitnimm.onrender.com)
[![Telegram](https://img.shields.io/badge/bot-@mitnimmbot-26A5E4?style=flat-square)](https://t.me/mitnimmbot)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](LICENSE)

</div>

<p align="center">
  <img src="docs/hero.png" width="380" alt="mitnimm Karte: Fotos auf den Koordinaten, Metallschild, POSTEN" />
</p>

Nicht Tutti. Nicht Facebook Marketplace. Kein Tropfen-Pin.

Haufen sind **Fotos auf den Koordinaten**, wie Kistentiketten. Orange Kabelbinder = noch da. Hazard-Streifen = der, den du gewählt hast.

## So geht’s

1. **Finden** — Karte, vierstellige PLZ oder **Kategorie-Dropdown** (ALLE / Möbel / …). Foto tippen, hinlaufen.
2. **Posten** — am Haufen: GPS + Live-Kamera, oder Album-JPEG **mit GPS in den Metadaten**. Zuschneiden (kein Haus). Kategorie, optional eine Notiz.
3. **Weg** — Teile oder den ganzen Haufen markieren. **Noch da** setzt die 72h-Uhr zurück.

Danach bleibt die History: Strasse + Kategorie + Datum. Fotos fallen weg.

## Agent-API

Kein Login. Basis: https://mitnimm.onrender.com

| | |
|---|---|
| Discovery | [`/api/agent`](https://mitnimm.onrender.com/api/agent) |
| OpenAPI | [`/api/openapi.json`](https://mitnimm.onrender.com/api/openapi.json) |
| Für Modelle | [`/llms.txt`](https://mitnimm.onrender.com/llms.txt) |

```
GET /api/categories
GET /api/spots?category=moebel&q=
GET /api/nearby?plz=8004&km=3&category=velo
GET /api/history?category=
```

`category` ist eine id (`moebel`) oder ein DE/EN/FR/IT-Label. `q` ist Freitext über Titel, Dinge, Strasse.

**POST /api/spots** ist für Menschen vor Ort (GPS + Foto). Keine automatischen Posts.

Telegram: `/start`, `/lang`, `/km`, oder eine PLZ.

## Harte Regeln

- Nur Schweiz. Keine Accounts.
- Live-Kamera vor Ort, oder Album-JPEG mit GPS (gegen Bots). Album ohne GPS fliegt raus.
- Nur der Haufen — kein Haus, keine Fassade, keine Hausnummer. Vor dem Pin zuschneiden.
- OpenStreetMap / OpenFreeMap-Attribution bleibt. geo.admin.ch nur für PLZ.
- Telegram-Bot ist öffentlich: `/start`, `/lang`, `/km`, dann PLZ.
- Agenten dürfen die JSON-API **lesen**. Sie dürfen keine Haufen auto-posten.
- Offline: nach einem Online-Besuch bleiben die zuletzt geladenen Kacheln + die letzte Haufenliste. **GEBIET** lädt die aktuelle Kartenansicht (max. ~700 Kacheln). GPS-Punkt folgt dir auch ohne Netz.
- Speicher: Haufen + Fotos liegen in **Vercel Blob** (nicht auf der Render-Disk). Bleiben nach Sleep/Redeploy.

Produktspec: [`PRODUCT.md`](PRODUCT.md). English: [`README.en.md`](README.en.md).

## Stack

| Schicht | Technik |
|---|---|
| Karte | Vite + TypeScript, MapLibre, OpenFreeMap. Kein React. |
| API | Node (Hono) + SQLite + Fotos auf Disk |
| Host | Render, ein Free-Webservice |
| Alerts | Telegram `@mitnimmbot` |

## Lokal

```bash
npm install
npm run dev
```

http://localhost:5173 proxyt `/api` auf http://127.0.0.1:8787

`.env.example` kopieren. Bot-Token liegt in `.dev.vars` (gitignored). Nie committen.

```
TELEGRAM_BOT_TOKEN=
APP_URL=http://localhost:5173
```

## Deploy

`render.yaml` ist der Blueprint. Free Instance. Build `npm ci && npm run build`, Start `npx tsx worker/src/node.ts`.

Free Render schläft nach 15 Minuten Idle — der erste Hit dauert oft eine Minute. Disk ist ephemer; Haufen sind weg, wenn die Instanz neu kommt.

Webhook:

```
https://api.telegram.org/bot<token>/setWebhook?url=https://<service>.onrender.com/api/telegram
```

## Lizenz

[MIT](LICENSE)
