import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import initSqlJs from "sql.js";

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

export async function openDb(path: string): Promise<MitnimmDb> {
  mkdirSync(dirname(path), { recursive: true });
  const wasm = await fetch("https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/sql-wasm.wasm").then((r) => {
    if (!r.ok) throw new Error("sql wasm " + r.status);
    return r.arrayBuffer();
  });
  const SQL = await initSqlJs({ wasmBinary: new Uint8Array(wasm) });
  const db = existsSync(path) ? new SQL.Database(readFileSync(path)) : new SQL.Database();
  let dirty = false;

  function mark(sql: string) {
    if (!/^\s*SELECT\b/i.test(sql)) dirty = true;
  }

  function stmt(sql: string, params: unknown[] = []): Stmt {
    const run = () => {
      mark(sql);
      db.run(sql, params as never);
    };
    const all = <T>() => {
      const s = db.prepare(sql);
      s.bind(params as never);
      const results: T[] = [];
      while (s.step()) results.push(s.getAsObject() as T);
      s.free();
      return { results };
    };
    const first = <T>() => {
      const s = db.prepare(sql);
      s.bind(params as never);
      const row = s.step() ? (s.getAsObject() as T) : null;
      s.free();
      return row;
    };
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
      writeFileSync(path, Buffer.from(db.export()));
    },
    isDirty: () => dirty,
    clearDirty: () => {
      dirty = false;
    },
  };
}
