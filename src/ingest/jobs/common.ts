import { toiToSeconds } from "@/lib/format";
import type { Db } from "@/db/client";
import { teams } from "@/db/schema";

export const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);

/** Drizzle wants numeric columns as strings. */
export function numStr(v: number | null | undefined): string | null {
  return v == null || !Number.isFinite(v) ? null : String(v);
}

export function toiSeconds(toi: string | null | undefined): number | null {
  return toiToSeconds(toi);
}

export async function teamIdByAbbrev(db: Db): Promise<Map<string, number>> {
  const rows = await db.select({ id: teams.id, abbrev: teams.abbrev }).from(teams);
  return new Map(rows.map((r) => [r.abbrev, r.id]));
}
