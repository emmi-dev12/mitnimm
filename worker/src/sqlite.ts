import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

type Stmt = {
  bind: (...args: unknown[]) => Stmt;
  run: () => unknown;
  all: <T>() => { results: T[] };
  first: <T>() => T | null;
};

export type MitnimmDb = {
  prepare: (sql: string) => Stmt;
  checkpoint: () => void;
  isDirty: () => boolean;
  clearDirty: () => void;
};

export function openDb(path: string): MitnimmDb {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  let dirty = false;

  function mark(sql: string) {
    if (!/^\s*SELECT\b/i.test(sql)) dirty = true;
  }

  function stmt(sql: string, params: unknown[] = []): Stmt {
    const run = () => {
      mark(sql);
      return db.prepare(sql).run(...(params as never[]));
    };
    const all = <T>() => ({ results: db.prepare(sql).all(...(params as never[])) as T[] });
    const first = <T>() => ((db.prepare(sql).get(...(params as never[])) as T | undefined) ?? null);
    return {
      bind: (...args: unknown[]) => stmt(sql, args),
      run,
      all,
      first,
    };
  }

  return {
    prepare: (sql: string) => stmt(sql),
    checkpoint: () => {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    },
    isDirty: () => dirty,
    clearDirty: () => {
      dirty = false;
    },
  };
}
