import { Hono } from "hono";
import { cors } from "hono/cors";
import { appUrl, notifyNew, tg } from "./telegram";
import { detectLang, isLang, KMS, TG, type Lang } from "./copy";
import { agentCard, openapi } from "./agent";
import { CATS } from "../../src/categories";

type Stmt = {
  bind: (...args: unknown[]) => Stmt;
  run: () => unknown | Promise<unknown>;
  all: <T>() => { results?: T[] } | Promise<{ results?: T[] }>;
  first: <T>() => T | null | Promise<T | null>;
};

type Env = {
  DB: { prepare: (sql: string) => Stmt };
  PHOTOS: {
    put: (
      key: string,
      value: ArrayBuffer,
      opts?: { httpMetadata?: { contentType?: string } },
    ) => Promise<unknown>;
    get: (
      key: string,
    ) => Promise<{ body: BodyInit; httpMetadata?: { contentType?: string } } | null>;
    delete: (key: string) => Promise<unknown>;
  };
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  APP_URL?: string;
};

type Row = {
  id: string;
  lat: number;
  lon: number;
  quote: string;
  quote_en: string;
  category: string;
  category_en: string;
  items: string;
  items_en: string;
  photo_key: string;
  created_at: number;
  gone: number;
  street: string;
  gone_at: number;
};

const TTL_MS = 72 * 3600_000;
const CH = { minLat: 45.8, maxLat: 47.9, minLon: 5.9, maxLon: 10.6 };

const app = new Hono<{ Bindings: Env }>();
app.use("/api", cors({ origin: "*" }));
app.use("/api/*", cors({ origin: "*" }));

async function migrate(db: Env["DB"]) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS spots (id TEXT PRIMARY KEY, lat REAL NOT NULL, lon REAL NOT NULL, quote TEXT NOT NULL, quote_en TEXT NOT NULL, category TEXT NOT NULL, category_en TEXT NOT NULL, items TEXT NOT NULL, items_en TEXT NOT NULL, photo_key TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, gone INTEGER NOT NULL DEFAULT 0)`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS prefs (chat_id TEXT PRIMARY KEY, lang TEXT NOT NULL DEFAULT 'de', km INTEGER NOT NULL DEFAULT 3)`,
    )
    .run();
  for (const sql of [
    "ALTER TABLE spots ADD COLUMN street TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE spots ADD COLUMN gone_at INTEGER NOT NULL DEFAULT 0",
  ]) {
    try {
      await db.prepare(sql).run();
    } catch {
      /* column exists */
    }
  }
}

type Pref = { lang: Lang; km: number };

async function getPref(env: Env, chatId: number, hint?: string | null): Promise<Pref> {
  await migrate(env.DB);
  const row = await env.DB.prepare("SELECT lang, km FROM prefs WHERE chat_id = ?")
    .bind(String(chatId))
    .first<{ lang: string; km: number }>();
  if (row && isLang(row.lang)) {
    const km = Number(row.km);
    return { lang: row.lang, km: KMS.includes(km as never) ? km : 3 };
  }
  return { lang: detectLang(hint), km: 3 };
}

async function setPref(env: Env, chatId: number, patch: Partial<Pref>) {
  const cur = await getPref(env, chatId);
  const next = { ...cur, ...patch };
  await env.DB.prepare(
    "INSERT INTO prefs (chat_id, lang, km) VALUES (?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET lang = excluded.lang, km = excluded.km",
  )
    .bind(String(chatId), next.lang, next.km)
    .run();
  return next;
}

async function expire(env: Env) {
  const cut = Date.now() - TTL_MS;
  const old = await env.DB.prepare(
    "SELECT id, photo_key FROM spots WHERE gone = 0 AND created_at < ?",
  )
    .bind(cut)
    .all<{ id: string; photo_key: string }>();
  for (const r of old.results ?? []) {
    if (r.photo_key) await env.PHOTOS.delete(r.photo_key);
  }
  if (old.results?.length) {
    await env.DB.prepare(
      "UPDATE spots SET gone = 1, photo_key = '', gone_at = ? WHERE gone = 0 AND created_at < ?",
    )
      .bind(Date.now(), cut)
      .run();
  }
}

function hoursLeft(created: number) {
  return Math.max(0, Math.round((created + TTL_MS - Date.now()) / 3600_000));
}

