import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { ZH, haversineM, inCH, hoursLeft, TTL_H, type Spot } from "./data";
import { styleFor, type MapKind } from "./styles";
import { CATS } from "./categories";
import { loadSpots, createSpot, stillSpot, goneSpot, itemList, mediaUrl } from "./store";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div id="map"></div>
  <div class="brand">
    <h1>mitnimm<span></span></h1>
  </div>
  <form class="search-plate" id="plz-form">
    <input id="plz" inputmode="numeric" maxlength="4" placeholder="PLZ" aria-label="PLZ" />
    <button type="submit" aria-label="Suchen">⌕</button>
  </form>
  <div class="kinds" role="radiogroup" aria-label="Kartentyp">
    <button type="button" class="kind on" data-kind="map">Karte</button>
    <button type="button" class="kind" data-kind="satellite">Satellit</button>
    <button type="button" class="kind" data-kind="hybrid">Hybrid</button>
  </div>
  <div class="dock">
    <div class="plate" id="plate"></div>
    <div class="acts">
      <button type="button" id="still">NOCH DA</button>
      <button type="button" id="weg">WEG</button>
    </div>
    <button class="posten" id="posten" type="button">POSTEN</button>
  </div>
  <div class="gonebox" id="gonebox">
    <p class="hint">Was ist weg?</p>
    <div id="goneitems"></div>
    <div class="bar">
      <button class="cancel" type="button" id="gone-cancel">ABBRECHEN</button>
      <button class="shoot" type="button" id="gone-all">ALLES WEG</button>
      <button class="shoot" type="button" id="gone-some">OK</button>
    </div>
  </div>
  <div class="sheet" id="sheet">
    <video id="cam" autoplay playsinline></video>
    <p class="camhint">Nur der Haufen. Kein Haus, keine Fassade, keine Hausnummer.</p>
    <form class="meta" id="meta">
      <img id="preview" alt="" />
      <p class="hint">Kategorie, dann optional genauer. Foto = Haufen, nicht Haus.</p>
      <label class="nophoto-house"><input type="checkbox" id="no-house" /> Foto zeigt den Haufen, nicht das Haus.</label>
      <div class="cats" id="cats"></div>
      <div class="cats" id="subs"></div>
      <input id="note" maxlength="80" placeholder="Was genau? (optional)" />
      <div class="bar">
        <button class="cancel" id="abort" type="button">ABBRECHEN</button>
        <button class="shoot" id="pin" type="submit">PIN SETZEN</button>
      </div>
    </form>
    <div class="bar" id="cambar">
      <button class="cancel" id="cancel" type="button">ABBRECHEN</button>
      <button class="shoot" id="shoot" type="button">AUSLÖSEN</button>
    </div>
  </div>
`;

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/liberty",
  center: [ZH.lon, ZH.lat],
  zoom: 15.2,
  attributionControl: { compact: true },
  pitch: 0,
  maxBounds: [5.85, 45.78, 10.55, 47.85],
  minZoom: 7,
});

let here = { ...ZH };
let allSpots: Spot[] = [];
let selected: Spot | null = null;
const markers = new Map<string, maplibregl.Marker>();

function metres(s: Spot) {
  return Math.round(haversineM(here, s));
}

function renderPlate(s: Spot) {
  const m = metres(s);
  document.getElementById("plate")!.innerHTML = `
    <div class="cell"><div class="k">CATEGORY</div><div class="v">${s.category}</div></div>
    <div class="cell"><div class="k">ITEMS</div><div class="v">${s.items}</div></div>
    <div class="cell"><div class="k">METRES</div><div class="v">${m} M</div></div>
    <div class="cell"><div class="k">HOURS LEFT</div><div class="v">${String(hoursLeft(s)).padStart(2, "0")} H</div></div>
  `;
}

function crateEl(s: Spot) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "crate" + (s.id === selected?.id ? " sel" : "");
  el.innerHTML = `
    <span class="tie"></span>
    <div class="frame">
      <img src="${mediaUrl(s.photo)}" alt="${s.quote}" />
      <div class="quote">“${s.quote}”</div>
      <div class="hazard"></div>
    </div>
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    select(s);
  });
  return el;
}

function mountMarkers() {
  const live = new Set(
    allSpots.filter((s) => !s.gone && hoursLeft(s) > 0).map((s) => s.id),
  );
  for (const [id, m] of markers) {
    if (!live.has(id)) {
      m.remove();
      markers.delete(id);
    }
  }
  for (const s of allSpots) {
    if (s.gone || hoursLeft(s) <= 0) continue;
    markers.get(s.id)?.remove();
    const m = new maplibregl.Marker({ element: crateEl(s), anchor: "bottom" })
      .setLngLat([s.lon, s.lat])
      .addTo(map);
    markers.set(s.id, m);
  }
}

