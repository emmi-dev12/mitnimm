<div align="center">

<img src="docs/mark.svg" width="96" height="96" alt="mitnimm" />

# mitnimm

**Gratis zum Mitnehmen — carte suisse des tas sur le trottoir.**

Tu photographies ce qui est dans la rue. Quelqu’un le prend. L’épingle meurt en quelques jours.

[DE](README.md) · [EN](README.en.md) · **FR** · [IT](README.it.md) · [RM](README.rm.md)

[![Live](https://img.shields.io/badge/live-mitnimm.onrender.com-e85c1a?style=flat-square)](https://mitnimm.onrender.com)
[![Telegram](https://img.shields.io/badge/bot-@mitnimmbot-26A5E4?style=flat-square)](https://t.me/mitnimmbot)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](LICENSE)

</div>

<p align="center">
  <img src="docs/hero.png" width="380" alt="carte mitnimm : photos sur les coordonnées, plaque métal, POSTEN" />
</p>

Pas Tutti. Pas Facebook Marketplace. Pas une goutte sur la carte.

Les tas sont des **photos sur les coordonnées**, comme des étiquettes de caisse. Collier orange = encore là. Bande hazard = celui que tu as choisi.

## Comment ça marche

1. **Trouver** — carte, NPA à 4 chiffres, ou **menu catégorie** (TOUT / Meubles / …). Tape la photo, vas-y.
2. **Poster** — au tas : GPS + caméra live, ou JPEG de l’album **avec GPS dans les métadonnées**. Recadrer (pas de maison). Catégorie, note optionnelle.
3. **Parti** — marque des objets ou tout le tas. **Encore là** remet le compteur 72h.

Ensuite l’historique garde rue + catégorie + date. Les photos tombent.

## API agent

Pas d’auth. Base : https://mitnimm.onrender.com

| | |
|---|---|
| Discovery | [`/api/agent`](https://mitnimm.onrender.com/api/agent) |
| OpenAPI | [`/api/openapi.json`](https://mitnimm.onrender.com/api/openapi.json) |
| Pour les modèles | [`/llms.txt`](https://mitnimm.onrender.com/llms.txt) |

```
GET /api/categories
GET /api/spots?category=moebel&q=
GET /api/nearby?plz=8004&km=3&category=velo
GET /api/history?category=
```

`category` est un id (`moebel`) ou un libellé DE/EN/FR/IT. `q` est du texte libre sur titre, objets, rue.

**POST /api/spots** est pour des humains sur place (GPS + photo). Pas de posts automatiques.

Telegram : `/start`, `/lang`, `/km`, ou un NPA.

## Règles dures

- Suisse seulement. Pas de comptes.
- Caméra live sur place, ou JPEG album avec GPS (anti-bot). Album sans GPS refusé.
- Le tas seulement — pas de maison, pas de façade, pas de numéro. Recadrer avant l’épingle.
- Attribution OpenStreetMap / OpenFreeMap. geo.admin.ch uniquement pour le NPA.
- Bot Telegram public : `/start`, `/lang`, `/km`, puis NPA.
- Les agents peuvent **lire** l’API JSON. Ils ne doivent pas poster des tas tout seuls.

Spec produit : [`PRODUCT.md`](PRODUCT.md). Défaut (allemand) : [`README.md`](README.md).

## Stack

| Couche | Tech |
|---|---|
| Carte | Vite + TypeScript, MapLibre, OpenFreeMap. Pas de React. |
| API | Node (Hono) + SQLite + photos sur disque |
| Host | Render, un service web gratuit |
| Alertes | Telegram `@mitnimmbot` |

## En local

```bash
npm install
npm run dev
```

http://localhost:5173 proxy `/api` vers http://127.0.0.1:8787

Copier `.env.example`. Le token du bot est dans `.dev.vars` (gitignored). Ne jamais le committer.

```
TELEGRAM_BOT_TOKEN=
APP_URL=http://localhost:5173
```

## Deploy

`render.yaml` est le Blueprint. Instance free. Build `npm ci && npm run build`, start `npx tsx worker/src/node.ts`.

Le free Render dort après 15 minutes d’inactivité — le premier hit peut prendre une minute. Le disque est éphémère ; les tas disparaissent si l’instance est recréée.

Webhook :

```
https://api.telegram.org/bot<token>/setWebhook?url=https://<service>.onrender.com/api/telegram
```

## Licence

[MIT](LICENSE)
