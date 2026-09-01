import type { IncomingMessage, ServerResponse } from "node:http";
import api from "./index.ts";
import { bootEnv, ensureBotCommands } from "./boot.ts";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const host = String(req.headers.host || "mitnimm.vercel.app");
    const url = `https://${host}${req.url || "/"}`;
    const method = req.method || "GET";
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    }
    let body: Buffer | undefined;
    if (method !== "GET" && method !== "HEAD") {
      body = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c as Buffer));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });
    }
    const request = new Request(url, {
      method,
      headers,
      body: body && body.length ? new Uint8Array(body) : undefined,
    });
    const { env, flush } = await bootEnv();
    ensureBotCommands(env);
    const response = await api.fetch(request, env);
    await flush();
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }));
  }
}