function liveSpots() {
  return allSpots.filter((s) => !s.gone && hoursLeft(s) > 0);
}

function selectLive(s?: Spot | null) {
  const live = liveSpots();
  const next = s && live.some((x) => x.id === s.id) ? s : live[0];
  if (!next) {
    selected = null;
    document.getElementById("plate")!.innerHTML =
      `<div class="cell"><div class="k">MAP</div><div class="v">NICHTS DA</div></div>`;
    mountMarkers();
    return;
  }
  select(next);
}

async function markGone(s: Spot, remaining?: string[]) {
  try {
    const next = await goneSpot(s.id, remaining);
    const i = allSpots.findIndex((x) => x.id === s.id);
    if (i >= 0) allSpots[i] = next;
    if (next.gone) {
      allSpots = allSpots.filter((x) => x.id !== s.id);
      markers.get(s.id)?.remove();
      markers.delete(s.id);
      selectLive();
      return;
    }
    select(next);
  } catch {
    alert("API down.");
  }
}

async function stillThere(s: Spot) {
  try {
    const next = await stillSpot(s.id);
    const i = allSpots.findIndex((x) => x.id === s.id);
    if (i >= 0) allSpots[i] = next;
    selected = next;
    renderPlate(next);
  } catch {
    alert("API down.");
  }
}

const gonebox = () => document.getElementById("gonebox")!;

function openGone(s: Spot) {
  const items = itemList(s);
  if (items.length <= 1) {
    markGone(s);
    return;
  }
  document.getElementById("goneitems")!.innerHTML = items
    .map(
      (it, i) =>
        `<label class="chip"><input type="checkbox" data-i="${i}" /> ${it}</label>`,
    )
    .join("");
  gonebox().classList.add("open");
}

function select(s: Spot) {
  selected = s;
  mountMarkers();
  renderPlate(s);
  map.easeTo({ center: [s.lon, s.lat], offset: [0, -40], duration: 280 });
}

const youEl = document.createElement("div");
youEl.className = "you";
const you = new maplibregl.Marker({ element: youEl, anchor: "center" })
  .setLngLat([here.lon, here.lat])
  .addTo(map);

map.on("load", async () => {
  try {
    allSpots = await loadSpots();
  } catch {
    alert("API nicht da. Ein Terminal: npm run dev (web + api).");
  }
  mountMarkers();
  selectLive();
  const jump = new URLSearchParams(location.search);
  const jlat = Number(jump.get("lat"));
  const jlon = Number(jump.get("lon"));
  if (inCH(jlat, jlon)) {
    map.easeTo({ center: [jlon, jlat], zoom: 16, duration: 400 });
  } else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        if (!inCH(lat, lon)) return;
        here = { lat, lon };
        you.setLngLat([lon, lat]);
        map.easeTo({ center: [lon, lat], zoom: 16, duration: 600 });
        if (selected) renderPlate(selected);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }
});

