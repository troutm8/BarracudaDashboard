import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty } from "@/components/Card";
import { ShotMap, ShotMapLegend } from "@/components/ShotMap";
import { Sparkline } from "@/components/Sparkline";
import { TeamLogo } from "@/components/TeamLogo";
import { computeRecord, finishedGames, rankOf, seasonSeries, splitPoints, splitText, type Split } from "@/lib/derive";
import { fmtYmd, ordinal, signed } from "@/lib/format";
import { getFeaturedTeam, getLatestStandings, getLatestTeamSeason, getTeamGames, getTeamMap, getTeamShotEvents } from "@/lib/queries";
import { TEAM_ID, TEAM_NAME } from "@/lib/season";
import { teamView } from "@/lib/views";

export const metadata: Metadata = { title: "Team" };

type Stat = { label: string; value: number | null; fmt: (v: number) => string; higherIsBetter: boolean; all: (number | null)[] };

function StatRows({ stats }: { stats: Stat[] }) {
  return (
    <table className="data w-full text-sm">
      <thead>
        <tr>
          <th>Stat</th>
          <th className="r">{TEAM_NAME}</th>
          <th className="r">AHL rank</th>
          <th className="r">League avg</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((s) => {
          const rank = rankOf(s.value, s.all, s.higherIsBetter);
          const vals = s.all.filter((v): v is number => v != null);
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          return (
            <tr key={s.label}>
              <td>{s.label}</td>
              <td className="r font-semibold tabular">{s.value == null ? "—" : s.fmt(s.value)}</td>
              <td className={`r tabular ${rank == null ? "" : rank <= 8 ? "text-win" : rank >= 25 ? "text-loss" : ""}`}>{rank ? ordinal(rank) : "—"}</td>
              <td className="r text-muted tabular">{avg == null ? "—" : s.fmt(avg)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default async function TeamPage() {
  const [featured, games, teamMap, teamSeason, standings, shots] = await Promise.all([getFeaturedTeam(), getTeamGames(TEAM_ID), getTeamMap(), getLatestTeamSeason(), getLatestStandings(), getTeamShotEvents(TEAM_ID)]);
  if (!featured) return <Empty>No data yet.</Empty>;
  const regular = games.filter((g) => g.gameType === 2);
  const record = computeRecord(TEAM_ID, regular, teamMap);
  const finals = finishedGames(regular);

  const ts = teamSeason?.rows ?? [];
  const st = standings?.rows ?? [];
  const mine = ts.find((r) => r.teamId === TEAM_ID);
  const myRow = st.find((r) => r.teamId === TEAM_ID);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const n = (v: string | number | null | undefined) => (v == null ? null : Number(v));
  const perGame = (v: number | null | undefined, gp: number | null | undefined) => (v != null && gp ? v / gp : null);
  const share = (r: (typeof ts)[number]) => (r.shotsFor != null && r.shotsAgainst != null && r.shotsFor + r.shotsAgainst > 0 ? r.shotsFor / (r.shotsFor + r.shotsAgainst) : null);
  const stats: Stat[] =
    mine && myRow
      ? [
          { label: "Points %", value: n(myRow.pointPctg), fmt: (v) => v.toFixed(3).replace(/^0/, ""), higherIsBetter: true, all: st.map((r) => n(r.pointPctg)) },
          { label: "Goals for / game", value: perGame(myRow.goalsFor, myRow.gamesPlayed), fmt: (v) => v.toFixed(2), higherIsBetter: true, all: st.map((r) => perGame(r.goalsFor, r.gamesPlayed)) },
          { label: "Goals against / game", value: perGame(myRow.goalsAgainst, myRow.gamesPlayed), fmt: (v) => v.toFixed(2), higherIsBetter: false, all: st.map((r) => perGame(r.goalsAgainst, r.gamesPlayed)) },
          { label: "Power play", value: n(mine.ppPct), fmt: pct, higherIsBetter: true, all: ts.map((r) => n(r.ppPct)) },
          { label: "Penalty kill", value: n(mine.pkPct), fmt: pct, higherIsBetter: true, all: ts.map((r) => n(r.pkPct)) },
          { label: "Shots for / game", value: perGame(mine.shotsFor, mine.gamesPlayed), fmt: (v) => v.toFixed(1), higherIsBetter: true, all: ts.map((r) => perGame(r.shotsFor, r.gamesPlayed)) },
          { label: "Shots against / game", value: perGame(mine.shotsAgainst, mine.gamesPlayed), fmt: (v) => v.toFixed(1), higherIsBetter: false, all: ts.map((r) => perGame(r.shotsAgainst, r.gamesPlayed)) },
          { label: "Shot share", value: share(mine), fmt: pct, higherIsBetter: true, all: ts.map(share) },
          { label: "Penalty minutes / game", value: perGame(myRow.pim, myRow.gamesPlayed), fmt: (v) => v.toFixed(1), higherIsBetter: false, all: st.map((r) => perGame(r.pim, r.gamesPlayed)) },
        ]
      : [];

  // Goal differential by game, cumulative.
  const diffs = finals.map((g) => (g.homeTeamId === TEAM_ID ? g.homeScore! - g.awayScore! : g.awayScore! - g.homeScore!));
  const cumDiff = diffs.reduce<number[]>((acc, d) => [...acc, (acc[acc.length - 1] ?? 0) + d], []);
  const cumPts = record.results.reduce<number[]>((acc, o) => [...acc, (acc[acc.length - 1] ?? 0) + (o === "W" ? 2 : o === "L" ? 0 : 1)], []);
  const crowds = finals.filter((g) => g.homeTeamId === TEAM_ID && g.attendance);
  const avgCrowd = crowds.length ? Math.round(crowds.reduce((a, g) => a + g.attendance!, 0) / crowds.length) : null;

  const division = [...teamMap.values()].filter((t) => t.division === featured.division && t.id !== TEAM_ID).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-4">
        <TeamLogo team={teamView(featured)} size={64} />
        <div>
          <h1 className="text-2xl font-bold">{featured.name}</h1>
          <p className="text-sm text-muted">
            {splitText(record)}, {record.points} points · {record.gf} GF, {record.ga} GA ({signed(record.diff)}) · {record.regulationWins} regulation wins
            {avgCrowd ? ` · ${avgCrowd.toLocaleString("en-US")} average crowd` : ""}
          </p>
        </div>
      </section>

      <Card title="Season stats" action={<span className="text-[11px] text-muted">Through {teamSeason?.date ?? "—"}</span>}>
        {stats.length ? <StatRows stats={stats} /> : <Empty>No team stats loaded.</Empty>}
        <p className="mt-2 text-[11px] text-muted">Shots are summed from the league&apos;s player tables, so a traded player&apos;s shots follow him and empty-net shots against are missing. Ranks are among all 32 teams.</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Splits">
          <table className="data w-full text-sm">
            <tbody>
              {(
                [
                  ["Home", record.home],
                  ["Road", record.road],
                  ["One-goal games", record.oneGoal],
                  ["Overtime and shootouts", record.overtime],
                  [`vs ${featured.division}`, record.vsDivision],
                  ...record.byMonth.map((m) => [fmtYmd(`${m.month}-01`, { month: "long" }), m.split] as [string, Split]),
                ] as [string, Split][]
              ).map(([label, s]) => (
                <tr key={String(label)}>
                  <td>{label}</td>
                  <td className="r tabular">{splitText(s)}</td>
                  <td className="r text-muted tabular">{splitPoints(s)} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Trends">
          {cumPts.length > 2 ? (
            <div className="space-y-4">
              <div className="text-teal">
                <Sparkline values={cumPts} width={300} height={56} label="Points, cumulative" />
                <p className="text-[11px] text-muted">Points, cumulative, by game</p>
              </div>
              <div className="text-teal">
                <Sparkline values={cumDiff} width={300} height={56} baseline={0} label="Goal differential, cumulative" />
                <p className="text-[11px] text-muted">Goal differential, cumulative, by game</p>
              </div>
              <div className="text-teal">
                <Sparkline values={diffs} width={300} height={56} baseline={0} label="Goal margin by game" />
                <p className="text-[11px] text-muted">Margin of each game</p>
              </div>
            </div>
          ) : (
            <Empty>Not enough games yet.</Empty>
          )}
        </Card>
        <Card title={`${featured.division} Division series`}>
          <ul className="divide-y divide-line text-sm">
            {division.map((t) => {
              const s = seasonSeries(TEAM_ID, t.id, regular);
              const remaining = regular.filter((g) => (g.homeTeamId === t.id || g.awayTeamId === t.id) && g.gameState !== "FINAL").length;
              return (
                <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="inline-flex items-center gap-2">
                    <TeamLogo team={teamView(t)} size={22} /> {t.commonName}
                  </span>
                  <span className="text-right tabular">
                    {s.games.length ? splitText(s.split) : <span className="text-muted">—</span>}
                    <span className="ml-2 text-xs text-muted">{remaining} left</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {shots.length > 0 && (
        <Card title="Shot map, this season" action={<Link href="/schedule" className="text-xs text-teal hover:underline">By game →</Link>}>
          <ShotMap shots={shots.map((s) => s.e)} featuredId={TEAM_ID} width={900} />
          <ShotMapLegend featuredName={TEAM_NAME} opponentName="Opponents" />
          <p className="mt-1 text-[11px] text-muted">
            {shots.filter((s) => s.e.teamId === TEAM_ID).length} {TEAM_NAME} shots on goal and {shots.filter((s) => s.e.teamId !== TEAM_ID).length} against, from {new Set(shots.map((s) => s.e.gameId)).size} games.
          </p>
        </Card>
      )}
    </div>
  );
}
