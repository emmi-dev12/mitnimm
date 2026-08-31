import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import api from "./index.ts";
import { diskPhotos } from "./photos.ts";
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
const env = {
  DB: openDb(join(dataDir, "mitnimm.db")),
  PHOTOS: diskPhotos(join(dataDir, "photos")),
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  APP_URL: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL,
};

void registerBotCommands(env);

const app = new Hono();
app.all("/api/*", (c) => api.fetch(c.req.raw, env));

if (existsSync(join(process.cwd(), "dist", "index.html"))) {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(process.env.PORT || 8787);
serve({
  fetch: (req) => app.fetch(req),
  port,
  hostname: "0.0.0.0",
});
console.log(`mitnimm api http://127.0.0.1:${port}`);
