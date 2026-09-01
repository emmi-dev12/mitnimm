<div align="center">

<img src="docs/mark.svg" width="96" height="96" alt="mitnimm" />

# mitnimm

**Gratis zum Mitnehmen — carta svizra dals mucs sin il trottoir.**

Ti fotografeschas quai ch’è sin la via. Insatgi al prenda cun sai. Il pin mora en paucs dis.

[DE](README.md) · [EN](README.en.md) · [FR](README.fr.md) · [IT](README.it.md) · **RM**

[![Live](https://img.shields.io/badge/live-mitnimm.onrender.com-e85c1a?style=flat-square)](https://mitnimm.onrender.com)
[![Telegram](https://img.shields.io/badge/bot-@mitnimmbot-26A5E4?style=flat-square)](https://t.me/mitnimmbot)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](LICENSE)

</div>

<p align="center">
  <img src="docs/hero.png" width="380" alt="carta mitnimm: fotos sin las coordinatas, plattina da metal, POSTEN" />
</p>

Betg Tutti. Betg Facebook Marketplace. Betg ina goccia sin la carta.

Ils mucs èn **fotos sin las coordinatas**, sco etichetta d’ina cassa. Fascetta oranscha = anc qua. Strivla hazard = quel che ti has tschernì.

## Co che quai va

1. **Chattar** — carta, NPA da 4 cifras, u **menu da categoria** (TUTTAS / Mobiglias / …). Tucca la foto, va nà.
2. **Postar** — tar il muc: GPS + camera live, u JPEG da l’album **cun GPS en las metadatas**. Tagliar (nagina chasa). Categoria, nota opziunala.
3. **Iva** — marca parts u l’entir muc. **Anc qua** metta enavos l’ura da 72h.

Suenter resta la cronologia: via + categoria + data. Las fotos crodan davent.

## API d’agent

Nagina auth. Basa: https://mitnimm.onrender.com

| | |
|---|---|
| Discovery | [`/api/agent`](https://mitnimm.onrender.com/api/agent) |
| OpenAPI | [`/api/openapi.json`](https://mitnimm.onrender.com/api/openapi.json) |
| Per models | [`/llms.txt`](https://mitnimm.onrender.com/llms.txt) |

```
GET /api/categories
GET /api/spots?category=moebel&q=
GET /api/nearby?plz=8004&km=3&category=velo
GET /api/history?category=
```

`category` è in id (`moebel`) u in label DE/EN/FR/IT. `q` è text liber sin titel, chaussas, via.

**POST /api/spots** è per umans sin plaz (GPS + foto). Nagins posts automatics.

Telegram: `/start`, `/lang`, `/km`, u in NPA.

## Reglas duras

- Mo Svizra. Nagins accounts.
- Camera live sin plaz, u JPEG d’album cun GPS (cunter bots). Album senza GPS vegn refusà.
- Mo il muc — nagina chasa, nagina fatschada, nagin numer da chasa. Tagliar avant il pin.
- Attribuziun OpenStreetMap / OpenFreeMap. geo.admin.ch mo per l’NPA.
- Bot Telegram public: `/start`, `/lang`, `/km`, lura NPA.
- Agents dastgan **leger** l’API JSON. Els na dastgan betg postar mucs sezs.

Spec dal product: [`PRODUCT.md`](PRODUCT.md). Standard (tudestg): [`README.md`](README.md).

## Stack

| Strat | Tech |
|---|---|
| Carta | Vite + TypeScript, MapLibre, OpenFreeMap. Nagin React. |
| API | Node (Hono) + SQLite + fotos sin disc |
| Host | Render, in web service gratuit |
| Alarms | Telegram `@mitnimmbot` |

## Local

```bash
npm install
npm run dev
```

http://localhost:5173 fa proxy da `/api` vers http://127.0.0.1:8787

Copiar `.env.example`. Il token dal bot è en `.dev.vars` (gitignored). Mai committer.

```
TELEGRAM_BOT_TOKEN=
APP_URL=http://localhost:5173
```

## Deploy

`render.yaml` è il Blueprint. Instanza gratuita. Build `npm ci && npm run build`, start `npx tsx worker/src/node.ts`.

Il Render gratuit durmenta suenter 15 minutas senza traffic — l’emprim hit po durar ina minuta. Il disc è efemer; ils mucs èn davent sche l’instanza vegn recreada.

Webhook:

```
https://api.telegram.org/bot<token>/setWebhook?url=https://<service>.onrender.com/api/telegram
```

## Licenza

[MIT](LICENSE)
