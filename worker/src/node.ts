import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import api from "./index";
import { bootEnv, ensureBotCommands } from "./boot";

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

const { env, flush } = await bootEnv();
ensureBotCommands(env);

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
console.log(`mitnimm api http://127.0.0.1:${port}${process.env.BLOB_READ_WRITE_TOKEN ? " (blob persist)" : " (local disk)"}`);

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    void flush().finally(() => process.exit(0));
  });
}
