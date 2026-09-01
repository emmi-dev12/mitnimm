import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { ZH, haversineM, inCH, hoursLeft, TTL_H, type Spot } from "./data";
import { styleFor, type MapKind } from "./styles";
import { CATS } from "./categories";
import { gpsFromJpeg } from "./exif";
import { loadSpots, loadHistory, createSpot, stillSpot, goneSpot, itemList, mediaUrl } from "./store";
import { detectLang, I18N, isLang, KMS, LANGS, type Lang } from "./i18n";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div id="map"></div>
  <div class="brand">
    <h1>mitnimm<span></span></h1>
  </div>
  <form class="search-plate" id="plz-form">
    <input id="plz" inputmode="numeric" maxlength="4" placeholder="PLZ" aria-label="PLZ" />
    <button type="submit" id="plz-go" aria-label="Suchen">⌕</button>
  </form>
  <div class="prefs">
    <select id="lang-pick" class="lang-pick" aria-label="Sprache"></select>
    <select id="cat-filter" class="cat-pick" aria-label="Kategorie"></select>
    <div class="pref-row" id="kms" role="radiogroup" aria-label="Umkreis"></div>
  </div>
  <div class="dock">
    <div class="kinds" role="radiogroup" aria-label="Kartentyp">
      <button type="button" class="kind on" data-kind="map">Karte</button>
      <button type="button" class="kind" data-kind="satellite">Satellit</button>
      <button type="button" class="kind" data-kind="hybrid">Hybrid</button>
    </div>
    <div class="plate" id="plate"></div>
    <div class="acts">
      <button type="button" id="still">NOCH DA</button>
      <button type="button" id="weg">WEG</button>
    </div>
    <button class="posten" id="posten" type="button">POSTEN</button>
  </div>
  <div class="install" id="install" hidden>
    <p class="install-copy" id="install-copy"></p>
    <div class="install-bar">
      <button type="button" id="install-skip">NICHT JETZT</button>
      <button type="button" class="shoot" id="install-go">HOMESCREEN</button>
    </div>
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
    <div id="cropstage">
      <div id="cropview"><img id="cropimg" alt="" /></div>
      <input id="cropzoom" type="range" min="1" max="4" step="0.01" value="1" />
    </div>
    <form class="meta" id="meta">
      <img id="preview" alt="" />
      <button type="button" class="editpic" id="recrop">ZUSCHNEIDEN</button>
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
      <button class="cancel" id="album" type="button">ALBUM</button>
      <button class="shoot" id="shoot" type="button">AUSLÖSEN</button>
    </div>
    <div class="bar" id="cropbar">
      <button class="cancel" id="crop-cancel" type="button">ABBRECHEN</button>
      <button class="shoot" id="crop-ok" type="button">ZUSCHNEIDEN</button>
    </div>
    <input id="album-file" type="file" accept="image/jpeg,image/jpg" hidden />
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

function readLang(): Lang {
  const saved = localStorage.getItem("mitnimm.lang");
  if (saved && isLang(saved)) return saved;
  return detectLang(navigator.language);
}
function readKm(): number {
  const n = Number(localStorage.getItem("mitnimm.km"));
  return (KMS as readonly number[]).includes(n) ? n : 3;
}

let lang = readLang();
let km = readKm();
let catFilter = localStorage.getItem("mitnimm.cat") || "";
const t = () => I18N[lang];
const iosHome = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

function catLabel(c: { de: string; en: string; fr: string; it: string; rm: string }) {
  return c[lang];
}

function metres(s: Spot) {
  return Math.round(haversineM(here, s));
}

