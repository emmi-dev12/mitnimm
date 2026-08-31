import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";

export function diskPhotos(dir: string) {
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