document.getElementById("plz-form")!.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = (document.getElementById("plz") as HTMLInputElement).value.trim();
  if (!/^\d{4}$/.test(q)) return;
  const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${q}&type=locations&origins=zipcode&limit=1`;
  const res = await fetch(url);
  const json = await res.json();
  const hit = json.results?.[0]?.attrs;
  if (!hit) return;
  const lat = hit.lat as number;
  const lon = hit.lon as number;
  map.easeTo({ center: [lon, lat], zoom: 15, duration: 700 });
});

const sheet = document.getElementById("sheet")!;
const video = document.getElementById("cam") as HTMLVideoElement;
const meta = document.getElementById("meta") as HTMLFormElement;
const cambar = document.getElementById("cambar")!;
const preview = document.getElementById("preview") as HTMLImageElement;
const catsEl = document.getElementById("cats")!;
const subsEl = document.getElementById("subs")!;
let stream: MediaStream | null = null;
let photo: string | null = null;
let catId: string | null = null;
let subId: string | null = null;

function stopCam() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
}

function closeSheet() {
  stopCam();
  photo = null;
  catId = null;
  subId = null;
  const house = document.getElementById("no-house") as HTMLInputElement | null;
  if (house) house.checked = false;
  meta.classList.remove("show");
  video.style.display = "";
  cambar.style.display = "";
  sheet.classList.remove("open");
}

function gps(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("gps"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        if (!inCH(lat, lon)) reject(new Error("ch"));
        else resolve({ lat, lon });
      },
      () => reject(new Error("gps")),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  });
}

function paintCats() {
  catsEl.innerHTML = CATS.map(
    (c) =>
      `<button type="button" class="chip${c.id === catId ? " on" : ""}" data-cat="${c.id}">${c.de}</button>`,
  ).join("");
  const cat = CATS.find((c) => c.id === catId);
  if (!cat?.subs?.length) {
    subsEl.innerHTML = "";
    subId = null;
    return;
  }
  subsEl.innerHTML = cat.subs
    .map(
      (s) =>
        `<button type="button" class="chip${s.id === subId ? " on" : ""}" data-sub="${s.id}">${s.de}</button>`,
    )
    .join("");
}

catsEl.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-cat]");
  if (!b) return;
  catId = b.dataset.cat!;
  subId = null;
  paintCats();
});
subsEl.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-sub]");
  if (!b) return;
  subId = b.dataset.sub!;
  paintCats();
});

document.getElementById("posten")!.addEventListener("click", async () => {
  try {
    const pos = await gps();
    here = pos;
    you.setLngLat([pos.lon, pos.lat]);
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    video.srcObject = stream;
    sheet.classList.add("open");
  } catch (err) {
    const e = err as Error;
    if (e.message === "ch") alert("Nur in der Schweiz.");
    else if (e.message === "gps") alert("Standort braucht GPS. Du musst beim Haufen sein.");
    else alert("Kamera braucht HTTPS + Erlaubnis. Nur Live-Foto, kein Album.");
  }
});

document.getElementById("cancel")!.addEventListener("click", closeSheet);
document.getElementById("abort")!.addEventListener("click", closeSheet);

document.getElementById("shoot")!.addEventListener("click", () => {
  const c = document.createElement("canvas");
  const w = video.videoWidth || 720;
  const h = video.videoHeight || 720;
  const side = Math.min(w, h);
  c.width = 720;
  c.height = 720;
  const x = (w - side) / 2;
  const y = (h - side) / 2;
  c.getContext("2d")!.drawImage(video, x, y, side, side, 0, 0, 720, 720);
  photo = c.toDataURL("image/jpeg", 0.72);
  preview.src = photo;
  stopCam();
  video.style.display = "none";
  cambar.style.display = "none";
  meta.classList.add("show");
  paintCats();
});

meta.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!photo || !catId) {
    alert("Foto + Kategorie.");
    return;
  }
  const noHouse = (document.getElementById("no-house") as HTMLInputElement).checked;
  if (!noHouse) {
    alert("Nur Haufen fotografieren, kein Haus.");
    return;
  }
  const cat = CATS.find((c) => c.id === catId)!;
  const sub = cat.subs?.find((s) => s.id === subId);
  const label = (sub ?? cat).de;
  const note = (document.getElementById("note") as HTMLInputElement).value.trim();
  try {
    const blob = await (await fetch(photo)).blob();
    const spot = await createSpot(
      {
        lat: String(here.lat),
        lon: String(here.lon),
        quote: label.toUpperCase(),
        quoteEn: (sub ?? cat).en.toUpperCase(),
        category: cat.de,
        categoryEn: cat.en,
        items: note || label,
        itemsEn: note || (sub ?? cat).en,
      },
      blob,
    );
    allSpots.push(spot);
    closeSheet();
    select(spot);
  } catch {
    alert("Speichern fehlgeschlagen. Läuft die API?");
  }
});

let kind: MapKind = "map";
document.querySelector(".kinds")!.addEventListener("click", async (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-kind]");
  if (!btn) return;
  const next = btn.dataset.kind as MapKind;
  if (next === kind) return;
  kind = next;
  for (const b of document.querySelectorAll<HTMLButtonElement>(".kind")) {
    b.classList.toggle("on", b.dataset.kind === kind);
  }
  map.setStyle(await styleFor(kind));
});

document.getElementById("still")!.addEventListener("click", () => {
  const s = liveSpots().find((x) => x.id === selected?.id);
  if (s) stillThere(s);
});
document.getElementById("weg")!.addEventListener("click", () => {
  const s = liveSpots().find((x) => x.id === selected?.id);
  if (s) openGone(s);
});
document.getElementById("gone-cancel")!.addEventListener("click", () => {
  gonebox().classList.remove("open");
});
document.getElementById("gone-all")!.addEventListener("click", () => {
  gonebox().classList.remove("open");
  const s = liveSpots().find((x) => x.id === selected?.id);
  if (s) markGone(s);
});
document.getElementById("gone-some")!.addEventListener("click", () => {
  const s = liveSpots().find((x) => x.id === selected?.id);
  if (!s) return;
  const items = itemList(s);
  const goneIdx = new Set(
    [...document.querySelectorAll<HTMLInputElement>("#goneitems input:checked")].map((el) =>
      Number(el.dataset.i),
    ),
  );
  gonebox().classList.remove("open");
  markGone(
    s,
    items.filter((_, i) => !goneIdx.has(i)),
  );
});
