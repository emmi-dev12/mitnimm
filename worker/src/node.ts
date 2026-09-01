import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import api from "./index.ts";
import { blobPhotos, diskPhotos, restoreSqlite, saveSqlite } from "./photos.ts";
import { openDb } from "./sqlite.ts";
import { registerBotCommands } from "./telegram.ts";

function loadDevVars() {
  const p = join(process.cwd(), ".dev.vars");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i);
    const v = t.slice(i + 1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadDevVars();

const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");
const dbPath = join(dataDir, "mitnimm.db");
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

if (blobToken) {
  const ok = await restoreSqlite(dbPath, blobToken);
  console.log(ok ? "mitnimm db restored from blob" : "mitnimm db: empty blob, starting fresh");
}

const db = openDb(dbPath);

async function flush() {
  if (!blobToken || !db.isDirty()) return;
  db.checkpoint();
  await saveSqlite(dbPath, blobToken);
  db.clearDirty();
}

const env = {
  DB: db,
  PHOTOS: blobToken ? blobPhotos(blobToken) : diskPhotos(join(dataDir, "photos")),
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  APP_URL: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL,
};

void registerBotCommands(env);

const app = new Hono();
app.get("/api", async (c) => {
  const res = await api.fetch(c.req.raw, env);
  await flush();
  return res;
});
app.all("/api/*", async (c) => {
  const res = await api.fetch(c.req.raw, env);
  await flush();
  return res;
});

if (existsSync(join(process.cwd(), "dist", "index.html"))) {
  app.get("/sw.js", async (c, next) => {
    c.header("Service-Worker-Allowed", "/");
    c.header("Cache-Control", "no-cache");
    return serveStatic({ path: "./dist/sw.js" })(c, next);
  });
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(process.env.PORT || 8787);
serve({
  fetch: (req) => app.fetch(req),
  port,
  hostname: "0.0.0.0",
});
console.log(`mitnimm api http://127.0.0.1:${port}${blobToken ? " (blob persist)" : " (local disk)"}`);

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    void flush().finally(() => process.exit(0));
  });
}
