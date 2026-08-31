import { Hono } from "hono";
import { cors } from "hono/cors";
import { appUrl, notifyNew, tg } from "./telegram";

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
};

const TTL_MS = 72 * 3600_000;
const CH = { minLat: 45.8, maxLat: 47.9, minLon: 5.9, maxLon: 10.6 };

const app = new Hono<{ Bindings: Env }>();
app.use("/api/*", cors({ origin: "*" }));

async function migrate(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS spots (id TEXT PRIMARY KEY, lat REAL NOT NULL, lon REAL NOT NULL, quote TEXT NOT NULL, quote_en TEXT NOT NULL, category TEXT NOT NULL, category_en TEXT NOT NULL, items TEXT NOT NULL, items_en TEXT NOT NULL, photo_key TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, gone INTEGER NOT NULL DEFAULT 0)`,
    )
    .run();
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
      "UPDATE spots SET gone = 1, photo_key = '' WHERE gone = 0 AND created_at < ?",
    )
      .bind(cut)
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
    createdAt: r.created_at,
    hoursLeft: hoursLeft(r.created_at),
    gone: r.gone === 1,
  };
}

app.get("/api/spots", async (c) => {
  await migrate(c.env.DB);
  await expire(c.env);
  const live = await c.env.DB.prepare(
    "SELECT * FROM spots WHERE gone = 0 ORDER BY created_at DESC",
  ).all<Row>();
  return c.json((live.results ?? []).map(jsonSpot));
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
  };
  await c.env.DB.prepare(
    `INSERT INTO spots (id,lat,lon,quote,quote_en,category,category_en,items,items_en,photo_key,created_at,gone)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0)`,
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
  await c.env.DB.prepare("UPDATE spots SET gone = 1, photo_key = '' WHERE id = ?")
    .bind(id)
    .run();
  row.gone = 1;
  row.photo_key = "";
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
  if (!/^\d{4}$/.test(plz)) return c.json({ error: "plz" }, 400);
  const origin = await geocodePlz(plz);
  if (!origin) return c.json({ error: "plz" }, 404);
  const km = Math.min(15, Math.max(1, Number(c.req.query("km") || 3)));
  const live = await c.env.DB.prepare(
    "SELECT * FROM spots WHERE gone = 0 ORDER BY created_at DESC",
  ).all<Row>();
  const hits = (live.results ?? [])
    .map((r) => ({ ...jsonSpot(r), metres: Math.round(metres(origin, r)) }))
    .filter((s) => s.metres <= km * 1000)
    .sort((a, b) => a.metres - b.metres)
    .slice(0, 12);
  return c.json({ plz, ...origin, km, spots: hits });
});

app.post("/api/telegram", async (c) => {
  const update = (await c.req.json()) as {
    message?: { chat: { id: number }; text?: string };
  };
  const msg = update.message;
  const text = msg?.text?.trim() ?? "";
  if (!msg) return c.json({ ok: true });
  const chatId = msg.chat.id;
  if (text === "/start") {
    await tg(c.env, "sendMessage", {
      chat_id: chatId,
      text: "PLZ schicken, z.B. 8004. Ich schick dir die nächsten Haufen.",
    });
    return c.json({ ok: true });
  }
  if (!/^\d{4}$/.test(text)) {
    await tg(c.env, "sendMessage", {
      chat_id: chatId,
      text: "Vierstellige PLZ, sonst find ich nichts.",
    });
    return c.json({ ok: true });
  }
  await migrate(c.env.DB);
  await expire(c.env);
  const origin = await geocodePlz(text);
  if (!origin) {
    await tg(c.env, "sendMessage", { chat_id: chatId, text: "PLZ unbekannt." });
    return c.json({ ok: true });
  }
  const live = await c.env.DB.prepare(
    "SELECT * FROM spots WHERE gone = 0 ORDER BY created_at DESC",
  ).all<Row>();
  const hits = (live.results ?? [])
    .map((r) => ({ ...jsonSpot(r), metres: Math.round(metres(origin, r)) }))
    .filter((s) => s.metres <= 3000)
    .sort((a, b) => a.metres - b.metres)
    .slice(0, 8);
  if (!hits.length) {
    await tg(c.env, "sendMessage", {
      chat_id: chatId,
      text: `Nichts in 3km um ${text}.`,
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
    text: `${text} — ${hits.length} Haufen:\n\n${lines.join("\n")}`,
  });
  return c.json({ ok: true });
});

export default app;
