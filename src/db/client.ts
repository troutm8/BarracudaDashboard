import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const PGLITE_DIR = process.env.PGLITE_DIR ?? ".data/pglite";

type Holder = { db: Db; kind: "postgres" | "pglite"; close: () => Promise<void> };

const globalForDb = globalThis as unknown as { __sjbDb?: Promise<Holder> };

async function connect(): Promise<Holder> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const client = postgres(url, { max: 5, prepare: false });
    const db = drizzle(client, { schema }) as unknown as Db;
    return { db, kind: "postgres", close: () => client.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const fs = await import("node:fs");
  fs.mkdirSync(PGLITE_DIR, { recursive: true });
  const client = new PGlite(PGLITE_DIR);
  const db = drizzle(client, { schema }) as unknown as Db;
  return { db, kind: "pglite", close: () => client.close() };
}

/** Lazily connected, process-wide database handle. */
export function getDb(): Promise<Holder> {
  if (!globalForDb.__sjbDb) globalForDb.__sjbDb = connect();
  return globalForDb.__sjbDb;
}

export async function db(): Promise<Db> {
  return (await getDb()).db;
}

export { schema };