function renderPlate(s: Spot) {
  const m = metres(s);
  const c = t();
  if (s.gone) {
    const day = new Date(s.goneAt || s.createdAt).toLocaleDateString();
    document.getElementById("plate")!.innerHTML = `
      <div class="cell"><div class="k">${c.was}</div><div class="v">${s.street || "—"}</div></div>
      <div class="cell"><div class="k">${c.cat}</div><div class="v">${lang === "en" ? s.categoryEn : s.category}</div></div>
      <div class="cell"><div class="k">${c.items}</div><div class="v">${lang === "en" ? s.itemsEn : s.items}</div></div>
      <div class="cell"><div class="k">DATUM</div><div class="v">${day}</div></div>
    `;
    return;
  }
  document.getElementById("plate")!.innerHTML = `
    <div class="cell"><div class="k">${c.cat}</div><div class="v">${lang === "en" ? s.categoryEn : s.category}</div></div>
    <div class="cell"><div class="k">${c.items}</div><div class="v">${lang === "en" ? s.itemsEn : s.items}</div></div>
    <div class="cell"><div class="k">${c.metres}</div><div class="v">${m} M</div></div>
    <div class="cell"><div class="k">${c.hours}</div><div class="v">${String(hoursLeft(s)).padStart(2, "0")} H</div></div>
  `;
}

