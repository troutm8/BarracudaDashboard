# Barracuda 2026-27

A personal dashboard for the San Jose Barracuda's 2026-27 AHL season: the game of the day with
live score and scoring plays, the schedule and results, league scores, standings with each
division's playoff line, roster and player pages with game logs and shot maps, call-ups and
other roster moves, team stats with league ranks, league leaders, computed power rankings and
simulated playoff odds.

Plan, data-source notes and the build log: [docs/PLAN.md](docs/PLAN.md). Working notes for
the next session: [CLAUDE.md](CLAUDE.md).

## How it works

- **Data source** (unofficial, personal use): the HockeyTech feed behind theahl.com, for
  schedule, scores, standings, rosters, box scores, shot locations and transactions.
- **Database**: Postgres. Locally an embedded [PGlite](https://pglite.dev) file in
  `.data/pglite` when `DATABASE_URL` is unset; in production a Neon database.
- **Ingestion**: `pnpm ingest <job>` (see `src/ingest/cli.ts`). GitHub Actions runs it on a
  schedule (`.github/workflows/ingest.yml`): a nightly full refresh and score refreshes every
  15 minutes through the game window.
- **Web app**: Next.js 15 App Router, server-rendered from the database. The home page,
  scores page and game pages overlay live state from `/api/live`, which proxies the feed.
- **Shot maps** are drawn from the shot locations stored for Barracuda games. The feed has
  shots on goal only, not missed or blocked attempts.
- **Playoff odds** come from simulating the rest of the season 10,000 times, and **power
  rankings** from points percentage, goal differential, shot share and recent form. Both
  methods are published on the rankings page. Nobody publishes either for the AHL.

## Local development

```bash
pnpm install                  # pnpm 10
cp .env.example .env          # optional; defaults work with PGlite
pnpm db:migrate
pnpm ingest backfill          # the season so far, under a minute
pnpm dev                      # http://localhost:3000
```

Day to day:

```bash
pnpm ingest today             # recent scores and new box scores
pnpm ingest nightly           # schedule, standings, roster, moves, stats, box scores, odds
pnpm ingest boxscores --refresh --game 1029239
```

Checks: `pnpm typecheck`, `pnpm test`, `pnpm build`, then `pnpm test:e2e` against a running
server.

**One process at a time with PGlite.** Stop `pnpm dev` before running an ingest job, and vice
versa. With a real `DATABASE_URL` this restriction goes away.

## Deploying

1. Create a Postgres database on [Neon](https://neon.tech) and copy its connection string.
2. Add it as the `DATABASE_URL` secret in the GitHub repository, then run the **Ingest data**
   workflow manually with job `backfill`.
3. Import the repository in [Vercel](https://vercel.com), set `DATABASE_URL`, deploy. The
   functions are pinned to `iad1` in `vercel.json` to sit beside Neon's us-east-1.
