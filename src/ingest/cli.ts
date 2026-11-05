/**
 * Ingestion CLI.
 *
 *   pnpm ingest teams                       # the 32 clubs and divisions
 *   pnpm ingest schedule                    # every game of the season, in one call
 *   pnpm ingest scores                      # live scoreboard for recent and upcoming games
 *   pnpm ingest standings                   # today's standings; the feed has no history
 *   pnpm ingest boxscores [--limit N] [--refresh] [--game ID]
 *   pnpm ingest roster [--enrich]
 *   pnpm ingest transactions                # Barracuda call-ups, loans and signings
 *   pnpm ingest stats                       # league skaters and goalies, team numbers
 *   pnpm ingest odds [--date D | --from D --to D]   # our own season simulation
 *   pnpm ingest today                       # scores, then new box scores
 *   pnpm ingest nightly                     # everything that changes daily
 *   pnpm ingest backfill                    # the whole season so far
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { ingestRuns } from "@/db/schema";
import { SEASON_START, addDays, dateRange, isValidYmd, todayPacific } from "@/lib/season";
import { ingestBoxscores } from "./jobs/boxscores";
import { log } from "./jobs/common";
import { ingestOdds } from "./jobs/odds";
import { enrichPlayers, ingestRoster, ingestTransactions } from "./jobs/roster";
import { ingestSchedule, ingestScores, ingestTeams } from "./jobs/schedule";
import { ingestStandings, ingestStats } from "./jobs/standings";

function parseArgs(argv: string[]) {
  const [job, ...rest] = argv;
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    }
  }
  return { job, flags };
}

const str = (v: string | true | undefined) => (typeof v === "string" ? v : undefined);

/** Run a step, log a failure, keep going: one dead upstream should not stop the rest of a bundle. */
async function step(name: string, fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch (err) {
    log(`${name} failed:`, (err as Error).message);
    return 0;
  }
}

async function main() {
  const { job, flags } = parseArgs(process.argv.slice(2));
  if (!job) {
    console.error("usage: pnpm ingest <teams|schedule|scores|standings|boxscores|roster|transactions|stats|odds|today|nightly|backfill> [flags]");
    process.exit(2);
  }
  const holder = await getDb();
  const db = holder.db;
  log(`ingest ${job} (${holder.kind})`);
  const [run] = await db.insert(ingestRuns).values({ job, args: JSON.stringify(flags) }).returning({ id: ingestRuns.id });
  const today = todayPacific();
  const date = str(flags.date);
  const from = str(flags.from) ?? date;
  const to = str(flags.to) ?? date;
  if ((from && !isValidYmd(from)) || (to && !isValidYmd(to))) throw new Error("bad --date/--from/--to");
  let rows = 0;
  try {
    switch (job) {
      case "teams":
        rows = await ingestTeams(db);
        break;
      case "schedule":
        rows = await ingestSchedule(db);
        break;
      case "scores":
        rows = await ingestScores(db);
        break;
      case "standings":
        rows = await ingestStandings(db);
        break;
      case "boxscores":
        rows = await ingestBoxscores(db, {
          limit: flags.limit ? Number(flags.limit) : undefined,
          refresh: flags.refresh === true,
          game: flags.game ? Number(flags.game) : undefined,
        });
        break;
      case "roster":
        rows = await ingestRoster(db);
        if (flags.enrich === true) rows += await enrichPlayers(db);
        break;
      case "transactions":
        rows = await ingestTransactions(db);
        break;
      case "stats":
        rows = await ingestStats(db);
        break;
      case "odds":
        for (const d of dateRange(from ?? today, to ?? from ?? today)) rows += await ingestOdds(db, d);
        break;
      case "today":
        rows += await step("scores", () => ingestScores(db));
        rows += await step("boxscores", () => ingestBoxscores(db, { limit: 10 }));
        break;
      case "nightly":
        rows += await step("teams", () => ingestTeams(db));
        rows += await step("schedule", () => ingestSchedule(db));
        rows += await step("standings", () => ingestStandings(db));
        rows += await step("roster", () => ingestRoster(db));
        rows += await step("players", () => enrichPlayers(db));
        rows += await step("transactions", () => ingestTransactions(db));
        rows += await step("stats", () => ingestStats(db));
        rows += await step("boxscores", () => ingestBoxscores(db));
        rows += await step("odds", () => ingestOdds(db));
        break;
      case "backfill":
        rows += await step("teams", () => ingestTeams(db));
        rows += await step("schedule", () => ingestSchedule(db));
        rows += await step("standings", () => ingestStandings(db));
        rows += await step("roster", () => ingestRoster(db));
        rows += await step("boxscores", () => ingestBoxscores(db, { limit: flags.limit ? Number(flags.limit) : undefined }));
        rows += await step("players", () => enrichPlayers(db));
        rows += await step("transactions", () => ingestTransactions(db));
        rows += await step("stats", () => ingestStats(db));
        // Odds can be replayed from stored games, so the history starts on opening week.
        for (const d of dateRange(addDays(SEASON_START, 7), today)) rows += await step(`odds ${d}`, () => ingestOdds(db, d));
        break;
      default:
        throw new Error(`unknown job ${job}`);
    }
    await db.update(ingestRuns).set({ finishedAt: new Date(), ok: true, rows }).where(eq(ingestRuns.id, run.id));
    log(`${job}: done, ${rows} rows`);
  } catch (err) {
    await db
      .update(ingestRuns)
      .set({ finishedAt: new Date(), ok: false, rows, error: (err as Error).stack ?? String(err) })
      .where(eq(ingestRuns.id, run.id));
    console.error(err);
    process.exitCode = 1;
  } finally {
    await holder.close();
  }
}

main();