function crateEl(s: Spot) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "crate" + (s.id === selected?.id ? " sel" : "") + (s.gone ? " hist" : "");
  const label = lang === "en" ? s.quoteEn : s.quote;
  el.innerHTML = s.gone
    ? `
    <div class="frame">
      <div class="quote">“${label}”</div>
    </div>
  `
    : `
    <span class="tie"></span>
    <div class="frame">
      <img src="${mediaUrl(s.photo)}" alt="${s.quote}" />
      <div class="quote">“${label}”</div>
      <div class="hazard"></div>
    </div>
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    select(s);
  });
  return el;
}

function histSpots() {
  return allSpots.filter((s) => s.gone && metres(s) <= km * 1000 && spotMatchesCat(s));
}

function mountMarkers() {
  const shown = [...liveSpots(), ...histSpots()];
  const keep = new Set(shown.map((s) => s.id));
  for (const [id, m] of markers) {
    if (!keep.has(id)) {
      m.remove();
      markers.delete(id);
    }
  }
  for (const s of shown) {
    markers.get(s.id)?.remove();
    const m = new maplibregl.Marker({ element: crateEl(s), anchor: "bottom" })
      .setLngLat([s.lon, s.lat])
      .addTo(map);
    markers.set(s.id, m);
  }
}

function spotMatchesCat(s: Spot) {
  if (!catFilter) return true;
  const cat = CATS.find((c) => c.id === catFilter);
  if (!cat) return true;
  const keys = [cat.de, cat.en, cat.fr, cat.it, cat.rm, ...(cat.subs ?? []).flatMap((x) => [x.de, x.en, x.fr, x.it, x.rm])];
  const blob = `${s.category} ${s.categoryEn} ${s.quote} ${s.quoteEn} ${s.items} ${s.itemsEn}`.toLowerCase();
  return keys.some((k) => blob.includes(k.toLowerCase()));
}

function liveSpots() {
  return allSpots.filter(
    (s) => !s.gone && hoursLeft(s) > 0 && metres(s) <= km * 1000 && spotMatchesCat(s),
  );
}

function selectLive(s?: Spot | null) {
  const live = liveSpots();
  const next = s && live.some((x) => x.id === s.id) ? s : live[0];
  if (!next) {
    selected = null;
    document.getElementById("plate")!.innerHTML =
      `<div class="cell"><div class="k">MAP</div><div class="v">${t().empty}</div></div>`;
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
      selectLive();
      return;
    }
    select(next);
  } catch {
    alert(t().apiDown);
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
    alert(t().apiDown);
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

function padMap() {
  const dock = document.querySelector(".dock") as HTMLElement | null;
  const h = dock?.offsetHeight ?? 210;
  map.setPadding({ top: 88, bottom: h + 10, left: 8, right: 8 });
}

map.on("load", async () => {
  padMap();
  try {
    const [live, hist] = await Promise.all([loadSpots(), loadHistory().catch(() => [] as Spot[])]);
    allSpots = [...live, ...hist];
  } catch {
    alert(t().apiDown);
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
  here = { lat, lon };
  you.setLngLat([lon, lat]);
  map.easeTo({ center: [lon, lat], zoom: 15, duration: 700 });
  selectLive(selected);
});

const sheet = document.getElementById("sheet")!;
const video = document.getElementById("cam") as HTMLVideoElement;
const meta = document.getElementById("meta") as HTMLFormElement;
const cambar = document.getElementById("cambar")!;
const cropstage = document.getElementById("cropstage")!;
const cropbar = document.getElementById("cropbar")!;
const cropview = document.getElementById("cropview")!;
const cropimg = document.getElementById("cropimg") as HTMLImageElement;
const cropzoom = document.getElementById("cropzoom") as HTMLInputElement;
const preview = document.getElementById("preview") as HTMLImageElement;
const albumFile = document.getElementById("album-file") as HTMLInputElement;
const catsEl = document.getElementById("cats")!;
const subsEl = document.getElementById("subs")!;
let stream: MediaStream | null = null;
let photo: string | null = null;
let cropSrc = "";
let cropScale = 1;
let cropX = 0;
let cropY = 0;
let catId: string | null = null;
let subId: string | null = null;
let havePin = false;

function stopCam() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
}

function hideCrop() {
  cropstage.classList.remove("show");
  cropbar.classList.remove("show");
}

function closeSheet() {
  stopCam();
  photo = null;
  cropSrc = "";
  catId = null;
  subId = null;
  havePin = false;
  albumFile.value = "";
  const house = document.getElementById("no-house") as HTMLInputElement | null;
  if (house) house.checked = false;
  meta.classList.remove("show");
  hideCrop();
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

function layoutCrop() {
  const box = cropview.clientWidth || 320;
  const nw = cropimg.naturalWidth || 1;
  const nh = cropimg.naturalHeight || 1;
  const base = Math.max(box / nw, box / nh);
  const w = nw * base * cropScale;
  const h = nh * base * cropScale;
  const minX = Math.min(0, box - w);
  const minY = Math.min(0, box - h);
  cropX = Math.min(0, Math.max(minX, cropX));
  cropY = Math.min(0, Math.max(minY, cropY));
  cropimg.style.width = `${w}px`;
  cropimg.style.height = `${h}px`;
  cropimg.style.transform = `translate(${cropX}px, ${cropY}px)`;
}

function openCrop(src: string) {
  cropSrc = src;
  cropScale = 1;
  cropX = 0;
  cropY = 0;
  cropzoom.value = "1";
  cropimg.onload = () => layoutCrop();
  cropimg.src = src;
  stopCam();
  video.style.display = "none";
  cambar.style.display = "none";
  meta.classList.remove("show");
  cropstage.classList.add("show");
  cropbar.classList.add("show");
}

function commitCrop() {
  const box = cropview.clientWidth || 320;
  const nw = cropimg.naturalWidth || 1;
  const nh = cropimg.naturalHeight || 1;
  const base = Math.max(box / nw, box / nh);
  const scale = base * cropScale;
  const sx = -cropX / scale;
  const sy = -cropY / scale;
  const ss = box / scale;
  const c = document.createElement("canvas");
  c.width = 720;
  c.height = 720;
  c.getContext("2d")!.drawImage(cropimg, sx, sy, ss, ss, 0, 0, 720, 720);
  photo = c.toDataURL("image/jpeg", 0.72);
  preview.src = photo;
  hideCrop();
  meta.classList.add("show");
  paintCats();
}

function paintCats() {
  catsEl.innerHTML = CATS.map(
    (c) =>
      `<button type="button" class="chip${c.id === catId ? " on" : ""}" data-cat="${c.id}">${catLabel(c)}</button>`,
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
        `<button type="button" class="chip${s.id === subId ? " on" : ""}" data-sub="${s.id}">${catLabel(s)}</button>`,
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

async function openPoster() {
  sheet.classList.add("open");
  video.style.display = "";
  cambar.style.display = "";
  hideCrop();
  meta.classList.remove("show");
  try {
    const pos = await gps();
    here = pos;
    havePin = true;
    you.setLngLat([pos.lon, pos.lat]);
  } catch {
    /* album can still post via EXIF */
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    video.srcObject = stream;
  } catch {
    video.style.display = "none";
  }
}

document.getElementById("posten")!.addEventListener("click", () => {
  void openPoster();
});

document.getElementById("cancel")!.addEventListener("click", closeSheet);
document.getElementById("abort")!.addEventListener("click", closeSheet);

document.getElementById("shoot")!.addEventListener("click", () => {
  if (!stream) {
    albumFile.click();
    return;
  }
  if (!havePin) {
    alert(t().needGps);
    return;
  }
  const c = document.createElement("canvas");
  const w = video.videoWidth || 720;
  const h = video.videoHeight || 720;
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(video, 0, 0);
  openCrop(c.toDataURL("image/jpeg", 0.92));
});

document.getElementById("album")!.addEventListener("click", () => albumFile.click());
document.getElementById("recrop")!.addEventListener("click", () => {
  if (cropSrc) openCrop(cropSrc);
});
document.getElementById("crop-ok")!.addEventListener("click", commitCrop);
document.getElementById("crop-cancel")!.addEventListener("click", closeSheet);

albumFile.addEventListener("change", async () => {
  const file = albumFile.files?.[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  const gpsFix = gpsFromJpeg(buf);
  if (!gpsFix || !inCH(gpsFix.lat, gpsFix.lon)) {
    alert(t().needExif);
    albumFile.value = "";
    return;
  }
  here = gpsFix;
  havePin = true;
  you.setLngLat([gpsFix.lon, gpsFix.lat]);
  map.easeTo({ center: [gpsFix.lon, gpsFix.lat], zoom: 16, duration: 280 });
  const url = URL.createObjectURL(file);
  openCrop(url);
});

cropzoom.addEventListener("input", () => {
  cropScale = Number(cropzoom.value);
  layoutCrop();
});
let drag: { x: number; y: number; cx: number; cy: number } | null = null;
cropview.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, y: e.clientY, cx: cropX, cy: cropY };
  cropview.setPointerCapture(e.pointerId);
});
cropview.addEventListener("pointermove", (e) => {
  if (!drag) return;
  cropX = drag.cx + (e.clientX - drag.x);
  cropY = drag.cy + (e.clientY - drag.y);
  layoutCrop();
});
cropview.addEventListener("pointerup", () => {
  drag = null;
});

meta.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!photo || !catId) {
    alert(t().needMeta);
    return;
  }
  if (!havePin) {
    alert(t().needGps);
    return;
  }
  const noHouse = (document.getElementById("no-house") as HTMLInputElement).checked;
  if (!noHouse) {
    alert(t().needPile);
    return;
  }
  const cat = CATS.find((c) => c.id === catId)!;
  const sub = cat.subs?.find((s) => s.id === subId);
  const label = catLabel(sub ?? cat);
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
    alert(t().saveFail);
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
  map.once("style.load", () => {
    you.addTo(map);
    mountMarkers();
  });
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

function paintPrefs() {
  const kms = document.getElementById("kms")!;
  const pick = document.getElementById("lang-pick") as HTMLSelectElement;
  pick.innerHTML = LANGS.map(
    (l) => `<option value="${l}"${l === lang ? " selected" : ""}>${l.toUpperCase()}</option>`,
  ).join("");
  kms.innerHTML = KMS.map(
    (n) =>
      `<button type="button" class="pref${n === km ? " on" : ""}" data-km="${n}">${n}km</button>`,
  ).join("");
}

function paintCatbar() {
  const sel = document.getElementById("cat-filter") as HTMLSelectElement;
  const chips = [{ id: "", label: t().allCats }, ...CATS.map((c) => ({ id: c.id, label: catLabel(c) }))];
  sel.innerHTML = chips.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");
  sel.value = catFilter;
}

document.getElementById("cat-filter")!.addEventListener("change", (e) => {
  catFilter = (e.target as HTMLSelectElement).value;
  localStorage.setItem("mitnimm.cat", catFilter);
  selectLive(selected);
});

function applyChrome() {
  const c = t();
  document.documentElement.lang = lang;
  document.querySelector<HTMLButtonElement>("[data-kind=map]")!.textContent = c.map;
  document.querySelector<HTMLButtonElement>("[data-kind=satellite]")!.textContent = c.sat;
  document.querySelector<HTMLButtonElement>("[data-kind=hybrid]")!.textContent = c.hyb;
  document.getElementById("still")!.textContent = c.still;
  document.getElementById("weg")!.textContent = c.gone;
  document.getElementById("posten")!.textContent = c.posten;
  document.querySelector(".gonebox .hint")!.textContent = c.goneHint;
  document.getElementById("gone-cancel")!.textContent = c.cancel;
  document.getElementById("gone-all")!.textContent = c.goneAll;
  document.getElementById("gone-some")!.textContent = c.ok;
  document.querySelector(".camhint")!.textContent = c.camHint;
  document.querySelector(".meta .hint")!.textContent = c.metaHint;
  document.querySelector(".nophoto-house")!.lastChild!.textContent = " " + c.noHouse;
  (document.getElementById("note") as HTMLInputElement).placeholder = c.note;
  document.getElementById("pin")!.textContent = c.pin;
  document.getElementById("shoot")!.textContent = c.shoot;
  document.getElementById("album")!.textContent = c.album;
  document.getElementById("crop-ok")!.textContent = c.crop;
  document.getElementById("recrop")!.textContent = c.crop;
  document.getElementById("crop-cancel")!.textContent = c.cancel;
  document.getElementById("abort")!.textContent = c.cancel;
  document.getElementById("cancel")!.textContent = c.cancel;
  document.getElementById("plz-go")!.setAttribute("aria-label", c.search);
  document.getElementById("cat-filter")!.setAttribute("aria-label", c.cat);
  document.querySelector(".kinds")!.setAttribute("aria-label", c.mapType);
  document.getElementById("lang-pick")!.setAttribute("aria-label", c.langAria);
  document.getElementById("kms")!.setAttribute("aria-label", c.kmAria);
  document.getElementById("install-copy")!.textContent = iosHome ? c.installIos : c.installHint;
  document.getElementById("install-go")!.textContent = iosHome ? c.installIos : c.installGo;
  document.getElementById("install-skip")!.textContent = c.installSkip;
  document.getElementById("install-go")!.hidden = iosHome;
  paintPrefs();
  paintCatbar();
  paintCats();
  if (selected && liveSpots().some((x) => x.id === selected!.id)) renderPlate(selected);
  else selectLive();
}

document.getElementById("lang-pick")!.addEventListener("change", (e) => {
  const v = (e.target as HTMLSelectElement).value;
  if (!isLang(v)) return;
  lang = v;
  localStorage.setItem("mitnimm.lang", lang);
  applyChrome();
});
document.getElementById("kms")!.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-km]");
  if (!b) return;
  const n = Number(b.dataset.km);
  if (!(KMS as readonly number[]).includes(n)) return;
  km = n;
  localStorage.setItem("mitnimm.km", String(km));
  paintPrefs();
  selectLive(selected);
});

applyChrome();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  void navigator.serviceWorker.register("/sw.js");
}

type InstallPrompt = Event & { prompt: () => Promise<void> };
let deferredInstall: InstallPrompt | null = null;

function showInstall() {
  if (standalone || localStorage.getItem("mitnimm.installSkip")) return;
  if (!iosHome && !deferredInstall) return;
  document.getElementById("install")!.hidden = false;
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e as InstallPrompt;
  showInstall();
});

if (iosHome) showInstall();

document.getElementById("install-skip")!.addEventListener("click", () => {
  localStorage.setItem("mitnimm.installSkip", "1");
  document.getElementById("install")!.hidden = true;
});
document.getElementById("install-go")!.addEventListener("click", async () => {
  if (!deferredInstall) return;
  await deferredInstall.prompt();
  deferredInstall = null;
  document.getElementById("install")!.hidden = true;
});

const bumpMap = () => {
  map.resize();
  padMap();
};
window.addEventListener("resize", bumpMap);
window.visualViewport?.addEventListener("resize", bumpMap);
