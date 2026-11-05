import { and, eq, notInArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { players, transactions, type CareerRow } from "@/db/schema";
import { TEAM_ID } from "@/lib/season";
import * as ht from "../sources/hockeytech";
import { log } from "./common";

/** The featured club's roster with biographical fields. Marks everyone else off the roster. */
export async function ingestRoster(db: Db, teamId = TEAM_ID): Promise<number> {
  const rows = await ht.fetchRoster(teamId);
  const all = rows.filter((r) => r.section !== "Team Personnel");
  for (const { row: p } of all) {
    const [firstName, ...rest] = p.name.split(" ");
    const row = {
      firstName,
      lastName: rest.join(" "),
      position: p.position,
      sweaterNumber: p.tp_jersey_number,
      teamId,
      headshotUrl: ht.headshotUrl(p.player_id),
      birthDate: p.birthdate,
      birthPlace: p.birthplace,
      heightIn: ht.heightInches(p.height_hyphenated),
      weightLb: p.w,
      shootsCatches: p.shoots ?? p.catches,
      onRoster: true,
      updatedAt: new Date(),
    };
    await db.insert(players).values({ id: p.player_id, ...row }).onConflictDoUpdate({ target: players.id, set: row });
  }
  const ids = all.map((p) => p.row.player_id);
  if (ids.length) await db.update(players).set({ onRoster: false }).where(notInArray(players.id, ids));
  log(`roster: ${all.length} players`);
  return all.length;
}

export function careerOf(rows: Awaited<ReturnType<typeof ht.fetchPlayer>>["careerStats"]): CareerRow[] {
  return rows
    .filter((r) => r.row.team_name && !/^total/i.test(r.row.season_name))
    .map((r) => ({
      season: r.row.season_name,
      team: r.row.team_name ?? "",
      playoffs: /playoff/i.test(r.section),
      gp: r.row.games_played ?? 0,
      g: r.row.goals ?? 0,
      a: r.row.assists ?? 0,
      p: r.row.points ?? 0,
      pim: r.row.penalty_minutes ?? 0,
    }));
}

/** Draft details and career lines for the current roster. One call per player, so nightly stays light. */
export async function enrichPlayers(db: Db, limit = 40): Promise<number> {
  const rows = await db.select({ id: players.id }).from(players).where(and(eq(players.teamId, TEAM_ID), eq(players.onRoster, true)));
  let n = 0;
  for (const r of rows.slice(0, limit)) {
    try {
      const p = await ht.fetchPlayer(r.id);
      const d = p.draftInfo[0]?.row;
      await db
        .update(players)
        .set({
          career: careerOf(p.careerStats),
          draft: d && d.draft_year ? { league: d.draft_league ?? "", team: d.draft_team ?? "", year: d.draft_year, round: d.draft_round ?? 0, overallPick: d.draft_rank } : null,
          headshotUrl: p.info.profileImage ?? ht.headshotUrl(r.id),
          updatedAt: new Date(),
        })
        .where(eq(players.id, r.id));
      n++;
    } catch (err) {
      log(`player ${r.id} failed:`, (err as Error).message);
    }
  }
  log(`players enriched: ${n}`);
  return n;
}

/** Barracuda call-ups, loans and signings. The feed's team filter is `team_id`; `team` is silently ignored. */
export async function ingestTransactions(db: Db): Promise<number> {
  const rows = await ht.fetchTransactions();
  for (const { row, prop } of rows) {
    const { name, position } = ht.splitPlayerName(row.player_name);
    const link = prop?.player_name?.playerLink;
    await db
      .insert(transactions)
      .values({ date: row.transaction_date, playerName: name, description: row.transaction, playerId: link ? Number(link) : null, position, kind: row.transaction_type })
      .onConflictDoNothing();
  }
  log(`transactions: ${rows.length}`);
  return rows.length;
}
