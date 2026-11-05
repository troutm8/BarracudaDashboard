import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty } from "@/components/Card";
import { Headshot } from "@/components/Headshot";
import { num, pct3, signed } from "@/lib/format";
import { getLatestGoalieSeason, getLatestSkaterSeason, getTeamPlayers } from "@/lib/queries";
import { TEAM_ABBREV, TEAM_ID } from "@/lib/season";

export const metadata: Metadata = { title: "Roster" };

const GROUPS: [string, (pos: string | null) => boolean][] = [
  ["Forwards", (p) => p !== "D" && p !== "G"],
  ["Defense", (p) => p === "D"],
  ["Goalies", (p) => p === "G"],
];

function age(birthDate: string | null): string {
  if (!birthDate) return "—";
  const b = new Date(birthDate);
  const now = new Date();
  let a = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) a--;
  return String(a);
}
const height = (inches: number | null) => (inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : "—");

export default async function RosterPage() {
  const [playersAll, skaters, goalies] = await Promise.all([getTeamPlayers(TEAM_ID), getLatestSkaterSeason(), getLatestGoalieSeason()]);
  const roster = playersAll.filter((p) => p.onRoster);
  if (!roster.length) return <Empty>No roster loaded yet.</Empty>;
  const ids = new Set(roster.map((p) => p.id));
  const skaterRows = (skaters?.rows ?? []).filter((r) => r.teamAbbrev === TEAM_ABBREV || ids.has(r.playerId));
  const goalieRows = (goalies?.rows ?? []).filter((r) => r.teamAbbrev === TEAM_ABBREV || ids.has(r.playerId));
  const byId = new Map(playersAll.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Roster</h1>
        <p className="text-xs text-muted">
          {roster.length} players. Season stats through {skaters?.date ?? "—"}. <Link href="/moves" className="text-teal hover:underline">Recent moves</Link>
        </p>
      </div>

      <Card title="Skaters">
        <div className="scroll-x">
          <table className="data w-full text-sm">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th className="r">GP</th>
                <th className="r">G</th>
                <th className="r">A</th>
                <th className="r">P</th>
                <th className="r">+/-</th>
                <th className="r">PIM</th>
                <th className="r">PPG</th>
                <th className="r">PPA</th>
                <th className="r">SHG</th>
                <th className="r">GWG</th>
                <th className="r">S</th>
                <th className="r">S%</th>
              </tr>
            </thead>
            <tbody>
              {skaterRows.map((r) => {
                const p = byId.get(r.playerId);
                return (
                  <tr key={r.playerId}>
                    <td>
                      <Link href={`/players/${r.playerId}`} className="inline-flex items-center gap-2 hover:underline">
                        <Headshot src={p?.headshotUrl} name={r.fullName} size={28} />
                        <span className="w-6 text-right text-xs text-muted tabular">{p?.sweaterNumber ?? ""}</span>
                        {r.fullName}
                        {r.rookie && <span className="rounded bg-soft px-1 text-[10px] uppercase text-muted">R</span>}
                        {p && !p.onRoster && <span className="text-[10px] text-muted">(not on roster)</span>}
                      </Link>
                    </td>
                    <td className="text-muted">{r.position}</td>
                    <td className="r tabular">{r.gamesPlayed}</td>
                    <td className="r tabular">{r.goals}</td>
                    <td className="r tabular">{r.assists}</td>
                    <td className="r font-semibold tabular">{r.points}</td>
                    <td className="r tabular">{signed(r.plusMinus)}</td>
                    <td className="r tabular">{r.pim}</td>
                    <td className="r tabular">{r.ppGoals}</td>
                    <td className="r tabular">{r.ppAssists}</td>
                    <td className="r tabular">{r.shGoals}</td>
                    <td className="r tabular">{r.gwGoals}</td>
                    <td className="r tabular">{r.shots}</td>
                    <td className="r tabular">{num(r.shootingPct, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Goalies">
        <div className="scroll-x">
          <table className="data w-full text-sm">
            <thead>
              <tr>
                <th>Goalie</th>
                <th className="r">GP</th>
                <th className="r">W</th>
                <th className="r">L</th>
                <th className="r">OTL</th>
                <th className="r">SA</th>
                <th className="r">SV</th>
                <th className="r">GA</th>
                <th className="r">GAA</th>
                <th className="r">SV%</th>
                <th className="r">SO</th>
                <th className="r">Min</th>
              </tr>
            </thead>
            <tbody>
              {goalieRows.map((r) => {
                const p = byId.get(r.playerId);
                return (
                  <tr key={r.playerId}>
                    <td>
                      <Link href={`/players/${r.playerId}`} className="inline-flex items-center gap-2 hover:underline">
                        <Headshot src={p?.headshotUrl} name={r.fullName} size={28} />
                        <span className="w-6 text-right text-xs text-muted tabular">{p?.sweaterNumber ?? ""}</span>
                        {r.fullName}
                      </Link>
                    </td>
                    <td className="r tabular">{r.gamesPlayed}</td>
                    <td className="r tabular">{r.wins}</td>
                    <td className="r tabular">{r.losses}</td>
                    <td className="r tabular">{r.otLosses}</td>
                    <td className="r tabular">{r.shotsAgainst}</td>
                    <td className="r tabular">{r.saves}</td>
                    <td className="r tabular">{r.goalsAgainst}</td>
                    <td className="r tabular">{num(r.gaa, 2)}</td>
                    <td className="r font-semibold tabular">{pct3(r.savePct)}</td>
                    <td className="r tabular">{r.shutouts}</td>
                    <td className="r tabular">{r.minutes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Players">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {GROUPS.map(([label, match]) => (
            <div key={label}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</h3>
              <ul className="divide-y divide-line text-sm">
                {roster
                  .filter((p) => match(p.position))
                  .sort((a, b) => (a.sweaterNumber ?? 99) - (b.sweaterNumber ?? 99))
                  .map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-1.5">
                      <Headshot src={p.headshotUrl} name={`${p.firstName} ${p.lastName}`} size={36} />
                      <span className="w-6 text-right text-sm text-muted tabular">{p.sweaterNumber}</span>
                      <span className="min-w-0 flex-1">
                        <Link href={`/players/${p.id}`} className="font-medium hover:underline">
                          {p.firstName} {p.lastName}
                        </Link>
                        <span className="block text-[11px] text-muted">
                          {age(p.birthDate)} · {height(p.heightIn)}, {p.weightLb ?? "—"} lb · {p.shootsCatches === "L" ? "Left" : p.shootsCatches === "R" ? "Right" : "—"}
                          {p.draft ? ` · ${p.draft.year} R${p.draft.round}${p.draft.overallPick ? ` #${p.draft.overallPick}` : ""}` : " · undrafted"}
                        </span>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
