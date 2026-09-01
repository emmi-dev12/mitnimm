import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { del, get, put } from "@vercel/blob";

export type Photos = {
  put: (
    key: string,
    data: ArrayBuffer,
    opts?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
  get: (
    key: string,
  ) => Promise<{ body: BodyInit; httpMetadata?: { contentType?: string } } | null>;
  delete: (key: string) => Promise<unknown>;
};

export function diskPhotos(dir: string): Photos {
  const ready = mkdir(dir, { recursive: true });

  return {
    async put(key: string, data: ArrayBuffer) {
      await ready;
      await writeFile(join(dir, key), Buffer.from(data));
    },
    async get(key: string) {
      await ready;
      try {
        const body = await readFile(join(dir, key));
        return { body, httpMetadata: { contentType: "image/jpeg" as const } };
      } catch {
        return null;
      }
    },
    async delete(key: string) {
      await ready;
      await unlink(join(dir, key)).catch(() => {});
    },
  };
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

export function blobPhotos(token: string): Photos {
  return {
    async put(key: string, data: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) {
      await put(`photos/${key}`, Buffer.from(data), {
        access: "private",
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: opts?.httpMetadata?.contentType || "image/jpeg",
      });
    },
    async get(key: string) {
      const res = await get(`photos/${key}`, { access: "private", token });
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      const body = await streamToBuffer(res.stream);
      return {
        body,
        httpMetadata: { contentType: res.blob.contentType || "image/jpeg" },
      };
    },
    async delete(key: string) {
      await del(`photos/${key}`, { token }).catch(() => {});
    },
  };
}

export async function restoreSqlite(localPath: string, token: string) {
  const res = await get("db/mitnimm.db", { access: "private", token, useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return false;
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  mkdirSync(dirname(localPath), { recursive: true });
  writeFileSync(localPath, await streamToBuffer(res.stream));
  return true;
}

export async function saveSqlite(localPath: string, token: string) {
  const { readFileSync, existsSync } = await import("node:fs");
  if (!existsSync(localPath)) return;
  await put("db/mitnimm.db", readFileSync(localPath), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/vnd.sqlite3",
  });
}