function metres(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function geocodePlz(plz: string) {
  const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${plz}&type=locations&origins=zipcode&limit=1`;
  const json = (await fetch(url).then((r) => r.json())) as {
    results?: { attrs?: { lat: number; lon: number } }[];
  };
  const hit = json.results?.[0]?.attrs;
  if (!hit) return null;
  return { lat: hit.lat, lon: hit.lon };
}

async function reverseStreet(lat: number, lon: number) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const json = (await fetch(url, {
      headers: { "user-agent": "mitnimm/0.1 (https://mitnimm.vercel.app)" },
    }).then((r) => r.json())) as {
      address?: { road?: string; postcode?: string; suburb?: string; village?: string; town?: string; city?: string };
    };
    const a = json.address || {};
    const place = a.suburb || a.village || a.town || a.city || "";
    return [a.road, a.postcode, place].filter(Boolean).join(", ").slice(0, 80);
  } catch {
    return "";
  }
}

function jsonSpot(r: Row) {
  return {
    id: r.id,
    lat: r.lat,
    lon: r.lon,
    quote: r.quote,
    quoteEn: r.quote_en,
    category: r.category,
    categoryEn: r.category_en,
    items: r.items,
    itemsEn: r.items_en,
    photo: r.photo_key ? `/api/photos/${r.photo_key}` : "",
    street: r.street || "",
    createdAt: r.created_at,
    hoursLeft: hoursLeft(r.created_at),
    gone: r.gone === 1,
    goneAt: r.gone_at || 0,
  };
}

function hay(s: { quote: string; quoteEn: string; category: string; categoryEn: string; items: string; itemsEn: string; street?: string }) {
  return [s.quote, s.quoteEn, s.category, s.categoryEn, s.items, s.itemsEn, s.street || ""]
    .join(" ")
    .toLowerCase();
}

function catKeys(raw: string) {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const cat = CATS.find(
    (c) =>
      c.id === q ||
      c.de.toLowerCase() === q ||
      c.en.toLowerCase() === q ||
      c.fr.toLowerCase() === q ||
      c.it.toLowerCase() === q ||
      c.rm.toLowerCase() === q,
  );
  if (!cat) return [q];
  return [cat.id, cat.de, cat.en, cat.fr, cat.it, cat.rm, ...(cat.subs ?? []).flatMap((s) => [s.id, s.de, s.en, s.fr, s.it, s.rm])].map(
    (x) => x.toLowerCase(),
  );
}

function matchSpot(
  s: ReturnType<typeof jsonSpot>,
  category: string,
  q: string,
) {
  const blob = hay(s);
  if (category) {
    const keys = catKeys(category);
    if (!keys.some((k) => blob.includes(k))) return false;
  }
  if (q && !blob.includes(q.trim().toLowerCase())) return false;
  return true;
}

app.get("/api", (c) => c.json(agentCard));
app.get("/api/agent", (c) => c.json(agentCard));
app.get("/api/openapi.json", (c) => c.json(openapi));
app.get("/api/categories", (c) =>
  c.json(CATS.map((x) => ({ id: x.id, de: x.de, en: x.en, fr: x.fr, it: x.it, rm: x.rm }))),
);

app.get("/api/spots", async (c) => {
  await migrate(c.env.DB);
  await expire(c.env);
  const category = String(c.req.query("category") || "");
  const q = String(c.req.query("q") || "");
  const live = await c.env.DB.prepare(
    "SELECT * FROM spots WHERE gone = 0 ORDER BY created_at DESC",
  ).all<Row>();
  return c.json(
    (live.results ?? []).map(jsonSpot).filter((s) => matchSpot(s, category, q)),
  );
});

app.get("/api/history", async (c) => {
  await migrate(c.env.DB);
  await expire(c.env);
  const rows = await c.env.DB.prepare(
    "SELECT * FROM spots WHERE gone = 1 ORDER BY gone_at DESC, created_at DESC LIMIT 80",
  ).all<Row>();
  const category = String(c.req.query("category") || "");
  const q = String(c.req.query("q") || "");
  return c.json((rows.results ?? []).map(jsonSpot).filter((s) => matchSpot(s, category, q)));
});

app.post("/api/spots", async (c) => {
  await migrate(c.env.DB);
  const form = await c.req.formData();
  const lat = Number(form.get("lat"));
  const lon = Number(form.get("lon"));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < CH.minLat ||
    lat > CH.maxLat ||
    lon < CH.minLon ||
    lon > CH.maxLon
  ) {
    return c.json({ error: "ch" }, 400);
  }
  const file = form.get("photo");
  if (!(file instanceof File) || file.size < 100 || file.size > 900_000) {
    return c.json({ error: "photo" }, 400);
  }
  const quote = String(form.get("quote") || "").slice(0, 40);
  const category = String(form.get("category") || "").slice(0, 40);
  if (!quote || !category) return c.json({ error: "meta" }, 400);

  const id = crypto.randomUUID();
  const key = `${id}.jpg`;
  await c.env.PHOTOS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: "image/jpeg" },
  });
  const street = await reverseStreet(lat, lon);
  const now = Date.now();
  const row: Row = {
    id,
    lat,
    lon,
    quote,
    quote_en: String(form.get("quoteEn") || quote).slice(0, 40),
    category,
    category_en: String(form.get("categoryEn") || category).slice(0, 40),
    items: String(form.get("items") || quote).slice(0, 80),
    items_en: String(form.get("itemsEn") || quote).slice(0, 80),
    photo_key: key,
    created_at: now,
    gone: 0,
    street,
    gone_at: 0,
  };
  await c.env.DB.prepare(
    `INSERT INTO spots (id,lat,lon,quote,quote_en,category,category_en,items,items_en,photo_key,created_at,gone,street,gone_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,0)`,
  )
    .bind(
      row.id,
      row.lat,
      row.lon,
      row.quote,
      row.quote_en,
      row.category,
      row.category_en,
      row.items,
      row.items_en,
      row.photo_key,
      row.created_at,
      row.street,
    )
    .run();
  const spot = jsonSpot(row);
  void notifyNew(c.env, spot);
  return c.json(spot, 201);
});

app.post("/api/spots/:id/still", async (c) => {
  await migrate(c.env.DB);
  const id = c.req.param("id");
  const now = Date.now();
  await c.env.DB.prepare(
    "UPDATE spots SET created_at = ? WHERE id = ? AND gone = 0",
  )
    .bind(now, id)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM spots WHERE id = ?")
    .bind(id)
    .first<Row>();
  if (!row || row.gone) return c.json({ error: "gone" }, 404);
  return c.json(jsonSpot(row));
});

app.post("/api/spots/:id/gone", async (c) => {
  await migrate(c.env.DB);
  const id = c.req.param("id");
  const body = await c.req.json<{ remaining?: string[] }>().catch(() => ({}));
  const row = await c.env.DB.prepare("SELECT * FROM spots WHERE id = ?")
    .bind(id)
    .first<Row>();
  if (!row || row.gone) return c.json({ error: "gone" }, 404);
  const remaining = (body.remaining ?? []).map((x) => x.trim()).filter(Boolean);
  if (remaining.length) {
    const items = remaining.join(", ");
    await c.env.DB.prepare("UPDATE spots SET items = ?, items_en = ? WHERE id = ?")
      .bind(items, items, id)
      .run();
    row.items = items;
    row.items_en = items;
    return c.json(jsonSpot(row));
  }
  if (row.photo_key) await c.env.PHOTOS.delete(row.photo_key);
  const goneAt = Date.now();
  await c.env.DB.prepare("UPDATE spots SET gone = 1, photo_key = '', gone_at = ? WHERE id = ?")
    .bind(goneAt, id)
    .run();
  row.gone = 1;
  row.photo_key = "";
  row.gone_at = goneAt;
  return c.json(jsonSpot(row));
});

app.get("/api/photos/:key", async (c) => {
  const key = c.req.param("key");
  if (!/^[\w.-]+$/.test(key)) return c.body(null, 400);
  const obj = await c.env.PHOTOS.get(key);
  if (!obj) return c.body(null, 404);
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType || "image/jpeg",
      "cache-control": "public, max-age=86400",
    },
  });
});

app.get("/api/nearby", async (c) => {
  await migrate(c.env.DB);
  await expire(c.env);
  const plz = String(c.req.query("plz") || "");
  if (!/^\d{4}$/.test(plz)) {
    return c.json({ error: "plz", message: "Need a 4-digit Swiss PLZ, e.g. ?plz=8004" }, 400);
  }
  const origin = await geocodePlz(plz);
  if (!origin) {
    return c.json({ error: "plz", message: "Unknown PLZ" }, 404);
  }
  const km = Math.min(15, Math.max(1, Number(c.req.query("km") || 3)));
  const category = String(c.req.query("category") || "");
  const q = String(c.req.query("q") || "");
  const live = await c.env.DB.prepare(
    "SELECT * FROM spots WHERE gone = 0 ORDER BY created_at DESC",
  ).all<Row>();
  const hits = (live.results ?? [])
    .map((r) => ({ ...jsonSpot(r), metres: Math.round(metres(origin, r)) }))
    .filter((s) => s.metres <= km * 1000 && matchSpot(s, category, q))
    .sort((a, b) => a.metres - b.metres)
    .slice(0, 12);
  return c.json({ plz, ...origin, km, spots: hits });
});

app.post("/api/telegram", async (c) => {
  const update = (await c.req.json()) as {
    message?: { chat: { id: number }; text?: string; from?: { language_code?: string } };
    callback_query?: {
      id: string;
      data?: string;
      from?: { language_code?: string };
      message?: { chat: { id: number }; message_id: number };
    };
  };

  const cb = update.callback_query;
  if (cb?.message) {
    const chatId = cb.message.chat.id;
    let pref = await getPref(c.env, chatId, cb.from?.language_code);
    const data = cb.data || "";
    if (data.startsWith("lang:") && isLang(data.slice(5))) {
      pref = await setPref(c.env, chatId, { lang: data.slice(5) as Lang });
      await tg(c.env, "answerCallbackQuery", { callback_query_id: cb.id });
      await tg(c.env, "editMessageText", {
        chat_id: chatId,
        message_id: cb.message.message_id,
        text: TG[pref.lang].langSet,
      });
      return c.json({ ok: true });
    }
    if (data.startsWith("km:")) {
      const km = Number(data.slice(3));
      if (KMS.includes(km as never)) pref = await setPref(c.env, chatId, { km });
      await tg(c.env, "answerCallbackQuery", { callback_query_id: cb.id });
      await tg(c.env, "editMessageText", {
        chat_id: chatId,
        message_id: cb.message.message_id,
        text: TG[pref.lang].kmSet(pref.km),
      });
      return c.json({ ok: true });
    }
    await tg(c.env, "answerCallbackQuery", { callback_query_id: cb.id });
    return c.json({ ok: true });
  }

  const msg = update.message;
  const raw = msg?.text?.trim() ?? "";
  if (!msg) return c.json({ ok: true });
  const chatId = msg.chat.id;
  const pref = await getPref(c.env, chatId, msg.from?.language_code);
  const t = TG[pref.lang];
  const text = raw.replace(/@\w+/, "").trim();
  const [head, arg] = text.split(/\s+/, 2);
  const cmd = head.toLowerCase();

  const langKb = {
    inline_keyboard: [
      [
        { text: "DE", callback_data: "lang:de" },
        { text: "EN", callback_data: "lang:en" },
        { text: "FR", callback_data: "lang:fr" },
      ],
      [
        { text: "IT", callback_data: "lang:it" },
        { text: "RM", callback_data: "lang:rm" },
      ],
    ],
  };
  const kmKb = {
    inline_keyboard: [
      KMS.map((km) => ({ text: `${km}km`, callback_data: `km:${km}` })),
    ],
  };

  if (cmd === "/start") {
    await tg(c.env, "sendMessage", { chat_id: chatId, text: t.start });
    return c.json({ ok: true });
  }
  if (cmd === "/lang" || cmd === "/language") {
    if (arg && isLang(arg.toLowerCase())) {
      const next = await setPref(c.env, chatId, { lang: arg.toLowerCase() as Lang });
      await tg(c.env, "sendMessage", { chat_id: chatId, text: TG[next.lang].langSet });
      return c.json({ ok: true });
    }
    await tg(c.env, "sendMessage", {
      chat_id: chatId,
      text: t.pickLang,
      reply_markup: langKb,
    });
    return c.json({ ok: true });
  }
  if (cmd === "/km" || cmd === "/distance") {
    const km = Number(arg);
    if (arg && KMS.includes(km as never)) {
      const next = await setPref(c.env, chatId, { km });
      await tg(c.env, "sendMessage", { chat_id: chatId, text: TG[next.lang].kmSet(next.km) });
      return c.json({ ok: true });
    }
    await tg(c.env, "sendMessage", {
      chat_id: chatId,
      text: t.pickKm,
      reply_markup: kmKb,
    });
    return c.json({ ok: true });
  }
  if (!/^\d{4}$/.test(text)) {
    await tg(c.env, "sendMessage", { chat_id: chatId, text: t.badPlz });
    return c.json({ ok: true });
  }
  await migrate(c.env.DB);
  await expire(c.env);
  const origin = await geocodePlz(text);
  if (!origin) {
    await tg(c.env, "sendMessage", { chat_id: chatId, text: t.unknownPlz });
    return c.json({ ok: true });
  }
  const live = await c.env.DB.prepare(
    "SELECT * FROM spots WHERE gone = 0 ORDER BY created_at DESC",
  ).all<Row>();
  const hits = (live.results ?? [])
    .map((r) => ({ ...jsonSpot(r), metres: Math.round(metres(origin, r)) }))
    .filter((s) => s.metres <= pref.km * 1000)
    .sort((a, b) => a.metres - b.metres)
    .slice(0, 8);
  if (!hits.length) {
    await tg(c.env, "sendMessage", {
      chat_id: chatId,
      text: t.none(text, pref.km),
    });
    return c.json({ ok: true });
  }
  const base = appUrl(c.env);
  const lines = hits.map(
    (s) =>
      `• ${s.quote} — ${s.metres}m — ${s.items}\n  ${base}/?lat=${s.lat}&lon=${s.lon}`,
  );
  await tg(c.env, "sendMessage", {
    chat_id: chatId,
    disable_web_page_preview: true,
    text: `${t.header(text, hits.length, pref.km)}\n\n${lines.join("\n")}`,
  });
  return c.json({ ok: true });
});

export default app;
