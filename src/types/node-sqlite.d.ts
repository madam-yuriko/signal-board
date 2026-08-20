declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(filename: string, options?: Record<string, unknown>);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }

  export class StatementSync {
    run(...parameters: unknown[]): unknown;
    all(...parameters: unknown[]): Array<Record<string, unknown>>;
    get(...parameters: unknown[]): Record<string, unknown> | undefined;
  }
}
