declare module "sql.js" {
  type SqlValue = string | number | null | Uint8Array;
  class Statement {
    bind(values?: SqlValue[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, SqlValue>;
    free(): boolean;
  }
  class Database {
    constructor(data?: ArrayLike<number> | Buffer);
    run(sql: string, params?: SqlValue[]): Database;
    prepare(sql: string): Statement;
    export(): Uint8Array;
  }
  export default function initSqlJs(cfg?: {
    wasmBinary?: Buffer | Uint8Array;
    locateFile?: (file: string) => string;
  }): Promise<{
    Database: typeof Database;
  }>;
}
