import { join } from "node:path";
import { blobPhotos, diskPhotos, restoreSqlite, saveSqlite } from "./photos.ts";
import { openDb, type MitnimmDb } from "./sqlite.ts";
import { registerBotCommands } from "./telegram.ts";

export type AppEnv = {
  DB: MitnimmDb;
  PHOTOS: ReturnType<typeof blobPhotos> | ReturnType<typeof diskPhotos>;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  APP_URL?: string;
};

export async function bootEnv(): Promise<{ env: AppEnv; flush: () => Promise<void> }> {
  const dataDir =
    process.env.DATA_DIR ||
    (process.env.VERCEL ? join(process.env.TMPDIR || "/tmp", "mitnimm-data") : join(process.cwd(), "data"));
  const dbPath = join(dataDir, "mitnimm.db");
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (blobToken) {
    await restoreSqlite(dbPath, blobToken);
  }

  const db = await openDb(dbPath);

  async function flush() {
    if (!blobToken || !db.isDirty()) return;
    db.checkpoint();
    await saveSqlite(dbPath, blobToken);
    db.clearDirty();
  }

  const env: AppEnv = {
    DB: db,
    PHOTOS: blobToken ? blobPhotos(blobToken) : diskPhotos(join(dataDir, "photos")),
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    APP_URL: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL,
  };

  return { env, flush };
}

let cmds = false;
export function ensureBotCommands(env: AppEnv) {
  if (cmds || !env.TELEGRAM_BOT_TOKEN) return;
  cmds = true;
  void registerBotCommands(env);
}
