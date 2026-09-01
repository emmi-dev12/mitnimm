declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run: (...args: never[]) => unknown;
      all: (...args: never[]) => unknown[];
      get: (...args: never[]) => unknown;
    };
  }
}
