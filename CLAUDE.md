# Barracuda 2026-27 — working notes

A personal dashboard for the San Jose Barracuda's 2026-27 AHL season. Next.js 15 App Router,
Postgres via Drizzle, server-rendered from the database, live overlay from a proxy route.
Built from `~/SharksDashboard`; the conventions below are the same.

- What it does and how to deploy it: [README.md](README.md).
- Why it is built this way and what has been done so far: the build log at the end of
  [docs/PLAN.md](docs/PLAN.md). **Append to that log when you finish a piece of work.** It is
  the handoff between sessions and machines.

## Setting up a machine

```bash
npm install -g pnpm@10 --registry=https://registry.npmjs.org
pnpm install
pnpm db:migrate                # "(pglite)" locally, "(postgres)" with DATABASE_URL
pnpm ingest backfill           # under a minute
pnpm dev                       # http://localhost:3000
```

Things that will otherwise cost an hour:

- **pnpm must be 10.** CI pins it and the lockfile is v9.
- **`package.json` allows esbuild's build script** via `pnpm.onlyBuiltDependencies`; tsx and
  vitest need it.
- **PGlite is single-process.** With no `DATABASE_URL`, the database is `.data/pglite` and one
  process may open it. Stop `pnpm dev` before running an ingest.
- **`db:migrate` and `ingest` load `.env` themselves** (`--env-file-if-exists=.env`); an ad-hoc
  `pnpm tsx script.ts` does not, and will quietly use PGlite.

Environment: `DATABASE_URL` (unset → PGlite), `NEXT_PUBLIC_DISPLAY_TZ` (default
`America/Los_Angeles`), `FEATURED_TEAM_ID` (405) and `FEATURED_TEAM_ABBREV` (SJ),
`AHL_SEASON_ID` (94), `HOCKEYTECH_KEY`, `HOCKEYTECH_BASE`.

## Commands

```bash
pnpm dev | build | start
pnpm typecheck                 # tsc --noEmit
pnpm test                      # vitest: parsers, derivations, the simulation; no database
pnpm test:e2e                  # Playwright smoke tests against a server on :3000
pnpm db:migrate | db:generate

pnpm ingest today              # recent scores, then new Barracuda box scores
pnpm ingest nightly            # everything that changes daily
pnpm ingest backfill           # whole season so far, odds history included
pnpm ingest <teams|schedule|scores|standings|boxscores|roster|transactions|stats|odds> [flags]

node scripts/screenshots.mjs http://localhost:3000 screenshots
```

Run `pnpm typecheck && pnpm test && pnpm build` before committing; CI runs those, then the
Playwright smoke tests against the Neon database when the secret is present.

`pnpm test:e2e` reuses whatever is listening on port 3000. On this Mac that is often another
dashboard's dev server. Use `PORT=3001 pnpm test:e2e` (Playwright starts `next start -p 3001`
from the last `pnpm build`).

## Layout

| Path | What lives there |
| --- | --- |
| `src/app` | Pages (server components, `force-dynamic`) and `/api/live` |
| `src/components` | `GameRow`, `LiveScoreboard`, `LiveGameCard` (client, poll `/api/live`), `ListenLinks`, `ShotMap`, `Sparkline`, `TeamLogo`, `Headshot`, `Card` |
| `src/db` | Drizzle `schema.ts`, lazy `client.ts`, `migrate.ts` |
| `src/ingest` | `cli.ts`, `jobs/*`, `sources/hockeytech.ts` (Zod), `fixtures/*` |
| `src/lib` | `queries.ts` (reads), `derive.ts` (pure: records, playoff line, power rating), `simulate.ts` (pure: playoff odds), `live.ts`, `views.ts`, `season.ts`, `format.ts` |
| `e2e` | Playwright smoke tests |

## Conventions

- **Pure logic out of the database layer.** Records, splits, the playoff line, the power
  rating, the simulation and the live merge are plain functions in `src/lib`, unit-tested
  without a database.
- **Validate at the boundary.** Every upstream payload goes through a Zod schema in
  `src/ingest/sources/hockeytech.ts` with a saved fixture; schemas are permissive about extra
  fields and strict about the ones we render.
- **Derive what can be derived; snapshot what the feed computes.** Records and series come from
  stored games and match the official standings exactly. Standings and season lines arrive
  computed and are stored as dated snapshots, since the feed keeps no history.
- **Barracuda games only for box scores and shots.** The `games` table holds every AHL game;
  `game_skater_stats`, `game_goalie_stats` and `game_events` are loaded only for the featured
  team's games. Team shot totals come from the league player tables instead.
- **Ids are HockeyTech's.** Teams by id (Barracuda 405), players and games likewise. They are
  unrelated to NHL ids.
- **Records have four columns.** W-L-OTL-SOL. Overtime and shootout losses are separate, each
  worth a point. Never collapse them.
- **Dates.** `games.gameDate` is the feed's date, local to the venue; times are UTC and rendered
  in `DISPLAY_TZ`. "Today" is the Pacific date (`todayPacific`).
- Plain Tailwind. Tables use `class="data"`; the Barracuda row gets `class="featured"`.

## The feed, and how it misbehaves

`lscluster.hockeytech.com/feed/index.php`. The key is the one the AHL's public widget serves
to every visitor (`statview-*/js/client/ahl/base.*.js`); if it rotates, get the new one there
and set `HOCKEYTECH_KEY`.

- `statviewfeed` wraps JSON in parentheses, `modulekit` does not. `parseFeed` handles both.
- Numbers arrive as strings. Tables nest rows at `[0].sections[].data[].row`; section titles are
  often blank, and transactions has an extra `num_results` section.
- `date_time_played` is local time labelled UTC. Only `GameDateISO8601` is a true instant.
- `streak` holds a record, not a streak. `past_10` is W-L-OTL-SOL.
- Hits, faceoffs, skater TOI and blocks are present but always zero. Leave them out.
- Every goal appears twice in play-by-play: a `shot` with `isGoal`, and a `goal` event. Only
  shots are stored. An empty-net shot has a goalie object with null names.
- Shot coordinates are a 600 by 300 grid with the home team always shooting at low x, whatever
  the period. Player-page coordinates are a different system; ignore them.
- Transactions filter on `team_id`. `team` is accepted and silently ignored.
- Scorebar with 0 days ahead and 0 back returns nothing. Ask for a window.
- The standings `date` parameter is ignored: there are no past standings.
- Goalies listed in `gameSummary` include the dressed backup, with null time on ice.
- The feed's `rank` follows points, not points percentage. Use it as given.
- Playoffs are a separate season id, not a game type. Set it in April.

## Season calendar

First game 2026-10-02; home opener 2026-10-03; All-Star Classic in Cleveland 2027-02-07/08;
regular season ends 2027-04-11; Calder Cup Playoffs from mid-April. Constants in
`src/lib/season.ts`. Still unknown: the AHL trade deadline date; add it to `MILESTONES` once
confirmed. Division playoff places live in `PLAYOFF_FORMAT`; only the Pacific's seven and the
23-team total have been seen in sources, so re-check the others.
