# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + TypeScript, no React. Map-first PWA, deployable on Vercel. Chosen over React/SvelteKit for a small client, Organic Maps–like chrome, and a cheap static+API split.

## Users

Two jobs, treated as equal in v1:

- **Finder** — in Switzerland, out walking or cycling, wants to see what free piles are near them *right now*, tap a pin, know what’s there, go get it.
- **Poster** — standing at a pile (sidewalk / street), needs to get it on the map in under a minute: live camera, category, optional note.

No accounts. Anyone can browse and post. Poster and finder are often the same person on different days.

Not a marketplace seller, not a charity, not a municipal bulky-waste service.

## Product Purpose

**mitnimm** is a Switzerland-only map of free stuff left out on the street (“gratis zum Mitnehmen”). People photograph a pile where it sits, the map holds an inventory, others pick it up, then someone marks items or the whole pile gone. Past piles stay as history (street + categories + dates, no photos).

Success: a pile that would have sat or gone to the dump gets taken, and the map is trusted enough that people actually walk over.

## Positioning

Not Tutti/Ricardo/Facebook Marketplace (those are ads with prices and accounts). Not a generic OSM pin drop.

Mechanism neighbors cannot copy without becoming this:

- You must be **on site** to create (GPS + **live camera only**, no camera roll).
- Pin is a **spot with item inventory**, not a classified ad.
- **One “gone”** hides the pile (or check off remaining items); **“still there”** resets a 48–72h auto-expire.
- Street/sidewalk snap, **no house numbers**; crop/redact so façades aren’t the photo.
- No login; anti-abuse is presence + live photo + Turnstile-class bot wall, not identity.

## Operating Context

Swiss sidewalk giveaway culture. Phone in hand, outdoors, often one-handed, variable signal. PWA: camera + geolocation + installable. OpenStreetMap for map/geocoding (not osm.org public tiles for production traffic). Telegram: public bot (`/start`, PLZ, `/lang`, `/km`). GitHub (emmi-dev12), FOSS, $0 infra (Vercel). Languages v1: DE + EN + FR + IT. Agents consume the public JSON API; they do not post.

## Capabilities and Constraints

Confirmed v1:

- PWA, CH only, EN + DE + FR + IT.
- No accounts; browse open; post without login.
- Create: on-site GPS (~50–100m) + live camera **or** album JPEG with GPS in EXIF; 1 photo required; crop so the pile is the frame.
- After photo: top-level category + optional subcategory + optional short description (low friction). Categories as rich as Ricardo/Tutti goods (not services/jobs/real estate).
- **Find:** PLZ search + **category dropdown** (ALLE or one goods category).
- Map unit: spot + inventory inside.
- Remote “gone” allowed; partial checkoff of inventory items.
- “Still there” resets 48–72h expiry.
- History after gone/expiry: street + categories + dates; drop photos.
- Do not auto-merge nearby duplicate pins.
- No in-app comments; structured actions only.
- No report/moderation queue in v1.
- Telegram v1: bot `/start` `/lang` `/km` + PLZ nearby links. Optional channel via `TELEGRAM_CHAT_ID`.
- **Agent API (read-only):** `/api/agent`, `/api/openapi.json`, `/llms.txt`, `/api/spots`, `/api/nearby`, `/api/history`, `/api/categories`. No auth. POST is humans only.
- Hosting: no spend. github.io rejected (cannot store uploads).
- Photo: crop/redact before upload so the façade can be removed.

Undecided / not v1:

- Native iOS/Android.
- Phone push (Telegram instead).
- Paid domain.
- Exact sidewalk-snap algorithm (street/sidewalk nearby; findable; not a house pin).

## Brand Commitments

Name: **mitnimm**.

Visual lock (user, 2026-08-28): category-standard *job* (GPS-centered map, PLZ + **category dropdown**, post) with **listing photos sitting on the coordinates**, dressed in **zip-tie stockroom** grammar (quoted industrial labels, orange zip-tie = live, 45° hazard on selected, nylon/stencil plates). Not teardrop pins. Not Apple/Google/Airbnb chrome. Seed key `db274811`; style from challenger `textiles-weave-drape-fashion-industrial-quote-grammar`.

Voice: short, human, DE/EN/FR/IT. Not marketplace copy.

## Evidence on Hand

No screenshots of real piles in-repo yet, no testimonials, no usage data. Do not invent quotes, user counts, or press. Category tree to be derived from Ricardo.ch / tutti.ch **goods** categories, not their full marketplace (no jobs, services, property, vehicles-as-ads).

## Product Principles

1. **Presence is trust.** Live camera + GPS, or an album JPEG that already has GPS in the file. No GPS, no pin. Agents do not post.
2. **Findable without doxxing.** Close enough to walk to the pile; never a house number or a façade as the listing.
3. **Street speed.** Posting is photo → category → optional note. Finding is map → pin → go.
4. **Rot is the default.** Piles die in days; the product assumes gone, not forever.
5. **No money, no accounts, no comments.** Cost and moderation stay near zero or the thing dies.

## Accessibility & Inclusion

Phone outdoors, one-handed, possibly gloves/sun/rain. DE+EN+FR+IT. Category filter is a native dropdown (not a chip strip) so it fits iPhone 12. PWA must remain usable with large type and one thumb.
